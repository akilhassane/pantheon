/**
 * Docker-Supabase Synchronization Service
 * 
 * Ensures consistency between Docker containers and Supabase database:
 * 1. Removes containers not associated with database projects
 * 2. Cleans up dangling volumes for kali-projects
 * 3. Ensures data persistence until explicit frontend deletion
 * 4. Runs periodic synchronization checks
 */

const Docker = require('dockerode');

class DockerSyncService {
  constructor(supabaseClient, options = {}) {
    if (!supabaseClient) {
      throw new Error('DockerSyncService requires a Supabase client instance');
    }
    
    this.supabase = supabaseClient;
    
    try {
      this.docker = new Docker(options.dockerOptions || {});
      this.dockerAvailable = true;
    } catch (error) {
      console.warn('[DockerSync] Docker client initialization failed:', error.message);
      this.docker = null;
      this.dockerAvailable = false;
    }
    
    // Configuration
    this.syncInterval = options.syncInterval || 60000; // 1 minute default
    this.autoSync = options.autoSync !== false; // Enabled by default
    this.syncTimer = null;
    
    console.log('[DockerSync] Initialized with auto-sync:', this.autoSync);
  }

  /**
   * Start automatic synchronization
   */
  start() {
    if (!this.autoSync || this.syncTimer) {
      return;
    }
    
    console.log(`[DockerSync] Starting auto-sync (interval: ${this.syncInterval}ms)`);
    
    // Run initial sync
    this.syncNow().catch(error => {
      console.error('[DockerSync] Initial sync failed:', error.message);
    });
    
    // Schedule periodic syncs
    this.syncTimer = setInterval(() => {
      this.syncNow().catch(error => {
        console.error('[DockerSync] Periodic sync failed:', error.message);
      });
    }, this.syncInterval);
  }

