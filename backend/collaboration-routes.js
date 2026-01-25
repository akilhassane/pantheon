/**
 * Collaboration API Routes
 * 
 * Handles HTTP endpoints for project sharing and collaboration
 */

const express = require('express');
const router = express.Router();

/**
 * Setup collaboration routes
 * @param {Object} collaborationManager - CollaborationManager instance
 * @param {Object} sessionManager - SessionManager instance (optional)
 * @param {Object} collaborationWS - CollaborationWebSocketHandler instance (optional)
 * @returns {Router} Express router
 */
function setupCollaborationRoutes(collaborationManager, sessionManager = null, collaborationWS = null) {
  // Get supabase client from collaborationManager
  const supabase = collaborationManager.supabase;
  
  /**
   * POST /api/projects/:id/share
   * Share a project and get Project ID
   */
  router.post('/projects/:id/share', async (req, res) => {
    console.log(`[CollaborationRoutes] POST /api/projects/${req.params.id}/share`);
    
    try {
      const { id: projectId } = req.params;
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'User ID is required'
        });
      }
      
      const collaboration = await collaborationManager.shareProject(projectId, userId);
      
      res.json({
        success: true,
        collaboration,
        shareToken: collaboration.shareToken,
        shareUrl: `${req.protocol}://${req.get('host')}/join/${collaboration.shareToken}`
      });
      
    } catch (error) {
      console.error('[CollaborationRoutes] ❌ Failed to share project:', error.message);
      
      if (error.message.includes('not found') || error.message.includes('not the owner')) {
        return res.status(404).json({
          error: 'PROJECT_NOT_FOUND',
          message: error.message
        });
      }
      
      res.status(500).json({
        error: 'SHARE_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * POST /api/collaborations/join
   * Join a project using Project ID
   */
  router.post('/join', async (req, res) => {
    console.log('[CollaborationRoutes] POST /api/collaborations/join');
    
    try {
      const { shareToken, userId, userName } = req.body;
      
      if (!shareToken) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Project ID (share token) is required'
        });
      }
      
      if (!userId) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'User ID is required'
        });
      }
      
      const result = await collaborationManager.joinProject(
        shareToken,
        userId,
        userName || 'Anonymous'
      );
      
      // If this is a new collaborator, broadcast to all project members
      if (result.isNewCollaborator && collaborationWS && result.project) {
        console.log(`[CollaborationRoutes] Broadcasting new collaborator to project ${result.project.id}`);
        collaborationWS.broadcastToProject(result.project.id, {
          type: 'collaborator-joined',
          userId,
          userName: userName || 'Anonymous',
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        ...result
      });
      
    } catch (error) {
      console.error('[CollaborationRoutes] ❌ Failed to join project:', error.message);
      
      if (error.message.includes('Invalid Project ID')) {
        return res.status(400).json({
          error: 'INVALID_PROJECT_ID',
          message: error.message
        });
      }
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'PROJECT_NOT_FOUND',
          message: error.message
        });
      }
      
      res.status(500).json({
        error: 'JOIN_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * GET /api/collaborations
   * Get all collaborations for a user
   */
  router.get('/', async (req, res) => {
    console.log('[CollaborationRoutes] GET /api/collaborations');
    
    try {
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'User ID is required'
        });
      }
      
      const collaborations = await collaborationManager.getUserCollaborations(userId);
      
      res.json({
        success: true,
        collaborations,
        count: collaborations.length
      });
      
    } catch (error) {
      console.error('[CollaborationRoutes] ❌ Failed to get collaborations:', error.message);
      
      res.status(500).json({
        error: 'GET_COLLABORATIONS_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * DELETE /api/collaborations/:projectId
   * Leave a collaboration
   */
  router.delete('/:projectId', async (req, res) => {
    console.log(`[CollaborationRoutes] DELETE /api/collaborations/${req.params.projectId}`);
    
    try {
      const { projectId } = req.params;
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'User ID is required'
        });
      }
      
      // Get user name before leaving (for notification)
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const userName = userData?.user?.email || userData?.user?.user_metadata?.full_name || 'User';
      
      await collaborationManager.leaveProject(projectId, userId);
      
      // Broadcast to all users in the project that someone left
      if (collaborationWS) {
        console.log(`[CollaborationRoutes] 📢 Broadcasting collaborator-left for ${userName}`);
        collaborationWS.broadcastToProject(projectId, {
          type: 'collaborator-left',
          userId,
          userName,
          timestamp: new Date().toISOString()
        });
      } else {
        console.warn('[CollaborationRoutes] ⚠️ collaborationWS not available, cannot broadcast');
      }
      
      res.json({
        success: true,
        message: 'Left collaboration successfully'
      });
      
    } catch (error) {
      console.error('[CollaborationRoutes] ❌ Failed to leave collaboration:', error.message);
      
      res.status(500).json({
        error: 'LEAVE_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * GET /api/projects/:id/collaborators
   * Get all collaborators for a project
   * Query params: userId (optional) - requesting user ID for visibility filtering
   */
  router.get('/projects/:id/collaborators', async (req, res) => {
    console.log(`[CollaborationRoutes] GET /api/projects/${req.params.id}/collaborators`);
    
    try {
      const { id: projectId } = req.params;
      const { userId } = req.query; // Get requesting user ID from query params
      
      const collaborators = await collaborationManager.getCollaborators(projectId, userId);
      
      res.json({
        success: true,
        collaborators,
        count: collaborators.length
      });
      
    } catch (error) {
      console.error('[CollaborationRoutes] ❌ Failed to get collaborators:', error.message);
      
      res.status(500).json({
        error: 'GET_COLLABORATORS_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * POST /api/projects/:id/collaborators
   * Add a user to project collaboration by email or username
   */
  router.post('/projects/:id/collaborators', async (req, res) => {
    console.log(`[CollaborationRoutes] POST /api/projects/${req.params.id}/collaborators`);
    
    try {
      const { id: projectId } = req.params;
      const { usernameOrEmail, ownerId } = req.body;
      
      if (!usernameOrEmail) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Username or email is required'
        });
      }
      
      // Verify the requester is the owner
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .single();
      
      if (projectError || !project) {
        return res.status(404).json({
          error: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        });
      }
      
      if (project.owner_id !== ownerId) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Only the project owner can add collaborators'
        });
      }
      
      // Find user by email or username
      let targetUser = null;
      
      // Try to find by email first
      if (usernameOrEmail.includes('@')) {
        const { data: users } = await supabase.auth.admin.listUsers();
        targetUser = users?.users?.find(u => u.email === usernameOrEmail);
      }
      
      // If not found by email, try by username (stored in user_metadata)
      if (!targetUser) {
        const { data: users } = await supabase.auth.admin.listUsers();
        targetUser = users?.users?.find(u => 
          u.user_metadata?.username === usernameOrEmail ||
          u.user_metadata?.full_name === usernameOrEmail
        );
      }
      
      if (!targetUser) {
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: 'User not found with that email or username'
        });
      }
      
      // Check if user is already the owner
      if (targetUser.id === project.owner_id) {
        return res.status(400).json({
          error: 'ALREADY_OWNER',
          message: 'This user is the project owner'
        });
      }
      
      // Find or create collaboration
      let { data: collaboration } = await supabase
        .from('collaborations')
        .select('id')
        .eq('project_id', projectId)
        .single();
      
      if (!collaboration) {
        // Create collaboration if it doesn't exist
        const shareToken = require('crypto').randomUUID();
        const { data: newCollab, error: collabError } = await supabase
          .from('collaborations')
          .insert([{
            project_id: projectId,
            share_token: shareToken,
            owner_id: project.owner_id,
            is_public: false,
            require_approval: false,
            created_at: new Date().toISOString(),
            last_modified: new Date().toISOString()
          }])
          .select()
          .single();
        
        if (collabError) {
          throw new Error(`Failed to create collaboration: ${collabError.message}`);
        }
        
        collaboration = newCollab;
      }
      
      // Check if user is already a collaborator
      const { data: existingAccess } = await supabase
        .from('collaborator_access')
        .select('id')
        .eq('collaboration_id', collaboration.id)
        .eq('user_id', targetUser.id)
        .single();
      
      if (existingAccess) {
        return res.status(400).json({
          error: 'ALREADY_COLLABORATOR',
          message: 'User is already a collaborator'
        });
      }
      
      // Add user as collaborator
      const { error: insertError } = await supabase
        .from('collaborator_access')
        .insert([{
          collaboration_id: collaboration.id,
          user_id: targetUser.id,
          user_name: targetUser.email || targetUser.user_metadata?.full_name || 'User',
          permissions: 'read',
          joined_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
          is_visible: true
        }]);
      
      if (insertError) {
        throw new Error(`Failed to add collaborator: ${insertError.message}`);
      }
      
      // Broadcast to all users that a new collaborator was added
      if (collaborationWS) {
        const userName = targetUser.email || targetUser.user_metadata?.full_name || 'User';
        console.log(`[CollaborationRoutes] 📢 Broadcasting collaborator-joined for ${userName}`);
        collaborationWS.broadcastToProject(projectId, {
          type: 'collaborator-joined',
          userId: targetUser.id,
          userName,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        message: 'User added successfully',
        user: {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.user_metadata?.full_name || targetUser.email
        }
      });
      
    } catch (error) {
      console.error('[CollaborationRoutes] ❌ Failed to add collaborator:', error.message);
      
      res.status(500).json({
        error: 'ADD_COLLABORATOR_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * PUT /api/projects/:id/collaborators/:userId
   * Update collaborator permissions
   */
  router.put('/projects/:id/collaborators/:userId', async (req, res) => {
    console.log(`[CollaborationRoutes] PUT /api/projects/${req.params.id}/collaborators/${req.params.userId}`);
    
    try {
      const { id: projectId, userId } = req.params;
      const { permissions } = req.body;
      
      if (!permissions) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Permissions are required'
        });
      }
      
      await collaborationManager.updatePermissions(projectId, userId, permissions);
      
      res.json({
        success: true,
        message: 'Permissions updated successfully'
      });
      
    } catch (error) {
      console.error('[CollaborationRoutes] ❌ Failed to update permissions:', error.message);
      
      res.status(500).json({
        error: 'UPDATE_PERMISSIONS_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * DELETE /api/projects/:id/collaborators/:userId
   * Revoke access for a collaborator
   */
  router.delete('/projects/:id/collaborators/:userId', async (req, res) => {
    console.log(`[CollaborationRoutes] DELETE /api/projects/${req.params.id}/collaborators/${req.params.userId}`);
    
    try {
      const { id: projectId, userId } = req.params;
      
      // Get user name before revoking (for notification)
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const userName = userData?.user?.email || userData?.user?.user_metadata?.full_name || 'User';
      
      await collaborationManager.revokeAccess(projectId, userId);
      
      // Broadcast to all users in the project that someone was removed
      if (collaborationWS) {
        console.log(`[CollaborationRoutes] 📢 Broadcasting collaborator-removed for ${userName}`);
        collaborationWS.broadcastToProject(projectId, {
          type: 'collaborator-removed',
          userId,
          userName,
          timestamp: new Date().toISOString()
        });
      } else {
        console.warn('[CollaborationRoutes] ⚠️ collaborationWS not available, cannot broadcast');
      }
      
      res.json({
        success: true,
        message: 'Access revoked successfully'
      });
      
    } catch (error) {
      console.error('[CollaborationRoutes] ❌ Failed to revoke access:', error.message);
      
      res.status(500).json({
        error: 'REVOKE_ACCESS_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * PATCH /api/projects/:id/collaborators/:userId/visibility
   * Toggle collaborator visibility (owner only)
   */
  router.patch('/projects/:id/collaborators/:userId/visibility', async (req, res) => {
    console.log(`[CollaborationRoutes] PATCH /api/projects/${req.params.id}/collaborators/${req.params.userId}/visibility`);
    
    try {
      const { id: projectId, userId: targetUserId } = req.params;
      const { isVisible, ownerId } = req.body;
      
      if (typeof isVisible !== 'boolean') {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'isVisible must be a boolean'
        });
      }
      
      // Verify the requester is the owner
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .single();
      
      if (projectError || !project) {
        return res.status(404).json({
          error: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        });
      }
      
      if (project.owner_id !== ownerId) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Only the project owner can change visibility'
        });
      }
      
      // Find collaboration
      const { data: collaboration } = await supabase
        .from('collaborations')
        .select('id')
        .eq('project_id', projectId)
        .single();
      
      if (!collaboration) {
        return res.status(404).json({
          error: 'COLLABORATION_NOT_FOUND',
          message: 'Collaboration not found'
        });
      }
      
      // Update visibility
      const { error: updateError } = await supabase
        .from('collaborator_access')
        .update({ is_visible: isVisible })
        .eq('collaboration_id', collaboration.id)
        .eq('user_id', targetUserId);
      
      if (updateError) {
        throw new Error(`Failed to update visibility: ${updateError.message}`);
      }
      
      // Get user name for broadcast
      const { data: userData } = await supabase.auth.admin.getUserById(targetUserId);
      const userName = userData?.user?.email || userData?.user?.user_metadata?.full_name || 'User';
      
      // Broadcast visibility change to all users
      if (collaborationWS) {
        console.log(`[CollaborationRoutes] 📢 Broadcasting visibility-changed for ${userName} (visible: ${isVisible})`);
        collaborationWS.broadcastToProject(projectId, {
          type: 'collaborator-visibility-changed',
          userId: targetUserId,
          userName,
          isVisible,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        message: `Visibility ${isVisible ? 'enabled' : 'disabled'} successfully`
      });
      
    } catch (error) {
      console.error('[CollaborationRoutes] ❌ Failed to update visibility:', error.message);
      
      res.status(500).json({
        error: 'UPDATE_VISIBILITY_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * PATCH /api/projects/:id/collaborators/visibility/all
   * Toggle all collaborators visibility (owner only)
   */
  router.patch('/projects/:id/collaborators/visibility/all', async (req, res) => {
    console.log(`[CollaborationRoutes] PATCH /api/projects/${req.params.id}/collaborators/visibility/all`);
    
    try {
      const { id: projectId } = req.params;
      const { isVisible, ownerId } = req.body;
      
      if (typeof isVisible !== 'boolean') {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'isVisible must be a boolean'
        });
      }
      
      // Verify the requester is the owner
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .single();
      
      if (projectError || !project) {
        return res.status(404).json({
          error: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        });
      }
      
      if (project.owner_id !== ownerId) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Only the project owner can change visibility'
        });
      }
      
      // Find collaboration
      const { data: collaboration } = await supabase
        .from('collaborations')
        .select('id')
        .eq('project_id', projectId)
        .single();
      
      if (!collaboration) {
        return res.status(404).json({
          error: 'COLLABORATION_NOT_FOUND',
          message: 'Collaboration not found'
        });
      }
      
      // Update all collaborators visibility
      const { error: updateError } = await supabase
        .from('collaborator_access')
        .update({ is_visible: isVisible })
        .eq('collaboration_id', collaboration.id);
      
      if (updateError) {
        throw new Error(`Failed to update visibility: ${updateError.message}`);
      }
      
      // Broadcast visibility change to all users
      if (collaborationWS) {
        console.log(`[CollaborationRoutes] 📢 Broadcasting all-visibility-changed (visible: ${isVisible})`);
        collaborationWS.broadcastToProject(projectId, {
          type: 'all-collaborators-visibility-changed',
          isVisible,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        message: `All collaborators visibility ${isVisible ? 'enabled' : 'disabled'} successfully`
      });
      
    } catch (error) {
      console.error('[CollaborationRoutes] ❌ Failed to update all visibility:', error.message);
      
      res.status(500).json({
        error: 'UPDATE_ALL_VISIBILITY_FAILED',
        message: error.message
      });
    }
  });

  /**
   * GET /api/collaborations/:shareToken/sessions
   * Get all sessions for a collaboration (by share token)
   */
  router.get('/:shareToken/sessions', async (req, res) => {
    console.log(`[CollaborationRoutes] GET /api/collaborations/${req.params.shareToken}/sessions`);
    
    try {
      const { shareToken } = req.params;
      
      // Get collaboration from Supabase using share token
      const collaboration = await collaborationManager.getCollaborationByToken(shareToken);
      
      if (!collaboration) {
        return res.status(404).json({
          error: 'COLLABORATION_NOT_FOUND',
          message: 'Collaboration not found'
        });
      }
      
      const projectId = collaboration.projectId || collaboration.project_id;
      
      // Get sessions for the project using sessionManager
      if (sessionManager) {
        const sessions = await sessionManager.getSessionsByProject(projectId);
        
        res.json({
          success: true,
          sessions,
          count: sessions.length
        });
      } else {
        return res.status(500).json({
          error: 'SESSION_MANAGER_NOT_AVAILABLE',
          message: 'Session manager not configured'
        });
      }
      
    } catch (error) {
      console.error('[CollaborationRoutes] ❌ Failed to get collaboration sessions:', error.message);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'COLLABORATION_NOT_FOUND',
          message: error.message
        });
      }
      
      res.status(500).json({
        error: 'GET_SESSIONS_FAILED',
        message: error.message
      });
    }
  });

  /**
   * POST /api/collaborations/:shareToken/sessions
   * Create a new session in a collaboration
   */
  router.post('/:shareToken/sessions', async (req, res) => {
    console.log(`[CollaborationRoutes] POST /api/collaborations/${req.params.shareToken}/sessions`);
    
    try {
      const { shareToken } = req.params;
      const { userId, userName, name, model } = req.body;
      
      if (!userId || !name) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'User ID and session name are required'
        });
      }
      
      // WORKAROUND: Get project ID from share token using shareTokens Map
      // This works with both simple and full collaboration managers
      let projectId;
      
      if (collaborationManager.shareTokens) {
        // Simple manager - use shareTokens Map
        projectId = collaborationManager.shareTokens.get(shareToken);
      } else if (typeof collaborationManager.getCollaborationByToken === 'function') {
        // Full manager - use method
        const collaboration = await collaborationManager.getCollaborationByToken(shareToken);
        projectId = collaboration?.project_id;
      } else {
        // Fallback - try to find in collaborations Map
        for (const [pid, collab] of (collaborationManager.collaborations || new Map()).entries()) {
          if (collab.shareToken === shareToken) {
            projectId = pid;
            break;
          }
        }
      }
      
      if (!projectId) {
        return res.status(404).json({
          error: 'COLLABORATION_NOT_FOUND',
          message: 'Collaboration not found'
        });
      }
      
      // Create session using sessionManager if available
      if (sessionManager) {
        const session = await sessionManager.createSession(
          projectId,
          userId,
          name,
          model || 'gemini-2.5-flash'
        );
        
        res.status(201).json({
          success: true,
          session
        });
      } else {
        return res.status(500).json({
          error: 'SESSION_MANAGER_NOT_AVAILABLE',
          message: 'Session manager not configured'
        });
      }
      
    } catch (error) {
      console.error('[CollaborationRoutes] ❌ Failed to create collaboration session:', error.message);
      
      res.status(500).json({
        error: 'CREATE_SESSION_FAILED',
        message: error.message
      });
    }
  });
  
  return router;
}

module.exports = { setupCollaborationRoutes };
