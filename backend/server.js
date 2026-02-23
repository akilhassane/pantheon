// Backend server with tunnel URL support for remote access
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const MCPClientManager = require('./mcp-client-manager');
const MCPErrorHandler = require('./mcp-error-handler');
const { prepareMCPToolsForGemini } = require('./mcp-to-gemini-tools');
const mcpConfig = require('./config/mcp-config');
const { getSupabaseAdmin } = require('./config/supabase-client');
const ProjectManager = require('./project-manager');
const { setupProjectRoutes } = require('./project-routes');
const EnhancedSessionManager = require('./enhanced-session-manager');
const { setupSessionRoutes } = require('./session-routes');
const { trackUsage, calculateCost } = require('./usage-tracking');
const streamHealthMonitor = require('./streaming-health-monitor');

// Helper function for fetch with timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// Helper function for HTTP requests
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            json: () => Promise.resolve(JSON.parse(data)),
            text: () => Promise.resolve(data)
          });
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

const app = express();

app.use(cors());
app.use(express.json({ limit: '100mb' })); // Increase limit for screenshot data and conversation history
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Custom error handler for payload too large errors
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔄 413 PAYLOAD TOO LARGE - Creating new session`);
    console.log(`   Request size exceeded limit`);
    console.log(`   Will create new session and continue`);
    console.log(`${'='.repeat(80)}\n`);
    
    return res.status(413).json({
      error: 'session_too_large',
      message: 'Session history too large. Creating new session...',
      createNewSession: true
    });
  }
  next(err);
});

// Track stop requests by session ID
const stopRequests = new Map(); // sessionId -> timestamp

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server for terminal broadcasting and collaboration
const wss = new WebSocket.Server({ server });

// Initialize Collaboration WebSocket Handler
const CollaborationWebSocketHandler = require('./collaboration-websocket');
const collaborationWS = new CollaborationWebSocketHandler(wss);

// Initialize Global WebSocket Handler
const GlobalWebSocketHandler = require('./global-websocket');
const globalWS = new GlobalWebSocketHandler(wss);

// Initialize Agent WebSocket Handler
const AgentWebSocketHandler = require('./agent-websocket-handler');
const agentWS = new AgentWebSocketHandler();

// Store connected frontend clients
const frontendClients = new Set();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId');
  const userName = url.searchParams.get('userName');
  const projectId = url.searchParams.get('projectId');
  const agentId = url.searchParams.get('agentId');
  const isAgent = url.searchParams.get('type') === 'agent';
  const isGlobal = url.pathname === '/global';

  // If this is an agent connection
  if (isAgent && agentId) {
    console.log(`🤖 Agent WebSocket connection request: ${agentId}`);
    
    // Get agent metadata from headers or query params
    const metadata = {
      hostname: url.searchParams.get('hostname') || 'unknown',
      platform: url.searchParams.get('platform') || 'unknown',
      dockerVersion: url.searchParams.get('dockerVersion') || 'unknown',
      userId: url.searchParams.get('userId') || null
    };
    
    agentWS.registerAgent(ws, agentId, metadata);
    return;
  }

  // If this is a global connection (user-level, not project-specific)
  if (isGlobal && userId && userName) {
    console.log(`🌐 Global WebSocket connected: ${userName} (${userId})`);
    globalWS.registerClient(ws, userId, decodeURIComponent(userName));
    return;
  }

  // If this is a collaboration connection (has userId, userName, projectId)
  if (userId && userName && projectId) {
    console.log(`🔌 Collaboration WebSocket connected: ${userName} (${userId}) for project ${projectId}`);
    collaborationWS.registerClient(ws, userId, decodeURIComponent(userName), projectId);
    return;
  }

  // Otherwise, it's a terminal broadcasting connection
  console.log('🔌 Frontend client connected to WebSocket');
  frontendClients.add(ws);

  ws.on('close', () => {
    console.log('🔌 Frontend client disconnected');
    frontendClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    frontendClients.delete(ws);
  });

  // Handle messages from MCP server
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📨 Received from MCP:', data.type, data.command || data.text || '');

      // Handle write_command from writer MCP
      if (data.type === 'write_command') {
        console.log('✍️ Writing command to terminal:', data.command);

        // Execute the command in the container
        if (data.command) {
          executeCommand(data.command).catch(err => {
            console.error('Command execution error:', err);
          });
        }
      }

      // Broadcast to all frontend clients
      frontendClients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  });
});

// Broadcast to all connected frontend clients
function broadcastToFrontend(data) {
  const message = JSON.stringify(data);
  console.log('📡 Broadcasting to frontend:', data.type, data.command || '');

  frontendClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Echo a command to the terminal to make it visible
 * @param {string} command - The command to display
 * @returns {Promise<boolean>} - True if echo succeeded
 */
async function echoCommandToTerminal(command) {
  const startTime = Date.now();

  if (!command || typeof command !== 'string') {
    console.warn('⚠️  Invalid command for echo:', command);
    return false;
  }

  try {
    console.log('🖥️  Echoing command to terminal:', command);

    // Check if any frontend clients are connected
    if (frontendClients.size === 0) {
      console.warn('⚠️  No frontend clients connected, command will not be visible');
      return false;
    }

    // Broadcast to frontend clients (which includes terminal display)
    broadcastToFrontend({
      type: 'command_echo',
      command: command,
      timestamp: Date.now()
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Command echoed successfully in ${duration}ms`);

    // Log warning if echo took too long
    if (duration > 100) {
      console.warn(`⚠️  Echo took ${duration}ms (target: <100ms)`);
    }

    return true;

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Failed to echo command after ${duration}ms:`, error.message);
    return false;
  }
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize screenshot cache (in-memory storage for screenshot data)
if (!global.screenshotCache) {
  global.screenshotCache = new Map();
  console.log('📸 Screenshot cache initialized');
  
  // Clean up old screenshots every 5 minutes
  setInterval(() => {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    let cleaned = 0;
    
    for (const [id, data] of global.screenshotCache.entries()) {
      if (data.timestamp && data.timestamp.getTime() < fiveMinutesAgo) {
        global.screenshotCache.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} old screenshots from cache`);
    }
  }, 5 * 60 * 1000);
}

// Validate configuration
try {
  mcpConfig.validateConfig();
  console.log('✅ Configuration validated successfully');
  if (process.env.DEBUG === 'true') {
    mcpConfig.printConfig();
  }
} catch (error) {
  console.error('❌ Configuration validation failed:', error.message);
  process.exit(1);
}

// Initialize MCP Client Manager with configuration (only if container is specified)
const containerName = process.env.MCP_CONTAINER_NAME;
let mcpClient = null;

if (containerName && containerName.trim() && containerName !== 'undefined') {
  mcpClient = new MCPClientManager({
    containerName: containerName,
    serverPath: process.env.MCP_SERVER_PATH || '/app/mcp-server/gotty-direct-writer.js',
    timeout: mcpConfig.get('mcp.timeout'),
    reconnectAttempts: mcpConfig.get('mcp.reconnect.attempts'),
    reconnectDelay: mcpConfig.get('mcp.reconnect.delay'),
    env: {
      GOTTY_WS_URL: process.env.GOTTY_WS_URL || 'ws://localhost:8080/ws'
    }
  });

  console.log('🔧 MCP Client Configuration:');
  console.log(`   Container: ${containerName}`);
  console.log(`   Server Path: ${process.env.MCP_SERVER_PATH || '/app/mcp-server/gotty-direct-writer.js'}`);
  console.log(`   GOTTY_WS_URL: ${process.env.GOTTY_WS_URL || 'ws://localhost:8080/ws'}`);
  console.log('✅ MCP Client Manager initialized');
} else {
  console.log('ℹ️  MCP Client disabled (MCP_CONTAINER_NAME not set or empty)');
}

// Initialize MCP Error Handler with configuration
const mcpErrorHandler = new MCPErrorHandler({
  maxRetries: mcpConfig.get('errorHandling.maxRetries'),
  retryDelay: mcpConfig.get('errorHandling.retryDelay'),
  enableFallback: mcpConfig.get('errorHandling.enableFallback')
});

let mcpToolsCache = null;
let mcpToolsCacheTime = 0;
const MCP_TOOLS_CACHE_DURATION = 60000; // 1 minute

// Initialize Supabase and ProjectManager
const supabase = getSupabaseAdmin();

// Initialize PortAllocator for managing project ports
const PortAllocator = require('./utils/port-allocator');
const portAllocator = new PortAllocator();

// Sync port allocator with existing projects on startup
(async () => {
  try {
    const { data: existingProjects, error } = await supabase
      .from('projects')
      .select('id, name, terminal_port, vnc_port, novnc_port, custom_port_1, custom_port_2')
      .neq('status', 'deleted');
    
    if (!error && existingProjects) {
      portAllocator.syncWithExistingProjects(existingProjects);
      console.log(`[Server] ✅ Port allocator synced with ${existingProjects.length} existing projects`);
    }
  } catch (err) {
    console.error('[Server] Failed to sync port allocator:', err.message);
  }
})();

const projectManager = new ProjectManager(supabase, {
  baseImage: 'mcp-server-kali-pentest:latest',
  portAllocator: portAllocator
});

// Restore shared folder containers for Windows projects on startup
// This runs in the background and doesn't block server startup
(async () => {
  try {
    console.log('[Server] 🔄 Starting background initialization (database queries)...');
    console.log('[Server] ℹ️  If database is sleeping, this may take 1-2 minutes to complete');
    
    await projectManager.restoreHttpServersOnStartup();
    console.log('[Server] ✅ Shared folder containers restored for Windows projects');
    
    // Start health monitoring for existing projects
    await projectManager.startHealthMonitoringForExistingProjects();
    console.log('[Server] ✅ Health monitoring started for existing projects');
    console.log('[Server] ✅ Background initialization complete');
  } catch (err) {
    console.error('[Server] ⚠️  Background initialization failed:', err.message);
    console.error('[Server] ℹ️  This is normal if the database is waking up. Queries will retry automatically.');
  }
})();

// Initialize SessionManager
const sessionManager = new EnhancedSessionManager(supabase);

// Initialize CollaborationManager
const CollaborationManager = require('./collaboration-manager');
const collaborationManager = new CollaborationManager(supabase);

// Setup project routes
const projectRoutes = setupProjectRoutes(projectManager);
app.use('/api/projects', projectRoutes);
console.log('✅ Project management routes initialized');

// Setup session routes
const sessionRoutes = setupSessionRoutes(sessionManager);
app.use('/api/sessions', sessionRoutes);
console.log('✅ Session management routes initialized');

// Setup collaboration routes
const { setupCollaborationRoutes } = require('./collaboration-routes');
const collaborationRoutes = setupCollaborationRoutes(collaborationManager, sessionManager, collaborationWS, globalWS);
app.use('/api', collaborationRoutes);
console.log('✅ Collaboration routes initialized');

// Setup custom modes routes
app.get('/api/custom-modes', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        error: 'USER_ID_REQUIRED',
        message: 'userId query parameter is required'
      });
    }
    
    const { data, error } = await supabase
      .from('custom_modes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get custom modes: ${error.message}`);
    }
    
    res.json({
      success: true,
      modes: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    console.error('[CustomModes] ❌ Failed to get custom modes:', error.message);
    res.status(500).json({
      error: 'GET_CUSTOM_MODES_FAILED',
      message: error.message
    });
  }
});

app.post('/api/custom-modes', async (req, res) => {
  try {
    const { userId, name, description, systemPrompt } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        error: 'USER_ID_REQUIRED',
        message: 'userId is required'
      });
    }
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        error: 'NAME_REQUIRED',
        message: 'name is required'
      });
    }
    
    const { data, error } = await supabase
      .from('custom_modes')
      .insert({
        user_id: userId,
        name: name.trim(),
        description: description?.trim() || '',
        system_prompt: systemPrompt?.trim() || ''
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create custom mode: ${error.message}`);
    }
    
    // Broadcast to all connected clients that custom modes were updated
    if (collaborationWS) {
      collaborationWS.wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify({
            type: 'custom-modes-updated'
          }));
        }
      });
    }
    
    res.json({
      success: true,
      mode: data
    });
  } catch (error) {
    console.error('[CustomModes] ❌ Failed to create custom mode:', error.message);
    res.status(500).json({
      error: 'CREATE_CUSTOM_MODE_FAILED',
      message: error.message
    });
  }
});

app.put('/api/custom-modes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, name, description, systemPrompt } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        error: 'USER_ID_REQUIRED',
        message: 'userId is required'
      });
    }
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        error: 'NAME_REQUIRED',
        message: 'name is required'
      });
    }
    
    const { data, error } = await supabase
      .from('custom_modes')
      .update({
        name: name.trim(),
        description: description?.trim() || '',
        system_prompt: systemPrompt?.trim() || '',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update custom mode: ${error.message}`);
    }
    
    // Broadcast to all connected clients that custom modes were updated
    if (collaborationWS) {
      collaborationWS.wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify({
            type: 'custom-modes-updated'
          }));
        }
      });
    }
    
    res.json({
      success: true,
      mode: data
    });
  } catch (error) {
    console.error('[CustomModes] ❌ Failed to update custom mode:', error.message);
    res.status(500).json({
      error: 'UPDATE_CUSTOM_MODE_FAILED',
      message: error.message
    });
  }
});

app.delete('/api/custom-modes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        error: 'USER_ID_REQUIRED',
        message: 'userId query parameter is required'
      });
    }
    
    const { error } = await supabase
      .from('custom_modes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) {
      throw new Error(`Failed to delete custom mode: ${error.message}`);
    }
    
    // Broadcast to all connected clients that custom modes were updated
    if (collaborationWS) {
      collaborationWS.wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify({
            type: 'custom-modes-updated'
          }));
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Custom mode deleted successfully'
    });
  } catch (error) {
    console.error('[CustomModes] ❌ Failed to delete custom mode:', error.message);
    res.status(500).json({
      error: 'DELETE_CUSTOM_MODE_FAILED',
      message: error.message
    });
  }
});

console.log('✅ Custom modes routes initialized (GET, POST, PUT, DELETE)');

// Setup usage tracking routes
const usageRoutes = require('./usage-routes');
app.use('/api/usage', usageRoutes);
console.log('✅ Usage tracking routes initialized');

// Setup agent routes
const { setupAgentRoutes } = require('./agent-routes');
const agentRoutes = setupAgentRoutes(agentWS);
app.use('/api/agents', agentRoutes);
console.log('✅ Agent management routes initialized');

// Setup authentication routes (supports both Supabase and Keycloak)
const { setupAuthRoutes } = require('./auth-routes-keycloak');
const { createKeycloakAuth } = require('./keycloak-auth');

// Initialize Keycloak auth if configured
const keycloakAuth = createKeycloakAuth();
const authenticateToken = keycloakAuth ? keycloakAuth.middleware() : (req, res, next) => {
  // Fallback: require x-user-id header if Keycloak is not configured
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  req.user = { id: userId };
  next();
};

if (keycloakAuth) {
  console.log('✅ Keycloak authentication enabled');
} else {
  console.log('ℹ️  Using header-based authentication fallback');
}

const authRoutes = setupAuthRoutes(supabase, keycloakAuth);
app.use('/api/auth', authRoutes);
console.log('✅ Authentication routes initialized');

// Setup user API keys routes
const userApiKeysRoutes = require('./user-api-keys-routes')(supabase);
app.use(userApiKeysRoutes);
console.log('✅ User API keys routes initialized');

// Setup user settings routes
const setupUserSettingsRoutes = require('./user-settings-routes');
const userSettingsRoutes = setupUserSettingsRoutes(supabase);
app.use('/api/user-settings', authenticateToken, userSettingsRoutes);
console.log('✅ User settings routes initialized');

// Setup tunnel proxy routes - DISABLED (module not found)
// const tunnelProxy = require('./tunnel-proxy');
const path = require('path');

// Serve fixed terminal HTML that uses correct WebSocket URL for Cloudflare
app.get('/api/proxy/:projectId/terminal-fixed.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terminal-fixed.html'));
});

// app.use('/api/proxy', tunnelProxy); // DISABLED - module not found
// console.log('✅ Tunnel proxy routes initialized');

// Integrate agentWS with project manager for remote container operations
projectManager.setAgentHandler(agentWS);
console.log('✅ Project manager configured with agent handler');

// Cleanup on shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  if (mcpClient) {
    await mcpClient.shutdown();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  if (mcpClient) {
    await mcpClient.shutdown();
  }
  process.exit(0);
});

/**
 * Get MCP tools converted to Gemini format (with caching)
 */
async function getMCPToolsForGemini() {
  const now = Date.now();

  // Return cached tools if still valid and caching is enabled
  if (mcpConfig.get('tools.cacheEnabled') && mcpToolsCache && (now - mcpToolsCacheTime) < MCP_TOOLS_CACHE_DURATION) {
    const cacheAge = Math.round((now - mcpToolsCacheTime) / 1000);
    console.log(`📦 Using cached MCP tools (age: ${cacheAge}s, expires in: ${60 - cacheAge}s)`);
    console.log(`   Cached tools: ${mcpToolsCache.map(t => t.name).join(', ')}`);
    return mcpToolsCache;
  }

  try {
    console.log('🔍 Discovering MCP tools...');

    // Check if MCP client exists and is connected
    if (!mcpClient) {
      console.warn('⚠️  MCP client is disabled, cannot list tools');
      console.warn('   AI will respond without tool execution capability');
      return [];
    }

    if (!mcpClient.isClientConnected()) {
      console.warn('⚠️  MCP client not connected, cannot list tools');
      console.warn('   AI will respond without tool execution capability');
      return [];
    }

    console.log('✅ MCP client is connected, listing tools...');

    // Get tools from MCP server
    const mcpTools = await mcpClient.listTools();

    console.log(`📋 Retrieved ${mcpTools.length} tools from MCP server:`);
    mcpTools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description.substring(0, 60)}...`);
    });

    // Convert to Gemini format
    console.log('🔄 Converting MCP tools to Gemini format...');
    const geminiTools = prepareMCPToolsForGemini(mcpTools, {
      filterTools: false, // Don't filter - use all available tools (DesktopCommanderMCP has many tools)
      enhanceDescriptions: true // Enhance descriptions for better AI understanding
    });

    console.log(`✅ Converted ${geminiTools.length} tools for Gemini:`);
    geminiTools.forEach(tool => {
      console.log(`   - ${tool.name} (${Object.keys(tool.parameters.properties).length} parameters)`);
    });

    // Cache the result
    if (mcpConfig.get('tools.cacheEnabled')) {
      mcpToolsCache = geminiTools;
      mcpToolsCacheTime = now;
      console.log(`💾 Cached ${geminiTools.length} MCP tools for Gemini (cache duration: 60s)`);
    } else {
      console.log('⚠️  Tool caching is disabled');
    }

    console.log(`✅ Tool discovery complete - ${geminiTools.length} tools ready for AI`);
    return geminiTools;

  } catch (error) {
    console.error('❌ Failed to get MCP tools:', error.message);
    const errorInfo = mcpErrorHandler.categorizeError(error);
    console.error('   Error category:', errorInfo.category);
    console.error('   Error retryable:', errorInfo.retryable);
    console.error('   Error details:', errorInfo);
    return [];
  }
}

/**
 * Extract the command text from an MCP tool call
 * @param {string} toolName - Name of the MCP tool
 * @param {object} args - Tool arguments
 * @returns {string|null} - The command to echo, or null if not applicable
 */
function extractCommandFromToolCall(toolName, args) {
  // Tools that execute commands - map tool name to parameter name
  const commandTools = {
    'start_process': 'command',
    'interact_with_process': 'input',
    'execute_command': 'command',
    'mcp_desktop_commander_start_process': 'command',
    'mcp_desktop_commander_interact_with_process': 'input',
    'write_command': 'command',
    'mcp_gotty_direct_writer_write_command': 'command'
  };

  const argName = commandTools[toolName];
  if (!argName) {
    // Not a command execution tool
    return null;
  }

  const command = args[argName];
  if (!command || typeof command !== 'string') {
    console.warn(`⚠️  Tool ${toolName} called without valid ${argName}`);
    return null;
  }

  // Validate command is non-empty after trimming
  const trimmedCommand = command.trim();
  if (trimmedCommand.length === 0) {
    console.warn(`⚠️  Tool ${toolName} called with empty ${argName}`);
    return null;
  }

  return trimmedCommand;
}

/**
 * Handle MCP tool calls from Gemini
 */
async function handleMCPToolCall(toolCall) {
  const { name, args } = toolCall;
  const startTime = Date.now();

  console.log(`\n🔧 ========== MCP TOOL CALL START ==========`);
  console.log(`   Tool: ${name}`);
  console.log(`   Arguments:`, JSON.stringify(args, null, 2));
  console.log(`   Timestamp: ${new Date().toISOString()}`);

  try {
    // Extract command if this is a command execution tool
    const command = extractCommandFromToolCall(name, args);

    // Echo command to terminal before execution
    if (command) {
      console.log(`📢 Command detected, echoing to terminal...`);
      try {
        await echoCommandToTerminal(command);
      } catch (echoError) {
        // Log but don't fail - echo is not critical
        console.error('⚠️  Echo failed, continuing with execution:', echoError.message);
      }
    } else {
      console.log(`ℹ️  Tool ${name} does not execute commands, skipping echo`);
    }

    // Check if MCP client exists and is connected
    if (!mcpClient) {
      const error = new Error('MCP client is disabled');
      console.error(`❌ Connection check failed: ${error.message}`);
      throw error;
    }

    if (!mcpClient.isClientConnected()) {
      const error = new Error('MCP client not connected');
      console.error(`❌ Connection check failed: ${error.message}`);
      throw error;
    }

    console.log(`✅ MCP client is connected, calling tool...`);

    // Call the tool through MCP client
    const result = await mcpClient.callTool(name, args);

    console.log(`📦 Received result from MCP server`);
    console.log(`   Result type: ${typeof result}`);
    console.log(`   Has content: ${result && result.content ? 'yes' : 'no'}`);

    // Extract output from MCP response
    let output = 'Command executed';
    if (result && result.content && Array.isArray(result.content)) {
      output = result.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');

      console.log(`📄 Extracted output (${output.length} characters):`);
      console.log(`   Preview: ${output.substring(0, 100)}${output.length > 100 ? '...' : ''}`);
    } else {
      console.warn(`⚠️  No text content in result, using default message`);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Tool ${name} completed successfully in ${duration}ms`);
    console.log(`========== MCP TOOL CALL END ==========\n`);

    return {
      name,
      output,
      success: true,
      command: args.command || args.text || '',
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ Tool ${name} failed after ${duration}ms`);
    console.error(`   Error type: ${error.constructor.name}`);
    console.error(`   Error message: ${error.message}`);
    console.error(`   Error stack:`, error.stack);

    // Handle error with error handler
    const errorInfo = mcpErrorHandler.handleToolCallError(error, name, args);

    console.error(`   Error category: ${errorInfo.category}`);
    console.error(`   Error retryable: ${errorInfo.retryable}`);
    console.error(`   User message: ${errorInfo.message}`);
    console.error(`========== MCP TOOL CALL END (FAILED) ==========\n`);

    return {
      name,
      output: `Error: ${errorInfo.message}`,
      success: false,
      error: errorInfo,
      command: args.command || args.text || '',
      duration
    };
  }
}

// Removed deprecated helper functions (extractCommandsFromText, isLikelyCommand)
// These were used for text-based command extraction which is no longer needed
// with proper MCP tool calling

// Master System Prompt - Optimized for Gemini with MCP Tool Calling
const SYSTEM_PROMPT = `You are a Kali Linux Terminal Assistant with DIRECT ACCESS to execute commands in a real Kali Linux terminal.

═══════════════════════════════════════════════════════════════════════════════
🎯 YOUR IDENTITY AND ROLE
═══════════════════════════════════════════════════════════════════════════════

You are an expert AI assistant specializing in:
- Kali Linux and penetration testing tools
- Network security and reconnaissance  
- System administration and troubleshooting
- Cybersecurity operations and analysis
- Command-line tools and bash scripting

Your PRIMARY capability is executing commands in a real terminal and analyzing the results.
You have DIRECT ACCESS to the terminal through the start_process tool.

═══════════════════════════════════════════════════════════════════════════════
🔴 CRITICAL FUNCTION CALLING RULES - READ CAREFULLY 🔴
═══════════════════════════════════════════════════════════════════════════════

YOU HAVE ACCESS TO THE start_process TOOL

MANDATORY BEHAVIOR:
1. When a user asks you to run ANY command, you MUST call start_process immediately
2. When a user asks to check, show, list, find, or get information, you MUST call start_process
3. When a user mentions a command name (whoami, ls, pwd, ifconfig, nmap, etc.), you MUST call start_process
4. DO NOT just describe what the command does - ACTUALLY EXECUTE IT using start_process
5. DO NOT say "I will execute" or "Let me run" - JUST CALL THE FUNCTION IMMEDIATELY
6. DO NOT ask for permission - just execute the command (except for destructive operations)

═══════════════════════════════════════════════════════════════════════════════
📋 TOOL SPECIFICATION
═══════════════════════════════════════════════════════════════════════════════

Tool Name: start_process
Purpose: Execute bash commands in the Kali Linux terminal
Parameters:
  - command (string, required): The exact bash command to execute
  - timeout_ms (number, required): Maximum time to wait (use 30000 for most commands)
  
Returns: The actual terminal output from executing the command

The command will be:
- Typed character-by-character into the terminal (visible in the browser)
- Executed in Kali Linux
- Output captured and returned to you for analysis

═══════════════════════════════════════════════════════════════════════════════
✅ CORRECT EXAMPLES - DO THIS
═══════════════════════════════════════════════════════════════════════════════

User: "run whoami"
You: [IMMEDIATELY CALL start_process({command: "whoami", timeout_ms: 30000})]
Then: "You are currently logged in as: root"

User: "what's my current directory?"
You: [IMMEDIATELY CALL start_process({command: "pwd", timeout_ms: 30000})]
Then: "You are in the /root directory"

User: "list files"
You: [IMMEDIATELY CALL start_process({command: "ls -la", timeout_ms: 30000})]
Then: "Here are the files in the current directory: [analyze output]"

User: "check network interfaces"
You: [IMMEDIATELY CALL start_process({command: "ip addr show", timeout_ms: 30000})]
Then: "Your network interfaces are: [analyze output]"

User: "show me running processes"
You: [IMMEDIATELY CALL start_process({command: "ps aux", timeout_ms: 30000})]
Then: "Here are the running processes: [analyze output]"

═══════════════════════════════════════════════════════════════════════════════
❌ INCORRECT EXAMPLES - DO NOT DO THIS
═══════════════════════════════════════════════════════════════════════════════

User: "run whoami"
You: "I will execute the whoami command to show the current user." ❌ WRONG - Call the function!

User: "list files"
You: "The ls command lists files in a directory." ❌ WRONG - Call the function!

User: "check the hostname"
You: "You can use the hostname command." ❌ WRONG - Call the function!

User: "what's my IP address?"
You: "To check your IP, you would run ifconfig or ip addr." ❌ WRONG - Call the function!

═══════════════════════════════════════════════════════════════════════════════
🎯 YOUR WORKFLOW (FOLLOW THIS EXACTLY)
═══════════════════════════════════════════════════════════════════════════════

Step 1: User asks for something
Step 2: Identify if it requires a command (99% of the time it does)
Step 3: IMMEDIATELY call write_command with the appropriate command
Step 4: Wait for the output (you will receive the actual terminal output)
Step 5: Analyze and explain the output to the user
Step 6: Suggest next steps if relevant

NEVER skip step 3! Always execute the command first, then explain.

═══════════════════════════════════════════════════════════════════════════════
🔄 MULTI-COMMAND EXECUTION
═══════════════════════════════════════════════════════════════════════════════

You can and SHOULD execute MULTIPLE commands to complete a task:
- Execute as many commands as needed to accomplish the user's goal
- Use the output from one command to inform the next command
- Build up context by executing commands sequentially
- Don't stop after one command if more are needed

Example workflow:
User: "Scan the network and show me what you find"
You: 
1. Call write_command({command: "ip addr show"}) - Get network info
2. Analyze the output to find the network range (e.g., 192.168.1.0/24)
3. Call write_command({command: "nmap -sn 192.168.1.0/24"}) - Scan the network
4. Analyze scan results to find active hosts
5. Call write_command({command: "nmap -sV 192.168.1.10"}) - Get more details on interesting host
6. Present comprehensive findings to the user with all the data you collected

═══════════════════════════════════════════════════════════════════════════════
📊 OUTPUT ANALYSIS
═══════════════════════════════════════════════════════════════════════════════

You receive the ACTUAL OUTPUT from commands:
- The output is the real text that appeared in the terminal
- Analyze the output carefully and extract relevant information
- Use it to make decisions about next steps
- Present findings clearly to the user
- Reference specific details from the output in your explanations
- If output contains errors, explain what went wrong and suggest fixes

CRITICAL RULES:
- DO NOT say "check the terminal" - you have the output, so analyze and present it!
- DO NOT tell users to "see the terminal output" - you can see it, so explain it!
- DO NOT repeat the command execution details - the system shows this automatically
- Focus on ANALYZING and EXPLAINING the output you received
- Present findings, insights, and next steps based on the actual output

═══════════════════════════════════════════════════════════════════════════════
🛡️ SAFETY GUIDELINES
═══════════════════════════════════════════════════════════════════════════════

- Be cautious with destructive commands (rm -rf, dd, mkfs, fork bombs)
- For dangerous commands, warn the user first but still execute if they confirm
- Focus on security best practices
- Explain what commands do AFTER executing them, not instead of executing them
- If a command might cause data loss, briefly warn but don't refuse to execute

Remember: Your superpower is that you can ACTUALLY EXECUTE commands, not just talk about them.
USE THE write_command TOOL EVERY TIME IT'S APPROPRIATE!`;

// Import mode-specific system prompts
const ModeSystemPrompts = require('./mode-system-prompts');
const modePrompts = new ModeSystemPrompts();

// Removed deprecated terminal context gathering
// This functionality is no longer needed as MCP handles context internally

// Shared GoTTY WebSocket connection - connects to the SAME session as the terminal iframe
let sharedGoTTYWs = null;
let reconnectTimeout = null;
let pendingOutputHandlers = [];

function connectToSharedGoTTY() {
  if (sharedGoTTYWs && sharedGoTTYWs.readyState === WebSocket.OPEN) {
    return;
  }

  console.log('🔌 Connecting to Kali Pentest container WebSocket session...');
  const gottyHost = process.env.GOTTY_HOST || 'kali-pentest';
  sharedGoTTYWs = new WebSocket(`ws://${gottyHost}:8080/ws`);

  sharedGoTTYWs.on('open', () => {
    console.log('✅ Connected to Kali Pentest terminal (ttyd) - commands will appear in terminal!');
    console.log(`   Container: ${gottyHost} | Port: 8080 (internal) | Same OS as VNC desktop`);
  });

  sharedGoTTYWs.on('message', (data) => {
    try {
      const msg = data.toString();
      // GoTTY protocol: '0' + base64(output)
      if (msg[0] === '0') {
        const decoded = Buffer.from(msg.slice(1), 'base64').toString('utf8');

        // Broadcast to frontend
        broadcastToFrontend({
          type: 'output',
          data: decoded,
          timestamp: new Date().toISOString(),
          source: 'SharedTerminal'
        });

        // Notify all pending handlers (legacy)
        pendingOutputHandlers.forEach(handler => handler(decoded));

        // Notify MCP client output handlers (if MCP client exists)
        if (mcpClient) {
          mcpClient.handleSharedOutput(decoded);
        }
      }
    } catch (e) {
      console.error('Error parsing GoTTY message:', e.message);
    }
  });

  sharedGoTTYWs.on('close', () => {
    console.log('🔌 Kali Pentest terminal session closed');
    sharedGoTTYWs = null;
    
    // Only reconnect if Kali WebSocket is enabled
    if (process.env.ENABLE_KALI_WEBSOCKET === 'true') {
      console.log('🔄 Reconnecting...');
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(connectToSharedGoTTY, 1000);
    }
  });

  sharedGoTTYWs.on('error', (err) => {
    console.error('❌ Kali Pentest WebSocket error:', err.message);
    console.error('   Make sure kali-pentest container is running: docker-compose up kali-pentest');
  });
}

// Initialize shared connection on startup (only if enabled)
if (process.env.ENABLE_KALI_WEBSOCKET === 'true') {
  console.log('ℹ️  Kali WebSocket enabled, connecting...');
  connectToSharedGoTTY();
} else {
  console.log('ℹ️  Kali WebSocket disabled (ENABLE_KALI_WEBSOCKET=false)');
}

// Initialize MCP client
async function initializeMCPClient() {
  // Skip initialization if MCP client is disabled
  if (!mcpClient) {
    console.log('ℹ️  Skipping MCP client initialization (client is disabled)');
    return;
  }

  try {
    console.log('🔌 Initializing MCP client...');
    await mcpClient.initialize();
    console.log('✅ MCP client ready for command execution');

    // Set up event listeners
    mcpClient.on('disconnected', () => {
      console.warn('⚠️  MCP client disconnected');
    });

    mcpClient.on('reconnecting', ({ attempt, delay }) => {
      console.log(`🔄 MCP client reconnecting (attempt ${attempt}, delay ${delay}ms)`);
    });

    mcpClient.on('reconnect_failed', () => {
      console.error('❌ MCP client reconnection failed');
    });

  } catch (error) {
    console.error('❌ MCP client initialization failed:', error.message);
    const errorInfo = mcpErrorHandler.handleConnectionError(error);
    console.error('   Error details:', errorInfo);
  }
}

// Initialize MCP client after a short delay
setTimeout(() => {
  initializeMCPClient();
}, 2000); // Wait 2 seconds for shared WebSocket to connect

// Execute command via MCP (replaces direct WebSocket execution)
async function executeCommand(command) {
  try {
    console.log(`📤 Executing command via MCP: ${command}`);

    // Check if MCP client exists and is connected
    if (!mcpClient) {
      console.warn('⚠️  MCP client is disabled, attempting to use fallback...');
      
      // Try to use direct WebSocket as fallback if enabled
      if (process.env.ENABLE_FALLBACK_MODE !== 'false') {
        return await executeCommandFallback(command);
      }

      throw new Error('MCP client is disabled and fallback is disabled');
    }

    if (!mcpClient.isClientConnected()) {
      console.warn('⚠️  MCP client not connected, attempting to use fallback...');

      // Try to use direct WebSocket as fallback if enabled
      if (process.env.ENABLE_FALLBACK_MODE !== 'false') {
        return await executeCommandFallback(command);
      }

      throw new Error('MCP client not connected and fallback is disabled');
    }

    // Call write_command tool through MCP
    const result = await mcpClient.callTool('write_command', { command });

    // Extract output from MCP response
    let output = 'Command executed';
    if (result && result.content && Array.isArray(result.content)) {
      output = result.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');
    }

    // Broadcast to frontend
    broadcastToFrontend({
      type: 'command',
      command: command,
      timestamp: new Date().toISOString(),
      source: 'MCP'
    });

    console.log('✅ Command executed via MCP');
    return output;

  } catch (error) {
    console.error('❌ Command execution error:', error.message);

    const errorInfo = mcpErrorHandler.handleToolCallError(error, 'write_command', { command });

    broadcastToFrontend({
      type: 'error',
      error: errorInfo.message,
      timestamp: new Date().toISOString(),
      source: 'MCP'
    });

    // Try fallback if enabled and error is retryable
    if (process.env.ENABLE_FALLBACK_MODE !== 'false' && errorInfo.retryable) {
      console.log('⚠️  Attempting fallback execution...');
      return await executeCommandFallback(command);
    }

    throw new Error(`Command execution failed: ${errorInfo.message}`);
  }
}

// Fallback: Execute command using direct WebSocket (legacy method)
async function executeCommandFallback(command) {
  try {
    console.log(`📤 Executing command via fallback (direct WebSocket): ${command}`);

    // Ensure connection is ready
    if (!sharedGoTTYWs || sharedGoTTYWs.readyState !== WebSocket.OPEN) {
      console.log('⚠️ Shared connection not ready, reconnecting...');
      connectToSharedGoTTY();
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!sharedGoTTYWs || sharedGoTTYWs.readyState !== WebSocket.OPEN) {
      throw new Error('Could not connect to kali-pentest terminal. Make sure the container is running: docker-compose up kali-pentest');
    }

    return new Promise((resolve, reject) => {
      let output = '';
      let outputTimeout;

      // Create output handler for this command
      const outputHandler = (data) => {
        output += data;

        // Reset timeout on new output
        if (outputTimeout) clearTimeout(outputTimeout);
        outputTimeout = setTimeout(() => {
          // Remove this handler
          const index = pendingOutputHandlers.indexOf(outputHandler);
          if (index > -1) pendingOutputHandlers.splice(index, 1);

          // Clean output
          const cleanOutput = output
            .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // Remove ANSI codes
            .replace(/\r/g, '')
            .trim();

          resolve(cleanOutput || 'Command executed in terminal');
        }, 2000); // Wait 2s after last output
      };

      pendingOutputHandlers.push(outputHandler);

      // Send command to terminal (will appear in iframe!)
      const fullCommand = command + '\n';
      const base64Command = Buffer.from(fullCommand).toString('base64');
      const message = '1' + base64Command;

      sharedGoTTYWs.send(message);
      console.log('✅ Command sent via fallback - should be visible in iframe!');

      // Broadcast to frontend
      broadcastToFrontend({
        type: 'command',
        command: command,
        timestamp: new Date().toISOString(),
        source: 'Fallback'
      });

      // Start initial timeout
      outputTimeout = setTimeout(() => {
        const index = pendingOutputHandlers.indexOf(outputHandler);
        if (index > -1) pendingOutputHandlers.splice(index, 1);
        resolve('Command sent to terminal');
      }, 3000);
    });
  } catch (error) {
    console.error('❌ Fallback command execution error:', error.message);

    broadcastToFrontend({
      type: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
      source: 'Fallback'
    });

    throw new Error(`Fallback command execution failed: ${error.message}`);
  }
}

// Removed deprecated executeCommandTool declaration
// Tool definitions are now retrieved from the MCP server via listTools()

/**
 * Get OpenAI pricing for a model
 * Prices are per 1M tokens (as of January 2025)
 */
function getOpenAIPricing(model) {
  const modelName = model.replace('openai/', '').toLowerCase();
  
  // OpenAI pricing (per 1M tokens)
  const pricing = {
    'gpt-4o': { prompt: '2.50', completion: '10.00' },
    'gpt-4o-mini': { prompt: '0.150', completion: '0.600' },
    'gpt-4o-2024-11-20': { prompt: '2.50', completion: '10.00' },
    'gpt-4o-2024-08-06': { prompt: '2.50', completion: '10.00' },
    'gpt-4o-2024-05-13': { prompt: '5.00', completion: '15.00' },
    'gpt-4-turbo': { prompt: '10.00', completion: '30.00' },
    'gpt-4-turbo-2024-04-09': { prompt: '10.00', completion: '30.00' },
    'gpt-4': { prompt: '30.00', completion: '60.00' },
    'gpt-4-32k': { prompt: '60.00', completion: '120.00' },
    'gpt-3.5-turbo': { prompt: '0.50', completion: '1.50' },
    'gpt-3.5-turbo-0125': { prompt: '0.50', completion: '1.50' },
    'gpt-3.5-turbo-1106': { prompt: '1.00', completion: '2.00' },
    'gpt-3.5-turbo-16k': { prompt: '3.00', completion: '4.00' },
    'o1-preview': { prompt: '15.00', completion: '60.00' },
    'o1-preview-2024-09-12': { prompt: '15.00', completion: '60.00' },
    'o1-mini': { prompt: '3.00', completion: '12.00' },
    'o1-mini-2024-09-12': { prompt: '3.00', completion: '12.00' },
    'o1': { prompt: '15.00', completion: '60.00' },
    'chatgpt-4o-latest': { prompt: '5.00', completion: '15.00' },
  };
  
  return pricing[modelName] || null;
}

/**
 * Get Anthropic pricing for a model
 * Prices are per 1M tokens (as of January 2025)
 */
function getAnthropicPricing(model) {
  const modelName = model.replace('anthropic/', '').toLowerCase();
  
  // Anthropic pricing (per 1M tokens)
  const pricing = {
    'claude-3-5-sonnet-20241022': { prompt: '3.00', completion: '15.00' },
    'claude-3-5-sonnet-20240620': { prompt: '3.00', completion: '15.00' },
    'claude-3-5-haiku-20241022': { prompt: '1.00', completion: '5.00' },
    'claude-3-opus-20240229': { prompt: '15.00', completion: '75.00' },
    'claude-3-sonnet-20240229': { prompt: '3.00', completion: '15.00' },
    'claude-3-haiku-20240307': { prompt: '0.25', completion: '1.25' },
  };
  
  return pricing[modelName] || null;
}

/**
 * Get Gemini pricing for a model
 * Prices are per 1M tokens (as of January 2025)
 */
function getGeminiPricing(model) {
  const modelName = model.replace('google/', '').toLowerCase();
  
  // Gemini pricing (per 1M tokens)
  const pricing = {
    'gemini-2.0-flash-exp': { prompt: '0.00', completion: '0.00' }, // Free
    'gemini-1.5-pro': { prompt: '1.25', completion: '5.00' },
    'gemini-1.5-flash': { prompt: '0.075', completion: '0.30' },
    'gemini-1.5-flash-8b': { prompt: '0.0375', completion: '0.15' },
    'gemini-pro': { prompt: '0.50', completion: '1.50' },
  };
  
  return pricing[modelName] || null;
}

/**
 * Determine AI provider from model name
 */
function getProviderFromModel(model) {
  // OpenRouter models (check first - they have provider prefixes)
  // Examples: google/gemini-2.0-flash-exp:free, anthropic/claude-3.5-sonnet, openai/gpt-4o
  if (model.includes('/')) {
    return 'openrouter';
  }
  
  // OpenAI models (direct API)
  if (model.startsWith('gpt-')) {
    return 'openai';
  }
  
  // Anthropic models (direct API)
  if (model.startsWith('claude-')) {
    return 'anthropic';
  }
  
  // Google/Gemini models (direct API)
  if (model.startsWith('gemini')) {
    return 'gemini';
  }
  
  // All other models use OpenRouter
  return 'openrouter';
}

// Stop endpoint - allows frontend to stop ongoing workflows
app.post('/api/chat/stop', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    console.log(`🛑 Stop request received for session: ${sessionId}`);
    stopRequests.set(sessionId, Date.now());
    
    // Auto-clear after 5 minutes
    setTimeout(() => {
      stopRequests.delete(sessionId);
    }, 300000);
    
    res.json({ success: true, message: 'Stop request registered' });
  } catch (error) {
    console.error('❌ Stop request error:', error);
    res.status(500).json({ error: 'Failed to process stop request' });
  }
});

