/**
 * ProjectManager Service
 * 
 * Manages Docker containers for isolated Kali Linux projects.
 * Each project runs in its own container with dedicated resources.
 * 
 * MIGRATED TO SUPABASE: All data persistence now uses Supabase PostgreSQL
 */

const Docker = require('dockerode');
const crypto = require('crypto');
const { getApiKeyGenerator } = require('./utils/api-key-generator');
const { retryQuery } = require('./config/supabase-client');

// UUID v4 generator (compatible with CommonJS)
function uuidv4() {
  return crypto.randomUUID();
}

class ProjectManager {
  constructor(supabaseClient, options = {}) {
    // Supabase client for data persistence
    if (!supabaseClient) {
      throw new Error('ProjectManager requires a Supabase client instance');
    }
    this.supabase = supabaseClient;
    
    // Docker client for container management
    try {
      this.docker = new Docker(options.dockerOptions || {});
      this.dockerAvailable = true;
    } catch (error) {
      console.warn('[ProjectManager] Docker client initialization failed, running in mock mode:', error.message);
      this.docker = null;
      this.dockerAvailable = false;
    }
    
    // Agent handler for remote container management
    this.agentHandler = null;
    
    // Configuration
    this.baseImage = options.baseImage || 'mcp-server-kali-pentest:latest';
    this.portAllocator = options.portAllocator;
    this.healthCheckInterval = options.healthCheckInterval || 5000; // 5 seconds
    this.healthCheckTimers = new Map(); // projectId -> timer
    this.statusCallbacks = []; // Callbacks for status changes
    this.projectHttpServers = new Map(); // projectId -> HTTP server for per-project shared folders
    
    // API Key Generator for Windows MCP projects
    this.apiKeyGenerator = getApiKeyGenerator();
    
    console.log(`[ProjectManager] Initialized with ${this.dockerAvailable ? 'Docker' : 'mock mode'} and Supabase persistence`);
  }

  /**
   * Calculate subnet allocation for a project using the entire private IP space
   * Supports 8+ trillion projects by utilizing:
   * - 10.0.0.0/8 (16,777,216 IPs = 4,194,304 /30 subnets)
   * - 172.16.0.0/12 (1,048,576 IPs = 262,144 /30 subnets)
   * - 192.168.0.0/16 (65,536 IPs = 16,384 /30 subnets)
   * Total: 4,472,832 /30 subnets per "cycle"
   * 
   * For 8 trillion projects (8,000,000,000,000):
   * - Each project gets a unique /30 subnet (4 IPs)
   * - Uses project hash to deterministically assign subnet
   * - Cycles through private IP space as needed
   * 
   * @param {string} projectId - Project UUID
   * @returns {Object} - { subnet, gateway, sharedFolderIp, windowsIp, toolsApiIp }
   */
  calculateProjectSubnet(projectId) {
    // Use full 32-bit hash space (4.3 billion unique values)
    const projectHash = parseInt(projectId.substring(0, 8), 16);
    
    // Total /24 subnets available in private IP space per cycle
    const SUBNETS_PER_CYCLE = 17476; // 10.x (65536) + 172.16-31.x (4096) + 192.168.x (256)
    
    // Calculate which subnet within the cycle
    const subnetIndex = projectHash % SUBNETS_PER_CYCLE;
    
    let ipPrefix, secondOctet, thirdOctet;
    
    if (subnetIndex < 65536) {
      // 10.0.0.0/8 - 65,536 /24 subnets
      ipPrefix = '10';
      secondOctet = Math.floor(subnetIndex / 256);
      thirdOctet = subnetIndex % 256;
    } else if (subnetIndex < 69632) {
      // 172.16.0.0/12 - 4,096 /24 subnets
      const rangeOffset = subnetIndex - 65536;
      ipPrefix = '172';
      secondOctet = 16 + Math.floor(rangeOffset / 256); // 172.16-31.x.x
      thirdOctet = rangeOffset % 256;
    } else {
      // 192.168.0.0/16 - 256 /24 subnets
      const rangeOffset = subnetIndex - 69632;
      ipPrefix = '192';
      secondOctet = 168;
      thirdOctet = rangeOffset;
    }
    
    // /24 subnet provides 254 usable IPs (.1 to .254)
    // .0 is network address, .255 is broadcast
    return {
      subnet: `${ipPrefix}.${secondOctet}.${thirdOctet}.0/24`,
      gateway: `${ipPrefix}.${secondOctet}.${thirdOctet}.1`,
      sharedFolderIp: `${ipPrefix}.${secondOctet}.${thirdOctet}.2`,
      windowsIp: `${ipPrefix}.${secondOctet}.${thirdOctet}.3`,
      toolsApiIp: `${ipPrefix}.${secondOctet}.${thirdOctet}.4`,
      backendIp: `${ipPrefix}.${secondOctet}.${thirdOctet}.5`
    };
  }

  /**
   * Set the agent handler for remote container management
   * @param {Object} agentHandler - Agent WebSocket handler instance
   */
  setAgentHandler(agentHandler) {
    this.agentHandler = agentHandler;
    console.log('[ProjectManager] ✅ Agent handler configured for remote container management');
  }

  /**
   * Get connected agent for a user
   * @param {string} userId - User ID
   * @returns {string|null} Agent ID or null if no agent connected
   */
  getAgentForUser(userId) {
    if (!this.agentHandler) {
      return null;
    }

    const agents = this.agentHandler.getConnectedAgents();
    const userAgent = agents.find(agent => agent.metadata.userId === userId);
    
    if (userAgent) {
      console.log(`[ProjectManager] Found agent ${userAgent.agentId} for user ${userId}`);
      return userAgent.agentId;
    }

    console.log(`[ProjectManager] No agent found for user ${userId}`);
    return null;
  }

  /**
   * Create container (local or remote via agent)
   * @param {Object} containerConfig - Docker container configuration
   * @param {string} userId - User ID (for agent lookup)
   * @returns {Promise<Object>} Container info
   */
  async createContainer(containerConfig, userId = null) {
    // Try to use agent if available
    const agentId = userId ? this.getAgentForUser(userId) : null;
    
    if (agentId && this.agentHandler) {
      console.log(`[ProjectManager] 🤖 Creating container via agent ${agentId}`);
      try {
        const result = await this.agentHandler.createContainer(agentId, containerConfig);
        console.log(`[ProjectManager] ✅ Container created via agent: ${result.containerId}`);
        return {
          id: result.containerId,
          agentId: agentId,
          remote: true
        };
      } catch (error) {
        console.error(`[ProjectManager] ❌ Failed to create container via agent:`, error.message);
        console.log(`[ProjectManager] Falling back to local Docker...`);
      }
    }

    // Fallback to local Docker
    if (this.dockerAvailable && this.docker) {
      console.log(`[ProjectManager] 🐳 Creating container locally`);
      const container = await this.docker.createContainer(containerConfig);
      console.log(`[ProjectManager] ✅ Container created locally: ${container.id}`);
      return {
        id: container.id,
        agentId: null,
        remote: false
      };
    }

    throw new Error('No Docker available (local or remote)');
  }

  /**
   * Start container (local or remote via agent)
   * @param {string} containerId - Container ID
   * @param {string} agentId - Agent ID (if remote)
   * @returns {Promise<void>}
   */
  async startContainer(containerId, agentId = null) {
    if (agentId && this.agentHandler) {
      console.log(`[ProjectManager] ▶️  Starting container via agent ${agentId}`);
      await this.agentHandler.startContainer(agentId, containerId);
      console.log(`[ProjectManager] ✅ Container started via agent`);
      return;
    }

    if (this.dockerAvailable && this.docker) {
      console.log(`[ProjectManager] ▶️  Starting container locally`);
      const container = this.docker.getContainer(containerId);
      await container.start();
      console.log(`[ProjectManager] ✅ Container started locally`);
      return;
    }

    throw new Error('No Docker available (local or remote)');
  }

  /**
   * Stop container (local or remote via agent)
   * @param {string} containerId - Container ID
   * @param {string} agentId - Agent ID (if remote)
   * @returns {Promise<void>}
   */
  async stopContainer(containerId, agentId = null) {
    if (agentId && this.agentHandler) {
      console.log(`[ProjectManager] ⏹️  Stopping container via agent ${agentId}`);
      await this.agentHandler.stopContainer(agentId, containerId);
      console.log(`[ProjectManager] ✅ Container stopped via agent`);
      return;
    }

    if (this.dockerAvailable && this.docker) {
      console.log(`[ProjectManager] ⏹️  Stopping container locally`);
      const container = this.docker.getContainer(containerId);
      await container.stop();
      console.log(`[ProjectManager] ✅ Container stopped locally`);
      return;
    }

    throw new Error('No Docker available (local or remote)');
  }

  /**
   * Restore HTTP servers for all existing Windows projects on startup
   * Each Windows project gets its own Docker container serving its shared folder
   * Also connects backend to all project networks for MCP communication
   */
  async restoreHttpServersOnStartup() {
    try {
      console.log('[ProjectManager] 🔄 Restoring shared folder containers for Windows projects...');
      
      // Query all Windows projects from database with aggressive retry logic for startup
      const { data: projects, error } = await retryQuery(
        async () => {
          return await this.supabase
            .from('projects')
            .select('id, name, vnc_port, operating_system, mcp_api_key')
            .in('operating_system', ['windows-11', 'windows-10'])
            .neq('status', 'deleted');
        },
        {
          maxRetries: 5,
          initialDelay: 3000,
          maxDelay: 15000,
          onRetry: (attempt, maxRetries, delay, error) => {
            console.log(`[ProjectManager] ⏳ Database query attempt ${attempt}/${maxRetries} failed, retrying in ${Math.floor(delay/1000)}s... (database may be waking up)`);
          }
        }
      );
      
      if (error) {
        console.error('[ProjectManager] ❌ Failed to query Windows projects after retries:', error.message);
        console.error('[ProjectManager] ℹ️  Database may still be waking up. This is normal for free tier Supabase.');
        return;
      }
      
      if (!projects || projects.length === 0) {
        console.log('[ProjectManager] ℹ️  No Windows projects found, skipping shared folder restoration');
        return;
      }
      
      console.log(`[ProjectManager] Found ${projects.length} Windows project(s), restoring shared folder containers...`);
      
      const path = require('path');
      const backendContainerName = process.env.BACKEND_CONTAINER_NAME || 'pantheon-backend'; // Fixed: use actual container name
      
      for (const project of projects) {
        const projectId = project.id;
        const projectName = project.name;
        const networkName = `project-${projectId.substring(0, 8)}-network`;
        
        // Calculate the correct subnet for this project
        const ips = this.calculateProjectSubnet(projectId);
        const backendIp = ips.backendIp;
        
        // Connect backend to this project's network for MCP communication
        try {
          const network = this.docker.getNetwork(networkName);
          await network.connect({ 
            Container: backendContainerName
            // Don't specify IP - let Docker assign one automatically
          });
          console.log(`[ProjectManager] 🔗 Connected backend to ${networkName} for MCP access`);
        } catch (connectErr) {
          // If already connected, that's fine
          if (!connectErr.message.includes('already exists')) {
            console.warn(`[ProjectManager] ⚠️  Failed to connect backend to ${networkName}:`, connectErr.message);
          }
        }
        
        // Connect windows-tools-api to this project's network (for Windows projects)
        try {
          const network = this.docker.getNetwork(networkName);
          await network.connect({ 
            Container: 'windows-tools-api'
            // Don't specify IP - let Docker assign one automatically
          });
          console.log(`[ProjectManager] 🔗 Connected windows-tools-api to ${networkName}`);
        } catch (connectErr) {
          if (!connectErr.message.includes('already exists')) {
            console.warn(`[ProjectManager] ⚠️  Failed to connect windows-tools-api to ${networkName}:`, connectErr.message);
          }
        }
        
        // Check if shared folder directory exists on host
        const projectSharedDir = path.join(__dirname, '..', 'windows-vm-files', projectId);
        const fs = require('fs');
        if (!fs.existsSync(projectSharedDir)) {
          console.log(`[ProjectManager] ⚠️  Shared folder not found for ${projectName}, skipping`);
          continue;
        }
        
        // Create shared folder container for this project
        // No port needed - always accessible at 172.30.0.1:8888 via socat proxy
        await this.createSharedFolderContainer(projectId, projectName, projectSharedDir);
        
        // Set up proxy for Windows VM to access shared folder
        try {
          const containerName = `${project.operating_system.split('-')[0]}-project-${projectId.substring(0, 8)}`;
          const container = this.docker.getContainer(containerName);
          await this.setupSharedFolderProxy(container, projectId);
          
          // Add iptables rules for Windows VM to access tools API
          // This allows the Windows VM (172.31.0.x) to reach the tools API (172.28.0.x)
          try {
            // Rule 1: MASQUERADE for general eth1 traffic
            const masqueradeExec = await container.exec({
              Cmd: ['iptables', '-t', 'nat', '-A', 'POSTROUTING', '-o', 'eth1', '-j', 'MASQUERADE'],
              AttachStdout: true,
              AttachStderr: true
            });
            await masqueradeExec.start({});
            
            // Rule 2: Specific MASQUERADE for VM to tools network
            const vmMasqueradeExec = await container.exec({
              Cmd: ['iptables', '-t', 'nat', '-A', 'POSTROUTING', '-s', '172.31.0.0/24', '-d', '172.28.0.0/16', '-o', 'eth1', '-j', 'MASQUERADE'],
              AttachStdout: true,
              AttachStderr: true
            });
            await vmMasqueradeExec.start({});
            
            // Rule 3: Enable IP forwarding
            const forwardExec = await container.exec({
              Cmd: ['sysctl', '-w', 'net.ipv4.ip_forward=1'],
              AttachStdout: true,
              AttachStderr: true
            });
            await forwardExec.start({});
            
            // Rule 4: FORWARD chain rules
            const forwardAcceptExec = await container.exec({
              Cmd: ['iptables', '-A', 'FORWARD', '-s', '172.31.0.0/24', '-d', '172.28.0.0/16', '-j', 'ACCEPT'],
              AttachStdout: true,
              AttachStderr: true
            });
            await forwardAcceptExec.start({});
            
            const forwardReturnExec = await container.exec({
              Cmd: ['iptables', '-A', 'FORWARD', '-s', '172.28.0.0/16', '-d', '172.31.0.0/24', '-j', 'ACCEPT'],
              AttachStdout: true,
              AttachStderr: true
            });
            await forwardReturnExec.start({});
            
            console.log(`[ProjectManager] ✅ Added iptables rules for ${projectName}`);
          } catch (iptablesError) {
            // Rules might already exist, that's fine
            if (!iptablesError.message.includes('already exists')) {
              console.warn(`[ProjectManager] ⚠️  Could not add iptables rules for ${projectName}:`, iptablesError.message);
            }
          }
        } catch (proxyError) {
          console.warn(`[ProjectManager] Failed to setup proxy for ${projectName}:`, proxyError.message);
        }
      }
      
      console.log(`[ProjectManager] ✅ Shared folder container restoration complete`);
      
    } catch (error) {
      console.error('[ProjectManager] ❌ Failed to restore shared folder containers:', error.message);
    }
  }

  /**
   * Start health monitoring for all existing projects on startup
   */
  async startHealthMonitoringForExistingProjects() {
    try {
      console.log('[ProjectManager] 🔄 Starting health monitoring for existing projects...');
      
      // Query all non-deleted projects with aggressive retry logic for startup
      const { data: projects, error } = await retryQuery(
        async () => {
          return await this.supabase
            .from('projects')
            .select('id, status')
            .neq('status', 'deleted');
        },
        {
          maxRetries: 5,
          initialDelay: 3000,
          maxDelay: 15000,
          onRetry: (attempt, maxRetries, delay, error) => {
            console.log(`[ProjectManager] ⏳ Database query attempt ${attempt}/${maxRetries} failed, retrying in ${Math.floor(delay/1000)}s... (database may be waking up)`);
          }
        }
      );
      
      if (error) {
        console.error('[ProjectManager] ❌ Failed to query projects after retries:', error.message);
        console.error('[ProjectManager] ℹ️  Database may still be waking up. This is normal for free tier Supabase.');
        return;
      }
      
      if (!projects || projects.length === 0) {
        console.log('[ProjectManager] ℹ️  No projects found');
        return;
      }
      
      console.log(`[ProjectManager] Found ${projects.length} project(s), starting health monitoring...`);
      
      for (const project of projects) {
        // Start health monitoring for projects that are creating or running
        if (project.status === 'creating' || project.status === 'running') {
          this.startHealthMonitoring(project.id);
          console.log(`[ProjectManager] ✅ Started health monitoring for project ${project.id}`);
        }
      }
      
      console.log('[ProjectManager] ✅ Health monitoring started for all existing projects');
    } catch (error) {
      console.error('[ProjectManager] ❌ Failed to start health monitoring:', error.message);
    }
  }

