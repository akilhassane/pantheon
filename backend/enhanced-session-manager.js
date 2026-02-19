/**
 * Enhanced Session Manager
 * 
 * Extends SessionContextManager with project association and Supabase persistence
 * 
 * MIGRATED TO SUPABASE: All data persistence uses Supabase PostgreSQL
 */

const crypto = require('crypto');
const { retryQuery } = require('./config/supabase-client');

// UUID v4 generator (compatible with CommonJS)
function uuidv4() {
  return crypto.randomUUID();
}
const SessionContextManager = require('./session-context-manager');

class EnhancedSessionManager {
  constructor(supabaseClient) {
    // Supabase client for data persistence
    if (!supabaseClient) {
      throw new Error('EnhancedSessionManager requires a Supabase client instance');
    }
    this.supabase = supabaseClient;
    
    // Use existing SessionContextManager for runtime state only (tmux, working directory)
    this.sessionContextManager = new SessionContextManager();
    
    // In-memory cache to prevent duplicate saves (key: hash, value: timestamp)
    this.recentSaves = new Map();
    
    // Clean up old entries every minute
    setInterval(() => {
      const oneMinuteAgo = Date.now() - 60000;
      for (const [key, timestamp] of this.recentSaves.entries()) {
        if (timestamp < oneMinuteAgo) {
          this.recentSaves.delete(key);
        }
      }
    }, 60000);
    
    console.log('[EnhancedSessionManager] Initialized with Supabase persistence');
  }

  /**
   * Create a new session associated with a project
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID
   * @param {string} sessionName - Session name
   * @param {string} model - AI model to use
   * @returns {Promise<Object>} Created session
   */
  async createSession(projectId, userId, sessionName, model = 'gemini-2.5-flash') {
    console.log(`[EnhancedSessionManager] Creating session "${sessionName}" for project ${projectId}`);
    
    try {
      // Generate session ID
      const sessionId = uuidv4();
      
      // Create session in database (single query)
      const sessionData = {
        id: sessionId,
        name: sessionName,
        project_id: projectId,
        user_id: userId,
        model: model,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      };
      
      const { data, error } = await this.supabase
        .from('sessions')
        .insert([sessionData])
        .select()
        .single();
      
      if (error) {
        // Check if it's a foreign key constraint error (project doesn't exist)
        if (error.code === '23503') {
          throw new Error('Project not found');
        }
        throw new Error(`Failed to create session: ${error.message}`);
      }
      
      // Create in-memory session context (non-blocking)
      setImmediate(() => {
        this.sessionContextManager.createSession(sessionId, {
          conversationId: sessionId,
          tmuxSessionId: `session-${sessionId.substring(0, 8)}`,
          workingDirectory: '/root'
        });
      });
      
      console.log(`[EnhancedSessionManager] ✅ Session created: ${sessionId}`);
      
      return {
        ...data,
        createdAt: new Date(data.created_at),
        lastActive: new Date(data.last_active)
      };
      
    } catch (error) {
      console.error('[EnhancedSessionManager] ❌ Failed to create session:', error.message);
      throw error;
    }
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session data
   */
  async getSession(sessionId) {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (error) {
      throw new Error(`Failed to get session: ${error.message}`);
    }
    
    if (!data) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    return {
      ...data,
      createdAt: new Date(data.created_at),
      lastActive: new Date(data.last_active)
    };
  }

  /**
   * Get all sessions for a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} List of sessions (excluding deleted)
   */
  async getSessionsByProject(projectId) {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('last_active', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get sessions: ${error.message}`);
    }
    
    return (data || []).map(session => ({
      ...session,
      projectId: session.project_id, // Add camelCase version for frontend
      createdAt: new Date(session.created_at),
      lastActive: new Date(session.last_active)
    }));
  }

  /**
   * Update session
   * @param {string} sessionId - Session ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated session
   */
  async updateSession(sessionId, updates) {
    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.model !== undefined) dbUpdates.model = updates.model;
    if (updates.custom_mode_id !== undefined) dbUpdates.custom_mode_id = updates.custom_mode_id;
    dbUpdates.last_active = new Date().toISOString();
    
    const { data, error } = await this.supabase
      .from('sessions')
      .update(dbUpdates)
      .eq('id', sessionId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update session: ${error.message}`);
    }
    
    return {
      ...data,
      createdAt: new Date(data.created_at),
      lastActive: new Date(data.last_active)
    };
  }

