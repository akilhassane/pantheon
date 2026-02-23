/**
 * CollaborationManager Service
 * 
 * Manages project sharing and collaboration features.
 * Handles Project ID generation, access control, and permissions.
 * 
 * Uses local PostgreSQL via Supabase-compatible client
 */

const crypto = require('crypto');

// UUID v4 generator (compatible with CommonJS)
function uuidv4() {
  return crypto.randomUUID();
}

class CollaborationManager {
  constructor(supabaseClient) {
    // Supabase client (connects to local PostgreSQL when USE_LOCAL_POSTGRES=true)
    if (!supabaseClient) {
      throw new Error('CollaborationManager requires a Supabase client instance');
    }
    this.supabase = supabaseClient;
    
    console.log('[CollaborationManager] Initialized with database persistence');
  }

  /**
   * Share a project and generate Project ID
   * @param {string} projectId - Project to share
   * @param {string} ownerId - Owner user ID
   * @param {Object} permissions - Default permissions for collaborators
   * @returns {Promise<Object>} Collaboration data with share token
   */
  async shareProject(projectId, ownerId, permissions = { default: 'read' }) {
    console.log(`[CollaborationManager] Sharing project ${projectId}`);
    
    try {
      // Check if project exists and user is owner
      const { data: project, error: projectError } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('owner_id', ownerId)
        .single();
      
      if (projectError || !project) {
        throw new Error('Project not found or you are not the owner');
      }
      
      // Check if project share already exists
      const { data: existing } = await this.supabase
        .from('project_shares')
        .select('*')
        .eq('project_id', projectId)
        .single();
      
      if (existing) {
        console.log('[CollaborationManager] Project share already exists, returning existing');
        return {
          ...existing,
          shareToken: existing.share_token,
          createdAt: new Date(existing.created_at),
          lastModified: new Date(existing.last_modified)
        };
      }
      
      // Generate unique share token (Project ID)
      const shareToken = uuidv4();
      
      // Create project share record
      const shareData = {
        project_id: projectId,
        share_token: shareToken,
        owner_id: ownerId,
        is_public: permissions.isPublic || false,
        require_approval: permissions.requireApproval || false,
        expires_at: permissions.expiresAt || null,
        created_at: new Date().toISOString(),
        last_modified: new Date().toISOString()
      };
      
      const { data, error } = await this.supabase
        .from('project_shares')
        .insert([shareData])
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to create collaboration: ${error.message}`);
      }
      
      console.log(`[CollaborationManager] ✅ Project shared with token: ${shareToken}`);
      
      return {
        ...data,
        shareToken: data.share_token,
        createdAt: new Date(data.created_at),
        lastModified: new Date(data.last_modified)
      };
      
    } catch (error) {
      console.error('[CollaborationManager] ❌ Failed to share project:', error.message);
      throw error;
    }
  }

  /**
   * Join a project using Project ID
   * @param {string} shareToken - Project ID (share token)
   * @param {string} userId - User ID joining
   * @param {string} userName - User name
   * @returns {Promise<Object>} Project and collaboration data
   */
  async joinProject(shareToken, userId, userName) {
    console.log(`[CollaborationManager] User ${userId} joining project with token ${shareToken}`);
    
    try {
      // Validate share token format (UUID)
      if (!this.isValidUUID(shareToken)) {
        throw new Error('Invalid Project ID format');
      }
      
      // Find project share by share token
      const { data: projectShare, error: shareError } = await this.supabase
        .from('project_shares')
        .select('*')
        .eq('share_token', shareToken)
        .single();
      
      if (shareError || !projectShare) {
        throw new Error('Project ID not found');
      }
      
      // Check if share has expired
      if (projectShare.expires_at && new Date(projectShare.expires_at) < new Date()) {
        throw new Error('This collaboration link has expired');
      }
      
      const projectId = projectShare.project_id;
      
      // Get project details to check ownership
      const { data: project, error: projectError } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (projectError || !project) {
        throw new Error('Project not found');
      }
      
      // Prevent owner from joining their own project
      if (project.owner_id === userId) {
        console.log('[CollaborationManager] Owner cannot join their own project');
        return {
          project: {
            ...project,
            createdAt: new Date(project.created_at),
            lastActive: new Date(project.last_active)
          },
          projectShare: {
            ...projectShare,
            createdAt: new Date(projectShare.created_at),
            lastModified: new Date(projectShare.last_modified)
          },
          isNewCollaborator: false,
          isOwner: true
        };
      }
      
      // Check if user is already a collaborator
      const { data: existingCollab } = await this.supabase
        .from('collaborations')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();
      
      let isNewCollaborator = false;
      
      if (existingCollab) {
        console.log('[CollaborationManager] User already has access');
      } else {
        // Add user to collaborations
        const collabData = {
          project_id: projectId,
          user_id: userId,
          role: 'viewer', // Default to viewer
          created_at: new Date().toISOString()
        };
        
        const { error: collabError } = await this.supabase
          .from('collaborations')
          .insert([collabData]);
        
        if (collabError) {
          throw new Error(`Failed to add collaborator: ${collabError.message}`);
        }
        
        isNewCollaborator = true;
        console.log('[CollaborationManager] ✅ User added as collaborator');
      }
      
      return {
        project: {
          ...project,
          createdAt: new Date(project.created_at),
          lastActive: new Date(project.last_active)
        },
        projectShare: {
          ...projectShare,
          createdAt: new Date(projectShare.created_at),
          lastModified: new Date(projectShare.last_modified)
        },
        isNewCollaborator
      };
      
    } catch (error) {
      console.error('[CollaborationManager] ❌ Failed to join project:', error.message);
      throw error;
    }
  }

  /**
   * Leave a collaboration
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID leaving
   */
  async leaveProject(projectId, userId) {
    console.log(`[CollaborationManager] User ${userId} leaving project ${projectId}`);
    
    try {
      // Remove user from collaborations
      const { data, error } = await this.supabase
        .from('collaborations')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .select();
      
      if (error) {
        console.error('[CollaborationManager] ❌ Delete error:', error);
        throw new Error(`Failed to leave project: ${error.message}`);
      }
      
      console.log('[CollaborationManager] ✅ User left project, deleted rows:', data);
      
      return { success: true, deletedRows: data };
      
    } catch (error) {
      console.error('[CollaborationManager] ❌ Failed to leave project:', error.message);
      throw error;
    }
  }

  /**
   * Get all collaborators for a project
   * @param {string} projectId - Project ID
   * @param {string} requestingUserId - User ID making the request (optional, for visibility filtering)
   * @returns {Promise<Array>} List of collaborators
   */
  async getCollaborators(projectId, requestingUserId = null) {
    console.log('[CollaborationManager] Getting collaborators for project:', projectId, 'requesting user:', requestingUserId);
    
    try {
      // Get project to find owner (without profiles join first to debug)
      const { data: project, error: projectError } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      console.log('[CollaborationManager] Project query result:', { 
        found: !!project, 
        error: projectError?.message,
        ownerId: project?.owner_id 
      });
      
      if (!project) {
        console.log('[CollaborationManager] ⚠️ No project found, returning empty array');
        return [];
      }
      
      console.log('[CollaborationManager] Project owner:', project.owner_id);
      
      // Get owner's user data from users table
      const { data: ownerUser } = await this.supabase
        .from('users')
        .select('id, email, name, picture, avatar_url')
        .eq('id', project.owner_id)
        .single();
      
      console.log('[CollaborationManager] Owner user:', ownerUser);
      
      const collaboratorsList = [];
      
      // Add project owner first (always add owner even if user doesn't exist)
      const ownerData = {
        user_id: project.owner_id,
        user_name: ownerUser?.name || ownerUser?.email || 'Owner',
        email: ownerUser?.email,
        avatar_url: ownerUser?.picture || ownerUser?.avatar_url || null,
        permissions: 'owner',
        is_owner: true,
        joined_at: project.created_at,
        last_active: project.last_active || project.created_at
      };
      console.log('[CollaborationManager] Owner data:', ownerData);
      collaboratorsList.push(ownerData);
      
      // Get collaborators (users who have joined via share token)
      const { data: collaborators, error } = await this.supabase
        .from('collaborations')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new Error(`Failed to get collaborators: ${error.message}`);
      }
      
      // Add collaborators (excluding owner if they're in the list)
      if (collaborators) {
        for (const c of collaborators) {
          if (c.user_id !== project.owner_id) {
            // Get collaborator's user data
            const { data: collabUser } = await this.supabase
              .from('users')
              .select('email, name, picture, avatar_url')
              .eq('id', c.user_id)
              .single();
            
            const collabData = {
              user_id: c.user_id,
              user_name: collabUser?.name || collabUser?.email || 'User',
              email: collabUser?.email,
              avatar_url: collabUser?.picture || collabUser?.avatar_url || null,
              permissions: c.role || 'viewer',
              is_owner: false,
              joined_at: c.created_at,
              last_active: c.created_at
            };
            console.log('[CollaborationManager] Collaborator data:', collabData);
            
            // Check if requesting user is the owner or the user themselves
            const isOwnerRequesting = requestingUserId === project.owner_id;
            const isUserThemselves = requestingUserId === c.user_id;
            
            // Only add collaborator if:
            // 1. Requesting user is the owner (sees all), OR
            // 2. Requesting user is the collaborator themselves (sees themselves), OR
            // 3. Collaborator is visible (is_visible = true)
            if (isOwnerRequesting || isUserThemselves || c.is_visible !== false) {
              collaboratorsList.push(collabData);
            } else {
              console.log('[CollaborationManager] 🙈 Hiding collaborator from other users:', collabData.user_name);
            }
          }
        }
      }
      
      console.log('[CollaborationManager] Final collaborators list:', collaboratorsList);
      return collaboratorsList;
      
    } catch (error) {
      console.error('[CollaborationManager] ❌ Failed to get collaborators:', error.message);
      throw error;
    }
  }

  /**
   * Update collaborator permissions
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID to update
   * @param {string} permissions - New permissions ('read' or 'write')
   */
  async updatePermissions(projectId, userId, permissions) {
    console.log(`[CollaborationManager] Updating permissions for user ${userId} to ${permissions}`);
    
    try {
      // Validate permissions
      if (!['viewer', 'editor'].includes(permissions)) {
        throw new Error('Invalid permissions. Must be "viewer" or "editor"');
      }
      
      // Update role in collaborations table
      const { error } = await this.supabase
        .from('collaborations')
        .update({ role: permissions })
        .eq('project_id', projectId)
        .eq('user_id', userId);
      
      if (error) {
        throw new Error(`Failed to update permissions: ${error.message}`);
      }
      
      console.log('[CollaborationManager] ✅ Permissions updated');
      
    } catch (error) {
      console.error('[CollaborationManager] ❌ Failed to update permissions:', error.message);
      throw error;
    }
  }

  /**
   * Revoke access for a collaborator
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID to revoke
   */
  async revokeAccess(projectId, userId) {
    console.log(`[CollaborationManager] Revoking access for user ${userId}`);
    
    try {
      await this.leaveProject(projectId, userId);
      console.log('[CollaborationManager] ✅ Access revoked');
    } catch (error) {
      console.error('[CollaborationManager] ❌ Failed to revoke access:', error.message);
      throw error;
    }
  }

  /**
   * Get all collaborations for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of collaborations
   */
  async getUserCollaborations(userId) {
    try {
      // Get collaborations where user is a collaborator and is_visible is true
      const { data: collabs, error: collabError } = await this.supabase
        .from('collaborations')
        .select('project_id, role, created_at')
        .eq('user_id', userId)
        .eq('is_visible', true);
      
      if (collabError) {
        throw new Error(`Failed to get collaborations: ${collabError.message}`);
      }
      
      if (!collabs || collabs.length === 0) {
        console.log(`[CollaborationManager] No visible collaborations found for user ${userId}`);
        return [];
      }
      
      console.log(`[CollaborationManager] Found ${collabs.length} visible collaboration(s) for user ${userId}`);
      
      // Get project details
      const projectIds = collabs.map(c => c.project_id);
      const { data: projects, error: projectError } = await this.supabase
        .from('projects')
        .select('*')
        .in('id', projectIds);
      
      if (projectError) {
        throw new Error(`Failed to get project details: ${projectError.message}`);
      }
      
      console.log(`[CollaborationManager] Found ${projects?.length || 0} project(s) for collaborations`);
      
      // Get project shares for these projects
      const { data: projectShares } = await this.supabase
        .from('project_shares')
        .select('*')
        .in('project_id', projectIds);
      
      // Get owner details
      const ownerIds = [...new Set(projects.map(p => p.owner_id))];
      const ownerMap = new Map();
      
      for (const ownerId of ownerIds) {
        const { data: ownerUser } = await this.supabase
          .from('users')
          .select('email')
          .eq('id', ownerId)
          .single();
        
        if (ownerUser) {
          ownerMap.set(ownerId, ownerUser.email || 'Unknown Owner');
        } else {
          ownerMap.set(ownerId, 'Unknown Owner');
        }
      }
      
      // Combine data
      return collabs.map(collab => {
        const project = projects.find(p => p.id === collab.project_id);
        const projectShare = projectShares?.find(ps => ps.project_id === collab.project_id);
        const ownerName = project ? ownerMap.get(project.owner_id) || 'Unknown Owner' : 'Unknown Owner';
        
        return {
          projectShare: projectShare ? {
            ...projectShare,
            createdAt: new Date(projectShare.created_at),
            lastModified: new Date(projectShare.last_modified),
            ownerName: ownerName
          } : null,
          project: project ? {
            ...project,
            createdAt: new Date(project.created_at),
            lastActive: new Date(project.last_active),
            ownerName: ownerName
          } : null,
          myPermissions: collab.role || 'viewer',
          joinedAt: new Date(collab.created_at),
          ownerName: ownerName
        };
      });
      
    } catch (error) {
      console.error('[CollaborationManager] ❌ Failed to get user collaborations:', error.message);
      throw error;
    }
  }

  /**
   * Get collaboration by share token
   * @param {string} shareToken - Project ID (share token)
   * @returns {Promise<Object>} Collaboration data
   */
  async getCollaborationByToken(shareToken) {
    console.log(`[CollaborationManager] Getting project share by token ${shareToken}`);
    
    try {
      // Validate share token format (UUID)
      if (!this.isValidUUID(shareToken)) {
        throw new Error('Invalid Project ID format');
      }
      
      // Find project share by share token
      const { data: projectShare, error: shareError } = await this.supabase
        .from('project_shares')
        .select('*')
        .eq('share_token', shareToken)
        .single();
      
      if (shareError || !projectShare) {
        throw new Error('Project share not found');
      }
      
      // Check if share has expired
      if (projectShare.expires_at && new Date(projectShare.expires_at) < new Date()) {
        throw new Error('This collaboration link has expired');
      }
      
      return {
        ...projectShare,
        shareToken: projectShare.share_token,
        createdAt: new Date(projectShare.created_at),
        lastModified: new Date(projectShare.last_modified)
      };
      
    } catch (error) {
      console.error('[CollaborationManager] ❌ Failed to get project share:', error.message);
      throw error;
    }
  }

  /**
   * Get all sessions for a collaboration (by share token)
   * @param {string} shareToken - Project ID (share token)
   * @returns {Promise<Array>} List of sessions
   */
  async getCollaborationSessions(shareToken) {
    console.log(`[CollaborationManager] Getting sessions for project share ${shareToken}`);
    
    try {
      // Validate share token format (UUID)
      if (!this.isValidUUID(shareToken)) {
        throw new Error('Invalid Project ID format');
      }
      
      // Find project share by share token
      const { data: projectShare, error: shareError } = await this.supabase
        .from('project_shares')
        .select('*')
        .eq('share_token', shareToken)
        .single();
      
      if (shareError || !projectShare) {
        throw new Error('Project share not found');
      }
      
      // Check if share has expired
      if (projectShare.expires_at && new Date(projectShare.expires_at) < new Date()) {
        throw new Error('This collaboration link has expired');
      }
      
      // Get all sessions for the project
      const { data: sessions, error: sessionsError } = await this.supabase
        .from('sessions')
        .select('*')
        .eq('project_id', projectShare.project_id)
        .order('last_active', { ascending: false });
      
      if (sessionsError) {
        throw new Error(`Failed to get sessions: ${sessionsError.message}`);
      }
      
      console.log(`[CollaborationManager] ✅ Found ${sessions?.length || 0} sessions`);
      
      return (sessions || []).map(s => ({
        ...s,
        createdAt: new Date(s.created_at),
        lastActive: new Date(s.last_active)
      }));
      
    } catch (error) {
      console.error('[CollaborationManager] ❌ Failed to get project share sessions:', error.message);
      throw error;
    }
  }

  /**
   * Validate UUID format
   * @param {string} uuid - UUID to validate
   * @returns {boolean} True if valid UUID
   */
  isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}

module.exports = CollaborationManager;
