const { spawn } = require('child_process');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

class MCPContainerClient {
  constructor(containerName = 'kali-pentest', mcpServerPath = '/opt/DesktopCommanderMCP/dist/index.js') {
    this.containerName = containerName;
    this.mcpServerPath = mcpServerPath;
    this.client = null;
    this.process = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
  }

  async connect() {
    try {
      console.log(`[MCP Client] Connecting to MCP server in container ${this.containerName}...`);
      
      // Spawn docker exec process as pentester user (for tmux session access)
      this.process = spawn('docker', [
        'exec',
        '-i',
        '-u', 'pentester',  // CRITICAL: Run as pentester user to access browser terminal
        this.containerName,
        'node',
        this.mcpServerPath
      ]);

      // Handle process errors
      this.process.on('error', (error) => {
        console.error('[MCP Client] Process error:', error.message);
        this.handleDisconnection();
      });

      this.process.on('exit', (code, signal) => {
        console.error(`[MCP Client] Process exited with code ${code}, signal ${signal}`);
        this.connected = false;
        this.handleDisconnection();
      });

      // Log stderr for debugging
      this.process.stderr.on('data', (data) => {
        console.error('[MCP Server]', data.toString().trim());
      });

      // Create MCP client
      this.client = new Client({
        name: 'ai-backend',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      // Connect via stdio transport
      const transport = new StdioClientTransport({
        reader: this.process.stdout,
        writer: this.process.stdin
      });

      await this.client.connect(transport);
      
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log('[MCP Client] ✅ Connected to MCP server in container');

      return true;
    } catch (error) {
      console.error('[MCP Client] Connection failed:', error.message);
      this.connected = false;
      throw error;
    }
  }

  async handleDisconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[MCP Client] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`[MCP Client] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('[MCP Client] Reconnection failed:', error.message);
      }
    }, delay);
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.error('[MCP Client] Error closing client:', error.message);
      }
    }

    if (this.process) {
      this.process.kill();
    }

    this.connected = false;
    console.log('[MCP Client] Disconnected');
  }

  async callTool(name, args) {
    if (!this.connected || !this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`[MCP Client] Calling tool: ${name}`, args);
      
      const result = await this.client.callTool({
        name,
        arguments: args
      });

      console.log('[MCP Client] Tool call result:', result);
      return result;
    } catch (error) {
      console.error('[MCP Client] Tool call error:', error.message);
      throw error;
    }
  }

  async listTools() {
    if (!this.connected || !this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      const result = await this.client.listTools();
      return result.tools;
    } catch (error) {
      console.error('[MCP Client] List tools error:', error.message);
      throw error;
    }
  }

  isConnected() {
    return this.connected;
  }

  async healthCheck() {
    try {
      if (!this.connected) {
        return { healthy: false, error: 'Not connected' };
      }

      // Try to list tools as a health check
      await this.listTools();
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

module.exports = MCPContainerClient;
