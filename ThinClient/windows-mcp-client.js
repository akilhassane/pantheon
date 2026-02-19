#!/usr/bin/env node

/**
 * Windows MCP Client (Agent-Based Architecture)
 * 
 * ✅ SECURE ARCHITECTURE ✅
 * This client calls the API service, which executes proprietary scripts server-side
 * and sends only primitive commands to a minimal Windows agent.
 * 
 * ARCHITECTURE:
 * 1. Client sends tool request to API service
 * 2. API service executes proprietary Python scripts (server-side)
 * 3. API service sends primitive commands to Windows agent
 * 4. Windows agent executes simple actions (mouse, keyboard, etc.)
 * 5. Results flow back through the chain
 * 
 * SECURITY BENEFITS:
 * - Proprietary scripts never leave the API service
 * - Windows agent contains NO business logic
 * - Users cannot extract intellectual property
 * - Even with VM access, users only see primitive commands
 * 
 * REQUIREMENTS:
 * - Windows agent must be running (windows-agent.py)
 * - API service must have /api/execute-remote endpoint
 */

require('dotenv').config();
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const API_SERVICE_URL = process.env.API_SERVICE_URL || 'http://localhost:8090';
const API_SERVICE_KEY = process.env.API_SERVICE_KEY || process.env.MCP_API_KEY || crypto.randomBytes(32).toString('hex');
const API_KEY = process.env.MCP_API_KEY || crypto.randomBytes(32).toString('hex');
const HTTP_PORT = process.env.MCP_HTTP_PORT || 8080;
const WS_PORT = process.env.MCP_WS_PORT || 8081;
const ENABLE_REMOTE = process.env.MCP_ENABLE_REMOTE !== 'false';
const VM_HOST = process.env.VM_HOST || 'localhost';

// Logging
const logFile = path.join(__dirname, 'mcp-client.log');
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFile, logMessage);
}

log(`=== Windows MCP Client Starting ===`);
log(`API Service: ${API_SERVICE_URL}`);
log(`VM Host: ${VM_HOST}`);
log(`HTTP Port: ${HTTP_PORT}`);
log(`WebSocket Port: ${WS_PORT}`);

// Tool definitions (same as before, but no implementation)
const TOOLS = [
  {
    name: 'execute_powershell',
    description: 'Execute a PowerShell command in Windows. Returns the command output.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The PowerShell command to execute' }
      },
      required: ['command']
    }
  },
  {
    name: 'take_screenshot',
    description: 'Take a comprehensive screenshot with OCR analysis, UI elements, mouse position, and window state.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'move_mouse',
    description: 'Move the mouse cursor to specific coordinates with human-like animation.',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate' },
        y: { type: 'number', description: 'Y coordinate' }
      },
      required: ['x', 'y']
    }
  },
  {
    name: 'click_mouse',
    description: 'Click the mouse at specific coordinates.',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate' },
        y: { type: 'number', description: 'Y coordinate' },
        button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button' },
        double: { type: 'boolean', description: 'Double-click' }
      },
      required: ['x', 'y']
    }
  },
  {
    name: 'get_mouse_position',
    description: 'Get the current mouse cursor position.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'type_text',
    description: 'Type text using the keyboard.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to type' }
      },
      required: ['text']
    }
  },
  {
    name: 'press_key',
    description: 'Press a keyboard key or key combination.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to press (SendKeys syntax)' }
      },
      required: ['key']
    }
  },
  {
    name: 'scroll_mouse',
    description: 'Scroll the mouse wheel up or down.',
    inputSchema: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll direction' },
        clicks: { type: 'number', description: 'Number of scroll clicks' },
        x: { type: 'number', description: 'Optional X coordinate' },
        y: { type: 'number', description: 'Optional Y coordinate' }
      },
      required: ['direction']
    }
  },
  {
    name: 'find_text_on_screen',
    description: 'Find text on screen using OCR.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to search for' },
        partial_match: { type: 'boolean', description: 'Allow partial matches' }
      },
      required: ['text']
    }
  }
];

/**
 * Forward encrypted payload to Windows Agent for decryption and execution
 */