  /**
   * Delete session
   * @param {string} sessionId - Session ID
   */
  async deleteSession(sessionId) {
    console.log(`[EnhancedSessionManager] Deleting session ${sessionId}`);
    
    try {
      // Delete from database (will cascade to chat_messages)
      const { error } = await this.supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId);
      
      if (error) {
        throw new Error(`Failed to delete session: ${error.message}`);
      }
      
      // Delete from in-memory storage
      if (this.sessionContextManager.sessions.has(sessionId)) {
        this.sessionContextManager.sessions.delete(sessionId);
      }
      
      console.log(`[EnhancedSessionManager] ✅ Session deleted`);
      
    } catch (error) {
      console.error('[EnhancedSessionManager] ❌ Failed to delete session:', error.message);
      throw error;
    }
  }

  /**
   * Soft delete session (sets deleted_at timestamp)
   * OPTIMIZED: Minimal logging, fast execution
   * @param {string} sessionId - Session ID
   */
  async softDeleteSession(sessionId) {
    try {
      // Delete from in-memory storage first (instant)
      if (this.sessionContextManager.sessions.has(sessionId)) {
        this.sessionContextManager.sessions.delete(sessionId);
      }
      
      // Update database (fire and forget - no await for error checking)
      this.supabase
        .from('sessions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', sessionId)
        .then(({ error }) => {
          if (error) {
            console.error(`[SessionManager] DB deletion failed for ${sessionId}:`, error.message);
          }
        });
      
    } catch (error) {
      console.error('[SessionManager] ❌ Soft delete error:', error.message);
      throw error;
    }
  }

  /**
   * Restore a soft-deleted session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Restored session
   */
  async restoreSession(sessionId) {
    console.log(`[EnhancedSessionManager] Restoring session ${sessionId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('sessions')
        .update({ 
          deleted_at: null,
          last_active: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to restore session: ${error.message}`);
      }
      
      if (!data) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      
      console.log(`[EnhancedSessionManager] ✅ Session restored`);
      
      return {
        ...data,
        projectId: data.project_id,
        createdAt: new Date(data.created_at),
        lastActive: new Date(data.last_active)
      };
      
    } catch (error) {
      console.error('[EnhancedSessionManager] ❌ Failed to restore session:', error.message);
      throw error;
    }
  }

  /**
   * Get all deleted sessions for a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} List of deleted sessions
   */
  async getDeletedSessionsByProject(projectId) {
    // Query sessions where deleted_at IS NOT NULL
    const { data, error } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('project_id', projectId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    
    if (error) {
      console.error('[EnhancedSessionManager] ❌ Query error:', error);
      throw new Error(`Failed to get deleted sessions: ${error.message}`);
    }
    
    console.log(`[EnhancedSessionManager] ✅ Found ${data?.length || 0} deleted sessions`);
    
    return (data || []).map(session => ({
      ...session,
      projectId: session.project_id,
      createdAt: new Date(session.created_at),
      lastActive: new Date(session.last_active),
      deletedAt: session.deleted_at ? new Date(session.deleted_at) : null
    }));
  }

  /**
   * Save complete chat message to database
   * Stores the ENTIRE message object as-is for perfect reconstruction
   * @param {string} sessionId - Session ID
   * @param {Object} messageObject - Complete message object from frontend
   */
  async saveCompleteMessage(sessionId, messageObject) {
    try {
      const timestamp = messageObject.timestamp ? new Date(messageObject.timestamp).toISOString() : new Date().toISOString();
      
      // Create a hash of the message for deduplication (WITHOUT timestamp to catch true duplicates)
      const contentHash = crypto.createHash('md5')
        .update(`${sessionId}_${messageObject.role}_${messageObject.content || ''}`)
        .digest('hex');
      
      // Check in-memory cache first (prevents race conditions)
      const cacheKey = contentHash;
      const lastSave = this.recentSaves.get(cacheKey);
      if (lastSave && (Date.now() - lastSave) < 2000) { // 2 second window (only for rapid duplicates)
        console.log(`[EnhancedSessionManager] ⏭️  Message already saved (in-memory cache), skipping duplicate`);
        console.log(`[EnhancedSessionManager]    Last saved ${Math.floor((Date.now() - lastSave) / 1000)}s ago`);
        return;
      }
      
      // Mark as being saved IMMEDIATELY (before any async operations to prevent race conditions)
      this.recentSaves.set(cacheKey, Date.now());
      
      // Check if a similar message already exists in database
      // Check for messages with same session, role, and content within 5 seconds
      const fiveSecondsAgo = new Date(new Date(timestamp).getTime() - 5000).toISOString();
      const fiveSecondsLater = new Date(new Date(timestamp).getTime() + 5000).toISOString();
      
      const { data: existing } = await this.supabase
        .from('chat_messages')
        .select('id, content')
        .eq('session_id', sessionId)
        .eq('role', messageObject.role)
        .gte('timestamp', fiveSecondsAgo)
        .lte('timestamp', fiveSecondsLater)
        .limit(5);
      
      // Check if any existing message has the same content
      if (existing && existing.length > 0) {
        const duplicate = existing.find(msg => msg.content === (messageObject.content || ''));
        if (duplicate) {
          console.log(`[EnhancedSessionManager] ⏭️  Similar message already exists in database (within 5s window), skipping duplicate save`);
          return;
        }
      }
      
      // Store the complete message object in metadata
      // This preserves ALL fields: content, role, mediaBlocks, introText, images, etc.
      const messageData = {
        session_id: sessionId,
        role: messageObject.role,
        content: messageObject.content || '',
        timestamp: timestamp,
        metadata: JSON.stringify(messageObject) // Store ENTIRE object
      };
      
      // Use retry logic for database insert
      const { error } = await retryQuery(
        async () => {
          return await this.supabase
            .from('chat_messages')
            .insert([messageData]);
        },
        {
          maxRetries: 2,
          initialDelay: 1000,
          onRetry: (attempt, maxRetries, delay, error) => {
            console.log(`[EnhancedSessionManager] ⏳ Message save attempt ${attempt}/${maxRetries} failed (${error.message}), retrying in ${delay}ms...`);
          }
        }
      );
      
      if (error) {
        console.error('[EnhancedSessionManager] Failed to save complete message:', error.message);
        console.error('[EnhancedSessionManager] Error details:', error);
        // Remove from cache on error so it can be retried
        this.recentSaves.delete(cacheKey);
      } else {
        console.log(`[EnhancedSessionManager] ✅ Saved complete ${messageObject.role} message for session ${sessionId}`);
        if (messageObject.mediaBlocks) {
          console.log(`[EnhancedSessionManager]    With ${messageObject.mediaBlocks.length} mediaBlocks`);
        }
      }
      
    } catch (error) {
      console.error('[EnhancedSessionManager] Error saving complete message:', error.message);
    }
  }

  /**
   * Save chat message to database (legacy method for backward compatibility)
   * @param {string} sessionId - Session ID
   * @param {string} role - Message role (user/assistant/system)
   * @param {string} content - Message content
   * @param {Object} metadata - Optional metadata (mediaBlocks, commandOutputs, etc.)
   */
  async saveChatMessage(sessionId, role, content, metadata = null) {
    try {
      const messageData = {
        session_id: sessionId,
        role: role,
        content: content,
        timestamp: new Date().toISOString(),
        metadata: metadata ? JSON.stringify(metadata) : null
      };
      
      const { error } = await this.supabase
        .from('chat_messages')
        .insert([messageData]);
      
      if (error) {
        console.error('[EnhancedSessionManager] Failed to save chat message:', error.message);
        console.error('[EnhancedSessionManager] Error details:', error);
      } else {
        console.log(`[EnhancedSessionManager] ✅ Saved ${role} message for session ${sessionId}`);
        if (metadata) {
          console.log(`[EnhancedSessionManager]    With metadata: ${Object.keys(metadata).join(', ')}`);
        }
      }
      
    } catch (error) {
      console.error('[EnhancedSessionManager] Error saving chat message:', error.message);
    }
  }

  /**
   * Get chat history for a session
   * Returns messages in their EXACT original structure
   * @param {string} sessionId - Session ID
   * @param {number} limit - Maximum number of messages to retrieve
   * @returns {Promise<Array>} Chat messages
   */
  async getChatHistory(sessionId, limit = 100) {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true })
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to get chat history: ${error.message}`);
    }
    
    return (data || []).map(msg => {
      // If metadata contains the complete message object, use it directly
      if (msg.metadata) {
        try {
          const completeMessage = typeof msg.metadata === 'string' 
            ? JSON.parse(msg.metadata) 
            : msg.metadata;
          
          // Ensure timestamp is a Date object
          if (completeMessage.timestamp) {
            completeMessage.timestamp = new Date(completeMessage.timestamp);
          }
          
          console.log(`[EnhancedSessionManager] Loaded complete ${completeMessage.role} message with ${completeMessage.mediaBlocks?.length || 0} mediaBlocks`);
          
          return completeMessage;
        } catch (parseError) {
          console.error('[EnhancedSessionManager] Failed to parse message metadata:', parseError);
        }
      }
      
      // Fallback to basic message structure
      return {
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp)
      };
    });
  }

  /**
   * Validate that a project exists and is accessible
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID (optional, for access check)
   * @returns {Promise<boolean>} True if valid
   */
  async validateProject(projectId, userId = null) {
    console.log(`[EnhancedSessionManager] Validating project ${projectId} for user ${userId || 'any'}`);
    
    try {
      let query = this.supabase
        .from('projects')
        .select('id, owner_id')
        .eq('id', projectId);
      
      // Don't filter by owner_id in the query - check it after
      // This allows us to distinguish between "project doesn't exist" and "user doesn't have access"
      
      const { data, error } = await query.single();
      
      if (error) {
        console.error(`[EnhancedSessionManager] ❌ Project validation query error:`, error.message);
        return false;
      }
      
      if (!data) {
        console.log(`[EnhancedSessionManager] ❌ Project ${projectId} not found`);
        return false;
      }
      
      // If userId is specified, check ownership
      if (userId && data.owner_id !== userId) {
        console.log(`[EnhancedSessionManager] ❌ User ${userId} does not own project ${projectId}`);
        return false;
      }
      
      console.log(`[EnhancedSessionManager] ✅ Project ${projectId} validated`);
      return true;
    } catch (error) {
      console.error(`[EnhancedSessionManager] ❌ Project validation exception:`, error.message);
      return false;
    }
  }

  /**
   * Get the underlying SessionContextManager for backward compatibility
   * @returns {SessionContextManager}
   */
  getContextManager() {
    return this.sessionContextManager;
  }
}

module.exports = EnhancedSessionManager;