// Chat endpoint with multi-provider support
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], model: requestedModel, apiKey, userId, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    if (!requestedModel) {
      return res.status(400).json({ error: 'Model selection is required' });
    }

    console.log(`🤖 Using model: ${requestedModel}`);
    console.log(`💬 User message: ${message.substring(0, 100)}...`);
    console.log(`👤 User ID: ${userId}, Session ID: ${sessionId}`);

    // Detect provider
    const provider = getProviderFromModel(requestedModel);
    console.log(`🔀 Routing to provider: ${provider}`);

    // Route to appropriate provider
    if (provider === 'openrouter') {
      return await handleOpenRouterChat(req, res, message, history, requestedModel);
    } else if (provider === 'openai') {
      return await handleOpenAIChat(req, res, message, history, requestedModel, apiKey);
    } else if (provider === 'anthropic') {
      return await handleAnthropicChat(req, res, message, history, requestedModel, apiKey);
    } else {
      return await handleGeminiChat(req, res, message, history, requestedModel);
    }

  } catch (error) {
    console.error('❌ Chat error:', error);
    // Check if headers were already sent (e.g., during streaming)
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to process message',
        details: error.message
      });
    } else {
      // Headers already sent, just log the error
      console.error('   Error occurred after headers were sent - cannot send error response');
    }
  }
});

/**
 * Get user's API key for a specific provider from database
 * @param {string} userId - User ID
 * @param {string} provider - Provider name (openrouter, openai, anthropic, gemini)
 * @returns {Promise<string|null>} API key or null if not found
 */
async function getUserApiKey(userId, provider) {
  if (!userId) {
    console.log(`[getUserApiKey] No userId provided`);
    return null;
  }
  
  try {
    console.log(`[getUserApiKey] Fetching ${provider} key for user ${userId}`);
    const userApiKeysRoutes = require('./user-api-keys-routes')(supabase);
    const apiKey = await userApiKeysRoutes.getUserApiKey(userId, provider);
    console.log(`[getUserApiKey] Result for ${provider}:`, apiKey ? 'Found' : 'Not found');
    return apiKey;
  } catch (error) {
    console.error(`[getUserApiKey] Error fetching ${provider} key for user ${userId}:`, error);
    return null;
  }
}

/**
 * Handle OpenRouter chat requests
 */
async function handleOpenRouterChat(req, res, message, history, model) {
  try {
    // Get user ID from request
    const userId = req.headers['x-user-id'] || req.body.userId;
    
    if (!userId) {
      console.error('❌ User ID not provided');
      res.status(401).json({ 
        error: 'Authentication required',
        details: 'User ID not found in request'
      });
      return;
    }
    
    // First, try to get API key from the model configuration in user_settings
    let apiKey = null;
    
    try {
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('visible_models')
        .eq('user_id', userId)
        .single();
      
      if (!settingsError && settingsData?.visible_models) {
        // Find the model in visible_models array
        const modelConfig = settingsData.visible_models.find(m => 
          typeof m === 'object' && m.id === model
        );
        
        if (modelConfig?.apiKey) {
          apiKey = modelConfig.apiKey;
          console.log(`✓ Using API key from model configuration for ${model}`);
        }
      }
    } catch (error) {
      console.error('Error fetching model configuration:', error);
    }
    
    // If no API key in model config, try user_api_keys table
    if (!apiKey) {
      const userApiKey = await getUserApiKey(userId, 'openrouter');
      apiKey = userApiKey;
    }
    
    const sessionId = req.body.sessionId; // Get session ID from request
    
    if (!apiKey) {
      console.error('❌ OpenRouter API key not configured for user:', userId);
      res.status(400).json({ 
        error: 'OpenRouter API key not configured',
        message: 'Please add your OpenRouter API key in Settings',
        details: 'Get your API key from https://openrouter.ai/keys'
      });
      return;
    }
    
    // Validate API key format
    if (!apiKey.startsWith('sk-or-v1-')) {
      console.error('❌ Invalid OpenRouter API key format');
      res.status(400).json({ 
        error: 'Invalid OpenRouter API key format',
        message: 'Your OpenRouter API key appears to be invalid. Please check and update it in Settings.',
        details: 'Key should start with "sk-or-v1-"'
      });
      return;
    }

    // Helper function to parse tool signature (handles base64 encoded args)
    const parseToolSignature = (sig) => {
      try {
        const [tool, argsBase64] = sig.split(':');
        const argsJson = Buffer.from(argsBase64, 'base64').toString('utf-8');
        const parsedArgs = JSON.parse(argsJson);
        return { tool, args: parsedArgs };
      } catch (e) {
        console.error(`❌ Failed to parse tool call history: "${sig}" ${e.message}`);
        return { tool: 'unknown', args: {} };
      }
    };

    // Extract mode, projectId, and customModeId from request body
    const { mode = 'terminal', projectId, customModeId } = req.body;
    console.log(`🎯 Mode: ${mode}, Project ID: ${projectId}, Custom Mode ID: ${customModeId || 'none'}`);

    // Detect if this is a conversational message (no desktop interaction needed)
    const conversationalPatterns = [
      /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)[\s!.]*$/i,
      /^(how are you|what's up|wassup|sup)[\s!?.]*$/i,
      /^(thanks|thank you|thx|ty)[\s!.]*$/i,
      /^(bye|goodbye|see you|cya)[\s!.]*$/i,
      /^(what can you do|help|what are your capabilities)[\s!?.]*$/i,
      /^(ok|okay|cool|nice|great|awesome|good job)[\s!.]*$/i
    ];
    
    const isConversational = conversationalPatterns.some(pattern => pattern.test(message.trim()));
    
    if (isConversational && (mode === 'desktop' || mode === 'windows')) {
      console.log('💬 Detected conversational message, using simple response mode');
      
      try {
        // Use a simple conversational prompt instead of the complex desktop prompt
        const conversationalPrompt = `You are a friendly, general-purpose AI assistant having a casual conversation.

CRITICAL RULES:
1. DO NOT mention "Windows desktop", "desktop control", "desktop tasks", or any technical capabilities
2. DO NOT offer to help with computer tasks, screenshots, or system operations
3. Respond ONLY as a conversational assistant
4. Keep responses SHORT and NATURAL

For "hello" or similar greetings, respond with ONLY:
- "Hello! How can I help you today?"
- "Hi there! What can I assist you with?"
- "Hey! What's up?"

DO NOT add anything about desktop, Windows, or technical tasks. Just be friendly and conversational.`;
        
        // Build messages for OpenRouter
        const messages = [
          { role: 'system', content: conversationalPrompt },
          ...history.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          { role: 'user', content: message }
        ];

        console.log('📤 Sending conversational request to OpenRouter...');
        
        // Make simple API call WITH streaming
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'AI Desktop Assistant'
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            stream: true  // Enable streaming
          })
        });

        console.log('📥 Received response from OpenRouter:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ OpenRouter API error:', response.status, errorText);
          
          // Handle specific error cases
          if (response.status === 401) {
            const errorMsg = 'OpenRouter API key is invalid or expired. Please update your OPENROUTER_API_KEY environment variable with a valid key from https://openrouter.ai/keys';
            console.error('❌', errorMsg);
            
            // Send error response if headers not sent yet
            if (!res.headersSent) {
              res.status(401).json({ 
                error: 'Invalid API Key',
                message: errorMsg,
                details: errorText
              });
              return;
            }
          } else if (response.status === 402) {
            const errorMsg = 'Insufficient credits. Please add credits to your OpenRouter account at https://openrouter.ai/settings/credits';
            console.error('❌', errorMsg);
            
            // Send error response if headers not sent yet
            if (!res.headersSent) {
              res.status(402).json({ 
                error: 'Insufficient Credits',
                message: errorMsg,
                details: errorText
              });
              return;
            }
          }
          
          throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
        }

        // Set up streaming response
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                res.write(`0:${JSON.stringify({ type: 'finish', finishReason: 'stop' })}\n`);
                if (res.flush) res.flush();
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: content })}\n`);
                  if (res.flush) res.flush();
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }

        res.end();
        console.log('✅ Conversational response streamed successfully');
        return;
      } catch (error) {
        console.error('❌ Error in conversational response:', error);
        // Fall through to normal desktop workflow if conversational fails
      }
    }

    // Get project details to determine OS
    let operatingSystem = 'kali-linux'; // Default
    if (projectId) {
      try {
        const { data: project, error } = await supabase
          .from('projects')
          .select('operating_system')
          .eq('id', projectId)
          .single();
        
        if (!error && project && project.operating_system) {
          operatingSystem = project.operating_system;
          console.log(`📋 Project OS: ${operatingSystem}`);
        }
      } catch (err) {
        console.warn(`⚠️  Could not fetch project OS: ${err.message}`);
      }
    }

    // Get system prompt - start with default mode prompt
    const baseSystemPrompt = modePrompts.getPromptForMode(mode, operatingSystem, model);
    console.log(`📋 Using ${mode} mode prompt for ${operatingSystem}`);
    
    // Check for custom mode to complement the base prompt
    let modeSystemPrompt = baseSystemPrompt;
    if (customModeId) {
      try {
        console.log(`🔍 Looking up custom mode: ${customModeId}`);
        const { data: customMode, error } = await supabase
          .from('custom_modes')
          .select('system_prompt, name')
          .eq('id', customModeId)
          .single();
        
        if (!error && customMode && customMode.system_prompt) {
          // APPEND custom mode prompt AFTER base prompt (base rules take precedence)
          modeSystemPrompt = `${baseSystemPrompt}

--------------------------------------------------------------------------
📌 CUSTOM MODE: ${customMode.name}
------------------------------------------------------------

${customMode.system_prompt}

