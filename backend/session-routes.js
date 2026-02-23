/**
 * Session Management API Routes
 * 
 * Handles HTTP endpoints for session CRUD operations
 */

const express = require('express');
const router = express.Router();

/**
 * Setup session routes
 * @param {Object} sessionManager - EnhancedSessionManager instance
 * @param {Object} collaborationWS - CollaborationWebSocketHandler instance
 * @returns {Router} Express router
 */
function setupSessionRoutes(sessionManager, collaborationWS = null) {
  
  /**
   * GET /api/sessions/projects/:projectId/deleted
   * Get all deleted sessions for a project
   */
  router.get('/projects/:projectId/deleted', async (req, res) => {
    console.log(`[SessionRoutes] GET /api/sessions/projects/${req.params.projectId}/deleted`);
    
    try {
      const { projectId } = req.params;
      
      const sessions = await sessionManager.getDeletedSessionsByProject(projectId);
      
      res.json({
        success: true,
        sessions,
        count: sessions.length
      });
      
    } catch (error) {
      console.error('[SessionRoutes] ❌ Failed to get deleted sessions:', error.message);
      
      res.status(500).json({
        error: 'SESSIONS_GET_FAILED',
        message: error.message
      });
    }
  });

  /**
   * GET /api/sessions/projects/:projectId
   * Get all sessions for a project
   */
  router.get('/projects/:projectId', async (req, res) => {
    console.log(`[SessionRoutes] GET /api/sessions/projects/${req.params.projectId}`);
    
    try {
      const { projectId } = req.params;
      
      const sessions = await sessionManager.getSessionsByProject(projectId);
      
      res.json({
        success: true,
        sessions,
        count: sessions.length
      });
      
    } catch (error) {
      console.error('[SessionRoutes] ❌ Failed to get sessions:', error.message);
      
      res.status(500).json({
        error: 'SESSIONS_GET_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * POST /api/sessions
   * Create a new session
   */
  router.post('/', async (req, res) => {
    console.log('[SessionRoutes] POST /api/sessions - Request received');
    
    try {
      const { projectId, userId, name, model } = req.body;
      
      // Validation
      if (!projectId || !userId || !name) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Project ID, User ID, and name are required'
        });
      }
      
      // Create session directly (no pre-validation to avoid double query)
      const session = await sessionManager.createSession(
        projectId,
        userId,
        name,
        model || 'gemini-2.5-flash'
      );
      
      console.log('[SessionRoutes] ✅ Session created:', session.id);
      
      // Broadcast session creation to collaboration members (non-blocking)
      if (collaborationWS) {
        setImmediate(() => {
          try {
            collaborationWS.broadcastSessionCreated(projectId, session, userId, req.body.userName || 'User');
          } catch (wsError) {
            console.warn('[SessionRoutes] WebSocket broadcast failed:', wsError.message);
          }
        });
      }
      
      res.status(201).json({
        success: true,
        session
      });
      
    } catch (error) {
      console.error('[SessionRoutes] ❌ Failed to create session:', error.message);
      
      if (!res.headersSent) {
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
          error: 'SESSION_CREATION_FAILED',
          message: error.message
        });
      }
    }
  });
  
  /**
   * GET /api/sessions/:id
   * Get session details
   */
  router.get('/:id', async (req, res) => {
    console.log(`[SessionRoutes] GET /api/sessions/${req.params.id}`);
    
    try {
      const { id } = req.params;
      
      const session = await sessionManager.getSession(id);
      
      res.json({
        success: true,
        session
      });
      
    } catch (error) {
      console.error('[SessionRoutes] ❌ Failed to get session:', error.message);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'SESSION_NOT_FOUND',
          message: error.message
        });
      }
      
      res.status(500).json({
        error: 'SESSION_GET_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * PUT /api/sessions/:id
   * Update session
   */
  router.put('/:id', async (req, res) => {
    console.log(`[SessionRoutes] PUT /api/sessions/${req.params.id}`);
    
    try {
      const { id } = req.params;
      const { name, model } = req.body;
      
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (model !== undefined) updates.model = model;
      
      const session = await sessionManager.updateSession(id, updates);
      
      res.json({
        success: true,
        session
      });
      
    } catch (error) {
      console.error('[SessionRoutes] ❌ Failed to update session:', error.message);
      
      res.status(500).json({
        error: 'SESSION_UPDATE_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * PATCH /api/sessions/:id
   * Partially update session (model, customModeId, etc.)
   */
  router.patch('/:id', async (req, res) => {
    console.log(`[SessionRoutes] PATCH /api/sessions/${req.params.id}`);
    console.log(`[SessionRoutes] Updates:`, req.body);
    
    try {
      const { id } = req.params;
      
      // Check if this is an optimistic ID (not a UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        console.log(`[SessionRoutes] ⚠️ Ignoring update to optimistic session ID: ${id}`);
        // Return success to avoid frontend errors, but don't actually update anything
        return res.json({
          success: true,
          message: 'Optimistic session update ignored (will be applied to real session)'
        });
      }
      
      const { name, model, customModeId } = req.body;
      
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (model !== undefined) updates.model = model;
      if (customModeId !== undefined) updates.custom_mode_id = customModeId;
      
      const session = await sessionManager.updateSession(id, updates);
      
      console.log(`[SessionRoutes] ✅ Session updated:`, session.id);
      
      res.json({
        success: true,
        session
      });
      
    } catch (error) {
      console.error('[SessionRoutes] ❌ Failed to update session:', error.message);
      
      res.status(500).json({
        error: 'SESSION_UPDATE_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * DELETE /api/sessions/:id
   * Soft delete session (sets deleted_at timestamp)
   * OPTIMIZED: Responds immediately, processes deletion in background
   */
  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    // Respond immediately for fastest possible response
    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
    
    // Process deletion in background (non-blocking)
    setImmediate(async () => {
      try {
        await sessionManager.softDeleteSession(id);
      } catch (error) {
        console.error(`[SessionRoutes] ❌ Background deletion failed for ${id}:`, error.message);
      }
    });
  });

  /**
   * POST /api/sessions/:id/restore
   * Restore a soft-deleted session
   */
  router.post('/:id/restore', async (req, res) => {
    console.log(`[SessionRoutes] POST /api/sessions/${req.params.id}/restore`);
    
    try {
      const { id } = req.params;
      
      const session = await sessionManager.restoreSession(id);
      
      res.json({
        success: true,
        session,
        message: 'Session restored successfully'
      });
      
    } catch (error) {
      console.error('[SessionRoutes] ❌ Failed to restore session:', error.message);
      
      res.status(500).json({
        error: 'SESSION_RESTORE_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * GET /api/sessions/:id/history
   * Get chat history for a session
   */
  router.get('/:id/history', async (req, res) => {
    console.log(`[SessionRoutes] GET /api/sessions/${req.params.id}/history`);
    
    try {
      const { id } = req.params;
      const { limit } = req.query;
      
      const history = await sessionManager.getChatHistory(
        id,
        limit ? parseInt(limit) : 100
      );
      
      res.json({
        success: true,
        history,
        count: history.length
      });
      
    } catch (error) {
      console.error('[SessionRoutes] ❌ Failed to get chat history:', error.message);
      
      res.status(500).json({
        error: 'HISTORY_GET_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * POST /api/sessions/:id/messages
   * Save a complete message with full structure (mediaBlocks, etc.)
   * Stores the ENTIRE message object as-is for perfect reconstruction
   */
  router.post('/:id/messages', async (req, res) => {
    console.log(`[SessionRoutes] POST /api/sessions/${req.params.id}/messages`);
    console.log(`[SessionRoutes] Message role: ${req.body?.role}`);
    console.log(`[SessionRoutes] Message has mediaBlocks: ${!!req.body?.mediaBlocks}`);
    console.log(`[SessionRoutes] Message has introText: ${!!req.body?.introText}`);
    
    try {
      const { id } = req.params;
      const messageObject = req.body;
      
      if (!messageObject.role || !['user', 'assistant', 'system'].includes(messageObject.role)) {
        console.error('[SessionRoutes] ❌ Invalid role:', messageObject.role);
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Valid role is required (user, assistant, or system)'
        });
      }
      
      console.log('[SessionRoutes] Saving complete message to database...');
      // Save the complete message object
      await sessionManager.saveCompleteMessage(id, messageObject);
      console.log('[SessionRoutes] ✅ Message saved successfully');
      
      res.json({
        success: true,
        message: 'Complete message saved successfully'
      });
      
    } catch (error) {
      console.error('[SessionRoutes] ❌ Failed to save message:', error.message);
      console.error('[SessionRoutes] Error stack:', error.stack);
      
      res.status(500).json({
        error: 'MESSAGE_SAVE_FAILED',
        message: error.message
      });
    }
  });
  
  return router;
}

module.exports = { setupSessionRoutes };
