// Pantheon Client Agent - Runs on client machines
import Docker from 'dockerode';
import WebSocket from 'ws';
import { config } from 'dotenv';

config();

class PantheonClientAgent {
  constructor() {
    this.docker = new Docker();
    this.cloudUrl = process.env.CLOUD_BACKEND_URL || 'ws://localhost:3002';
    this.apiKey = process.env.AGENT_API_KEY;
    this.clientId = process.env.CLIENT_ID || this.generateClientId();
    this.ws = null;
    this.reconnectInterval = 5000;
  }

  generateClientId() {
    const os = require('os');
    return `${os.hostname()}-${Date.now()}`;
  }

  async connect() {
    console.log(`Connecting to ${this.cloudUrl}...`);
    
    this.ws = new WebSocket(`${this.cloudUrl}/agent`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'X-Client-Id': this.clientId
      }
    });

    this.ws.on('open', () => {
      console.log('Connected to Pantheon cloud backend');
      this.sendHeartbeat();
    });

    this.ws.on('message', async (data) => {
      await this.handleCommand(data);
    });

    this.ws.on('close', () => {
      console.log('Disconnected from cloud backend. Reconnecting...');
      setTimeout(() => this.connect(), this.reconnectInterval);
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  sendHeartbeat() {
    setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000);
  }

  async handleCommand(data) {
    const message = JSON.parse(data);
    const { commandId, type, payload } = message;

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
        case 'container.exec':
          result = await this.executeCommand(payload.containerId, payload.command);
          break;
        case 'container.list':
          result = await this.listContainers();
          break;
        default:
          throw new Error(`Unknown command type: ${type}`);
      }

      this.sendResponse(commandId, result);
    } catch (error) {
      this.sendError(commandId, error.message);
    }
  }

  async createContainer(options) {
    const container = await this.docker.createContainer(options);
    return { containerId: container.id };
  }

  async startContainer(containerId) {
    const container = this.docker.getContainer(containerId);
    await container.start();
    return { status: 'started' };
  }

  async stopContainer(containerId) {
    const container = this.docker.getContainer(containerId);
    await container.stop();
    return { status: 'stopped' };
  }

  async executeCommand(containerId, command) {
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
        resolve({ output });
      });

      stream.on('error', reject);
    });
  }

  async listContainers() {
    const containers = await this.docker.listContainers({ all: true });
    return { containers };
  }

  sendResponse(commandId, result) {
    this.ws.send(JSON.stringify({
      commandId,
      result
    }));
  }

  sendError(commandId, error) {
    this.ws.send(JSON.stringify({
      commandId,
      error
    }));
  }
}

// Start the agent
const agent = new PantheonClientAgent();
agent.connect();

console.log('Pantheon Client Agent started');
console.log(`Client ID: ${agent.clientId}`);
