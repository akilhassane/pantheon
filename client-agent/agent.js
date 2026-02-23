// Pantheon Client Agent - Runs on client machines
const Docker = require('dockerode');
const WebSocket = require('ws');
const os = require('os');
require('dotenv').config();

class PantheonClientAgent {
  constructor() {
    this.docker = new Docker();
    this.backendUrl = process.env.BACKEND_URL || 'ws://localhost:3003';
    this.userId = process.env.USER_ID || null;
    this.agentId = process.env.AGENT_ID || this.generateAgentId();
    this.ws = null;
    this.reconnectInterval = 5000;
    this.heartbeatInterval = null;
  }

  generateAgentId() {
    return `${os.hostname()}-${Date.now()}`;
  }

  async connect() {
    // Build WebSocket URL with query parameters
    const wsUrl = new URL(this.backendUrl);
    wsUrl.searchParams.set('type', 'agent');
    wsUrl.searchParams.set('agentId', this.agentId);
    wsUrl.searchParams.set('hostname', os.hostname());
    wsUrl.searchParams.set('platform', os.platform());
    
    // Get Docker version
    try {
      const dockerInfo = await this.docker.version();
      wsUrl.searchParams.set('dockerVersion', dockerInfo.Version);
    } catch (error) {
      console.warn('⚠️  Could not get Docker version:', error.message);
      wsUrl.searchParams.set('dockerVersion', 'unknown');
    }
    
    if (this.userId) {
      wsUrl.searchParams.set('userId', this.userId);
    }

    console.log(`🔌 Connecting to Pantheon backend...`);
    console.log(`   URL: ${this.backendUrl}`);
    console.log(`   Agent ID: ${this.agentId}`);
    console.log(`   Hostname: ${os.hostname()}`);
    
    this.ws = new WebSocket(wsUrl.toString());

    this.ws.on('open', () => {
      console.log('✅ Connected to Pantheon backend');
      this.startHeartbeat();
    });

    this.ws.on('message', async (data) => {
      await this.handleCommand(data);
    });

    this.ws.on('close', () => {
      console.log('❌ Disconnected from backend. Reconnecting...');
      this.stopHeartbeat();
      setTimeout(() => this.connect(), this.reconnectInterval);
    });

    this.ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000); // Every 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async handleCommand(data) {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      console.error('❌ Failed to parse message:', error.message);
      return;
    }

    const { commandId, type, payload } = message;

    // Handle welcome message
    if (type === 'welcome') {
      console.log('👋 Received welcome from backend');
      return;
    }

    if (!commandId) {
      console.warn('⚠️  Message missing commandId:', type);
      return;
    }

    console.log(`📥 Received command: ${type} (${commandId})`);

    try {
      let result;

      switch (type) {
        case 'container.create':
          result = await this.createContainer(payload);
          break;
        case 'container.start':
          result = await this.startContainer(payload.containerId);
          break;
        case 'container.stop':
          result = await this.stopContainer(payload.containerId);
          break;
        case 'container.remove':
          result = await this.removeContainer(payload.containerId);
          break;
        case 'container.exec':
          result = await this.executeCommand(payload.containerId, payload.command);
          break;
        case 'container.list':
          result = await this.listContainers();
          break;
        case 'container.logs':
          result = await this.getContainerLogs(payload.containerId, payload.tail);
          break;
        case 'container.inspect':
          result = await this.inspectContainer(payload.containerId);
          break;
        default:
          throw new Error(`Unknown command type: ${type}`);
      }

      this.sendResponse(commandId, result);
      console.log(`✅ Command completed: ${type} (${commandId})`);
    } catch (error) {
      console.error(`❌ Command failed: ${type} (${commandId})`, error.message);
      this.sendError(commandId, error.message);
    }
  }

  async createContainer(options) {
    console.log('🐳 Creating container...');
    console.log('   Image:', options.Image);
    console.log('   Name:', options.name);
    
    const container = await this.docker.createContainer(options);
    console.log('✅ Container created:', container.id);
    
    return { containerId: container.id };
  }

  async startContainer(containerId) {
    console.log('▶️  Starting container:', containerId);
    const container = this.docker.getContainer(containerId);
    await container.start();
    console.log('✅ Container started');
    return { status: 'started' };
  }

  async stopContainer(containerId) {
    console.log('⏹️  Stopping container:', containerId);
    const container = this.docker.getContainer(containerId);
    await container.stop();
    console.log('✅ Container stopped');
    return { status: 'stopped' };
  }

  async removeContainer(containerId) {
    console.log('🗑️  Removing container:', containerId);
    const container = this.docker.getContainer(containerId);
    await container.remove({ force: true });
    console.log('✅ Container removed');
    return { status: 'removed' };
  }

  async executeCommand(containerId, command) {
    console.log('⚡ Executing command in container:', containerId);
    console.log('   Command:', command);
    
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: command.split(' '),
      AttachStdout: true,
      AttachStderr: true
    });

    const stream = await exec.start();
    let output = '';

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      stream.on('end', () => {
        console.log('✅ Command executed');
        resolve({ output });
      });

      stream.on('error', reject);
    });
  }

  async listContainers() {
    console.log('📋 Listing containers...');
    const containers = await this.docker.listContainers({ all: true });
    console.log(`✅ Found ${containers.length} containers`);
    return { containers };
  }

  async getContainerLogs(containerId, tail = 100) {
    console.log('📄 Getting container logs:', containerId);
    const container = this.docker.getContainer(containerId);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail
    });
    return { logs: logs.toString() };
  }

  async inspectContainer(containerId) {
    console.log('🔍 Inspecting container:', containerId);
    const container = this.docker.getContainer(containerId);
    const info = await container.inspect();
    return { info };
  }

  sendResponse(commandId, result) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'response',
        commandId,
        result
      }));
    }
  }

  sendError(commandId, error) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'error',
        commandId,
        error
      }));
    }
  }
}

// Start the agent
const agent = new PantheonClientAgent();
agent.connect().catch(error => {
  console.error('❌ Failed to start agent:', error);
  process.exit(1);
});

console.log('========================================');
console.log('🤖 Pantheon Client Agent');
console.log('========================================');
console.log(`Agent ID: ${agent.agentId}`);
console.log(`Backend: ${agent.backendUrl}`);
console.log(`Hostname: ${os.hostname()}`);
console.log(`Platform: ${os.platform()}`);
console.log('========================================');