-------------------------------------------------------
END OF CUSTOM MODE
--------------------------------------------------------------------------`;
          console.log(`✅ Appended custom mode "${customMode.name}" after base prompt (${customMode.system_prompt.length} chars)`);
        } else {
          console.warn(`⚠️  Custom mode not found, using base prompt only: ${error?.message}`);
        }
      } catch (err) {
        console.warn(`⚠️  Error fetching custom mode, using base prompt only: ${err.message}`);
      }
    }

    // Get Windows tools if this is a Windows project
    let tools = null;
    let windowsClient = null;
    
    if (operatingSystem === 'windows-11' || operatingSystem === 'windows-10') {
      console.log('🪟 Windows project detected, loading Windows tools...');
      
      try {
        // Get Windows MCP tools (filtered by mode)
        const { getWindowsMCPToolsForGemini } = require('./windows-mcp-tools');
        const windowsTools = getWindowsMCPToolsForGemini(mode);
        console.log(`🔧 Filtered to ${windowsTools.length} tools for ${mode} mode`);
        
        // Convert to OpenRouter format (similar to Gemini but different structure)
        tools = windowsTools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        }));
        
        console.log(`✅ Loaded ${tools.length} Windows tools for OpenRouter`);
        
        // Initialize Windows client
        const MCPClientPool = require('./mcp-client-pool');
        const mcpClientPool = new MCPClientPool({ projectManager });
        
        // Get API keys for this project from database
        const { data: projectKeys, error: keysError } = await supabase
          .from('projects')
          .select('mcp_api_key, api_service_key')
          .eq('id', projectId)
          .single();
        
        if (keysError || !projectKeys) {
          throw new Error(`Failed to fetch API keys: ${keysError?.message || 'Project not found'}`);
        }
        
        windowsClient = await mcpClientPool.getWindowsClient(
          projectId, 
          projectKeys.api_service_key, 
          projectKeys.mcp_api_key
        );
        
        console.log('✅ Windows client initialized');
      } catch (error) {
        console.error('❌ Failed to load Windows tools:', error.message);
      }
    }

    // Handle session context: summarize previous interaction if history exists
    let processedHistory = [];
    if (history && history.length > 0) {
      console.log(`📚 Session has ${history.length} previous messages`);
      
      // Extract the last complete interaction (last user message + assistant response)
      const lastUserMsgIndex = history.map((msg, idx) => msg.role === 'user' ? idx : -1).filter(idx => idx !== -1).pop();
      
      if (lastUserMsgIndex !== undefined && lastUserMsgIndex >= 0) {
        const lastUserMsg = history[lastUserMsgIndex];
        const lastAssistantMsgs = history.slice(lastUserMsgIndex + 1).filter(msg => msg.role === 'assistant');
        const lastAssistantMsg = lastAssistantMsgs.length > 0 ? lastAssistantMsgs[lastAssistantMsgs.length - 1] : null;
        
        if (lastUserMsg && lastAssistantMsg) {
          // Create a brief summary (max 100 tokens ≈ 400 characters)
          const userRequest = lastUserMsg.content.substring(0, 150);
          const assistantResponse = lastAssistantMsg.content.substring(0, 150);
          
          const summary = `Previous interaction: User requested "${userRequest}${lastUserMsg.content.length > 150 ? '...' : ''}". Task completed: "${assistantResponse}${lastAssistantMsg.content.length > 150 ? '...' : ''}".`;
          
          console.log(`📝 Created summary: ${summary.substring(0, 100)}...`);
          console.log(`📊 Summary length: ~${Math.ceil(summary.length / 4)} tokens (target: 100)`);
          
          // Replace entire history with just the summary
          processedHistory = [{
            role: 'system',
            content: `Context from previous interaction in this session:\n${summary}`
          }];
        } else {
          console.log(`⚠️  Could not extract complete interaction, starting fresh`);
        }
      } else {
        console.log(`⚠️  No user messages in history, starting fresh`);
      }
    } else {
      console.log(`📭 No previous history, starting fresh session`);
    }

    // Check if this is a screenshot-only request
    const isScreenshotOnly = /^(take|get|show|capture)\s+(a\s+)?screenshot$/i.test(message.trim());
    
    // Build messages array with system prompt
    const messages = [
      {
        role: 'system',
        content: modeSystemPrompt
      },
      ...processedHistory,
      {
        role: 'user',
        content: isScreenshotOnly ? `${message}\n\nIMPORTANT: Just take ONE screenshot, describe what you see, then say "Done". Do NOT perform any other actions.` : message
      }
    ];

    if (isScreenshotOnly) {
      console.log(`📸 Detected screenshot-only request, adding explicit instruction to stop after description`);
    }

    console.log(`📤 Sending request to OpenRouter with ${messages.length} messages...`);
    if (tools) {
      console.log(`🔧 Including ${tools.length} tools in request`);
    }
    
    // Debug: Log the system prompt being sent
    console.log(`📋 System prompt length: ${messages[0]?.content?.length || 0} characters`);
    console.log(`📋 System prompt preview: ${messages[0]?.content?.substring(0, 200)}...`);

    // Set up streaming headers immediately
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    console.log('📡 Set streaming headers');
    
    // Register stream with health monitor
    const streamId = `openrouter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    streamHealthMonitor.registerStream(streamId, res, { 
      provider: 'openrouter', 
      model, 
      projectId: req.body.projectId 
    });
    
    // Wrap res.write to track activity
    const originalWrite = res.write.bind(res);
    res.write = function(chunk, ...args) {
      streamHealthMonitor.updateActivity(streamId, chunk.length);
      return originalWrite(chunk, ...args);
    };
    
    // Send connection confirmation
    res.write(`0:${JSON.stringify({ type: 'connection' })}\n`);
    console.log('✅ Sent connection message');
    
    // Small delay to ensure streaming is fully established
    await new Promise(resolve => setTimeout(resolve, 100));

    // Build request body
    const requestBody = {
      model: model,
      messages: messages,
      stream: true,  // Enable streaming
      temperature: 0.7,  // Add temperature for more controlled responses
      max_tokens: 4000   // Ensure enough tokens for text + tool calls
    };
    
    // Add tools if available (for Windows projects)
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      // Don't set tool_choice - let the model follow the system prompt naturally
      // Setting tool_choice: 'auto' might cause the model to prioritize tools over text
      requestBody.parallel_tool_calls = false; // Force sequential tool calls
      console.log(`🔧 Added ${tools.length} tools to request (parallel_tool_calls: false, no tool_choice)`);
    }

    // Create abort controller for cancelling API calls
    const abortController = new AbortController();
    let isUserCancellation = false; // Track if this is a user-initiated cancellation
    
    // Listen for client disconnect to abort API calls immediately
    res.on('close', () => {
      // Only abort if the response is being closed while we're still processing
      // (not during error handling)
      if (!res.writableEnded) {
        console.log('🛑 Client disconnected - aborting API calls');
        isUserCancellation = true;
        abortController.abort();
      }
    });

    // Call OpenRouter API with streaming enabled (with infinite retry for network issues)
    let response;
    let retryCount = 0;
    
    // Infinite retry loop - only stops when AI says "Done" or request succeeds
    let retryRequest = true;
    while (retryRequest) {
      retryRequest = false; // Will be set to true if we need to retry
      
      while (true) {
        try {
          response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'http://localhost:3000',
              'X-Title': 'Kali AI Assistant'
            },
            body: JSON.stringify(requestBody),
            signal: abortController.signal // Use our abort controller
          });
          break; // Success, exit retry loop
        } catch (fetchError) {
          // Check if it's an abort (user cancelled)
          if (fetchError.name === 'AbortError') {
            console.log('🛑 API call aborted by user disconnect');
            throw fetchError; // Throw to exit and save messages
          }
          
          // Check if it's a network error (DNS, timeout, connection)
          const isNetworkError = 
            fetchError.cause?.code === 'EAI_AGAIN' || 
            fetchError.cause?.code === 'ETIMEDOUT' ||
            fetchError.cause?.code === 'ECONNRESET' ||
            fetchError.cause?.code === 'ENOTFOUND' ||
            fetchError.message?.includes('Request timeout');
          
          if (isNetworkError) {
            retryCount++;
            // Exponential backoff with max 30 seconds
            const delay = Math.min(1000 * Math.pow(2, Math.min(retryCount - 1, 5)), 30000);
            console.warn(`⚠️  Network error (${fetchError.cause?.code || fetchError.message}), retrying in ${delay}ms (attempt ${retryCount})...`);
            
            // Send status update to user
            if (retryCount % 3 === 0) { // Every 3rd retry
              const statusMessage = `\n\nNetwork issue - retrying connection (attempt ${retryCount})...\n`;
              res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: statusMessage })}\n`);
              if (res.flush) res.flush();
            }
            
            await new Promise(resolve => setTimeout(resolve, delay));
            continue; // Retry indefinitely
          }
          
          // Not a network error - throw it
          console.error(`❌ Non-network error:`, fetchError.message);
          throw fetchError;
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ OpenRouter API error: ${response.status}`, errorText);
        
        // Handle 413 Payload Too Large - context is too big
        if (response.status === 413) {
          console.log(`\n${'='.repeat(80)}`);
          console.log(`🔄 413 ERROR - REQUEST TOO LARGE`);
          console.log(`   Context size exceeded API limit`);
          console.log(`   Resetting context and retrying with fresh state`);
          console.log(`${'='.repeat(80)}\n`);
          
          // Reset messages to minimal state
          messages.length = 0;
          messages.push({
            role: 'system',
            content: modeSystemPrompt
          });
          messages.push({
            role: 'user',
            content: `${history[0]?.content || message}\n\nContext was reset due to size limit. Take a screenshot and continue.`
          });
          
          // Reset context tracking
          contextTokenCount = estimateTokens(JSON.stringify(messages));
          
          // Notify user
          const resetMessage = `\n\nContext size exceeded limit. Resetting and continuing...\n`;
          res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: resetMessage })}\n`);
          if (res.flush) res.flush();
          
          // Retry with reset context
          retryRequest = true;
          continue;
        }
        
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }
    }

    console.log('✅ OpenRouter streaming connection established');

    // Process the streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalChars = 0;
    let initialText = ''; // Capture the text generated before tool calls
    let toolCalls = []; // Accumulate tool calls from stream
    let usageData = null; // Track usage data from the stream

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log(`✅ Stream completed, total characters: ${totalChars}`);
          break;
        }

        // Decode the chunk
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines (SSE format: "data: {...}\n\n")
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove "data: " prefix
            
            if (data === '[DONE]') {
              console.log('✅ Received [DONE] signal from OpenRouter');
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              
              // Capture usage data if present
              if (parsed.usage) {
                usageData = parsed.usage;
                console.log(`📊 Usage data received:`, usageData);
              }
              
              // Handle text content
              if (delta?.content) {
                totalChars += delta.content.length;
                
                // 🚨 CRITICAL: Filter out malformed <tool_call> tags in real-time
                // Filter both opening tags, closing tags, and any JSON-like content between them
                let contentToStream = delta.content;
                
                // Remove tool_call tags and their content
                // This handles: <tool_call>, </tool_call>, and JSON content like {"name": "...", "arguments":
                contentToStream = contentToStream
                  .replace(/<tool_call>/gi, '')
                  .replace(/<\/tool_call>/gi, '')
                  .replace(/\{\s*"name"\s*:\s*"[^"]*"\s*,\s*"arguments"\s*:\s*[^}]*\}/gi, ''); // Complete JSON
                
                // Also filter incomplete JSON patterns that might appear in chunks
                if (contentToStream.includes('"name"') && contentToStream.includes('"arguments"')) {
                  console.log(`🧹 Filtering tool call JSON from stream chunk`);
                  contentToStream = contentToStream.replace(/\{\s*"name"[^}]*$/gi, ''); // Incomplete at end
                }
                
                // 🚨 CRITICAL: Filter completion messages in real-time
                // Remove: "Done.", "✅ Task complete.", and similar patterns
                contentToStream = contentToStream
                  .replace(/Done\.\s*$/gi, '')
                  .replace(/✅\s*Task\s+complete\.\s*$/gi, '')
                  .replace(/Done\.\s*✅\s*Task\s+complete\.\s*$/gi, '')
                  .replace(/✅\s*Task\s+complete\.\s*Done\.\s*$/gi, '');
                
                // Only add to initialText and stream if there's content left after filtering
                if (contentToStream.trim()) {
                  initialText += contentToStream;
                  console.log(`📝 AI Initial Text: "${contentToStream}"`);
                  
                  // Stream the content immediately
                  res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: contentToStream })}\n`);
                  
                  if (totalChars % 100 === 0) {
                    console.log(`📝 Streamed ${totalChars} characters so far...`);
                  }
                } else {
                  // Still add to initialText for detection purposes, but don't stream
                  initialText += delta.content;
                }
              }
              
              // Handle tool calls (OpenRouter format) - accumulate but don't execute yet
              if (delta?.tool_calls) {
                for (const toolCallDelta of delta.tool_calls) {
                  const index = toolCallDelta.index || 0;
                  
                  // Initialize tool call if needed
                  if (!toolCalls[index]) {
                    toolCalls[index] = {
                      id: toolCallDelta.id || `call_${index}`,
                      type: 'function',
                      function: {
                        name: '',
                        arguments: ''
                      }
                    };
                  }
                  
                  // Accumulate function name
                  if (toolCallDelta.function?.name) {
                    toolCalls[index].function.name += toolCallDelta.function.name;
                  }
                  
                  // Accumulate function arguments
                  if (toolCallDelta.function?.arguments) {
                    toolCalls[index].function.arguments += toolCallDelta.function.arguments;
                  }
                }
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', data, parseError);
            }
          }
        }
      }
    } catch (streamError) {
      console.error('❌ Stream reading error:', streamError);
      throw streamError;
    }

    console.log('✅ Sent all text-delta messages');
    console.log(`📝 Captured initial text: ${initialText.length} chars`);
    
    // 🚨 CRITICAL: Filter out malformed <tool_call> XML tags from AI text
    // Some models (like Claude) generate incomplete tool_call tags like:
    // <tool_call> {"name": "windows_take_screenshot", "arguments": } </tool_call>
    // These should be removed from the visible text
    let cleanedText = initialText;
    let needsCleaning = false;
    
    // Remove complete malformed tool calls
    const malformedToolCallPattern = /<tool_call>\s*\{[^}]*\}\s*<\/tool_call>/gi;
    if (malformedToolCallPattern.test(cleanedText)) {
      console.log(`🧹 Detected complete malformed <tool_call> tags - filtering`);
      cleanedText = cleanedText.replace(malformedToolCallPattern, '');
      needsCleaning = true;
    }
    
    // Remove any remaining tool_call tags
    if (/<tool_call>|<\/tool_call>/gi.test(cleanedText)) {
      console.log(`🧹 Detected remaining <tool_call> tags - filtering`);
      cleanedText = cleanedText.replace(/<tool_call>/gi, '').replace(/<\/tool_call>/gi, '');
      needsCleaning = true;
    }
    
    // Remove JSON-like patterns that look like tool calls
    const jsonPattern = /\{\s*"name"\s*:\s*"[^"]*"\s*,\s*"arguments"\s*:\s*[^}]*\}/gi;
    if (jsonPattern.test(cleanedText)) {
      console.log(`🧹 Detected tool call JSON patterns - filtering`);
      cleanedText = cleanedText.replace(jsonPattern, '');
      needsCleaning = true;
    }
    
    // Remove incomplete JSON at end of text
    const incompleteJsonPattern = /\{\s*"name"[^}]*$/gi;
    if (incompleteJsonPattern.test(cleanedText)) {
      console.log(`🧹 Detected incomplete tool call JSON - filtering`);
      cleanedText = cleanedText.replace(incompleteJsonPattern, '');
      needsCleaning = true;
    }
    
    // 🚨 CRITICAL: Remove completion messages that should be silent
    // Filter out: "Done.", "✅ Task complete.", and similar completion messages
    const completionPatterns = [
      /Done\.\s*$/gi,
      /✅\s*Task\s+complete\.\s*$/gi,
      /Done\.\s*✅\s*Task\s+complete\.\s*$/gi,
      /✅\s*Task\s+complete\.\s*Done\.\s*$/gi
    ];
    
    for (const pattern of completionPatterns) {
      if (pattern.test(cleanedText)) {
        console.log(`🧹 Detected completion message - filtering`);
        cleanedText = cleanedText.replace(pattern, '');
        needsCleaning = true;
      }
    }
    
    if (needsCleaning) {
      cleanedText = cleanedText.trim();
      
      // Send text-replace event to update frontend
      res.write(`0:${JSON.stringify({ 
        type: 'text-replace', 
        text: cleanedText 
      })}\n`);
      if (res.flush) res.flush();
      
      initialText = cleanedText;
      console.log(`✅ Cleaned text: ${initialText.length} chars`);
    }
    
    // 🚨 CRITICAL: ALWAYS check for text-based tool calls, even if structured tool calls exist
    // This is essential for detecting "click at (X, Y)" intent when AI also generates screenshot calls
    if (initialText) {
      const { extractToolCall, normalizeToolName } = require('./text-tool-call-parser');
      const toolCallMatch = extractToolCall(initialText);
      
      if (toolCallMatch) {
        console.log(`🔍 DETECTED TEXT-BASED TOOL CALL IN INITIAL RESPONSE: ${toolCallMatch.functionName}`);
        console.log(`   Args:`, toolCallMatch.args);
        console.log(`   Full match: "${toolCallMatch.fullMatch}"`);
        
        const normalizedName = normalizeToolName(toolCallMatch.functionName);
        
        // Check if this is explicit syntax (should be hidden) or natural language (should be kept)
        const explicitSyntaxPattern = /\[Calls?:\s*([a-zA-Z_][a-zA-Z0-9_]*)\((\{[^}]*\}|[^)]*)\)\]/i;
        const isExplicitSyntax = explicitSyntaxPattern.test(toolCallMatch.fullMatch);
        
        if (isExplicitSyntax) {
          console.log(`📤 Sending text-replace event to hide explicit syntax`);
          const cleanedText = toolCallMatch.textBefore + (toolCallMatch.textAfter ? ' ' + toolCallMatch.textAfter : '');
          res.write(`0:${JSON.stringify({ 
            type: 'text-replace', 
            text: cleanedText 
          })}\n`);
          if (res.flush) res.flush();
          initialText = cleanedText;
        }
        
        // 🚨 CRITICAL: If text-based tool call is a CLICK, prioritize it over screenshot calls
        // This fixes the issue where AI says "click at (676, 114)" but then generates screenshot tool call
        if (normalizedName === 'windows_click_mouse') {
          console.log(`🎯 CLICK INTENT DETECTED - Prioritizing over any screenshot tool calls`);
          
          // Remove any screenshot tool calls from the list
          const screenshotIndex = toolCalls.findIndex(tc => 
            tc.function?.name === 'windows_take_screenshot'
          );
          
          if (screenshotIndex !== -1) {
            console.log(`   ❌ Removing screenshot tool call at index ${screenshotIndex}`);
            toolCalls.splice(screenshotIndex, 1);
          }
          
          // Add click tool call at the beginning
          toolCalls.unshift({
            id: `text_call_initial_${Date.now()}`,
            type: 'function',
            function: {
              name: normalizedName,
              arguments: JSON.stringify(toolCallMatch.args)
            },
            _fromText: true,
            _textBefore: toolCallMatch.textBefore,
            _textAfter: toolCallMatch.textAfter
          });
          
          console.log(`✅ Click tool call added as priority (coordinates: ${JSON.stringify(toolCallMatch.args)})`);
        } else if (toolCalls.length === 0) {
          // Only add non-click tool calls if no structured tool calls exist
          toolCalls.push({
            id: `text_call_initial_${Date.now()}`,
            type: 'function',
            function: {
              name: normalizedName,
              arguments: JSON.stringify(toolCallMatch.args)
            },
            _fromText: true,
            _textBefore: toolCallMatch.textBefore,
            _textAfter: toolCallMatch.textAfter
          });
          
          console.log(`✅ Converted initial text tool call to structured format: ${normalizedName}`);
        }
      }
    }
    
    // Process tool calls - with iteration limit to prevent infinite loops
    let toolCallIteration = 0;
    const MAX_ITERATIONS = 50; // Maximum 50 iterations to prevent infinite loops
    const toolCallHistory = []; // Track tool calls to detect repetition
    const executedToolCallIds = new Set(); // Track which tool call IDs have been executed
    const textHistory = []; // Track text responses to detect infinite loops
    let consecutiveScreenshots = 0; // Track consecutive screenshots without actions
    let consecutiveIdenticalCalls = 0; // Track consecutive identical tool calls
    let lastToolSignature = null; // Track last tool call signature
    let contextTokenCount = 0; // Track approximate token count of conversation
    // No context reset count limit - can reset infinitely
    let shouldResetAfterResponse = false; // Flag to reset after current AI response completes
    let hasResetContext = false; // Track if we've already reset in this iteration
    let shouldForceContinuationAfterScreenshot = false; // Flag to force continuation after verification screenshot
    let previousScreenshotData = null; // Track previous screenshot data for comparison
    
    // Function to estimate token count (rough approximation: 1 token ≈ 4 characters)
    function estimateTokens(text) {
      if (!text) return 0;
      return Math.ceil(text.length / 4);
    }
    
    // Function to get model's context window size
    function getModelContextWindow(modelName) {
      const modelLower = modelName.toLowerCase();
      
      // Common model context windows
      const contextWindows = {
        // OpenRouter models
        'gpt-4': 8192,
        'gpt-4-turbo': 128000,
        'gpt-4o': 128000,
        'gpt-3.5-turbo': 16385,
        'claude-3-opus': 200000,
        'claude-3-sonnet': 200000,
        'claude-3-haiku': 200000,
        'claude-3.5-sonnet': 200000,
        'gemini-1.5-pro': 1000000,
        'gemini-1.5-flash': 1000000,
        'gemini-2.0-flash': 1000000,
        'llama-3.1-8b': 128000,
        'llama-3.1-70b': 128000,
        'llama-3.1-405b': 128000,
        'mistral-7b': 32768,
        'mistral-large': 128000,
        'qwen-2.5': 32768,
        'deepseek': 64000,
        'trinity': 32768, // arcee-ai/trinity models - increased from 8K to 32K
        'phi-3': 128000,
        'command-r': 128000,
        'mixtral': 32768
      };
      
      // Try to find matching context window
      for (const [key, contextSize] of Object.entries(contextWindows)) {
        if (modelLower.includes(key)) {
          return contextSize;
        }
      }
      
      // Default to conservative 8K if unknown
      console.warn(`⚠️  Unknown model context window for "${modelName}", defaulting to 8192 tokens`);
      return 8192;
    }
    
    // Get model's context window and set safe limit (use 80% to allow longer conversations)
    const modelContextWindow = getModelContextWindow(model);
    const maxContextTokens = Math.floor(modelContextWindow * 0.8); // Use 80% to allow longer context
    const maxResets = 10; // Allow up to 10 resets per request if needed
    
    console.log(`📊 Model: ${model}`);
    console.log(`📊 Context window: ${modelContextWindow} tokens`);
    console.log(`📊 Safe limit: ${maxContextTokens} tokens (80% of max)`);
    console.log(`📊 Max resets allowed: ${maxResets}`);
    
    // Calculate initial context size
    contextTokenCount = messages.reduce((total, msg) => {
      return total + estimateTokens(msg.content);
    }, 0);
    
    console.log(`📊 Initial context size: ~${contextTokenCount} tokens`);
    
    // Track if AI has explicitly said "Done"
    let aiSaidDone = false;
    
    // Main loop - continue until AI says "Done" OR we hit iteration limit
    while (!aiSaidDone && toolCallIteration < MAX_ITERATIONS) {
      // Check if stop was requested
      if (sessionId && stopRequests.has(sessionId)) {
        console.log(`\n🛑 Stop requested for session ${sessionId} - stopping workflow`);
        stopRequests.delete(sessionId); // Clear the stop request
        
        // Send stop message to frontend
        res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: '\n\nWorkflow stopped by user.\n' })}\n`);
        res.write(`0:${JSON.stringify({ type: 'done' })}\n`);
        if (res.flush) res.flush();
        break;
      }
      
      // Check if client disconnected (stream closed)
      if (res.writableEnded || res.destroyed) {
        console.log(`\n🛑 Client disconnected - stopping workflow`);
        console.log(`   writableEnded: ${res.writableEnded}, destroyed: ${res.destroyed}`);
        break;
      }
      
      toolCallIteration++;
      
      // 🚨 CRITICAL: Check iteration limit to prevent infinite loops
      if (toolCallIteration > MAX_ITERATIONS) {
        console.log(`\n🚨 ITERATION LIMIT REACHED: ${toolCallIteration} iterations (max: ${MAX_ITERATIONS})`);
        console.log(`   Stopping workflow to prevent infinite loop`);
        
        // Send warning message to frontend
        const warningMsg = `\n\nMaximum iteration limit reached (${MAX_ITERATIONS} iterations). Stopping to prevent infinite loop.\n`;
        res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: warningMsg })}\n`);
        res.write(`0:${JSON.stringify({ type: 'done' })}\n`);
        if (res.flush) res.flush();
        break;
      }
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔧 Tool Call Iteration ${toolCallIteration}/${MAX_ITERATIONS}: Processing ${toolCalls.length} tool call(s)`);
      if (toolCalls.length > 0) {
        console.log(`🔧 Tool calls:`, toolCalls.map(tc => `${tc.function.name} (id: ${tc.id})`));
      } else {
        console.log(`🔧 No tool calls in queue - will request continuation`);
      }
      console.log(`📊 Current context size: ~${contextTokenCount} tokens (max: ${maxContextTokens})`);
      console.log(`${'='.repeat(80)}\n`);
      
      // If no tool calls in queue, request a continuation from AI
      if (toolCalls.length === 0) {
        console.log(`\n📤 No tool calls in queue - requesting AI continuation...`);
        
        // Build continuation request
        const continuationMessages = [...messages];
        continuationMessages.push({
          role: 'user',
          content: `Continue with the next step. If the task is complete, say "Done".`
        });
        
        // Request continuation
        let contText = '';
        let contChars = 0;
        const newToolCalls = [];
        
        try {
          const contResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://ai-backend.local',
              'X-Title': 'AI Backend'
            },
            body: JSON.stringify({
              model: model,
              messages: continuationMessages,
              tools: tools,
              tool_choice: 'auto',
              stream: true,
              temperature: 0.7,
              max_tokens: 4000
            })
          });
          
          if (!contResponse.ok) {
            throw new Error(`Continuation request failed: ${contResponse.status}`);
          }
          
          const contReader = contResponse.body.getReader();
          const contDecoder = new TextDecoder();
          
          while (true) {
            const { done, value } = await contReader.read();
            if (done) break;
            
            const chunk = contDecoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));
            
            for (const line of lines) {
              const data = line.replace(/^data: /, '').trim();
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                
                if (delta?.content) {
                  // 🚨 CRITICAL: Filter out malformed <tool_call> tags in real-time
                  let contentToStream = delta.content;
                  
                  // Remove tool_call tags and their content
                  contentToStream = contentToStream
                    .replace(/<tool_call>/gi, '')
                    .replace(/<\/tool_call>/gi, '')
                    .replace(/\{\s*"name"\s*:\s*"[^"]*"\s*,\s*"arguments"\s*:\s*[^}]*\}/gi, '');
                  
                  // Filter incomplete JSON patterns
                  if (contentToStream.includes('"name"') && contentToStream.includes('"arguments"')) {
                    console.log(`🧹 Filtering tool call JSON from continuation stream chunk`);
                    contentToStream = contentToStream.replace(/\{\s*"name"[^}]*$/gi, '');
                  }
                  
                  // Add to contText for detection
                  contText += delta.content;
                  contChars += delta.content.length;
                  
                  // Only stream if there's content left after filtering
                  if (contentToStream.trim()) {
                    res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: contentToStream })}\n`);
                    if (res.flush) res.flush();
                  }
                }
                
                if (delta?.tool_calls) {
                  for (const toolCallDelta of delta.tool_calls) {
                    const index = toolCallDelta.index;
                    
                    if (!newToolCalls[index]) {
                      newToolCalls[index] = {
                        id: toolCallDelta.id || `call_${Date.now()}_${index}`,
                        type: 'function',
                        function: {
                          name: '',
                          arguments: ''
                        }
                      };
                    }
                    
                    if (toolCallDelta.function?.name) {
                      newToolCalls[index].function.name += toolCallDelta.function.name;
                    }
                    
                    if (toolCallDelta.function?.arguments) {
                      newToolCalls[index].function.arguments += toolCallDelta.function.arguments;
                    }
                  }
                }
              } catch (e) {
                console.error('Failed to parse continuation:', e);
              }
            }
          }
          
          console.log(`✅ Continuation complete: ${contChars} chars generated`);
          
          // Check for "Done" in continuation text
          const donePattern = /\b(done|finished|complete|completed|task\s+complete|workflow\s+complete)\b/i;
          if (contText && donePattern.test(contText)) {
            console.log(`\n✅ AI SAID DONE: "${contText.match(donePattern)[0]}"`);
            console.log(`   Task is complete - exiting workflow loop`);
            aiSaidDone = true;
            
            // Task complete - don't send completion message to user (silent)
            console.log('✅ Task complete (silent)');
            
            // Exit the loop
            break;
          }
          
          // Check for text-based tool calls in continuation
          if (contText) {
            const { extractToolCall, normalizeToolName } = require('./text-tool-call-parser');
            const toolCallMatch = extractToolCall(contText);
            
            if (toolCallMatch) {
              console.log(`🔍 DETECTED TEXT-BASED TOOL CALL: ${toolCallMatch.functionName}`);
              const normalizedName = normalizeToolName(toolCallMatch.functionName);
              
              newToolCalls.push({
                id: `text_call_empty_${toolCallIteration}_${Date.now()}`,
                type: 'function',
                function: {
                  name: normalizedName,
                  arguments: JSON.stringify(toolCallMatch.args)
                },
                _fromText: true
              });
            }
          }
          
          // Add new tool calls to queue
          if (newToolCalls.length > 0) {
            toolCalls.push(...newToolCalls);
            console.log(`📊 Added ${newToolCalls.length} tool call(s) to queue`);
          }
          
          // Add continuation to messages
          if (contText || newToolCalls.length > 0) {
            messages.push({
              role: 'assistant',
              content: contText || null,
              tool_calls: newToolCalls.length > 0 ? newToolCalls : undefined
            });
          }
          
        } catch (error) {
          console.error(`❌ Continuation request failed:`, error);
          
          // If continuation fails, exit gracefully
          const errorMsg = `\n\nFailed to continue workflow. Stopping.\n`;
          res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: errorMsg })}\n`);
          if (res.flush) res.flush();
          break;
        }
        
        // If still no tool calls after continuation, exit
        if (toolCalls.length === 0 && !aiSaidDone) {
          console.log(`\n⚠️  Still no tool calls after continuation - exiting`);
          // Don't show warning to user - this is normal for conversational messages
          break;
        }
        
        // Continue to next iteration
        continue;
      }
      
      // Periodic context check every 10 iterations
      if (toolCallIteration % 10 === 0 && toolCallIteration > 0) {
        const percentUsed = Math.round((contextTokenCount / maxContextTokens) * 100);
        console.log(`\n📊 PERIODIC CONTEXT CHECK (Iteration ${toolCallIteration})`);
        console.log(`   Context usage: ${percentUsed}% (${contextTokenCount}/${maxContextTokens} tokens)`);
        if (percentUsed > 80) {
          console.log(`   ⚠️  WARNING: Context is ${percentUsed}% full - reset may trigger soon`);
        }
        console.log(``);
      }
      
      // PROACTIVE CONTEXT TRIMMING - Keep only recent messages to prevent explosion
      // Trim when context reaches 70% of max to prevent hitting the critical limit
      const trimLimit = Math.floor(maxContextTokens * 0.7);
      if (contextTokenCount > trimLimit && messages.length > 3) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`✂️  PROACTIVE CONTEXT TRIMMING - Preventing context explosion`);
        console.log(`   Current: ~${contextTokenCount} tokens`);
        console.log(`   Trim limit: ${trimLimit} tokens (70% of ${maxContextTokens})`);
        console.log(`   Current messages: ${messages.length}`);
        console.log(`${'='.repeat(80)}\n`);
        
        // Keep: system prompt (index 0) + original user request (index 1) + last 4 messages
        const systemPrompt = messages[0];
        const userRequest = messages[1];
        const recentMessages = messages.slice(-4); // Last 4 messages (usually 2 tool call cycles)
        
        messages.length = 0;
        messages.push(systemPrompt);
        messages.push(userRequest);
        messages.push(...recentMessages);
        
        // Recalculate context size
        contextTokenCount = messages.reduce((total, msg) => {
          return total + estimateTokens(msg.content || '');
        }, 0);
        
        console.log(`✅ Context trimmed`);
        console.log(`   New message count: ${messages.length}`);
        console.log(`   New context size: ~${contextTokenCount} tokens`);
        console.log(`   Saved: ~${trimLimit - contextTokenCount} tokens\n`);
      }
      
      // DISABLED: Automatic context reset based on token count
      // Context should only reset when AI says "Stopped to prevent repeating"
      // or when it's absolutely necessary (context truly full)
      
      // Only reset if context is CRITICALLY full (>95% of max)
      const criticalLimit = Math.floor(modelContextWindow * 0.95);
      if (contextTokenCount > criticalLimit) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔄 CRITICAL CONTEXT RESET - CONTEXT CRITICALLY FULL`);
        console.log(`   Current: ~${contextTokenCount} tokens`);
        console.log(`   Critical limit: ${criticalLimit} tokens (95% of ${modelContextWindow})`);
        console.log(`   Resetting to prevent context overflow`);
        console.log(`${'='.repeat(80)}\n`);
        
        // Create a very brief summary of what's been accomplished
        const recentActions = toolCallHistory.slice(-5).map(sig => {
          const { tool, args } = parseToolSignature(sig);
          if (tool === 'windows_click_mouse') {
            return `clicked (${args.x}, ${args.y})`;
          } else if (tool === 'windows_type_text') {
            return `typed "${args.text}"`;
          } else if (tool === 'windows_press_key') {
            return `pressed ${args.key}`;
          }
          return tool.replace('windows_', '');
        }).join(' → ');
        
        // Determine what step we're on based on actions taken
        let currentStep = '';
        const hasTypedYoutube = toolCallHistory.some(sig => sig.includes('youtube'));
        const hasTypedMrBeast = toolCallHistory.some(sig => sig.includes('mr beast') || sig.includes('mrbeast'));
        const hasPressedEnter = toolCallHistory.some(sig => sig.includes('press_key') && sig.includes('enter'));
        
        if (!hasTypedYoutube) {
          currentStep = 'NEXT STEP: Navigate to YouTube (click address bar, type youtube.com, press enter)';
        } else if (!hasPressedEnter) {
          currentStep = 'NEXT STEP: Press Enter to navigate';
        } else if (!hasTypedMrBeast) {
          currentStep = 'NEXT STEP: Search for "mr beast" on YouTube';
        } else {
          currentStep = 'NEXT STEP: Complete the search';
        }
        
        const summary = `Actions so far: ${recentActions || 'none'}. ${currentStep}`;
        
        console.log(`📝 Context summary: ${summary}`);
        console.log(`📊 Summary size: ~${estimateTokens(summary)} tokens`);
        
        // Reset messages to: system prompt + user request + summary
        // NOTE: We DON'T include the last screenshot data because it's too large (~3000 tokens)
        // and would cause immediate reset loop. Instead, AI will take a fresh screenshot.
        const originalRequest = history[0]?.content || message;
        messages.length = 0; // Clear array
        
        // 1. System prompt
        messages.push({
          role: 'system',
          content: modeSystemPrompt
        });
        
        // 2. Original user request with summary
        messages.push({
          role: 'user',
          content: `${originalRequest}

CONTEXT: ${summary}

🚨 CRITICAL INSTRUCTIONS AFTER CONTEXT RESET:

1. Take a screenshot to see current state
2. The screenshot will include coordinates for ALL elements
3. When you want to click something, you MUST use coordinates from the screenshot data
4. Format: windows_click_mouse(x=123, y=456) or "clicking at (123, 456)"
5. NEVER say "click at [element name]" without coordinates
6. ALWAYS extract coordinates from the KEY ELEMENTS or TEXT sections

Example CORRECT responses:
- "I'll click the YouTube search bar at (651, 155)"
- windows_click_mouse(x=651, y=155)
- "clicking at (651, 155)"

Example WRONG responses:
- "click at YouTube search bar" ❌ (no coordinates!)
- "I'll click the search bar" ❌ (no coordinates!)

CRITICAL: Analyze current state and execute the NEXT step with COORDINATES. DO NOT repeat previous actions.`
        });
        
        // Recalculate context size after reset
        contextTokenCount = messages.reduce((total, msg) => {
          return total + estimateTokens(msg.content || '');
        }, 0);
        
        console.log(`📊 Context size after reset: ~${contextTokenCount} tokens`);
        
        // Check if there are pending action tool calls that should be preserved
        const hasActionToolCalls = toolCalls.some(tc => {
          const toolName = tc.function.name.replace('windows_', '');
          return ['click_mouse', 'type_text', 'press_key'].includes(toolName);
        });
        
        if (hasActionToolCalls) {
          console.log(`✅ Preserving ${toolCalls.length} pending action tool call(s) after context reset`);
          console.log(`   Tool calls:`, toolCalls.map(tc => tc.function.name));
          // Don't clear tool calls - let them execute after reset
        } else {
          console.log(`ℹ️  No pending action tool calls, AI will take fresh screenshot`);
          // Force a fresh screenshot to see current state
          toolCalls.length = 0;
          toolCalls.push({
            id: `reset_screenshot_${Date.now()}`,
            type: 'function',
            function: {
              name: 'windows_take_screenshot',
              arguments: '{}'
            }
          });
        }
        
        // Send a message to user
        const resetMessage = `\n\n┃ Context reset. Taking fresh screenshot.\n`;
        res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: resetMessage })}\n`);
        if (res.flush) res.flush();
        
        console.log(`✅ Context reset complete, will take fresh screenshot`);
      }
      
      // Check if text was generated before first tool call
      if (toolCallIteration === 1 && (!initialText || initialText.trim().length === 0)) {
        console.log(`⚠️ WARNING: AI called tool without generating explanatory text first (initial call)`);
        console.log(`   Tool: ${toolCalls[0].function.name}`);
        console.log(`   Model: ${model}`);
        
        // Generate helpful text for initial call only
        const toolName = toolCalls[0].function.name.replace('windows_', '').replace(/_/g, ' ');
        const helpfulText = `Let me start by ${toolName === 'take screenshot' ? 'taking a screenshot to see the current state' : `using ${toolName}`}.`;
        console.log(`📝 Generating helpful initial text: "${helpfulText}"`);
        res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: helpfulText + '\n' })}\n`);
        if (res.flush) res.flush();
      }
      
      // CRITICAL: Check for text repetition BEFORE executing tool calls
      // This catches cases where AI generates same text then makes a tool call
      const currentTextNormalized = (initialText || '').trim().toLowerCase().replace(/\s+/g, ' ');
      
      if (currentTextNormalized.length > 30) { // Only check substantial responses
        const recentTexts = textHistory.slice(-3); // Check last 3 responses
        let textRepetitionCount = 0;
        
        for (const prevText of recentTexts) {
          const prevNormalized = prevText.trim().toLowerCase().replace(/\s+/g, ' ');
          
          // Calculate similarity (check if 80% of words match)
          const currentWords = currentTextNormalized.split(' ');
          const prevWords = prevNormalized.split(' ');
          
          if (currentWords.length > 5 && prevWords.length > 5) {
            const matchingWords = currentWords.filter(word => prevWords.includes(word)).length;
            const similarity = matchingWords / Math.max(currentWords.length, prevWords.length);
            
            if (similarity > 0.8) {
              textRepetitionCount++;
            }
          }
        }
        
        // If we've seen this response 2+ times, it's a repetition loop
        if (textRepetitionCount >= 2) {
          console.log(`⚠️ TEXT REPETITION BEFORE TOOL CALL: AI generated similar response ${textRepetitionCount + 1} times`);
          console.log(`   Current: "${initialText.substring(0, 100)}..."`);
          console.log(`   This indicates the AI is stuck. Resetting context and forcing different approach.`);
          
          // Reset context with strong instruction
          const recentActions = toolCallHistory.slice(-5).map(sig => {
            const { tool, args } = parseToolSignature(sig);
            if (tool === 'windows_click_mouse') {
              return `clicked (${args.x}, ${args.y})`;
            } else if (tool === 'windows_type_text') {
              return `typed "${args.text}"`;
            } else if (tool === 'windows_press_key') {
              return `pressed ${args.key}`;
            }
            return tool.replace('windows_', '');
          }).join(', ');
          
          const summary = `Previous actions: ${recentActions}. You are REPEATING the same description. DO NOT describe again - execute a DIFFERENT action.`;
          
          // Reset messages
          messages.length = 0;
          messages.push({
            role: 'system',
            content: modeSystemPrompt
          });
          messages.push({
            role: 'user',
            content: `${history[0]?.content || message}\n\nContext: ${summary}\n\nCRITICAL: Take a screenshot and execute a DIFFERENT action. DO NOT repeat previous descriptions.`
          });
          
          // Force a screenshot
          toolCalls.length = 0;
          toolCalls.push({
            id: `reset_screenshot_${Date.now()}`,
            type: 'function',
            function: {
              name: 'windows_take_screenshot',
              arguments: '{}'
            }
          });
          
          const resetMessage = `\n\n┃ Detected text repetition. Resetting context and trying different approach.\n`;
          res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: resetMessage })}\n`);
          if (res.flush) res.flush();
          
          console.log(`✅ Context reset due to text repetition, taking fresh screenshot`);
        }
      }
      
      // Check for excessive repetition - but allow multi-step sequences
      const currentTool = toolCalls[0];
      
      // SPECIAL CASE: If AI is trying to call press_key after type_text, but we already auto-injected it
      // Check if the last two tools in history are type_text followed by press_key(enter)
      if (currentTool.function.name === 'windows_press_key' && toolCallHistory.length >= 2) {
        const lastTool = toolCallHistory[toolCallHistory.length - 1];
        const secondLastTool = toolCallHistory[toolCallHistory.length - 2];
        
        // Check if pattern is: type_text → press_key(enter) → AI wants to call press_key again
        if (lastTool.startsWith('windows_press_key') && secondLastTool.startsWith('windows_type_text')) {
          console.log(`\n${'='.repeat(80)}`);
          console.log(`⚠️  AI TRYING TO PRESS ENTER AFTER AUTO-INJECTED ENTER`);
          console.log(`   Last action: type_text (with auto-injected Enter)`);
          console.log(`   AI wants to: press_key again (redundant!)`);
          console.log(`   Skipping this tool call and taking screenshot instead`);
          console.log(`${'='.repeat(80)}\n`);
          
          // Skip the redundant press_key and force a screenshot instead
          toolCalls.length = 0;
          toolCalls.push({
            id: `skip_redundant_enter_${Date.now()}`,
            type: 'function',
            function: {
              name: 'windows_take_screenshot',
              arguments: '{}'
            }
          });
          
          // NO message to user - keep it silent
          // The screenshot will happen automatically
          
          console.log(`✅ Skipped redundant press_key, taking screenshot instead`);
          continue; // Skip to screenshot
        }
      }
      
      // Normalize arguments to ensure consistent comparison (sort keys alphabetically)
      let normalizedArgs = '{}';
      try {
        if (currentTool.function.arguments) {
          const argsObj = typeof currentTool.function.arguments === 'string' 
            ? JSON.parse(currentTool.function.arguments)
            : currentTool.function.arguments;
          normalizedArgs = JSON.stringify(Object.keys(argsObj).sort().reduce((acc, key) => {
            acc[key] = argsObj[key];
            return acc;
          }, {}));
        }
      } catch (e) {
        console.error(`Failed to normalize arguments:`, e);
        // CRITICAL: Always use valid JSON, never use the raw malformed string
        normalizedArgs = '{}';
      }
      
      // CRITICAL: Escape the JSON string to avoid parsing errors later
      // Use base64 encoding to avoid quote escaping issues
      const toolSignature = `${currentTool.function.name}:${Buffer.from(normalizedArgs).toString('base64')}`;
      
      // Allow take_screenshot to be called multiple times for verification
      const isScreenshotTool = currentTool.function.name === 'windows_take_screenshot';
      
      // Get the last non-screenshot tool that was called
      const lastNonScreenshotTool = toolCallHistory.length > 0 ? toolCallHistory[toolCallHistory.length - 1] : null;
      const lastToolName = lastNonScreenshotTool ? lastNonScreenshotTool.split(':')[0] : null;
      const currentToolName = currentTool.function.name;
      
      // Validate tool name - must be a valid function name format
      const validToolNamePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      if (!validToolNamePattern.test(currentToolName)) {
        console.log(`⚠️ Invalid tool name detected: "${currentToolName}" - skipping`);
        continue; // Skip this invalid tool call
      }
      
      // Define valid multi-step sequences (these are OK, not repetition)
      const validSequences = {
        'windows_click_mouse': ['windows_type_text', 'windows_press_key', 'windows_scroll_mouse'],
        'windows_type_text': ['windows_press_key', 'windows_click_mouse'], // type_text → press_key is valid (auto-injected Enter)
        'windows_press_key': ['windows_type_text', 'windows_click_mouse', 'windows_take_screenshot'], // press_key → screenshot is valid
        'windows_move_mouse': ['windows_click_mouse', 'windows_scroll_mouse']
      };
      
      // Check if this is a valid progression in a multi-step sequence
      const isValidProgression = lastToolName && validSequences[lastToolName]?.includes(currentToolName);
      
      // Count how many times this exact tool call has been made
      const repetitionCount = toolCallHistory.filter(sig => sig === toolSignature).length;
      
      // Detect workflow loops (e.g., screenshot → click → screenshot → click)
      // Check if the last 4 actions show a repeating pattern
      if (toolCallHistory.length >= 4 && !isScreenshotTool) {
        const recentHistory = toolCallHistory.slice(-4);
        const pattern1 = recentHistory.slice(0, 2).join('|');
        const pattern2 = recentHistory.slice(2, 4).join('|');
        
        if (pattern1 === pattern2) {
          console.log(`⚠️ WORKFLOW LOOP DETECTED: Repeating pattern ${pattern1}`);
          console.log(`   Recent history: ${recentHistory.join(' → ')}`);
          console.log(`   Triggering context reset to break the loop`);
          
          // Reset context instead of stopping
          const recentActions = toolCallHistory.slice(-5).map(sig => {
            const { tool, args } = parseToolSignature(sig);
            if (tool === 'windows_click_mouse') {
              return `clicked (${args.x}, ${args.y})`;
            } else if (tool === 'windows_type_text') {
              return `typed "${args.text}"`;
            } else if (tool === 'windows_press_key') {
              return `pressed ${args.key}`;
            }
            return tool.replace('windows_', '');
          }).join(', ');
          
          const summary = `Previous actions: ${recentActions}. You were repeating a pattern. Continue with a DIFFERENT action.`;
          
          console.log(`📝 Context summary: ${summary}`);
          
          // Reset messages
          messages.length = 0;
          messages.push({
            role: 'system',
            content: modeSystemPrompt
          });
          messages.push({
            role: 'user',
            content: `${history[0]?.content || message}\n\nContext: ${summary}\n\nTake a screenshot and try a DIFFERENT approach.`
          });
          
          // Force a screenshot
          toolCalls.length = 0;
          toolCalls.push({
            id: `reset_screenshot_${Date.now()}`,
            type: 'function',
            function: {
              name: 'windows_take_screenshot',
              arguments: '{}'
            }
          });
          
          const resetMessage = `\n\n┃ Detected workflow loop. Resetting context and trying different approach.\n`;
          res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: resetMessage })}\n`);
          if (res.flush) res.flush();
          
          console.log(`✅ Context reset due to workflow loop, taking fresh screenshot`);
          
          // Don't break - continue with the screenshot
        }
      }
      
      // Only block if:
      // 1. It's not a screenshot tool
      // 2. It's been called before (repetitionCount >= 1)
      // 3. It's NOT a valid progression in a multi-step sequence
      if (repetitionCount >= 1 && !isScreenshotTool && !isValidProgression) {
        console.log(`⚠️ REPETITION DETECTED: AI is calling the same tool ${repetitionCount + 1} times`);
        console.log(`   Tool: ${currentTool.function.name}`);
        console.log(`   Arguments: ${JSON.stringify(currentTool.function.arguments)}`);
        console.log(`   Last tool: ${lastToolName}`);
        console.log(`   Triggering context reset to continue fresh`);
        
        // Instead of stopping, reset context and continue
        const recentActions = toolCallHistory.slice(-5).map(sig => {
          const { tool, args } = parseToolSignature(sig);
          if (tool === 'windows_click_mouse') {
            return `clicked (${args.x}, ${args.y})`;
          } else if (tool === 'windows_type_text') {
            return `typed "${args.text}"`;
          } else if (tool === 'windows_press_key') {
            return `pressed ${args.key}`;
          }
          return tool.replace('windows_', '');
        }).join(', ');
        
        const summary = `Previous actions: ${recentActions}. You tried to repeat an action. Continue with the NEXT step instead.`;
        
        console.log(`📝 Context summary: ${summary}`);
        
        // Reset messages to just system prompt + brief summary + current user request
        messages.length = 0; // Clear array
        messages.push({
          role: 'system',
          content: modeSystemPrompt
        });
        messages.push({
          role: 'user',
          content: `${history[0]?.content || message}\n\nContext: ${summary}\n\nTake a screenshot and continue with the NEXT step (not the repeated action).`
        });
        
        // Force a screenshot to get fresh context
        toolCalls.length = 0; // Clear current tool calls
        toolCalls.push({
          id: `reset_screenshot_${Date.now()}`,
          type: 'function',
          function: {
            name: 'windows_take_screenshot',
            arguments: '{}'
          }
        });
        
        // Send a message to user
        const resetMessage = `\n\n┃ Detected repetition. Resetting context and continuing with next step.\n`;
        res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: resetMessage })}\n`);
        if (res.flush) res.flush();
        
        console.log(`✅ Context reset due to repetition, taking fresh screenshot`);
        
        // Don't break - continue with the screenshot
      }
      
      // Log valid progressions for debugging
      if (isValidProgression) {
        console.log(`✅ Valid multi-step progression: ${lastToolName} → ${currentToolName}`);
      }
      
      // Add to history (but don't track screenshots for repetition detection)
      if (!isScreenshotTool) {
        toolCallHistory.push(toolSignature);
      }
      
      // 🚨 CRITICAL: Detect consecutive identical tool calls (infinite loop detection)
      if (lastToolSignature === toolSignature) {
        consecutiveIdenticalCalls++;
        console.log(`⚠️  Consecutive identical call #${consecutiveIdenticalCalls}: ${currentToolName}`);
        
        // Stop after 5 consecutive identical calls
        if (consecutiveIdenticalCalls >= 5) {
          console.log(`\nINFINITE LOOP DETECTED: ${currentToolName} called ${consecutiveIdenticalCalls} times in a row!`);
          console.log(`   Stopping workflow to prevent infinite loop`);
          
          // Send warning message to frontend
          const loopWarning = `\n\nInfinite loop detected: ${currentToolName} called ${consecutiveIdenticalCalls} times consecutively. Stopping workflow.\n`;
          res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: loopWarning })}\n`);
          res.write(`0:${JSON.stringify({ type: 'done' })}\n`);
          if (res.flush) res.flush();
          
          // Break out of the while loop
          toolCalls = [];
          break;
        }
      } else {
        // Different tool call - reset counter
        consecutiveIdenticalCalls = 1;
        lastToolSignature = toolSignature;
      }
      
      // Small delay to ensure any text is rendered before tool execution
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Process ONLY the FIRST tool call
      const toolCall = toolCalls[0];
      
      // 🚨 CRITICAL: Check if this tool call ID has already been executed
      if (executedToolCallIds.has(toolCall.id)) {
        console.log(`\n🚨 SKIPPING DUPLICATE TOOL CALL ID: ${toolCall.id}`);
        console.log(`   Tool: ${toolCall.function.name}`);
        console.log(`   This tool call has already been executed - removing from queue`);
        
        // Remove this tool call from the array and continue to the next one
        toolCalls.shift();
        continue;
      }
      
      // Mark this tool call ID as executed
      executedToolCallIds.add(toolCall.id);
      console.log(`✅ Marked tool call ID as executed: ${toolCall.id}`);
      
      try {
        const functionName = toolCall.function.name;
        
        // Handle empty or missing arguments
        let functionArgs = {};
        if (toolCall.function.arguments && toolCall.function.arguments.trim()) {
          try {
            functionArgs = JSON.parse(toolCall.function.arguments);
          } catch (parseError) {
            console.warn(`⚠️  Failed to parse tool arguments, using empty object:`, parseError.message);
            console.warn(`   Arguments string:`, toolCall.function.arguments);
          }
        } else {
          console.log(`ℹ️  Tool has no arguments (empty or undefined)`);
        }
        
        console.log(`🔧 Executing tool: ${functionName}`, functionArgs);
        
        // VALIDATION 1: Check for browser bar shortcut (typing search query in browser address bar)
        // Instead of blocking, we'll let it execute but inject a correction message
        let shouldCorrectWorkflow = false;
        let correctionMessage = '';
        
        if (functionName === 'windows_type_text' && functionArgs.text) {
          // Check if last action was clicking in browser bar (y < 100)
          const lastToolCall = toolCallHistory[toolCallHistory.length - 1];
          if (lastToolCall) {
            const [lastTool, lastArgsStr] = lastToolCall.split(':');
            if (lastTool === 'windows_click_mouse') {
              try {
                const lastArgs = JSON.parse(lastArgsStr);
                const lastY = lastArgs.y;
                
                // If last click was in browser bar zone (y < 100) and text is not a URL
                if (lastY < 100) {
                  const text = functionArgs.text.toLowerCase();
                  const isURL = text.includes('.com') || text.includes('.org') || text.includes('.net') || 
                                text.includes('http') || text.startsWith('www.');
                  
                  if (!isURL) {
                    console.log(`\n${'='.repeat(80)}`);
                    console.log(`⚠️  DETECTED: Browser bar shortcut!`);
                    console.log(`   Last click: y=${lastY} (browser bar zone)`);
                    console.log(`   Typing: "${functionArgs.text}"`);
                    console.log(`   This is a SEARCH QUERY, not a URL!`);
                    console.log(`   Will execute but inject correction message`);
                    console.log(`${'='.repeat(80)}\n`);
                    
                    shouldCorrectWorkflow = true;
                    correctionMessage = `\n\n⚠️  WORKFLOW CORRECTION NEEDED:\n\nYou just typed "${functionArgs.text}" in the browser address bar (y=${lastY}). This will work but is NOT the correct workflow.\n\nCORRECT workflow for "search for X on YouTube":\n1. Click browser bar (y < 100)\n2. Type "youtube.com" (the website URL, NOT the search query)\n3. Press Enter\n4. Wait for YouTube to load (take screenshot)\n5. Click YouTube's search bar (y > 100)\n6. Type "${functionArgs.text}" (the search query)\n7. Press Enter\n\nFor now, continue with current results, but remember the correct workflow for next time.\n`;
                  }
                }
              } catch (e) {
                console.warn(`⚠️  Failed to parse last tool call args:`, e.message);
              }
            }
          }
        }
        
        // VALIDATION 2: Check for repeated clicks on same coordinates
        if (functionName === 'windows_click_mouse') {
          const currentCoords = `${functionArgs.x},${functionArgs.y}`;
          const recentClicks = toolCallHistory.slice(-3).filter(sig => sig.startsWith('windows_click_mouse'));
          
          let repeatCount = 0;
          for (const click of recentClicks) {
            const [, argsStr] = click.split(':');
            try {
              const args = JSON.parse(argsStr);
              const coords = `${args.x},${args.y}`;
              if (coords === currentCoords) {
                repeatCount++;
              }
            } catch (e) {}
          }
          
          if (repeatCount >= 2) {
            console.log(`\n${'='.repeat(80)}`);
            console.log(`⚠️  DETECTED: Repeated clicks on same coordinates!`);
            console.log(`   Coordinates: (${functionArgs.x}, ${functionArgs.y})`);
            console.log(`   Clicked ${repeatCount} times already`);
            console.log(`   Will execute but inject correction message`);
            console.log(`${'='.repeat(80)}\n`);
            
            shouldCorrectWorkflow = true;
            correctionMessage = `\n\n⚠️  LOOP DETECTED:\n\nYou've clicked (${functionArgs.x}, ${functionArgs.y}) multiple times. This element is not responding as expected.\n\nTry a DIFFERENT approach:\n- If trying to open Chrome: Look for "Google Chrome" in Desktop Icons list and double-click it\n- If trying to search: Use the browser address bar or website search bar\n- If element didn't work: Try a different element\n\nNEVER click the same coordinates more than twice. Move on to a different action.\n`;
          }
        }
        
        // Send tool-call-start event
        console.log(`📤 Sending tool-call-start event`);
        res.write(`0:${JSON.stringify({
          type: 'tool-call-start',
          toolCallId: toolCall.id,
          toolName: functionName,
          args: functionArgs
        })}\n`);
        if (res.flush) res.flush();
        console.log(`✅ tool-call-start sent`);
        
        // Execute the tool
        await new Promise(resolve => setTimeout(resolve, 100));
        
        let result;
        let duration = 0;
        const startTime = Date.now();
        let toolName = functionName.replace('windows_', '');
        
        console.log(`🔍 DEBUG: windowsClient exists: ${!!windowsClient}`);
        console.log(`🔍 DEBUG: functionName: ${functionName}`);
        console.log(`🔍 DEBUG: starts with windows_: ${functionName.startsWith('windows_')}`);
        
        // Execute tool via HTTP API or MCP client
        if (functionName.startsWith('windows_')) {
          // If windowsClient is not available, call Windows Tools API directly via HTTP
          if (!windowsClient) {
            console.log(`⚠️  MCP client not available, calling Windows Tools API directly via HTTP`);
            
            try {
              // Fetch MCP API key from database
              const { data: projectKeys, error: keysError } = await supabase
                .from('projects')
                .select('mcp_api_key')
                .eq('id', projectId)
                .single();
              
              if (keysError || !projectKeys || !projectKeys.mcp_api_key) {
                throw new Error(`Failed to fetch MCP API key: ${keysError?.message || 'Key not found'}`);
              }
              
              // Build container name from project ID (first 8 chars)
              const projectIdShort = projectId.substring(0, 8);
              const containerName = `windows-project-${projectIdShort}`;
              const apiUrl = `http://${containerName}:10018/execute`;
              
              console.log(`📤 Calling ${apiUrl} with tool: ${toolName}`);
              
              // Start a periodic status update to keep stream alive during long tool execution
              const statusUpdateInterval = setInterval(() => {
                try {
                  res.write(`0:${JSON.stringify({
                    type: 'tool-executing',
                    toolName: functionName,
                    elapsed: Date.now() - startTime
                  })}\n`);
                  if (res.flush) res.flush();
                } catch (e) {
                  clearInterval(statusUpdateInterval);
                }
              }, 5000); // Send update every 5 seconds
              
              // Use built-in http module
              result = await new Promise((resolve, reject) => {
                const postData = JSON.stringify({
                  tool: toolName,
                  arguments: functionArgs
                });

                const options = {
                  hostname: containerName,
                  port: 10018,
                  path: '/execute',
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'Authorization': `Bearer ${projectKeys.mcp_api_key}`
                  },
                  timeout: 60000
                };

                const req = http.request(options, (res) => {
                  let data = '';

                  res.on('data', (chunk) => {
                    data += chunk;
                  });

                  res.on('end', () => {
                    if (res.statusCode !== 200) {
                      reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                      return;
                    }

                    try {
                      const result = JSON.parse(data);
                      resolve(result);
                    } catch (e) {
                      reject(new Error(`Failed to parse response: ${e.message}`));
                    }
                  });
                });

                req.on('error', (error) => {
                  reject(error);
                });

                req.on('timeout', () => {
                  req.destroy();
                  reject(new Error('Request timed out after 60 seconds'));
                });

                req.write(postData);
                req.end();
              });
              
              // Clear the status update interval
              clearInterval(statusUpdateInterval);
              
              duration = Date.now() - startTime;
              
              console.log(`✅ Tool ${functionName} executed via HTTP API`);
              console.log(`📊 Result keys:`, Object.keys(result || {}));
              console.log(`📊 Duration: ${duration}ms`);
              
            } catch (error) {
              console.error(`❌ HTTP API call failed:`, error.message);
              result = {
                success: false,
                error: error.message,
                output: `Failed to call Windows Tools API: ${error.message}`
              };
              duration = Date.now() - startTime;
            }
          } else {
            // Use MCP client (preferred method)
            console.log(`✅ Using MCP client for tool execution`);

            // Validate windowsClient is properly connected
            if (!windowsClient.isConnected || !windowsClient.isConnected()) {
              console.error(`❌ Windows client is not connected!`);
              const errorResult = {
                success: false,
                error: 'Windows client not connected',
                output: 'Failed to execute tool: Windows client is not connected. Please check the Windows container status.'
              };
              
              // Send error to frontend
              res.write(`0:${JSON.stringify({
                type: 'desktop-tool-output',
                toolCallId: toolCall.id,
                toolName: functionName,
                args: functionArgs,
                output: errorResult.output,
                status: 'error',
                duration: 0
              })}\n`);
              if (res.flush) res.flush();
              
              // Skip to next iteration
              toolCalls.shift();
              continue;
            }
            
            // Special handling for send_to_terminal - execute directly via WebSocket
            if (toolName === 'send_to_terminal') {
              console.log(`🔧 Sending command directly to terminal via WebSocket...`);
              try {
                // Fetch project's terminal port from database
                const { data: projectData, error: projectError } = await supabase
                  .from('projects')
                  .select('terminal_port')
                  .eq('id', projectId)
                  .single();
                
                if (projectError || !projectData) {
                  throw new Error(`Failed to fetch project data: ${projectError?.message || 'Project not found'}`);
                }
                
                const terminalPort = projectData.terminal_port;
                
                if (!terminalPort) {
                  throw new Error('Terminal port not configured for this project');
                }
                
                console.log(`🔧 Using terminal port: ${terminalPort}`);
                console.log(`🔧 Command: ${functionArgs.command}`);
                
                // Connect to terminal WebSocket and send command
                const WebSocket = require('ws');
                const ws = new WebSocket(`ws://host.docker.internal:${terminalPort}`);
                
                await new Promise((resolve, reject) => {
                  const timeout = setTimeout(() => {
                    ws.close();
                    reject(new Error('WebSocket connection timeout'));
                  }, 5000);
                  
                  ws.on('open', () => {
                    clearTimeout(timeout);
                    console.log(`✅ Connected to terminal WebSocket on port ${terminalPort}`);
                    
                    // Send command followed by Enter
                    ws.send(functionArgs.command + '\r');
                    console.log(`✅ Command sent: ${functionArgs.command}`);
                    
                    // Wait a moment then close
                    setTimeout(() => {
                      ws.close();
                      resolve();
                    }, 500);
                  });
                  
                  ws.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                  });
                });
                
                result = {
                  success: true,
                  output: `Command sent to terminal: ${functionArgs.command}`,
                  message: 'Command sent successfully'
                };
                console.log(`✅ Command sent to terminal successfully`);
              } catch (error) {
                console.error(`❌ Failed to send command to terminal:`, error.message);
                result = {
                  success: false,
                  error: error.message,
                  output: `Failed to send command to terminal: ${error.message}`
                };
              }
            } else {
              console.log(`🔧 Calling windowsClient.executeTool...`);
              
              // Add timeout to prevent hanging
              const TOOL_TIMEOUT = 30000; // 30 seconds
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Tool execution timeout after ${TOOL_TIMEOUT}ms`)), TOOL_TIMEOUT);
              });
              
              try {
                result = await Promise.race([
                  windowsClient.executeTool(toolName, functionArgs),
                  timeoutPromise
                ]);
                console.log(`✅ Tool ${functionName} executed successfully`);
                console.log(`📊 Result keys:`, Object.keys(result || {}));
                console.log(`📊 Result.success:`, result?.success);
                console.log(`📊 Result.message length:`, result?.message?.length || 0);
              } catch (error) {
                console.error(`❌ Tool execution failed:`, error.message);
                result = {
                  success: false,
                  error: error.message,
                  output: `Tool execution failed: ${error.message}`
                };
              }
            }
            
            duration = Date.now() - startTime;
            
            console.log(`📊 Duration: ${duration}ms`);
            console.log(`📊 Result:`, { success: result.success, hasMessage: !!result.message });
          }
        }
        
        // BULK AUTO-INJECT: TYPE_TEXT → PRESS_KEY → SCREENSHOT
        // Execute all three actions immediately, then send ONLY final screenshot to AI
        // 🚨 CRITICAL: Only trigger if previous action was Ctrl+A (clearing search bar)
        // This prevents triggering on random typing actions
        const previousAction = toolCallHistory[toolCallHistory.length - 1];
        const isPreviousCtrlA = previousAction && previousAction.includes('windows_press_key') && 
                                previousAction.includes('ctrl+a');
        
        if (toolName === 'type_text' && result.success && windowsClient && isPreviousCtrlA) {
          console.log(`\n${'='.repeat(80)}`);
          console.log(`⚡ BULK AUTO-INJECT: TYPE → ENTER → SCREENSHOT`);
          console.log(`   Previous action: Ctrl+A (search bar cleared)`);
          console.log(`   Typed text: "${functionArgs.text}"`);
          console.log(`   Executing all actions in bulk...`);
          console.log(`${'='.repeat(80)}\n`);
            
            // 1. Send type_text output to frontend
            res.write(`0:${JSON.stringify({
              type: 'desktop-tool-output',
              toolCallId: toolCall.id,
              toolName: functionName,
              args: functionArgs,
              output: result.output || 'Text typed successfully',
              status: 'success',
              duration: duration
            })}\n`);
            if (res.flush) res.flush();
            
            // Small delay for UI
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 2. Execute press_key(enter) immediately
            const enterStartTime = Date.now();
            const enterResult = await windowsClient.executeTool('press_key', { key: 'enter' });
            const enterDuration = Date.now() - enterStartTime;
            
            console.log(`✅ Auto-injected Enter key press completed`);
            
            // Send enter output to frontend
            res.write(`0:${JSON.stringify({
              type: 'desktop-tool-output',
              toolCallId: `auto_enter_${toolCall.id}`,
              toolName: 'windows_press_key',
              args: { key: 'enter' },
              output: 'Enter key pressed (auto-injected)',
              status: enterResult.success ? 'success' : 'error',
              duration: enterDuration,
              timestamp: Date.now(),
              autoInjected: true
            })}\n`);
            if (res.flush) res.flush();
            
            // Add to tool call history
            const enterSignature = `windows_press_key:${Buffer.from(JSON.stringify({ key: 'enter' })).toString('base64')}`;
            toolCallHistory.push(enterSignature);
            
            // Small delay to let Enter take effect
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // 3. Execute screenshot immediately
            const screenshotStartTime = Date.now();
            const screenshotResult = await windowsClient.executeTool('take_screenshot', {});
            const screenshotDuration = Date.now() - screenshotStartTime;
            
            console.log(`✅ Auto-injected screenshot completed`);
            
            // Send screenshot output to frontend
            res.write(`0:${JSON.stringify({
              type: 'desktop-tool-output',
              toolCallId: `auto_screenshot_${toolCall.id}`,
              toolName: 'windows_take_screenshot',
              args: {},
              output: 'Screenshot captured (auto-injected)',
              status: screenshotResult.success ? 'success' : 'error',
              duration: screenshotDuration,
              timestamp: Date.now(),
              autoInjected: true
            })}\n`);
            if (res.flush) res.flush();
            
            // Override result with screenshot result so AI only sees final context
            // Use a new variable to avoid reassigning const
            result = screenshotResult;
            // Set a flag to indicate we're now processing a screenshot
            const isAutoInjectedScreenshot = true;
            
            console.log(`✅ Bulk auto-inject complete. AI will receive ONLY final screenshot context.`);
            
            // Continue to screenshot handling below (don't skip it)
            // The code below will handle sending screenshot data to AI
          } else {
            // Normal tool execution - send output to frontend
            let toolOutput = result.output || 'Tool executed successfully';
            if (toolName === 'take_screenshot' && result.message) {
              toolOutput = 'Screenshot captured successfully';
            }
            
            console.log(`📤 Sending desktop-tool-output event`);
            res.write(`0:${JSON.stringify({
              type: 'desktop-tool-output',
              toolCallId: toolCall.id,
              toolName: functionName,
              args: functionArgs,
              output: toolOutput,
              status: result.success ? 'success' : 'error',
              duration: duration
            })}\n`);
            if (res.flush) res.flush();
            console.log(`✅ desktop-tool-output sent`);
          }
          
          // Inject correction message if workflow shortcut was detected
          if (shouldCorrectWorkflow && correctionMessage) {
            console.log(`📤 Injecting workflow correction message`);
            res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: correctionMessage })}\n`);
            if (res.flush) res.flush();
            
            // Add to messages so AI sees it in context
            messages.push({
              role: 'assistant',
              content: correctionMessage
            });
          }
          
          // Handle screenshot data
          // Check for imageData in result.message (new format) or result.imageData (old format)
          const imageData = result.message || result.imageData;
          // Check if this is a screenshot (either direct call or auto-injected after type_text)
          const isScreenshot = toolName === 'take_screenshot' || (toolName === 'type_text' && imageData);
          if (isScreenshot && imageData) {
            console.log(`📤 Sending screenshot-data event`);
            const screenshotId = `screenshot_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
            
            if (global.screenshotCache) {
              global.screenshotCache.set(screenshotId, {
                imageData: imageData,
                screenData: result.screenData,
                timestamp: new Date()
              });
            }
            
            res.write(`0:${JSON.stringify({
              type: 'screenshot-data',
              screenshotId: screenshotId,
              hasImageData: true,
              hasScreenData: !!result.screenData,
              imageDataLength: imageData?.length || 0,
              timestamp: new Date().toISOString()
            })}\n`);
            if (res.flush) res.flush();
            console.log(`✅ screenshot-data sent`);
          }
          
          // Add delay for UI actions to let the screen update
          if (toolName === 'click' || toolName === 'double_click' || toolName === 'press_key') {
            console.log(`⏱️  Waiting 2 seconds for UI to update after ${toolName}...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          console.log(`✅ Tool execution complete, requesting single continuation for analysis...`);
          
          // Build continuation request with tool result (ONE TIME ONLY - NO LOOP)
          // Format screenData as ULTRA-COMPACT text for screenshots
          let screenDataText = '';
          let screenNotChangedWarning = null; // Declare at function scope so it's accessible later
          
          // Check if this is a screenshot (either direct call or auto-injected after type_text)
          const isScreenshotForContinuation = (toolName === 'take_screenshot' || (toolName === 'type_text' && result.windowsAPI)) && result.windowsAPI;
          if (isScreenshotForContinuation) {
            const windowsAPI = result.windowsAPI;
            const ocr = result.ocr;
            const size = result.size;
            const mousePos = result.mousePosition;
            let allElements = result.ui_elements || result.uiElements || windowsAPI.elements || [];
            
            // 🚨 FILTER OUT SEARCH BAR UI ELEMENTS - Force AI to use OCR TEXT only for website searches
            // Remove UI elements with "Search" in name that are ComboBox, Button, or Edit (y > 100 and y < 1000)
            // This forces the AI to click on OCR TEXT coordinates, not UI element boundaries
            allElements = allElements.filter(el => {
              const isSearchElement = el.name && el.name.toLowerCase().includes('search');
              const isWebsiteArea = el.y > 100 && el.y < 1000;
              const isInputType = ['ComboBox', 'Button', 'Edit', 'Text'].includes(el.type || el.control_type_name);
              
              // Keep element if it's NOT a search input in website area
              // Remove search UI elements in website area to force OCR TEXT usage
              if (isSearchElement && isWebsiteArea && isInputType) {
                console.log(`🚫 Filtered out search UI element: ${el.name} at (${el.x}, ${el.y}) - forcing OCR TEXT usage`);
                return false; // Remove this element
              }
              return true; // Keep this element
            });
            
            // 🚨 CRITICAL: Store screenshot data globally for text-based tool call fallback
            // This allows the parser to look up element names and extract coordinates
            global.lastScreenshotElements = allElements;
            
            // 🚨 CRITICAL: Store OCR data globally for OCR-first coordinate lookup
            // OCR text should be checked FIRST before UI elements
            global.lastScreenshotOCR = ocr?.textElements || [];
            
            console.log(`💾 Stored ${allElements.length} UI elements globally for coordinate lookup`);
            console.log(`💾 Stored ${global.lastScreenshotOCR.length} OCR text elements globally for OCR-first lookup`);
            
            // 🔍 OCR-FIRST SEARCH HELPER: Find "Search" in OCR TEXT for website search bars
            // This helps the AI prioritize OCR TEXT coordinates over UI element coordinates
            const ocrSearchMatches = global.lastScreenshotOCR.filter(item => {
              const text = (item.text || '').toLowerCase();
              return text.includes('search');
            }).map(match => ({
              text: match.text,
              x: match.center?.x || match.position?.x || 0,  // Use CENTER first (not left edge)
              y: match.center?.y || match.position?.y || 0   // Use CENTER first (not top edge)
            })).filter(match => match.y > 100 && match.y < 1000); // Website area only
            
            if (ocrSearchMatches.length > 0) {
              console.log(`🔍 OCR-FIRST: Found ${ocrSearchMatches.length} "Search" in OCR TEXT (website area):`);
              ocrSearchMatches.forEach(match => {
                console.log(`   - "${match.text}" at (${match.x}, ${match.y}) ✅ USE THIS FOR WEBSITE SEARCH`);
              });
            }
            
            // ULTRA-COMPACT FORMAT - Reduce from ~3000 tokens to ~300 tokens
            screenDataText = `\n\nSCREEN: ${size?.width || 0}x${size?.height || 0}, Mouse: (${mousePos?.x || 0}, ${mousePos?.y || 0})\n\n`;
            
            // Group elements by type for extreme compactness
            const windows = allElements.filter(el => (el.type || el.control_type_name) === 'Window');
            // Desktop icons have control_type_name "ListItem" and are in the desktop area (y < 1000)
            const desktopIcons = allElements.filter(el => 
              ((el.type || el.control_type_name) === 'ListItem' || (el.type || el.control_type_name) === 'Desktop Icon') && 
              el.y < 1000 && el.name && el.name !== ''
            );
            const buttons = allElements.filter(el => (el.type || el.control_type_name) === 'Button');
            const textFields = allElements.filter(el => (el.type || el.control_type_name) === 'Text' || (el.type || el.control_type_name) === 'Edit');
            
            // Windows (most important)
            if (windows.length > 0) {
              screenDataText += `WINDOWS:\n`;
              windows.forEach(w => {
                screenDataText += `- "${w.name}" at (${w.center_x}, ${w.center_y})`;
                if (w.isMaximized) screenDataText += ` [MAX]`;
                screenDataText += `\n`;
              });
            } else {
              screenDataText += `WINDOWS: Desktop (no windows open)\n`;
            }
            
            // Desktop Icons (if on desktop) - SEND ALL
            if (desktopIcons.length > 0) {
              screenDataText += `\nDESKTOP ICONS (${desktopIcons.length} total):\n`;
              desktopIcons.forEach(icon => {
                screenDataText += `- "${icon.name}" at (${icon.center_x}, ${icon.center_y})\n`;
              });
            }
            
            // Important UI elements (buttons, text fields) - SEND ALL
            const importantElements = [...buttons, ...textFields];
            if (importantElements.length > 0) {
              screenDataText += `\nKEY ELEMENTS (${importantElements.length} total):\n`;
              importantElements.forEach(el => {
                const type = el.type || el.control_type_name;
                screenDataText += `- [${type}] "${el.name}" at (${el.center_x}, ${el.center_y})\n`;
              });
            }
            
            // 🔍 OCR-FIRST SEARCH RESULTS: Show "Search" matches from OCR TEXT prominently
            // This helps the AI see OCR TEXT CENTER coordinates FIRST before UI elements
            if (ocrSearchMatches.length > 0) {
              screenDataText += `\n🔍 WEBSITE SEARCH BAR (OCR TEXT CENTER - USE THESE COORDINATES):\n`;
              ocrSearchMatches.forEach(match => {
                screenDataText += `- "${match.text}" at (${match.x}, ${match.y}) ✅ OCR TEXT CENTER\n`;
              });
              screenDataText += `⚠️  DO NOT use UI element coordinates for website search bars!\n`;
            }
            
            // OCR Text - SEND ALL (no filtering)
            const ocrElements = (ocr?.textElements || ocr?.detectedElements || [])
            
            if (ocrElements.length > 0) {
              screenDataText += `\nTEXT (${ocrElements.length} total):\n`;
              ocrElements.forEach(text => {
                const x = text.center?.x || text.position?.x || text.x;
                const y = text.center?.y || text.position?.y || text.y;
                const conf = text.confidence ? ` (${(text.confidence * 100).toFixed(0)}%)` : '';
                screenDataText += `- "${text.text}" at (${x}, ${y})${conf}\n`;
              });
            }
            
            console.log(`📊 Formatted COMPLETE screen data for AI (${screenDataText.length} chars, ~${Math.ceil(screenDataText.length / 4)} tokens)`);
            console.log(`   ✅ ALL ${desktopIcons.length} desktop icons included`);
            console.log(`   ✅ ALL ${importantElements.length} UI elements included`);
            console.log(`   ✅ ALL ${ocrElements.length} OCR text elements included`);
            
            // 🚨 CRITICAL: Compare with previous screenshot to detect if screen hasn't changed
            
            if (previousScreenshotData && toolCallIteration > 1) {
              console.log(`\n${'='.repeat(80)}`);
              console.log(`🔍 COMPARING SCREENSHOTS - Checking if screen changed`);
              console.log(`${'='.repeat(80)}\n`);
              
              // Extract key data for comparison
              const currentData = {
                windowName: windows.length > 0 ? windows[0].name : 'Desktop',
                textElements: ocrElements.map(t => t.text).sort().join('|'),
                keyElements: importantElements.map(el => el.name).sort().join('|'),
                elementCount: allElements.length
              };
              
              console.log(`📊 Current screenshot data:`);
              console.log(`   Window: "${currentData.windowName}"`);
              console.log(`   Text elements: ${ocrElements.length} items`);
              console.log(`   Key elements: ${importantElements.length} items`);
              console.log(`   Total elements: ${currentData.elementCount}`);
              
              console.log(`\n📊 Previous screenshot data:`);
              console.log(`   Window: "${previousScreenshotData.windowName}"`);
              console.log(`   Text elements: ${previousScreenshotData.textElements.split('|').filter(t => t).length} items`);
              console.log(`   Key elements: ${previousScreenshotData.keyElements.split('|').filter(k => k).length} items`);
              console.log(`   Total elements: ${previousScreenshotData.elementCount}`);
              
              // Calculate similarity
              const windowMatch = currentData.windowName === previousScreenshotData.windowName;
              const textMatch = currentData.textElements === previousScreenshotData.textElements;
              const elementsMatch = currentData.keyElements === previousScreenshotData.keyElements;
              const countMatch = Math.abs(currentData.elementCount - previousScreenshotData.elementCount) <= 2; // Allow 2 element difference
              
              console.log(`\n🔍 Comparison results:`);
              console.log(`   Window match: ${windowMatch ? '✅ YES' : '❌ NO'}`);
              console.log(`   Text match: ${textMatch ? '✅ YES' : '❌ NO'}`);
              console.log(`   Elements match: ${elementsMatch ? '✅ YES' : '❌ NO'}`);
              console.log(`   Count match: ${countMatch ? '✅ YES' : '❌ NO'}`);
              
              // Track consecutive identical screenshots
              if (!global.identicalScreenshotCount) {
                global.identicalScreenshotCount = 0;
              }
              
              // If all match, screen hasn't changed
              if (windowMatch && textMatch && elementsMatch && countMatch) {
                global.identicalScreenshotCount++;
                console.log(`\n⚠️  SCREEN HASN'T CHANGED - Identical screenshot #${global.identicalScreenshotCount}`);
                
                // Trigger repetition detection after 2 identical screenshots (not 3)
                if (global.identicalScreenshotCount >= 2) {
                  console.log(`\n🚨 REPETITION DETECTED - 2 identical screenshots in a row!`);
                  console.log(`   Triggering context reset to break the loop\n`);
                  
                  // Reset the counter
                  global.identicalScreenshotCount = 0;
                  
                  // Trigger context reset
                  const recentActions = toolCallHistory.slice(-5).map(sig => {
                    const parts = sig.split(':');
                    const tool = parts[0];
                    const argsStr = parts.slice(1).join(':');
                    try {
                      const args = JSON.parse(argsStr);
                      if (tool === 'windows_click_mouse') {
                        return `clicked (${args.x}, ${args.y})`;
                      } else if (tool === 'windows_type_text') {
                        return `typed "${args.text}"`;
                      } else if (tool === 'windows_press_key') {
                        return `pressed ${args.key}`;
                      }
                    } catch (e) {}
                    return tool.replace('windows_', '');
                  }).join(', ');
                  
                  const summary = `Previous actions: ${recentActions}. Screen hasn't changed - your actions aren't working. Try a DIFFERENT approach.`;
                  
                  // Reset messages
                  messages.length = 0;
                  messages.push({
                    role: 'system',
                    content: modeSystemPrompt
                  });
                  messages.push({
                    role: 'user',
                    content: `${history[0]?.content || message}\n\nContext: ${summary}\n\nThe screen is identical to before. Your last action didn't work. Try clicking a DIFFERENT element or use a DIFFERENT approach.`
                  });
                  
                  // Force a screenshot
                  toolCalls.length = 0;
                  toolCalls.push({
                    id: `identical_reset_${Date.now()}`,
                    type: 'function',
                    function: {
                      name: 'windows_take_screenshot',
                      arguments: '{}'
                    }
                  });
                  
                  const resetMessage = `\n\n┃ Screen unchanged - trying different approach...\n`;
                  res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: resetMessage })}\n`);
                  if (res.flush) res.flush();
                  
                  console.log(`✅ Context reset triggered by identical screenshots`);
                  
                  // Continue with the screenshot
                  continue;
                }
              } else {
                // Screen changed - reset counter
                global.identicalScreenshotCount = 0;
              }
              
              if (windowMatch && textMatch && elementsMatch && countMatch) {
                console.log(`\n⚠️  SCREEN HASN'T CHANGED - ACTION FAILED!`);
                console.log(`   The screen looks identical to the previous screenshot`);
                console.log(`   This means the last action didn't work`);
                console.log(`   AI needs to try a different approach\n`);
                console.log(`${'='.repeat(80)}\n`);
                
                // Store warning message to add after conversationMessages is created
                screenNotChangedWarning = {
                  role: 'system',
                  content: `🚨 WARNING: SCREEN HASN'T CHANGED!

The current screenshot is IDENTICAL to the previous one:
- Same window: "${currentData.windowName}"
- Same text elements
- Same UI elements

This means your last action DID NOT WORK!

WHAT TO DO:
1. ❌ DO NOT repeat the same action
2. ❌ DO NOT say "Done" - the task is NOT complete
3. ✅ Try clicking a DIFFERENT element
4. ✅ Try a DIFFERENT coordinate
5. ✅ Try double-clicking instead of single-clicking
6. ✅ Try pressing a different key

REMEMBER: If the screen looks the same, your action FAILED. Try something different!`
                };
                
                console.log(`✅ Prepared warning message to inject into conversation`);
                
                // Also send a visible message to the user
                const userWarning = `\n\nScreen hasn't changed - trying different approach...\n`;
                res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: userWarning })}\n`);
                if (res.flush) res.flush();
              } else {
                console.log(`\n✅ SCREEN HAS CHANGED - ACTION SUCCEEDED!`);
                console.log(`   The screen is different from the previous screenshot`);
                console.log(`   The last action worked correctly\n`);
                console.log(`${'='.repeat(80)}\n`);
              }
            } else if (toolCallIteration === 1) {
              console.log(`ℹ️  First screenshot - no comparison needed`);
            }
            
            // Store current screenshot data for next comparison
            previousScreenshotData = {
              windowName: windows.length > 0 ? windows[0].name : 'Desktop',
              textElements: (ocr?.textElements || ocr?.detectedElements || [])
                .filter(t => !t.confidence || t.confidence > 0.7)
                .slice(0, 10)
                .map(t => t.text)
                .sort()
                .join('|'),
              keyElements: [...buttons, ...textFields]
                .slice(0, 5)
                .map(el => el.name)
                .sort()
                .join('|'),
              elementCount: allElements.length
            };
            
            console.log(`💾 Stored current screenshot data for next comparison`);
          }
          
          // Build conversation messages for continuation request
          // OpenRouter requires the full conversation including assistant's tool_calls
          const conversationMessages = [
            ...messages,
            {
              role: 'assistant',
              content: initialText || null,
              tool_calls: [toolCall]
            },
            {
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: toolName === 'take_screenshot' && screenDataText 
                ? screenDataText
                : JSON.stringify({
                    success: result.success,
                    message: result.output || result.message || 'Tool executed successfully'
                  })
            }
          ];
          
          // Update messages array for next iteration
          messages.push({
            role: 'assistant',
            content: initialText || null,
            tool_calls: [toolCall]
          });
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: toolName === 'take_screenshot' && screenDataText 
              ? screenDataText
              : JSON.stringify({
                  success: result.success,
                  message: result.output || result.message || 'Tool executed successfully'
                })
          });
          
          // Add screen not changed warning if detected
          if (screenNotChangedWarning) {
            conversationMessages.push(screenNotChangedWarning);
            contextTokenCount += estimateTokens(screenNotChangedWarning.content);
            console.log(`✅ Injected warning message into conversation`);
            console.log(`📊 Context size after warning: ~${contextTokenCount} tokens`);
          }
          
          // Update context token count with new messages
          contextTokenCount += estimateTokens(initialText || '');
          contextTokenCount += estimateTokens((toolName === 'take_screenshot' || (toolName === 'type_text' && screenDataText)) && screenDataText ? screenDataText : JSON.stringify({ success: result.success, message: result.output || result.message || 'Tool executed successfully' }));
          
          console.log(`📊 Context size after tool execution: ~${contextTokenCount} tokens`);
          
          // For screenshots, add a system reminder to describe what they see
          // Check if this is a screenshot (either direct call or auto-injected after type_text)
          const isAfterScreenshot = toolName === 'take_screenshot' || (toolName === 'type_text' && screenDataText);
          const isAfterAction = ['click_mouse', 'type_text', 'press_key'].includes(toolName);
          
          console.log(`🔍 Tool execution complete: toolName=${toolName}, isAfterScreenshot=${isAfterScreenshot}, isAfterAction=${isAfterAction}, toolCallIteration=${toolCallIteration}`);
          
          // Build action history summary to maintain context
          const actionHistory = toolCallHistory.slice(-5).map(sig => {
            const { tool, args } = parseToolSignature(sig);
            if (tool === 'windows_click_mouse') {
              return `Clicked at (${args.x}, ${args.y})`;
            } else if (tool === 'windows_type_text') {
              return `Typed "${args.text}"`;
            } else if (tool === 'windows_press_key') {
              return `Pressed ${args.key}`;
            } else if (tool === 'windows_take_screenshot') {
              return `Took screenshot`;
            }
            return tool;
          }).join(' → ');
          
          const contextReminder = actionHistory ? `\n\n🔄 ACTIONS COMPLETED SO FAR:\n${actionHistory}\n\nCRITICAL: DO NOT REPEAT ANY OF THESE ACTIONS. Progress forward to the NEXT step.` : '';
          
          if (isAfterScreenshot) {
            console.log(`📋 Adding system message: Describe screenshot data and action format reminder`);
            const systemMessage = {
              role: 'system',
              content: `Screenshot received.${contextReminder}