  /**
   * Stop automatic synchronization
   */
  stop() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('[DockerSync] Auto-sync stopped');
    }
  }

  /**
   * Perform synchronization now
   * @returns {Promise<Object>} Sync results
   */
  async syncNow() {
    const startTime = Date.now();
    console.log('[DockerSync] ========================================');
    console.log('[DockerSync] Starting synchronization...');
    console.log('[DockerSync] ========================================');
    
    if (!this.dockerAvailable || !this.docker) {
      console.log('[DockerSync] Docker not available, skipping sync');
      return {
        success: false,
        message: 'Docker not available',
        orphanedContainers: [],
        danglingVolumes: []
      };
    }
    
    try {
      // Step 1: Get all kali-project containers
      const containers = await this.docker.listContainers({
        all: true,
        filters: { name: ['kali-project'] }
      });
      
      console.log(`[DockerSync] Found ${containers.length} kali-project containers`);
      
      // Step 2: Get all projects from database
      const { data: projects, error } = await this.supabase
        .from('projects')
        .select('id, name, container_id, container_name');
      
      if (error) {
        throw new Error(`Failed to fetch projects from database: ${error.message}`);
      }
      
      console.log(`[DockerSync] Found ${projects.length} projects in database`);
      
      // Step 3: Create set of valid container IDs
      const validContainerIds = new Set(
        projects.map(p => p.container_id).filter(Boolean)
      );
      
      console.log(`[DockerSync] Valid container IDs: ${Array.from(validContainerIds).map(id => id.substring(0, 12)).join(', ')}`);
      
      // Step 4: Find orphaned containers (exist in Docker but not in database)
      const orphanedContainers = containers.filter(c => 
        !validContainerIds.has(c.Id)
      );
      
      console.log(`[DockerSync] Found ${orphanedContainers.length} orphaned containers`);
      
      const removedContainers = [];
      const failedContainers = [];
      
      // Step 5: Remove orphaned containers
      for (const containerInfo of orphanedContainers) {
        const container = this.docker.getContainer(containerInfo.Id);
        const name = containerInfo.Names[0]?.replace(/^\//, '') || 'unknown';
        const shortId = containerInfo.Id.substring(0, 12);
        
        console.log(`[DockerSync] Processing orphaned container: ${name} (${shortId})`);
        
        try {
          // Stop if running
          if (containerInfo.State === 'running') {
            console.log(`[DockerSync]   Stopping running container...`);
            await container.kill();
          }
          
          // Remove with volumes
          console.log(`[DockerSync]   Removing container and volumes...`);
          await container.remove({ v: true, force: true });
          
          removedContainers.push({
            name,
            id: shortId,
            state: containerInfo.State
          });
          
          console.log(`[DockerSync]   ✅ Removed: ${name}`);
        } catch (err) {
          failedContainers.push({
            name,
            id: shortId,
            error: err.message
          });
          
          console.error(`[DockerSync]   ❌ Failed to remove ${name}:`, err.message);
        }
      }
      
      // Step 6: Clean up dangling volumes
      console.log('[DockerSync] Cleaning up dangling volumes...');
      let volumesDeleted = 0;
      let spaceReclaimed = 0;
      
      try {
        // List all volumes
        const volumeList = await this.docker.listVolumes();
        const allVolumes = volumeList.Volumes || [];
        
        console.log(`[DockerSync] Total volumes: ${allVolumes.length}`);
        
        // Find volumes associated with kali-projects
        const projectVolumePattern = /^[a-f0-9-]+-(?:workspace|home)$/;
        const projectVolumes = allVolumes.filter(v => 
          projectVolumePattern.test(v.Name)
        );
        
        console.log(`[DockerSync] Found ${projectVolumes.length} project-related volumes`);
        
        // Get valid project IDs from database
        const validProjectIds = new Set(projects.map(p => p.id));
        
        // Find orphaned volumes (volumes for projects that don't exist)
        const orphanedVolumes = projectVolumes.filter(v => {
          // Extract project ID from volume name (format: projectId-workspace or projectId-home)
          const projectId = v.Name.split('-').slice(0, -1).join('-');
          return !validProjectIds.has(projectId);
        });
        
        console.log(`[DockerSync] Found ${orphanedVolumes.length} orphaned project volumes`);
        
        // Remove orphaned volumes
        for (const vol of orphanedVolumes) {
          try {
            const volume = this.docker.getVolume(vol.Name);
            await volume.remove({ force: true });
            console.log(`[DockerSync]   ✅ Removed orphaned volume: ${vol.Name}`);
            volumesDeleted++;
          } catch (volError) {
            if (volError.statusCode === 404) {
              console.log(`[DockerSync]   Volume ${vol.Name} already removed`);
            } else {
              console.warn(`[DockerSync]   ⚠️  Failed to remove volume ${vol.Name}:`, volError.message);
            }
          }
        }
        
        // Prune all dangling volumes (not attached to any container)
        console.log('[DockerSync] Pruning dangling volumes...');
        const pruneResult = await this.docker.pruneVolumes();
        const prunedCount = pruneResult.VolumesDeleted?.length || 0;
        spaceReclaimed = pruneResult.SpaceReclaimed || 0;
        volumesDeleted += prunedCount;
        
        console.log(`[DockerSync] ✅ Pruned ${prunedCount} dangling volumes, reclaimed ${(spaceReclaimed / 1024 / 1024).toFixed(2)}MB`);
      } catch (pruneError) {
        console.warn(`[DockerSync] Volume cleanup warning:`, pruneError.message);
      }
      
      const duration = Date.now() - startTime;
      
      console.log('[DockerSync] ========================================');
      console.log('[DockerSync] SYNCHRONIZATION COMPLETE');
      console.log(`[DockerSync]   Duration: ${duration}ms`);
      console.log(`[DockerSync]   Orphaned containers removed: ${removedContainers.length}`);
      console.log(`[DockerSync]   Failed removals: ${failedContainers.length}`);
      console.log(`[DockerSync]   Volumes cleaned: ${volumesDeleted}`);
      console.log(`[DockerSync]   Space reclaimed: ${(spaceReclaimed / 1024 / 1024).toFixed(2)}MB`);
      console.log('[DockerSync] ========================================');
      
      return {
        success: true,
        duration,
        orphanedContainers: {
          removed: removedContainers,
          failed: failedContainers
        },
        volumes: {
          deleted: volumesDeleted,
          spaceReclaimed
        }
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[DockerSync] ========================================');
      console.error('[DockerSync] SYNCHRONIZATION FAILED');
      console.error(`[DockerSync]   Duration: ${duration}ms`);
      console.error(`[DockerSync]   Error: ${error.message}`);
      console.error('[DockerSync] ========================================');
      
      throw error;
    }
  }

  /**
   * Validate a specific project's container exists and is associated
   * @param {string} projectId - Project ID to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateProject(projectId) {
    console.log(`[DockerSync] Validating project ${projectId}...`);
    
    if (!this.dockerAvailable || !this.docker) {
      return {
        valid: false,
        reason: 'Docker not available'
      };
    }
    
    try {
      // Get project from database
      const { data: project, error } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (error || !project) {
        return {
          valid: false,
          reason: 'Project not found in database'
        };
      }
      
      // Check if container exists
      try {
        const container = this.docker.getContainer(project.container_id);
        const info = await container.inspect();
        
        return {
          valid: true,
          project,
          container: {
            id: info.Id,
            name: info.Name,
            state: info.State.Status,
            running: info.State.Running
          }
        };
      } catch (containerError) {
        if (containerError.statusCode === 404) {
          return {
            valid: false,
            reason: 'Container not found in Docker',
            project,
            shouldCleanup: true
          };
        }
        throw containerError;
      }
      
    } catch (error) {
      console.error(`[DockerSync] Validation error for project ${projectId}:`, error.message);
      return {
        valid: false,
        reason: error.message
      };
    }
  }

  /**
   * Clean up a specific project if its container is missing
   * @param {string} projectId - Project ID to clean up
   * @returns {Promise<boolean>} True if cleaned up
   */
  async cleanupOrphanedProject(projectId) {
    console.log(`[DockerSync] Checking if project ${projectId} needs cleanup...`);
    
    const validation = await this.validateProject(projectId);
    
    if (validation.valid) {
      console.log(`[DockerSync] Project ${projectId} is valid, no cleanup needed`);
      return false;
    }
    
    if (validation.shouldCleanup) {
      console.log(`[DockerSync] Project ${projectId} has no container, removing from database...`);
      
      try {
        const { error } = await this.supabase
          .from('projects')
          .delete()
          .eq('id', projectId);
        
        if (error) {
          throw new Error(`Failed to delete project: ${error.message}`);
        }
        
        console.log(`[DockerSync] ✅ Removed orphaned project ${projectId} from database`);
        return true;
      } catch (error) {
        console.error(`[DockerSync] ❌ Failed to cleanup project ${projectId}:`, error.message);
        throw error;
      }
    }
    
    return false;
  }
}

module.exports = DockerSyncService;
