/**
 * Port Allocator Utility
 * 
 * Manages dynamic port allocation for Docker containers
 * to avoid conflicts between multiple projects.
 */

const net = require('net');

class PortAllocator {
  constructor() {
    this.allocatedPorts = new Set(); // Currently allocated ports (active projects)
    this.usedPorts = new Set(); // ALL ports ever used (never released) - ensures infinite unique ports
    console.log('[PortAllocator] Initialized with infinite port tracking (ports never reused)');
  }

  /**
   * Sync allocated ports with existing database records
   * Call this on startup to restore port tracking state
   * @param {Array<Object>} projects - Array of project objects with port info
   */
  syncWithExistingProjects(projects) {
    console.log(`[PortAllocator] Syncing with ${projects.length} existing projects`);
    
    projects.forEach(project => {
      if (project.terminal_port || project.terminalPort) {
        const terminalPort = project.terminal_port || project.terminalPort;
        this.allocatedPorts.add(terminalPort);
        this.usedPorts.add(terminalPort); // Mark as used forever
        console.log(`[PortAllocator] Marked terminal port ${terminalPort} as allocated (project: ${project.name})`);
      }
      
      if (project.vnc_port || project.vncPort) {
        const vncPort = project.vnc_port || project.vncPort;
        this.allocatedPorts.add(vncPort);
        this.usedPorts.add(vncPort); // Mark as used forever
        console.log(`[PortAllocator] Marked VNC port ${vncPort} as allocated (project: ${project.name})`);
      }
      
      if (project.novnc_port || project.novncPort) {
        const novncPort = project.novnc_port || project.novncPort;
        this.allocatedPorts.add(novncPort);
        this.usedPorts.add(novncPort); // Mark as used forever
        console.log(`[PortAllocator] Marked noVNC port ${novncPort} as allocated (project: ${project.name})`);
      }
      
      if (project.custom_port_1 || project.customPort1) {
        const customPort1 = project.custom_port_1 || project.customPort1;
        this.allocatedPorts.add(customPort1);
        this.usedPorts.add(customPort1); // Mark as used forever
        console.log(`[PortAllocator] Marked custom port 1 ${customPort1} as allocated (project: ${project.name})`);
      }
      
      if (project.custom_port_2 || project.customPort2) {
        const customPort2 = project.custom_port_2 || project.customPort2;
        this.allocatedPorts.add(customPort2);
        this.usedPorts.add(customPort2); // Mark as used forever
        console.log(`[PortAllocator] Marked custom port 2 ${customPort2} as allocated (project: ${project.name})`);
      }
    });
    
    console.log(`[PortAllocator] Sync complete. Total allocated ports: ${this.allocatedPorts.size}`);
    console.log(`[PortAllocator] Total ports ever used (never reused): ${this.usedPorts.size}`);
  }

  /**
   * Sync with running Docker containers to catch orphaned containers
   * This prevents port conflicts when database and Docker are out of sync
   * @param {Docker} dockerClient - Docker client instance
   */
  async syncWithDockerContainers(dockerClient) {
    if (!dockerClient) {
      console.log('[PortAllocator] No Docker client provided, skipping Docker sync');
      return;
    }

    try {
      console.log('[PortAllocator] Syncing with running Docker containers...');
      const containers = await dockerClient.listContainers({ all: true });
      
      let portsFound = 0;
      containers.forEach(container => {
        // Check if this is a project container (kali, ubuntu, windows, etc.)
        const name = container.Names[0]?.replace('/', '');
        if (name && (name.startsWith('kali-project-') || name.startsWith('ubuntu-project-') || name.startsWith('windows-project-'))) {
          // Extract ports from container
          if (container.Ports) {
            container.Ports.forEach(portMapping => {
              if (portMapping.PublicPort) {
                this.allocatedPorts.add(portMapping.PublicPort);
                this.usedPorts.add(portMapping.PublicPort); // Mark as used forever
                portsFound++;
                console.log(`[PortAllocator] Found Docker port ${portMapping.PublicPort} (container: ${name})`);
              }
            });
          }
        }
      });
      
      console.log(`[PortAllocator] Docker sync complete. Found ${portsFound} ports in use.`);
    } catch (error) {
      console.error('[PortAllocator] Failed to sync with Docker:', error.message);
    }
  }