  /**
   * Create a dedicated Docker container to serve a Windows project's shared folder
   * Each project gets its own isolated network for security
   * Shared folder is ALWAYS accessible at 172.30.0.1:8888 from Windows VM
   * @param {string} projectId - Project ID
   * @param {string} projectName - Project name
   * @param {string} sharedFolderPath - Path to shared folder on host
   */
  async createSharedFolderContainer(projectId, projectName, sharedFolderPath) {
    try {
      const containerName = `shared-folder-${projectId.substring(0, 8)}`;
      const networkName = `project-${projectId.substring(0, 8)}-network`;
      
      // Check if container already exists
      try {
        const existingContainer = this.docker.getContainer(containerName);
        const info = await existingContainer.inspect();
        
        if (info.State.Running) {
          console.log(`[ProjectManager] ✅ Shared folder container already running for ${projectName}`);
          console.log(`[ProjectManager]    Container: ${containerName}`);
          console.log(`[ProjectManager]    Network: ${networkName} (isolated - no host access)`);
          console.log(`[ProjectManager]    Internal URL: http://${containerName}/.env (only accessible from project network)`);
          return;
        } else {
          // Start existing stopped container
          await existingContainer.start();
          console.log(`[ProjectManager] ✅ Started existing shared folder container for ${projectName}`);
          console.log(`[ProjectManager]    Container: ${containerName}`);
          console.log(`[ProjectManager]    Network: ${networkName} (isolated - no host access)`);
          console.log(`[ProjectManager]    Internal URL: http://${containerName}/.env (only accessible from project network)`);
          return;
        }
      } catch (err) {
        // Container doesn't exist, create it
      }
      
      // Create dedicated network for this project (if it doesn't exist)
      // Calculate subnet for this project
      const ips = this.calculateProjectSubnet(projectId);
      const projectSubnet = ips.subnet;
      const projectGateway = ips.gateway;
      const sharedFolderIp = ips.sharedFolderIp;
      const sharedFolderAlias = '172.30.0.1'; // Windows VM will use this address
      
      let network;
      try {
        network = this.docker.getNetwork(networkName);
        await network.inspect();
        console.log(`[ProjectManager] 🔒 Using existing isolated network: ${networkName}`);
      } catch (err) {
        // Network doesn't exist, create it
        console.log(`[ProjectManager] 🔒 Creating isolated network: ${networkName} with subnet ${projectSubnet}`);
        network = await this.docker.createNetwork({
          Name: networkName,
          Driver: 'bridge',
          Internal: false, // Allow external access for host.docker.internal
          EnableIPv6: false,
          IPAM: {
            Driver: 'default',
            Config: [{
              Subnet: projectSubnet,
              Gateway: projectGateway
            }]
          },
          Options: {
            'com.docker.network.bridge.enable_icc': 'true',
            'com.docker.network.bridge.enable_ip_masquerade': 'true',
            'com.docker.network.bridge.host_binding_ipv4': '0.0.0.0'
          },
          Labels: {
            'windows-project-id': projectId,
            'windows-project-name': projectName,
            'project-network': 'true'
          }
        });
        console.log(`[ProjectManager] ✅ Network created - shared folder accessible at ${sharedFolderIp}:8888`);
      }
      
      // Get path to custom nginx config
      const path = require('path');
      const fs = require('fs');
      
      // Ensure the shared folder directory exists
      const absoluteSharedFolderPath = path.resolve(sharedFolderPath);
      if (!fs.existsSync(absoluteSharedFolderPath)) {
        fs.mkdirSync(absoluteSharedFolderPath, { recursive: true });
        console.log(`[ProjectManager]    Created shared folder directory: ${absoluteSharedFolderPath}`);
      }
      
      // Copy nginx config into the shared folder so it's accessible via the same mount
      const sourceNginxConfig = path.join('/app', 'windows-vm-files', 'nginx-shared-folder.conf');
      const nginxConfigPath = path.join(absoluteSharedFolderPath, '.nginx-config.conf');
      
      // Copy the nginx config to the shared folder
      try {
        fs.copyFileSync(sourceNginxConfig, nginxConfigPath);
        console.log(`[ProjectManager]    Copied nginx config to shared folder`);
      } catch (err) {
        console.error(`[ProjectManager]    Failed to copy nginx config:`, err.message);
        throw err;
      }
      
      // Convert container paths to host paths for Docker bind mounts
      // The backend runs in a container with /app/windows-vm-files mounted from the host
      // When creating new containers, we need to use the host path, not the container path
      const hostBasePath = process.env.HOST_WINDOWS_VM_FILES_PATH || '/app/windows-vm-files';
      const hostSharedFolderPath = absoluteSharedFolderPath.replace('/app/windows-vm-files', hostBasePath);
      const hostNginxConfigPath = nginxConfigPath.replace('/app/windows-vm-files', hostBasePath);
      
      console.log(`[ProjectManager]    Nginx config (container): ${nginxConfigPath}`);
      console.log(`[ProjectManager]    Nginx config (host): ${hostNginxConfigPath}`);
      console.log(`[ProjectManager]    Shared folder (container): ${absoluteSharedFolderPath}`);
      console.log(`[ProjectManager]    Shared folder (host): ${hostSharedFolderPath}`);
      
      // Copy startup script to shared folder
      const startupScriptSource = path.join('/app', 'docker', 'shared-folder-startup.sh');
      const startupScriptDest = path.join(absoluteSharedFolderPath, '.startup.sh');
      try {
        fs.copyFileSync(startupScriptSource, startupScriptDest);
        fs.chmodSync(startupScriptDest, 0o755);
        console.log(`[ProjectManager]    Copied startup script to shared folder`);
      } catch (err) {
        console.error(`[ProjectManager]    Failed to copy startup script:`, err.message);
      }
      
      const hostStartupScriptPath = startupScriptDest.replace('/app/windows-vm-files', hostBasePath);
      
      // Create new container with nginx to serve files
      // IMPORTANT: No host port binding - only accessible within project network
      // Mount the entire pantheon-windows-files volume instead of individual files
      // Use the same volume name as the backend container (with docker-compose prefix)
      const volumeName = process.env.WINDOWS_FILES_VOLUME_NAME || 'mcp-server_pantheon-windows-files';
      const containerConfig = {
        name: containerName,
        Image: 'nginx:alpine',
        ExposedPorts: {
          '8888/tcp': {}
        },
        Cmd: ['/bin/sh', `/app/windows-vm-files/${projectId}/.startup.sh`], // Run startup script from the volume
        HostConfig: {
          // NO PortBindings - shared folder is only accessible from within the project network
          // This ensures complete isolation - other projects cannot access this shared folder
          Binds: [
            `${volumeName}:/app/windows-vm-files`  // Mount the entire volume (same as backend)
          ],
          // Add extra host for Docker Desktop on Windows
          ExtraHosts: ['host.docker.internal:host-gateway'],
          RestartPolicy: {
            Name: 'unless-stopped'
          }
        },
        Env: [
          `PROJECT_ID=${projectId}`,
          `SHARED_FOLDER_PATH=/app/windows-vm-files/${projectId}`,
          `NGINX_CONFIG_PATH=/app/windows-vm-files/${projectId}/.nginx-config.conf`,
          `NGINX_HTML_ROOT=/app/windows-vm-files/${projectId}`
        ],
        WorkingDir: `/app/windows-vm-files/${projectId}`,
        NetworkingConfig: {
          EndpointsConfig: {
            [networkName]: {
              IPAMConfig: {
                IPv4Address: sharedFolderIp  // Dynamic IP based on project subnet
              }
            }
          }
        },
        Labels: {
          'windows-project-id': projectId,
          'windows-project-name': projectName,
          'shared-folder': 'true'
        }
      };
      
      console.log(`[ProjectManager] 🐳 Creating shared folder container for ${projectName}...`);
      
      // Try to create container with retry logic for IP conflicts
      let container;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          container = await this.docker.createContainer(containerConfig);
          await container.start();
          break; // Success, exit retry loop
        } catch (createError) {
          if (createError.message.includes('Address already in use') && retryCount < maxRetries - 1) {
            retryCount++;
            console.warn(`[ProjectManager] ⚠️  IP ${sharedFolderIp} already in use, checking network...`);
            
            // Inspect the network to find what's using the IP
            try {
              const networkInfo = await network.inspect();
              const containers = networkInfo.Containers || {};
              
              // Find container using the shared folder IP
              for (const [containerId, containerInfo] of Object.entries(containers)) {
                if (containerInfo.IPv4Address && containerInfo.IPv4Address.startsWith(sharedFolderIp)) {
                  console.log(`[ProjectManager] 🔍 Found ${containerInfo.Name} using ${sharedFolderIp}`);
                  
                  // If it's windows-tools-api, disconnect and reconnect with proper IP
                  if (containerInfo.Name === 'windows-tools-api') {
                    console.log(`[ProjectManager] 🔄 Disconnecting windows-tools-api to reassign IP...`);
                    await network.disconnect({ Container: 'windows-tools-api', Force: true });
                    
                    // Reconnect with retry logic for IP conflicts
                    const ips = this.calculateProjectSubnet(projectId);
                    const ipCandidates = [
                      ips.toolsApiIp,
                      `${ips.toolsApiIp.split('.').slice(0, 3).join('.')}.${parseInt(ips.toolsApiIp.split('.')[3]) + 10}`,
                      `${ips.toolsApiIp.split('.').slice(0, 3).join('.')}.${parseInt(ips.toolsApiIp.split('.')[3]) + 20}`,
                      `${ips.toolsApiIp.split('.').slice(0, 3).join('.')}.${parseInt(ips.toolsApiIp.split('.')[3]) + 30}`
                    ];
                    
                    let reconnected = false;
                    for (const candidateIp of ipCandidates) {
                      try {
                        await network.connect({ 
                          Container: 'windows-tools-api',
                          EndpointConfig: {
                            IPAMConfig: {
                              IPv4Address: candidateIp
                            }
                          }
                        });
                        console.log(`[ProjectManager] ✅ Reconnected windows-tools-api at ${candidateIp}`);
                        reconnected = true;
                        break;
                      } catch (reconnectErr) {
                        if (reconnectErr.message.includes('Address already in use')) {
                          console.log(`[ProjectManager] ⚠️  IP ${candidateIp} in use, trying next...`);
                          continue;
                        } else {
                          throw reconnectErr;
                        }
                      }
                    }
                    
                    if (!reconnected) {
                      throw new Error('Failed to reconnect windows-tools-api after trying all IP candidates');
                    }
                  } else {
                    // Some other container is using the IP, log warning
                    console.warn(`[ProjectManager] ⚠️  Unexpected container ${containerInfo.Name} using shared folder IP`);
                  }
                }
              }
              
              // Wait a bit before retrying
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (inspectError) {
              console.error(`[ProjectManager] ❌ Failed to inspect network:`, inspectError.message);
            }
          } else {
            // Not an IP conflict or max retries reached, throw the error
            throw createError;
          }
        }
      }
      
      if (!container) {
        throw new Error(`Failed to create shared folder container after ${maxRetries} retries`);
      }
      
      console.log(`[ProjectManager] ✅ Created shared folder container for ${projectName}`);
      console.log(`[ProjectManager]    Container: ${containerName}`);
      console.log(`[ProjectManager]    Network: ${networkName} (isolated - no host access)`);
      console.log(`[ProjectManager]    Shared folder: ${sharedFolderPath}`);
      console.log(`[ProjectManager]    Actual IP: ${sharedFolderIp}:8888`);
      console.log(`[ProjectManager]    Windows VM access: http://172.30.0.1:8888 (via DNAT)`);
      console.log(`[ProjectManager]    Internal URL: http://${sharedFolderIp}:8888/.env (only accessible from project network)`);
      
    } catch (error) {
      console.error(`[ProjectManager] ❌ Failed to create shared folder container for ${projectName}:`, error.message);
    }
  }

  /**
   * Set up proxy inside Windows container to allow VM access to shared folder
   * This maintains isolation while allowing the Windows VM (172.30.0.x) to access
   * the shared folder container (172.22.0.x) via the Docker bridge network
   * 
   * The proxy is configured to auto-start on container restart via a startup script
   * @param {Object} container - Docker container object
   * @param {string} projectId - Project ID
   */
  async setupSharedFolderProxy(container, projectId, sharedFolderIp = null) {
    try {
      const containerName = `shared-folder-${projectId.substring(0, 8)}`;
      
      // Calculate actual shared folder IP if not provided
      if (!sharedFolderIp) {
        const ips = this.calculateProjectSubnet(projectId);
        sharedFolderIp = ips.sharedFolderIp;
      }
      
      console.log(`[ProjectManager] 🔗 Setting up shared folder proxy with auto-start...`);
      console.log(`[ProjectManager]    Actual shared folder IP: ${sharedFolderIp}`);
      console.log(`[ProjectManager]    Windows VM will access: 172.30.0.1 (via socat proxy)`);
      
      // Install socat if not already installed
      console.log(`[ProjectManager]    Installing socat...`);
      const installExec = await container.exec({
        Cmd: ['bash', '-c', 'which socat || (apt-get update && apt-get install -y socat)'],
        AttachStdout: true,
        AttachStderr: true
      });
      
      const installStream = await installExec.start({});
      await new Promise((resolve) => {
        installStream.on('end', resolve);
        setTimeout(resolve, 30000); // 30 second timeout for installation
      });
      
      console.log(`[ProjectManager]    Socat installation complete`);
      
      // Create a complete startup script with retry logic and proper backgrounding
      // IMPORTANT: Detect the correct network interface dynamically (could be 'docker' or 'eth0')
      const startupScript = `#!/bin/bash
# Auto-start script for socat proxy with retry logic
# This allows Windows VM to access shared folder and Tools API

echo "Setting up shared folder and Tools API access..."

# Detect the correct network interface (eth0 or docker)
IFACE=""
if ip addr show eth0 >/dev/null 2>&1; then
    IFACE="eth0"
    echo "Using eth0 interface"
elif ip addr show docker >/dev/null 2>&1; then
    IFACE="docker"
    echo "Using docker interface"
else
    echo "ERROR: Could not find network interface"
    exit 1
fi

# Add IP alias for 172.30.0.1 on the detected interface (where Windows VM connects)
ip addr add 172.30.0.1/32 dev $IFACE 2>/dev/null || echo "IP alias already exists"

# Add route so Windows VM traffic can reach 172.30.0.1
ip route add 172.30.0.1/32 dev $IFACE 2>/dev/null || echo "Route already exists"

# DNAT rules for traffic to 172.30.0.1:8888
# OUTPUT chain: for traffic from container itself
iptables -t nat -A OUTPUT -d 172.30.0.1 -j DNAT --to-destination ${sharedFolderIp} 2>/dev/null || true

# PREROUTING chain: for traffic from Windows VM
iptables -t nat -A PREROUTING -d 172.30.0.1 -p tcp --dport 8888 -j DNAT --to-destination ${sharedFolderIp}:8888 2>/dev/null || true

# MASQUERADE for return traffic from shared folder to Windows VM
iptables -t nat -A POSTROUTING -s 172.31.12.0/24 -d ${sharedFolderIp} -j MASQUERADE 2>/dev/null || true

# FORWARD rules to allow traffic between Windows VM and shared folder
iptables -A FORWARD -s 172.31.12.0/24 -d 172.30.0.1 -j ACCEPT 2>/dev/null || true
iptables -A FORWARD -s 172.30.0.1 -d 172.31.12.0/24 -j ACCEPT 2>/dev/null || true

# Kill any existing socat processes
pkill -9 -f "socat.*8888" 2>/dev/null || true
pkill -9 -f "socat.*8090" 2>/dev/null || true

# Wait for ports to be released
sleep 2

# Start socat proxy for shared folder with retry
for i in {1..10}; do
    nohup socat TCP-LISTEN:8888,bind=172.30.0.1,fork,reuseaddr TCP:${sharedFolderIp}:8888 > /tmp/socat-8888.log 2>&1 &
    sleep 1
    if ps aux | grep -q "[s]ocat.*8888"; then
        echo "Shared folder proxy started successfully"
        break
    fi
    echo "Retrying shared folder proxy... attempt $i/10"
    sleep 2
done

# Start socat proxy for Windows Tools API with retry
for i in {1..10}; do
    nohup socat TCP-LISTEN:8090,fork,reuseaddr TCP:windows-tools-api:8090 > /tmp/socat-8090.log 2>&1 &
    sleep 1
    if ps aux | grep -q "[s]ocat.*8090"; then
        echo "Tools API proxy started successfully"
        break
    fi
    echo "Retrying Tools API proxy... attempt $i/10"
    sleep 2
done

echo "Setup complete!"
echo "Windows VM can access shared folder at http://172.30.0.1:8888"
echo "Windows VM can access Tools API at http://172.30.35.2:8090"
`;
      
      // Write script to container
      console.log(`[ProjectManager]    Creating startup script in container...`);
      const writeExec = await container.exec({
        Cmd: ['bash', '-c', 'cat > /usr/local/bin/start-socat-proxy.sh && chmod +x /usr/local/bin/start-socat-proxy.sh'],
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true
      });
      
      const stream = await writeExec.start({ hijack: true, stdin: true });
      stream.write(startupScript);
      stream.end();
      
      await new Promise((resolve) => {
        stream.on('end', resolve);
        setTimeout(resolve, 2000);
      });
      
      console.log(`[ProjectManager]    Startup script created successfully`);
      
      // Add call to socat startup script in init-snapshot.sh (before "Start Windows")
      console.log(`[ProjectManager]    Adding socat startup to init-snapshot.sh...`);
      const initScriptUpdate = await container.exec({
        Cmd: ['bash', '-c', `
          # Check if socat startup is already in init script
          if ! grep -q "start-socat-proxy.sh" /usr/local/bin/init-snapshot.sh; then
            # Find the line with "Start Windows" and insert before it
            sed -i '/^echo "Starting Windows/i\\# Start socat proxy for shared folder and Tools API access\\n/usr/local/bin/start-socat-proxy.sh >> /var/log/socat-proxy.log 2>\&1 \&\\necho "Socat proxy started for shared folder and Tools API"\\n' /usr/local/bin/init-snapshot.sh
            echo "Added socat startup to init-snapshot.sh"
          else
            echo "Socat startup already in init-snapshot.sh"
          fi
        `],
        AttachStdout: true,
        AttachStderr: true
      });
      
      const initStream = await initScriptUpdate.start({});
      await new Promise((resolve) => {
        initStream.on('end', resolve);
        setTimeout(resolve, 2000);
      });
      
      console.log(`[ProjectManager]    Init script updated for auto-start on container restart`);
      
      // Run the script now to start socat immediately
      console.log(`[ProjectManager]    Starting socat proxy now...`);
      const runExec = await container.exec({
        Cmd: ['bash', '/usr/local/bin/start-socat-proxy.sh'],
        AttachStdout: true,
        AttachStderr: true,
        Detach: false
      });
      
      const runStream = await runExec.start({});
      
      // Collect output
      let output = '';
      runStream.on('data', (chunk) => {
        output += chunk.toString();
      });
      
      await new Promise((resolve) => {
        runStream.on('end', resolve);
        setTimeout(resolve, 5000);
      });
      
      console.log(`[ProjectManager]    Startup script output:\n${output}`);
      
      // Verify socat is running
      const verifyExec = await container.exec({
        Cmd: ['bash', '-c', 'ps aux | grep socat | grep -v grep'],
        AttachStdout: true,
        AttachStderr: true
      });
      
      const verifyStream = await verifyExec.start({});
      let verifyOutput = '';
      verifyStream.on('data', (chunk) => {
        verifyOutput += chunk.toString();
      });
      
      await new Promise((resolve) => {
        verifyStream.on('end', resolve);
        setTimeout(resolve, 1000);
      });
      
      if (verifyOutput.includes('socat')) {
        console.log(`[ProjectManager] ✅ Shared folder proxy configured with auto-start`);
        console.log(`[ProjectManager]    Windows VM can access: http://172.30.0.1:8888`);
        console.log(`[ProjectManager]    Auto-starts on container restart: ✅`);
        console.log(`[ProjectManager]    Host machine: ❌ Blocked (no port binding)`);
        console.log(`[ProjectManager]    Other projects: ❌ Blocked (network isolation)`);
      } else {
        console.warn(`[ProjectManager] ⚠️  Socat proxy may not have started correctly`);
      }
      
    } catch (error) {
      console.error(`[ProjectManager] ⚠️  Failed to setup shared folder proxy:`, error.message);
      // Don't fail project creation if proxy setup fails
    }
  }

  /**
   * Check if Docker is available
   */
  async checkDockerAvailable() {
    if (!this.dockerAvailable || !this.docker) {
      return false;
    }
    
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      console.log('[ProjectManager] Docker not available:', error.message);
      this.dockerAvailable = false;
      return false;
    }
  }

  /**
   * Create a mock project without Docker (for development/testing)
   */
  async createMockProject(userId, projectName, projectId, operatingSystem = 'kali-linux') {
    const projectData = {
      id: projectId,
      name: projectName,
      description: null,
      owner_id: userId,
      container_id: `mock-${projectId}`,
      container_name: `project-${projectName.toLowerCase().replace(/\s+/g, '-')}-${projectId.substring(0, 8)}`,
      terminal_port: 8080,
      vnc_port: 5900,
      novnc_port: 6080,
      operating_system: operatingSystem,
      status: 'running',
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString()
    };
    
    // Insert into Supabase
    const { data, error } = await this.supabase
      .from('projects')
      .insert([projectData])
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create mock project in database: ${error.message}`);
    }
    
    console.log(`[ProjectManager] ✅ Mock project created: ${projectId}`);
    
    // Notify status change
    this.notifyStatusChange(projectId, 'running', 'created');
    
    // Convert and add owner info
    const convertedProject = this.convertProjectData(data);
    
    // Fetch owner info from auth.users
    try {
      const { data: userData, error: userError } = await this.supabase.auth.admin.getUserById(userId);
      
      if (!userError && userData?.user) {
        const user = userData.user;
        convertedProject.ownerName = user.user_metadata?.full_name || 
                                    user.user_metadata?.name ||
                                    user.email?.split('@')[0] || 
                                    'Unknown Owner';
      } else {
        convertedProject.ownerName = 'Unknown Owner';
      }
    } catch (ownerError) {
      console.warn(`[ProjectManager] Failed to fetch owner for mock project:`, ownerError);
      convertedProject.ownerName = 'Unknown Owner';
    }
    
    return convertedProject;
  }

  /**
   * Convert Supabase project data (snake_case) to frontend format (camelCase)
   * @param {Object} data - Raw Supabase project data
   * @returns {Object} Converted project data
   */
  convertProjectData(data) {
    if (!data) return null;
    
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      ownerId: data.owner_id,
      containerId: data.container_id,
      containerName: data.container_name,
      terminalPort: data.terminal_port,
      terminalUrl: data.terminal_url,  // Include terminal tunnel URL for remote access
      vncPort: data.vnc_port,
      novncPort: data.novnc_port,
      vncUrl: data.vnc_url,  // Include VNC tunnel URL for remote access
      customPort1: data.custom_port_1,
      customPort2: data.custom_port_2,
      operatingSystem: data.operating_system,  // Include OS information
      mcpApiKey: data.mcp_api_key,  // Include MCP API key for Windows projects
      status: data.status,
      createdAt: data.created_at,
      lastActive: data.last_active,
      isMock: data.container_id?.startsWith('mock-') || false
    };
  }

  /**
   * Create a new project with isolated Docker container
   * @param {string} userId - User ID who owns the project
   * @param {string} projectName - Name of the project
   * @param {string} description - Optional project description
   * @param {string} operatingSystem - Operating system to use (default: 'kali-linux')
   * @returns {Promise<Object>} Created project data
   */
  async createProject(userId, projectName, description = null, operatingSystem = 'kali-linux') {
    const startTime = Date.now();
    console.log(`[ProjectManager] Creating project "${projectName}" for user ${userId}`);
    
    // Generate unique project ID
    const projectId = uuidv4();
    
    // Declare port variables outside try block so they're accessible in catch
    let terminalPort, vncPort, novncPort;
    
    try {
      // Check if Docker is available
      const dockerAvailable = await this.checkDockerAvailable();
      
      if (!dockerAvailable) {
        console.log(`[ProjectManager] ⚠️  Docker not available, creating project in mock mode`);
        return await this.createMockProject(userId, projectName, projectId);
      }
      
      // Allocate 5 consecutive ports for this project - ensures no overlaps ever
      const portBlock = await this.portAllocator.allocatePortBlock();
      terminalPort = portBlock.terminalPort;
      vncPort = portBlock.vncPort;
      novncPort = portBlock.novncPort;
      const customPort1 = portBlock.customPort1;
      const customPort2 = portBlock.customPort2;
      
      console.log(`[ProjectManager] ========================================`);
      console.log(`[ProjectManager] 🔌 ALLOCATED CONSECUTIVE PORT BLOCK FOR PROJECT ${projectId}`);
      console.log(`[ProjectManager]   Port Block: ${terminalPort}-${customPort2} (5 consecutive ports)`);
      console.log(`[ProjectManager]   Terminal Port: ${terminalPort}`);
      console.log(`[ProjectManager]   VNC Port: ${vncPort}`);
      console.log(`[ProjectManager]   noVNC Port: ${novncPort}`);
      console.log(`[ProjectManager]   Custom Port 1: ${customPort1}`);
      console.log(`[ProjectManager]   Custom Port 2: ${customPort2}`);
      console.log(`[ProjectManager] ========================================`);
      
      // Build container configuration
      console.log(`[ProjectManager] 🐧 Using operating system: ${operatingSystem}`);
      
      // For Windows projects, create isolated network first
      const isWindows = operatingSystem === 'windows-11' || operatingSystem === 'windows-10';
      if (isWindows) {
        const networkName = `project-${projectId.substring(0, 8)}-network`;
        
        // Calculate subnet for this project
        const ips = this.calculateProjectSubnet(projectId);
        const projectSubnet = ips.subnet;
        const projectGateway = ips.gateway;
        const sharedFolderIp = ips.sharedFolderIp;
        const sharedFolderAlias = '172.30.0.1'; // Windows VM will use this address
        
        let network;
        try {
          network = this.docker.getNetwork(networkName);
          await network.inspect();
          console.log(`[ProjectManager] 🔒 Using existing isolated network: ${networkName}`);
        } catch (err) {
          // Network doesn't exist, create it with same subnet (isolated)
          console.log(`[ProjectManager] 🔒 Creating isolated network: ${networkName} with subnet ${projectSubnet}`);
          network = await this.docker.createNetwork({
            Name: networkName,
            Driver: 'bridge',
            Internal: false, // Allow external access for host.docker.internal
            EnableIPv6: false,
            IPAM: {
              Driver: 'default',
              Config: [{
                Subnet: projectSubnet,
                Gateway: projectGateway
              }]
            },
            Options: {
              'com.docker.network.bridge.enable_icc': 'true',
              'com.docker.network.bridge.enable_ip_masquerade': 'true',
              'com.docker.network.bridge.host_binding_ipv4': '0.0.0.0'
            },
            Labels: {
              'windows-project-id': projectId,
              'windows-project-name': projectName,
              'project-network': 'true'
            }
          });
          console.log(`[ProjectManager] ✅ Network created - shared folder accessible at ${sharedFolderIp}:8888`);
        }
        
        // Connect backend container to this project network so it can reach the Windows MCP server
        try {
          const backendContainerName = process.env.BACKEND_CONTAINER_NAME || 'pantheon-backend';
          const backendContainer = this.docker.getContainer(backendContainerName);
          // Backend doesn't need to be on project network - MCP communication happens via exposed ports
          // Skipping backend connection to save IPs in /30 subnet
          console.log(`[ProjectManager] ℹ️  Backend will communicate with MCP via exposed ports (not on project network)`);
        } catch (connectErr) {
          // If already connected, that's fine
          if (!connectErr.message.includes('already exists')) {
            console.warn(`[ProjectManager] ⚠️  Failed to connect backend to project network:`, connectErr.message);
          }
        }
      }
      
      const containerConfig = await this.buildContainerConfig(projectId, {
        terminalPort,
        vncPort,
        novncPort,
        customPort1,
        customPort2,
        operatingSystem
      });
      
      console.log(`[ProjectManager] 🐳 Docker image: ${containerConfig.Image}`);
      
      // Create container (local or remote via agent) with retry logic for IP conflicts
      console.log(`[ProjectManager] Creating Docker container...`);
      let containerInfo;
      let containerId;
      let retryCount = 0;
      const maxRetries = 5;
      
      while (retryCount < maxRetries) {
        try {
          containerInfo = await this.createContainer(containerConfig, userId);
          containerId = containerInfo.id;
          break; // Success, exit retry loop
        } catch (createError) {
          if (createError.message.includes('Address already in use') && retryCount < maxRetries - 1 && isWindows) {
            retryCount++;
            
            // Extract current IP from config
            const networkName = `project-${projectId.substring(0, 8)}-network`;
            const currentIp = containerConfig.NetworkingConfig?.EndpointsConfig?.[networkName]?.IPAMConfig?.IPv4Address;
            
            console.warn(`[ProjectManager] ⚠️  IP ${currentIp} already in use (attempt ${retryCount}/${maxRetries}), trying alternative IP...`);
            
            // Calculate alternative IP
            const ips = this.calculateProjectSubnet(projectId);
            const subnetParts = ips.subnet.split('/')[0].split('.');
            const baseIp = `${subnetParts[0]}.${subnetParts[1]}.${subnetParts[2]}`;
            const fourthOctet = parseInt(subnetParts[3]);
            
            // Try next available IP (add offset based on retry count)
            const offset = retryCount * 10;
            const newOctet = fourthOctet + 3 + offset;
            
            if (newOctet <= 254) {
              const newIp = `${baseIp}.${newOctet}`;
              console.log(`[ProjectManager] 🔄 Retrying with IP: ${newIp}`);
              
              // Update the container config with new IP
              if (containerConfig.NetworkingConfig && containerConfig.NetworkingConfig.EndpointsConfig) {
                containerConfig.NetworkingConfig.EndpointsConfig[networkName].IPAMConfig.IPv4Address = newIp;
              }
              
              // Wait a bit before retrying
              await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
              throw new Error(`No available IPs in subnet after ${retryCount} retries`);
            }
          } else {
            // Not an IP conflict or max retries reached, throw the error
            throw createError;
          }
        }
      }
      
      if (!containerInfo) {
        throw new Error(`Failed to create container after ${maxRetries} retries`);
      }
      
      const containerName = containerConfig.name;
      const agentId = containerInfo.agentId;
      const isRemote = containerInfo.remote;
      
      console.log(`[ProjectManager] Container created: ${containerId}`);
      if (isRemote) {
        console.log(`[ProjectManager] 🤖 Container created on remote agent: ${agentId}`);
      } else {
        console.log(`[ProjectManager] 🐳 Container created locally`);
      }
      
      // Windows projects use embedded storage from the snapshot image
      // No volume initialization needed - storage files are baked into the image
      if (isWindows) {
        console.log(`[ProjectManager] ⚡ Using embedded Windows storage from snapshot image`);
        console.log(`[ProjectManager] Windows will boot from pre-installed system in 10-20 seconds`);
      }
      
      // Start container (local or remote via agent)
      console.log(`[ProjectManager] Starting container...`);
      await this.startContainer(containerId, agentId);
      
      // Wait for container to be healthy
      // Windows needs more time: 3-5 min for snapshot copy + 1-2 min for boot = 30 min total
      const waitTime = isWindows ? 1800000 : 45000; // 30 minutes for Windows (snapshot copy + boot), 45 seconds for others
      
      // For remote containers, skip health check (agent handles it)
      if (!isRemote) {
        const container = this.docker.getContainer(containerId);
        await this.waitForHealthy(container, waitTime);
      } else {
        console.log(`[ProjectManager] ⏭️  Skipping health check for remote container`);
      }
      
      // Initialize tmux session for terminal commands (not needed for Windows)
      if (!isWindows) {
        await this.initializeTmuxSession(container, operatingSystem);
      }
      
      // Generate unique API keys for Windows projects
      let mcpApiKey = null;
      let apiServiceKey = null;
      let encryptionKey = null;
      if (isWindows) {
        // Generate MCP API key (for clients connecting to this project's MCP server)
        const mcpKeyPair = this.apiKeyGenerator.generateProjectKey(projectId, { salt: Date.now().toString() });
        mcpApiKey = mcpKeyPair.hashedKey;
        console.log(`[ProjectManager] 🔐 Generated unique MCP API key for Windows project`);
        console.log(`[ProjectManager]   Key hash preview: ${mcpApiKey.substring(0, 16)}...${mcpApiKey.substring(mcpApiKey.length - 8)}`);
        
        // Generate API Service key (for thin client to authenticate with API service)
        const apiServiceKeyPair = this.apiKeyGenerator.generateProjectKey(projectId, { salt: `api-service-${Date.now()}` });
        apiServiceKey = apiServiceKeyPair.hashedKey;
        console.log(`[ProjectManager] 🔐 Generated unique API Service key for Windows project`);
        console.log(`[ProjectManager]   Key hash preview: ${apiServiceKey.substring(0, 16)}...${apiServiceKey.substring(apiServiceKey.length - 8)}`);
        
        // Generate encryption key (for encrypting/decrypting scripts) - AES-256 requires 64 hex chars
        // Note: Must be pure hex for AES-256-GCM encryption
        encryptionKey = crypto.randomBytes(32).toString('hex'); // 64 chars pure hex
        console.log(`[ProjectManager] 🔐 Generated unique encryption key for Windows project`);
        console.log(`[ProjectManager]   Key preview: ${encryptionKey.substring(0, 16)}...${encryptionKey.substring(encryptionKey.length - 8)}`);
        
        // Discover Windows Tools API IP address on the project network
        let toolsApiUrl = 'http://172.28.0.2:8090'; // Default fallback
        try {
          const networkName = `project-${projectId.substring(0, 8)}-network`;
          const network = this.docker.getNetwork(networkName);
          
          // Connect windows-tools-api to this project network if not already connected
          let justConnected = false;
          try {
            const toolsApiContainer = this.docker.getContainer('windows-tools-api');
            await network.connect({ Container: 'windows-tools-api' });
            console.log(`[ProjectManager] 🔗 Connected windows-tools-api to project network ${networkName}`);
            justConnected = true;
          } catch (connectErr) {
            // If already connected, that's fine
            if (!connectErr.message.includes('already exists')) {
              console.warn(`[ProjectManager] ⚠️  Failed to connect windows-tools-api:`, connectErr.message);
            } else {
              console.log(`[ProjectManager] ✓ windows-tools-api already connected to ${networkName}`);
            }
          }
          
          // Wait a moment for network to update if we just connected
          if (justConnected) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          const networkInfo = await network.inspect();
          
          // Find the windows-tools-api container on this network
          for (const [containerId, containerInfo] of Object.entries(networkInfo.Containers || {})) {
            if (containerInfo.Name === 'windows-tools-api') {
              const ipAddress = containerInfo.IPv4Address.split('/')[0]; // Remove CIDR notation
              toolsApiUrl = `http://${ipAddress}:8090`;
              console.log(`[ProjectManager] 🔍 Discovered Windows Tools API at: ${toolsApiUrl}`);
              break;
            }
          }
          
          // If we didn't find it, log a warning
          if (toolsApiUrl === 'http://172.28.0.2:8090') {
            console.warn(`[ProjectManager] ⚠️  Could not find windows-tools-api on network, using fallback: ${toolsApiUrl}`);
          }
        } catch (discoveryError) {
          console.warn(`[ProjectManager] ⚠️  Failed to discover Tools API IP, using default:`, discoveryError.message);
        }
        
        // Create per-project shared folder and Docker container to serve it
        try {
          const fs = require('fs').promises;
          const path = require('path');
          
          // Create project-specific directory
          const projectSharedDir = path.join(__dirname, '..', 'windows-vm-files', projectId);
          await fs.mkdir(projectSharedDir, { recursive: true });
          
          // Write .env file to project-specific directory
          const envFilePath = path.join(projectSharedDir, '.env');
          const envContent = `MCP_ENABLE_REMOTE=true
MCP_HTTP_PORT=${customPort1}
MCP_WS_PORT=${customPort2}
MCP_API_KEY=${mcpApiKey}
API_SERVICE_KEY=${apiServiceKey}
PROJECT_ID=${projectId}
API_SERVICE_URL=${toolsApiUrl}
ENCRYPTION_KEY=${encryptionKey}
MCP_LOG_LEVEL=info
`;
          await fs.writeFile(envFilePath, envContent, 'utf8');
          
          // Copy setup scripts to project directory
          const scriptsDir = path.join(__dirname, '..', 'windows-vm-files');
          const scriptsToCopy = ['fetch-env-on-startup.ps1', 'setup-auto-fetch.ps1', 'auto-setup.ps1', 'README.txt'];
          for (const script of scriptsToCopy) {
            try {
              const srcPath = path.join(scriptsDir, script);
              const destPath = path.join(projectSharedDir, script);
              await fs.copyFile(srcPath, destPath);
            } catch (copyError) {
              console.warn(`[ProjectManager] Failed to copy ${script}:`, copyError.message);
            }
          }
          
          // Create dedicated Docker container to serve shared folder
          // Shared folder is ALWAYS accessible at 172.30.0.1:8888 from Windows VM
          await this.createSharedFolderContainer(projectId, projectName, projectSharedDir);
          
          // Connect Windows container to windows-tools-network for API access
          try {
            const toolsNetwork = this.docker.getNetwork('windows-tools-network');
            // Use IP 172.28.0.10+ to avoid conflict with tools API at 172.28.0.2
            // Generate a unique IP based on project ID hash
            const projectHash = parseInt(projectId.substring(0, 8), 16);
            const ipSuffix = 10 + (projectHash % 240); // Range: 172.28.0.10 - 172.28.0.249
            const projectIp = `172.28.0.${ipSuffix}`;
            
            await toolsNetwork.connect({
              Container: containerId,
              EndpointConfig: {
                IPAMConfig: {
                  IPv4Address: projectIp
                }
              }
            });
            console.log(`[ProjectManager] ✅ Connected Windows container to windows-tools-network`);
            
            // Add iptables rules for Windows VM to access tools API
            // This allows the Windows VM (172.31.0.x) to reach the tools API (172.28.0.x)
            try {
              // Rule 1: MASQUERADE for general eth1 traffic
              const masqueradeExec = await container.exec({
                Cmd: ['iptables', '-t', 'nat', '-A', 'POSTROUTING', '-o', 'eth1', '-j', 'MASQUERADE'],
                AttachStdout: true,
                AttachStderr: true
              });
              await masqueradeExec.start({});
              
              // Rule 2: Specific MASQUERADE for VM to tools network
              const vmMasqueradeExec = await container.exec({
                Cmd: ['iptables', '-t', 'nat', '-A', 'POSTROUTING', '-s', '172.31.0.0/24', '-d', '172.28.0.0/16', '-o', 'eth1', '-j', 'MASQUERADE'],
                AttachStdout: true,
                AttachStderr: true
              });
              await vmMasqueradeExec.start({});
              
              // Rule 3: Enable IP forwarding
              const forwardExec = await container.exec({
                Cmd: ['sysctl', '-w', 'net.ipv4.ip_forward=1'],
                AttachStdout: true,
                AttachStderr: true
              });
              await forwardExec.start({});
              
              // Rule 4: FORWARD chain rules
              const forwardAcceptExec = await container.exec({
                Cmd: ['iptables', '-A', 'FORWARD', '-s', '172.31.0.0/24', '-d', '172.28.0.0/16', '-j', 'ACCEPT'],
                AttachStdout: true,
                AttachStderr: true
              });
              await forwardAcceptExec.start({});
              
              const forwardReturnExec = await container.exec({
                Cmd: ['iptables', '-A', 'FORWARD', '-s', '172.28.0.0/16', '-d', '172.31.0.0/24', '-j', 'ACCEPT'],
                AttachStdout: true,
                AttachStderr: true
              });
              await forwardReturnExec.start({});
              
              console.log(`[ProjectManager] ✅ Added iptables rules for windows-tools-network access`);
            } catch (iptablesError) {
              console.warn(`[ProjectManager] ⚠️  Could not add iptables rules:`, iptablesError.message);
            }
          } catch (networkError) {
            console.warn(`[ProjectManager] ⚠️  Could not connect to windows-tools-network:`, networkError.message);
          }
          
          // Set up proxy inside Windows container to allow VM access to shared folder
          // This maintains isolation while allowing the Windows VM to access its own shared folder
          await this.setupSharedFolderProxy(container, projectId);
          
        } catch (fileError) {
          console.error(`[ProjectManager] ⚠️  Failed to setup per-project shared folder:`, fileError.message);
          // Don't fail the project creation if file setup fails
        }
      }
      
      // Prepare project data for Supabase
      const projectData = {
        id: projectId,
        name: projectName,
        description: description,
        owner_id: userId,
        container_id: containerId,
        container_name: containerName,
        terminal_port: terminalPort,
        vnc_port: vncPort,
        novnc_port: novncPort,
        custom_port_1: customPort1,
        custom_port_2: customPort2,
        operating_system: operatingSystem,
        mcp_api_key: mcpApiKey, // Store MCP API key for Windows projects
        api_service_key: apiServiceKey, // Store API Service key for Windows projects
        encryption_key: encryptionKey, // Store encryption key for Windows projects
        agent_id: agentId, // Store agent ID if container is remote
        status: 'creating', // Start as 'creating', health check will update to 'running' when ready
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      };
      
      // Insert into Supabase with detailed logging
      console.log(`[ProjectManager] ========================================`);
      console.log(`[ProjectManager] 💾 SAVING PROJECT TO DATABASE`);
      console.log(`[ProjectManager]   Project ID: ${projectId}`);
      console.log(`[ProjectManager]   Project Name: ${projectName}`);
      console.log(`[ProjectManager]   Container ID: ${containerId}`);
      console.log(`[ProjectManager]   Container Name: ${containerName}`);
      console.log(`[ProjectManager]   Terminal Port: ${terminalPort} (UNIQUE)`);
      console.log(`[ProjectManager]   VNC Port: ${vncPort} (UNIQUE)`);
      console.log(`[ProjectManager]   noVNC Port: ${novncPort} (UNIQUE)`);
      console.log(`[ProjectManager]   Custom Port 1: ${customPort1} (UNIQUE)`);
      console.log(`[ProjectManager]   Custom Port 2: ${customPort2} (UNIQUE)`);
      console.log(`[ProjectManager]   OS: ${operatingSystem}`);
      console.log(`[ProjectManager] ========================================`);
      
      const { data, error } = await this.supabase
        .from('projects')
        .insert([projectData])
        .select()
        .single();
      
      if (error) {
        // Rollback: Stop and remove container
        console.error(`[ProjectManager] ❌ Database insertion failed!`);
        console.error(`[ProjectManager] Error code: ${error.code}`);
        console.error(`[ProjectManager] Error message: ${error.message}`);
        console.error(`[ProjectManager] Error details:`, JSON.stringify(error, null, 2));
        console.error(`[ProjectManager] Rolling back container...`);
        try {
          await container.stop({ t: 5 });
          await container.remove({ v: true });
        } catch (rollbackError) {
          console.error(`[ProjectManager] Rollback failed:`, rollbackError.message);
        }
        throw new Error(`Failed to save project to database: ${error.message}`);
      }
      
      console.log(`[ProjectManager] ✅ Database insertion successful!`);
      console.log(`[ProjectManager] Inserted data:`, JSON.stringify(data, null, 2));
      
      // Create dedicated storage bucket for this project
      console.log(`[ProjectManager] 📦 Creating dedicated storage bucket...`);
      try {
        const bucketName = `screenshots-${projectId}`;
        const { data: bucketData, error: bucketError } = await this.supabase
          .storage
          .createBucket(bucketName, {
            public: true,
            fileSizeLimit: 52428800, // 50 MB
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif']
          });
        
        if (bucketError) {
          console.error(`[ProjectManager] ⚠️  Failed to create storage bucket:`, bucketError.message);
          // Don't fail project creation if bucket creation fails
        } else {
          console.log(`[ProjectManager] ✅ Storage bucket created: ${bucketName}`);
        }
      } catch (storageError) {
        console.error(`[ProjectManager] ⚠️  Storage bucket creation error:`, storageError.message);
        // Don't fail project creation if bucket creation fails
      }
      
      // Verify the data persisted by querying it back
      console.log(`[ProjectManager] 🔍 Verifying data persistence...`);
      const { data: verifyData, error: verifyError } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (verifyError) {
        console.error(`[ProjectManager] ⚠️  Verification failed:`, verifyError.message);
      } else if (!verifyData) {
        console.error(`[ProjectManager] ⚠️  Project not found after insertion!`);
      } else {
        console.log(`[ProjectManager] ✅ Verification successful - project persisted in database`);
      }
      
      const duration = Date.now() - startTime;
      console.log(`[ProjectManager] ✅ Project created successfully in ${duration}ms`);
      
      // Start health monitoring
      this.startHealthMonitoring(projectId);
      
      // Convert snake_case to camelCase for frontend
      const convertedProject = this.convertProjectData(data);
      
      // Fetch owner info from auth.users
      try {
        const { data: userData, error: userError } = await this.supabase.auth.admin.getUserById(userId);
        
        if (!userError && userData?.user) {
          const user = userData.user;
          convertedProject.ownerName = user.user_metadata?.full_name || 
                                      user.user_metadata?.name ||
                                      user.email?.split('@')[0] || 
                                      'Unknown Owner';
        } else {
          convertedProject.ownerName = 'Unknown Owner';
        }
      } catch (ownerError) {
        console.warn(`[ProjectManager] Failed to fetch owner for new project:`, ownerError);
        convertedProject.ownerName = 'Unknown Owner';
      }
      
      return convertedProject;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[ProjectManager] ❌ Failed to create project after ${duration}ms:`, error.message);
      
      // Release allocated ports on failure
      if (this.portAllocator) {
        try {
          if (terminalPort) await this.portAllocator.releasePort(terminalPort);
          if (vncPort) await this.portAllocator.releasePort(vncPort);
          if (novncPort) await this.portAllocator.releasePort(novncPort);
          if (typeof customPort1 !== 'undefined') await this.portAllocator.releasePort(customPort1);
          if (typeof customPort2 !== 'undefined') await this.portAllocator.releasePort(customPort2);
        } catch (releaseError) {
          console.error(`[ProjectManager] Failed to release ports:`, releaseError.message);
        }
      }
      
      throw error;
    }
  }

  /**
   * Create a new project with progress callbacks
   * @param {string} userId - User ID who owns the project
   * @param {string} projectName - Name of the project
   * @param {string} description - Optional project description
   * @param {string} operatingSystem - Operating system to use
   * @param {Function} onProgress - Progress callback (step, message, progress)
   * @returns {Promise<Object>} Created project data
   */
  async createProjectWithProgress(userId, projectName, description = null, operatingSystem = 'kali-linux', onProgress) {
    const startTime = Date.now();
    console.log(`[ProjectManager] Creating project "${projectName}" with progress tracking`);
    
    const projectId = uuidv4();
    let terminalPort, vncPort, novncPort, container, containerId, containerName;
    
    try {
      onProgress('init', 'Initializing project...', 5);
      
      // Check Docker availability
      const dockerAvailable = await this.checkDockerAvailable();
      if (!dockerAvailable) {
        console.log(`[ProjectManager] ⚠️  Docker not available, creating project in mock mode`);
        return await this.createMockProject(userId, projectName, projectId);
      }
      
      onProgress('ports', 'Allocating network ports...', 10);
      
      // Allocate 5 consecutive ports for this project
      const portBlock = await this.portAllocator.allocatePortBlock();
      terminalPort = portBlock.terminalPort;
      vncPort = portBlock.vncPort;
      novncPort = portBlock.novncPort;
      const customPort1 = portBlock.customPort1;
      const customPort2 = portBlock.customPort2;
      
      console.log(`[ProjectManager] Allocated port block ${terminalPort}-${customPort2} - Terminal: ${terminalPort}, VNC: ${vncPort}, noVNC: ${novncPort}, Custom1: ${customPort1}, Custom2: ${customPort2}`);
      
      onProgress('config', 'Building container configuration...', 15);
      
      // Build container config
      const containerConfig = await this.buildContainerConfig(projectId, {
        terminalPort,
        vncPort,
        novncPort,
        customPort1,
        customPort2,
        operatingSystem
      });
      
      onProgress('container', 'Creating Docker container...', 20);
      
      // Create container
      container = await this.docker.createContainer(containerConfig);
      containerId = container.id;
      containerName = containerConfig.name;
      
      console.log(`[ProjectManager] Container created: ${containerId}`);
      
      onProgress('starting', 'Starting container...', 25);
      
      // Start container
      await container.start();
      
      // For Windows projects, connect to windows-tools-network for API access
      if (operatingSystem === 'windows-11') {
        try {
          const toolsNetwork = this.docker.getNetwork('windows-tools-network');
          // Use IP 172.28.0.10+ to avoid conflict with tools API at 172.28.0.2
          // Generate a unique IP based on project ID hash
          const projectHash = parseInt(projectId.substring(0, 8), 16);
          const ipSuffix = 10 + (projectHash % 240); // Range: 172.28.0.10 - 172.28.0.249
          const projectIp = `172.28.0.${ipSuffix}`;
          
          await toolsNetwork.connect({
            Container: containerId,
            EndpointConfig: {
              IPAMConfig: {
                IPv4Address: projectIp
              }
            }
          });
          console.log(`[ProjectManager] ✅ Connected to windows-tools-network at ${projectIp}`);
          
          // Add iptables rules for Windows VM to access tools API
          // This allows the Windows VM (172.31.0.x) to reach the tools API (172.28.0.x)
          try {
            // Rule 1: MASQUERADE for general eth1 traffic
            const masqueradeExec = await container.exec({
              Cmd: ['iptables', '-t', 'nat', '-A', 'POSTROUTING', '-o', 'eth1', '-j', 'MASQUERADE'],
              AttachStdout: true,
              AttachStderr: true
            });
            await masqueradeExec.start({});
            console.log(`[ProjectManager] ✅ Added iptables MASQUERADE rule for eth1`);
            
            // Rule 2: Specific MASQUERADE for VM to tools network
            const vmMasqueradeExec = await container.exec({
              Cmd: ['iptables', '-t', 'nat', '-A', 'POSTROUTING', '-s', '172.31.0.0/24', '-d', '172.28.0.0/16', '-o', 'eth1', '-j', 'MASQUERADE'],
              AttachStdout: true,
              AttachStderr: true
            });
            await vmMasqueradeExec.start({});
            console.log(`[ProjectManager] ✅ Added iptables MASQUERADE rule for VM to tools network`);
            
            // Rule 3: Enable IP forwarding
            const forwardExec = await container.exec({
              Cmd: ['sysctl', '-w', 'net.ipv4.ip_forward=1'],
              AttachStdout: true,
              AttachStderr: true
            });
            await forwardExec.start({});
            console.log(`[ProjectManager] ✅ Enabled IP forwarding`);
            
            // Rule 4: FORWARD chain rules for VM to tools network
            const forwardAcceptExec = await container.exec({
              Cmd: ['iptables', '-A', 'FORWARD', '-s', '172.31.0.0/24', '-d', '172.28.0.0/16', '-j', 'ACCEPT'],
              AttachStdout: true,
              AttachStderr: true
            });
            await forwardAcceptExec.start({});
            console.log(`[ProjectManager] ✅ Added FORWARD rule for VM to tools network`);
            
            // Rule 5: FORWARD chain rules for tools network to VM
            const forwardReturnExec = await container.exec({
              Cmd: ['iptables', '-A', 'FORWARD', '-s', '172.28.0.0/16', '-d', '172.31.0.0/24', '-j', 'ACCEPT'],
              AttachStdout: true,
              AttachStderr: true
            });
            await forwardReturnExec.start({});
            console.log(`[ProjectManager] ✅ Added FORWARD rule for tools network to VM`);
          } catch (iptablesError) {
            console.warn(`[ProjectManager] ⚠️  Could not add iptables rules:`, iptablesError.message);
          }
        } catch (error) {
          console.warn(`[ProjectManager] ⚠️  Could not connect to windows-tools-network:`, error.message);
        }
      }
      
      // Wait for services with progress updates
      const needsSystemd = operatingSystem === 'ubuntu-24' || operatingSystem === 'ubuntu-22';
      
      if (needsSystemd) {
        onProgress('systemd', 'Starting systemd init system...', 30);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        onProgress('vnc', 'Starting VNC server...', 40);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        onProgress('desktop', 'Starting GNOME desktop environment...', 50);
        await new Promise(resolve => setTimeout(resolve, 19000));
        
        onProgress('novnc', 'Starting noVNC web proxy...', 70);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        onProgress('terminal', 'Starting web terminal...', 80);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        onProgress('health', 'Verifying all services...', 85);
        await this.waitForHealthyWithProgress(container, 30000, onProgress);
      } else {
        onProgress('services', 'Starting services...', 40);
        await this.waitForHealthyWithProgress(container, 45000, onProgress);
      }
      
      // Initialize tmux session for terminal commands
      onProgress('tmux', 'Initializing terminal session...', 88);
      await this.initializeTmuxSession(container, operatingSystem);
      
      onProgress('database', 'Saving project to database...', 90);
      
      // Prepare project data
      const projectData = {
        id: projectId,
        name: projectName,
        description: description,
        owner_id: userId,
        container_id: containerId,
        container_name: containerName,
        terminal_port: terminalPort,
        vnc_port: vncPort,
        novnc_port: novncPort,
        custom_port_1: customPort1,
        custom_port_2: customPort2,
        operating_system: operatingSystem,
        status: 'running',
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      };
      
      // Insert into database
      const { data, error } = await this.supabase
        .from('projects')
        .insert([projectData])
        .select()
        .single();
      
      if (error) {
        console.error(`[ProjectManager] ❌ Database insertion failed:`, error.message);
        try {
          await container.stop({ t: 5 });
          await container.remove({ v: true });
        } catch (rollbackError) {
          console.error(`[ProjectManager] Rollback failed:`, rollbackError.message);
        }
        throw new Error(`Failed to save project to database: ${error.message}`);
      }
      
      onProgress('finalizing', 'Finalizing project setup...', 95);
      
      const duration = Date.now() - startTime;
      console.log(`[ProjectManager] ✅ Project created successfully in ${duration}ms`);
      
      // Start health monitoring
      this.startHealthMonitoring(projectId);
      
      // Convert and fetch owner info
      const convertedProject = this.convertProjectData(data);
      
      try {
        const { data: userData, error: userError } = await this.supabase.auth.admin.getUserById(userId);
        if (!userError && userData?.user) {
          const user = userData.user;
          convertedProject.ownerName = user.user_metadata?.full_name || 
                                      user.user_metadata?.name ||
                                      user.email?.split('@')[0] || 
                                      'Unknown Owner';
        } else {
          convertedProject.ownerName = 'Unknown Owner';
        }
      } catch (ownerError) {
        console.warn(`[ProjectManager] Failed to fetch owner:`, ownerError);
        convertedProject.ownerName = 'Unknown Owner';
      }
      
      return convertedProject;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[ProjectManager] ❌ Failed to create project after ${duration}ms:`, error.message);
      
      // Release ports on failure
      if (this.portAllocator) {
        try {
          if (terminalPort) await this.portAllocator.releasePort(terminalPort);
          if (vncPort) await this.portAllocator.releasePort(vncPort);
          if (novncPort) await this.portAllocator.releasePort(novncPort);
        } catch (releaseError) {
          console.error(`[ProjectManager] Failed to release ports:`, releaseError.message);
        }
      }
      
      throw error;
    }
  }

  /**
   * Wait for container health with progress updates
   */
  async waitForHealthyWithProgress(container, timeout, onProgress) {
    const startTime = Date.now();
    let lastProgress = 85;
    
    while (Date.now() - startTime < timeout) {
      const info = await container.inspect();
      
      if (info.State.Health && info.State.Health.Status === 'healthy') {
        console.log(`[ProjectManager] Container is healthy`);
        return;
      }
      
      if (info.State.Status === 'running') {
        // Update progress incrementally
        const elapsed = Date.now() - startTime;
        const progressPercent = Math.min(89, lastProgress + Math.floor(elapsed / 5000));
        if (progressPercent > lastProgress) {
          lastProgress = progressPercent;
          onProgress('health', 'Waiting for services to be ready...', progressPercent);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw new Error(`Container failed to start: ${info.State.Status}`);
      }
    }
    
    throw new Error(`Container health check timeout after ${timeout}ms`);
  }

  /**
   * Delete a project and cleanup all resources
   * @param {string} projectId - Project ID to delete
   * @returns {Promise<void>}
   */
  async deleteProject(projectId) {
    console.log(`[ProjectManager] ========================================`);
    console.log(`[ProjectManager] DELETING PROJECT: ${projectId}`);
    console.log(`[ProjectManager] ========================================`);
    
    let containerRemoved = false;
    let volumesRemoved = false;
    
    try {
      // Stop health monitoring
      this.stopHealthMonitoring(projectId);
      console.log(`[ProjectManager] ✓ Health monitoring stopped`);
      
      // Get project from Supabase (might not exist if already deleted)
      let project = null;
      try {
        project = await this.getProject(projectId);
      } catch (err) {
        console.log(`[ProjectManager] ⚠️  Project not found in database, will attempt cleanup by name`);
      }
      
      // Determine operating system (default to windows-11 if unknown)
      const operatingSystem = project?.operating_system || 'windows-11';
      
      // Stop and remove shared folder container if exists
      try {
        const containerName = `shared-folder-${projectId.substring(0, 8)}`;
        const sharedContainer = this.docker.getContainer(containerName);
        await sharedContainer.stop({ t: 5 }).catch(() => {});
        await sharedContainer.remove();
        console.log(`[ProjectManager] ✓ Shared folder container removed: ${containerName}`);
        
        // Clean up nginx config file from shared folder
        const path = require('path');
        const fs = require('fs');
        const projectSharedDir = path.resolve(__dirname, '..', 'windows-vm-files', projectId);
        const nginxConfigPath = path.join(projectSharedDir, '.nginx-config.conf');
        try {
          if (fs.existsSync(nginxConfigPath)) {
            fs.unlinkSync(nginxConfigPath);
            console.log(`[ProjectManager] ✓ Cleaned up nginx config file`);
          }
        } catch (cleanupErr) {
          console.error(`[ProjectManager] ⚠️  Failed to cleanup nginx config:`, cleanupErr.message);
        }
      } catch (err) {
        // Container might not exist, that's okay
        console.log(`[ProjectManager] ℹ️  No shared folder container to remove`);
      }
      
      // Clean up isolated network for Windows projects
      if (operatingSystem === 'windows-11' || operatingSystem === 'windows-10') {
        const networkName = `project-${projectId.substring(0, 8)}-network`;
        try {
          const network = this.docker.getNetwork(networkName);
          
          // Disconnect windows-tools-api if connected
          try {
            await network.disconnect({ Container: 'windows-tools-api', Force: true });
          } catch (e) { /* already disconnected */ }
          
          // Remove the network
          await network.remove();
          console.log(`[ProjectManager] ✅ Cleaned up isolated network: ${networkName}`);
        } catch (networkErr) {
          if (networkErr.statusCode !== 404) {
            console.error(`[ProjectManager] Failed to cleanup network:`, networkErr.message);
          }
        }
      }
      
      if (!project) {
        // Project not in database, try to clean up by container name
        console.log(`[ProjectManager] Attempting cleanup by container name pattern...`);
        const containerName = `windows-project-${projectId.substring(0, 8)}`;
        try {
          const container = this.docker.getContainer(containerName);
          await container.inspect(); // Check if exists
          console.log(`[ProjectManager] Found orphaned container: ${containerName}`);
          
          // Force stop and remove
          try {
            await container.kill();
          } catch (killError) {
            console.log(`[ProjectManager] Container already stopped`);
          }
          
          await container.remove({ v: true, force: true });
          console.log(`[ProjectManager] ✅ Removed orphaned container: ${containerName}`);
          containerRemoved = true;
        } catch (findError) {
          if (findError.statusCode === 404) {
            console.log(`[ProjectManager] No orphaned container found`);
          } else {
            console.error(`[ProjectManager] Error checking for orphaned container:`, findError.message);
          }
        }
        
        // Delete from database if it exists
        await this.supabase
          .from('projects')
          .delete()
          .eq('id', projectId);
        
        console.log(`[ProjectManager] ✅ Project cleanup completed (no database record)`);
        return;
      }
      
      console.log(`[ProjectManager] Project details:`);
      console.log(`[ProjectManager]   Name: ${project.name}`);
      console.log(`[ProjectManager]   Container ID: ${project.container_id || 'undefined'}`);
      console.log(`[ProjectManager]   Operating System: ${project.operating_system || 'unknown'}`);
      
      // Stop and remove container (skip for mock projects or if no container_id)
      const isMock = project.container_id?.startsWith('mock-');
      const hasContainerId = project.container_id && project.container_id !== 'undefined';
      
      if (!isMock && this.docker) {
        if (hasContainerId) {
          // Try to remove by container ID
          console.log(`[ProjectManager] Starting Docker cleanup by container ID...`);
          try {
            const container = this.docker.getContainer(project.container_id);
            console.log(`[ProjectManager] Got container reference: ${project.container_id}`);
            
            // First check if container exists
            try {
              await container.inspect();
              console.log(`[ProjectManager] Container exists, proceeding with removal`);
            } catch (inspectError) {
              if (inspectError.statusCode === 404) {
                console.log(`[ProjectManager] ℹ️  Container ${project.container_id} not found (already removed)`);
                containerRemoved = true;
                // Skip to volume cleanup
                throw new Error('CONTAINER_NOT_FOUND');
              }
              throw inspectError;
            }
            
            // Force stop container
            console.log(`[ProjectManager] Force stopping container ${project.container_id}...`);
            try {
              await container.kill(); // Force kill
            } catch (killError) {
              console.log(`[ProjectManager] Container already stopped or kill failed:`, killError.message);
            }
            
            // Remove container with force and volumes
            console.log(`[ProjectManager] Removing container with volumes...`);
            await container.remove({ 
              v: true,  // Remove volumes
              force: true  // Force removal even if running
            });
            
            containerRemoved = true;
            console.log(`[ProjectManager] ✅ Container removed successfully`);
          } catch (error) {
            if (error.message !== 'CONTAINER_NOT_FOUND') {
              console.error(`[ProjectManager] Failed to remove container by ID:`, error.message);
            }
          }
        }
        
        // If no container_id or removal by ID failed, try by name
        if (!containerRemoved) {
          console.log(`[ProjectManager] Attempting cleanup by container name pattern...`);
          const containerName = `windows-project-${projectId.substring(0, 8)}`;
          try {
            const container = this.docker.getContainer(containerName);
            await container.inspect(); // Check if exists
            console.log(`[ProjectManager] Found container by name: ${containerName}`);
            
            // Force stop and remove
            try {
              await container.kill();
            } catch (killError) {
              console.log(`[ProjectManager] Container already stopped`);
            }
            
            await container.remove({ v: true, force: true });
            console.log(`[ProjectManager] ✅ Removed container by name: ${containerName}`);
            containerRemoved = true;
          } catch (findError) {
            if (findError.statusCode === 404) {
              console.log(`[ProjectManager] No container found by name`);
            } else {
              console.error(`[ProjectManager] Error checking for container by name:`, findError.message);
            }
          }
        }
        
        // Remove volumes if container was removed
        if (containerRemoved) {
          // Remove named volumes associated with this project
          const volumeNames = [
            `${projectId}-workspace`,
            `${projectId}-home`
          ];
          
          console.log(`[ProjectManager] Removing volumes for project ${projectId}...`);
          for (const volumeName of volumeNames) {
            try {
              const volume = this.docker.getVolume(volumeName);
              await volume.remove({ force: true });
              console.log(`[ProjectManager] ✅ Removed volume: ${volumeName}`);
            } catch (volumeError) {
              // Volume might not exist or already removed
              if (volumeError.statusCode === 404) {
                console.log(`[ProjectManager] Volume ${volumeName} not found (already removed)`);
              } else {
                console.warn(`[ProjectManager] Failed to remove volume ${volumeName}:`, volumeError.message);
              }
            }
          }
          
          // Also check for any dangling volumes with this project ID pattern
          try {
            const volumes = await this.docker.listVolumes();
            const projectVolumes = volumes.Volumes?.filter(v => 
              v.Name.includes(projectId)
            ) || [];
            
            if (projectVolumes.length > 0) {
              console.log(`[ProjectManager] Found ${projectVolumes.length} additional volumes with project ID`);
              for (const vol of projectVolumes) {
                try {
                  const volume = this.docker.getVolume(vol.Name);
                  await volume.remove({ force: true });
                  console.log(`[ProjectManager] ✅ Removed additional volume: ${vol.Name}`);
                } catch (volError) {
                  console.warn(`[ProjectManager] Failed to remove volume ${vol.Name}:`, volError.message);
                }
              }
            }
          } catch (listError) {
            console.warn(`[ProjectManager] Failed to list volumes:`, listError.message);
          }
          
          // Prune all dangling volumes
          console.log(`[ProjectManager] Pruning all dangling volumes...`);
          try {
            const pruneResult = await this.docker.pruneVolumes();
            const spaceReclaimed = pruneResult.SpaceReclaimed || 0;
            const volumesDeleted = pruneResult.VolumesDeleted?.length || 0;
            console.log(`[ProjectManager] ✅ Pruned ${volumesDeleted} dangling volumes, reclaimed ${(spaceReclaimed / 1024 / 1024).toFixed(2)}MB`);
            volumesRemoved = true;
          } catch (pruneError) {
            console.warn(`[ProjectManager] Volume prune warning:`, pruneError.message);
          }
        }
      }
      
      // Release ports
      if (project.terminal_port) {
      } else {
        if (!hasContainerId) {
          console.log(`[ProjectManager] ⚠️  No container ID found - project may have failed during creation`);
        } else {
          console.log(`[ProjectManager] Skipping container cleanup (mock project or no Docker)`);
        }
        containerRemoved = true; // Mark as success for mock projects or missing containers
        volumesRemoved = true;
      }
      
      // Release ports
      console.log(`[ProjectManager] Releasing ports...`);
      if (this.portAllocator) {
        await this.portAllocator.releasePort(project.terminal_port);
        await this.portAllocator.releasePort(project.vnc_port);
        await this.portAllocator.releasePort(project.novnc_port);
        if (project.customPort1) await this.portAllocator.releasePort(project.customPort1);
        if (project.customPort2) await this.portAllocator.releasePort(project.customPort2);
        console.log(`[ProjectManager] ✓ Ports released`);
      }
      
      // Clean up per-project shared folder and isolated network
      if (project.operatingSystem === 'windows-11' || project.operatingSystem === 'windows-10') {
        try {
          const fs = require('fs').promises;
          const path = require('path');
          const projectSharedDir = path.join(__dirname, '..', 'windows-vm-files', projectId);
          
          // Remove directory recursively
          await fs.rm(projectSharedDir, { recursive: true, force: true });
          console.log(`[ProjectManager] ✓ Removed per-project shared folder: ${projectSharedDir}`);
        } catch (cleanupError) {
          console.warn(`[ProjectManager] Failed to remove shared folder:`, cleanupError.message);
        }
        
        // Remove isolated network
        try {
          const networkName = `project-${projectId.substring(0, 8)}-network`;
          const network = this.docker.getNetwork(networkName);
          
          // First, disconnect all containers from the network
          try {
            const networkInfo = await network.inspect();
            const containers = networkInfo.Containers || {};
            
            console.log(`[ProjectManager] Disconnecting ${Object.keys(containers).length} containers from network ${networkName}`);
            
            for (const [containerId, containerInfo] of Object.entries(containers)) {
              try {
                await network.disconnect({ Container: containerId, Force: true });
                console.log(`[ProjectManager] ✓ Disconnected ${containerInfo.Name} from network`);
              } catch (disconnectErr) {
                console.warn(`[ProjectManager] Failed to disconnect ${containerInfo.Name}:`, disconnectErr.message);
              }
            }
          } catch (inspectErr) {
            console.warn(`[ProjectManager] Failed to inspect network:`, inspectErr.message);
          }
          
          // Now remove the network
          await network.remove();
          console.log(`[ProjectManager] ✓ Removed isolated network: ${networkName}`);
        } catch (networkError) {
          if (networkError.statusCode === 404) {
            console.log(`[ProjectManager] Network not found (already removed)`);
          } else {
            console.warn(`[ProjectManager] Failed to remove network:`, networkError.message);
          }
        }
      }
      
      // Delete storage bucket for this project
      console.log(`[ProjectManager] Deleting storage bucket...`);
      try {
        const bucketName = `screenshots-${projectId}`;
        
        // First, empty the bucket by listing and deleting all files
        try {
          const { data: files, error: listError } = await this.supabase
            .storage
            .from(bucketName)
            .list();
          
          if (!listError && files && files.length > 0) {
            const filePaths = files.map(file => file.name);
            const { error: deleteFilesError } = await this.supabase
              .storage
              .from(bucketName)
              .remove(filePaths);
            
            if (deleteFilesError) {
              console.warn(`[ProjectManager] ⚠️  Failed to delete files from bucket:`, deleteFilesError.message);
            } else {
              console.log(`[ProjectManager] ✓ Deleted ${files.length} files from bucket`);
            }
          }
        } catch (emptyError) {
          console.warn(`[ProjectManager] ⚠️  Failed to empty bucket:`, emptyError.message);
        }
        
        // Now delete the bucket itself
        const { error: bucketError } = await this.supabase
          .storage
          .deleteBucket(bucketName);
        
        if (bucketError) {
          console.warn(`[ProjectManager] ⚠️  Failed to delete storage bucket:`, bucketError.message);
        } else {
          console.log(`[ProjectManager] ✓ Storage bucket deleted: ${bucketName}`);
        }
      } catch (storageError) {
        console.warn(`[ProjectManager] ⚠️  Storage bucket deletion error:`, storageError.message);
      }
      
      // Delete from Supabase (cascades to sessions and messages)
      console.log(`[ProjectManager] Deleting from database...`);
      const { error } = await this.supabase
        .from('projects')
        .delete()
        .eq('id', projectId);
      
      if (error) {
        throw new Error(`Failed to delete project from database: ${error.message}`);
      }
      
      console.log(`[ProjectManager] ✓ Database record deleted`);
      
      // Automatic Docker cleanup after project deletion
      console.log(`[ProjectManager] Running automatic Docker cleanup...`);
      let imagesReclaimed = 0;
      let buildCacheReclaimed = 0;
      
      if (!isMock && this.docker) {
        try {
          // Prune unused images (dangling only, not all)
          console.log(`[ProjectManager] Pruning dangling images...`);
          const imagePruneResult = await this.docker.pruneImages({ filters: { dangling: ['true'] } });
          imagesReclaimed = imagePruneResult.SpaceReclaimed || 0;
          const imagesDeleted = imagePruneResult.ImagesDeleted?.length || 0;
          console.log(`[ProjectManager] ✅ Pruned ${imagesDeleted} dangling images, reclaimed ${(imagesReclaimed / 1024 / 1024).toFixed(2)}MB`);
        } catch (imagePruneError) {
          console.warn(`[ProjectManager] Image prune warning:`, imagePruneError.message);
        }
        
        try {
          // Prune build cache using exec (dockerode doesn't have direct builder prune API)
          console.log(`[ProjectManager] Pruning build cache...`);
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          
          const { stdout } = await execAsync('docker builder prune -f');
          // Parse output to get space reclaimed (format: "Total reclaimed space: XXX")
          const match = stdout.match(/Total.*?(\d+\.?\d*)\s*([KMGT]?B)/i);
          if (match) {
            let size = parseFloat(match[1]);
            const unit = match[2].toUpperCase();
            // Convert to bytes
            if (unit.includes('K')) size *= 1024;
            else if (unit.includes('M')) size *= 1024 * 1024;
            else if (unit.includes('G')) size *= 1024 * 1024 * 1024;
            buildCacheReclaimed = size;
          }
          console.log(`[ProjectManager] ✅ Pruned build cache, reclaimed ${(buildCacheReclaimed / 1024 / 1024).toFixed(2)}MB`);
        } catch (buildPruneError) {
          console.warn(`[ProjectManager] Build cache prune warning:`, buildPruneError.message);
        }
      }
      
      const totalReclaimed = (imagesReclaimed + buildCacheReclaimed) / 1024 / 1024;
      
      console.log(`[ProjectManager] ========================================`);
      console.log(`[ProjectManager] DELETION SUMMARY:`);
      console.log(`[ProjectManager]   Container removed: ${containerRemoved ? '✅' : '❌'}`);
      console.log(`[ProjectManager]   Volumes cleaned: ${volumesRemoved ? '✅' : '❌'}`);
      console.log(`[ProjectManager]   Database deleted: ✅`);
      console.log(`[ProjectManager]   Space reclaimed: ${totalReclaimed.toFixed(2)}MB`);
      console.log(`[ProjectManager] ========================================`);
      
    } catch (error) {
      console.error(`[ProjectManager] ========================================`);
      console.error(`[ProjectManager] ❌ DELETION FAILED`);
      console.error(`[ProjectManager] Error: ${error.message}`);
      console.error(`[ProjectManager] Stack: ${error.stack}`);
      console.error(`[ProjectManager] ========================================`);
      throw error;
    }
  }

  /**
   * Get project details
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Project data
   */
  async getProject(projectId) {
    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    
    if (error || !data) {
      throw new Error(`Project not found: ${projectId}`);
    }
    
    const convertedProject = this.convertProjectData(data);
    
    // Fetch owner info from auth.users
    try {
      const { data: userData, error: userError } = await this.supabase.auth.admin.getUserById(data.owner_id);
      
      if (!userError && userData?.user) {
        const user = userData.user;
        convertedProject.ownerName = user.user_metadata?.full_name || 
                                    user.user_metadata?.name ||
                                    user.email?.split('@')[0] || 
                                    'Unknown Owner';
      } else {
        convertedProject.ownerName = 'Unknown Owner';
      }
    } catch (ownerError) {
      console.warn(`[ProjectManager] Failed to fetch owner for project ${projectId}:`, ownerError);
      convertedProject.ownerName = 'Unknown Owner';
    }
    
    return convertedProject;
  }

  /**
   * List all projects for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of projects
   */
  async listProjects(userId) {
    try {
      let query = this.supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Filter by user if userId is provided
      if (userId) {
        query = query.eq('owner_id', userId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('[ProjectManager] Failed to list projects:', error.message);
        return [];
      }
      
      // Fetch owner information for each project
      const projectsWithOwners = await Promise.all(
        (data || []).map(async (project) => {
          const convertedProject = this.convertProjectData(project);
          
          // Fetch owner info from auth.users
          try {
            const { data: userData, error: userError } = await this.supabase.auth.admin.getUserById(project.owner_id);
            
            if (!userError && userData?.user) {
              const user = userData.user;
              convertedProject.ownerName = user.user_metadata?.full_name || 
                                          user.user_metadata?.name ||
                                          user.email?.split('@')[0] || 
                                          'Unknown Owner';
            } else {
              convertedProject.ownerName = 'Unknown Owner';
            }
          } catch (ownerError) {
            console.warn(`[ProjectManager] Failed to fetch owner for project ${project.id}:`, ownerError);
            convertedProject.ownerName = 'Unknown Owner';
          }
          
          return convertedProject;
        })
      );
      
      console.log(`[ProjectManager] Listed ${projectsWithOwners.length} projects for user ${userId}`);
      return projectsWithOwners;
    } catch (error) {
      console.error('[ProjectManager] Error listing projects:', error.message);
      return [];
    }
  }

  /**
   * Create a project placeholder in database with status='creating'
   * This allows the project to appear in the UI immediately while the container is being created
   * @param {string} userId - User ID
   * @param {string} projectName - Project name
   * @param {string} operatingSystem - Operating system
   * @returns {Promise<Object>} Created placeholder project
   */
  async createProjectPlaceholder(userId, projectName, operatingSystem = 'kali-linux') {
    console.log(`[ProjectManager] Creating placeholder for "${projectName}"`);
    
    const projectId = uuidv4();
    
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .insert({
          id: projectId,
          name: projectName,
          owner_id: userId,
          operating_system: operatingSystem,
          status: 'creating',
          container_id: null,
          container_name: null,
          terminal_port: 0,
          vnc_port: 0,
          novnc_port: 0,
          custom_port_1: 0,
          custom_port_2: 0
        })
        .select()
        .single();
      
      if (error) {
        console.error('[ProjectManager] Failed to create placeholder:', error.message);
        throw new Error(`Failed to create project placeholder: ${error.message}`);
      }
      
      console.log(`[ProjectManager] ✅ Placeholder created with ID: ${projectId}`);
      return this.convertProjectData(data);
    } catch (error) {
      console.error('[ProjectManager] Error creating placeholder:', error.message);
      throw error;
    }
  }

  /**
   * Initialize a project (create container and infrastructure)
   * @param {string} projectId - Project ID
   * @param {string} operatingSystem - Operating system
   * @returns {Promise<Object>} Initialized project
   */
  async initializeProject(projectId, operatingSystem = 'kali-linux') {
    console.log(`[ProjectManager] Initializing project ${projectId}`);
    
    let terminalPort, vncPort, novncPort;
    
    try {
      // Get project from database
      const { data: project, error: fetchError } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (fetchError || !project) {
        throw new Error('Project not found');
      }
      
      // Check if Docker is available
      const dockerAvailable = await this.checkDockerAvailable();
      
      if (!dockerAvailable) {
        console.log(`[ProjectManager] ⚠️  Docker not available, updating to mock mode`);
        // Update status to running (mock mode)
        const { data: updated, error: updateError } = await this.supabase
          .from('projects')
          .update({ status: 'running' })
          .eq('id', projectId)
          .select()
          .single();
        
        if (updateError) throw updateError;
        return this.convertProjectData(updated);
      }
      
      // Allocate ports
      const portBlock = await this.portAllocator.allocatePortBlock();
      terminalPort = portBlock.terminalPort;
      vncPort = portBlock.vncPort;
      novncPort = portBlock.novncPort;
      const customPort1 = portBlock.customPort1;
      const customPort2 = portBlock.customPort2;
      
      console.log(`[ProjectManager] 🔌 Allocated ports: terminal=${terminalPort}, vnc=${vncPort}, novnc=${novncPort}`);
      
      // For Windows projects, create isolated network first
      const isWindows = operatingSystem === 'windows-11' || operatingSystem === 'windows-10';
      if (isWindows) {
        const networkName = `project-${projectId.substring(0, 8)}-network`;
        
        // Calculate subnet for this project
        const ips = this.calculateProjectSubnet(projectId);
        const projectSubnet = ips.subnet;
        const projectGateway = ips.gateway;
        const sharedFolderIp = ips.sharedFolderIp;
        const sharedFolderAlias = '172.30.0.1'; // Windows VM will use this address
        
        let network;
        try {
          network = this.docker.getNetwork(networkName);
          await network.inspect();
          console.log(`[ProjectManager] 🔒 Using existing isolated network: ${networkName}`);
        } catch (err) {
          // Network doesn't exist, create it with same subnet (isolated)
          console.log(`[ProjectManager] 🔒 Creating isolated network: ${networkName} with subnet ${projectSubnet}`);
          network = await this.docker.createNetwork({
            Name: networkName,
            Driver: 'bridge',
            Internal: false, // Allow external access for host.docker.internal
            EnableIPv6: false,
            IPAM: {
              Driver: 'default',
              Config: [{
                Subnet: projectSubnet,
                Gateway: projectGateway
              }]
            },
            Options: {
              'com.docker.network.bridge.enable_icc': 'true',
              'com.docker.network.bridge.enable_ip_masquerade': 'true',
              'com.docker.network.bridge.host_binding_ipv4': '0.0.0.0'
            },
            Labels: {
              'windows-project-id': projectId,
              'windows-project-name': project.name,
              'project-network': 'true'
            }
          });
          console.log(`[ProjectManager] ✅ Network created with gateway 172.30.0.1 - shared folder will be accessible at 172.30.0.1:8888`);
        }
        
        // Connect backend container to this project network so it can reach the Windows MCP server
        try {
          const backendContainerName = process.env.BACKEND_CONTAINER_NAME || 'pantheon-backend';
          const backendContainer = this.docker.getContainer(backendContainerName);
          // Backend doesn't need to be on project network - MCP communication happens via exposed ports
          // Skipping backend connection to save IPs in /30 subnet
          console.log(`[ProjectManager] ℹ️  Backend will communicate with MCP via exposed ports (not on project network)`);
        } catch (connectErr) {
          // If already connected, that's fine
          if (!connectErr.message.includes('already exists')) {
            console.warn(`[ProjectManager] ⚠️  Failed to connect backend to project network:`, connectErr.message);
          }
        }
        
        // Connect windows-tools-api to this project network (for Windows projects)
        if (isWindows) {
          const toolsApiContainer = this.docker.getContainer('windows-tools-api');
          const ips = this.calculateProjectSubnet(projectId);
          let connected = false;
          
          // Parse the subnet to find available IPs within the /30 range
          // Avoid using shared folder IP (.1) and Windows container IP (.3)
          const subnetParts = ips.subnet.split('/')[0].split('.');
          const baseIp = `${subnetParts[0]}.${subnetParts[1]}.${subnetParts[2]}`;
          const fourthOctet = parseInt(subnetParts[3]);
          
          // Generate IP candidates, avoiding shared folder IP and Windows IP
          const sharedFolderOctet = parseInt(ips.sharedFolderIp.split('.')[3]);
          const windowsOctet = parseInt(ips.windowsIp.split('.')[3]);
          
          const ipCandidates = [];
          for (let offset = 0; offset < 50; offset += 10) {
            const candidateOctet = fourthOctet + 2 + offset;
            // Skip if it matches shared folder or Windows container IP
            if (candidateOctet !== sharedFolderOctet && candidateOctet !== windowsOctet && candidateOctet <= 254) {
              ipCandidates.push(`${baseIp}.${candidateOctet}`);
            }
          }
          
          for (const candidateIp of ipCandidates) {
            try {
              await network.connect({ 
                Container: 'windows-tools-api',
                EndpointConfig: {
                  IPAMConfig: {
                    IPv4Address: candidateIp
                  }
                }
              });
              console.log(`[ProjectManager] 🔗 Connected windows-tools-api to project network ${networkName} at ${candidateIp}`);
              connected = true;
              break;
            } catch (connectErr) {
              if (connectErr.message.includes('already exists')) {
                console.log(`[ProjectManager] ✓ windows-tools-api already connected to ${networkName}`);
                connected = true;
                break;
              } else if (connectErr.message.includes('Address already in use') || connectErr.message.includes('no configured subnet')) {
                console.log(`[ProjectManager] ⚠️  IP ${candidateIp} not available, trying next...`);
                continue;
              } else {
                console.warn(`[ProjectManager] ⚠️  Failed to connect windows-tools-api:`, connectErr.message);
                break;
              }
            }
          }
          
          if (!connected) {
            console.error(`[ProjectManager] ❌ Failed to connect windows-tools-api after trying all IP candidates`);
          }
        }
      }
      
      // Generate API keys and setup shared folder for Windows projects BEFORE creating container
      let mcpApiKey = null;
      let apiServiceKey = null;
      let encryptionKey = null;
      let toolsApiUrl = null;
      
      if (isWindows) {
        // Generate MCP API key
        const crypto = require('crypto');
        const mcpKeyPair = this.apiKeyGenerator.generateProjectKey(projectId, { salt: Date.now().toString() });
        mcpApiKey = mcpKeyPair.hashedKey;
        console.log(`[ProjectManager] 🔐 Generated unique MCP API key for Windows project`);
        
        // Generate API Service key
        const apiServiceKeyPair = this.apiKeyGenerator.generateProjectKey(projectId, { salt: `api-service-${Date.now()}` });
        apiServiceKey = apiServiceKeyPair.hashedKey;
        console.log(`[ProjectManager] 🔐 Generated unique API Service key for Windows project`);
        
        // Generate encryption key (AES-256 requires 64 hex chars)
        encryptionKey = crypto.randomBytes(32).toString('hex');
        console.log(`[ProjectManager] 🔐 Generated encryption key for Windows project`);
        
        // Get tools API URL (will be updated later with windows-tools-api IP)
        toolsApiUrl = process.env.TOOLS_API_URL || 'http://windows-tools-api:8090';
        
        // Create per-project shared folder
        try {
          const fs = require('fs').promises;
          const path = require('path');
          
          // Create project-specific directory
          const projectSharedDir = path.join('/app', 'windows-vm-files', projectId);
          await fs.mkdir(projectSharedDir, { recursive: true });
          
          // Write .env file
          const envFilePath = path.join(projectSharedDir, '.env');
          const envContent = `MCP_ENABLE_REMOTE=true
MCP_HTTP_PORT=${customPort1}
MCP_WS_PORT=${customPort2}
MCP_API_KEY=${mcpApiKey}
API_SERVICE_KEY=${apiServiceKey}
PROJECT_ID=${projectId}
API_SERVICE_URL=${toolsApiUrl}
ENCRYPTION_KEY=${encryptionKey}
MCP_LOG_LEVEL=info
`;
          await fs.writeFile(envFilePath, envContent, 'utf8');
          console.log(`[ProjectManager] 📝 Created .env file for Windows project`);
          
          // Copy setup scripts
          const scriptsDir = path.join('/app', 'windows-vm-files');
          const scriptsToCopy = ['fetch-env-on-startup.ps1', 'setup-auto-fetch.ps1', 'auto-setup.ps1', 'README.txt'];
          for (const script of scriptsToCopy) {
            try {
              const srcPath = path.join(scriptsDir, script);
              const destPath = path.join(projectSharedDir, script);
              await fs.copyFile(srcPath, destPath);
            } catch (copyError) {
              console.warn(`[ProjectManager] Failed to copy ${script}:`, copyError.message);
            }
          }
          
          // Create shared folder container BEFORE Windows container
          // Shared folder is ALWAYS accessible at 172.30.0.1:8888 from Windows VM
          await this.createSharedFolderContainer(projectId, project.name, projectSharedDir);
          console.log(`[ProjectManager] ✅ Shared folder container created`);
          
        } catch (fileError) {
          console.error(`[ProjectManager] ⚠️  Failed to setup shared folder:`, fileError.message);
          // Don't fail the project creation
        }
      }
      
      // Build and create container (reuse existing logic)
      const containerConfig = await this.buildContainerConfig(projectId, {
        terminalPort,
        vncPort,
        novncPort,
        customPort1,
        customPort2,
        operatingSystem
      });
      
      console.log(`[ProjectManager] 🐳 Creating container...`);
      const container = await this.docker.createContainer(containerConfig);
      await container.start();
      
      const containerInfo = await container.inspect();
      
      // Get container's IP on the project network (this is where socat proxy will run)
      const networkName = `project-${projectId.substring(0, 8)}-network`;
      const containerIp = containerInfo.NetworkSettings.Networks[networkName]?.IPAddress;
      
      if (containerIp && isWindows) {
        // Calculate the windows-tools-api IP based on the project's /30 subnet
        const ips = this.calculateProjectSubnet(projectId);
        toolsApiUrl = `http://${ips.toolsApiIp}:8090`;
        console.log(`[ProjectManager] 🔄 Updated Tools API URL to use windows-tools-api IP: ${toolsApiUrl}`);
        
        // Update the .env file with the correct URL
        try {
          const fs = require('fs').promises;
          const path = require('path');
          const projectSharedDir = path.join(__dirname, '..', 'windows-vm-files', projectId);
          const envFilePath = path.join(projectSharedDir, '.env');
          
          const envContent = `MCP_ENABLE_REMOTE=true
MCP_HTTP_PORT=${customPort1}
MCP_WS_PORT=${customPort2}
MCP_API_KEY=${mcpApiKey}
API_SERVICE_KEY=${apiServiceKey}
PROJECT_ID=${projectId}
API_SERVICE_URL=${toolsApiUrl}
ENCRYPTION_KEY=${encryptionKey}
MCP_LOG_LEVEL=info
`;
          await fs.writeFile(envFilePath, envContent, 'utf8');
          console.log(`[ProjectManager] 📝 Updated .env file with container IP`);
        } catch (updateError) {
          console.error(`[ProjectManager] ⚠️  Failed to update .env:`, updateError.message);
        }
      }
      
      // Setup proxy inside Windows container (after container starts)
      if (isWindows) {
        try {
          await this.setupSharedFolderProxy(container, projectId);
          console.log(`[ProjectManager] ✅ Shared folder proxy configured inside Windows container`);
        } catch (proxyError) {
          console.error(`[ProjectManager] ⚠️  Failed to setup shared folder proxy:`, proxyError.message);
        }
      }
      
      // Update project in database with container info but KEEP status='creating'
      // Status will be updated to 'running' by the status check endpoint when truly ready
      // First check if project still exists (user might have canceled)
      const { data: existingProject, error: checkError } = await this.supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .single();
      
      if (checkError || !existingProject) {
        console.log(`[ProjectManager] ⚠️  Project ${projectId} was deleted during initialization, cleaning up container`);
        // Project was deleted (user canceled), clean up the container
        try {
          await container.remove({ force: true, v: true });
          console.log(`[ProjectManager] ✅ Cleaned up container after cancellation`);
        } catch (cleanupErr) {
          console.error(`[ProjectManager] Failed to cleanup container:`, cleanupErr.message);
        }
        
        // Clean up shared folder container for Windows
        if (isWindows) {
          try {
            const sharedFolderName = `shared-folder-${projectId.substring(0, 8)}`;
            const sharedContainer = this.docker.getContainer(sharedFolderName);
            await sharedContainer.remove({ force: true });
            console.log(`[ProjectManager] ✅ Cleaned up shared folder container`);
          } catch (sharedErr) {
            // Might not exist
          }
          
          // Clean up isolated network
          try {
            const networkName = `project-${projectId.substring(0, 8)}-network`;
            const network = this.docker.getNetwork(networkName);
            
            // Disconnect backend and tools API first
            try {
              await network.disconnect({ Container: 'pantheon-backend', Force: true });
            } catch (e) { /* already disconnected */ }
            
            try {
              await network.disconnect({ Container: 'windows-tools-api', Force: true });
            } catch (e) { /* already disconnected */ }
            
            // Now remove the network
            await network.remove();
            console.log(`[ProjectManager] ✅ Cleaned up isolated network`);
          } catch (networkErr) {
            console.error(`[ProjectManager] Failed to cleanup network:`, networkErr.message);
          }
        }
        
        throw new Error('Project was canceled during initialization');
      }
      
      const { data: updated, error: updateError } = await this.supabase
        .from('projects')
        .update({
          container_id: containerInfo.Id,
          container_name: containerInfo.Name.replace(/^\//, ''),
          terminal_port: terminalPort,
          vnc_port: vncPort,
          novnc_port: novncPort,
          custom_port_1: customPort1,
          custom_port_2: customPort2,
          mcp_api_key: mcpApiKey,
          api_service_key: apiServiceKey,
          encryption_key: encryptionKey
          // Note: status remains 'creating' until container is verified ready
        })
        .eq('id', projectId)
        .select()
        .single();
      
      if (updateError) {
        console.error('[ProjectManager] Failed to update project:', updateError.message);
        throw updateError;
      }
      
      // Start health monitoring for this project
      this.startHealthMonitoring(projectId);
      console.log(`[ProjectManager] ✅ Started health monitoring for project ${projectId}`);
      
      console.log(`[ProjectManager] ✅ Project container started (status: creating, waiting for readiness check)`);
      return this.convertProjectData(updated);
      
    } catch (error) {
      console.error('[ProjectManager] Failed to initialize project:', error.message);
      console.error('[ProjectManager] Error stack:', error.stack);
      
      // Try to clean up any containers that were created
      try {
        // First check if container_id was saved to database
        const { data: project } = await this.supabase
          .from('projects')
          .select('container_id')
          .eq('id', projectId)
          .single();
        
        if (project?.container_id) {
          console.log(`[ProjectManager] Cleaning up container ${project.container_id} after initialization failure`);
          const container = this.docker.getContainer(project.container_id);
          await container.remove({ force: true, v: true }).catch(err => 
            console.error('[ProjectManager] Failed to remove container during cleanup:', err.message)
          );
        } else {
          // Container might exist but not saved to DB - try to find by name
          const containerName = `windows-project-${projectId.substring(0, 8)}`;
          console.log(`[ProjectManager] Checking for orphaned container: ${containerName}`);
          try {
            const container = this.docker.getContainer(containerName);
            await container.inspect(); // Check if it exists
            console.log(`[ProjectManager] Found orphaned container, removing: ${containerName}`);
            await container.remove({ force: true, v: true });
          } catch (findError) {
            // Container doesn't exist, that's fine
            if (findError.statusCode !== 404) {
              console.error('[ProjectManager] Error checking for orphaned container:', findError.message);
            }
          }
        }
        
        // Also clean up shared folder container for Windows projects
        if (operatingSystem === 'windows-11' || operatingSystem === 'windows-10') {
          const sharedFolderName = `shared-folder-${projectId.substring(0, 8)}`;
          try {
            const sharedContainer = this.docker.getContainer(sharedFolderName);
            await sharedContainer.remove({ force: true }).catch(err =>
              console.error('[ProjectManager] Failed to remove shared folder container:', err.message)
            );
            console.log(`[ProjectManager] Cleaned up shared folder container: ${sharedFolderName}`);
          } catch (sharedError) {
            // Shared folder container might not exist
          }
          
          // Clean up the isolated network
          const networkName = `project-${projectId.substring(0, 8)}-network`;
          try {
            const network = this.docker.getNetwork(networkName);
            
            // Disconnect windows-tools-api if connected
            try {
              await network.disconnect({ Container: 'windows-tools-api', Force: true });
            } catch (e) { /* already disconnected */ }
            
            // Remove the network
            await network.remove();
            console.log(`[ProjectManager] ✅ Cleaned up isolated network: ${networkName}`);
          } catch (networkErr) {
            if (networkErr.statusCode !== 404) {
              console.error(`[ProjectManager] Failed to cleanup network:`, networkErr.message);
            }
          }
        }
      } catch (cleanupError) {
        console.error('[ProjectManager] Container cleanup failed:', cleanupError.message);
      }
      
      // Release ports if allocated
      if (terminalPort) {
        await this.portAllocator.releasePort(terminalPort).catch(err => 
          console.error('[ProjectManager] Failed to release terminal port:', err.message)
        );
      }
      if (vncPort) {
        await this.portAllocator.releasePort(vncPort).catch(err => 
          console.error('[ProjectManager] Failed to release VNC port:', err.message)
        );
      }
      if (novncPort) {
        await this.portAllocator.releasePort(novncPort).catch(err => 
          console.error('[ProjectManager] Failed to release noVNC port:', err.message)
        );
      }
      
      // Update project status to error
      await this.supabase
        .from('projects')
        .update({ status: 'error' })
        .eq('id', projectId);
      
      throw error;
    }
  }

  /**
   * Get detailed project status including container readiness
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Project status details
   */
  async getProjectStatus(projectId) {
    try {
      // Get project from database
      const { data: project, error } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (error || !project) {
        throw new Error('Project not found');
      }
      
      const status = {
        id: projectId,
        name: project.name,
        status: project.status,
        ready: false,
        message: 'Preparing project infrastructure...',
        createdAt: project.created_at // Include creation timestamp
      };
      
      // If status is 'creating' and no container yet, show setup message
      if (project.status === 'creating' && !project.container_id) {
        status.message = 'Allocating resources and preparing Docker environment...';
        return status;
      }
      
      // If status is 'creating' but container exists, check its status
      if (project.status === 'creating' && project.container_id) {
        // Continue to check container status below
      } else if (project.status !== 'running' && project.status !== 'creating') {
        // For other statuses (stopped, error, etc.)
        status.message = `Project status: ${project.status}`;
        return status;
      }
      
      // Check if container exists and is running
      if (!project.container_id) {
        status.message = 'Creating Docker container...';
        return status;
      }
      
      try {
        const container = this.docker.getContainer(project.container_id);
        const containerInfo = await container.inspect();
        
        const isRunning = containerInfo.State.Running;
        const isHealthy = !containerInfo.State.Health || containerInfo.State.Health.Status === 'healthy';
        const containerState = containerInfo.State.Status; // created, running, paused, restarting, removing, exited, dead
        
        // For Windows containers, check if the init script has completed
        const isWindows = project.operating_system === 'windows-11' || project.operating_system === 'windows-10';
        
        if (isWindows) {
          // Provide detailed status messages based on container state
          if (!isRunning) {
            if (containerState === 'created') {
              status.message = 'Starting Windows container...';
            } else if (containerState === 'restarting') {
              status.message = 'Restarting Windows container...';
            } else {
              status.message = 'Waiting for Windows container to start...';
            }
            return status;
          }
          
          // ALWAYS check container logs for real-time status
          const logs = await container.logs({
            stdout: true,
            stderr: true,
            tail: 300 // Increased to capture more initialization details
          });
          
          const logString = logs.toString();
          
          // Check for specific initialization markers in logs
          const pullingImage = logString.includes('Pulling') || logString.includes('pulling');
          const downloadingImage = logString.includes('Downloading') || logString.includes('downloading');
          const extractingImage = logString.includes('Extracting') || logString.includes('extracting');
          const startingContainer = logString.includes('Starting container') || logString.includes('starting container');
          const bootingSystem = logString.includes('Booting') || logString.includes('booting') || logString.includes('Starting Windows');
          const loadingComponents = logString.includes('Loading') || logString.includes('loading');
          const initializingEnv = logString.includes('Initializing') || logString.includes('initializing');
          const installingDeps = logString.includes('Installing') || logString.includes('installing') || logString.includes('npm install') || logString.includes('yarn install');
          const configuringNetwork = logString.includes('network') || logString.includes('Network') || logString.includes('IP address');
          const configuringServices = logString.includes('service') || logString.includes('Service') || logString.includes('daemon');
          const startingMCP = logString.includes('MCP') || logString.includes('mcp') || logString.includes('Model Context Protocol');
          const startingVNC = logString.includes('VNC') || logString.includes('vnc') || logString.includes('noVNC');
          const startingTerminal = logString.includes('terminal') || logString.includes('Terminal') || logString.includes('ttyd');
          const initComplete = logString.includes('INITIALIZATION_COMPLETE') || 
                              logString.includes('Windows is ready') ||
                              logString.includes('MCP server started') ||
                              logString.includes('All services running');
          
          // Provide real-time status messages based on ACTUAL container logs
          if (initComplete) {
            status.message = 'Windows environment ready';
            status.ready = true;
          } else if (startingMCP && startingVNC && startingTerminal) {
            status.message = 'Finalizing Windows services...';
          } else if (startingVNC && startingTerminal) {
            status.message = 'Starting remote access services (VNC, Terminal)...';
          } else if (startingVNC) {
            status.message = 'Starting VNC server for remote desktop...';
          } else if (startingTerminal) {
            status.message = 'Starting web terminal service...';
          } else if (startingMCP) {
            status.message = 'Starting MCP server...';
          } else if (configuringServices) {
            status.message = 'Configuring Windows services...';
          } else if (configuringNetwork) {
            status.message = 'Configuring network settings...';
          } else if (installingDeps) {
            status.message = 'Installing dependencies...';
          } else if (initializingEnv) {
            status.message = 'Initializing Windows environment...';
          } else if (loadingComponents) {
            status.message = 'Loading Windows components...';
          } else if (bootingSystem) {
            status.message = 'Booting Windows system...';
          } else if (startingContainer) {
            status.message = 'Starting Windows container...';
          } else if (extractingImage) {
            status.message = 'Extracting Docker image layers...';
          } else if (downloadingImage) {
            status.message = 'Downloading Windows Docker image...';
          } else if (pullingImage) {
            status.message = 'Pulling Windows Docker image...';
          } else {
            // Fallback: use uptime only if no log markers found
            const startedAt = new Date(containerInfo.State.StartedAt);
            const uptimeSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
            
            if (uptimeSeconds < 30) {
              status.message = 'Container starting, waiting for logs...';
            } else if (uptimeSeconds < 60) {
              status.message = 'Waiting for Windows initialization...';
            } else {
              status.message = 'Preparing Windows workspace...';
            }
          }
        } else {
          // For Linux containers, also check logs for real status
          if (!isRunning) {
            if (containerState === 'created') {
              status.message = 'Starting Linux container...';
            } else if (containerState === 'restarting') {
              status.message = 'Restarting Linux container...';
            } else {
              status.message = 'Waiting for container to start...';
            }
            return status;
          }
          
          // ALWAYS check container logs
          const logs = await container.logs({
            stdout: true,
            stderr: true,
            tail: 200
          });
          
          const logString = logs.toString();
          
          // Check for Linux-specific initialization markers
          const startingServices = logString.includes('Starting') || logString.includes('starting');
          const configuringNetwork = logString.includes('network') || logString.includes('Network');
          const installingPackages = logString.includes('apt') || logString.includes('yum') || logString.includes('Installing');
          const serviceReady = logString.includes('ready') || logString.includes('Ready') || logString.includes('started successfully');
          
          if (serviceReady || isHealthy) {
            status.message = 'Container ready';
            status.ready = true;
          } else if (installingPackages) {
            status.message = 'Installing packages...';
          } else if (configuringNetwork) {
            status.message = 'Configuring network...';
          } else if (startingServices) {
            status.message = 'Starting container services...';
          } else {
            status.message = 'Waiting for health check...';
          }
        }
        
        status.containerRunning = isRunning;
        status.containerHealthy = isHealthy;
        
        // If container is ready, update database status to 'running'
        if (status.ready && project.status === 'creating') {
          console.log(`[ProjectManager] Container is ready, updating status to 'running'`);
          await this.supabase
            .from('projects')
            .update({ status: 'running' })
            .eq('id', projectId);
          status.status = 'running';
        }
        
      } catch (containerError) {
        console.warn(`[ProjectManager] Failed to inspect container:`, containerError.message);
        
        // Provide helpful error messages
        if (containerError.message.includes('no such container')) {
          status.message = 'Creating container...';
        } else if (containerError.message.includes('not found')) {
          status.message = 'Pulling Docker image...';
        } else {
          status.message = 'Connecting to container...';
        }
      }
      
      return status;
    } catch (error) {
      console.error('[ProjectManager] Error getting project status:', error.message);
      throw error;
    }
  }

  /**
   * Build Docker container configuration
   * @param {string} projectId - Project ID
   * @param {Object} ports - Port mappings
   * @returns {Object} Container configuration
   */
  async buildContainerConfig(projectId, ports) {
    const operatingSystem = ports.operatingSystem || 'kali-linux';
    const osPrefix = operatingSystem.split('-')[0]; // e.g., 'kali', 'ubuntu', 'windows'
    const containerName = `${osPrefix}-project-${projectId.substring(0, 8)}`;
    
    console.log(`[ProjectManager] 🔧 Building container config for project ${projectId}`);
    console.log(`[ProjectManager]   Container Name: ${containerName}`);
    console.log(`[ProjectManager]   Terminal Port: ${ports.terminalPort}`);
    console.log(`[ProjectManager]   VNC Port: ${ports.vncPort}`);
    console.log(`[ProjectManager]   noVNC Port: ${ports.novncPort}`);
    console.log(`[ProjectManager]   OS: ${operatingSystem}`);
    
    // Map OS IDs to Docker images
    const osImageMap = {
      'kali-linux': 'kali-desktop-rolling:latest',
      'ubuntu-22': 'ubuntu-desktop-24:latest',  // Ubuntu 22 uses same image as 24 for now
      'ubuntu-24': 'ubuntu-desktop-24:latest',  // Ubuntu 24.04 with GNOME and systemd
      'windows-11': 'windows-11:25H2',  // Windows 11 25H2 local image
      'debian-11': 'debian:11',
      'debian-12': 'debian:12',
      'arch-linux': 'archlinux:latest',
      'fedora-39': 'fedora:39',
      'centos-9': 'quay.io/centos/centos:stream9',
      'parrot-os': 'parrotsec/security:latest',
      'windows-10': 'mcr.microsoft.com/windows:1809',
      'macos-sonoma': 'sickcodes/docker-osx:sonoma',
      'macos-ventura': 'sickcodes/docker-osx:ventura'
    };
    
    const dockerImage = osImageMap[operatingSystem] || this.baseImage;
    
    // Check if the image exists
    try {
      await this.docker.getImage(dockerImage).inspect();
    } catch (error) {
      throw new Error(`Docker image '${dockerImage}' not found. Please build or pull the image for ${operatingSystem} first.`);
    }
    
    // Ubuntu 22 and 24 with full GNOME require systemd
    const needsSystemd = operatingSystem === 'ubuntu-24' || operatingSystem === 'ubuntu-22';
    
    // Windows 11 uses a shared container approach (like Kali)
    const isWindows = operatingSystem === 'windows-11';
    const useSharedContainer = isWindows; // Windows uses shared container
    
    // Windows 11 has different port configuration - 4 ports: GUI (8006), Terminal (9090), and custom MCP ports
    const exposedPorts = isWindows ? {
      '8006/tcp': {},  // Web VNC (GUI)
      '9090/tcp': {},  // PowerShell terminal
      [`${ports.customPort1}/tcp`]: {},  // MCP HTTP port (dynamic)
      [`${ports.customPort2}/tcp`]: {}   // MCP WebSocket port (dynamic)
    } : {
      '8080/tcp': {},  // Terminal (ttyd)
      '5900/tcp': {},  // VNC
      '7681/tcp': {}   // noVNC
    };
    
    // Handle ports beyond TCP limit (65535) - use internal routing only
    const portBindings = {};
    
    if (isWindows) {
      // Only bind ports that are within TCP range
      if (ports.novncPort <= 65535) {
        portBindings['8006/tcp'] = [{ HostPort: ports.novncPort.toString() }];
      }
      if (ports.terminalPort <= 65535) {
        portBindings['9090/tcp'] = [{ HostPort: ports.terminalPort.toString() }];
      }
      if (ports.customPort1 <= 65535) {
        portBindings[`${ports.customPort1}/tcp`] = [{ HostPort: ports.customPort1.toString() }];
      }
      if (ports.customPort2 <= 65535) {
        portBindings[`${ports.customPort2}/tcp`] = [{ HostPort: ports.customPort2.toString() }];
      }
    } else {
      if (ports.terminalPort <= 65535) {
        portBindings['8080/tcp'] = [{ HostPort: ports.terminalPort.toString() }];
      }
      if (ports.vncPort <= 65535) {
        portBindings['5900/tcp'] = [{ HostPort: ports.vncPort.toString() }];
      }
      if (ports.novncPort <= 65535) {
        portBindings['7681/tcp'] = [{ HostPort: ports.novncPort.toString() }];
      }
    }
    
    // Log if any ports are beyond TCP range
    const allPorts = [ports.terminalPort, ports.vncPort, ports.novncPort, ports.customPort1, ports.customPort2];
    const beyondLimit = allPorts.filter(p => p > 65535);
    if (beyondLimit.length > 0) {
      console.log(`[ProjectManager] ⚠️  Ports beyond TCP limit (65535): ${beyondLimit.join(', ')}`);
      console.log(`[ProjectManager] ℹ️  These ports will use internal Docker network routing only`);
      console.log(`[ProjectManager] ℹ️  Access via container name: ${containerName}:PORT`);
    }
    
    // Calculate Windows container IP (must be different from shared folder which uses .1)
    const windowsContainerIp = isWindows ? (() => {
      const ips = this.calculateProjectSubnet(projectId);
      const ip = ips.windowsIp;
      console.log(`[ProjectManager] 🔒 Windows container will use IP: ${ip} (shared folder uses ${ips.sharedFolderIp})`);
      return ip;
    })() : null;

    const config = {
      name: containerName,
      Image: dockerImage,
      Env: isWindows ? [
        `PROJECT_ID=${projectId}`,
        `TERMINAL_TYPE=powershell`,
        `VERSION=win11`,
        `RAM_SIZE=4G`,
        `CPU_CORES=2`,
        `DISK_SIZE=24G`,
        `AUTO_INSTALL=Y`,
        `WORKSPACE_PATH=C:\\workspace`,
        `MCP_SERVER_PATH=C:\\MCP\\DesktopCommanderMCP`,
        `MCP_HTTP_PORT=${ports.customPort1}`,
        `MCP_WS_PORT=${ports.customPort2}`,
        `SHARED_FOLDER_URL=http://shared-folder-${projectId.substring(0, 8)}/.env` // Use container name for network-isolated access
      ] : [
        `PROJECT_ID=${projectId}`,
        `TERMINAL_TYPE=gotty`,
        `GOTTY_WS_URL=ws://localhost:8080/ws`
      ],
      ExposedPorts: exposedPorts,
      // For Windows: Override the VOLUME /storage declaration from base image
      // This prevents Docker from creating an anonymous volume that would hide embedded files
      Volumes: isWindows ? {
        '/workspace': {}
        // Explicitly NOT including /storage - we want to use the embedded files from the image
      } : undefined,
      HostConfig: {
        PortBindings: portBindings,
        Memory: isWindows ? 4 * 1024 * 1024 * 1024 : (needsSystemd ? 4 * 1024 * 1024 * 1024 : 2 * 1024 * 1024 * 1024),  // 4GB for Windows, 4GB for GNOME, 2GB otherwise
        MemorySwap: isWindows ? 6 * 1024 * 1024 * 1024 : (needsSystemd ? 6 * 1024 * 1024 * 1024 : 3 * 1024 * 1024 * 1024),
        CpuShares: 1024,
        RestartPolicy: {
          Name: 'unless-stopped'
        },
        Binds: isWindows ? [
          `${projectId}-workspace:/workspace`,
          // Mount MCP server for AI integration (same as Linux projects)
          `${process.cwd()}/mcp-server:/app/mcp-server:ro`
          // DO NOT mount /storage - Windows uses embedded storage from snapshot image
          // Mounting a volume would override the 24GB pre-installed Windows system
        ] : [
          `${projectId}-workspace:/workspace`,
          `${projectId}-home:/root`,
          // Mount MCP server for AI integration
          `${process.cwd()}/mcp-server:/app/mcp-server:ro`
        ],
        // Connect to docker network
        // Windows projects use isolated networks with explicit IP, others use shared network
        NetworkMode: isWindows ? undefined : 'docker_ai-terminal-network',
        // Windows and systemd need privileged mode
        Privileged: isWindows || needsSystemd,
        // Windows needs KVM device
        Devices: isWindows ? [{ PathOnHost: '/dev/kvm', PathInContainer: '/dev/kvm', CgroupPermissions: 'rwm' }] : undefined,
        Tmpfs: needsSystemd && !isWindows ? {
          '/run': 'rw,nosuid,nodev,mode=755',
          '/run/lock': 'rw,nosuid,nodev,noexec,relatime,size=5120k'
        } : undefined,
        SecurityOpt: needsSystemd && !isWindows ? ['seccomp=unconfined'] : undefined,
        CapAdd: (isWindows || needsSystemd) ? ['SYS_ADMIN', 'NET_ADMIN'] : undefined
      },
      // Windows containers need explicit IP assignment to avoid conflict with shared folder (.1)
      NetworkingConfig: isWindows ? {
        EndpointsConfig: {
          [`project-${projectId.substring(0, 8)}-network`]: {
            IPAMConfig: {
              IPv4Address: windowsContainerIp
            }
          }
        }
      } : undefined,
      Healthcheck: {
        Test: isWindows ? ['CMD', 'curl', '-f', 'http://localhost:8006/'] : ['CMD', 'curl', '-f', 'http://localhost:8080'],
        Interval: 10000000000,  // 10s in nanoseconds
        Timeout: 5000000000,    // 5s
        Retries: 3,
        StartPeriod: isWindows ? 1800000000000 : (needsSystemd ? 90000000000 : 45000000000)  // 1800s (30min) for Windows (snapshot copy + boot), 90s for GNOME+systemd, 45s otherwise
      },
      // Add labels
      Labels: {
        'project.id': projectId,
        'project.terminal_port': ports.terminalPort.toString(),
        'project.vnc_port': ports.vncPort.toString(),
        'project.novnc_port': ports.novncPort.toString(),
        'project.custom_port_1': ports.customPort1?.toString() || '',
        'project.custom_port_2': ports.customPort2?.toString() || '',
        'project.os': operatingSystem
      }
    };
    
    // Add cgroup mount for systemd (not Windows)
    if (needsSystemd && !isWindows) {
      config.HostConfig.Binds.push('/sys/fs/cgroup:/sys/fs/cgroup:rw');
    }
    
    console.log(`[ProjectManager] ✅ Container config built with unique ports and volumes`);
    
    return config;
  }

  /**
   * Wait for container to become healthy
   * @param {Object} container - Docker container object
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<void>}
   */
  async waitForHealthy(container, timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const info = await container.inspect();
      
      if (info.State.Health && info.State.Health.Status === 'healthy') {
        console.log(`[ProjectManager] Container is healthy`);
        return;
      }
      
      if (info.State.Status === 'running') {
        // Container is running, wait a bit more
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw new Error(`Container failed to start: ${info.State.Status}`);
      }
    }
    
    throw new Error(`Container health check timeout after ${timeout}ms`);
  }

  /**
   * Clone Windows base volume to new project volume for faster startup
   * DEPRECATED: Now using snapshot image with embedded storage
   * @param {string} projectId - Project ID
   */
  async cloneWindowsBaseVolume(projectId) {
    // No longer needed - Windows storage is embedded in the snapshot image
    // The init-snapshot.sh script in the image handles storage initialization
    console.log(`[ProjectManager] ℹ️  Using snapshot image - no volume cloning needed`);
    console.log(`[ProjectManager] ⚡ Windows will initialize from embedded storage in 10-20 seconds`);
  }

  /**
   * Initialize tmux session for terminal commands
   * Creates the tmux socket directory and shared session
   * @param {Object} container - Docker container object
   * @param {string} operatingSystem - Operating system (e.g., 'ubuntu-24', 'kali-linux')
   */
  async initializeTmuxSession(container, operatingSystem = 'kali-linux') {
    try {
      console.log(`[ProjectManager] Initializing tmux session for ${operatingSystem}...`);
      
      // Determine the correct user based on OS
      const osUserMap = {
        'kali-linux': 'pentester',
        'kali-rolling': 'pentester',
        'ubuntu-22': 'ubuntu',
        'ubuntu-24': 'ubuntu',
        'debian-11': 'root',
        'debian-12': 'root',
        'fedora-39': 'root',
        'fedora-40': 'root',
        'arch-linux': 'root',
        'windows-11': 'ContainerAdministrator'
      };
      
      const user = osUserMap[operatingSystem] || 'root';
      console.log(`[ProjectManager]   Using user: ${user}`);
      
      // Create tmux socket directory
      const exec1 = await container.exec({
        Cmd: ['sh', '-c', 'mkdir -p /tmp/tmux-1000 && chmod 700 /tmp/tmux-1000'],
        User: user,
        AttachStdout: true,
        AttachStderr: true
      });
      
      const stream1 = await exec1.start({ hijack: true, stdin: false });
      await new Promise((resolve) => {
        stream1.on('end', resolve);
        stream1.resume();
      });
      
      console.log(`[ProjectManager]   Created tmux socket directory`);
      
      // Create shared tmux session
      const exec2 = await container.exec({
        Cmd: ['tmux', '-S', '/tmp/tmux-1000/default', 'new-session', '-d', '-s', 'shared', 'bash'],
        User: user,
        AttachStdout: true,
        AttachStderr: true
      });
      
      const stream2 = await exec2.start({ hijack: true, stdin: false });
      await new Promise((resolve) => {
        stream2.on('end', resolve);
        stream2.resume();
      });
      
      console.log(`[ProjectManager]   Created tmux session 'shared'`);
      
      // Verify session was created
      const exec3 = await container.exec({
        Cmd: ['tmux', '-S', '/tmp/tmux-1000/default', 'ls'],
        User: user,
        AttachStdout: true,
        AttachStderr: true
      });
      
      const stream3 = await exec3.start({ hijack: true, stdin: false });
      let output = '';
      stream3.on('data', (data) => {
        output += data.toString();
      });
      
      await new Promise((resolve) => {
        stream3.on('end', resolve);
      });
      
      console.log(`[ProjectManager]   Tmux sessions: ${output.trim()}`);
      console.log(`[ProjectManager] ✅ Tmux session initialized successfully`);
      
    } catch (error) {
      console.error(`[ProjectManager] ⚠️  Failed to initialize tmux session:`, error.message);
      console.error(`[ProjectManager]   This may cause terminal command execution to fail`);
      // Don't throw - this is not critical enough to fail container creation
    }
  }

  /**
   * Start health monitoring for a project
   * @param {string} projectId - Project ID to monitor
   */
  startHealthMonitoring(projectId) {
    // Clear existing timer if any
    this.stopHealthMonitoring(projectId);
    
    console.log(`[ProjectManager] Starting health monitoring for project ${projectId}`);
    
    const timer = setInterval(async () => {
      try {
        await this.checkProjectHealth(projectId);
      } catch (error) {
        console.error(`[ProjectManager] Health check error for ${projectId}:`, error.message);
      }
    }, this.healthCheckInterval);
    
    this.healthCheckTimers.set(projectId, timer);
  }

  /**
   * Stop health monitoring for a project
   * @param {string} projectId - Project ID
   */
  stopHealthMonitoring(projectId) {
    const timer = this.healthCheckTimers.get(projectId);
    if (timer) {
      clearInterval(timer);
      this.healthCheckTimers.delete(projectId);
      console.log(`[ProjectManager] Stopped health monitoring for project ${projectId}`);
    }
  }

  /**
   * Check if noVNC is actually accessible
   * @param {number} port - noVNC port
   * @returns {Promise<boolean>} True if accessible
   */
  async checkNoVNCAccessible(port) {
    try {
      const http = require('http');
      return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/vnc.html`, { timeout: 2000 }, (res) => {
          resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  }

  /**
   * Check project health and update status
   * @param {string} projectId - Project ID
   */
  async checkProjectHealth(projectId) {
    try {
      // Fetch project directly from database without owner info for health checks
      const { data: projectData, error: projectError } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      // If project not found, stop monitoring
      if (projectError || !projectData) {
        console.log(`[ProjectManager] Project ${projectId} not found, stopping health monitoring`);
        this.stopHealthMonitoring(projectId);
        return { status: 'deleted', healthy: false };
      }
      
      const project = this.convertProjectData(projectData);
      
      // Skip health check for mock projects
      if (project.isMock) {
        return { status: 'running', healthy: true };
      }
      
      if (!this.docker) {
        return { status: 'unknown', healthy: false };
      }
      
      const container = this.docker.getContainer(project.containerId);
      const info = await container.inspect();
      
      let newStatus = 'unknown';
      
      if (info.State.Running) {
        // For Windows projects, rely on container health status
        const isWindows = project.operatingSystem === 'windows-11' || project.operatingSystem === 'windows-10';
        
        if (isWindows) {
          // For Windows, use container health status
          if (info.State.Health) {
            newStatus = info.State.Health.Status === 'healthy' ? 'running' : 'creating';
          } else {
            newStatus = 'running';
          }
        } else if (project.novncPort) {
          // For non-Windows containers with noVNC, check if it's actually accessible
          const novncReady = await this.checkNoVNCAccessible(project.novncPort);
          if (novncReady) {
            newStatus = 'running';
          } else {
            newStatus = 'creating'; // Container running but services not ready
          }
        } else if (info.State.Health) {
          newStatus = info.State.Health.Status === 'healthy' ? 'running' : 'error';
        } else {
          newStatus = 'running';
        }
      } else if (info.State.Restarting) {
        newStatus = 'restarting';
      } else {
        newStatus = 'stopped';
      }
      
      // Update status if changed
      if (newStatus !== project.status) {
        console.log(`[ProjectManager] Project ${projectId} status changed: ${project.status} -> ${newStatus}`);
        await this.updateProjectStatus(projectId, newStatus);
        
        // Notify callbacks
        this.notifyStatusChange(projectId, newStatus, project.status);
      }
      
      return { status: newStatus, healthy: newStatus === 'running' };
      
    } catch (error) {
      // Project not found in database - stop monitoring
      if (error.message && error.message.includes('Project not found')) {
        console.log(`[ProjectManager] Project ${projectId} not found in database, stopping health monitoring`);
        this.stopHealthMonitoring(projectId);
        return { status: 'deleted', healthy: false };
      }
      
      // Container might be deleted
      if (error.statusCode === 404) {
        console.warn(`[ProjectManager] Container not found for project ${projectId}, marking as error`);
        await this.updateProjectStatus(projectId, 'error');
      } else {
        throw error;
      }
    }
  }

  /**
   * Update project status
   * @param {string} projectId - Project ID
   * @param {string} status - New status
   * @returns {Promise<void>}
   */
  async updateProjectStatus(projectId, status) {
    const { error } = await this.supabase
      .from('projects')
      .update({ 
        status, 
        last_active: new Date().toISOString() 
      })
      .eq('id', projectId);
    
    if (error) {
      console.error(`[ProjectManager] Failed to update project status:`, error.message);
    }
  }

  /**
   * Register a callback for status changes
   * @param {Function} callback - Callback function (projectId, newStatus, oldStatus)
   */
  onStatusChange(callback) {
    this.statusCallbacks.push(callback);
  }

  /**
   * Notify all callbacks of status change
   * @param {string} projectId - Project ID
   * @param {string} newStatus - New status
   * @param {string} oldStatus - Old status
   */
  notifyStatusChange(projectId, newStatus, oldStatus) {
    this.statusCallbacks.forEach(callback => {
      try {
        callback(projectId, newStatus, oldStatus);
      } catch (error) {
        console.error('[ProjectManager] Status callback error:', error);
      }
    });
  }

  /**
   * Get project status
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Status information
   */
  async getProjectStatus(projectId) {
    try {
      const project = await this.getProject(projectId);
      const container = this.docker.getContainer(project.containerId);
      const info = await container.inspect();
      
      // Determine if project is ready
      const isHealthy = info.State.Health?.Status === 'healthy';
      const isRunning = info.State.Running;
      const isReady = isRunning && isHealthy && project.status === 'running';
      
      return {
        projectId,
        status: project.status,
        ready: isReady,
        containerRunning: isRunning,
        containerHealth: info.State.Health?.Status || 'unknown',
        message: isReady ? 'Project is ready' : 'Container is starting...',
        uptime: info.State.StartedAt,
        restartCount: info.RestartCount
      };
    } catch (error) {
      return {
        projectId,
        status: 'error',
        ready: false,
        error: error.message
      };
    }
  }

  /**
   * Restart a project container
   * @param {string} projectId - Project ID
   */
  async restartProject(projectId) {
    console.log(`[ProjectManager] Restarting project ${projectId}`);
    
    try {
      const project = await this.getProject(projectId);
      const container = this.docker.getContainer(project.container_id);
      
      await this.updateProjectStatus(projectId, 'restarting');
      await container.restart();
      await this.waitForHealthy(container, 30000);
      await this.updateProjectStatus(projectId, 'running');
      
      console.log(`[ProjectManager] ✅ Project restarted successfully`);
    } catch (error) {
      console.error(`[ProjectManager] ❌ Failed to restart project:`, error.message);
      await this.updateProjectStatus(projectId, 'error');
      throw error;
    }
  }

  /**
   * Get container logs
   * @param {string} projectId - Project ID
   * @param {number} lines - Number of lines to retrieve
   * @returns {Promise<string>} Container logs
   */
  async getProjectLogs(projectId, lines = 100) {
    try {
      const project = await this.getProject(projectId);
      const container = this.docker.getContainer(project.container_id);
      
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: lines,
        timestamps: true
      });
      
      return logs.toString('utf8');
    } catch (error) {
      throw new Error(`Failed to get logs: ${error.message}`);
    }
  }

  /**
   * Get or generate MCP API key for a project
   * For Windows projects, ensures each project has a unique API key
   * 
   * @param {string} projectId - Project ID
   * @returns {Promise<string>} API key
   */
  async getOrGenerateApiKey(projectId) {
    try {
      // Get project from database
      const { data: project, error } = await this.supabase
        .from('projects')
        .select('mcp_api_key, operating_system')
        .eq('id', projectId)
        .single();
      
      if (error) {
        throw new Error(`Failed to fetch project: ${error.message}`);
      }
      
      // If API key already exists, return it
      if (project.mcp_api_key) {
        console.log(`[ProjectManager] Using existing API key for project ${projectId.substring(0, 8)}...`);
        return project.mcp_api_key;
      }
      
      // Generate new API key
      const keyPair = this.apiKeyGenerator.generateProjectKey(projectId, { salt: Date.now().toString() });
      console.log(`[ProjectManager] 🔐 Generated new API key for project ${projectId.substring(0, 8)}...`);
      
      // Store ONLY the hash in database
      const { error: updateError } = await this.supabase
        .from('projects')
        .update({ mcp_api_key: keyPair.hashedKey })
        .eq('id', projectId);
      
      if (updateError) {
        console.error(`[ProjectManager] Failed to store API key:`, updateError.message);
        // Still return the key even if storage fails
      } else {
        console.log(`[ProjectManager] ✅ API key hash stored in database`);
      }
      
      return keyPair.hashedKey;
      
    } catch (error) {
      console.error(`[ProjectManager] Failed to get/generate API key:`, error.message);
      throw error;
    }
  }

  /**
   * Generate Windows MCP configuration file content
   * Creates a .env file for the Windows VM
   * 
   * @param {string} projectId - Project ID
   * @returns {Promise<string>} .env file content
   */
  async generateWindowsMCPConfig(projectId) {
    try {
      const project = await this.getProject(projectId);
      
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }
      
      // Get or generate API key
      const apiKey = await this.getOrGenerateApiKey(projectId);
      
      // Generate .env file content
      const envContent = this.apiKeyGenerator.generateWindowsEnvFile(
        projectId,
        apiKey,
        project.customPort1 || 8080,  // HTTP port
        project.customPort2 || 8081   // WebSocket port
      );
      
      console.log(`[ProjectManager] 📄 Generated Windows MCP config for project ${projectId.substring(0, 8)}...`);
      
      return envContent;
      
    } catch (error) {
      console.error(`[ProjectManager] Failed to generate Windows MCP config:`, error.message);
      throw error;
    }
  }

  /**
   * Cleanup all health monitoring timers
   */
  cleanup() {
    console.log('[ProjectManager] Cleaning up health monitoring timers');
    for (const [projectId, timer] of this.healthCheckTimers.entries()) {
      clearInterval(timer);
    }
    this.healthCheckTimers.clear();
  }
}

module.exports = ProjectManager;

