/**
 * Docker Cleanup Service
 * 
 * Automatically cleans up orphaned Docker containers and database records
 * Runs on server startup and periodically during operation
 */

const { execSync } = require('child_process');

class DockerCleanupService {
  constructor(supabaseClient, options = {}) {
    this.supabase = supabaseClient;
    this.options = {
      cleanupInterval: options.cleanupInterval || 6 * 60 * 60 * 1000, // 6 hours
      autoCleanup: options.autoCleanup !== false, // Enabled by default
      containerPrefix: options.containerPrefix || 'kali-project-',
      ...options
    };
    
    this.cleanupTimer = null;
    this.isRunning = false;
    
    console.log('[DockerCleanup] Service initialized');
    console.log(`   Auto cleanup: ${this.options.autoCleanup ? 'enabled' : 'disabled'}`);
    console.log(`   Cleanup interval: ${this.options.cleanupInterval / 1000 / 60} minutes`);
  }

  /**
   * Start the cleanup service
   */
  start() {
    if (!this.options.autoCleanup) {
      console.log('[DockerCleanup] Auto cleanup is disabled');
      return;
    }

    console.log('[DockerCleanup] Starting cleanup service...');
    
    // Run initial cleanup after a short delay
    setTimeout(() => {
      this.runCleanup().catch(error => {
        console.error('[DockerCleanup] Initial cleanup failed:', error.message);
      });
    }, 5000); // Wait 5 seconds after server start

    // Schedule periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.runCleanup().catch(error => {
        console.error('[DockerCleanup] Periodic cleanup failed:', error.message);
      });
    }, this.options.cleanupInterval);

    console.log('[DockerCleanup] ✅ Service started');
  }

  /**
   * Stop the cleanup service
   */
  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('[DockerCleanup] Service stopped');
    }
  }

  /**
   * Get all Docker containers with project prefix
   */
  getDockerContainers() {
    try {
      const output = execSync('docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}"', {
        encoding: 'utf-8'
      });
      
      const containers = output
        .trim()
        .split('\n')
        .filter(line => line)
        .map(line => {
          const [id, name, status] = line.split('|');
          return { id, name, status };
        })
        .filter(c => c.name.startsWith(this.options.containerPrefix));
      
      return containers;
    } catch (error) {
      console.error('[DockerCleanup] Failed to get Docker containers:', error.message);
      return [];
    }
  }

  /**
   * Get all projects from database
   */
  async getDatabaseProjects() {
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .select('id, name, container_id, owner_id');
      
      if (error) {
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('[DockerCleanup] Failed to get database projects:', error.message);
      return [];
    }
  }

  /**
   * Stop and remove a Docker container
   */
  removeContainer(containerId, containerName) {
    try {
      // Stop container if running
      try {
        execSync(`docker stop ${containerId}`, { stdio: 'ignore' });
      } catch (e) {
        // Container might already be stopped
      }
      
      // Remove container
      execSync(`docker rm ${containerId}`, { stdio: 'ignore' });
      
      console.log(`[DockerCleanup] ✓ Removed container: ${containerName}`);
      
      // Extract project ID from container name (format: kali-project-{projectId-first-8-chars})
      // Try to find and remove associated volumes
      try {
        // Get all volumes
        const volumesOutput = execSync('docker volume ls --format "{{.Name}}"', { encoding: 'utf-8' });
        const allVolumes = volumesOutput.trim().split('\n').filter(v => v);
        
        // Find volumes that might be associated with this container
        // Look for volumes containing parts of the container name or project ID patterns
        const containerParts = containerName.split('-');
        const projectIdPart = containerParts[containerParts.length - 1]; // Last part might be project ID prefix
        
        const relatedVolumes = allVolumes.filter(vol => {
          // Match volumes that contain the project ID part
          return vol.includes(projectIdPart) || 
                 // Or match common project volume patterns
                 (vol.includes('-workspace') || vol.includes('-home'));
        });
        
        if (relatedVolumes.length > 0) {
          console.log(`[DockerCleanup] Found ${relatedVolumes.length} volumes to remove for ${containerName}`);
          for (const volume of relatedVolumes) {
            try {
              execSync(`docker volume rm ${volume}`, { stdio: 'ignore' });
              console.log(`[DockerCleanup] ✓ Removed volume: ${volume}`);
            } catch (volError) {
              // Volume might be in use or already removed
            }
          }
        }
        
        // Also run volume prune to catch any dangling volumes
        try {
          execSync('docker volume prune -f', { stdio: 'ignore' });
        } catch (pruneError) {
          // Prune might fail, that's okay
        }
      } catch (volumeError) {
        console.warn(`[DockerCleanup] Volume cleanup warning:`, volumeError.message);
      }
      
      return true;
    } catch (error) {
      console.error(`[DockerCleanup] Failed to remove container ${containerName}:`, error.message);
      return false;
    }
  }

  /**
   * Clean up orphaned database records (new method using project list)
   */
  async cleanupOrphanedProjectsList(orphanedProjects) {
    try {
      if (orphanedProjects.length === 0) {
        return 0;
      }
      
      console.log(`[DockerCleanup] Found ${orphanedProjects.length} orphaned projects`);
      
      for (const project of orphanedProjects) {
        console.log(`[DockerCleanup] Cleaning up project: ${project.name}`);
        
        // Delete related records (cascade)
        
        // 1. Delete sessions
        await this.supabase
          .from('sessions')
          .delete()
          .eq('project_id', project.id);
        
        // 2. Delete collaborator access
        const { data: collaborations } = await this.supabase
          .from('collaborations')
          .select('id')
          .eq('project_id', project.id);
        
        if (collaborations && collaborations.length > 0) {
          for (const collab of collaborations) {
            await this.supabase
              .from('collaborator_access')
              .delete()
              .eq('collaboration_id', collab.id);
          }
        }
        
        // 3. Delete collaborations
        await this.supabase
          .from('collaborations')
          .delete()
          .eq('project_id', project.id);
        
        // 4. Delete the project
        await this.supabase
          .from('projects')
          .delete()
          .eq('id', project.id);
        
        console.log(`[DockerCleanup] ✓ Cleaned up project: ${project.name}`);
      }
      
      return orphanedProjects.length;
    } catch (error) {
      console.error('[DockerCleanup] Failed to cleanup orphaned projects:', error.message);
      return 0;
    }
  }

  /**
   * Clean up orphaned database records (legacy method - kept for compatibility)
   */
  async cleanupOrphanedProjects(validContainerIds) {
    try {
      const { data: allProjects } = await this.supabase
        .from('projects')
        .select('id, name, container_id');
      
      const orphanedProjects = allProjects.filter(
        project => project.container_id && !validContainerIds.includes(project.container_id)
      );
      
      if (orphanedProjects.length === 0) {
        return 0;
      }
      
      console.log(`[DockerCleanup] Found ${orphanedProjects.length} orphaned projects`);
      
      for (const project of orphanedProjects) {
        console.log(`[DockerCleanup] Cleaning up project: ${project.name}`);
        
        // Delete related records (cascade)
        
        // 1. Delete sessions
        await this.supabase
          .from('sessions')
          .delete()
          .eq('project_id', project.id);
        
        // 2. Delete collaborator access
        const { data: collaborations } = await this.supabase
          .from('collaborations')
          .select('id')
          .eq('project_id', project.id);
        
        if (collaborations && collaborations.length > 0) {
          for (const collab of collaborations) {
            await this.supabase
              .from('collaborator_access')
              .delete()
              .eq('collaboration_id', collab.id);
          }
        }
        
        // 3. Delete collaborations
        await this.supabase
          .from('collaborations')
          .delete()
          .eq('project_id', project.id);
        
        // 4. Delete the project
        await this.supabase
          .from('projects')
          .delete()
          .eq('id', project.id);
        
        console.log(`[DockerCleanup] ✓ Cleaned up project: ${project.name}`);
      }
      
      return orphanedProjects.length;
    } catch (error) {
      console.error('[DockerCleanup] Failed to cleanup orphaned projects:', error.message);
      return 0;
    }
  }

  /**
   * Clean up dangling Docker images
   */
  cleanupDanglingImages() {
    try {
      const output = execSync('docker images -f "dangling=true" -q', {
        encoding: 'utf-8'
      });
      
      const imageIds = output.trim().split('\n').filter(id => id);
      
      if (imageIds.length === 0) {
        return 0;
      }
      
      let removed = 0;
      imageIds.forEach(imageId => {
        try {
          execSync(`docker rmi ${imageId}`, { stdio: 'ignore' });
          removed++;
        } catch (e) {
          // Image might be in use
        }
      });
      
      if (removed > 0) {
        console.log(`[DockerCleanup] ✓ Removed ${removed} dangling images`);
      }
      
      return removed;
    } catch (error) {
      console.error('[DockerCleanup] Failed to cleanup dangling images:', error.message);
      return 0;
    }
  }

  /**
   * Run the cleanup process
   */
  async runCleanup() {
    if (this.isRunning) {
      console.log('[DockerCleanup] Cleanup already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('\n[DockerCleanup] ========== Starting Cleanup ==========');
      
      // Get current state
      const dockerContainers = this.getDockerContainers();
      const dbProjects = await this.getDatabaseProjects();
      
      // Create lookup sets
      // NOTE: Docker ps returns short IDs (12 chars), but DB stores full IDs (64 chars)
      // We need to match by checking if the DB ID starts with the Docker short ID
      const dbContainerIds = new Set(dbProjects.map(p => p.container_id).filter(Boolean));
      const dockerContainerIds = new Set(dockerContainers.map(c => c.id));
      
      // Helper function to check if a container ID matches (handles short vs full IDs)
      const containerIdMatches = (shortId, fullId) => {
        if (!shortId || !fullId) return false;
        return fullId.startsWith(shortId) || shortId.startsWith(fullId);
      };
      
      // Find containers to remove (in Docker but not in DB)
      const containersToRemove = dockerContainers.filter(container => {
        // Check if any DB container ID starts with this Docker short ID
        return !Array.from(dbContainerIds).some(dbId => containerIdMatches(container.id, dbId));
      });
      
      // Find orphaned database records
      const orphanedProjects = dbProjects.filter(project => {
        if (!project.container_id) return false;
        // Check if any Docker container ID matches this DB container ID
        return !dockerContainers.some(dc => containerIdMatches(dc.id, project.container_id));
      });
      const orphanedCount = orphanedProjects.length;
      
      console.log(`[DockerCleanup] Analysis:`);
      console.log(`   - ${dockerContainers.length} project containers in Docker`);
      console.log(`   - ${dbProjects.length} projects in database`);
      console.log(`   - ${containersToRemove.length} containers to remove`);
      console.log(`   - ${orphanedCount} orphaned database records`);
      
      // Perform cleanup
      let removedContainers = 0;
      for (const container of containersToRemove) {
        if (this.removeContainer(container.id, container.name)) {
          removedContainers++;
        }
      }
      
      // Clean up orphaned database records
      // Pass the actual orphaned projects instead of trying to match IDs again
      const cleanedProjects = await this.cleanupOrphanedProjectsList(orphanedProjects);
      
      // Clean up dangling images
      const removedImages = this.cleanupDanglingImages();
      
      // Final cleanup: Remove all dangling volumes
      let removedVolumes = 0;
      try {
        const pruneOutput = execSync('docker volume prune -f --filter "dangling=true"', { encoding: 'utf-8' });
        // Try to extract number of volumes from output
        const match = pruneOutput.match(/Total reclaimed space: (.+)/);
        if (match) {
          console.log(`[DockerCleanup] ✓ Pruned dangling volumes: ${match[1]}`);
        }
        
        // Count remaining volumes to report
        try {
          const volumesOutput = execSync('docker volume ls --filter "dangling=true" --format "{{.Name}}"', { encoding: 'utf-8' });
          const danglingVolumes = volumesOutput.trim().split('\n').filter(v => v && v.length > 0);
          removedVolumes = danglingVolumes.length;
        } catch (e) {
          // Ignore count errors
        }
      } catch (volumeError) {
        console.warn(`[DockerCleanup] Volume prune warning:`, volumeError.message);
      }
      
      const duration = Date.now() - startTime;
      
      console.log(`[DockerCleanup] ========== Cleanup Complete ==========`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Removed ${removedContainers} containers`);
      console.log(`   Cleaned ${cleanedProjects} database records`);
      console.log(`   Removed ${removedImages} dangling images`);
      console.log(`   Pruned dangling volumes`);
      console.log(`========================================\n`);
      
      return {
        success: true,
        duration,
        removedContainers,
        cleanedProjects,
        removedImages
      };
      
    } catch (error) {
      console.error('[DockerCleanup] Cleanup failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get cleanup status
   */
  getStatus() {
    return {
      enabled: this.options.autoCleanup,
      running: this.isRunning,
      interval: this.options.cleanupInterval,
      nextCleanup: this.cleanupTimer ? 'scheduled' : 'not scheduled'
    };
  }
}

module.exports = DockerCleanupService;