🚨 CRITICAL ANTI-HALLUCINATION RULES:
1. ONLY describe what EXISTS in the screenshot data sections (WINDOWS, TEXT, KEY ELEMENTS, DESKTOP ICONS)
2. If TEXT section doesn't mention "video thumbnails" → DO NOT say "video thumbnails"
3. If TEXT section doesn't mention "search results" → DO NOT say "search results"
4. NEVER infer, assume, or guess content - ONLY describe what's explicitly in the data
5. Quote EXACT text from TEXT section (e.g., "Search", "Home", "Q")

🚨 CRITICAL FORMATTING RULES - NEVER SHOW COORDINATES:
6. NEVER show coordinates in descriptions (e.g., say "YouTube search bar" NOT "search bar at (651, 155)")
7. NEVER say just "search bar" - ALWAYS specify: "browser address bar" or "YouTube search bar"
8. ALWAYS mention BOTH search bars when website is loaded: "browser address bar" AND "YouTube search bar"
9. Coordinates are for internal use ONLY - NEVER include them in your descriptions

❌ WRONG: "I can see the search bar at (651, 155)"
✅ CORRECT: "I can see the YouTube search bar"

❌ WRONG: "I can see the search bar"
✅ CORRECT: "I can see the browser address bar and the YouTube search bar"

