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
app.use(express.json({ limit: '50mb' })); // Increase limit for screenshot data
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server for terminal broadcasting and collaboration
const wss = new WebSocket.Server({ server });

// Initialize Collaboration WebSocket Handler
const CollaborationWebSocketHandler = require('./collaboration-websocket');
const collaborationWS = new CollaborationWebSocketHandler(wss);

// Store connected frontend clients
const frontendClients = new Set();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId');
  const userName = url.searchParams.get('userName');
  const projectId = url.searchParams.get('projectId');

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
(async () => {
  try {
    await projectManager.restoreHttpServersOnStartup();
    console.log('[Server] ✅ Shared folder containers restored for Windows projects');
    
    // Start health monitoring for existing projects
    await projectManager.startHealthMonitoringForExistingProjects();
    console.log('[Server] ✅ Health monitoring started for existing projects');
  } catch (err) {
    console.error('[Server] Failed to restore shared folder containers:', err.message);
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
const collaborationRoutes = setupCollaborationRoutes(collaborationManager, sessionManager, collaborationWS);
app.use('/api/collaborations', collaborationRoutes);
console.log('✅ Collaboration routes initialized');

// Setup usage tracking routes
const usageRoutes = require('./usage-routes');
app.use('/api/usage', usageRoutes);
console.log('✅ Usage tracking routes initialized');

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

// Chat endpoint with multi-provider support
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], model: requestedModel = 'gemini-2.5-flash', apiKey, userId, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
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
    res.status(500).json({
      error: 'Failed to process message',
      details: error.message
    });
  }
});

/**
 * Handle OpenRouter chat requests
 */
