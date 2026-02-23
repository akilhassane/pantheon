/**
 * MCP Client Manager
 * Manages the lifecycle of the MCP server process and provides a clean interface for tool calls
 */

const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const path = require('path');
const PTYWriter = require('./pty-writer');

class MCPClientManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      serverPath: options.serverPath || path.join(__dirname, '../mcp-server/gotty-direct-writer.js'),
      serverArgs: options.serverArgs || [],
      reconnectAttempts: options.reconnectAttempts || 5,
      reconnectDelay: options.reconnectDelay || 1000,
      timeout: options.timeout || 30000,
      containerName: options.containerName || 'kali-pentest',
      mcpEnv: options.env || {},
      ...options
    };

    this.serverProcess = null;
    this.isConnected = false;
    this.reconnectCount = 0;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.healthCheckInterval = null;
    this.initializationPromise = null;
    this.outputBuffer = ''; // Buffer for incomplete JSON
    
    // Initialize PTY Writer for visual display (writes directly to PTY, no WebSocket conflicts)
    this.ptyWriter = new PTYWriter(this.options.containerName);
    
    // NEW: Session context manager for terminal context awareness
    this.sessionManager = options.sessionManager || null;
  }

  /**
   * Initialize the MCP client and spawn the server process
   */
  async initialize() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  async _doInitialize() {
    try {
      console.log('🔌 Initializing MCP Client Manager...');
      console.log(`📂 Server path: ${this.options.serverPath}`);
      console.log(`📦 Container: ${this.options.containerName}`);

      // Validate configuration
      if (!this.options.containerName) {
        throw new Error('Container name is required');
      }

      if (!this.options.serverPath) {
        throw new Error('Server path is required');
      }

      // Prepare and validate environment variables
      // Use container-specific WebSocket URL for terminal connection
      const gottyWsUrl = `ws://${this.options.containerName}:8080/ws`;
      const mcpEnv = {
        GOTTY_WS_URL: gottyWsUrl,
        ...this.options.mcpEnv
      };

      console.log(`🔗 Terminal WebSocket URL: ${gottyWsUrl}`);

      // Validate required environment variables
      if (!mcpEnv.GOTTY_WS_URL) {
        throw new Error('GOTTY_WS_URL environment variable is required for MCP server');
      }

      console.log('🔧 Validated environment variables for MCP server:');
      Object.entries(mcpEnv).forEach(([key, value]) => {
        console.log(`   ${key}=${value}`);
      });

      // Store validated environment for spawn
      this.options.mcpEnv = mcpEnv;

      // Spawn the MCP server process
      await this.spawnServer();

      // Send initialize request
      await this.sendInitializeRequest();

      // Start health check
      this.startHealthCheck();

      this.isConnected = true;
      this.reconnectCount = 0;

      console.log('✅ MCP Client Manager initialized successfully');
      this.emit('connected');

      return true;
    } catch (error) {
      console.error('❌ MCP Client Manager initialization failed:', error.message);
      this.isConnected = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Spawn the MCP server process
   */
  async spawnServer() {
    return new Promise((resolve, reject) => {
      try {
        console.log('🚀 Spawning MCP server process...');
        
        // Prepare environment variables for MCP server
        // Use container-specific WebSocket URL for terminal connection
        const gottyWsUrl = `ws://${this.options.containerName}:8080/ws`;
        
        // Build environment - container-specific URL should override defaults
        const mcpEnv = {
          ...process.env,
          ...this.options.mcpEnv,
          GOTTY_WS_URL: gottyWsUrl  // Override last to ensure it's used
        };
        
        console.log(`🔗 Terminal WebSocket URL: ${gottyWsUrl}`);

        // Check if we should run on host or in container
        const useHostProcess = this.options.useHostProcess || !this.options.containerName;
        
        let command, args;
        
        if (useHostProcess) {
          // Run directly on host (for gotty-direct-writer)
          console.log(`💻 Running on host`);
          console.log(`📂 Server path: ${this.options.serverPath}`);
          
          command = 'node';
          args = [this.options.serverPath, ...this.options.serverArgs];
          
          console.log(`🖥️  Host command: ${command} ${args.join(' ')}`);
        } else {
          // Run in container (for desktop-commander)
          console.log(`📦 Container: ${this.options.containerName}`);
          console.log(`📂 Server path: ${this.options.serverPath}`);
          
          // Build docker exec command with environment variables
          command = 'docker';
          args = ['exec', '-i', '-u', 'pentester'];  // CRITICAL: Run as pentester user
          
          // Add environment variables as -e flags
          Object.entries(mcpEnv).forEach(([key, value]) => {
            if (key !== 'PATH' && key !== 'HOME') { // Skip system env vars
              args.push('-e', `${key}=${value}`);
            }
          });
          
          // Add container name and command
          args.push(
            this.options.containerName,
            'node',
            this.options.serverPath,
            ...this.options.serverArgs
          );
          
          console.log(`🐳 Docker command: ${command} ${args.join(' ')}`);
        }

        console.log(`🔧 Environment variables for MCP server:`);
        Object.entries(mcpEnv).forEach(([key, value]) => {
          if (key === 'GOTTY_WS_URL' || key.startsWith('MCP_')) {
            console.log(`   ${key}=${value}`);
          }
        });

        this.serverProcess = spawn(command, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: useHostProcess ? mcpEnv : process.env
        });

        // Handle stdout (JSON-RPC responses)
        this.serverProcess.stdout.on('data', (data) => {
          this.handleServerOutput(data);
        });

        // Handle stderr (logs)
        this.serverProcess.stderr.on('data', (data) => {
          const message = data.toString().trim();
          if (message) {
            console.log(`[MCP Server ${this.options.containerName}] ${message}`);
          }
        });

        // Handle process exit
        this.serverProcess.on('exit', (code, signal) => {
          console.log(`⚠️  MCP server process exited with code ${code}, signal ${signal}`);
          this.isConnected = false;
          this.serverProcess = null;
          this.emit('disconnected', { code, signal });

          // Attempt reconnection
          if (this.reconnectCount < this.options.reconnectAttempts) {
            this.handleReconnect();
          }
        });

        // Handle process errors
        this.serverProcess.on('error', (error) => {
          console.error(`❌ MCP server process error (container: ${this.options.containerName}):`, error.message);
          console.error(`❌ Failed docker command: ${dockerCmd} ${dockerArgs.join(' ')}`);
          reject(error);
        });

        // Wait a bit for the process to start
        setTimeout(() => {
          if (this.serverProcess && !this.serverProcess.killed) {
            const location = useHostProcess ? 'on host' : `in container ${this.options.containerName}`;
            console.log(`✅ MCP server process spawned successfully ${location}`);
            resolve();
          } else {
            reject(new Error(`MCP server process failed to start in container ${this.options.containerName}`));
          }
        }, 1000);

      } catch (error) {
        console.error(`❌ Failed to spawn MCP server in container ${this.options.containerName}:`, error);
        reject(error);
      }
    });
  }

  /**
   * Send initialize request to MCP server
   */
  async sendInitializeRequest() {
    const request = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'kali-ai-backend',
          version: '1.0.0'
        }
      }
    };

    const result = await this.sendRequest(request);
    
    // After receiving initialize response, send initialized notification
    await this.sendInitializedNotification();
    
    return result;
  }

  /**
   * Send initialized notification to complete MCP handshake
   */
  async sendInitializedNotification() {
    const notification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {}
    };

    // Send notification (no response expected)
    this.writeToServer(notification);
    console.log('✅ Sent initialized notification to MCP server');
  }

  /**
   * Write a message to the MCP server (for notifications that don't expect a response)
   */
  writeToServer(message) {
    if (!this.serverProcess || this.serverProcess.killed) {
      throw new Error('MCP server process not running');
    }

    const messageStr = JSON.stringify(message) + '\n';
    this.serverProcess.stdin.write(messageStr);
  }

  /**
   * Handle output from the MCP server
   */
  handleServerOutput(data) {
    // Add new data to buffer
    this.outputBuffer += data.toString();
    
    // Try to extract complete JSON objects (separated by newlines)
    const lines = this.outputBuffer.split('\n');
    
    // Keep the last incomplete line in the buffer
    this.outputBuffer = lines.pop() || '';
    
    // Process complete lines
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const response = JSON.parse(line);

        // Handle response to pending request
        if (response.id !== undefined && this.pendingRequests.has(response.id)) {
          const { resolve, reject, timeout } = this.pendingRequests.get(response.id);
          clearTimeout(timeout);
          this.pendingRequests.delete(response.id);

          if (response.error) {
            reject(new Error(response.error.message || 'MCP request failed'));
          } else {
            resolve(response.result);
          }
        }

        // Handle notifications
        if (response.method && !response.id) {
          this.emit('notification', response);
        }

      } catch (error) {
        // Not JSON, might be a log message
        console.log(`[MCP Server Output] ${line}`);
      }
    }
  }

  /**
   * Send a request to the MCP server
   */
  async sendRequest(request, timeout = this.options.timeout) {
    return new Promise((resolve, reject) => {
      if (!this.serverProcess || this.serverProcess.killed) {
        return reject(new Error('MCP server process not running'));
      }

      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(request.id, { resolve, reject, timeout: timeoutId });

      const requestStr = JSON.stringify(request) + '\n';
      this.serverProcess.stdin.write(requestStr);
    });
  }

  /**
   * Call an MCP tool
   */
  async callTool(toolName, args = {}) {
    if (!this.isConnected) {
      throw new Error('MCP client not connected');
    }

    console.log(`🔧 Calling MCP tool: ${toolName}`);
    console.log(`📝 Arguments:`, JSON.stringify(args, null, 2));

    // Echo command to terminal for visual display (if it's start_process or write_command)
    if ((toolName === 'start_process' || toolName === 'write_command') && args.command && this.ptyWriter) {
      console.log('🖥️  Echoing command to browser terminal via PTY...');
      try {
        await this.ptyWriter.writeCommand(args.command);
      } catch (error) {
        console.log('⚠️  Failed to echo to terminal:', error.message);
        // Continue anyway - echo is optional
      }
    }

    const request = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    try {
      const result = await this.sendRequest(request);
      console.log(`✅ Tool ${toolName} completed successfully`);
      return result;
    } catch (error) {
      console.error(`❌ Tool ${toolName} failed:`, error.message);
      throw error;
    }
  }

  /**
   * List available tools from the MCP server
   */
  async listTools() {
    if (!this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const request = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/list',
      params: {}
    };

    const result = await this.sendRequest(request);
    return result.tools || [];
  }

  /**
   * Check if the client is connected
   */
  isClientConnected() {
    return this.isConnected && this.serverProcess && !this.serverProcess.killed;
  }

  /**
   * Start health check monitoring
   */
  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      if (!this.isClientConnected()) {
        console.warn('⚠️  MCP client health check failed');
        this.isConnected = false;
        this.emit('unhealthy');

        if (this.reconnectCount < this.options.reconnectAttempts) {
          this.handleReconnect();
        }
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Handle reconnection with exponential backoff
   */
  async handleReconnect() {
    this.reconnectCount++;
    const delay = this.options.reconnectDelay * Math.pow(2, this.reconnectCount - 1);

    console.log(`🔄 Attempting reconnection ${this.reconnectCount}/${this.options.reconnectAttempts} in ${delay}ms...`);
    console.log(`🔄 Will retry docker exec to container: ${this.options.containerName}`);
    this.emit('reconnecting', { attempt: this.reconnectCount, delay });

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      this.initializationPromise = null;
      await this.initialize();
      console.log('✅ Reconnection successful');
    } catch (error) {
      console.error('❌ Reconnection failed:', error.message);

      // Check if it's a container access error
      if (error.message.includes('container') || error.message.includes('docker')) {
        console.error(`❌ Container ${this.options.containerName} may not be running or accessible`);
        console.error(`💡 Verify container is running: docker ps | grep ${this.options.containerName}`);
      }

      if (this.reconnectCount < this.options.reconnectAttempts) {
        await this.handleReconnect();
      } else {
        console.error('❌ Max reconnection attempts reached');
        console.error(`❌ Failed to connect to MCP server in container ${this.options.containerName}`);
        this.emit('reconnect_failed');
      }
    }
  }

  /**
   * Get next request ID
   */
  getNextRequestId() {
    return ++this.requestId;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      serverRunning: this.serverProcess && !this.serverProcess.killed,
      serverPid: this.serverProcess ? this.serverProcess.pid : null,
      reconnectAttempts: this.reconnectCount,
      pendingRequests: this.pendingRequests.size
    };
  }

  /**
   * Shutdown the MCP client and cleanup resources
   */
  async shutdown() {
    console.log('🛑 Shutting down MCP Client Manager...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Clear pending requests
    for (const [id, { reject, timeout }] of this.pendingRequests.entries()) {
      clearTimeout(timeout);
      reject(new Error('MCP client shutting down'));
    }
    this.pendingRequests.clear();

    // Kill server process
    if (this.serverProcess && !this.serverProcess.killed) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }

    this.isConnected = false;
    this.emit('shutdown');

    console.log('✅ MCP Client Manager shutdown complete');
  }

  /**
   * Call MCP tool with automatic session context injection
   * @param {string} conversationId - Conversation identifier
   * @param {string} toolName - Tool to call
   * @param {Object} args - Tool arguments
   * @returns {Promise<Object>} Tool response
   */
  async callToolWithContext(conversationId, toolName, args = {}) {
    if (!this.sessionManager) {
      console.warn('[MCP] No session manager configured, calling tool without context');
      return this.callTool(toolName, args);
    }

    // CRITICAL: Always use "shared" tmux session for visibility in browser
    // The browser terminal at http://localhost:8080 is attached to the "shared" session
    const tmuxSessionId = 'shared';

    // Inject tmux session ID into tool arguments
    const enhancedArgs = {
      ...args,
      tmuxSessionId
    };

    console.log(`[MCP] Calling ${toolName} with session ${tmuxSessionId} for conversation ${conversationId}`);

    try {
      // Call the tool
      const response = await this.callTool(toolName, enhancedArgs);

      // Parse response for state changes if it's a command execution
      if ((toolName === 'write_command' || toolName === 'start_process') && args.command) {
        const command = args.command;
        const output = response.content?.[0]?.text || '';

        // Update session context
        this.sessionManager.addCommandToHistory(tmuxSessionId, {
          command,
          output,
          exitCode: response.metadata?.exitCode || 0,
          duration: response.metadata?.executionTime || 0
        });

        // Parse for state changes
        this.sessionManager.parseCommandForStateChanges(tmuxSessionId, command, output);
      }

      return response;
    } catch (error) {
      console.error(`[MCP] Tool ${toolName} failed:`, error.message);
      throw error;
    }
  }

  /**
   * Generate AI system prompt with session context
   * @param {string} conversationId - Conversation identifier
   * @param {string} basePrompt - Base system prompt
   * @returns {string} Complete system prompt with context
   */
  generateSystemPrompt(conversationId, basePrompt) {
    if (!this.sessionManager) {
      console.warn('[MCP] No session manager configured, returning base prompt');
      return basePrompt;
    }

    // CRITICAL: Always use "shared" tmux session for visibility in browser
    const tmuxSessionId = 'shared';

    // Generate context prompt
    const contextPrompt = this.sessionManager.generateContextPrompt(tmuxSessionId);

    // Combine base prompt with context
    return basePrompt + contextPrompt;
  }

  /**
   * Set session manager
   * @param {Object} sessionManager - Session context manager instance
   */
  setSessionManager(sessionManager) {
    this.sessionManager = sessionManager;
    console.log('[MCP] Session manager configured');
  }
}

module.exports = MCPClientManager;
