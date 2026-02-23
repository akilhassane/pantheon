// Remote Container Manager - Manages containers on client machines
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

class RemoteContainerManager {
  constructor() {
    this.clients = new Map(); // clientId -> WebSocket
    this.pendingCommands = new Map(); // commandId -> Promise
  }

  registerClient(clientId, ws) {
    this.clients.set(clientId, {
      ws,
      lastSeen: Date.now(),
      capabilities: {},
      activeContainers: []
    });

    ws.on('message', (data) => this.handleClientMessage(clientId, data));
    ws.on('close', () => this.unregisterClient(clientId));
  }

  unregisterClient(clientId) {
    this.clients.delete(clientId);
    console.log(`Client ${clientId} disconnected`);
  }

  async executeOnClient(clientId, command) {
    const client = this.clients.get(clientId);
    if (!client) throw new Error('Client not connected');

    const commandId = uuidv4();
    const promise = new Promise((resolve, reject) => {
      this.pendingCommands.set(commandId, { resolve, reject });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingCommands.has(commandId)) {
          this.pendingCommands.delete(commandId);
          reject(new Error('Command timeout'));
        }
      }, 30000);
    });

    client.ws.send(JSON.stringify({
      commandId,
      type: command.type,
      payload: command.payload
    }));

    return promise;
  }

  handleClientMessage(clientId, data) {
    const message = JSON.parse(data);
    
    if (message.commandId && this.pendingCommands.has(message.commandId)) {
      const { resolve, reject } = this.pendingCommands.get(message.commandId);
      this.pendingCommands.delete(message.commandId);
      
      if (message.error) {
        reject(new Error(message.error));
      } else {
        resolve(message.result);
      }
    }
  }

  // Container operations
  async createContainer(clientId, options) {
    return this.executeOnClient(clientId, {
      type: 'container.create',
      payload: options
    });
  }

  async startContainer(clientId, containerId) {
    return this.executeOnClient(clientId, {
      type: 'container.start',
      payload: { containerId }
    });
  }

  async stopContainer(clientId, containerId) {
    return this.executeOnClient(clientId, {
      type: 'container.stop',
      payload: { containerId }
    });
  }

  async executeCommand(clientId, containerId, command) {
    return this.executeOnClient(clientId, {
      type: 'container.exec',
      payload: { containerId, command }
    });
  }

  getConnectedClients() {
    return Array.from(this.clients.keys());
  }
}

export default new RemoteContainerManager();