async function handleOpenRouterChat(req, res, message, history, model) {
  try {
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    
    if (!openrouterApiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    // Extract mode, projectId, and customModeId from request body
    const { mode = 'terminal', projectId, customModeId } = req.body;
    console.log(`🎯 Mode: ${mode}, Project ID: ${projectId}, Custom Mode ID: ${customModeId || 'none'}`);

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

    // Build messages array with system prompt
    const messages = [
      {
        role: 'system',
        content: modeSystemPrompt
      },
      ...history.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

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

    // Call OpenRouter API with streaming enabled
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Kali AI Assistant'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenRouter API error: ${response.status}`, errorText);
      throw new Error(`OpenRouter API error: ${response.statusText}`);
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
                initialText += delta.content; // Capture the text
                console.log(`📝 AI Initial Text: "${delta.content}"`);
                
                // Stream the content immediately
                res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: delta.content })}\n`);
                
                if (totalChars % 100 === 0) {
                  console.log(`📝 Streamed ${totalChars} characters so far...`);
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
    
    // Process tool calls - allow unlimited iterations for complex tasks
    let toolCallIteration = 0;
    const maxToolCallIterations = 100; // Allow up to 100 tool calls per request for complex multi-step tasks with iteration
    const toolCallHistory = []; // Track tool calls to detect repetition
    const textHistory = []; // Track text responses to detect infinite loops
    let consecutiveScreenshots = 0; // Track consecutive screenshots without actions
    
    while (toolCalls.length > 0 && toolCallIteration < maxToolCallIterations) {
      toolCallIteration++;
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔧 Tool Call Iteration ${toolCallIteration}/${maxToolCallIterations}: Processing ${toolCalls.length} tool call(s)`);
      console.log(`🔧 Tool calls:`, toolCalls.map(tc => `${tc.function.name} (id: ${tc.id})`));
      console.log(`${'='.repeat(80)}\n`);
      
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
      
      // Check for excessive repetition (allow up to 2 repeats, block on 3rd)
      const currentTool = toolCalls[0];
      const toolSignature = `${currentTool.function.name}:${JSON.stringify(currentTool.function.arguments)}`;
      
      // Allow take_screenshot to be called multiple times for verification
      // Only block repetition for action tools (click, type, press_key, move, scroll)
      const isScreenshotTool = currentTool.function.name === 'windows_take_screenshot';
      const isActionTool = ['windows_click_mouse', 'windows_type_text', 'windows_press_key', 'windows_move_mouse', 'windows_scroll_mouse'].includes(currentTool.function.name);
      
      // Count how many times this exact tool call has been made
      const repetitionCount = toolCallHistory.filter(sig => sig === toolSignature).length;
      
      // Block if the same action has been repeated 3 or more times (allow 2 repeats)
      if (repetitionCount >= 2 && !isScreenshotTool) {
        console.log(`⚠️ EXCESSIVE REPETITION DETECTED: AI is calling the same tool ${repetitionCount + 1} times`);
        console.log(`   Tool: ${currentTool.function.name}`);
        console.log(`   Arguments: ${currentTool.function.arguments}`);
        console.log(`   This is likely stuck in a loop - stopping iteration`);
        console.log(`   Tool call history:`, toolCallHistory);
        
        // Request ONE FINAL continuation from AI WITHOUT tools to get completion message
        console.log(`📝 Requesting final completion message from AI (no tools)...`);
        
        try {
          const finalMessages = [
            ...messages,
            {
              role: 'assistant',
              content: initialText || 'I attempted to complete the task but encountered repetition.'
            },
            {
              role: 'user',
              content: 'The system detected that you were repeating the same action. Please provide a brief summary of what you accomplished and the current status.'
            }
          ];
          
          const finalResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openrouterApiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'http://localhost:3000',
              'X-Title': 'Kali AI Assistant'
            },
            body: JSON.stringify({
              model: model,
              messages: finalMessages,
              stream: true,
              // NO TOOLS - force text-only response
              temperature: 0.7
            })
          });
          
          if (finalResponse.ok) {
            console.log(`✅ Final message stream started...`);
            const finalReader = finalResponse.body.getReader();
            let finalBuffer = '';
            
            while (true) {
              const { done, value } = await finalReader.read();
              if (done) break;
              
              finalBuffer += decoder.decode(value, { stream: true });
              const finalLines = finalBuffer.split('\n');
              finalBuffer = finalLines.pop() || '';
              
              for (const finalLine of finalLines) {
                if (finalLine.startsWith('data: ')) {
                  const finalData = finalLine.slice(6);
                  if (finalData === '[DONE]') continue;
                  
                  try {
                    const finalParsed = JSON.parse(finalData);
                    const finalDelta = finalParsed.choices?.[0]?.delta;
                    
                    if (finalDelta?.content) {
                      console.log(`📝 Final message: "${finalDelta.content}"`);
                      res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: finalDelta.content })}\n`);
                      if (res.flush) res.flush();
                    }
                  } catch (e) {
                    console.error('Failed to parse final message:', e);
                  }
                }
              }
            }
            
            console.log(`✅ Final message complete`);
          } else {
            console.error(`❌ Final message request failed: ${finalResponse.status}`);
          }
        } catch (error) {
          console.error(`❌ Error requesting final message:`, error);
        }
        
        break; // Stop the loop to prevent excessive repetition
      }
      
      // Add to history (but don't track screenshots for repetition detection)
      if (!isScreenshotTool) {
        toolCallHistory.push(toolSignature);
      }
      
      // Small delay to ensure any text is rendered before tool execution
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Process ONLY the FIRST tool call (no loop, no continuation)
      const toolCall = toolCalls[0];
      
      try {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`🔧 Executing tool: ${functionName}`, functionArgs);
        
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
        
        if (windowsClient && functionName.startsWith('windows_')) {
          const toolName = functionName.replace('windows_', '');
          const startTime = Date.now();
          
          let result;
          
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
            result = await windowsClient.executeTool(toolName, functionArgs);
          }
          
          const duration = Date.now() - startTime;
          
          console.log(`✅ Tool ${functionName} executed successfully`);
          console.log(`📊 Result:`, { success: result.success, hasMessage: !!result.message });
          
          // Send tool output
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
          
          // Handle screenshot data
          // Check for imageData in result.message (new format) or result.imageData (old format)
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
            console.log(`✅ screenshot-data sent`);
          }
          
          console.log(`✅ Tool execution complete, requesting single continuation for analysis...`);
          
          // Build continuation request with tool result (ONE TIME ONLY - NO LOOP)
          // Format screenData as readable text for screenshots
          let screenDataText = '';
          if (toolName === 'take_screenshot' && result.windowsAPI) {
            // Result structure: windowsAPI, ocr, size, mousePosition are directly on result
            const windowsAPI = result.windowsAPI;
            const ocr = result.ocr;
            const size = result.size;
            const mousePos = result.mousePosition;
            
            // Debug: Log the actual structure
            console.log(`🔍 DEBUG: Checking OCR data structure:`);
            console.log(`   ocr exists: ${!!ocr}`);
            console.log(`   ocr.textElements exists: ${!!ocr?.textElements}`);
            console.log(`   ocr.textElements length: ${ocr?.textElements?.length || 0}`);
            console.log(`   ocr.detectedElements length: ${ocr?.detectedElements?.length || 0}`);
            console.log(`   ocr keys:`, ocr ? Object.keys(ocr) : 'null');
            if (ocr && ocr.textElements && ocr.textElements.length > 0) {
              console.log(`   First OCR element:`, JSON.stringify(ocr.textElements[0]));
            }
            
            screenDataText = `\n\n📊 COMPLETE SCREENSHOT DATA (READ EVERYTHING CAREFULLY):

🖥️ SCREEN INFORMATION:
- Resolution: ${size?.width || 0}x${size?.height || 0}
- Mouse Position: (${mousePos?.x || 0}, ${mousePos?.y || 0})

🪟 ALL WINDOWS API ELEMENTS (${windowsAPI?.elements?.length || 0} total):`;
            
            // List ALL Windows API elements with full details
            if (windowsAPI?.elements && windowsAPI.elements.length > 0) {
              windowsAPI.elements.forEach((el, idx) => {
                screenDataText += `\n${idx + 1}. [${el.type}] "${el.name || 'Unknown'}"`;
                screenDataText += `\n   Position: (${el.x}, ${el.y}) Center: (${el.center_x}, ${el.center_y})`;
                screenDataText += `\n   Size: ${el.width}x${el.height}`;
                if (el.isMaximized !== undefined) screenDataText += `\n   Maximized: ${el.isMaximized}`;
                if (el.isMinimized !== undefined) screenDataText += `\n   Minimized: ${el.isMinimized}`;
                if (el.hasCloseButton !== undefined) screenDataText += `\n   Has Close Button: ${el.hasCloseButton}`;
                if (el.hasMaximizeButton !== undefined) screenDataText += `\n   Has Maximize Button: ${el.hasMaximizeButton}`;
                if (el.hasMinimizeButton !== undefined) screenDataText += `\n   Has Minimize Button: ${el.hasMinimizeButton}`;
              });
            } else {
              screenDataText += '\n(No Windows API elements found)';
            }
            
            // Use textElements or detectedElements instead of elements
            const ocrElements = ocr?.textElements || ocr?.detectedElements || [];
            screenDataText += `\n\n📝 ALL OCR TEXT ELEMENTS (${ocrElements.length} total):`;
            if (ocrElements.length > 0) {
              ocrElements.forEach((text, idx) => {
                screenDataText += `\n${idx + 1}. "${text.text}"`;
                // Handle both flat and nested position/size structures
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
            if (windowsAPI?.elements) {
              const types = {};
              windowsAPI.elements.forEach(el => {
                types[el.type] = (types[el.type] || 0) + 1;
              });
              Object.entries(types).forEach(([type, count]) => {
                screenDataText += `\n- ${type}: ${count}`;
              });
            }
            
            console.log(`📊 Formatted COMPLETE screen data for AI (${screenDataText.length} chars)`);
          }
          
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
              content: toolName === 'take_screenshot' && screenDataText 
                ? screenDataText
                : JSON.stringify({
                    success: result.success,
                    message: result.output || result.message || 'Tool executed successfully'
                  })
            }
          ];
          
          // For screenshots, add a system reminder to describe what they see
          const isAfterScreenshot = toolName === 'take_screenshot';
          
          if (isAfterScreenshot) {
            conversationMessages.push({
              role: 'system',
              content: 'IMPORTANT: You just received screenshot data. Your next response MUST start with text describing what you see (windows, buttons, coordinates, text) before calling any tool. Do not skip this step.'
            });
          }
          
          console.log(`📤 Requesting AI continuation (WITH tools for multi-step)`);
          
          // Request continuation WITH tools to allow more tool calls
          const continuationResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openrouterApiKey}`,
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
            })
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
                      console.log(`📝 AI Response: "${contDelta.content}"`);
                      res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: contDelta.content })}\n`);
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
            
            // Detect text repetition (infinite loops)
            if (contText.length > 100) {
              // Check if the same phrase is repeated many times
              const phrases = contText.match(/(.{20,}?)\1{5,}/g); // Find any 20+ char phrase repeated 5+ times
              if (phrases) {
                console.log(`⚠️ TEXT REPETITION DETECTED: AI is stuck in a loop`);
                console.log(`   Repeated phrase: "${phrases[0].substring(0, 50)}..."`);
                console.log(`   Stopping iteration to prevent infinite loop`);
                break; // Stop the loop
              }
              
              // Check if text is too long (likely stuck)
              if (contText.length > 5000) {
                console.log(`⚠️ EXCESSIVE TEXT DETECTED: ${contText.length} characters generated`);
                console.log(`   AI may be stuck in a loop - stopping iteration`);
                break;
              }
            }
            
            // Track consecutive screenshots
            if (toolCalls.length > 0 && toolCalls[0].function.name === 'windows_take_screenshot') {
              consecutiveScreenshots++;
              if (consecutiveScreenshots >= 3) {
                console.log(`⚠️ TOO MANY CONSECUTIVE SCREENSHOTS: ${consecutiveScreenshots} in a row`);
                console.log(`   AI should take action instead of just observing`);
                console.log(`   Stopping iteration`);
                break;
              }
            } else if (toolCalls.length > 0) {
              consecutiveScreenshots = 0; // Reset if action tool is called
            }
            
            // Update for next iteration
            initialText = contText;
            toolCalls = newToolCalls.filter(tc => tc && tc.function.name);
            
            if (toolCalls.length > 0) {
              console.log(`🔄 AI wants to make ${toolCalls.length} more tool calls, continuing...`);
            } else {
              console.log(`✅ No more tool calls, AI is done`);
            }
          } else {
            console.error(`❌ Continuation request failed: ${continuationResponse.status}`);
            toolCalls = []; // Stop on error
          }
        }
      } catch (toolError) {
        console.error(`❌ Tool execution error:`, toolError);
        toolCalls = []; // Stop on error
      }
    }
    
    // Check if we hit the max iterations
    if (toolCallIteration >= maxToolCallIterations) {
      console.log(`⚠️  Max tool call iterations (${maxToolCallIterations}) reached, stopping`);
    }
    
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
    
    // Terminate stream in health monitor
    if (typeof streamId !== 'undefined') {
      streamHealthMonitor.terminateStream(streamId, 'error');
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
async function handleOpenAIChat(req, res, message, history, model, apiKey) {
  try {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    console.log(`📤 Sending request to OpenAI with model: ${model}`);
    
    // Extract mode, projectId, userId, and sessionId from request
    const { mode = 'terminal', projectId, customModeId, userId, sessionId } = req.body;
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
    
    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

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
                // Send done event in OpenRouter format for frontend compatibility
                res.write(`0:${JSON.stringify({ type: 'done' })}\n`);
                streamHealthMonitor.completeStream(streamId);
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
      
      screenDataText = `\n\n📊 COMPLETE SCREENSHOT DATA (READ EVERYTHING CAREFULLY):

