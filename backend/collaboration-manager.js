/**
 * CollaborationManager Service
 * 
 * Manages project sharing and collaboration features.
 * Handles Project ID generation, access control, and permissions.
 * 
 * MIGRATED TO SUPABASE: All data persistence uses Supabase PostgreSQL
 */

const crypto = require('crypto');

// UUID v4 generator (compatible with CommonJS)
function uuidv4() {
  return crypto.randomUUID();
}

class CollaborationManager {
  constructor(supabaseClient) {
    // Supabase client for data persistence
    if (!supabaseClient) {
      throw new Error('CollaborationManager requires a Supabase client instance');
    }
    this.supabase = supabaseClient;
    
    console.log('[CollaborationManager] Initialized with Supabase persistence');
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
      
      // Check if collaboration already exists
      const { data: existing } = await this.supabase
        .from('collaborations')
        .select('*')
        .eq('project_id', projectId)
        .single();
      
      if (existing) {
        console.log('[CollaborationManager] Collaboration already exists, returning existing');
        return {
          ...existing,
          createdAt: new Date(existing.created_at),
          lastModified: new Date(existing.last_modified)
        };
      }
      
      // Generate unique share token (Project ID)
      const shareToken = uuidv4();
      
      // Create collaboration record
      const collaborationData = {
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
        .from('collaborations')
        .insert([collaborationData])
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to create collaboration: ${error.message}`);
      }
      
      console.log(`[CollaborationManager] ✅ Project shared with token: ${shareToken}`);
      
      return {
        ...data,
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
      
      // Find collaboration by share token
      const { data: collaboration, error: collabError } = await this.supabase
        .from('collaborations')
        .select('*')
        .eq('share_token', shareToken)
        .single();
      
      if (collabError || !collaboration) {
        throw new Error('Project ID not found');
      }
      
      // Check if collaboration has expired
      if (collaboration.expires_at && new Date(collaboration.expires_at) < new Date()) {
        throw new Error('This collaboration link has expired');
      }
      
      // Check if user is already a collaborator
      const { data: existingAccess } = await this.supabase
        .from('collaborator_access')
        .select('*')
        .eq('collaboration_id', collaboration.id)
        .eq('user_id', userId)
        .single();
      
      let isNewCollaborator = false;
      
      if (existingAccess) {
        console.log('[CollaborationManager] User already has access');
        // Update last active
        await this.supabase
          .from('collaborator_access')
          .update({ last_active: new Date().toISOString() })
          .eq('id', existingAccess.id);
      } else {
        // Add user to collaborator access list
        const accessData = {
          collaboration_id: collaboration.id,
          user_id: userId,
          user_name: userName,
          permissions: 'read', // Default to read-only
          joined_at: new Date().toISOString(),
          last_active: new Date().toISOString()
        };
        
        const { error: accessError } = await this.supabase
          .from('collaborator_access')
          .insert([accessData]);
        
        if (accessError) {
          throw new Error(`Failed to add collaborator: ${accessError.message}`);
        }
        
        isNewCollaborator = true;
        console.log('[CollaborationManager] ✅ User added as collaborator');
      }
      
      // Get project details
      const { data: project, error: projectError } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', collaboration.project_id)
        .single();
      
      if (projectError || !project) {
        throw new Error('Project not found');
      }
      
      return {
        project: {
          ...project,
          createdAt: new Date(project.created_at),
          lastActive: new Date(project.last_active)
        },
        collaboration: {
          ...collaboration,
          createdAt: new Date(collaboration.created_at),
          lastModified: new Date(collaboration.last_modified)
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
      // Find collaboration
      const { data: collaboration } = await this.supabase
        .from('collaborations')
        .select('*')
        .eq('project_id', projectId)
        .single();
      
      if (!collaboration) {
        throw new Error('Collaboration not found');
      }
      
      // Remove user from collaborator access
      const { error } = await this.supabase
        .from('collaborator_access')
        .delete()
        .eq('collaboration_id', collaboration.id)
        .eq('user_id', userId);
      
      if (error) {
        throw new Error(`Failed to leave project: ${error.message}`);
      }
      
      console.log('[CollaborationManager] ✅ User left project');
      
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
      
      // Get owner's profile
      const { data: ownerProfile } = await this.supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .eq('id', project.owner_id)
        .single();
      
      console.log('[CollaborationManager] Owner profile:', ownerProfile);
      
      // Get owner's auth metadata for avatar
      const { data: ownerAuth } = await this.supabase.auth.admin.getUserById(project.owner_id);
      console.log('[CollaborationManager] Owner auth fetched');
      
      // Find collaboration
      const { data: collaboration } = await this.supabase
        .from('collaborations')
        .select('*')
        .eq('project_id', projectId)
        .single();
      
      const collaboratorsList = [];
      
      // Add project owner first (always add owner even if profile doesn't exist)
      const ownerData = {
        user_id: project.owner_id,
        user_name: ownerProfile?.full_name || ownerProfile?.email || ownerAuth?.user?.email || 'Owner',
        email: ownerProfile?.email || ownerAuth?.user?.email,
        avatar_url: ownerProfile?.avatar_url || ownerAuth?.user?.user_metadata?.avatar_url,
        permissions: 'owner',
        is_owner: true,
        joined_at: project.created_at,
        last_active: project.last_active || project.created_at
      };
      console.log('[CollaborationManager] Owner ID:', project.owner_id);
      console.log('[CollaborationManager] Owner auth metadata:', ownerAuth?.user?.user_metadata);
      console.log('[CollaborationManager] Owner data:', ownerData);
      collaboratorsList.push(ownerData);
      
      // Get collaborator access records if collaboration exists
      if (collaboration) {
        const { data: collaborators, error } = await this.supabase
          .from('collaborator_access')
          .select('*')
          .eq('collaboration_id', collaboration.id)
          .order('joined_at', { ascending: false });
        
        if (error) {
          throw new Error(`Failed to get collaborators: ${error.message}`);
        }
        
        // Add collaborators (excluding owner if they're in the list)
        if (collaborators) {
          for (const c of collaborators) {
            if (c.user_id !== project.owner_id) {
              // Get collaborator's profile
              const { data: collabProfile } = await this.supabase
                .from('profiles')
                .select('avatar_url')
                .eq('id', c.user_id)
                .single();
              
              // Get user's auth metadata for avatar
              const { data: userAuth } = await this.supabase.auth.admin.getUserById(c.user_id);
              
              const collabData = {
                ...c,
                avatar_url: collabProfile?.avatar_url || userAuth?.user?.user_metadata?.avatar_url,
                is_owner: false,
                joinedAt: new Date(c.joined_at),
                lastActive: new Date(c.last_active)
              };
              console.log('[CollaborationManager] Collaborator ID:', c.user_id);
              console.log('[CollaborationManager] Collaborator auth metadata:', userAuth?.user?.user_metadata);
              console.log('[CollaborationManager] Collaborator data:', collabData);
              
              // Check if requesting user is the owner or the user themselves
              const isOwnerRequesting = requestingUserId === project.owner_id;
              const isUserThemselves = requestingUserId === c.user_id;
              
              // Only add collaborator if:
              // 1. Requesting user is the owner (sees all), OR
              // 2. Requesting user is the collaborator themselves (sees themselves even if hidden), OR
              // 3. Collaborator is visible (is_visible = true)
              if (isOwnerRequesting || isUserThemselves || c.is_visible !== false) {
                collaboratorsList.push(collabData);
              } else {
                console.log('[CollaborationManager] 🙈 Hiding collaborator from other users:', c.user_name);
              }
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
      if (!['read', 'write'].includes(permissions)) {
        throw new Error('Invalid permissions. Must be "read" or "write"');
      }
      
      // Find collaboration
      const { data: collaboration } = await this.supabase
        .from('collaborations')
        .select('*')
        .eq('project_id', projectId)
        .single();
      
      if (!collaboration) {
        throw new Error('Collaboration not found');
      }
      
      // Update permissions
      const { error } = await this.supabase
        .from('collaborator_access')
        .update({ permissions })
        .eq('collaboration_id', collaboration.id)
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
      // Get collaborator access records for user
      const { data: accessRecords, error: accessError } = await this.supabase
        .from('collaborator_access')
        .select('collaboration_id, permissions, joined_at, last_active')
        .eq('user_id', userId);
      
      if (accessError) {
        throw new Error(`Failed to get collaborations: ${accessError.message}`);
      }
      
      if (!accessRecords || accessRecords.length === 0) {
        return [];
      }
      
      // Get collaboration details
      const collaborationIds = accessRecords.map(r => r.collaboration_id);
      const { data: collaborations, error: collabError } = await this.supabase
        .from('collaborations')
        .select('*')
        .in('id', collaborationIds);
      
      if (collabError) {
        throw new Error(`Failed to get collaboration details: ${collabError.message}`);
      }
      
      // Get project details
      const projectIds = collaborations.map(c => c.project_id);
      const { data: projects, error: projectError } = await this.supabase
        .from('projects')
        .select('*')
        .in('id', projectIds);
      
      if (projectError) {
        throw new Error(`Failed to get project details: ${projectError.message}`);
      }
      
      // Get owner details using admin API
      const ownerIds = [...new Set(projects.map(p => p.owner_id))]; // Unique owner IDs
      const ownerMap = new Map();
      
      for (const ownerId of ownerIds) {
        try {
          const { data: userData, error: ownerError } = await this.supabase.auth.admin.getUserById(ownerId);
          
          if (!ownerError && userData?.user) {
            const user = userData.user;
            const ownerName = user.user_metadata?.full_name || 
                             user.user_metadata?.name ||
                             user.email?.split('@')[0] || 
                             'Unknown Owner';
            ownerMap.set(ownerId, ownerName);
          } else {
            console.warn(`[CollaborationManager] Failed to get owner ${ownerId}:`, ownerError?.message);
            ownerMap.set(ownerId, 'Unknown Owner');
          }
        } catch (error) {
          console.warn(`[CollaborationManager] Error fetching owner ${ownerId}:`, error.message);
          ownerMap.set(ownerId, 'Unknown Owner');
        }
      }
      
      // Combine data
      return collaborations.map(collab => {
        const access = accessRecords.find(a => a.collaboration_id === collab.id);
        const project = projects.find(p => p.id === collab.project_id);
        const ownerName = project ? ownerMap.get(project.owner_id) || 'Unknown Owner' : 'Unknown Owner';
        
        return {
          collaboration: {
            ...collab,
            createdAt: new Date(collab.created_at),
            lastModified: new Date(collab.last_modified),
            ownerName: ownerName
          },
          project: project ? {
            ...project,
            createdAt: new Date(project.created_at),
            lastActive: new Date(project.last_active),
            ownerName: ownerName
          } : null,
          myPermissions: access?.permissions || 'read',
          joinedAt: access ? new Date(access.joined_at) : null,
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
    console.log(`[CollaborationManager] Getting collaboration by token ${shareToken}`);
    
    try {
      // Validate share token format (UUID)
      if (!this.isValidUUID(shareToken)) {
        throw new Error('Invalid Project ID format');
      }
      
      // Find collaboration by share token
      const { data: collaboration, error: collabError } = await this.supabase
        .from('collaborations')
        .select('*')
        .eq('share_token', shareToken)
        .single();
      
      if (collabError || !collaboration) {
        throw new Error('Collaboration not found');
      }
      
      // Check if collaboration has expired
      if (collaboration.expires_at && new Date(collaboration.expires_at) < new Date()) {
        throw new Error('This collaboration link has expired');
      }
      
      return {
        ...collaboration,
        createdAt: new Date(collaboration.created_at),
        lastModified: new Date(collaboration.last_modified)
      };
      
    } catch (error) {
      console.error('[CollaborationManager] ❌ Failed to get collaboration:', error.message);
      throw error;
    }
  }

  /**
   * Get all sessions for a collaboration (by share token)
   * @param {string} shareToken - Project ID (share token)
   * @returns {Promise<Array>} List of sessions
   */
  async getCollaborationSessions(shareToken) {
    console.log(`[CollaborationManager] Getting sessions for collaboration ${shareToken}`);
    
    try {
      // Validate share token format (UUID)
      if (!this.isValidUUID(shareToken)) {
        throw new Error('Invalid Project ID format');
      }
      
      // Find collaboration by share token
      const { data: collaboration, error: collabError } = await this.supabase
        .from('collaborations')
        .select('*')
        .eq('share_token', shareToken)
        .single();
      
      if (collabError || !collaboration) {
        throw new Error('Collaboration not found');
      }
      
      // Check if collaboration has expired
      if (collaboration.expires_at && new Date(collaboration.expires_at) < new Date()) {
        throw new Error('This collaboration link has expired');
      }
      
      // Get all sessions for the project
      const { data: sessions, error: sessionsError } = await this.supabase
        .from('sessions')
        .select('*')
        .eq('project_id', collaboration.project_id)
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
      console.error('[CollaborationManager] ❌ Failed to get collaboration sessions:', error.message);
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