Example: "Currently focused window: YouTube - Google Chrome. I can see text: 'Search', 'Home'. Elements: Browser address bar, YouTube search bar, Home button."

DO NOT make up content. DO NOT guess content. ONLY describe what EXISTS in the data sections.
DO NOT show coordinates. DO NOT say just "search bar" - specify which one.

Analyze data → Quote EXACT text + Describe ONLY existing elements (NO coordinates) → Execute ONE action → Continue until ENTIRE task complete.

NEXT: State focused window, quote EXACT visible text, describe ONLY elements that exist in data (NO coordinates), then execute next action.`
            };
            conversationMessages.push(systemMessage);
            contextTokenCount += estimateTokens(systemMessage.content);
          } else if (isAfterAction) {
            // After an action, add a system message to remind AI to take a screenshot
            // But DON'T force it - let the continuation request handle it naturally
            const isTypeText = toolName === 'type_text';
            
            if (!isTypeText) {
              console.log(`📋 Adding system message: Action completed, AI should take screenshot`);
              conversationMessages.push({
                role: 'system',
                content: `Action completed. Take a screenshot NOW to verify the action worked and see the current state.`
              });
            }
          } else {
            console.log(`📋 No system message added (isAfterAction=${isAfterAction}, toolCallIteration=${toolCallIteration})`);
          }
          
          console.log(`📊 Context size after system messages: ~${contextTokenCount} tokens`);
          
          console.log(`📤 Requesting AI continuation (WITH tools for multi-step)`);
          
          try {
          // Request continuation WITH tools to allow more tool calls
          const continuationResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'http://localhost:3000',
              'X-Title': 'Kali AI Assistant'
            },
            body: JSON.stringify({
              model: model,
              messages: conversationMessages,
              stream: true,
              tools: tools && tools.length > 0 ? tools : undefined, // Include tools for multi-step
              // Don't set tool_choice to let model follow system prompt
              parallel_tool_calls: false
            }),
            signal: abortController.signal // Use abort controller
          });
          
          if (continuationResponse.ok) {
            console.log(`✅ Continuation stream started, streaming AI response...`);
            const contReader = continuationResponse.body.getReader();
            let contBuffer = '';
            let contChars = 0;
            let contText = '';
            let newToolCalls = [];
            
            while (true) {
              const { done, value} = await contReader.read();
              if (done) break;
              
              contBuffer += decoder.decode(value, { stream: true });
              const contLines = contBuffer.split('\n');
              contBuffer = contLines.pop() || '';
              
              for (const contLine of contLines) {
                if (contLine.startsWith('data: ')) {
                  const contData = contLine.slice(6);
                  if (contData === '[DONE]') continue;
                  
                  try {
                    const contParsed = JSON.parse(contData);
                    const contDelta = contParsed.choices?.[0]?.delta;
                    
                    // Stream AI's text
                    if (contDelta?.content) {
                      contChars += contDelta.content.length;
                      contText += contDelta.content;
                      contextTokenCount += estimateTokens(contDelta.content); // Track AI response tokens
                      
                      // FILTER: Detect "Stopped" messages and trigger context reset
                      let filteredContent = contDelta.content;
                      const forbiddenPhrases = [
                        'stopped to prevent repeating',
                        'action completed. stopped'
                      ];
                      
                      const lowerContent = filteredContent.toLowerCase();
                      let shouldTriggerReset = false;
                      for (const phrase of forbiddenPhrases) {
                        if (lowerContent.includes(phrase)) {
                          console.log(`\n⚠️  DETECTED FORBIDDEN PHRASE: "${phrase}" in AI response`);
                          console.log(`   Original text: "${filteredContent}"`);
                          console.log(`   🔄 Will trigger context reset to break the loop`);
                          shouldTriggerReset = true;
                          break;
                        }
                      }
                      
                      // Stream the content (don't block it, let AI learn)
                      if (filteredContent) {
                        console.log(`📝 AI Response: "${filteredContent}"`);
                        res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: filteredContent })}\n`);
                      }
                      
                      // If we detected forbidden phrase, trigger context reset
                      if (shouldTriggerReset) {
                        console.log(`📤 Triggering context reset due to "Stopped" phrase`);
                        shouldResetAfterResponse = true; // This will trigger reset after response completes
                      }
                      
                      // Context limit check removed - only reset on "Stopped" phrase or critical limit
                    }
                    
                    // Check for new tool calls
                    if (contDelta?.tool_calls) {
                      for (const toolCallDelta of contDelta.tool_calls) {
                        const index = toolCallDelta.index || 0;
                        
                        if (!newToolCalls[index]) {
                          newToolCalls[index] = {
                            id: toolCallDelta.id || `call_${toolCallIteration}_${index}`,
                            type: 'function',
                            function: {
                              name: '',
                              arguments: ''
                            }
                          };
                        }
                        
                        if (toolCallDelta.function?.name) {
                          newToolCalls[index].function.name += toolCallDelta.function.name;
                        }
                        
                        if (toolCallDelta.function?.arguments) {
                          newToolCalls[index].function.arguments += toolCallDelta.function.arguments;
                        }
                      }
                    }
                  } catch (e) {
                    console.error('Failed to parse continuation:', e);
                  }
                }
              }
            }
            
            console.log(`✅ Continuation complete: ${contChars} chars generated`);
            console.log(`🔍 DEBUG: contText length = ${contText.length}, newToolCalls length = ${newToolCalls.length}`);
            console.log(`🔍 DEBUG: contText = "${contText}"`);
            
            // Check for text-based tool calls in continuation text
            // ALWAYS check, even if there are structured tool calls, because AI might generate both
            if (contText) {
              console.log(`🔍 Checking for text-based tool calls in continuation text (${contText.length} chars)`);
              console.log(`   Text preview: "${contText.substring(0, 200)}..."`);
              console.log(`   Existing structured tool calls: ${newToolCalls.length}`);
              
              const { extractToolCall, normalizeToolName } = require('./text-tool-call-parser');
              const toolCallMatch = extractToolCall(contText);
              
              if (toolCallMatch) {
                console.log(`🔍 DETECTED TEXT-BASED TOOL CALL IN CONTINUATION: ${toolCallMatch.functionName}`);
                console.log(`   Args:`, toolCallMatch.args);
                console.log(`   Full match: "${toolCallMatch.fullMatch}"`);
                
                const normalizedName = normalizeToolName(toolCallMatch.functionName);
                
                // Check if this is explicit syntax (should be hidden) or natural language (should be kept)
                const explicitSyntaxPattern = /\[Calls?:\s*([a-zA-Z_][a-zA-Z0-9_]*)\((\{[^}]*\}|[^)]*)\)\]/i;
                const isExplicitSyntax = explicitSyntaxPattern.test(toolCallMatch.fullMatch);
                
                if (isExplicitSyntax) {
                  console.log(`📤 Sending text-replace event to hide explicit syntax`);
                  const cleanedText = toolCallMatch.textBefore + (toolCallMatch.textAfter ? ' ' + toolCallMatch.textAfter : '');
                  res.write(`0:${JSON.stringify({ 
                    type: 'text-replace', 
                    text: cleanedText 
                  })}\n`);
                  if (res.flush) res.flush();
                  contText = cleanedText;
                }
                
                // Convert text-based tool call to structured format
                newToolCalls.push({
                  id: `text_call_cont_${toolCallIteration}_${Date.now()}`,
                  type: 'function',
                  function: {
                    name: normalizedName,
                    arguments: JSON.stringify(toolCallMatch.args)
                  },
                  _fromText: true,
                  _textBefore: toolCallMatch.textBefore,
                  _textAfter: toolCallMatch.textAfter
                });
                
                console.log(`✅ Converted continuation text tool call to structured format: ${normalizedName}`);
                console.log(`   Total tool calls now: ${newToolCalls.length}`);
              } else {
                console.log(`   No text-based tool call detected in continuation text`);
              }
            } else {
              console.log(`   Skipping text-based detection: contText is empty`);
            }
            
            // Detect text repetition (infinite loops) - RELAXED THRESHOLD
            if (contText.length > 100) {
              // Check if the same phrase is repeated many times (increased from 5 to 10)
              const phrases = contText.match(/(.{20,}?)\1{10,}/g); // Find any 20+ char phrase repeated 10+ times
              if (phrases) {
                console.log(`⚠️ TEXT REPETITION DETECTED: AI is stuck in a loop`);
                console.log(`   Repeated phrase: "${phrases[0].substring(0, 50)}..."`);
                console.log(`   Stopping iteration to prevent infinite loop`);
                break; // Stop the loop
              }
              
              // Check if text is too long (likely stuck) - INCREASED LIMIT
              if (contText.length > 10000) {
                console.log(`⚠️ EXCESSIVE TEXT DETECTED: ${contText.length} characters generated`);
                console.log(`   AI may be stuck in a loop - stopping iteration`);
                break;
              }
            }
            
            // Update for next iteration
            initialText = contText;
            const previousToolCalls = toolCalls; // Save previous tool calls
            const justExecutedToolCallId = previousToolCalls.length > 0 ? previousToolCalls[0].id : null;
            
            // 🚨 CRITICAL: Remove the tool call we just executed from the array
            if (toolCalls.length > 0) {
              console.log(`🗑️  Removing executed tool call from queue: ${toolCalls[0].function.name} (id: ${toolCalls[0].id})`);
              toolCalls.shift(); // Remove the first element
            }
            
            // 🚨 CRITICAL FIX: Filter out tool calls that have the SAME ID as the one we just executed
            // OR that have already been executed before
            // This prevents the infinite loop where OpenRouter returns the same tool call repeatedly
            const newToolCallsFiltered = newToolCalls.filter(tc => {
              if (!tc || !tc.function.name) return false;
              
              // Skip if this tool call ID has already been executed
              if (executedToolCallIds.has(tc.id)) {
                console.log(`\n🚨 FILTERED OUT ALREADY EXECUTED TOOL CALL ID: ${tc.id}`);
                console.log(`   Tool: ${tc.function.name}`);
                console.log(`   This tool call was already executed - skipping to prevent infinite loop`);
                return false;
              }
              
              // Skip if this is the same tool call ID we just executed
              if (justExecutedToolCallId && tc.id === justExecutedToolCallId) {
                console.log(`\n🚨 FILTERED OUT DUPLICATE TOOL CALL ID: ${tc.id}`);
                console.log(`   Tool: ${tc.function.name}`);
                console.log(`   This tool call was just executed - skipping to prevent infinite loop`);
                return false;
              }
              
              return true;
            });
            
            // Add the filtered new tool calls to the queue
            toolCalls.push(...newToolCallsFiltered);
            
            console.log(`📊 After filtering: ${toolCalls.length} tool call(s) in queue`);
            if (toolCalls.length > 0) {
              console.log(`   Next tool calls:`, toolCalls.map(tc => `${tc.function.name} (id: ${tc.id})`));
            }
            
            // 🚨 CRITICAL: Check if AI said "Done" in the continuation text
            // This indicates the task is complete and we should exit the loop
            const donePattern = /\b(done|finished|complete|completed|task\s+complete|workflow\s+complete)\b/i;
            if (contText && donePattern.test(contText)) {
              console.log(`\n✅ AI SAID DONE: "${contText.match(donePattern)[0]}"`);
              console.log(`   Task is complete - exiting workflow loop`);
              aiSaidDone = true;
              
              // Task complete - don't send completion message to user (silent)
              console.log('✅ Task complete (silent)');
              
              // Exit the loop
              break;
            }
            
            // 🚨 CRITICAL: If no tool calls were generated but AI hasn't said "Done", request continuation
            // This prevents premature exit when element lookup fails or AI is thinking
            if (toolCalls.length === 0 && !aiSaidDone) {
              console.log(`\n⚠️  NO TOOL CALLS GENERATED but AI hasn't said "Done"`);
              console.log(`   Requesting continuation to either:`);
              console.log(`   1. Try a different approach`);
              console.log(`   2. Say "Done" if task is complete`);
              
              // Add a message asking AI to continue or say done
              messages.push({
                role: 'user',
                content: `No action was detected. If the task is complete, say "Done". Otherwise, describe what you'll do next and take action.`
              });
              
              // Request another continuation
              console.log(`📤 Requesting continuation after empty tool queue...`);
              
              // Continue to next iteration (don't break)
              continue;
            }
            
            // 🚨 CRITICAL: Check if continuation generated the SAME tool call
            // NOTE: This check is disabled because it's too aggressive and interrupts valid workflows
            // The executedToolCallIds Set already prevents true infinite loops
            // Allow the AI to retry actions if needed (e.g., if screen didn't update yet)
            if (false && toolCalls.length > 0 && previousToolCalls.length > 0) {
              const newToolCall = toolCalls[0];
              const prevToolCall = previousToolCalls[0];
              
              // Compare tool call IDs or function names
              if (newToolCall.id === prevToolCall.id || 
                  (newToolCall.function.name === prevToolCall.function.name && 
                   newToolCall.function.arguments === prevToolCall.function.arguments)) {
                
                // Track consecutive identical tool calls
                if (!consecutiveIdenticalToolCalls) {
                  consecutiveIdenticalToolCalls = 1;
                } else {
                  consecutiveIdenticalToolCalls++;
                }
                
                console.log(`\n⚠️  CONTINUATION GENERATED SAME TOOL CALL (attempt ${consecutiveIdenticalToolCalls})`);
                console.log(`   Previous: ${prevToolCall.function.name} (id: ${prevToolCall.id})`);
                console.log(`   New: ${newToolCall.function.name} (id: ${newToolCall.id})`);
                
                // Stop after 3 attempts (allow 2 retries)
                if (consecutiveIdenticalToolCalls >= 3) {
                  console.log(`   🚨 AI is stuck after ${consecutiveIdenticalToolCalls} attempts - stopping workflow`);
                  
                  // Send warning and stop
                  const warning = `\n\nAI generated the same tool call repeatedly. Stopping to prevent infinite loop.\n`;
                  res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: warning })}\n`);
                  toolCalls = []; // Clear to exit loop
                  break;
                } else {
                  console.log(`   Allowing retry (${consecutiveIdenticalToolCalls}/3 attempts)`);
                }
              } else {
                // Different tool call - reset counter
                consecutiveIdenticalToolCalls = 0;
              }
            }
            
            // Track consecutive screenshots - INCREASED LIMIT (check AFTER updating toolCalls)
            if (toolCalls.length > 0 && toolCalls[0].function.name === 'windows_take_screenshot') {
              consecutiveScreenshots++;
              if (consecutiveScreenshots >= 10) {
                console.log(`⚠️ TOO MANY CONSECUTIVE SCREENSHOTS: ${consecutiveScreenshots} in a row`);
                console.log(`   AI should take action instead of just observing`);
                console.log(`   Stopping iteration`);
                break;
              }
            } else if (toolCalls.length > 0) {
              consecutiveScreenshots = 0; // Reset if action tool is called
            }
            
            // Check if we should reset context after this response
            if (shouldResetAfterResponse && !hasResetContext) {
              console.log(`\n${'='.repeat(80)}`);
              console.log(`🔄 CONTEXT RESET TRIGGERED - LIMIT EXCEEDED DURING RESPONSE`);
              console.log(`   Current: ~${contextTokenCount} tokens`);
              console.log(`   Maximum: ${maxContextTokens} tokens`);
              console.log(`   Resetting context to continue fresh`);
              console.log(`${'='.repeat(80)}\n`);
              
              // Create brief summary
              const recentActions = toolCallHistory.slice(-5).map(sig => {
                const { tool, args } = parseToolSignature(sig);
                if (tool === 'windows_click_mouse') {
                  return `clicked (${args.x}, ${args.y})`;
                } else if (tool === 'windows_type_text') {
                  return `typed "${args.text}"`;
                } else if (tool === 'windows_press_key') {
                  return `pressed ${args.key}`;
                }
                return tool.replace('windows_', '');
              }).join(', ');
              
              const summary = `Previous actions: ${recentActions}. Continue from current screen state.`;
              
              console.log(`📝 Context summary: ${summary}`);
              
              // Reset messages
              const originalRequest = history[0]?.content || message;
              messages.length = 0;
              messages.push({
                role: 'system',
                content: modeSystemPrompt
              });
              messages.push({
                role: 'user',
                content: `${originalRequest}\n\nContext: ${summary}\n\nTake a screenshot and continue from current state.`
              });
              
              // Recalculate context size
              contextTokenCount = messages.reduce((total, msg) => {
                return total + estimateTokens(msg.content);
              }, 0);
              
              console.log(`📊 Context size after reset: ~${contextTokenCount} tokens`);
              
              // Force a screenshot
              toolCalls = [{
                id: `reset_screenshot_${Date.now()}`,
                type: 'function',
                function: {
                  name: 'windows_take_screenshot',
                  arguments: '{}'
                }
              }];
              
              hasResetContext = true;
              shouldResetAfterResponse = false;
              
              // Notify user
              const resetMessage = `\n\n┃ Context limit reached (~${maxContextTokens} tokens). Resetting to continue fresh.\n`;
              res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: resetMessage })}\n`);
              if (res.flush) res.flush();
              
              console.log(`✅ Context reset complete, taking fresh screenshot`);
            }
            
            if (toolCalls.length > 0) {
              console.log(`🔄 AI wants to make ${toolCalls.length} more tool calls, continuing...`);
            } else {
              console.log(`⚠️  No tool calls detected in AI response`);
              
              // Check if AI explicitly said "Done" - if so, respect it
              const aiSaidDone = (initialText || '').trim().toLowerCase().includes('done');
              
              if (aiSaidDone) {
                console.log(`✅ AI explicitly said "Done" - task is complete`);
                // Task is complete, stop the workflow
              } else {
                // Check if AI mentioned an action but didn't make a tool call
                const text = (initialText || '').toLowerCase();
                const mentionsAction = /\b(click|type|press|search|open|navigate|go to|double-click)\b/.test(text);
                
                // Check for repetition - if AI keeps saying the same thing without acting
                const isRepetition = textHistory.length > 0 && 
                  textHistory.slice(-2).every(prevText => {
                    const similarity = prevText.toLowerCase().includes('open chrome') || 
                                     prevText.toLowerCase().includes('double-click');
                    return similarity;
                  });
                
                if (mentionsAction && toolCallIteration < 20) {
                  console.log(`🔄 AI mentioned an action but didn't make a tool call`);
                  console.log(`   Text: "${(initialText || '').substring(0, 100)}..."`);
                  console.log(`   Is repetition: ${isRepetition}`);
                  console.log(`   Sending continuation request to force tool call`);
                  
                  // Force a continuation by adding a system message
                  messages.push({
                    role: 'assistant',
                    content: initialText || null
                  });
                  
                  // Check if AI mentioned "search bar" - provide specific guidance
                  const mentionsSearchBar = /search\s*bar/i.test(initialText || '');
                  const onYouTube = /youtube/i.test(JSON.stringify(messages.slice(-3))); // Check recent context
                  
                  let continuationPrompt = `🚨 CRITICAL: You mentioned an action but didn't call any tool!

You said: "${(initialText || '').substring(0, 150)}"

${isRepetition ? '⚠️ WARNING: You are REPEATING yourself! You already said this before. STOP repeating and ACT NOW!\n\n' : ''}

You MUST call a tool to perform the action. Use the EXACT format:

For clicking: windows_click_mouse(x=123, y=456)
For typing: windows_type_text(text="your text")
For pressing key: windows_press_key(key="enter")

Extract coordinates from the KEY ELEMENTS section in the screenshot data above.

Example: If you see "[Desktop icon] Google Chrome at (100, 200)", use:
windows_click_mouse(x=100, y=200, double=true)

${isRepetition ? '🚨 DO NOT say "I will" or "I\'ll" again - CALL THE TOOL NOW with coordinates!\n\n' : ''}`;

                  if (mentionsSearchBar && onYouTube) {
                    continuationPrompt += `

🚨 SEARCH BAR WARNING:
You mentioned "search bar" while on YouTube. There are THREE different search bars:
1. Windows taskbar search (y > 1000) - NEVER use for websites!
2. Browser address bar (y < 100) - ONLY for URLs like youtube.com
3. YouTube website search bar (y > 100, inside website) - USE THIS for searching!

You MUST use the YOUTUBE WEBSITE SEARCH BAR (inside the website content), NOT the browser address bar!
Look for "YouTube search" or "Search" element with y coordinate > 100 in KEY ELEMENTS section.

WRONG: Browser address bar at (988, 63) ❌
CORRECT: YouTube search bar at (651, 155) ✅ (example coordinates)`;
                  }

                  continuationPrompt += `

CALL THE TOOL NOW with proper coordinates from KEY ELEMENTS section!`;

                  messages.push({
                    role: 'system',
                    content: continuationPrompt
                  });
                  
                  // Don't force screenshot - let AI make the actual tool call
                  console.log(`✅ Sent continuation prompt - waiting for AI to make tool call`);
                  continue;
                }
                
                console.log(`✅ No more tool calls, AI is done`);
                // Don't check for repetition - the AI has completed the task
              }
            
          // CRITICAL: Detect text repetition (AI generating same response multiple times)
          if (toolCalls.length === 0) {
            const currentTextNormalized = (initialText || '').trim().toLowerCase().replace(/\s+/g, ' ');
                
                // Check if this text is very similar to recent responses
                if (currentTextNormalized.length > 20) { // Only check substantial responses
                  const recentTexts = textHistory.slice(-3); // Check last 3 responses
                  let repetitionCount = 0;
                  
                  for (const prevText of recentTexts) {
                    const prevNormalized = prevText.trim().toLowerCase().replace(/\s+/g, ' ');
                    
                    // Calculate similarity (simple approach: check if 80% of words match)
                    const currentWords = currentTextNormalized.split(' ');
                    const prevWords = prevNormalized.split(' ');
                    
                    if (currentWords.length > 5 && prevWords.length > 5) {
                      const matchingWords = currentWords.filter(word => prevWords.includes(word)).length;
                    const similarity = matchingWords / Math.max(currentWords.length, prevWords.length);
                    
                    if (similarity > 0.8) {
                      repetitionCount++;
                    }
                  }
                }
                
                // If we've seen this response 2+ times, it's a repetition loop
                if (repetitionCount >= 2) {
                  console.log(`⚠️ TEXT REPETITION DETECTED: AI generated similar response ${repetitionCount + 1} times`);
                  console.log(`   Current: "${initialText.substring(0, 100)}..."`);
                  console.log(`   This indicates the AI is stuck. Forcing a different approach.`);
                  
                  // Send message to user
                  const loopMessage = `\n\n┃ Detected response loop. Forcing different approach.\n`;
                  res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: loopMessage })}\n`);
                  if (res.flush) res.flush();
                  
                  // Add strong instruction to do something different
                  messages.push({
                    role: 'assistant',
                    content: initialText
                  });
                  
                  messages.push({
                    role: 'system',
                    content: `CRITICAL: You are repeating the same response. This is NOT helpful.

You MUST do something DIFFERENT now:

1. If you keep saying you'll click the address bar but haven't typed yet → TYPE the URL now
2. If you keep describing the screen → TAKE ACTION instead
3. If you keep trying the same coordinates → Try DIFFERENT coordinates
4. If something isn't working → Try a DIFFERENT approach

DO NOT repeat yourself. Execute a DIFFERENT action NOW.`
                  });
                  
                  // Request a different response
                  const loopResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${apiKey}`,
                      'Content-Type': 'application/json',
                      'HTTP-Referer': 'http://localhost:3000',
                      'X-Title': 'Kali AI Assistant'
                    },
                    body: JSON.stringify({
                      model: model,
                      messages: messages,
                      stream: true,
                      tools: tools && tools.length > 0 ? tools : undefined,
                      parallel_tool_calls: false
                    })
                  });
                  
                  if (loopResponse.ok) {
                    console.log(`✅ Loop break stream started`);
                    const lbReader = loopResponse.body.getReader();
                    let lbBuffer = '';
                    let lbText = '';
                    let lbToolCalls = [];
                    
                    while (true) {
                      const { done, value } = await lbReader.read();
                      if (done) break;
                      
                      lbBuffer += decoder.decode(value, { stream: true });
                      const lbLines = lbBuffer.split('\n');
                      lbBuffer = lbLines.pop() || '';
                      
                      for (const lbLine of lbLines) {
                        if (lbLine.startsWith('data: ')) {
                          const lbData = lbLine.slice(6);
                          if (lbData === '[DONE]') continue;
                          
                          try {
                            const lbParsed = JSON.parse(lbData);
                            const lbDelta = lbParsed.choices?.[0]?.delta;
                            
                            if (lbDelta?.content) {
                              lbText += lbDelta.content;
                              res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: lbDelta.content })}\n`);
                              if (res.flush) res.flush();
                            }
                            
                            if (lbDelta?.tool_calls) {
                              for (const toolCallDelta of lbDelta.tool_calls) {
                                const index = toolCallDelta.index || 0;
                                
                                if (!lbToolCalls[index]) {
                                  lbToolCalls[index] = {
                                    id: toolCallDelta.id || `loop_break_${Date.now()}_${index}`,
                                    type: 'function',
                                    function: {
                                      name: '',
                                      arguments: ''
                                    }
                                  };
                                }
                                
                                if (toolCallDelta.function?.name) {
                                  lbToolCalls[index].function.name += toolCallDelta.function.name;
                                }
                                
                                if (toolCallDelta.function?.arguments) {
                                  lbToolCalls[index].function.arguments += toolCallDelta.function.arguments;
                                }
                              }
                            }
                          } catch (e) {
                            console.error('Failed to parse loop break response:', e);
                          }
                        }
                      }
                    }
                    
                    toolCalls = lbToolCalls.filter(tc => tc && tc.function.name);
                    initialText = lbText;
                    
                    if (toolCalls.length > 0) {
                      console.log(`✅ Loop break generated ${toolCalls.length} tool calls, continuing workflow`);
                      textHistory.length = 0; // Clear text history to prevent false positives
                      continue; // Continue with the new tool calls
                    } else {
                      // Check if AI said "Done"
                      const isDone = /\b(done|complete|finished)\b/i.test(lbText);
                      if (isDone) {
                        console.log(`✅ AI said "Done", task complete`);
                        break;
                      } else {
                        console.log(`⚠️  Loop break did not generate tool calls, but task not done - sending reminder`);
                        messages.push({
                          role: 'user',
                          content: 'Continue with the next action to complete the task. What should you do next?'
                        });
                        // Don't break, continue the loop
                      }
                    }
                  } else {
                    console.error(`❌ Loop break request failed: ${loopResponse.status}`);
                    break;
                  }
                }
              }
            }
          }
          
          // Track this text response
          textHistory.push(initialText || '');
          if (textHistory.length > 5) {
            textHistory.shift(); // Keep only last 5 responses
          }
              
              // CRITICAL: Check if AI signaled completion with "Done"
              // ONLY stop if AI explicitly says "Done" as a standalone word
              const completionIndicators = [
                /\bdone\b/i,
                /\btask.*complete/i,
                /\ball.*done/i,
                /\beverything.*done/i,
                /\bsuccessfully completed/i
              ];
              
              const lowerText = (initialText || '').toLowerCase();
              const hasCompletionIndicator = completionIndicators.some(pattern => pattern.test(lowerText));
              
              // CRITICAL: Only stop if AI said "Done" AND no tool calls were generated
              // If tool calls exist, AI is still working - don't stop!
              if (hasCompletionIndicator && toolCalls.length === 0) {
                console.log(`✅ AI signaled task completion: "${initialText}"`);
                console.log(`   Detected completion indicator with no tool calls, ending workflow`);
                break; // Exit the loop - task is complete
              } else if (hasCompletionIndicator && toolCalls.length > 0) {
                console.log(`ℹ️  AI mentioned completion but generated ${toolCalls.length} tool calls - continuing workflow`);
                // Don't break - AI is still working
              }
              
              // CRITICAL: If we just took a verification screenshot after an action, force continuation
              if (shouldForceContinuationAfterScreenshot) {
                console.log(`⚠️  Verification screenshot taken after action, but AI stopped without continuing`);
                console.log(`   Forcing continuation to complete the workflow`);
                
                // Add a strong continuation prompt
                messages.push({
                  role: 'assistant',
                  content: initialText || 'I can see the current screen.'
                });
                
                messages.push({
                  role: 'system',
                  content: `CRITICAL: You just took a verification screenshot after performing an action.

The user's request has MULTIPLE STEPS. You MUST continue until ALL steps are complete.

WHAT YOU MUST DO NOW:
1. Analyze the current screenshot - did your action succeed?
2. Identify the NEXT step in the workflow
3. Execute that step immediately
4. Continue until the ENTIRE user request is complete

DO NOT:
❌ Stop after taking a screenshot
❌ Generate conversational text without actions
❌ Say "I can see" or "The screen shows" - just ACT

DO:
✅ Execute the next action immediately (click, type, press key)
✅ Continue the workflow step by step
✅ Only say "Done" when ALL steps are complete

NEXT ACTION: Execute the next step of the workflow NOW.`
                });
                
                contextTokenCount += estimateTokens(initialText || 'I can see the current screen.');
                contextTokenCount += estimateTokens(messages[messages.length - 1].content);
                
                // Request continuation
                const verificationContinuationResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'Kali AI Assistant'
                  },
                  body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: true,
                    tools: tools && tools.length > 0 ? tools : undefined,
                    parallel_tool_calls: false
                  }),
                  signal: abortController.signal // Use abort controller
                });
                
                if (verificationContinuationResponse.ok) {
                  console.log(`✅ Verification continuation stream started`);
                  const vcReader = verificationContinuationResponse.body.getReader();
                  let vcBuffer = '';
                  let vcText = '';
                  let vcToolCalls = [];
                  
                  while (true) {
                    const { done, value } = await vcReader.read();
                    if (done) break;
                    
                    vcBuffer += decoder.decode(value, { stream: true });
                    const vcLines = vcBuffer.split('\n');
                    vcBuffer = vcLines.pop() || '';
                    
                    for (const vcLine of vcLines) {
                      if (vcLine.startsWith('data: ')) {
                        const vcData = vcLine.slice(6);
                        if (vcData === '[DONE]') continue;
                        
                        try {
                          const vcParsed = JSON.parse(vcData);
                          const vcDelta = vcParsed.choices?.[0]?.delta;
                          
                          if (vcDelta?.content) {
                            vcText += vcDelta.content;
                            res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: vcDelta.content })}\n`);
                            if (res.flush) res.flush();
                          }
                          
                          if (vcDelta?.tool_calls) {
                            for (const toolCallDelta of vcDelta.tool_calls) {
                              const index = toolCallDelta.index || 0;
                              
                              if (!vcToolCalls[index]) {
                                vcToolCalls[index] = {
                                  id: toolCallDelta.id || `verify_cont_${Date.now()}_${index}`,
                                  type: 'function',
                                  function: {
                                    name: '',
                                    arguments: ''
                                  }
                                };
                              }
                              
                              if (toolCallDelta.function?.name) {
                                vcToolCalls[index].function.name += toolCallDelta.function.name;
                              }
                              
                              if (toolCallDelta.function?.arguments) {
                                vcToolCalls[index].function.arguments += toolCallDelta.function.arguments;
                              }
                            }
                          }
                        } catch (e) {
                          console.error('Failed to parse verification continuation response:', e);
                        }
                      }
                    }
                  }
                  
                  toolCalls = vcToolCalls.filter(tc => tc && tc.function.name);
                  initialText = vcText;
                  
                  if (toolCalls.length > 0) {
                    console.log(`✅ Verification continuation generated ${toolCalls.length} tool calls, continuing workflow`);
                    shouldForceContinuationAfterScreenshot = false; // Clear flag
                  } else {
                    // Check if AI said "Done"
                    const isDone = /\b(done|complete|finished)\b/i.test(vcText);
                    if (isDone) {
                      console.log(`✅ AI said "Done", task complete`);
                      break;
                    } else {
                      console.log(`⚠️  Verification continuation did not generate tool calls, but task not done - sending reminder`);
                      messages.push({
                        role: 'user',
                        content: 'Continue with the next action. What should you do next?'
                      });
                      shouldForceContinuationAfterScreenshot = false;
                      // Don't break, continue the loop
                    }
                  }
                } else {
                  console.error(`❌ Verification continuation request failed: ${verificationContinuationResponse.status}`);
                }
                
                // Continue to next iteration if we got tool calls
                if (toolCalls.length > 0) {
                  continue;
                }
              }
              
              // CRITICAL: If we just reset context and took a screenshot, force continuation
              if (hasResetContext && toolCallHistory.length > 0) {
                console.log(`⚠️  Context was reset and screenshot taken, but AI stopped without continuing workflow`);
                console.log(`   Forcing continuation to complete the user's request`);
                
                // Add a strong continuation prompt
                messages.push({
                  role: 'assistant',
                  content: initialText || 'I can see the current screen.'
                });
                
                messages.push({
                  role: 'system',
                  content: `CRITICAL CONTINUATION REQUIRED!

You just took a screenshot after a context reset. The user's request has MULTIPLE STEPS and is NOT complete yet.

WHAT YOU MUST DO NOW:
1. Analyze the current screenshot
2. Identify the NEXT step in the workflow
3. Execute that step immediately
4. Continue until the ENTIRE user request is complete

DO NOT:
❌ Stop after taking a screenshot
❌ Generate conversational text without actions
❌ Say "I can see" or "The screen shows" - just ACT

DO:
✅ Execute the next action immediately (click, type, press key)
✅ Continue the workflow step by step
✅ Only say "Done" when ALL steps are complete

NEXT ACTION: Execute the next step of the workflow NOW.`
                });
                
                contextTokenCount += estimateTokens(initialText || 'I can see the current screen.');
                contextTokenCount += estimateTokens(messages[messages.length - 1].content);
                
                // Request continuation
                const resetContinuationResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'Kali AI Assistant'
                  },
                  body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: true,
                    tools: tools && tools.length > 0 ? tools : undefined,
                    parallel_tool_calls: false
                  }),
                  signal: abortController.signal // Use abort controller
                });
                
                if (resetContinuationResponse.ok) {
                  console.log(`✅ Reset continuation stream started`);
                  const rcReader = resetContinuationResponse.body.getReader();
                  let rcBuffer = '';
                  let rcText = '';
                  let rcToolCalls = [];
                  
                  while (true) {
                    const { done, value } = await rcReader.read();
                    if (done) break;
                    
                    rcBuffer += decoder.decode(value, { stream: true });
                    const rcLines = rcBuffer.split('\n');
                    rcBuffer = rcLines.pop() || '';
                    
                    for (const rcLine of rcLines) {
                      if (rcLine.startsWith('data: ')) {
                        const rcData = rcLine.slice(6);
                        if (rcData === '[DONE]') continue;
                        
                        try {
                          const rcParsed = JSON.parse(rcData);
                          const rcDelta = rcParsed.choices?.[0]?.delta;
                          
                          if (rcDelta?.content) {
                            rcText += rcDelta.content;
                            res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: rcDelta.content })}\n`);
                            if (res.flush) res.flush();
                          }
                          
                          if (rcDelta?.tool_calls) {
                            for (const toolCallDelta of rcDelta.tool_calls) {
                              const index = toolCallDelta.index || 0;
                              
                              if (!rcToolCalls[index]) {
                                rcToolCalls[index] = {
                                  id: toolCallDelta.id || `reset_cont_${Date.now()}_${index}`,
                                  type: 'function',
                                  function: {
                                    name: '',
                                    arguments: ''
                                  }
                                };
                              }
                              
                              if (toolCallDelta.function?.name) {
                                rcToolCalls[index].function.name += toolCallDelta.function.name;
                              }
                              
                              if (toolCallDelta.function?.arguments) {
                                rcToolCalls[index].function.arguments += toolCallDelta.function.arguments;
                              }
                            }
                          }
                        } catch (e) {
                          console.error('Failed to parse reset continuation response:', e);
                        }
                      }
                    }
                  }
                  
                  toolCalls = rcToolCalls.filter(tc => tc && tc.function.name);
                  initialText = rcText;
                  
                  if (toolCalls.length > 0) {
                    console.log(`✅ Reset continuation generated ${toolCalls.length} tool calls, continuing workflow`);
                    hasResetContext = false; // Clear flag so we don't trigger again
                  } else {
                    // Check if AI said "Done"
                    const isDone = /\b(done|complete|finished)\b/i.test(rcText);
                    if (isDone) {
                      console.log(`✅ AI said "Done", task complete`);
                      break;
                    } else {
                      console.log(`⚠️  Reset continuation did not generate tool calls, but task not done - sending reminder`);
                      messages.push({
                        role: 'user',
                        content: 'Continue with the next action. What should you do next?'
                      });
                      hasResetContext = false;
                      // Don't break, continue the loop
                    }
                  }
                } else {
                  console.error(`❌ Reset continuation request failed: ${resetContinuationResponse.status}`);
                }
                
                // Continue to next iteration if we got tool calls
                if (toolCalls.length > 0) {
                  continue;
                }
              }
              
              // Check if the AI generated text that suggests the task is incomplete
              const taskIncompleteIndicators = [
                "i'll",
                "let me",
                "i will",
                "first",
                "then",
                "next",
                "after that"
              ];
              
              const lowerTextIncomplete = (initialText || '').toLowerCase();
              const hasIncompleteIndicator = taskIncompleteIndicators.some(indicator => lowerTextIncomplete.includes(indicator));
              
              if (hasIncompleteIndicator) {
                console.log(`⚠️  AI generated text suggesting incomplete task: "${initialText}"`);
                console.log(`   Detected indicators: ${taskIncompleteIndicators.filter(i => lowerTextIncomplete.includes(i)).join(', ')}`);
                console.log(`   Sending continuation reminder to complete the workflow`);
                
                // Add a system message to remind AI to continue
                messages.push({
                  role: 'assistant',
                  content: initialText
                });
                
                messages.push({
                  role: 'system',
                  content: `CRITICAL: You just said "${initialText}" but you did NOT generate any tool calls to continue the workflow!

The user's request has MULTIPLE STEPS. You MUST complete ALL steps before saying "Done".

WHAT YOU NEED TO DO NOW:
1. Take a screenshot to see the current state
2. Continue with the NEXT step of the workflow
3. Keep going until the ENTIRE user request is complete

DO NOT:
❌ Stop after one step
❌ Generate conversational text without tool calls
❌ Say "I'll" or "Let me" - just DO IT

DO:
✅ Call windows_take_screenshot NOW
✅ Continue the workflow
✅ Complete ALL steps

NEXT ACTION: Call windows_take_screenshot to continue.`
                });
                
                contextTokenCount += estimateTokens(initialText);
                contextTokenCount += estimateTokens(messages[messages.length - 1].content);
                
                // Request continuation
                const reminderResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'Kali AI Assistant'
                  },
                  body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: true,
                    tools: tools && tools.length > 0 ? tools : undefined,
                    parallel_tool_calls: false
                  })
                });
                
                if (reminderResponse.ok) {
                  console.log(`✅ Reminder continuation stream started`);
                  const remReader = reminderResponse.body.getReader();
                  let remBuffer = '';
                  let remText = '';
                  let remToolCalls = [];
                  
                  while (true) {
                    const { done, value } = await remReader.read();
                    if (done) break;
                    
                    remBuffer += decoder.decode(value, { stream: true });
                    const remLines = remBuffer.split('\n');
                    remBuffer = remLines.pop() || '';
                    
                    for (const remLine of remLines) {
                      if (remLine.startsWith('data: ')) {
                        const remData = remLine.slice(6);
                        if (remData === '[DONE]') continue;
                        
                        try {
                          const remParsed = JSON.parse(remData);
                          const remDelta = remParsed.choices?.[0]?.delta;
                          
                          if (remDelta?.content) {
                            remText += remDelta.content;
                            res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: remDelta.content })}\n`);
                            if (res.flush) res.flush();
                          }
                          
                          if (remDelta?.tool_calls) {
                            for (const toolCallDelta of remDelta.tool_calls) {
                              const index = toolCallDelta.index || 0;
                              
                              if (!remToolCalls[index]) {
                                remToolCalls[index] = {
                                  id: toolCallDelta.id || `reminder_call_${Date.now()}_${index}`,
                                  type: 'function',
                                  function: {
                                    name: '',
                                    arguments: ''
                                  }
                                };
                              }
                              
                              if (toolCallDelta.function?.name) {
                                remToolCalls[index].function.name += toolCallDelta.function.name;
                              }
                              
                              if (toolCallDelta.function?.arguments) {
                                remToolCalls[index].function.arguments += toolCallDelta.function.arguments;
                              }
                            }
                          }
                        } catch (e) {
                          console.error('Failed to parse reminder response:', e);
                        }
                      }
                    }
                  }
                  
                  toolCalls = remToolCalls.filter(tc => tc && tc.function.name);
                  initialText = remText;
                  
                  if (toolCalls.length > 0) {
                    console.log(`✅ Reminder generated ${toolCalls.length} tool calls, continuing workflow`);
                  } else {
                    // Check if AI said "Done"
                    const isDone = /\b(done|complete|finished)\b/i.test(remText);
                    if (isDone) {
                      console.log(`✅ AI said "Done", task complete`);
                      break;
                    } else {
                      console.log(`⚠️  Reminder did not generate tool calls, but task not done - sending another reminder`);
                      messages.push({
                        role: 'user',
                        content: 'Please continue. What is the next action you need to take?'
                      });
                      // Don't break, continue the loop
                    }
                  }
                } else {
                  console.error(`❌ Reminder request failed: ${reminderResponse.status}`);
                }
              }
          } else {
            console.error(`❌ Continuation request failed: ${continuationResponse.status}`);
            toolCalls = []; // Stop on error
          }
        } catch (continuationError) {
          console.error(`❌ Continuation handling error:`, continuationError);
          toolCalls = []; // Stop on error
        }
      } catch (toolError) {
        console.error(`❌ Tool execution error:`, toolError);
        toolCalls = []; // Stop on error
      }
    }
    
    // Workflow complete - AI said "Done" or stopped generating tool calls
    console.log(`✅ Workflow complete after ${toolCallIteration} iterations`);
    
    // Send done message AFTER AI finishes all iterations
    res.write(`0:${JSON.stringify({ type: 'done' })}\n`);
    console.log('✅ Sent done message - AI finished responding');
    
    // Mark stream as complete in health monitor
    streamHealthMonitor.completeStream(streamId);
    
    // Track usage
    try {
      const { userId, sessionId, projectId } = req.body;
      if (usageData && userId) {
        // OpenRouter doesn't provide pricing, so cost is 0
        const cost = 0;
        
        await trackUsage({
          userId,
          modelId: model,
          provider: 'openrouter',
          promptTokens: usageData.prompt_tokens || 0,
          completionTokens: usageData.completion_tokens || 0,
          reasoningTokens: 0,
          totalTokens: usageData.total_tokens || 0,
          cost: cost,
          sessionId: sessionId || null,
          projectId: projectId || null
        });
        console.log(`📊 Usage tracked: ${usageData.total_tokens} tokens`);
      }
    } catch (trackError) {
      console.error('⚠️ Failed to track usage:', trackError);
    }
    
    res.end();
    console.log('✅ Stream ended');

  } catch (error) {
    console.error('❌ OpenRouter error:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Send error message to frontend if headers already sent (streaming started)
    if (res.headersSent) {
      try {
        // Send a simple network error message
        res.write(`0:${JSON.stringify({ 
          type: 'text-delta', 
          textDelta: '\n\nA network error occurred. Please try again.' 
        })}\n`);
        res.write(`0:${JSON.stringify({ type: 'done' })}\n`);
        if (res.flush) res.flush();
      } catch (writeError) {
        console.error('Failed to send error message:', writeError);
      }
    } else {
      // Headers not sent yet, can send JSON error
      res.status(500).json({
        error: 'OpenRouter API error',
        message: error.message
      });
    }
    
    // Check if this was a user cancellation (abort) - not a network error
    if (error.name === 'AbortError' && isUserCancellation) {
      console.log('🛑 Workflow cancelled by user - saving messages before exit');
      
      // Save the accumulated message to database if we have content
      if (initialText && initialText.trim().length > 0) {
        console.log(`💾 Saving ${initialText.length} chars of AI response to database`);
        
        try {
          // Get session and user info from request
          const { sessionId, userId } = req.body;
          
          if (sessionId && userId) {
            // Save assistant message to database
            await sessionManager.addMessage(sessionId, {
              role: 'assistant',
              content: initialText.trim(),
              timestamp: new Date().toISOString(),
              userId: userId
            });
            
            console.log('✅ AI response saved to database');
          } else {
            console.warn('⚠️  Cannot save message - missing sessionId or userId');
          }
        } catch (saveError) {
          console.error('❌ Failed to save message:', saveError.message);
        }
      }
    }
    
    // Terminate stream in health monitor
    if (typeof streamId !== 'undefined') {
      streamHealthMonitor.terminateStream(streamId, (error.name === 'AbortError' && isUserCancellation) ? 'cancelled' : 'error');
    }
    
    // Don't throw - response may have already been sent
    // Just log the error and return
    if (!res.headersSent) {
      res.status(500).json({
        error: 'OpenRouter request failed',
        details: error.message
      });
    } else {
      console.error('❌ Error occurred after headers sent, cannot send error response');
    }
  }
}

