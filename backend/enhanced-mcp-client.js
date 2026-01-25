/**
 * Enhanced MCP Client Integration
 * Supports all DesktopCommanderMCP tools with health monitoring and auto-reconnect
 */

const { EventEmitter } = require('events');

class EnhancedMCPClient extends EventEmitter {
  constructor(sharedWebSocketGetter) {
    super();
    this.getSharedWebSocket = sharedWebSocketGetter;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.healthCheckInterval = null;
    this.commandQueue = [];
    this.isProcessingQueue = false;
    this.toolResultCache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache
    this.pendingCommands = new Map();
    this.commandTimeout = 30000; // 30 seconds default timeout
  }

  /**
   * Connect to MCP server with health monitoring
   */
  async connect() {
    if (this.isConnected) {
      console.log('✅ Enhanced MCP client already connected');
      return;
    }

    console.log('🔌 Enhanced MCP Client connecting...');
    
    try {
      await this.waitForSharedWebSocket();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.startHealthCheck();
      console.log('✅ Enhanced MCP Client connected');
      this.emit('connected');
    } catch (error) {
      console.error('❌ Enhanced MCP Client connection failed:', error);
      await this.handleReconnect();
    }
  }

  /**
   * Wait for shared WebSocket to be ready
   */
  async waitForSharedWebSocket(timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkInterval = setInterval(() => {
        const ws = this.getSharedWebSocket();
        if (ws && ws.readyState === 1) {
          clearInterval(checkInterval);
          resolve();
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error('Shared WebSocket connection timeout'));
        }
      }, 100);
    });
  }

  /**
   * Start health check monitoring
   */
  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Check connection health
   */
  async checkHealth() {
    const ws = this.getSharedWebSocket();
    
    if (!ws || ws.readyState !== 1) {
      console.warn('⚠️  MCP connection unhealthy, attempting reconnect...');
      this.isConnected = false;
      this.emit('disconnected');
      await this.handleReconnect();
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await this.connect();
    } catch (error) {
      console.error('❌ Reconnection failed:', error);
      await this.handleReconnect();
    }
  }

  /**
   * Execute command with queuing for reliability
   */
  async executeCommand(command, options = {}) {
    const {
      timeout = this.commandTimeout,
      sessionId = null,
      priority = false
    } = options;

    const commandRequest = {
      command,
      timeout,
      sessionId,
      timestamp: Date.now()
    };

    if (priority) {
      this.commandQueue.unshift(commandRequest);
    } else {
      this.commandQueue.push(commandRequest);
    }

    this.processQueue();

    return new Promise((resolve, reject) => {
      const commandId = `cmd_${Date.now()}_${Math.random()}`;
      
      const timeoutId = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        reject(new Error(`Command timeout after ${timeout}ms`));
      }, timeout);

      this.pendingCommands.set(commandId, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          this.pendingCommands.delete(commandId);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          this.pendingCommands.delete(commandId);
          reject(error);
        },
        command,
        timeoutId
      });

      this.executeCommandInternal(command, commandId, timeout);
    });
  }

  /**
   * Internal command execution
   */
  async executeCommandInternal(command, commandId, timeout) {
    try {
      const ws = this.getSharedWebSocket();
      
      if (!ws || ws.readyState !== 1) {
        throw new Error('WebSocket not available');
      }

      let output = '';
      let outputTimeout;
      
      const outputHandler = (data) => {
        output += data;
        
        if (outputTimeout) clearTimeout(outputTimeout);
        outputTimeout = setTimeout(() => {
          const pending = this.pendingCommands.get(commandId);
          if (pending) {
            const cleanOutput = this.cleanOutput(output);
            pending.resolve({
              command,
              output: cleanOutput || 'Command executed',
              exitCode: 0,
              success: true
            });
          }
        }, 2000);
      };

      // Register temporary output handler
      const handlerKey = `handler_${commandId}`;
      this.on(handlerKey, outputHandler);

      // Send command
      const fullCommand = command + '\n';
      const base64Command = Buffer.from(fullCommand).toString('base64');
      const message = '1' + base64Command;
      
      ws.send(message);
      console.log(`✅ Command sent: ${command}`);

      // Cleanup handler after timeout
      setTimeout(() => {
        this.removeListener(handlerKey, outputHandler);
      }, timeout + 1000);

    } catch (error) {
      const pending = this.pendingCommands.get(commandId);
      if (pending) {
        pending.reject(error);
      }
    }
  }

  /**
   * Process command queue
   */
  async processQueue() {
    if (this.isProcessingQueue || this.commandQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.commandQueue.length > 0) {
      const request = this.commandQueue.shift();
      
      try {
        await this.executeCommand(request.command, {
          timeout: request.timeout,
          sessionId: request.sessionId
        });
      } catch (error) {
        console.error('Queue processing error:', error);
      }

      // Small delay between commands
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessingQueue = false;
  }

  /**
   * Handle output from shared WebSocket
   */
  handleSharedOutput(data) {
    // Emit to all registered handlers
    this.emit('output', data);
    
    // Emit to specific command handlers
    this.pendingCommands.forEach((pending, commandId) => {
      this.emit(`handler_${commandId}`, data);
    });
  }

  /**
   * Clean ANSI codes and formatting from output
   */
  cleanOutput(output) {
    return output
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // Remove ANSI codes
      .replace(/\r/g, '')
      .trim();
  }

  /**
   * List directory (DesktopCommanderMCP tool)
   */
  async listDirectory(path, options = {}) {
    const { recursive = false, includeHidden = false } = options;
    
    let command = `ls -la ${path}`;
    if (recursive) {
      command = `find ${path} -type f`;
    }
    
    const result = await this.executeCommand(command);
    return this.parseDirectoryListing(result.output);
  }

  /**
   * Read file (DesktopCommanderMCP tool)
   */
  async readFile(path, options = {}) {
    const { encoding = 'utf8' } = options;
    
    const command = `cat ${path}`;
    const result = await this.executeCommand(command);
    
    return {
      path,
      content: result.output,
      encoding
    };
  }

  /**
   * Write file (DesktopCommanderMCP tool)
   */
  async writeFile(path, content, options = {}) {
    const { mode = 'overwrite' } = options;
    
    // Escape content for shell
    const escapedContent = content.replace(/'/g, "'\\''");
    const operator = mode === 'append' ? '>>' : '>';
    const command = `echo '${escapedContent}' ${operator} ${path}`;
    
    const result = await this.executeCommand(command);
    
    return {
      path,
      success: result.success,
      mode
    };
  }

  /**
   * Search files (DesktopCommanderMCP tool)
   */
  async searchFiles(pattern, path = '.', options = {}) {
    const { filePattern = '*' } = options;
    
    const command = `grep -r "${pattern}" ${path} --include="${filePattern}"`;
    const result = await this.executeCommand(command);
    
    return this.parseSearchResults(result.output);
  }

  /**
   * Get system info (DesktopCommanderMCP tool)
   */
  async getSystemInfo() {
    const commands = [
      'uname -a',
      'whoami',
      'pwd',
      'hostname'
    ];

    const results = await Promise.all(
      commands.map(cmd => this.executeCommand(cmd))
    );

    return {
      system: results[0].output,
      user: results[1].output,
      workingDirectory: results[2].output,
      hostname: results[3].output
    };
  }

  /**
   * Parse directory listing output
   */
  parseDirectoryListing(output) {
    const lines = output.split('\n').filter(line => line.trim() !== '');
    const entries = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 9) {
        entries.push({
          permissions: parts[0],
          name: parts.slice(8).join(' '),
          size: parts[4],
          isDirectory: parts[0].startsWith('d')
        });
      }
    }

    return entries;
  }

  /**
   * Parse search results
   */
  parseSearchResults(output) {
    const lines = output.split('\n').filter(line => line.trim() !== '');
    const results = [];

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        results.push({
          file: line.substring(0, colonIndex),
          match: line.substring(colonIndex + 1).trim()
        });
      }
    }

    return results;
  }

  /**
   * Cache tool result
   */
  cacheResult(key, result) {
    this.toolResultCache.set(key, {
      result,
      timestamp: Date.now()
    });

    // Auto-cleanup old cache entries
    setTimeout(() => {
      this.toolResultCache.delete(key);
    }, this.cacheTimeout);
  }

  /**
   * Get cached result
   */
  getCachedResult(key) {
    const cached = this.toolResultCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }
    return null;
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect() {
    console.log('🔌 Disconnecting Enhanced MCP Client...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.pendingCommands.clear();
    this.commandQueue = [];
    this.toolResultCache.clear();
    this.isConnected = false;
    
    this.emit('disconnected');
    console.log('✅ Enhanced MCP Client disconnected');
  }

  /**
   * Get connection status
   */
  getStatus() {
    const ws = this.getSharedWebSocket();
    
    return {
      isConnected: this.isConnected,
      websocketReady: ws && ws.readyState === 1,
      reconnectAttempts: this.reconnectAttempts,
      queueLength: this.commandQueue.length,
      pendingCommands: this.pendingCommands.size,
      cacheSize: this.toolResultCache.size
    };
  }
}

module.exports = EnhancedMCPClient;