🖥️ SCREEN INFORMATION:
- Resolution: ${size?.width || 0}x${size?.height || 0}
- Mouse Position: (${mousePos?.x || 0}, ${mousePos?.y || 0})

🪟 ALL WINDOWS API ELEMENTS (${windowsAPI?.elements?.length || 0} total):`;
      
      if (windowsAPI?.elements && windowsAPI.elements.length > 0) {
        windowsAPI.elements.forEach((el, idx) => {
          screenDataText += `\n${idx + 1}. [${el.type}] "${el.name || 'Unknown'}"`;
          screenDataText += `\n   Position: (${el.x}, ${el.y}) Center: (${el.center_x}, ${el.center_y})`;
          screenDataText += `\n   Size: ${el.width}x${el.height}`;
          if (el.isMaximized !== undefined) screenDataText += `\n   Maximized: ${el.isMaximized}`;
          if (el.isMinimized !== undefined) screenDataText += `\n   Minimized: ${el.isMinimized}`;
          if (el.hasCloseButton !== undefined) screenDataText += `\n   Has Close Button: ${el.hasCloseButton}`;
          if (el.hasMaximizeButton !== undefined) screenDataText += `\n   Has Maximize Button: ${el.hasMaximizeButton}`;
          if (el.hasMinimizeButton !== undefined) screenDataText += `\n   Has Minimize Button: ${el.hasMinimizeButton}`;
        });
      } else {
        screenDataText += '\n(No Windows API elements found)';
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
      if (windowsAPI?.elements) {
        const types = {};
        windowsAPI.elements.forEach(el => {
          types[el.type] = (types[el.type] || 0) + 1;
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
async function handleAnthropicChat(req, res, message, history, model, apiKey) {
  try {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
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
      
      toolResultContent = `\n\n📊 COMPLETE SCREENSHOT DATA:

