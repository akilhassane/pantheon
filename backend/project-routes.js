/**
 * Project Management API Routes
 * 
 * Handles HTTP endpoints for project CRUD operations
 */

const express = require('express');
const router = express.Router();

/**
 * Setup project routes
 * @param {Object} projectManager - ProjectManager instance
 * @param {Object} dockerSyncService - DockerSyncService instance (optional)
 * @returns {Router} Express router
 */
function setupProjectRoutes(projectManager, dockerSyncService = null) {
  
  /**
   * POST /api/projects/create-placeholder
   * Create a project placeholder in database with status='creating'
   */
  router.post('/create-placeholder', async (req, res) => {
    const startTime = Date.now();
    console.log('[ProjectRoutes] POST /api/projects/create-placeholder');
    
    try {
      const { name, userId, os } = req.body;
      
      // Validation
      if (!name || typeof name !== 'string') {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Project name is required and must be a string'
        });
      }
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'User ID is required'
        });
      }
      
      // Validate name length
      if (name.length < 1 || name.length > 255) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Project name must be between 1 and 255 characters'
        });
      }
      
      const operatingSystem = os || 'kali-linux';
      
      console.log(`[ProjectRoutes] Creating placeholder for "${name}" with OS: ${operatingSystem}`);
      
      // Create placeholder project in database only
      const project = await projectManager.createProjectPlaceholder(userId, name, operatingSystem);
      
      const duration = Date.now() - startTime;
      console.log(`[ProjectRoutes] ✅ Placeholder created in ${duration}ms`);
      
      res.status(201).json({
        success: true,
        project
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[ProjectRoutes] ❌ Failed to create placeholder after ${duration}ms:`, error.message);
      
      res.status(500).json({
        error: 'PLACEHOLDER_CREATION_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * POST /api/projects/:id/initialize
   * Initialize a project (create container and infrastructure)
   */
  router.post('/:id/initialize', async (req, res) => {
    const startTime = Date.now();
    const { id } = req.params;
    console.log(`[ProjectRoutes] POST /api/projects/${id}/initialize`);
    
    try {
      const { os } = req.body;
      
      console.log(`[ProjectRoutes] Initializing project ${id} with OS: ${os}`);
      
      // Initialize the project (create container, etc.)
      const project = await projectManager.initializeProject(id, os);
      
      const duration = Date.now() - startTime;
      console.log(`[ProjectRoutes] ✅ Project initialized in ${duration}ms`);
      
      res.json({
        success: true,
        project
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[ProjectRoutes] ❌ Failed to initialize project after ${duration}ms:`, error.message);
      
      res.status(500).json({
        error: 'PROJECT_INITIALIZATION_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * POST /api/projects
   * Create a new project
   */
  router.post('/', async (req, res) => {
    const startTime = Date.now();
    console.log('[ProjectRoutes] POST /api/projects');
    
    try {
      const { name, userId, os } = req.body;
      
      // Validation
      if (!name || typeof name !== 'string') {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Project name is required and must be a string'
        });
      }
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'User ID is required'
        });
      }
      
      // Validate name length
      if (name.length < 1 || name.length > 255) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Project name must be between 1 and 255 characters'
        });
      }
      
      // Default to kali-linux if no OS specified
      const operatingSystem = os || 'kali-linux';
      
      console.log(`[ProjectRoutes] Creating project "${name}" for user ${userId} with OS: ${operatingSystem}`);
      
      // Create project
      const project = await projectManager.createProject(userId, name, null, operatingSystem);
      
      const duration = Date.now() - startTime;
      console.log(`[ProjectRoutes] ✅ Project created in ${duration}ms`);
      
      res.status(201).json({
        success: true,
        project
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[ProjectRoutes] ❌ Failed to create project after ${duration}ms:`, error.message);
      
      res.status(500).json({
        error: 'PROJECT_CREATION_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * GET /api/projects/:id/status
   * Get detailed project status including container readiness
   */
  router.get('/:id/status', async (req, res) => {
    const { id } = req.params;
    console.log(`[ProjectRoutes] GET /api/projects/${id}/status`);
    
    try {
      const status = await projectManager.getProjectStatus(id);
      
      // Only log if it's not a "Project not found" error (deleted projects polling)
      const isProjectNotFoundError = status.status === 'error' && status.error && status.error.includes('Project not found');
      if (!isProjectNotFoundError) {
        console.log(`[ProjectRoutes] Status for ${id}:`, JSON.stringify(status));
      }
      
      res.json({
        success: true,
        status
      });
    } catch (error) {
      console.error(`[ProjectRoutes] Failed to get project status:`, error.message);
      res.status(500).json({
        error: 'STATUS_CHECK_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * GET /api/projects
   * List all projects for a user
   */
  router.get('/', async (req, res) => {
    console.log('[ProjectRoutes] GET /api/projects');
    
    try {
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'User ID is required'
        });
      }
      
      const projects = await projectManager.listProjects(userId);
      
      res.json({
        success: true,
        projects: Array.isArray(projects) ? projects : [],
        count: Array.isArray(projects) ? projects.length : 0
      });
      
    } catch (error) {
      console.error('[ProjectRoutes] ❌ Failed to list projects:', error.message);
      
      res.status(500).json({
        error: 'PROJECT_LIST_FAILED',
        message: error.message,
        projects: [],
        count: 0
      });
    }
  });
  
  /**
   * GET /api/projects/:id
   * Get project details
   */
  router.get('/:id', (req, res) => {
    console.log(`[ProjectRoutes] GET /api/projects/${req.params.id}`);
    
    try {
      const { id } = req.params;
      
      const project = projectManager.getProject(id);
      
      res.json({
        success: true,
        project
      });
      
    } catch (error) {
      console.error('[ProjectRoutes] ❌ Failed to get project:', error.message);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'PROJECT_NOT_FOUND',
          message: error.message
        });
      }
      
      res.status(500).json({
        error: 'PROJECT_GET_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * DELETE /api/projects/:id
   * Delete a project
   */
  router.delete('/:id', async (req, res) => {
    console.log(`[ProjectRoutes] DELETE /api/projects/${req.params.id}`);
    
    try {
      const { id } = req.params;
      
      await projectManager.deleteProject(id);
      
      res.json({
        success: true,
        message: 'Project deleted successfully'
      });
      
    } catch (error) {
      console.error('[ProjectRoutes] ❌ Failed to delete project:', error.message);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'PROJECT_NOT_FOUND',
          message: error.message
        });
      }
      
      res.status(500).json({
        error: 'PROJECT_DELETE_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * PUT /api/projects/:id
   * Update project details
   */
  router.put('/:id', async (req, res) => {
    console.log(`[ProjectRoutes] PUT /api/projects/${req.params.id}`);
    
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      
      // Validate name if provided
      if (name !== undefined) {
        if (typeof name !== 'string' || name.length < 1 || name.length > 255) {
          return res.status(400).json({
            error: 'INVALID_REQUEST',
            message: 'Project name must be between 1 and 255 characters'
          });
        }
      }
      
      // Update in memory
      const project = projectManager.getProject(id);
      if (name !== undefined) project.name = name;
      if (description !== undefined) project.description = description;
      project.lastActive = new Date();
      
      projectManager.saveProjects();
      
      res.json({
        success: true,
        project
      });
      
    } catch (error) {
      console.error('[ProjectRoutes] ❌ Failed to update project:', error.message);
      
      res.status(500).json({
        error: 'PROJECT_UPDATE_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * GET /api/projects/:id/status
   * Get real-time project status
   */
  router.get('/:id/status', async (req, res) => {
    console.log(`[ProjectRoutes] GET /api/projects/${req.params.id}/status`);
    
    try {
      const { id } = req.params;
      
      const status = await projectManager.getProjectStatus(id);
      
      res.json({
        success: true,
        status
      });
      
    } catch (error) {
      console.error('[ProjectRoutes] ❌ Failed to get project status:', error.message);
      
      res.status(500).json({
        error: 'PROJECT_STATUS_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * POST /api/projects/:id/restart
   * Restart a project container
   */
  router.post('/:id/restart', async (req, res) => {
    console.log(`[ProjectRoutes] POST /api/projects/${req.params.id}/restart`);
    
    try {
      const { id } = req.params;
      
      await projectManager.restartProject(id);
      
      res.json({
        success: true,
        message: 'Project restarted successfully'
      });
      
    } catch (error) {
      console.error('[ProjectRoutes] ❌ Failed to restart project:', error.message);
      
      res.status(500).json({
        error: 'PROJECT_RESTART_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * GET /api/projects/:id/logs
   * Get container logs
   */
  router.get('/:id/logs', async (req, res) => {
    console.log(`[ProjectRoutes] GET /api/projects/${req.params.id}/logs`);
    
    try {
      const { id } = req.params;
      const { lines } = req.query;
      
      const logs = await projectManager.getProjectLogs(id, lines ? parseInt(lines) : 100);
      
      res.json({
        success: true,
        logs
      });
      
    } catch (error) {
      console.error('[ProjectRoutes] ❌ Failed to get project logs:', error.message);
      
      res.status(500).json({
        error: 'PROJECT_LOGS_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * POST /api/projects/cleanup-orphans
   * Clean up Docker containers that don't have corresponding database entries
   * DEPRECATED: Use /api/projects/sync instead (uses DockerSyncService)
   */
  router.post('/cleanup-orphans', async (req, res) => {
    console.log('[ProjectRoutes] POST /api/projects/cleanup-orphans (DEPRECATED)');
    console.log('[ProjectRoutes] ⚠️  This endpoint is deprecated. Use /api/projects/sync instead');
    
    // Redirect to sync endpoint if available
    if (dockerSyncService) {
      try {
        const result = await dockerSyncService.syncNow();
        
        return res.json({
          success: true,
          message: 'Synchronization completed (via DockerSyncService)',
          deprecated: true,
          useInstead: '/api/projects/sync',
          result
        });
      } catch (error) {
        return res.status(500).json({
          error: 'SYNC_FAILED',
          message: error.message,
          deprecated: true,
          useInstead: '/api/projects/sync'
        });
      }
    }
    
    // Fallback to old implementation if sync service not available
    try {
      if (!projectManager.docker) {
        return res.status(400).json({
          error: 'DOCKER_NOT_AVAILABLE',
          message: 'Docker is not available'
        });
      }
      
      // Get all kali-project containers
      const containers = await projectManager.docker.listContainers({ 
        all: true,
        filters: { name: ['kali-project'] }
      });
      
      console.log(`[ProjectRoutes] Found ${containers.length} kali-project containers`);
      
      // Get all projects from database
      const { data: projects, error } = await projectManager.supabase
        .from('projects')
        .select('id, name, container_id');
      
      if (error) {
        throw new Error(`Failed to fetch projects: ${error.message}`);
      }
      
      console.log(`[ProjectRoutes] Found ${projects.length} projects in database`);
      
      // Create set of valid container IDs
      const validContainerIds = new Set(
        projects.map(p => p.container_id).filter(Boolean)
      );
      
      // Find orphaned containers
      const orphanedContainers = containers.filter(c => 
        !validContainerIds.has(c.Id)
      );
      
      console.log(`[ProjectRoutes] Found ${orphanedContainers.length} orphaned containers`);
      
      const results = [];
      
      // Clean up each orphaned container
      for (const containerInfo of orphanedContainers) {
        const container = projectManager.docker.getContainer(containerInfo.Id);
        const name = containerInfo.Names[0];
        
        try {
          // Stop if running
          if (containerInfo.State === 'running') {
            await container.kill();
          }
          
          // Remove with volumes
          await container.remove({ v: true, force: true });
          
          results.push({
            name,
            id: containerInfo.Id.substring(0, 12),
            status: 'removed'
          });
          
          console.log(`[ProjectRoutes] ✅ Removed orphaned container: ${name}`);
        } catch (err) {
          results.push({
            name,
            id: containerInfo.Id.substring(0, 12),
            status: 'failed',
            error: err.message
          });
          
          console.error(`[ProjectRoutes] ❌ Failed to remove ${name}:`, err.message);
        }
      }
      
      // Prune volumes
      try {
        const pruneResult = await projectManager.docker.pruneVolumes();
        const volumesDeleted = pruneResult.VolumesDeleted?.length || 0;
        console.log(`[ProjectRoutes] Pruned ${volumesDeleted} dangling volumes`);
      } catch (pruneError) {
        console.warn(`[ProjectRoutes] Volume prune warning:`, pruneError.message);
      }
      
      res.json({
        success: true,
        message: `Cleaned up ${results.filter(r => r.status === 'removed').length} orphaned containers`,
        deprecated: true,
        useInstead: '/api/projects/sync',
        results
      });
      
    } catch (error) {
      console.error('[ProjectRoutes] ❌ Failed to cleanup orphans:', error.message);
      
      res.status(500).json({
        error: 'CLEANUP_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * POST /api/projects/sync
   * Synchronize Docker containers with Supabase database
   * Removes orphaned containers and dangling volumes
   */
  router.post('/sync', async (req, res) => {
    console.log('[ProjectRoutes] POST /api/projects/sync');
    
    if (!dockerSyncService) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Docker sync service is not available'
      });
    }
    
    try {
      const result = await dockerSyncService.syncNow();
      
      res.json({
        success: true,
        message: 'Docker-Supabase synchronization completed',
        result
      });
      
    } catch (error) {
      console.error('[ProjectRoutes] ❌ Sync failed:', error.message);
      
      res.status(500).json({
        error: 'SYNC_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * GET /api/projects/sync/status
   * Get sync service status
   */
  router.get('/sync/status', (req, res) => {
    console.log('[ProjectRoutes] GET /api/projects/sync/status');
    
    if (!dockerSyncService) {
      return res.json({
        available: false,
        message: 'Docker sync service is not available'
      });
    }
    
    res.json({
      available: true,
      autoSync: dockerSyncService.autoSync,
      syncInterval: dockerSyncService.syncInterval,
      dockerAvailable: dockerSyncService.dockerAvailable,
      running: dockerSyncService.syncTimer !== null
    });
  });
  
  /**
   * POST /api/projects/:id/validate
   * Validate a specific project's container association
   */
  router.post('/:id/validate', async (req, res) => {
    console.log(`[ProjectRoutes] POST /api/projects/${req.params.id}/validate`);
    
    if (!dockerSyncService) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Docker sync service is not available'
      });
    }
    
    try {
      const { id } = req.params;
      const validation = await dockerSyncService.validateProject(id);
      
      res.json({
        success: true,
        validation
      });
      
    } catch (error) {
      console.error('[ProjectRoutes] ❌ Validation failed:', error.message);
      
      res.status(500).json({
        error: 'VALIDATION_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * POST /api/docker/cleanup
   * Manual Docker cleanup - prune unused images, containers, and build cache
   */
  router.post('/docker/cleanup', async (req, res) => {
    console.log('[ProjectRoutes] POST /api/docker/cleanup');
    
    try {
      const docker = projectManager.docker;
      
      if (!docker) {
        return res.status(503).json({
          error: 'DOCKER_UNAVAILABLE',
          message: 'Docker is not available'
        });
      }
      
      const results = {
        containers: { deleted: 0, spaceReclaimed: 0 },
        images: { deleted: 0, spaceReclaimed: 0 },
        volumes: { deleted: 0, spaceReclaimed: 0 },
        buildCache: { spaceReclaimed: 0 }
      };
      
      // Prune stopped containers
      try {
        console.log('[ProjectRoutes] Pruning stopped containers...');
        const containerPrune = await docker.pruneContainers();
        results.containers.deleted = containerPrune.ContainersDeleted?.length || 0;
        results.containers.spaceReclaimed = containerPrune.SpaceReclaimed || 0;
        console.log(`[ProjectRoutes] ✅ Pruned ${results.containers.deleted} containers`);
      } catch (error) {
        console.warn('[ProjectRoutes] Container prune warning:', error.message);
      }
      
      // Prune dangling images
      try {
        console.log('[ProjectRoutes] Pruning dangling images...');
        const imagePrune = await docker.pruneImages({ filters: { dangling: ['true'] } });
        results.images.deleted = imagePrune.ImagesDeleted?.length || 0;
        results.images.spaceReclaimed = imagePrune.SpaceReclaimed || 0;
        console.log(`[ProjectRoutes] ✅ Pruned ${results.images.deleted} images`);
      } catch (error) {
        console.warn('[ProjectRoutes] Image prune warning:', error.message);
      }
      
      // Prune unused volumes
      try {
        console.log('[ProjectRoutes] Pruning unused volumes...');
        const volumePrune = await docker.pruneVolumes();
        results.volumes.deleted = volumePrune.VolumesDeleted?.length || 0;
        results.volumes.spaceReclaimed = volumePrune.SpaceReclaimed || 0;
        console.log(`[ProjectRoutes] ✅ Pruned ${results.volumes.deleted} volumes`);
      } catch (error) {
        console.warn('[ProjectRoutes] Volume prune warning:', error.message);
      }
      
      // Prune build cache
      try {
        console.log('[ProjectRoutes] Pruning build cache...');
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        const { stdout } = await execAsync('docker builder prune -f');
        const match = stdout.match(/Total.*?(\d+\.?\d*)\s*([KMGT]?B)/i);
        if (match) {
          let size = parseFloat(match[1]);
          const unit = match[2].toUpperCase();
          if (unit.includes('K')) size *= 1024;
          else if (unit.includes('M')) size *= 1024 * 1024;
          else if (unit.includes('G')) size *= 1024 * 1024 * 1024;
          results.buildCache.spaceReclaimed = size;
        }
        console.log('[ProjectRoutes] ✅ Pruned build cache');
      } catch (error) {
        console.warn('[ProjectRoutes] Build cache prune warning:', error.message);
      }
      
      const totalSpaceReclaimed = 
        results.containers.spaceReclaimed +
        results.images.spaceReclaimed +
        results.volumes.spaceReclaimed +
        results.buildCache.spaceReclaimed;
      
      console.log(`[ProjectRoutes] ✅ Cleanup complete: ${(totalSpaceReclaimed / 1024 / 1024).toFixed(2)}MB reclaimed`);
      
      res.json({
        success: true,
        results,
        totalSpaceReclaimed,
        totalSpaceReclaimedMB: (totalSpaceReclaimed / 1024 / 1024).toFixed(2)
      });
      
    } catch (error) {
      console.error('[ProjectRoutes] ❌ Cleanup failed:', error.message);
      
      res.status(500).json({
        error: 'CLEANUP_FAILED',
        message: error.message
      });
    }
  });
  
  /**
   * POST /api/projects/create-with-progress
   * Create a new project with real-time progress updates via SSE
   */
  router.post('/create-with-progress', async (req, res) => {
    const startTime = Date.now();
    console.log('[ProjectRoutes] POST /api/projects/create-with-progress');
    
    try {
      const { name, userId, os } = req.body;
      
      // Validation
      if (!name || typeof name !== 'string') {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Project name is required and must be a string'
        });
      }
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'User ID is required'
        });
      }
      
      // Validate name length
      if (name.length < 1 || name.length > 255) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Project name must be between 1 and 255 characters'
        });
      }
      
      // Default to windows-11 if no OS specified
      const operatingSystem = os || 'windows-11';
      
      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      
      const sendProgress = (step, message, progress) => {
        const data = JSON.stringify({ step, message, progress, status: 'creating' });
        res.write(`data: ${data}\n\n`);
      };
      
      console.log(`[ProjectRoutes] Creating project "${name}" for user ${userId} with OS: ${operatingSystem}`);
      
      try {
        // Create project with progress callback
        const project = await projectManager.createProjectWithProgress(
          userId,
          name,
          null,
          operatingSystem,
          sendProgress
        );
        
        const duration = Date.now() - startTime;
        console.log(`[ProjectRoutes] ✅ Project created in ${duration}ms`);
        
        // Send completion
        const completeData = JSON.stringify({
          step: 'complete',
          message: 'Project created successfully!',
          progress: 100,
          status: 'complete',
          project
        });
        res.write(`data: ${completeData}\n\n`);
        res.end();
        
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[ProjectRoutes] ❌ Failed to create project after ${duration}ms:`, error.message);
        
        // Send error
        const errorData = JSON.stringify({
          step: 'error',
          message: error.message,
          progress: 0,
          status: 'error',
          error: error.message
        });
        res.write(`data: ${errorData}\n\n`);
        res.end();
      }
      
    } catch (error) {
      console.error(`[ProjectRoutes] ❌ SSE setup failed:`, error.message);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'PROJECT_CREATION_FAILED',
          message: error.message
        });
      }
    }
  });
  
  return router;
}

module.exports = { setupProjectRoutes };
