/**
 * Collaboration WebSocket Handler
 * 
 * Manages real-time collaboration features:
 * - Session creation/updates broadcast
 * - User presence (online/offline/active)
 * - Collaborative editing notifications
 */

class CollaborationWebSocketHandler {
  constructor(wss) {
    this.wss = wss;
    this.clients = new Map(); // userId -> { ws, projectId, userName, status }
    this.projectRooms = new Map(); // projectId -> Set of userIds
    
    console.log('✅ Collaboration WebSocket Handler initialized');
  }

  /**
   * Register a client connection
   */
  registerClient(ws, userId, userName, projectId) {
    // Store client info
    this.clients.set(userId, {
      ws,
      projectId,
      userName,
      status: 'online',
      lastActivity: Date.now()
    });

    // Add to project room
    if (!this.projectRooms.has(projectId)) {
      this.projectRooms.set(projectId, new Set());
    }
    this.projectRooms.get(projectId).add(userId);

    console.log(`👤 User ${userName} (${userId}) joined project ${projectId}`);

    // Broadcast user joined to project members
    this.broadcastToProject(projectId, {
      type: 'user-joined',
      userId,
      userName,
      timestamp: new Date().toISOString()
    }, userId);

    // Send current project members to the new user
    this.sendProjectMembers(userId, projectId);

    // Handle disconnection
    ws.on('close', () => {
      this.unregisterClient(userId, projectId);
    });

    // Handle messages
    ws.on('message', (message) => {
      this.handleMessage(userId, message);
    });

    // Update activity on any message
    ws.on('message', () => {
      this.updateActivity(userId);
    });
  }

  /**
   * Unregister a client
   */
  unregisterClient(userId, projectId) {
    const client = this.clients.get(userId);
    if (!client) return;

    console.log(`👤 User ${client.userName} (${userId}) left project ${projectId}`);

    // Remove from project room
    const room = this.projectRooms.get(projectId);
    if (room) {
      room.delete(userId);
      if (room.size === 0) {
        this.projectRooms.delete(projectId);
      }
    }

    // Remove client
    this.clients.delete(userId);

    // Broadcast user left
    this.broadcastToProject(projectId, {
      type: 'user-left',
      userId,
      userName: client.userName,
      timestamp: new Date().toISOString()
    });
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
        case 'session-created':
          this.broadcastToProject(client.projectId, {
            type: 'session-created',
            session: data.session,
            createdBy: userId,
            userName: client.userName,
            timestamp: new Date().toISOString()
          });
          break;

        case 'session-updated':
          this.broadcastToProject(client.projectId, {
            type: 'session-updated',
            sessionId: data.sessionId,
            updates: data.updates,
            updatedBy: userId,
            userName: client.userName,
            timestamp: new Date().toISOString()
          }, userId);
          break;

        case 'session-deleted':
          this.broadcastToProject(client.projectId, {
            type: 'session-deleted',
            sessionId: data.sessionId,
            deletedBy: userId,
            userName: client.userName,
            timestamp: new Date().toISOString()
          }, userId);
          break;

        case 'user-typing':
          this.broadcastToProject(client.projectId, {
            type: 'user-typing',
            userId,
            userName: client.userName,
            sessionId: data.sessionId,
            timestamp: new Date().toISOString()
          }, userId);
          break;

        case 'status-update':
          client.status = data.status; // 'online', 'active', 'away'
          this.broadcastToProject(client.projectId, {
            type: 'user-status-changed',
            userId,
            userName: client.userName,
            status: data.status,
            timestamp: new Date().toISOString()
          }, userId);
          break;

        case 'refresh-collaborators':
          // Request to refresh collaborators list
          this.sendProjectMembers(userId, client.projectId);
          break;

        default:
          console.warn(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * Update user activity timestamp
   */
  updateActivity(userId) {
    const client = this.clients.get(userId);
    if (client) {
      client.lastActivity = Date.now();
      if (client.status !== 'active') {
        client.status = 'active';
        this.broadcastToProject(client.projectId, {
          type: 'user-status-changed',
          userId,
          userName: client.userName,
          status: 'active',
          timestamp: new Date().toISOString()
        }, userId);
      }
    }
  }

  /**
   * Broadcast message to all users in a project
   */
  broadcastToProject(projectId, message, excludeUserId = null) {
    const room = this.projectRooms.get(projectId);
    if (!room) return;

    const messageStr = JSON.stringify(message);

    room.forEach(userId => {
      if (userId === excludeUserId) return;
      
      const client = this.clients.get(userId);
      if (client && client.ws.readyState === 1) { // WebSocket.OPEN
        client.ws.send(messageStr);
      }
    });
  }

  /**
   * Send current project members to a user
   */
  sendProjectMembers(userId, projectId) {
    const client = this.clients.get(userId);
    if (!client) return;

    const room = this.projectRooms.get(projectId);
    if (!room) return;

    const members = [];
    room.forEach(memberId => {
      const memberClient = this.clients.get(memberId);
      if (memberClient) {
        members.push({
          userId: memberId,
          userName: memberClient.userName,
          status: memberClient.status,
          lastActivity: memberClient.lastActivity
        });
      }
    });

    client.ws.send(JSON.stringify({
      type: 'project-members',
      members,
      timestamp: new Date().toISOString()
    }));
  }

  /**
   * Get all users in a project
   */
  getProjectMembers(projectId) {
    const room = this.projectRooms.get(projectId);
    if (!room) return [];

    const members = [];
    room.forEach(userId => {
      const client = this.clients.get(userId);
      if (client) {
        members.push({
          userId,
          userName: client.userName,
          status: client.status,
          lastActivity: client.lastActivity
        });
      }
    });

    return members;
  }

  /**
   * Broadcast session creation to project
   */
  broadcastSessionCreated(projectId, session, createdBy, userName) {
    this.broadcastToProject(projectId, {
      type: 'session-created',
      session,
      createdBy,
      userName,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast session update to project
   */
  broadcastSessionUpdated(projectId, sessionId, updates, updatedBy, userName) {
    this.broadcastToProject(projectId, {
      type: 'session-updated',
      sessionId,
      updates,
      updatedBy,
      userName,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast session deletion to project
   */
  broadcastSessionDeleted(projectId, sessionId, deletedBy, userName) {
    this.broadcastToProject(projectId, {
      type: 'session-deleted',
      sessionId,
      deletedBy,
      userName,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = CollaborationWebSocketHandler;
