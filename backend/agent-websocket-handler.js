// Agent WebSocket Handler - Manages client agent connections
const { v4: uuidv4 } = require('uuid');

class AgentWebSocketHandler {
  constructor() {
    this.agents = new Map(); // agentId -> { ws, metadata, lastSeen }
    this.pendingCommands = new Map(); // commandId -> { resolve, reject, timeout }
    this.commandTimeout = 60000; // 60 seconds
  }

  /**
   * Register a new agent connection
   */
  registerAgent(ws, agentId, metadata = {}) {
    console.log(`🤖 Agent connected: ${agentId}`);
    console.log(`   Hostname: ${metadata.hostname || 'unknown'}`);
    console.log(`   Platform: ${metadata.platform || 'unknown'}`);
    console.log(`   Docker: ${metadata.dockerVersion || 'unknown'}`);

    this.agents.set(agentId, {
      ws,
      metadata,
      lastSeen: Date.now(),
      activeContainers: []
    });

    // Set up message handler
    ws.on('message', (data) => {
      this.handleAgentMessage(agentId, data);
    });

    // Set up close handler
    ws.on('close', () => {
      this.unregisterAgent(agentId);
    });

    // Set up error handler
    ws.on('error', (error) => {
      console.error(`❌ Agent ${agentId} error:`, error.message);
    });

    // Send welcome message
    this.sendToAgent(agentId, {
      type: 'welcome',
      agentId,
      timestamp: Date.now()
    });
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      console.log(`🤖 Agent disconnected: ${agentId}`);
      this.agents.delete(agentId);

      // Reject all pending commands for this agent
      for (const [commandId, command] of this.pendingCommands.entries()) {
        if (command.agentId === agentId) {
          clearTimeout(command.timeout);
          command.reject(new Error('Agent disconnected'));
          this.pendingCommands.delete(commandId);
        }
      }
    }
  }

  /**
   * Handle incoming message from agent
   */
  handleAgentMessage(agentId, data) {
    try {
      const message = JSON.parse(data.toString());
      const agent = this.agents.get(agentId);
      
      if (!agent) {
        console.error(`❌ Message from unknown agent: ${agentId}`);
        return;
      }

      // Update last seen
      agent.lastSeen = Date.now();

      // Handle different message types
      switch (message.type) {
        case 'heartbeat':
          // Update last seen (already done above)
          break;

        case 'response':
          this.handleCommandResponse(message);
          break;

        case 'error':
          this.handleCommandError(message);
          break;

        case 'status':
          this.handleStatusUpdate(agentId, message);
          break;

        default:
          console.warn(`⚠️  Unknown message type from agent ${agentId}:`, message.type);
      }
    } catch (error) {
      console.error(`❌ Error handling agent message:`, error.message);
    }
  }

  /**
   * Handle command response from agent
   */
  handleCommandResponse(message) {
    const { commandId, result } = message;
    
    if (!commandId) {
      console.error('❌ Response missing commandId');
      return;
    }

    const command = this.pendingCommands.get(commandId);
    if (command) {
      clearTimeout(command.timeout);
      command.resolve(result);
      this.pendingCommands.delete(commandId);
      console.log(`✅ Command ${commandId} completed successfully`);
    } else {
      console.warn(`⚠️  Response for unknown command: ${commandId}`);
    }
  }

  /**
   * Handle command error from agent
   */
  handleCommandError(message) {
    const { commandId, error } = message;
    
    if (!commandId) {
      console.error('❌ Error response missing commandId');
      return;
    }

    const command = this.pendingCommands.get(commandId);
    if (command) {
      clearTimeout(command.timeout);
      command.reject(new Error(error));
      this.pendingCommands.delete(commandId);
      console.error(`❌ Command ${commandId} failed:`, error);
    }
  }

  /**
   * Handle status update from agent
   */
  handleStatusUpdate(agentId, message) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.metadata = { ...agent.metadata, ...message.status };
      console.log(`📊 Agent ${agentId} status updated`);
    }
  }

  /**
   * Send message to agent
   */
  sendToAgent(agentId, message) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not connected`);
    }

    if (agent.ws.readyState === 1) { // WebSocket.OPEN
      agent.ws.send(JSON.stringify(message));
      return true;
    } else {
      throw new Error(`Agent ${agentId} WebSocket not open`);
    }
  }

  /**
   * Execute command on agent
   */
  async executeCommand(agentId, type, payload) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not connected`);
    }

    const commandId = uuidv4();
    
    console.log(`📤 Sending command to agent ${agentId}:`);
    console.log(`   Command ID: ${commandId}`);
    console.log(`   Type: ${type}`);
    console.log(`   Payload:`, JSON.stringify(payload).substring(0, 100));

    // Create promise for response
    const promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        reject(new Error(`Command timeout after ${this.commandTimeout}ms`));
      }, this.commandTimeout);

      this.pendingCommands.set(commandId, {
        resolve,
        reject,
        timeout,
        agentId,
        type,
        timestamp: Date.now()
      });
    });

    // Send command to agent
    this.sendToAgent(agentId, {
      commandId,
      type,
      payload
    });

    return promise;
  }

  /**
   * Container operations
   */
  async createContainer(agentId, options) {
    return this.executeCommand(agentId, 'container.create', options);
  }

  async startContainer(agentId, containerId) {
    return this.executeCommand(agentId, 'container.start', { containerId });
  }

  async stopContainer(agentId, containerId) {
    return this.executeCommand(agentId, 'container.stop', { containerId });
  }

  async removeContainer(agentId, containerId) {
    return this.executeCommand(agentId, 'container.remove', { containerId });
  }

  async listContainers(agentId) {
    return this.executeCommand(agentId, 'container.list', {});
  }

  async executeInContainer(agentId, containerId, command) {
    return this.executeCommand(agentId, 'container.exec', { containerId, command });
  }

  async getContainerLogs(agentId, containerId, tail = 100) {
    return this.executeCommand(agentId, 'container.logs', { containerId, tail });
  }

  async inspectContainer(agentId, containerId) {
    return this.executeCommand(agentId, 'container.inspect', { containerId });
  }

  /**
   * Get list of connected agents
   */
  getConnectedAgents() {
    const agents = [];
    for (const [agentId, agent] of this.agents.entries()) {
      agents.push({
        agentId,
        metadata: agent.metadata,
        lastSeen: agent.lastSeen,
        activeContainers: agent.activeContainers,
        connected: agent.ws.readyState === 1
      });
    }
    return agents;
  }

  /**
   * Check if agent is connected
   */
  isAgentConnected(agentId) {
    const agent = this.agents.get(agentId);
    return agent && agent.ws.readyState === 1;
  }

  /**
   * Get agent info
   */
  getAgentInfo(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    return {
      agentId,
      metadata: agent.metadata,
      lastSeen: agent.lastSeen,
      activeContainers: agent.activeContainers,
      connected: agent.ws.readyState === 1
    };
  }
}

module.exports = AgentWebSocketHandler;