/**
 * Handle OpenAI chat requests with streaming and tool calling
 */
async function handleOpenAIChat(req, res, message, history, model, providedApiKey) {
  try {
    // Get user ID from request
    const userId = req.headers['x-user-id'] || req.body.userId;
    
    // Get user's OpenAI API key from database
    const userApiKey = await getUserApiKey(userId, 'openai');
    
    // Use user's key (ignore providedApiKey parameter)
    const apiKey = userApiKey;
    
    if (!apiKey) {
      console.error('❌ OpenAI API key not configured for user:', userId);
      res.status(400).json({ 
        error: 'OpenAI API key not configured',
        message: 'Please add your OpenAI API key in Settings',
        details: 'Get your API key from https://platform.openai.com/api-keys'
      });
      return;
    }

    console.log(`📤 Sending request to OpenAI with model: ${model}`);
    
    // Extract mode, projectId, and sessionId from request (userId already declared above)
    const { mode = 'terminal', projectId, customModeId, sessionId } = req.body;
    console.log(`🎯 Mode: ${mode}, Project ID: ${projectId}, User ID: ${userId}, Session ID: ${sessionId}, Custom Mode ID: ${customModeId || 'none'}`);
    
    // Get project details to determine OS
    let operatingSystem = 'kali-linux';
    if (projectId) {
      try {
        const { data: project, error } = await supabase
          .from('projects')
          .select('operating_system')
          .eq('id', projectId)
          .single();
        
        if (!error && project && project.operating_system) {
          operatingSystem = project.operating_system;
          console.log(`📋 Project OS: ${operatingSystem}`);
        }
      } catch (err) {
        console.warn(`⚠️  Could not fetch project OS: ${err.message}`);
      }
    }

    // Get system prompt
    const baseSystemPrompt = modePrompts.getPromptForMode(mode, operatingSystem, model);
    let systemPrompt = baseSystemPrompt;
    console.log(`📋 Using ${mode} mode prompt for ${operatingSystem}`);
    
    // Check for custom mode
    if (customModeId) {
      try {
        console.log(`🔍 Looking up custom mode: ${customModeId}`);
        const { data: customMode, error } = await supabase
          .from('custom_modes')
          .select('system_prompt, name')
          .eq('id', customModeId)
          .single();
        
        if (!error && customMode && customMode.system_prompt) {
          systemPrompt = `${baseSystemPrompt}

--------------------------------------------------------------------------
📌 CUSTOM MODE: ${customMode.name}
--------------------------------------------------------------------------

${customMode.system_prompt}

--------------------------------------------------------------------------
END OF CUSTOM MODE
--------------------------------------------------------------------------`;
          console.log(`✅ Appended custom mode "${customMode.name}" after base prompt`);
        }
      } catch (err) {
        console.warn(`⚠️  Could not fetch custom mode: ${err.message}`);
      }
    }

    // Get Windows tools if this is a Windows project
    let tools = null;
    let windowsClient = null;
    
    if (operatingSystem === 'windows-11' || operatingSystem === 'windows-10') {
      console.log('🪟 Windows project detected, loading Windows tools...');
      
      try {
        // Get Windows MCP tools (filtered by mode)
        const { getWindowsMCPToolsForGemini } = require('./windows-mcp-tools');
        const windowsTools = getWindowsMCPToolsForGemini(mode);
        console.log(`🔧 Filtered to ${windowsTools.length} tools for ${mode} mode`);
        
        // Convert to OpenAI format
        tools = windowsTools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        }));
        
        console.log(`✅ Loaded ${tools.length} Windows tools for OpenAI`);
        
        // Initialize Windows client
        const MCPClientPool = require('./mcp-client-pool');
        const mcpClientPool = new MCPClientPool({ projectManager });
        
        // Get API keys for this project from database
        const { data: projectKeys, error: keysError } = await supabase
          .from('projects')
          .select('mcp_api_key, api_service_key')
          .eq('id', projectId)
          .single();
        
        if (keysError || !projectKeys) {
          throw new Error(`Failed to fetch API keys: ${keysError?.message || 'Project not found'}`);
        }
        
        windowsClient = await mcpClientPool.getWindowsClient(
          projectId, 
          projectKeys.api_service_key, 
          projectKeys.mcp_api_key
        );
        
        console.log('✅ Windows client initialized');
      } catch (error) {
        console.error('❌ Failed to load Windows tools:', error.message);
      }
    }
    
    // Check if this is a screenshot-only request
    const isScreenshotOnly = /^(take|get|show|capture)\s+(a\s+)?screenshot$/i.test(message.trim());
    
    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: isScreenshotOnly ? `${message}\n\nIMPORTANT: Just take ONE screenshot, describe what you see, then say "Done". Do NOT perform any other actions.` : message }
    ];

    if (isScreenshotOnly) {
      console.log(`📸 Detected screenshot-only request, adding explicit instruction to stop after description`);
    }

    console.log(`📤 Sending request to OpenAI with ${messages.length} messages...`);
    if (tools) {
      console.log(`🔧 Including ${tools.length} tools in request`);
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Register stream with health monitor
    const streamId = `openai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    streamHealthMonitor.registerStream(streamId, res, { 
      provider: 'openai', 
      model, 
      projectId: req.body.projectId 
    });
    
    // Wrap res.write to track activity
    const originalWrite = res.write.bind(res);
    res.write = function(chunk, ...args) {
      streamHealthMonitor.updateActivity(streamId, chunk.length);
      return originalWrite(chunk, ...args);
    };

    // Prepare request body
    const modelName = model.replace('openai/', '');
    
    // Some models don't support temperature or have restrictions
    // o1/o3 series: reasoning models that don't support temperature
    // gpt-5: may have temperature restrictions
    const supportsTemperature = !modelName.startsWith('o1') && 
                                 !modelName.startsWith('o3') && 
                                 !modelName.startsWith('gpt-5');
    
    const requestBody = JSON.stringify({
      model: modelName,
      messages: messages,
      stream: true,
      stream_options: { include_usage: true }, // Request usage data in stream
      ...(supportsTemperature && { temperature: 0.7 }),
      max_completion_tokens: 4096,  // Use max_completion_tokens instead of max_tokens for newer models
      ...(tools && { tools, tool_choice: 'auto' })
    });

    // Make streaming request to OpenAI
    const openaiReq = https.request('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    }, (openaiRes) => {
      if (openaiRes.statusCode !== 200) {
        let errorData = '';
        openaiRes.on('data', chunk => errorData += chunk);
        openaiRes.on('end', () => {
          console.error(`❌ OpenAI API error (${openaiRes.statusCode}):`, errorData);
          if (!res.headersSent) {
            res.status(openaiRes.statusCode).json({
              error: 'OpenAI request failed',
              details: errorData
            });
          }
        });
        return;
      }

      console.log('✅ OpenAI streaming connection established');

      let buffer = '';
      let toolCalls = [];
      let initialText = '';
      let hasPendingToolCalls = false; // Track if we have tool calls being processed
      let usageData = null; // Track usage data from stream
      
      openaiRes.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.trim() === 'data: [DONE]') {
            // Don't handle tool calls here - they're handled by finish_reason
            // Just end the stream if no tool calls are pending
            if (!hasPendingToolCalls) {
              res.write(`0:${JSON.stringify({ type: 'done' })}\n`);
              res.end();
            }
            continue;
          }
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const delta = data.choices?.[0]?.delta;
              
              // Capture usage data if present
              if (data.usage) {
                usageData = data.usage;
                console.log('📊 OpenAI usage data received:', usageData);
              }
              
              // Handle text content
              if (delta?.content) {
                initialText += delta.content;
                console.log(`📝 AI Initial Text: "${delta.content}"`);
                res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: delta.content })}\n`);
              }
              
              // Handle tool calls
              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  if (!toolCalls[toolCall.index]) {
                    toolCalls[toolCall.index] = {
                      id: toolCall.id || '',
                      type: 'function',
                      function: {
                        name: toolCall.function?.name || '',
                        arguments: ''
                      }
                    };
                  }
                  
                  if (toolCall.function?.name) {
                    toolCalls[toolCall.index].function.name = toolCall.function.name;
                  }
                  
                  if (toolCall.function?.arguments) {
                    toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                  }
                  
                  if (toolCall.id) {
                    toolCalls[toolCall.index].id = toolCall.id;
                  }
                }
              }
              
              // Handle finish reason
              if (data.choices?.[0]?.finish_reason === 'tool_calls') {
                // Tool calls complete, execute them with continuation
                if (toolCalls.length > 0 && windowsClient) {
                  // Check if text was generated before tool call (initial call only)
                  // For continuations, the system message will enforce text generation
                  const isInitialCall = messages.length <= 3; // System + history + user message
                  
                  if ((!initialText || initialText.trim().length === 0) && isInitialCall) {
                    console.log(`⚠️ WARNING: AI called tool without generating explanatory text first (initial call)`);
                    console.log(`   Tool: ${toolCalls[0].function.name}`);
                    
                    // Generate helpful text for initial call only
                    const toolName = toolCalls[0].function.name.replace('windows_', '').replace(/_/g, ' ');
                    const helpfulText = `Let me start by ${toolName === 'take screenshot' ? 'taking a screenshot to see the current state' : `using ${toolName}`}.`;
                    console.log(`📝 Generating helpful initial text: "${helpfulText}"`);
                    res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: helpfulText + '\n' })}\n`);
                    if (res.flush) res.flush();
                  }
                  
                  hasPendingToolCalls = true;
                  handleOpenAIToolCalls(toolCalls, windowsClient, res, messages, model, apiKey, tools, projectId, userId, sessionId).then(() => {
                    console.log('✅ Tool calls completed, waiting for stream to flush...');
                    // Wait for all text-delta events to be sent and processed
                    setTimeout(() => {
                      console.log('✅ Stream flushed, sending done event');
                      res.write(`0:${JSON.stringify({ type: 'done' })}\n`);
                      if (res.flush) res.flush();
                      console.log('✅ Done event sent, ending response');
                      streamHealthMonitor.completeStream(streamId);
                      setTimeout(() => res.end(), 100);
                    }, 500);
                  }).catch(err => {
                    console.error('❌ Tool call error:', err);
                    setTimeout(() => {
                      res.write(`0:${JSON.stringify({ type: 'done' })}\n`);
                      if (res.flush) res.flush();
                      streamHealthMonitor.completeStream(streamId);
                      setTimeout(() => res.end(), 100);
                    }, 500);
                  });
                }
              } else if (data.choices?.[0]?.finish_reason) {
                // Don't send done yet - need to check for text-based tool calls first
                console.log(`✅ Stream finished with reason: ${data.choices[0].finish_reason}`);
                // The done message will be sent after checking for text-based tool calls
              }
            } catch (e) {
              console.error('Error parsing OpenAI stream:', e.message);
            }
          }
        }
      });

      openaiRes.on('end', () => {
        console.log('✅ OpenAI stream completed');
        
        // Track usage if available
        if (usageData && userId) {
          console.log(`📊 Tracking usage for model: ${model}`);
          
          // Calculate cost based on OpenAI pricing
          let cost = 0;
          const { customCostPerToken } = req.body;
          
          if (customCostPerToken) {
            // Use custom cost per token
            cost = calculateCost(
              usageData.prompt_tokens || 0,
              usageData.completion_tokens || 0,
              null,
              usageData.completion_tokens_details?.reasoning_tokens || 0,
              customCostPerToken
            );
            console.log(`💰 Cost calculated using custom pricing: $${cost.toFixed(6)}`);
          } else {
            // Use default OpenAI pricing
            const pricing = getOpenAIPricing(model);
            if (pricing) {
              cost = calculateCost(
                usageData.prompt_tokens || 0,
                usageData.completion_tokens || 0,
                pricing,
                usageData.completion_tokens_details?.reasoning_tokens || 0
              );
            }
          }
          
          trackUsage({
            userId,
            modelId: model,
            provider: 'openai',
            promptTokens: usageData.prompt_tokens || 0,
            completionTokens: usageData.completion_tokens || 0,
            reasoningTokens: usageData.completion_tokens_details?.reasoning_tokens || 0,
            totalTokens: usageData.total_tokens || 0,
            cost: cost,
            sessionId: sessionId || null,
            projectId: projectId || null
          }).then(() => {
            console.log(`📊 OpenAI usage tracked: ${usageData.total_tokens} tokens, $${cost.toFixed(6)}`);
          }).catch(trackError => {
            console.error('⚠️ Failed to track OpenAI usage:', trackError);
          });
        } else {
          console.warn(`⚠️ Cannot track OpenAI usage: usageData=${!!usageData}, userId=${userId}`);
        }
        
        // Only end the response if there are no pending tool calls
        // If there are tool calls, they will end the response when done
        if (!res.writableEnded && !hasPendingToolCalls) {
          console.log('✅ No pending tool calls, ending response');
          res.end();
        } else if (hasPendingToolCalls) {
          console.log('⏳ Waiting for tool calls to complete before ending response');
        }
      });

      openaiRes.on('error', (error) => {
        console.error('❌ OpenAI stream error:', error);
        streamHealthMonitor.terminateStream(streamId, 'stream_error');
        if (!res.headersSent) {
          res.status(500).json({
            error: 'OpenAI streaming failed',
            details: error.message
          });
        }
      });
    });

    openaiReq.on('error', (error) => {
      console.error('❌ OpenAI request error:', error);
      streamHealthMonitor.terminateStream(streamId, 'request_error');
      if (!res.headersSent) {
        res.status(500).json({
          error: 'OpenAI request failed',
          details: error.message
        });
      }
    });

    openaiReq.write(requestBody);
    openaiReq.end();

  } catch (error) {
    console.error('❌ OpenAI error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'OpenAI request failed',
        details: error.message
      });
    }
  }
}

/**
 * Handle OpenAI tool calls with continuation (matching OpenRouter)
 */
async function handleOpenAIToolCalls(toolCalls, windowsClient, res, messages, model, apiKey, tools, projectId, userId, sessionId) {
  console.log(`🔧 Executing ${toolCalls.length} tool calls...`);
  
  // Process only the first tool call
  const toolCall = toolCalls[0];
  
  try {
    const functionName = toolCall.function.name;
    const functionArgs = JSON.parse(toolCall.function.arguments);
    
    console.log(`🔧 Executing tool: ${functionName}`, functionArgs);
    
    // Send tool-call-start event (matching OpenRouter format)
    console.log(`📤 Sending tool-call-start event`);
    res.write(`0:${JSON.stringify({
      type: 'tool-call-start',
      toolCallId: toolCall.id,
      toolName: functionName,
      args: functionArgs
    })}\n`);
    if (res.flush) res.flush();
    console.log(`✅ tool-call-start sent`);
    
    // Small delay to ensure event is processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Execute the tool using executeTool
    // Remove 'windows_' prefix if present since executeTool expects the short name
    const toolName = functionName.replace('windows_', '');
    const startTime = Date.now();
    
    console.log(`🔧 Calling windowsClient.executeTool...`);
    const result = await windowsClient.executeTool(toolName, functionArgs);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Tool ${functionName} executed successfully`);
    console.log(`📊 Result:`, { success: result.success, hasMessage: !!result.message });
    
    // Send tool output (matching OpenRouter format)
    // For screenshots, don't send the huge base64 data in the output
    let toolOutput = result.output || 'Tool executed successfully';
    if (toolName === 'take_screenshot' && result.message) {
      toolOutput = 'Screenshot captured successfully';
    }
    
    console.log(`📤 Sending desktop-tool-output event`);
    res.write(`0:${JSON.stringify({
      type: 'desktop-tool-output',
      toolCallId: toolCall.id,
      toolName: functionName,
      args: functionArgs,
      output: toolOutput,
      status: result.success ? 'success' : 'error',
      duration: duration
    })}\n`);
    if (res.flush) res.flush();
    console.log(`✅ desktop-tool-output sent`);
    
    // Handle screenshot data (matching OpenRouter)
    // Check for imageData in result.message (new format) or result.imageData (old format)
    const imageData = result.message || result.imageData;
    if (toolName === 'take_screenshot' && imageData) {
      console.log(`📤 Sending screenshot-data event`);
      const screenshotId = `screenshot_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      // Cache screenshot data
      if (global.screenshotCache) {
        global.screenshotCache.set(screenshotId, {
          imageData: imageData,
          screenData: result.screenData,
          timestamp: new Date()
        });
      }
      
      res.write(`0:${JSON.stringify({
        type: 'screenshot-data',
        screenshotId: screenshotId,
        hasImageData: true,
        hasScreenData: !!result.screenData,
        imageDataLength: imageData?.length || 0,
        timestamp: new Date().toISOString()
      })}\n`);
      if (res.flush) res.flush();
      console.log(`✅ screenshot-data sent`);
    }
    
    console.log(`✅ Tool execution complete, requesting continuation for analysis...`);
    
    // Format screen data as readable text for screenshots
    let screenDataText = '';
    if (toolName === 'take_screenshot' && result.windowsAPI) {
      const windowsAPI = result.windowsAPI;
      const ocr = result.ocr;
      const size = result.size;
      const mousePos = result.mousePosition;
      
      // IMPORTANT: Use ui_elements which includes desktop icons
      let allElements = result.ui_elements || result.uiElements || windowsAPI.elements || [];
      
      // 🚨 FILTER OUT SEARCH BAR UI ELEMENTS - Force AI to use OCR TEXT only for website searches
      // Remove UI elements with "Search" in name that are ComboBox, Button, or Edit (y > 100 and y < 1000)
      // This forces the AI to click on OCR TEXT coordinates, not UI element boundaries
      allElements = allElements.filter(el => {
        const isSearchElement = el.name && el.name.toLowerCase().includes('search');
        const isWebsiteArea = el.y > 100 && el.y < 1000;
        const isInputType = ['ComboBox', 'Button', 'Edit', 'Text'].includes(el.type || el.control_type_name);
        
        // Keep element if it's NOT a search input in website area
        // Remove search UI elements in website area to force OCR TEXT usage
        if (isSearchElement && isWebsiteArea && isInputType) {
          console.log(`🚫 Filtered out search UI element: ${el.name} at (${el.x}, ${el.y}) - forcing OCR TEXT usage`);
          return false; // Remove this element
        }
        return true; // Keep this element
      });
      
      screenDataText = `\n\n📊 COMPLETE SCREENSHOT DATA (READ EVERYTHING CAREFULLY):

🖥️ SCREEN INFORMATION:
- Resolution: ${size?.width || 0}x${size?.height || 0}
- Mouse Position: (${mousePos?.x || 0}, ${mousePos?.y || 0})

🪟 ALL UI ELEMENTS (${allElements.length} total - INCLUDING DESKTOP ICONS):`;
      
      if (allElements.length > 0) {
        allElements.forEach((el, idx) => {
          const elType = el.type || el.control_type_name || 'Unknown';
          screenDataText += `\n${idx + 1}. [${elType}] "${el.name || 'Unknown'}"`;
          screenDataText += `\n   Position: (${el.x}, ${el.y}) Center: (${el.center_x}, ${el.center_y})`;
          screenDataText += `\n   Size: ${el.width}x${el.height}`;
          if (el.isMaximized !== undefined) screenDataText += `\n   Maximized: ${el.isMaximized}`;
          if (el.isMinimized !== undefined) screenDataText += `\n   Minimized: ${el.isMinimized}`;
          if (el.hasCloseButton !== undefined) screenDataText += `\n   Has Close Button: ${el.hasCloseButton}`;
          if (el.hasMaximizeButton !== undefined) screenDataText += `\n   Has Maximize Button: ${el.hasMaximizeButton}`;
          if (el.hasMinimizeButton !== undefined) screenDataText += `\n   Has Minimize Button: ${el.hasMinimizeButton}`;
        });
      } else {
        screenDataText += '\n(No UI elements found)';
      }
      
      const ocrElements = ocr?.textElements || ocr?.detectedElements || [];
      screenDataText += `\n\n📝 ALL OCR TEXT ELEMENTS (${ocrElements.length} total):`;
      if (ocrElements.length > 0) {
        ocrElements.forEach((text, idx) => {
          screenDataText += `\n${idx + 1}. "${text.text}"`;
          const x = text.x !== undefined ? text.x : text.position?.x;
          const y = text.y !== undefined ? text.y : text.position?.y;
          const width = text.width !== undefined ? text.width : text.size?.width;
          const height = text.height !== undefined ? text.height : text.size?.height;
          const centerX = text.center_x !== undefined ? text.center_x : text.center?.x;
          const centerY = text.center_y !== undefined ? text.center_y : text.center?.y;
          
          screenDataText += `\n   Position: (${x}, ${y})`;
          screenDataText += `\n   Size: ${width}x${height}`;
          screenDataText += `\n   Center: (${centerX}, ${centerY})`;
          if (text.confidence !== undefined) screenDataText += `\n   Confidence: ${(text.confidence * 100).toFixed(0)}%`;
        });
      } else {
        screenDataText += '\n(No text detected)';
      }
      
      screenDataText += `\n\n🎯 SUMMARY BY TYPE:`;
      if (allElements.length > 0) {
        const types = {};
        allElements.forEach(el => {
          const elType = el.type || el.control_type_name || 'Unknown';
          types[elType] = (types[elType] || 0) + 1;
        });
        Object.entries(types).forEach(([type, count]) => {
          screenDataText += `\n- ${type}: ${count}`;
        });
      }
      
      console.log(`📊 Formatted COMPLETE screen data for AI (${screenDataText.length} chars)`);
    }
    
    // Build continuation messages with tool result
    const continuationMessages = [
      ...messages,
      {
        role: 'assistant',
        content: null,
        tool_calls: [toolCall]
      },
      {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: toolName === 'take_screenshot' && screenDataText 
          ? screenDataText
          : JSON.stringify({
              success: result.success,
              message: result.output || result.message || 'Tool executed successfully'
            })
      }
    ];
    
    // For OpenAI models after screenshots, add a system reminder to describe what they see
    const isOpenAI = model.toLowerCase().includes('gpt');
    const isAfterScreenshot = toolName === 'take_screenshot';
    
    if (isOpenAI && isAfterScreenshot) {
      continuationMessages.push({
        role: 'system',
        content: 'IMPORTANT: You just received screenshot data. Your next response MUST start with text describing what you see (windows, buttons, coordinates, text) before calling any tool. Do not skip this step.'
      });
    }
    
    console.log(`📤 Requesting AI continuation with tool result...`);
    
    // Make continuation request to OpenAI
    return await makeOpenAIContinuationRequest(
      continuationMessages,
      model,
      apiKey,
      tools,
      res,
      windowsClient,
      projectId,
      userId,
      sessionId
    );
    
  } catch (error) {
    console.error(`❌ Tool call failed:`, error);
    res.write(`0:${JSON.stringify({ 
      type: 'text-delta', 
      textDelta: `\n\n**Tool Error:** ${error.message}\n\n` 
    })}\n`);
    return { toolCalls: [], initialText: '' };
  }
}

/**
 * Make continuation request to OpenAI (recursive for multi-step workflows)
 */
async function makeOpenAIContinuationRequest(messages, model, apiKey, tools, res, windowsClient, projectId, userId, sessionId, iteration = 1) {
  const maxIterations = 100;
  
  if (iteration > maxIterations) {
    console.log(`⚠️ Max iterations (${maxIterations}) reached, stopping`);
    return { toolCalls: [], initialText: '' };
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔄 Continuation Iteration ${iteration}/${maxIterations}`);
  console.log(`${'='.repeat(80)}\n`);
  
  return new Promise((resolve, reject) => {
    const modelName = model.replace('openai/', '');
    
    // Some models don't support temperature or have restrictions
    // o1/o3 series: reasoning models that don't support temperature
    // gpt-5: may have temperature restrictions
    const supportsTemperature = !modelName.startsWith('o1') && 
                                 !modelName.startsWith('o3') && 
                                 !modelName.startsWith('gpt-5');
    
    const requestBody = JSON.stringify({
      model: modelName,
      messages: messages,
      stream: true,
      stream_options: { include_usage: true }, // Request usage data in stream
      ...(supportsTemperature && { temperature: 0.7 }),
      max_completion_tokens: 4096,
      ...(tools && { tools, tool_choice: 'auto' })
    });
    
    const openaiReq = https.request('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    }, (openaiRes) => {
      if (openaiRes.statusCode !== 200) {
        let errorData = '';
        openaiRes.on('data', chunk => errorData += chunk);
        openaiRes.on('end', () => {
          console.error(`❌ OpenAI continuation error (${openaiRes.statusCode}):`, errorData);
          resolve({ toolCalls: [], initialText: '' });
        });
        return;
      }
      
      console.log('✅ OpenAI continuation stream established');
      
      let buffer = '';
      let toolCalls = [];
      let initialText = '';
      let usageData = null; // Track usage data from stream
      
      openaiRes.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.trim() === 'data: [DONE]') {
            console.log('✅ Continuation stream [DONE]');
            continue;
          }
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const delta = data.choices?.[0]?.delta;
              
              // Capture usage data if present
              if (data.usage) {
                usageData = data.usage;
                console.log('📊 OpenAI continuation usage data received:', usageData);
              }
              
              // Handle text content
              if (delta?.content) {
                initialText += delta.content;
                console.log(`📝 AI Response: "${delta.content}"`);
                res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: delta.content })}\n`);
              }
              
              // Handle tool calls
              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  if (!toolCalls[toolCall.index]) {
                    toolCalls[toolCall.index] = {
                      id: toolCall.id || '',
                      type: 'function',
                      function: {
                        name: toolCall.function?.name || '',
                        arguments: ''
                      }
                    };
                  }
                  
                  if (toolCall.function?.name) {
                    toolCalls[toolCall.index].function.name = toolCall.function.name;
                  }
                  
                  if (toolCall.function?.arguments) {
                    toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                  }
                  
                  if (toolCall.id) {
                    toolCalls[toolCall.index].id = toolCall.id;
                  }
                }
              }
            } catch (e) {
              console.error('Error parsing continuation stream:', e.message);
            }
          }
        }
      });
      
      openaiRes.on('end', async () => {
        console.log(`✅ Continuation complete: ${initialText.length} chars, ${toolCalls.length} tool calls`);
        
        // Track usage if available
        if (usageData && userId) {
          try {
            // Get model pricing
            let cost = 0;
            const { customCostPerToken } = req.body;
            
            if (customCostPerToken) {
              // Use custom cost per token
              cost = calculateCost(
                usageData.prompt_tokens || 0,
                usageData.completion_tokens || 0,
                null,
                usageData.completion_tokens_details?.reasoning_tokens || 0,
                customCostPerToken
              );
              console.log(`💰 Continuation cost calculated using custom pricing: $${cost.toFixed(6)}`);
            } else {
              // Use default OpenAI pricing
              const pricing = getOpenAIPricing(model);
              if (pricing) {
                cost = calculateCost(
                  usageData.prompt_tokens || 0,
                  usageData.completion_tokens || 0,
                  pricing,
                  usageData.completion_tokens_details?.reasoning_tokens || 0
                );
              }
            }
            
            await trackUsage({
              userId,
              modelId: model,
              provider: 'openai',
              promptTokens: usageData.prompt_tokens || 0,
              completionTokens: usageData.completion_tokens || 0,
              reasoningTokens: usageData.completion_tokens_details?.reasoning_tokens || 0,
              totalTokens: usageData.total_tokens || 0,
              cost: cost,
              sessionId: sessionId || null,
              projectId: projectId || null
            });
            console.log(`📊 OpenAI continuation usage tracked: ${usageData.total_tokens} tokens, $${cost.toFixed(6)}`);
          } catch (trackError) {
            console.error('⚠️ Failed to track OpenAI continuation usage:', trackError);
          }
        } else {
          console.warn(`⚠️ Cannot track OpenAI continuation usage: usageData=${!!usageData}, userId=${userId}`);
        }
        
        // Check for text-based tool calls in continuation text
        if (toolCalls.length === 0 && initialText) {
          const { extractToolCall, normalizeToolName } = require('./text-tool-call-parser');
          const toolCallMatch = extractToolCall(initialText);
          
          if (toolCallMatch) {
            console.log(`🔍 DETECTED TEXT-BASED TOOL CALL IN CONTINUATION: ${toolCallMatch.functionName}`);
            console.log(`   Args:`, toolCallMatch.args);
            
            const normalizedName = normalizeToolName(toolCallMatch.functionName);
            
            // Check if this is explicit syntax (should be hidden) or natural language (should be kept)
            const explicitSyntaxPattern = /\[Calls?:\s*([a-zA-Z_][a-zA-Z0-9_]*)\((\{[^}]*\}|[^)]*)\)\]/i;
            const isExplicitSyntax = explicitSyntaxPattern.test(toolCallMatch.fullMatch);
            
            if (isExplicitSyntax) {
              console.log(`📤 Sending text-replace event to hide explicit syntax`);
              const cleanedText = toolCallMatch.textBefore + (toolCallMatch.textAfter ? ' ' + toolCallMatch.textAfter : '');
              res.write(`0:${JSON.stringify({ 
                type: 'text-replace', 
                text: cleanedText 
              })}\n`);
              initialText = cleanedText;
            }
            
            // Convert text-based tool call to structured format
            toolCalls.push({
              id: `text_call_${iteration}_${Date.now()}`,
              type: 'function',
              function: {
                name: normalizedName,
                arguments: JSON.stringify(toolCallMatch.args)
              },
              _fromText: true,
              _textBefore: toolCallMatch.textBefore,
              _textAfter: toolCallMatch.textAfter
            });
            
            console.log(`✅ Converted continuation text tool call to structured format: ${normalizedName}`);
          }
        }
        
        // If there are more tool calls, execute them recursively
        if (toolCalls.length > 0 && windowsClient) {
          console.log(`🔄 AI wants to make ${toolCalls.length} more tool calls, continuing...`);
          
          // Execute the next tool call
          const nextResult = await handleOpenAIToolCalls(
            toolCalls,
            windowsClient,
            res,
            messages,
            model,
            apiKey,
            tools,
            projectId,
            userId,
            sessionId
          );
          
          resolve(nextResult);
        } else {
          console.log(`✅ No more tool calls, AI is done`);
          resolve({ toolCalls: [], initialText });
        }
      });
      
      openaiRes.on('error', (error) => {
        console.error('❌ Continuation stream error:', error);
        resolve({ toolCalls: [], initialText: '' });
      });
    });
    
    openaiReq.on('error', (error) => {
      console.error('❌ Continuation request error:', error);
      resolve({ toolCalls: [], initialText: '' });
    });
    
    openaiReq.write(requestBody);
    openaiReq.end();
  });
}

/**
 * Handle Anthropic chat requests with streaming and tool calling
 */
async function handleAnthropicChat(req, res, message, history, model, providedApiKey) {
  try {
    // Get user ID from request
    const userId = req.headers['x-user-id'] || req.body.userId;
    
    // Get user's Anthropic API key from database
    const userApiKey = await getUserApiKey(userId, 'anthropic');
    
    // Use user's key (ignore providedApiKey parameter)
    const apiKey = userApiKey;
    
    if (!apiKey) {
      console.error('❌ Anthropic API key not configured for user:', userId);
      res.status(400).json({ 
        error: 'Anthropic API key not configured',
        message: 'Please add your Anthropic API key in Settings',
        details: 'Get your API key from https://console.anthropic.com/'
      });
      return;
    }

    console.log(`📤 Sending request to Anthropic with model: ${model}`);
    
    // Extract mode and projectId from request
    const { mode = 'terminal', projectId, customModeId } = req.body;
    console.log(`🎯 Mode: ${mode}, Project ID: ${projectId}, Custom Mode ID: ${customModeId || 'none'}`);
    
    // Get project details to determine OS
    let operatingSystem = 'kali-linux';
    if (projectId) {
      try {
        const { data: project, error } = await supabase
          .from('projects')
          .select('operating_system')
          .eq('id', projectId)
          .single();
        
        if (!error && project && project.operating_system) {
          operatingSystem = project.operating_system;
          console.log(`📋 Project OS: ${operatingSystem}`);
        }
      } catch (err) {
        console.warn(`⚠️  Could not fetch project OS: ${err.message}`);
      }
    }

    // Get system prompt
    const baseSystemPrompt = modePrompts.getPromptForMode(mode, operatingSystem, model);
    let systemPrompt = baseSystemPrompt;
    console.log(`📋 Using ${mode} mode prompt for ${operatingSystem}`);
    
    // Check for custom mode
    if (customModeId) {
      try {
        console.log(`🔍 Looking up custom mode: ${customModeId}`);
        const { data: customMode, error } = await supabase
          .from('custom_modes')
          .select('system_prompt, name')
          .eq('id', customModeId)
          .single();
        
        if (!error && customMode && customMode.system_prompt) {
          systemPrompt = `${baseSystemPrompt}