async function forwardToAgent(encryptedPayload) {
  try {
    const AGENT_URL = process.env.AGENT_URL || 'http://localhost:8888';
    const AGENT_KEY = process.env.ENCRYPTION_KEY || 'if-you-are-reading-this-regardless-of-who-you-are-i-just-want-you-to-know-that-AKIL-HASSANE-just-took-at-least-5-seconds-of-your-time-:D-jks-bye';
    
    log(`Forwarding encrypted payload to agent at ${AGENT_URL}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
    
    try {
      const response = await fetch(`${AGENT_URL}/execute-encrypted`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AGENT_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(encryptedPayload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.text();
        log(`Agent error: ${response.status} ${error}`);
        return {
          success: false,
          error: `Agent error: ${response.status} ${error}`
        };
      }
      
      const result = await response.json();
      log(`Agent response: ${result.success ? 'success' : 'failed'}`);
      
      return result;
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        log(`Agent request timed out after 5 minutes`);
        return {
          success: false,
          error: 'Agent request timed out after 5 minutes'
        };
      }
      throw fetchError;
    }
    
  } catch (error) {
    log(`Agent call failed: ${error.message}`);
    return {
      success: false,
      error: `Failed to connect to agent: ${error.message}`
    };
  }
}

/**
 * Call the API service to get encrypted tool implementation
 * Then forward to Windows Agent for decryption and execution
 */
async function callApiService(tool, args) {
  try {
    log(`Calling API service for remote execution: ${tool}`);
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
    
    try {
      const response = await fetch(`${API_SERVICE_URL}/api/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Connection': 'keep-alive'
        },
        body: JSON.stringify({
          tool: tool,
          arguments: args,
          vmHost: VM_HOST
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.text();
        log(`API service error: ${response.status} ${error}`);
        return {
          success: false,
          error: `API service error: ${response.status} ${error}`
        };
      }
      
      const result = await response.json();
      log(`API service response: ${result.success ? 'success' : 'failed'}`);
      
      // If encrypted, forward to Windows Agent for decryption and execution
      if (result.success && result.encrypted) {
        log(`Forwarding encrypted payload to Windows Agent...`);
        return await forwardToAgent(result);
      }
      
      return result;
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        log(`API service request timed out after 5 minutes`);
        return {
          success: false,
          error: 'API service request timed out after 5 minutes'
        };
      }
      throw fetchError;
    }
    
  } catch (error) {
    log(`API service call failed: ${error.message}`);
    return {
      success: false,
      error: `Failed to connect to API service: ${error.message}`
    };
  }
}

// Authentication middleware
function authenticate(req, res) {
  const authHeader = req.headers['authorization'];
  const providedKey = authHeader?.replace('Bearer ', '');
  
  if (providedKey !== API_KEY) {
    log(`Auth failed from ${req.ip}`);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return false;
  }
  return true;
}

