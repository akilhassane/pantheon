require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const WebSocket = require('ws');
const http = require('http');
const MCPClientManager = require('./mcp-client-manager');
const MCPErrorHandler = require('./mcp-error-handler');
const { prepareMCPToolsForGemini } = require('./mcp-to-gemini-tools');
const mcpConfig = require('./config/mcp-config');

const app = express();

app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server for terminal broadcasting
const wss = new WebSocket.Server({ server });

// Store connected frontend clients
const frontendClients = new Set();

wss.on('connection', (ws) => {
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

// Initialize MCP Client Manager with configuration
const mcpClient = new MCPClientManager({
  containerName: process.env.MCP_CONTAINER_NAME || 'kali-pentest',
  serverPath: process.env.MCP_SERVER_PATH || '/app/mcp-server/gotty-direct-writer.js', // Use gotty-direct-writer for terminal visibility
  timeout: mcpConfig.get('mcp.timeout'),
  reconnectAttempts: mcpConfig.get('mcp.reconnect.attempts'),
  reconnectDelay: mcpConfig.get('mcp.reconnect.delay'),
  env: {
    GOTTY_WS_URL: process.env.GOTTY_WS_URL || 'ws://localhost:8080/ws'
  }
});

console.log('🔧 MCP Client Configuration:');
console.log(`   Container: ${process.env.MCP_CONTAINER_NAME || 'kali-pentest'}`);
console.log(`   Server Path: ${process.env.MCP_SERVER_PATH || '/app/mcp-server/gotty-direct-writer.js'}`);
console.log(`   GOTTY_WS_URL: ${process.env.GOTTY_WS_URL || 'ws://localhost:8080/ws'}`);

// Initialize MCP Error Handler with configuration
const mcpErrorHandler = new MCPErrorHandler({
  maxRetries: mcpConfig.get('errorHandling.maxRetries'),
  retryDelay: mcpConfig.get('errorHandling.retryDelay'),
  enableFallback: mcpConfig.get('errorHandling.enableFallback')
});

let mcpToolsCache = null;
let mcpToolsCacheTime = 0;
const MCP_TOOLS_CACHE_DURATION = 60000; // 1 minute

console.log('✅ MCP Client Manager initialized');

// Cleanup on shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await mcpClient.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  await mcpClient.shutdown();
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

    // Check if MCP client is connected
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

    // Check if MCP client is connected
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

        // Notify MCP client output handlers
        mcpClient.handleSharedOutput(decoded);
      }
    } catch (e) {
      console.error('Error parsing GoTTY message:', e.message);
    }
  });

  sharedGoTTYWs.on('close', () => {
    console.log('🔌 Kali Pentest terminal session closed, reconnecting...');
    sharedGoTTYWs = null;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(connectToSharedGoTTY, 1000);
  });

  sharedGoTTYWs.on('error', (err) => {
    console.error('❌ Kali Pentest WebSocket error:', err.message);
    console.error('   Make sure kali-pentest container is running: docker-compose up kali-pentest');
  });
}

// Initialize shared connection on startup
connectToSharedGoTTY();

// Initialize MCP client
async function initializeMCPClient() {
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

    // Check if MCP client is connected
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

// Chat endpoint with MCP integration
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], model: requestedModel = 'gemini-2.5-flash' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`🤖 Using model: ${requestedModel}`);
    console.log(`💬 User message: ${message.substring(0, 100)}...`);

    // Get MCP tools for Gemini
    const mcpTools = await getMCPToolsForGemini();
    const useMCPTools = mcpTools.length > 0 && mcpClient.isClientConnected();

    if (useMCPTools) {
      console.log(`✅ Using ${mcpTools.length} MCP tools for command execution`);
    } else {
      console.log('⚠️  MCP tools not available, AI will respond without tool execution');
    }

    // Build system prompt
    const systemPrompt = useMCPTools ? `${SYSTEM_PROMPT}

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

The conversation history is automatically included in your context. Use it to maintain context across the conversation.` : SYSTEM_PROMPT;

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

    // Send message and get response with retry logic
    let result;
    let response;
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📤 Sending message to Gemini (attempt ${attempt}/${maxRetries})...`);
        result = await chat.sendMessage(message);
        response = result.response;
        console.log('✅ Successfully received response from Gemini');
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt} failed:`, error.message);

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('❌ All retry attempts failed');
          throw new Error(`Failed to connect to Gemini API after ${maxRetries} attempts: ${error.message}`);
        }
      }
    }

    // Extract function calls
    let functionCalls = response.functionCalls || [];
    if (functionCalls.length === 0 && response.candidates && response.candidates[0]) {
      const content = response.candidates[0].content;
      if (content && content.parts) {
        const parts = content.parts || [];
        functionCalls = parts
          .filter(part => part.functionCall)
          .map(part => part.functionCall);
      }
    }

    console.log(`🔧 Function calls detected: ${functionCalls.length}`);

    // Handle MCP tool calls
    let commandOutputs = [];
    let toolCallCount = 0;
    const maxToolCalls = 10; // Prevent infinite loops

    while (functionCalls && functionCalls.length > 0 && toolCallCount < maxToolCalls) {
      const functionCall = functionCalls[0];
      toolCallCount++;

      console.log(`🔧 Processing tool call ${toolCallCount}: ${functionCall.name}`);

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

        // Send function response back to model
        result = await chat.sendMessage([{
          functionResponse: {
            name: functionCall.name,
            response: { output: toolResult.output }
          }
        }]);
        response = result.response;

        // Re-extract function calls
        functionCalls = response.functionCalls || [];
        if (functionCalls.length === 0 && response.candidates && response.candidates[0]) {
          const parts = response.candidates[0].content.parts || [];
          functionCalls = parts
            .filter(part => part.functionCall)
            .map(part => part.functionCall);
        }
      } else {
        // Unknown tool or legacy execute_command
        console.log(`⚠️  Unknown tool: ${functionCall.name}`);
        break;
      }
    }

    if (toolCallCount >= maxToolCalls) {
      console.log('⚠️  Max tool calls reached, stopping');
    }

    // Get final text response
    const fullResponse = response.text();

    res.json({
      response: fullResponse,
      commandOutputs,
      success: true,
      toolCallCount
    });

  } catch (error) {
    console.error('❌ Chat error:', error);

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
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'kali-ai-backend' });
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
server.listen(PORT, () => {
  console.log(`🤖 Kali AI Backend running on port ${PORT}`);
  console.log(`🔐 Gemini API configured: ${process.env.GEMINI_API_KEY ? 'Yes' : 'No'}`);
  console.log(`🔌 WebSocket server running on ws://localhost:${PORT}`);
});
