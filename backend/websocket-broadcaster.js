/**
 * WebSocket Broadcaster
 * Real-time communication between backend and frontend
 * Broadcasts command execution events and streaming responses
 */

const WebSocket = require('ws');
const { EventEmitter } = require('events');

class WebSocketBroadcaster extends EventEmitter {
  constructor(server) {
    super();
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map(); // Map<clientId, WebSocket>
    this.sessionClients = new Map(); // Map<sessionId, Set<clientId>>
    this.setupWebSocketServer();
  }

  /**
   * Setup WebSocket server and handle connections
   */
  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      console.log(`[WebSocket] Client connected: ${clientId}`);

      // Store client
      this.clients.set(clientId, {
        ws,
        sessionId: null,
        connectedAt: new Date(),
        lastActivity: new Date()
      });

      // Setup message handler
      ws.on('message', (message) => {
        this.handleClientMessage(clientId, message);
      });

      // Handle disconnection
      ws.on('close', () => {
        this.handleClientDisconnect(clientId);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`[WebSocket] Client ${clientId} error:`, error);
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connected',
        clientId,
        timestamp: new Date()
      });

      this.emit('client_connected', { clientId });
    });

    console.log('✅ WebSocket Broadcaster initialized');
  }

  /**
   * Handle incoming client messages
   */
  handleClientMessage(clientId, message) {
    try {
      const data = JSON.parse(message);
      const client = this.clients.get(clientId);

      if (!client) return;

      client.lastActivity = new Date();

      switch (data.type) {
        case 'session:register':
          this.registerClientSession(clientId, data.sessionId);
          break;

        case 'session:unregister':
          this.unregisterClientSession(clientId);
          break;

        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: new Date() });
          break;

        default:
          this.emit('client_message', { clientId, data });
      }

    } catch (error) {
      console.error(`[WebSocket] Error handling message from ${clientId}:`, error);
    }
  }

  /**
   * Register client to a session
   */
  registerClientSession(clientId, sessionId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Unregister from previous session
    if (client.sessionId) {
      this.unregisterClientSession(clientId);
    }

    // Register to new session
    client.sessionId = sessionId;

    if (!this.sessionClients.has(sessionId)) {
      this.sessionClients.set(sessionId, new Set());
    }
    this.sessionClients.get(sessionId).add(clientId);

    console.log(`[WebSocket] Client ${clientId} registered to session ${sessionId}`);

    this.sendToClient(clientId, {
      type: 'session:registered',
      sessionId,
      timestamp: new Date()
    });
  }

  /**
   * Unregister client from session
   */
  unregisterClientSession(clientId) {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) return;

    const sessionId = client.sessionId;
    const sessionClients = this.sessionClients.get(sessionId);

    if (sessionClients) {
      sessionClients.delete(clientId);
      if (sessionClients.size === 0) {
        this.sessionClients.delete(sessionId);
      }
    }

    client.sessionId = null;
    console.log(`[WebSocket] Client ${clientId} unregistered from session ${sessionId}`);
  }

  /**
   * Handle client disconnection
   */
  handleClientDisconnect(clientId) {
    console.log(`[WebSocket] Client disconnected: ${clientId}`);

    this.unregisterClientSession(clientId);
    this.clients.delete(clientId);

    this.emit('client_disconnected', { clientId });
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`[WebSocket] Error sending to client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast to all clients in a session
   */
  broadcastToSession(sessionId, data) {
    const sessionClients = this.sessionClients.get(sessionId);
    if (!sessionClients) return 0;

    let sentCount = 0;
    for (const clientId of sessionClients) {
      if (this.sendToClient(clientId, data)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * Broadcast to all connected clients
   */
  broadcastToAll(data) {
    let sentCount = 0;
    for (const clientId of this.clients.keys()) {
      if (this.sendToClient(clientId, data)) {
        sentCount++;
      }
    }
    return sentCount;
  }

  /**
   * Broadcast command start event
   */
  broadcastCommandStart(sessionId, command) {
    return this.broadcastToSession(sessionId, {
      type: 'command:start',
      sessionId,
      command,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast command output (streaming)
   */
  broadcastCommandOutput(sessionId, command, output) {
    return this.broadcastToSession(sessionId, {
      type: 'command:output',
      sessionId,
      command,
      output,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast command end event
   */
  broadcastCommandEnd(sessionId, command, result) {
    return this.broadcastToSession(sessionId, {
      type: 'command:end',
      sessionId,
      command,
      exitCode: result.exitCode || 0,
      duration: result.duration || 0,
      success: result.success || false,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast chat response start
   */
  broadcastResponseStart(sessionId, messageId) {
    return this.broadcastToSession(sessionId, {
      type: 'chat:response:start',
      sessionId,
      messageId,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast chat response chunk (streaming)
   */
  broadcastResponseChunk(sessionId, messageId, chunk) {
    return this.broadcastToSession(sessionId, {
      type: 'chat:response:chunk',
      sessionId,
      messageId,
      chunk,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast chat response end
   */
  broadcastResponseEnd(sessionId, messageId) {
    return this.broadcastToSession(sessionId, {
      type: 'chat:response:end',
      sessionId,
      messageId,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast error
   */
  broadcastError(sessionId, error) {
    return this.broadcastToSession(sessionId, {
      type: 'error',
      sessionId,
      message: error.message || 'Unknown error',
      details: error.details || null,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast session event
   */
  broadcastSessionEvent(sessionId, eventType, data = {}) {
    return this.broadcastToSession(sessionId, {
      type: `session:${eventType}`,
      sessionId,
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connected clients count
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Get session clients count
   */
  getSessionClientCount(sessionId) {
    const sessionClients = this.sessionClients.get(sessionId);
    return sessionClients ? sessionClients.size : 0;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    return Array.from(this.sessionClients.keys());
  }

  /**
   * Get client info
   */
  getClientInfo(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return null;

    return {
      clientId,
      sessionId: client.sessionId,
      connectedAt: client.connectedAt,
      lastActivity: client.lastActivity,
      isConnected: client.ws.readyState === WebSocket.OPEN
    };
  }

  /**
   * Get all clients info
   */
  getAllClientsInfo() {
    const info = [];
    for (const [clientId, client] of this.clients.entries()) {
      info.push({
        clientId,
        sessionId: client.sessionId,
        connectedAt: client.connectedAt,
        lastActivity: client.lastActivity,
        isConnected: client.ws.readyState === WebSocket.OPEN
      });
    }
    return info;
  }

  /**
   * Cleanup inactive clients
   */
  cleanupInactiveClients(maxInactiveMs = 5 * 60 * 1000) { // 5 minutes
    const now = Date.now();
    let cleaned = 0;

    for (const [clientId, client] of this.clients.entries()) {
      const inactiveTime = now - client.lastActivity.getTime();
      if (inactiveTime > maxInactiveMs) {
        console.log(`[WebSocket] Cleaning up inactive client: ${clientId}`);
        client.ws.close();
        this.handleClientDisconnect(clientId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[WebSocket] Cleaned up ${cleaned} inactive clients`);
    }

    return cleaned;
  }

  /**
   * Close all connections and shutdown
   */
  shutdown() {
    console.log('[WebSocket] Shutting down broadcaster...');

    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.ws.close();
      } catch (error) {
        console.error(`Error closing client ${clientId}:`, error);
      }
    }

    this.clients.clear();
    this.sessionClients.clear();

    this.wss.close(() => {
      console.log('✅ WebSocket Broadcaster shut down');
    });
  }
}

module.exports = WebSocketBroadcaster;
