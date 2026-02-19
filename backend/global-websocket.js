/**
 * Global WebSocket Handler
 * 
 * Manages user-level WebSocket connections that stay active
 * regardless of which project is currently open.
 * Used for:
 * - Collaboration added/removed notifications
 * - User-level events
 */

class GlobalWebSocketHandler {
  constructor(wss) {
    this.wss = wss;
    this.clients = new Map(); // userId -> { ws, userName }
    
    console.log('✅ Global WebSocket Handler initialized');
  }

  /**
   * Register a client connection
   */
  registerClient(ws, userId, userName) {
    // Store client info
    this.clients.set(userId, {
      ws,
      userName,
      connectedAt: Date.now()
    });

    console.log(`🌐 Global: User ${userName} (${userId}) connected`);

    // Handle disconnection
    ws.on('close', () => {
      this.unregisterClient(userId);
    });

    // Handle messages
    ws.on('message', (message) => {
      this.handleMessage(userId, message);
    });
  }

  /**
   * Unregister a client
   */
  unregisterClient(userId) {
    const client = this.clients.get(userId);
    if (!client) return;

    console.log(`🌐 Global: User ${client.userName} (${userId}) disconnected`);
    this.clients.delete(userId);
  }

  /**
   * Handle incoming messages
   */
  handleMessage(userId, message) {
    try {
      const data = JSON.parse(message.toString());
      const client = this.clients.get(userId);
      
      if (!client) return;

      switch (data.type) {
        case 'ping':
          // Respond to ping
          this.sendToUser(userId, { type: 'pong' });
          break;

        default:
          console.warn(`Unknown global message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error handling global WebSocket message:', error);
    }
  }

  /**
   * Send message to a specific user
   */
  sendToUser(userId, message) {
    const client = this.clients.get(userId);
    if (!client) {
      console.warn(`🌐 Global: User ${userId} not connected`);
      return false;
    }

    if (client.ws.readyState === 1) { // WebSocket.OPEN
      client.ws.send(JSON.stringify(message));
      return true;
    }

    return false;
  }

  /**
   * Notify user they were added to a collaboration
   */
  notifyCollaborationAdded(userId, projectId, projectName) {
    console.log(`🌐 Global: Notifying ${userId} about collaboration added: ${projectName}`);
    return this.sendToUser(userId, {
      type: 'collaboration-added',
      projectId,
      projectName,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notify user they were removed from a collaboration
   */
  notifyCollaborationRemoved(userId, projectId) {
    console.log(`🌐 Global: Notifying ${userId} about collaboration removed: ${projectId}`);
    return this.sendToUser(userId, {
      type: 'collaboration-removed',
      projectId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Check if a user is connected
   */
  isUserConnected(userId) {
    return this.clients.has(userId);
  }

  /**
   * Get all connected users
   */
  getConnectedUsers() {
    return Array.from(this.clients.keys());
  }
}

module.exports = GlobalWebSocketHandler;