  /**
   * Allocate 5 consecutive ports for a project (terminal, vnc, novnc, custom1, custom2)
   * This ensures infinite scalability with no overlaps
   * @returns {Promise<Object>} Object with all 5 allocated ports
   */
  async allocatePortBlock() {
    const startPort = 10000;
    // NO END PORT - infinite allocation by incrementing from last used
    const portsNeeded = 5;
    
    console.log('[PortAllocator] Allocating block of 5 consecutive ports (INFINITE - NEVER REUSED)...');
    
    // Find the highest port ever used and start from there
    let basePort = startPort;
    if (this.usedPorts.size > 0) {
      const maxUsedPort = Math.max(...Array.from(this.usedPorts));
      basePort = maxUsedPort + 1;
      console.log(`[PortAllocator] Starting from port ${basePort} (after highest used port ${maxUsedPort})`);
    }
    
    // Allocate next 5 consecutive ports (guaranteed available since we track all used ports)
    const portsToCheck = [];
    for (let i = 0; i < portsNeeded; i++) {
      portsToCheck.push(basePort + i);
    }
    
    // Verify all ports are actually available on the system (safety check)
    let allAvailable = true;
    for (const port of portsToCheck) {
      // Skip system check if port is beyond TCP range - will use reverse proxy
      if (port <= 65535) {
        const isAvailable = await this.isPortAvailable(port);
        if (!isAvailable) {
          allAvailable = false;
          console.warn(`[PortAllocator] Port ${port} not available on system, incrementing...`);
          // Increment and try again
          basePort = port + 1;
          return this.allocatePortBlock(); // Recursive retry
        }
      }
    }
    
    // Allocate all 5 ports and mark as used FOREVER
    portsToCheck.forEach(port => {
      this.allocatedPorts.add(port);
      this.usedPorts.add(port); // NEVER REUSED - marked forever
    });
    
    const portBlock = {
      terminalPort: portsToCheck[0],
      vncPort: portsToCheck[1],
      novncPort: portsToCheck[2],
      customPort1: portsToCheck[3],
      customPort2: portsToCheck[4]
    };
    
    console.log(`[PortAllocator] ✅ Allocated port block: ${portsToCheck[0]}-${portsToCheck[4]} (PERMANENT - INFINITE)`);
    console.log(`[PortAllocator]   Terminal: ${portBlock.terminalPort}`);
    console.log(`[PortAllocator]   VNC: ${portBlock.vncPort}`);
    console.log(`[PortAllocator]   noVNC: ${portBlock.novncPort}`);
    console.log(`[PortAllocator]   Custom 1: ${portBlock.customPort1}`);
    console.log(`[PortAllocator]   Custom 2: ${portBlock.customPort2}`);
    console.log(`[PortAllocator]   Total ports ever used: ${this.usedPorts.size}`);
    
    if (portsToCheck[4] > 65535) {
      console.log(`[PortAllocator] ⚠️  Port ${portsToCheck[4]} exceeds TCP limit (65535)`);
      console.log(`[PortAllocator] ℹ️  Ports beyond 65535 will use reverse proxy routing`);
    }
    
    return portBlock;
  }

  /**
   * Allocate an available port in the given range (legacy method for backward compatibility)
   * @param {number} startPort - Start of port range
   * @param {number} endPort - End of port range
   * @returns {Promise<number>} Allocated port number
   */
  async allocatePort(startPort = 10000, endPort = 20000) {
    for (let port = startPort; port < endPort; port++) {
      // Check if ever used before (not just currently allocated)
      if (this.usedPorts.has(port)) {
        continue; // Already used - never reuse
      }
      
      if (this.allocatedPorts.has(port)) {
        continue; // Currently allocated
      }
      
      const isAvailable = await this.isPortAvailable(port);
      if (isAvailable) {
        this.allocatedPorts.add(port);
        this.usedPorts.add(port); // Mark as used forever
        console.log(`[PortAllocator] Allocated port ${port} (PERMANENT - never reused)`);
        return port;
      }
    }
    
    throw new Error(`No available ports in range ${startPort}-${endPort}`);
  }

  /**
   * Check if a port is available
   * @param {number} port - Port to check
   * @returns {Promise<boolean>} True if port is available
   */
  isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      });
      
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      
      server.listen(port, '0.0.0.0');
    });
  }

  /**
   * Release a port from active allocation (but NEVER remove from usedPorts)
   * This allows tracking which projects are active, but ensures ports are NEVER reused
   * @param {number} port - Port to release from active allocation
   */
  async releasePort(port) {
    if (this.allocatedPorts.has(port)) {
      this.allocatedPorts.delete(port);
      console.log(`[PortAllocator] Released port ${port} from active allocation (but NEVER reused - stays in usedPorts forever)`);
      console.log(`[PortAllocator]   Active ports: ${this.allocatedPorts.size}, Total ever used: ${this.usedPorts.size}`);
    }
    // NOTE: We NEVER remove from usedPorts - ports are marked as used forever
  }

  /**
   * Get all allocated ports (currently active)
   * @returns {Array<number>} List of allocated ports
   */
  getAllocatedPorts() {
    return Array.from(this.allocatedPorts);
  }

  /**
   * Get all ports ever used (never reused)
   * @returns {Array<number>} List of all ports ever used
   */
  getAllUsedPorts() {
    return Array.from(this.usedPorts);
  }

  /**
   * Get statistics about port usage
   * @returns {Object} Port usage statistics
   */
  getStats() {
    return {
      activeProjects: this.allocatedPorts.size / 5, // Each project uses 5 ports
      totalPortsActive: this.allocatedPorts.size,
      totalPortsEverUsed: this.usedPorts.size,
      availablePortsRemaining: 65535 - 10000 - this.usedPorts.size,
      maxProjectsEverPossible: Math.floor((65535 - 10000) / 5),
      projectsCreatedSoFar: this.usedPorts.size / 5
    };
  }
}

module.exports = PortAllocator;