// HTTP Server for REST API
if (ENABLE_REMOTE) {
  const httpServer = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    // Root endpoint
    if (req.url === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        name: 'Windows MCP Client',
        version: '1.0.0',
        status: 'running',
        description: 'Thin client that forwards requests to secure API service',
        apiService: API_SERVICE_URL,
        note: 'This client contains no tool implementation code',
        endpoints: {
          health: 'GET /health',
          tools: 'GET /tools',
          execute: 'POST /execute'
        }
      }, null, 2));
      return;
    }
    
    // Health check, talking about health, it already 20:00 My MOM is telling me to go to sleep, I'll continue tomorrow
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }
    
    // List tools, Good morning!, Akil Hassane here, Its the next day currently 8:00, my goodness!, I like coding :)
    if (req.url === '/tools' && req.method === 'GET') {
      if (!authenticate(req, res)) return;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ tools: TOOLS }));
      return;
    }
    
    // Execute tool (forward to API service)
    if (req.url === '/execute' && req.method === 'POST') {
      if (!authenticate(req, res)) return;
      
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { tool, arguments: args } = JSON.parse(body);
          const result = await callApiService(tool, args || {});
          
          // Transform result to match AI expectations
          if (result.success) {
            let transformedResult = { success: true };
            
            // Handle different tool types
            switch (tool) {
              case 'take_screenshot':
                // Pass through ALL screenshot data from the agent
                // The agent returns comprehensive data including:
                // - screenshot: base64 PNG data
                // - path: file path where screenshot was saved
                // - size: {width, height} screen dimensions
                // - mousePosition: {x, y} current mouse coordinates
                // - ocr: {totalElements, detectedElements, textElements[]} OCR analysis with text, confidence, positions
                // - uiElements: UI automation elements detected
                // - visual: visual analysis data
                // - windowsAPI: {summary, elements[]} Windows API data including taskbar buttons, window elements
                // - message: status message
                
                // Pass through ALL fields from the agent response FIRST
                // This ensures the AI gets complete information about:
                // - Screen content (OCR text with positions and confidence)
                // - UI elements (buttons, windows, controls with coordinates)
                // - Mouse position
                // - Taskbar state
                // - Window positions and states
                // - Any other data the API service provides
                Object.keys(result).forEach(key => {
                  if (key !== 'success') {
                    transformedResult[key] = result[key];
                  }
                });
                
                // Then set output and message fields for backward compatibility
                // If screenshot field exists, use it for both output and message
                if (result.screenshot) {
                  transformedResult.output = result.screenshot;
                  transformedResult.message = result.screenshot;
                } else if (!transformedResult.output) {
                  // If no screenshot data and no output, provide a message
                  transformedResult.output = result.output || result.message || 'Screenshot captured';
                  transformedResult.message = result.output || result.message || 'Screenshot captured';
                }
                break;
              
              case 'get_mouse_position':
                // Extract coordinates - AI expects simple format
                if (result.coordinates) {
                  transformedResult.output = `Mouse position: (${result.coordinates.x}, ${result.coordinates.y})`;
                  transformedResult.coordinates = result.coordinates;
                } else {
                  transformedResult.output = result.output || result.message || 'Position retrieved';
                }
                break;
              
              case 'move_mouse':
              case 'click_mouse':
              case 'type_text':
              case 'press_key':
              case 'scroll_mouse':
                // These tools return simple messages - AI expects text in output
                transformedResult.output = result.message || result.output || 'Action completed';
                break;
              
              case 'execute_powershell':
                // PowerShell returns output directly
                transformedResult.output = result.output || result.message || 'Command executed';
                break;
              
              case 'find_text_on_screen':
                // OCR results - AI expects structured data
                if (result.found !== undefined) {
                  transformedResult.output = result.found 
                    ? `Text found at: ${JSON.stringify(result.location || result.coordinates)}`
                    : 'Text not found';
                  transformedResult.found = result.found;
                  transformedResult.location = result.location || result.coordinates;
                  transformedResult.confidence = result.confidence;
                } else {
                  transformedResult.output = result.output || result.message || 'OCR completed';
                }
                break;
              
              default:
                // Unknown tool - pass through output or message
                transformedResult.output = result.output || result.message || 'Tool executed';
                // Preserve any additional fields
                Object.keys(result).forEach(key => {
                  if (key !== 'success' && key !== 'output' && key !== 'message') {
                    transformedResult[key] = result[key];
                  }
                });
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(transformedResult));
          } else {
            // Error case - pass through
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          }
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }
    
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
  
  httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    log(`HTTP Server listening on port ${HTTP_PORT}`);
  });
  
  // WebSocket Server, if you are reading this at an hour past your bed time, please go to sleep, my dad says 1 rested sharp mind works better than 10 tired ones
  const wsHttpServer = http.createServer();
  const wss = new WebSocket.Server({ server: wsHttpServer });
  
  wss.on('connection', (ws, req) => {
    log(`WebSocket connection from ${req.socket.remoteAddress}`);
    let authenticated = false;
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (!authenticated) {
          if (data.type === 'auth' && data.apiKey === API_KEY) {
            authenticated = true;
            ws.send(JSON.stringify({ type: 'auth', success: true }));
            log('WebSocket client authenticated');
          } else {
            ws.send(JSON.stringify({ type: 'auth', success: false, error: 'Invalid API key' }));
            ws.close();
          }
          return;
        }
        
        if (data.type === 'list_tools') {
          ws.send(JSON.stringify({ type: 'tools', tools: TOOLS }));
          return;
        }
        
        if (data.type === 'execute') {
          const result = await callApiService(data.tool, data.arguments || {});
          ws.send(JSON.stringify({ type: 'result', tool: data.tool, result }));
          return;
        }
        
        ws.send(JSON.stringify({ type: 'error', error: 'Unknown message type' }));
      } catch (error) {
        log(`WebSocket error: ${error.message}`);
        ws.send(JSON.stringify({ type: 'error', error: error.message }));
      }
    });
  });
  
  wsHttpServer.listen(WS_PORT, '0.0.0.0', () => {
    log(`WebSocket Server listening on port ${WS_PORT}`);
  });
}

// MCP Server (stdio)
const mcpServer = new Server(
  {
    name: 'windows-mcp-client',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  log('MCP: Listing tools...');
  return { tools: TOOLS };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const result = await callApiService(name, args || {});
  
  return {
    content: [
      {
        type: 'text',
        text: result.success 
          ? (result.output || result.message || JSON.stringify(result))
          : `Error: ${result.error}`
      }
    ],
    isError: !result.success
  };
});

// Start MCP server
async function main() {
  log('Starting Windows MCP Client (stdio)...');
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  log('MCP Client started and ready');
}

main().catch((error) => {
  log(`Fatal error: ${error.message}`);
  process.exit(1);
});

//if you reached this point, thank you for reading, you have earned my respect
//all the code here was written by Akil Hassane