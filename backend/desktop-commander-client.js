/**
 * Desktop Commander MCP Client
 * Connects to Desktop Commander running inside the Kali container
 */

const { spawn } = require('child_process');
const EventEmitter = require('events');

class DesktopCommanderClient extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.containerName = options.containerName || 'kali-pentest';
    this.dcPath = options.dcPath || '/opt/DesktopCommanderMCP/build/index.js';
    this.connected = false;
    this.process = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.buffer = '';
  }

  /**
   * Connect to Desktop Commander in the container
   */
  async connect() {
    return new Promise((resolve, reject) => {
      console.log(`🔌 Connecting to Desktop Commander in container: ${this.containerName}`);
      
      try {
        // Spawn docker exec to run Desktop Commander
        this.process = spawn('docker', [
          'exec',
          '-i',
          this.containerName,
          'node',
          this.dcPath
        ]);

        // Set up stdio handlers
        this.process.stdout.on('data', (data) => {
          this.handleOutput(data);
        });

        this.process.stderr.on('data', (data) => {
          console.error('Desktop Commander stderr:', data.toString());
        });

        this.process.on('error', (error) => {
          console.error('Desktop Commander process error:', error);
          this.connected = false;
          this.emit('error', error);
          reject(error);
        });

        this.process.on('exit', (code) => {
          console.log(`Desktop Commander process exited with code ${code}`);
          this.connected = false;
          this.emit('disconnected');
        });

        // Send initialize request
        setTimeout(async () => {
          try {
            await this.initialize();
            this.connected = true;
            console.log('✅ Desktop Commander connected successfully');
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 1000);

      } catch (error) {
        console.error('Failed to spawn Desktop Commander:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle output from Desktop Commander
   */
  handleOutput(data) {
    this.buffer += data.toString();
    
    // Try to parse complete JSON-RPC messages
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const message = JSON.parse(line);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', line, error);
      }
    }
  }

  /**
   * Handle parsed JSON-RPC message
   */
  handleMessage(message) {
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      // Response to a request
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message || 'Unknown error'));
      } else {
        resolve(message.result);
      }
    } else if (message.method) {
      // Notification or request from server
      this.emit('notification', message);
    }
  }

  /**
   * Send JSON-RPC request
   */
  sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.connected) {
        return reject(new Error('Desktop Commander not connected'));
      }

      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      this.pendingRequests.set(id, { resolve, reject });

      // Send request
      const requestStr = JSON.stringify(request) + '\n';
      this.process.stdin.write(requestStr);

      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Initialize MCP connection
   */
  async initialize() {
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: true },
        sampling: {}
      },
      clientInfo: {
        name: 'gemini-backend',
        version: '1.0.0'
      }
    });

    console.log('Desktop Commander initialized:', result);
    return result;
  }

  /**
   * List available tools
   */
  async listTools() {
    const result = await this.sendRequest('tools/list', {});
    return result.tools || [];
  }

  /**
   * Call a tool
   */
  async callTool(name, args = {}) {
    console.log(`🔧 Calling Desktop Commander tool: ${name}`);
    console.log(`   Arguments:`, JSON.stringify(args, null, 2));

    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args
    });

    console.log(`✅ Tool ${name} completed`);
    return result;
  }

  /**
   * Check if client is connected
   */
  isConnected() {
    return this.connected && this.process && !this.process.killed;
  }

  /**
   * Disconnect from Desktop Commander
   */
  async disconnect() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connected = false;
    this.pendingRequests.clear();
    console.log('🔌 Desktop Commander disconnected');
  }
}

module.exports = DesktopCommanderClient;