--------------------------------------------------------------------------
📌 CUSTOM MODE: ${customMode.name}
--------------------------------------------------------------------------

${customMode.system_prompt}

--------------------------------------------------------------------------
END OF CUSTOM MODE
--------------------------------------------------------------------------`;
          console.log(`✅ Appended custom mode "${customMode.name}" after base prompt`);
        }
      } catch (err) {
        console.warn(`⚠️  Could not fetch custom mode: ${err.message}`);
      }
    }

    // Get Windows tools if this is a Windows project
    let tools = null;
    let windowsClient = null;
    
    if (operatingSystem === 'windows-11' || operatingSystem === 'windows-10') {
      console.log('🪟 Windows project detected, loading Windows tools...');
      
      try {
        // Get Windows MCP tools (filtered by mode)
        const { getWindowsMCPToolsForGemini } = require('./windows-mcp-tools');
        const windowsTools = getWindowsMCPToolsForGemini(mode);
        console.log(`🔧 Filtered to ${windowsTools.length} tools for ${mode} mode`);
        
        // Convert to Anthropic format
        tools = windowsTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters
        }));
        
        console.log(`✅ Loaded ${tools.length} Windows tools for Anthropic`);
        
        // Initialize Windows client
        const MCPClientPool = require('./mcp-client-pool');
        const mcpClientPool = new MCPClientPool({ projectManager });
        
        // Get API keys for this project from database
        const { data: projectKeys, error: keysError } = await supabase
          .from('projects')
          .select('mcp_api_key, api_service_key')
          .eq('id', projectId)
          .single();
        
        if (keysError || !projectKeys) {
          throw new Error(`Failed to fetch API keys: ${keysError?.message || 'Project not found'}`);
        }
        
        windowsClient = await mcpClientPool.getWindowsClient(
          projectId, 
          projectKeys.api_service_key, 
          projectKeys.mcp_api_key
        );
        
        console.log('✅ Windows client initialized');
      } catch (error) {
        console.error('❌ Failed to load Windows tools:', error.message);
      }
    }
    
    // Build messages array (Anthropic format)
    const messages = history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    messages.push({ role: 'user', content: message });

    console.log(`📤 Sending request to Anthropic with ${messages.length} messages...`);
    if (tools) {
      console.log(`🔧 Including ${tools.length} tools in request`);
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Register stream with health monitor
    const streamId = `anthropic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    streamHealthMonitor.registerStream(streamId, res, { 
      provider: 'anthropic', 
      model, 
      projectId: req.body.projectId 
    });
    
    // Wrap res.write to track activity
    const originalWrite = res.write.bind(res);
    res.write = function(chunk, ...args) {
      streamHealthMonitor.updateActivity(streamId, chunk.length);
      return originalWrite(chunk, ...args);
    };

    // Prepare request body
    const modelName = model.replace('anthropic/', '');
    
    const requestBody = JSON.stringify({
      model: modelName,
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages,
      stream: true,
      ...(tools && { tools })
    });

    // Make streaming request to Anthropic
    const anthropicReq = https.request('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    }, (anthropicRes) => {
      if (anthropicRes.statusCode !== 200) {
        let errorData = '';
        anthropicRes.on('data', chunk => errorData += chunk);
        anthropicRes.on('end', () => {
          console.error(`❌ Anthropic API error (${anthropicRes.statusCode}):`, errorData);
          if (!res.headersSent) {
            res.status(anthropicRes.statusCode).json({
              error: 'Anthropic request failed',
              details: errorData
            });
          }
        });
        return;
      }

      console.log('✅ Anthropic streaming connection established');

      let buffer = '';
      let toolUse = null;
      let initialText = '';
      let hasPendingToolCalls = false;
      
      anthropicRes.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('event: ')) continue; // Skip event type lines
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              // Handle different event types
              if (data.type === 'content_block_start') {
                if (data.content_block?.type === 'tool_use') {
                  toolUse = {
                    id: data.content_block.id,
                    name: data.content_block.name,
                    input: ''
                  };
                  console.log(`🔧 Tool use started: ${toolUse.name}`);
                }
              } else if (data.type === 'content_block_delta') {
                if (data.delta?.type === 'text_delta') {
                  const text = data.delta.text;
                  initialText += text;
                  console.log(`📝 AI Text: "${text}"`);
                  res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: text })}\n`);
                } else if (data.delta?.type === 'input_json_delta') {
                  if (toolUse) {
                    toolUse.input += data.delta.partial_json;
                  }
                }
              } else if (data.type === 'content_block_stop') {
                if (toolUse && toolUse.input) {
                  console.log(`✅ Tool use complete: ${toolUse.name}`);
                  console.log(`   Input: ${toolUse.input}`);
                }
              } else if (data.type === 'message_delta') {
                if (data.delta?.stop_reason === 'tool_use') {
                  // Tool calls complete, execute them with continuation
                  if (toolUse && windowsClient) {
                    // Check if text was generated before tool call
                    if (!initialText || initialText.trim().length === 0) {
                      console.log(`⚠️ WARNING: AI called tool without generating explanatory text first`);
                      console.log(`   Tool: ${toolUse.name}`);
                    }
                    
                    hasPendingToolCalls = true;
                    handleAnthropicToolCalls([toolUse], windowsClient, res, messages, systemPrompt, model, apiKey, tools, projectId).then(() => {
                      console.log('✅ Tool calls completed, waiting for stream to flush...');
                      setTimeout(() => {
                        console.log('✅ Stream flushed, sending done event');
                        res.write(`0:${JSON.stringify({ type: 'done' })}\n`);
                        if (res.flush) res.flush();
                        console.log('✅ Done event sent, ending response');
                        streamHealthMonitor.completeStream(streamId);
                        setTimeout(() => res.end(), 100);
                      }, 500);
                    }).catch(err => {
                      console.error('❌ Tool call error:', err);
                      setTimeout(() => {
                        res.write(`0:${JSON.stringify({ type: 'done' })}\n`);
                        if (res.flush) res.flush();
                        streamHealthMonitor.completeStream(streamId);
                        setTimeout(() => res.end(), 100);
                      }, 500);
                    });
                  }
                } else if (data.delta?.stop_reason) {
                  // No tool calls, just send done
                  res.write(`0:${JSON.stringify({ type: 'done' })}\n`);
                  streamHealthMonitor.completeStream(streamId);
                }
              }
            } catch (e) {
              console.error('Error parsing Anthropic stream:', e.message);
            }
          }
        }
      });

      anthropicRes.on('end', () => {
        console.log('✅ Anthropic stream completed');
        if (!res.writableEnded && !hasPendingToolCalls) {
          console.log('✅ No pending tool calls, ending response');
          res.end();
        } else if (hasPendingToolCalls) {
          console.log('⏳ Waiting for tool calls to complete before ending response');
        }
      });

      anthropicRes.on('error', (error) => {
        console.error('❌ Anthropic stream error:', error);
        streamHealthMonitor.terminateStream(streamId, 'stream_error');
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Anthropic stream error',
            details: error.message
          });
        }
      });
    });

    anthropicReq.on('error', (error) => {
      console.error('❌ Anthropic request error:', error);
      streamHealthMonitor.terminateStream(streamId, 'request_error');
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Anthropic request failed',
          details: error.message
        });
      }
    });

    anthropicReq.write(requestBody);
    anthropicReq.end();

  } catch (error) {
    console.error('❌ Anthropic error:', error);
    if (typeof streamId !== 'undefined') {
      streamHealthMonitor.terminateStream(streamId, 'error');
    }
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Anthropic request failed',
        details: error.message
      });
    }
  }
}

/**
 * Handle Anthropic tool calls with continuation
 */
async function handleAnthropicToolCalls(toolUses, windowsClient, res, messages, systemPrompt, model, apiKey, tools, projectId) {
  console.log(`🔧 Executing ${toolUses.length} tool calls...`);
  
  // Process only the first tool call
  const toolUse = toolUses[0];
  
  try {
    const functionName = toolUse.name;
    const functionArgs = JSON.parse(toolUse.input);
    
    console.log(`🔧 Executing tool: ${functionName}`, functionArgs);
    
    // Send tool-call-start event
    console.log(`📤 Sending tool-call-start event`);
    res.write(`0:${JSON.stringify({
      type: 'tool-call-start',
      toolCallId: toolUse.id,
      toolName: functionName,
      args: functionArgs
    })}\n`);
    if (res.flush) res.flush();
    console.log(`✅ tool-call-start sent`);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Execute the tool
    const toolName = functionName.replace('windows_', '');
    const startTime = Date.now();
    
    console.log(`🔧 Calling windowsClient.executeTool...`);
    const result = await windowsClient.executeTool(toolName, functionArgs);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Tool ${functionName} executed successfully`);
    
    // Send tool output
    let toolOutput = result.output || 'Tool executed successfully';
    if (toolName === 'take_screenshot' && result.message) {
      toolOutput = 'Screenshot captured successfully';
    }
    
    console.log(`📤 Sending desktop-tool-output event`);
    res.write(`0:${JSON.stringify({
      type: 'desktop-tool-output',
      toolCallId: toolUse.id,
      toolName: functionName,
      args: functionArgs,
      output: toolOutput,
      status: result.success ? 'success' : 'error',
      duration: duration
    })}\n`);
    if (res.flush) res.flush();
    
    // Handle screenshot data
    const imageData = result.message || result.imageData;
    if (toolName === 'take_screenshot' && imageData) {
      console.log(`📤 Sending screenshot-data event`);
      const screenshotId = `screenshot_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      if (global.screenshotCache) {
        global.screenshotCache.set(screenshotId, {
          imageData: imageData,
          screenData: result.screenData,
          timestamp: new Date()
        });
      }
      
      res.write(`0:${JSON.stringify({
        type: 'screenshot-data',
        screenshotId: screenshotId,
        hasImageData: true,
        hasScreenData: !!result.screenData,
        imageDataLength: imageData?.length || 0,
        timestamp: new Date().toISOString()
      })}\n`);
      if (res.flush) res.flush();
    }
    
    console.log(`✅ Tool execution complete, requesting continuation...`);
    
    // Format screen data for screenshots
    let toolResultContent = '';
    if (toolName === 'take_screenshot' && result.windowsAPI) {
      const windowsAPI = result.windowsAPI;
      const ocr = result.ocr;
      const size = result.size;
      const mousePos = result.mousePosition;
      
      // IMPORTANT: Use ui_elements which includes desktop icons
      let allElements = result.ui_elements || result.uiElements || windowsAPI.elements || [];
      
      // 🚨 FILTER OUT SEARCH BAR UI ELEMENTS - Force AI to use OCR TEXT only for website searches
      // Remove UI elements with "Search" in name that are ComboBox, Button, or Edit (y > 100 and y < 1000)
      // This forces the AI to click on OCR TEXT coordinates, not UI element boundaries
      allElements = allElements.filter(el => {
        const isSearchElement = el.name && el.name.toLowerCase().includes('search');
        const isWebsiteArea = el.y > 100 && el.y < 1000;
        const isInputType = ['ComboBox', 'Button', 'Edit', 'Text'].includes(el.type || el.control_type_name);
        
        // Keep element if it's NOT a search input in website area
        // Remove search UI elements in website area to force OCR TEXT usage
        if (isSearchElement && isWebsiteArea && isInputType) {
          console.log(`🚫 Filtered out search UI element: ${el.name} at (${el.x}, ${el.y}) - forcing OCR TEXT usage`);
          return false; // Remove this element
        }
        return true; // Keep this element
      });
      
      toolResultContent = `\n\n📊 COMPLETE SCREENSHOT DATA:

🖥️ SCREEN: ${size?.width || 0}x${size?.height || 0}
🖱️ MOUSE: (${mousePos?.x || 0}, ${mousePos?.y || 0})

🪟 UI ELEMENTS (${allElements.length} - INCLUDING DESKTOP ICONS):`;
      
      if (allElements.length > 0) {
        allElements.forEach((el, idx) => {
          const elType = el.type || el.control_type_name || 'Unknown';
          toolResultContent += `\n${idx + 1}. [${elType}] "${el.name || 'Unknown'}"`;
          toolResultContent += `\n   Position: (${el.x}, ${el.y}) Center: (${el.center_x}, ${el.center_y})`;
          toolResultContent += `\n   Size: ${el.width}x${el.height}`;
        });
      }
      
      const ocrElements = ocr?.textElements || ocr?.detectedElements || [];
      toolResultContent += `\n\n📝 OCR TEXT (${ocrElements.length}):`;
      if (ocrElements.length > 0) {
        ocrElements.forEach((text, idx) => {
          toolResultContent += `\n${idx + 1}. "${text.text}"`;
          const x = text.x !== undefined ? text.x : text.position?.x;
          const y = text.y !== undefined ? text.y : text.position?.y;
          toolResultContent += `\n   Position: (${x}, ${y})`;
        });
      }
    } else {
      toolResultContent = JSON.stringify({
        success: result.success,
        message: result.output || result.message || 'Tool executed successfully'
      });
    }
    
    // Build continuation messages (Anthropic format)
    const continuationMessages = [
      ...messages,
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: toolUse.id,
            name: toolUse.name,
            input: functionArgs
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: toolResultContent
          }
        ]
      }
    ];
    
    console.log(`📤 Requesting AI continuation with tool result...`);
    
    // Make continuation request
    return await makeAnthropicContinuationRequest(
      continuationMessages,
      systemPrompt,
      model,
      apiKey,
      tools,
      res,
      windowsClient,
      projectId
    );
    
  } catch (error) {
    console.error(`❌ Tool call failed:`, error);
    res.write(`0:${JSON.stringify({ 
      type: 'text-delta', 
      textDelta: `\n\n**Tool Error:** ${error.message}\n\n` 
    })}\n`);
    return { toolUses: [], initialText: '' };
  }
}

/**
 * Make continuation request to Anthropic
 */
async function makeAnthropicContinuationRequest(messages, systemPrompt, model, apiKey, tools, res, windowsClient, projectId, iteration = 1) {
  const maxIterations = 100;
  
  if (iteration > maxIterations) {
    console.log(`⚠️ Max iterations (${maxIterations}) reached, stopping`);
    return { toolUses: [], initialText: '' };
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔄 Continuation Iteration ${iteration}/${maxIterations}`);
  console.log(`${'='.repeat(80)}\n`);
  
  return new Promise((resolve, reject) => {
    const modelName = model.replace('anthropic/', '');
    
    const requestBody = JSON.stringify({
      model: modelName,
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages,
      stream: true,
      ...(tools && { tools })
    });
    
    const anthropicReq = https.request('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    }, (anthropicRes) => {
      if (anthropicRes.statusCode !== 200) {
        let errorData = '';
        anthropicRes.on('data', chunk => errorData += chunk);
        anthropicRes.on('end', () => {
          console.error(`❌ Anthropic continuation error (${anthropicRes.statusCode}):`, errorData);
          resolve({ toolUses: [], initialText: '' });
        });
        return;
      }
      
      console.log('✅ Anthropic continuation stream established');
      
      let buffer = '';
      let toolUse = null;
      let initialText = '';
      
      anthropicRes.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('event: ')) continue;
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'content_block_start') {
                if (data.content_block?.type === 'tool_use') {
                  toolUse = {
                    id: data.content_block.id,
                    name: data.content_block.name,
                    input: ''
                  };
                }
              } else if (data.type === 'content_block_delta') {
                if (data.delta?.type === 'text_delta') {
                  initialText += data.delta.text;
                  console.log(`📝 AI Response: "${data.delta.text}"`);
                  res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: data.delta.text })}\n`);
                } else if (data.delta?.type === 'input_json_delta') {
                  if (toolUse) {
                    toolUse.input += data.delta.partial_json;
                  }
                }
              }
            } catch (e) {
              console.error('Error parsing continuation stream:', e.message);
            }
          }
        }
      });
      
      anthropicRes.on('end', async () => {
        console.log(`✅ Continuation complete: ${initialText.length} chars, ${toolUse ? 1 : 0} tool calls`);
        
        // Detect infinite loop
        if (toolUse && initialText.length === 0) {
          console.log(`⚠️ WARNING: AI called tool without generating any text`);
          console.log(`   Stopping to prevent infinite loop`);
          resolve({ toolUses: [], initialText: '' });
          return;
        }
        
        // If there are more tool calls, execute them recursively
        if (toolUse && windowsClient) {
          console.log(`🔄 AI wants to make more tool calls, continuing...`);
          
          const nextResult = await handleAnthropicToolCalls(
            [toolUse],
            windowsClient,
            res,
            messages,
            systemPrompt,
            model,
            apiKey,
            tools,
            projectId
          );
          
          resolve(nextResult);
        } else {
          console.log(`✅ No more tool calls, AI is done`);
          resolve({ toolUses: [], initialText });
        }
      });
      
      anthropicRes.on('error', (error) => {
        console.error('❌ Continuation stream error:', error);
        resolve({ toolUses: [], initialText: '' });
      });
    });
    
    anthropicReq.on('error', (error) => {
      console.error('❌ Continuation request error:', error);
      resolve({ toolUses: [], initialText: '' });
    });
    
    anthropicReq.write(requestBody);
    anthropicReq.end();
  });
}

/**
 * Handle Gemini chat requests (existing implementation)
 */
async function handleGeminiChat(req, res, message, history, requestedModel) {
  try {
    // Get user ID from request
    const userId = req.headers['x-user-id'] || req.body.userId;
    
    // Get user's Gemini API key from database
    const userApiKey = await getUserApiKey(userId, 'gemini');
    
    // Use user's key
    const apiKey = userApiKey;
    
    if (!apiKey) {
      console.error('❌ Gemini API key not configured for user:', userId);
      res.status(400).json({ 
        error: 'Gemini API key not configured',
        message: 'Please add your Gemini API key in Settings',
        details: 'Get your API key from https://makersuite.google.com/app/apikey'
      });
      return;
    }
    
    console.log(`🤖 Using model: ${requestedModel}`);
    console.log(`💬 User message: ${message.substring(0, 100)}...`);

    // Extract mode, projectId, and customModeId from request body
    const { mode = 'terminal', projectId, customModeId } = req.body;
    console.log(`🎯 Mode: ${mode}, Project ID: ${projectId}, Custom Mode ID: ${customModeId || 'none'}`);

    // Detect if this is a conversational message (no desktop interaction needed)
    const conversationalPatterns = [
      /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)[\s!.]*$/i,
      /^(how are you|what's up|wassup|sup)[\s!?.]*$/i,
      /^(thanks|thank you|thx|ty)[\s!.]*$/i,
      /^(bye|goodbye|see you|cya)[\s!.]*$/i,
      /^(what can you do|help|what are your capabilities)[\s!?.]*$/i,
      /^(ok|okay|cool|nice|great|awesome|good job)[\s!.]*$/i
    ];
    
    const isConversational = conversationalPatterns.some(pattern => pattern.test(message.trim()));
    
    if (isConversational && (mode === 'desktop' || mode === 'windows')) {
      console.log('💬 Detected conversational message in Gemini handler, using simple response mode');
      
      // Use a simple conversational prompt instead of the complex desktop prompt
      const conversationalPrompt = `You are a friendly, general-purpose AI assistant having a casual conversation.