🖥️ SCREEN: ${size?.width || 0}x${size?.height || 0}
🖱️ MOUSE: (${mousePos?.x || 0}, ${mousePos?.y || 0})

🪟 WINDOWS API ELEMENTS (${windowsAPI?.elements?.length || 0}):`;
      
      if (windowsAPI?.elements && windowsAPI.elements.length > 0) {
        windowsAPI.elements.forEach((el, idx) => {
          toolResultContent += `\n${idx + 1}. [${el.type}] "${el.name || 'Unknown'}"`;
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
    console.log(`🤖 Using model: ${requestedModel}`);
    console.log(`💬 User message: ${message.substring(0, 100)}...`);

    // Extract mode, projectId, and customModeId from request body
    const { mode = 'terminal', projectId, customModeId } = req.body;
    console.log(`🎯 Mode: ${mode}, Project ID: ${projectId}, Custom Mode ID: ${customModeId || 'none'}`);

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

    // Get MCP tools for Gemini
    const mcpTools = await getMCPToolsForGemini();
    const useMCPTools = mcpTools.length > 0 && mcpClient && mcpClient.isClientConnected();

    if (useMCPTools) {
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
        
        // Stream text chunks immediately
        const chunkSize = 5;
        for (let i = 0; i < chunkText.length; i += chunkSize) {
          const textChunk = chunkText.slice(i, i + chunkSize);
          res.write(`0:${JSON.stringify({ type: 'text-delta', textDelta: textChunk })}\n`);
        }
        console.log(`📝 Streamed ${chunkText.length} characters`);
      }
      
      // Check for function calls in this chunk
      if (chunk.functionCalls && chunk.functionCalls().length > 0) {
        functionCalls = chunk.functionCalls();
        console.log(`🔧 Function calls detected in stream: ${functionCalls.length}`);
      }
    }
    
    // Get the final response
    const response = await streamResult.response;
    
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

    // Handle MCP tool calls
    // Handle MCP tool calls - NO LOOP, process only first tool call
    if (functionCalls && functionCalls.length > 0) {
      const functionCall = functionCalls[0];
      
      console.log(`🔧 Processing tool call: ${functionCall.name}`);

      // Handle MCP tool calls
      if (useMCPTools && mcpTools.some(t => t.name === functionCall.name)) {
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

    res.status(statusCode).json({
      error: errorMessage,
      details: error.message,
      retryable: statusCode === 503 || statusCode === 504
    });
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
app.post('/api/models/fetch', async (req, res) => {
  try {
    const { apiKey, provider } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    console.log(`🔍 Fetching models from ${provider}...`);

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

server.listen(PORT, () => {
  console.log(`🤖 Kali AI Backend running on port ${PORT}`);
  console.log(`🔐 Gemini API configured: ${process.env.GEMINI_API_KEY ? 'Yes' : 'No'}`);
  console.log(`🔌 WebSocket server running on ws://localhost:${PORT}`);
  console.log(`⏱️  Server timeouts disabled for long-running AI tasks`);
});
