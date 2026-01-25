// VNC Proxy - Relays VNC connections from frontend to local containers via agent
const WebSocket = require('ws');
const http = require('http');

class VNCProxy {
  constructor(agentHandler) {
    this.agentHandler = agentHandler;
    this.activeConnections = new Map(); // connectionId -> { frontendWs, agentWs }
  }

  /**
   * Handle VNC proxy WebSocket connection from frontend
   */
  handleConnection(ws, req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const agentId = url.searchParams.get('agentId');
    const port = url.searchParams.get('port');
    const containerId = url.searchParams.get('containerId');

    if (!agentId || !port) {
      ws.close(1008, 'Missing agentId or port');
      return;
    }

    console.log(`[VNCProxy] New VNC connection request:`);
    console.log(`   Agent: ${agentId}`);
    console.log(`   Port: ${port}`);
    console.log(`   Container: ${containerId || 'unknown'}`);

    // Check if agent is connected
    if (!this.agentHandler.isAgentConnected(agentId)) {
      console.error(`[VNCProxy] Agent ${agentId} not connected`);
      ws.close(1008, 'Agent not connected');
      return;
    }

    // Create proxy connection
    this.createProxyConnection(ws, agentId, port, containerId);
  }

  /**
   * Create bidirectional proxy between frontend and agent
   */
  async createProxyConnection(frontendWs, agentId, port, containerId) {
    const connectionId = `${agentId}-${port}-${Date.now()}`;
    
    try {
      // Request agent to create VNC tunnel
      console.log(`[VNCProxy] Requesting VNC tunnel from agent ${agentId}...`);
      
      const result = await this.agentHandler.executeCommand(agentId, 'vnc.tunnel', {
        port: parseInt(port),
        containerId
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create VNC tunnel');
      }

      console.log(`[VNCProxy] ✅ VNC tunnel established`);

      // Store connection
      this.activeConnections.set(connectionId, {
        frontendWs,
        agentId,
        port,
        containerId,
        startTime: Date.now()
      });

      // Set up bidirectional relay
      frontendWs.on('message', (data) => {
        // Forward data from frontend to agent
        this.agentHandler.executeCommand(agentId, 'vnc.send', {
          connectionId,
          data: data.toString('base64')
        }).catch(err => {
          console.error(`[VNCProxy] Error forwarding to agent:`, err.message);
        });
      });

      frontendWs.on('close', () => {
        console.log(`[VNCProxy] Frontend disconnected: ${connectionId}`);
        this.activeConnections.delete(connectionId);
        
        // Notify agent to close tunnel
        this.agentHandler.executeCommand(agentId, 'vnc.close', {
          connectionId
        }).catch(err => {
          console.error(`[VNCProxy] Error closing tunnel:`, err.message);
        });
      });

      frontendWs.on('error', (error) => {
        console.error(`[VNCProxy] Frontend WebSocket error:`, error.message);
      });

      console.log(`[VNCProxy] ✅ Proxy connection established: ${connectionId}`);

    } catch (error) {
      console.error(`[VNCProxy] Failed to create proxy:`, error.message);
      frontendWs.close(1011, error.message);
    }
  }

  /**
   * Handle data from agent (VNC server response)
   */
  handleAgentData(agentId, connectionId, data) {
    const connection = this.activeConnections.get(connectionId);
    
    if (!connection) {
      console.warn(`[VNCProxy] No connection found for ${connectionId}`);
      return;
    }

    if (connection.frontendWs.readyState === WebSocket.OPEN) {
      // Forward data from agent to frontend
      const buffer = Buffer.from(data, 'base64');
      connection.frontendWs.send(buffer);
    }
  }

  /**
   * Get active connections count
   */
  getActiveConnectionsCount() {
    return this.activeConnections.size;
  }

  /**
   * Get connections for specific agent
   */
  getAgentConnections(agentId) {
    const connections = [];
    for (const [id, conn] of this.activeConnections.entries()) {
      if (conn.agentId === agentId) {
        connections.push({
          id,
          port: conn.port,
          containerId: conn.containerId,
          duration: Date.now() - conn.startTime
        });
      }
    }
    return connections;
  }
}

module.exports = VNCProxy;