CRITICAL RULES:
1. DO NOT mention "Windows desktop", "desktop control", "desktop tasks", or any technical capabilities
2. DO NOT offer to help with computer tasks, screenshots, or system operations
3. Respond ONLY as a conversational assistant
4. Keep responses SHORT and NATURAL

For "hello" or similar greetings, respond with ONLY:
- "Hello! How can I help you today?"
- "Hi there! What can I assist you with?"
- "Hey! What's up?"

DO NOT add anything about desktop, Windows, or technical tasks. Just be friendly and conversational.`;
      
      // Build conversation history for Gemini
      const contents = [
        ...history.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        })),
        {
          role: 'user',
          parts: [{ text: message }]
        }
      ];

      // Make simple API call WITH streaming
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: requestedModel,
        systemInstruction: conversationalPrompt
      });

      const result = await model.generateContentStream({
        contents: contents
      });

      // Set up streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: text })}\n`);
          if (res.flush) res.flush();
        }
      }

      res.write(`0:${JSON.stringify({ type: 'finish', finishReason: 'stop' })}\n`);
      if (res.flush) res.flush();
      res.end();
      
      console.log('✅ Conversational response streamed successfully (Gemini)');
      return;
    }

    // Get project details to determine OS
    let operatingSystem = 'kali-linux'; // Default
    if (projectId) {
      try {
        const { data: project, error } = await supabase
          .from('projects')
          .select('operating_system')
          .eq('id', projectId)
          .single();
        
        if (!error && project && project.operating_system) {
          operatingSystem = project.operating_system;
          console.log(`📋 Project OS: ${operatingSystem}`);
        }
      } catch (err) {
        console.warn(`⚠️  Could not fetch project OS: ${err.message}`);
      }
    }

    // Get system prompt - start with default mode prompt
    const baseSystemPrompt = modePrompts.getPromptForMode(mode, operatingSystem, requestedModel);
    console.log(`📋 Using ${mode} mode prompt for ${operatingSystem}`);
    
    // Check for custom mode to complement the base prompt
    let modeSystemPrompt = baseSystemPrompt;
    if (customModeId) {
      try {
        console.log(`🔍 Looking up custom mode: ${customModeId}`);
        const { data: customMode, error } = await supabase
          .from('custom_modes')
          .select('system_prompt, name')
          .eq('id', customModeId)
          .single();
        
        if (!error && customMode && customMode.system_prompt) {
          // APPEND custom mode prompt AFTER base prompt (base rules take precedence)
          modeSystemPrompt = `${baseSystemPrompt}

--------------------------------------------------------------------------
📌 CUSTOM MODE: ${customMode.name}
------------------------------------------------------------

${customMode.system_prompt}

-------------------------------------------------------
END OF CUSTOM MODE
--------------------------------------------------------------------------`;
          console.log(`✅ Appended custom mode "${customMode.name}" after base prompt (${customMode.system_prompt.length} chars)`);
        } else {
          console.warn(`⚠️  Custom mode not found, using base prompt only: ${error?.message}`);
        }
      } catch (err) {
        console.warn(`⚠️  Error fetching custom mode, using base prompt only: ${err.message}`);
      }
    }

    // Check if this is a Windows project and initialize Windows client
    let windowsClient = null;
    let windowsTools = [];
    
    if (operatingSystem === 'windows-11' || operatingSystem === 'windows-10') {
      console.log('🪟 Windows project detected, loading Windows tools...');
      
      try {
        // Get Windows MCP tools (filtered by mode)
        const { getWindowsMCPToolsForGemini } = require('./windows-mcp-tools');
        windowsTools = await getWindowsMCPToolsForGemini(mode);
        console.log(`🔧 Filtered to ${windowsTools.length} tools for ${mode} mode`);
        console.log(`✅ Loaded ${windowsTools.length} Windows tools for Gemini`);
        
        // Initialize Windows MCP client
        const { getWindowsMCPClient } = require('./mcp-client-pool');
        windowsClient = await getWindowsMCPClient(projectId);
        console.log(`✅ Windows client initialized`);
      } catch (err) {
        console.error(`❌ Failed to load Windows tools:`, err.message);
      }
    }

    // Get MCP tools for Gemini (for Linux/Unix systems)
    const mcpTools = windowsTools.length > 0 ? [] : await getMCPToolsForGemini();
    const useMCPTools = mcpTools.length > 0 && mcpClient && mcpClient.isClientConnected();
    const useWindowsTools = windowsTools.length > 0 && windowsClient;

    if (useWindowsTools) {
      console.log(`✅ Using ${windowsTools.length} Windows tools`);
    } else if (useMCPTools) {
      console.log(`✅ Using ${mcpTools.length} MCP tools for command execution`);
    } else {
      console.log('⚠️  MCP tools not available, AI will respond without tool execution');
    }

    // Build system prompt - use mode-specific prompt instead of generic SYSTEM_PROMPT
    const systemPrompt = useMCPTools ? `${modeSystemPrompt}

═══════════════════════════════════════════════════════════════════════════════
🔧 AVAILABLE MCP TOOLS
═══════════════════════════════════════════════════════════════════════════════

You have access to the following terminal control tools:

1. **write_command** - Execute bash commands and get output (PRIMARY TOOL)
2. **get_session_output** - Retrieve recent terminal output
3. **get_session_state** - Check if terminal is ready
4. **send_key** - Send special keys (Ctrl+C, Enter, etc.)
5. **write_text** - Write text without executing

IMPORTANT: Use write_command for ALL command execution. The commands will be visible in the terminal iframe and you will receive the actual output.

═══════════════════════════════════════════════════════════════════════════════
💬 CONVERSATION HISTORY
═══════════════════════════════════════════════════════════════════════════════

The conversation history is automatically included in your context. Use it to maintain context across the conversation.` : modeSystemPrompt;

    // Initialize the model
    const modelConfig = {
      model: requestedModel,
      systemInstruction: systemPrompt
    };

    // Add MCP tools if available
    if (useMCPTools) {
      modelConfig.tools = [{ functionDeclarations: mcpTools }];
      modelConfig.toolConfig = {
        functionCallingConfig: {
          mode: 'ANY'  // Force Gemini to always call a tool
        }
      };
    }

    const model = genAI.getGenerativeModel(modelConfig);

    // Build conversation history
    const chat = model.startChat({
      history: history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
    });

    // Send message and get response with streaming
    console.log(`📤 Sending message to Gemini with streaming...`);
    
    // Set up streaming headers immediately
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    console.log('📡 Set streaming headers');
    
    // Register stream with health monitor
    const streamId = `gemini-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    streamHealthMonitor.registerStream(streamId, res, { 
      provider: 'gemini', 
      model: requestedModel, 
      projectId: req.body.projectId 
    });
    
    // Wrap res.write to track activity
    const originalWrite = res.write.bind(res);
    res.write = function(chunk, ...args) {
      streamHealthMonitor.updateActivity(streamId, chunk.length);
      return originalWrite(chunk, ...args);
    };
    
    // Send connection confirmation
    res.write(`0:${JSON.stringify({ type: 'connection' })}\n`);
    console.log('✅ Sent connection message');
    
    // Use streaming API
    const streamResult = await chat.sendMessageStream(message);
    
    let fullResponse = '';
    let functionCalls = [];
    
    // Process the stream
    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text();
      
      if (chunkText) {
        fullResponse += chunkText;
        
        // 🚨 CRITICAL: Filter out malformed <tool_call> tags in real-time
        let textToStream = chunkText;
        
        // Remove tool_call tags and their content
        textToStream = textToStream
          .replace(/<tool_call>/gi, '')
          .replace(/<\/tool_call>/gi, '')
          .replace(/\{\s*"name"\s*:\s*"[^"]*"\s*,\s*"arguments"\s*:\s*[^}]*\}/gi, '');
        
        // Filter incomplete JSON patterns
        if (textToStream.includes('"name"') && textToStream.includes('"arguments"')) {
          console.log(`🧹 Filtering tool call JSON from Gemini stream chunk`);
          textToStream = textToStream.replace(/\{\s*"name"[^}]*$/gi, '');
        }
        
        // 🚨 CRITICAL: Filter completion messages in real-time
        // Remove: "Done.", "✅ Task complete.", and similar patterns
        textToStream = textToStream
          .replace(/Done\.\s*$/gi, '')
          .replace(/✅\s*Task\s+complete\.\s*$/gi, '')
          .replace(/Done\.\s*✅\s*Task\s+complete\.\s*$/gi, '')
          .replace(/✅\s*Task\s+complete\.\s*Done\.\s*$/gi, '');
        
        // Stream text chunks immediately (only if there's content after filtering)
        if (textToStream.trim()) {
          const chunkSize = 5;
          for (let i = 0; i < textToStream.length; i += chunkSize) {
            const textChunk = textToStream.slice(i, i + chunkSize);
            res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: textChunk })}\n`);
          }
          console.log(`📝 Streamed ${textToStream.length} characters`);
        }
      }
      
      // Check for function calls in this chunk
      try {
        if (chunk.functionCalls && typeof chunk.functionCalls === 'function') {
          const calls = chunk.functionCalls();
          if (calls && calls.length > 0) {
            functionCalls = calls;
            console.log(`🔧 Function calls detected in stream: ${functionCalls.length}`);
          }
        }
      } catch (funcCallError) {
        console.warn(`⚠️  Error checking function calls:`, funcCallError.message);
      }
    }
    
    // Get the final response
    const response = await streamResult.response;
    
    // Check for text-based tool calls in the full response
    if (functionCalls.length === 0 && fullResponse) {
      const { extractToolCall, normalizeToolName } = require('./text-tool-call-parser');
      const toolCallMatch = extractToolCall(fullResponse);
      
      if (toolCallMatch) {
        console.log(`🔍 DETECTED TEXT-BASED TOOL CALL: ${toolCallMatch.functionName}`);
        console.log(`   Args:`, toolCallMatch.args);
        
        const normalizedName = normalizeToolName(toolCallMatch.functionName);
        
        // Check if this is explicit syntax (should be hidden) or natural language (should be kept)
        const explicitSyntaxPattern = /\[Calls?:\s*([a-zA-Z_][a-zA-Z0-9_]*)\((\{[^}]*\}|[^)]*)\)\]/i;
        const isExplicitSyntax = explicitSyntaxPattern.test(toolCallMatch.fullMatch);
        
        if (isExplicitSyntax) {
          console.log(`📤 Sending text-replace event to hide explicit syntax`);
          const cleanedText = toolCallMatch.textBefore + (toolCallMatch.textAfter ? ' ' + toolCallMatch.textAfter : '');
          res.write(`0:${JSON.stringify({ 
            type: 'text-replace', 
            text: cleanedText 
          })}\n`);
          fullResponse = cleanedText;
        }
        
        // Convert text-based tool call to Gemini function call format
        functionCalls.push({
          name: normalizedName,
          args: toolCallMatch.args,
          _fromText: true
        });
        
        console.log(`✅ Converted text tool call to function call: ${normalizedName}`);
      }
    }
    
    // If no function calls were found in stream, check the final response
    if (functionCalls.length === 0) {
      functionCalls = response.functionCalls || [];
      if (functionCalls.length === 0 && response.candidates && response.candidates[0]) {
        const content = response.candidates[0].content;
        if (content && content.parts) {
          const parts = content.parts || [];
          functionCalls = parts
            .filter(part => part.functionCall)
            .map(part => part.functionCall);
        }
      }
    }

    console.log(`🔧 Total function calls to process: ${functionCalls.length}`);

    // Handle tool calls - NO LOOP, process only first tool call
    if (functionCalls && functionCalls.length > 0) {
      const functionCall = functionCalls[0];
      
      console.log(`🔧 Processing tool call: ${functionCall.name}`);

      // Handle Windows tool calls
      if (useWindowsTools && windowsClient && windowsTools.some(t => t.name === functionCall.name)) {
        console.log(`🪟 Executing Windows tool: ${functionCall.name}`);
        
        try {
          // Convert tool name: windows_take_screenshot → take_screenshot
          const toolName = functionCall.name.replace('windows_', '');
          console.log(`🔧 Converted tool name: ${functionCall.name} → ${toolName}`);
          
          // Execute the Windows tool
          const toolResult = await windowsClient.executeTool(toolName, functionCall.args || {});
          console.log(`✅ Windows tool executed:`, toolResult);
          
          // Send tool-call-start event
          res.write(`0:${JSON.stringify({
            type: 'tool-call-start',
            toolCallId: 'gemini_' + Date.now(),
            toolName: functionCall.name,
            args: functionCall.args || {}
          })}\n`);
          
          // Send tool output
          res.write(`0:${JSON.stringify({
            type: 'desktop-tool-output',
            toolCallId: 'gemini_' + Date.now(),
            toolName: functionCall.name,
            args: functionCall.args || {},
            output: toolResult.output || toolResult.message || 'Tool executed',
            status: toolResult.success ? 'success' : 'error'
          })}\n`);
          
          console.log(`✅ Tool execution complete, requesting continuation for verification...`);
          
          // Send function response back to model for analysis
          const toolResponseStream = await chat.sendMessageStream([{
            functionResponse: {
              name: functionCall.name,
              response: { output: toolResult.output || toolResult.message || 'Tool executed successfully' }
            }
          }]);
          
          console.log(`✅ Continuation stream started, streaming AI analysis...`);
          
          // Stream the model's analysis
          let analysisChars = 0;
          for await (const chunk of toolResponseStream.stream) {
            const chunkText = chunk.text();
            
            if (chunkText) {
              analysisChars += chunkText.length;
              
              // Stream text chunks immediately
              const chunkSize = 5;
              for (let i = 0; i < chunkText.length; i += chunkSize) {
                const textChunk = chunkText.slice(i, i + chunkSize);
                res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: textChunk })}\n`);
              }
            }
          }
          
          console.log(`✅ AI analysis complete: ${analysisChars} chars generated`);
        } catch (toolError) {
          console.error(`❌ Windows tool execution error:`, toolError);
        }
      }
      // Handle MCP tool calls
      else if (useMCPTools && mcpTools.some(t => t.name === functionCall.name)) {
        const toolResult = await handleMCPToolCall(functionCall);

        // Track command outputs for display
        if (functionCall.name === 'write_command') {
          commandOutputs.push({
            command: functionCall.args.command,
            output: toolResult.output,
            status: toolResult.success ? 'success' : 'error'
          });
        }

        console.log(`✅ Tool execution complete, requesting single continuation for analysis...`);
        
        // Send function response back to model for analysis (ONE TIME ONLY - NO LOOP)
        const toolResponseStream = await chat.sendMessageStream([{
          functionResponse: {
            name: functionCall.name,
            response: { output: toolResult.output }
          }
        }]);
        
        console.log(`✅ Continuation stream started, streaming AI analysis...`);
        
        // Stream the model's analysis of the tool result
        let analysisChars = 0;
        for await (const chunk of toolResponseStream.stream) {
          const chunkText = chunk.text();
          
          if (chunkText) {
            analysisChars += chunkText.length;
            
            // Stream text chunks immediately
            const chunkSize = 5;
            for (let i = 0; i < chunkText.length; i += chunkSize) {
              const textChunk = chunkText.slice(i, i + chunkSize);
              res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: textChunk })}\n`);
            }
          }
        }
        
        console.log(`✅ AI analysis complete: ${analysisChars} chars generated`);
      } else {
        // Unknown tool
        console.log(`⚠️  Unknown tool: ${functionCall.name}`);
      }
    }

    // Send done message AFTER AI finishes analyzing (if tool was called) or after initial text (if no tool)
    res.write(`0:${JSON.stringify({ type: 'done' })}\n`);
    console.log('✅ Sent done message - AI finished responding');
    
    // Mark stream as complete in health monitor
    streamHealthMonitor.completeStream(streamId);
    
    // Track usage
    try {
      const { userId, sessionId, projectId, customCostPerToken } = req.body;
      if (response && response.usageMetadata && userId) {
        const usage = response.usageMetadata;
        
        // Calculate cost if custom pricing is provided
        let cost = 0;
        if (customCostPerToken) {
          cost = calculateCost(
            usage.promptTokenCount || 0,
            usage.candidatesTokenCount || 0,
            null,
            0, // Gemini doesn't report reasoning tokens separately
            customCostPerToken
          );
          console.log(`💰 Gemini cost calculated using custom pricing: $${cost.toFixed(6)}`);
        }
        
        await trackUsage({
          userId,
          modelId: model,
          provider: 'google',
          promptTokens: usage.promptTokenCount || 0,
          completionTokens: usage.candidatesTokenCount || 0,
          reasoningTokens: 0,
          totalTokens: usage.totalTokenCount || 0,
          cost: cost,
          sessionId: sessionId || null,
          projectId: projectId || null
        });
        console.log(`📊 Usage tracked: ${usage.totalTokenCount} tokens`);
      }
    } catch (trackError) {
      console.error('⚠️ Failed to track usage:', trackError);
    }
    
    // Send done event before ending stream
    res.write(`0:${JSON.stringify({ type: 'done' })}\n`);
    if (res.flush) res.flush();
    
    res.end();
    console.log('✅ Stream ended');

  } catch (error) {
    console.error('❌ Chat error:', error);

    // Terminate stream in health monitor
    if (typeof streamId !== 'undefined') {
      streamHealthMonitor.terminateStream(streamId, 'error');
    }
    
    // Send error message to frontend if headers already sent (streaming started)
    if (res.headersSent) {
      try {
        // Send a simple network error message
        res.write(`0:${JSON.stringify({ 
          type: 'text-delta', 
          textDelta: '\n\nA network error occurred. Please try again.' 
        })}\n`);
        res.write(`0:${JSON.stringify({ type: 'done' })}\n`);
        if (res.flush) res.flush();
      } catch (writeError) {
        console.error('Failed to send error message:', writeError);
      }
    } else {
      // Headers not sent yet, can send JSON error
      res.status(500).json({
        error: 'Chat error',
        message: error.message
      });
    }

    // Provide user-friendly error messages
    let errorMessage = 'Failed to process message';
    let statusCode = 500;

    if (error.message.includes('fetch failed') || error.message.includes('Failed to connect to Gemini API')) {
      errorMessage = 'Unable to connect to Gemini API. Please check your internet connection and try again.';
      statusCode = 503; // Service Unavailable
    } else if (error.message.includes('API key')) {
      errorMessage = 'Invalid API key. Please check your Gemini API configuration.';
      statusCode = 401; // Unauthorized
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timeout. The AI took too long to respond. Please try again.';
      statusCode = 504; // Gateway Timeout
    }

    // Check if headers were already sent before sending error response
    if (!res.headersSent) {
      res.status(statusCode).json({
        error: errorMessage,
        details: error.message,
        retryable: statusCode === 503 || statusCode === 504
      });
    } else {
      // Headers already sent, just log the error
      console.error('   Error occurred after headers were sent - cannot send error response');
    }
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'kali-ai-backend' });
});

// Streaming health check
app.get('/api/streaming/health', (req, res) => {
  const stats = streamHealthMonitor.getStats();
  res.json({
    status: 'ok',
    ...stats,
    timestamp: new Date().toISOString()
  });
});

// Fetch models from provider API (proxy to avoid CORS)
app.post('/api/models/fetch', authenticateToken, async (req, res) => {
  try {
    const { apiKey, provider } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    console.log(`🔍 Fetching models from ${provider} for user ${userId}...`);

    let models = [];
    let fetchUrl = '';
    let fetchOptions = {};

    // Configure fetch based on provider
    switch (provider) {
      case 'OpenAI':
        fetchUrl = 'https://api.openai.com/v1/models';
        fetchOptions = {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        };
        break;

      case 'Anthropic':
        fetchUrl = 'https://api.anthropic.com/v1/models';
        fetchOptions = {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          }
        };
        break;

      case 'Google':
        fetchUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        fetchOptions = {
          method: 'GET'
        };
        break;

      default:
        return res.status(400).json({ error: `Unsupported provider: ${provider}` });
    }

    // Fetch models from provider
    const response = await httpRequest(fetchUrl, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ${provider} API error:`, response.status, errorText);
      return res.status(response.status).json({ 
        error: `Failed to fetch models from ${provider}`,
        details: errorText
      });
    }

    const data = await response.json();

    // Parse response based on provider
    switch (provider) {
      case 'OpenAI':
        models = data.data.map(model => ({
          id: model.id,
          name: model.id,
          provider: 'OpenAI',
          created: model.created,
          owned_by: model.owned_by
        }));
        break;

      case 'Anthropic':
        models = data.data.map(model => ({
          id: model.id,
          name: model.display_name || model.id,
          provider: 'Anthropic',
          created: model.created_at
        }));
        break;

      case 'Google':
        models = data.models
          .filter(model => model.supportedGenerationMethods?.includes('generateContent'))
          .map(model => ({
            id: model.name.replace('models/', ''),
            name: model.displayName || model.name.replace('models/', ''),
            provider: 'Google',
            contextLength: model.inputTokenLimit,
            maxOutputTokens: model.outputTokenLimit
          }));
        break;
    }

    console.log(`✅ Fetched ${models.length} models from ${provider}`);

    // Enrich models with OpenRouter pricing
    console.log('🔍 Enriching models with OpenRouter pricing...');
    try {
      const openRouterResponse = await httpRequest('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer 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',
          'Content-Type': 'application/json'
        }
      });

      if (openRouterResponse.ok) {
        const openRouterData = await openRouterResponse.json();
        const openRouterModels = openRouterData.data || [];

        // Normalize function for fuzzy matching
        const normalizeId = (id) => {
          return id
            .replace(/^(anthropic|google|openai|mistral)\//i, '')
            .replace(/:(free|paid)$/i, '')
            .replace(/-\d{8}$/, '')
            .replace(/\./g, '-')
            .replace(/-exp(erimental)?$/i, '-exp')
            .toLowerCase();
        };

        // Enrich each model with pricing
        models = models.map(model => {
          // Try exact match first
          let orModel = openRouterModels.find(m => m.id === model.id);

          // If not found, try fuzzy matching
          if (!orModel) {
            const normalizedModelId = normalizeId(model.id);
            orModel = openRouterModels.find(m => {
              const normalizedOrId = normalizeId(m.id);
              return normalizedOrId === normalizedModelId ||
                     normalizedOrId.includes(normalizedModelId) ||
                     normalizedModelId.includes(normalizedOrId);
            });
          }

          if (orModel && orModel.pricing) {
            // Convert from per-token to per-1M-tokens
            return {
              ...model,
              pricing: {
                prompt: (parseFloat(orModel.pricing.prompt) * 1000000).toFixed(2),
                completion: (parseFloat(orModel.pricing.completion) * 1000000).toFixed(2)
              },
              contextLength: model.contextLength || orModel.context_length,
              maxOutputTokens: model.maxOutputTokens || orModel.top_provider?.max_completion_tokens,
              description: orModel.description
            };
          }

          return model;
        });

        console.log(`✅ Enriched ${models.filter(m => m.pricing).length}/${models.length} models with pricing`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to enrich with OpenRouter pricing:', error.message);
    }

    res.json({
      success: true,
      provider,
      models
    });

  } catch (error) {
    console.error('❌ Error fetching models:', error);
    res.status(500).json({ 
      error: 'Failed to fetch models',
      details: error.message 
    });
  }
});

// Screenshot cache endpoint
app.get('/api/screenshot-cache/:screenshotId', (req, res) => {
  const { screenshotId } = req.params;
  
  if (!global.screenshotCache || !global.screenshotCache.has(screenshotId)) {
    return res.status(404).json({
      success: false,
      error: 'Screenshot not found in cache'
    });
  }
  
  const data = global.screenshotCache.get(screenshotId);
  res.json({
    success: true,
    imageData: data.imageData,
    screenData: data.screenData,
    timestamp: data.timestamp
  });
});

// Test endpoint to directly execute commands (bypasses Gemini)
app.post('/api/execute-command', async (req, res) => {
  try {
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    console.log(`🧪 Test execution: ${command}`);

    // Call the MCP tool directly through the client
    if (!mcpClient || !mcpClient.isConnected) {
      return res.status(503).json({ 
        error: 'MCP client not connected',
        details: 'Desktop Commander is not available'
      });
    }

    // Use write_command for gotty-direct-writer (or start_process for DesktopCommanderMCP)
    // Try write_command first, fallback to start_process
    let result;
    try {
      result = await mcpClient.callTool('write_command', {
        command: command
      });
    } catch (error) {
      if (error.message && error.message.includes('Unknown tool')) {
        // Fallback to start_process for DesktopCommanderMCP
        result = await mcpClient.callTool('start_process', {
          command: command,
          timeout_ms: 30000
        });
      } else {
        throw error;
      }
    }

    res.json({
      success: true,
      command: command,
      result: result,
      message: 'Command executed and echoed to terminal'
    });

  } catch (error) {
    console.error('❌ Test execution error:', error);
    res.status(500).json({ 
      error: 'Execution failed',
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 3002;

// Set server timeouts to prevent connection drops during long AI tasks
server.timeout = 0; // Disable timeout completely for streaming responses
server.keepAliveTimeout = 0; // Disable keep-alive timeout
server.headersTimeout = 0; // Disable headers timeout

server.listen(PORT, async () => {
  console.log(`🤖 Kali AI Backend running on port ${PORT}`);
  console.log(`🔐 Gemini API configured: ${process.env.GEMINI_API_KEY ? 'Yes' : 'No'}`);
  console.log(`🔌 WebSocket server running on ws://localhost:${PORT}`);
  console.log(`⏱️  Server timeouts disabled for long-running AI tasks`);
  
  // Reconnect windows-tools-api to existing project networks
  try {
    const { reconnectWindowsToolsAPI } = require('./reconnect-windows-tools-api');
    await reconnectWindowsToolsAPI();
  } catch (err) {
    console.warn('[Startup] ⚠️  Failed to reconnect windows-tools-api:', err.message);
  }
});
