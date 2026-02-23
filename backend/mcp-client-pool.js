/**
 * MCP Client Pool
 * Manages multiple MCP clients for different containers
 */

const MCPClientManager = require('./mcp-client-manager');
const MultiMCPClient = require('./multi-mcp-client');
const WindowsMCPClient = require('./windows-mcp-client');
const WindowsAPIClient = require('./windows-api-client');
const { EventEmitter } = require('events');

class MCPClientPool extends EventEmitter {
  constructor(defaultOptions = {}) {
    super();
    this.clients = new Map(); // containerName → MCPClient
    this.windowsClients = new Map(); // projectId → WindowsMCPClient
    this.initializingClients = new Map(); // Track initialization promises
    this.projectManager = defaultOptions.projectManager; // Store projectManager instance
    this.defaultOptions = {
      serverPath: process.env.MCP_SERVER_PATH || '/app/mcp-server/tmux-writer.js',
      timeout: 30000,
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      env: {
        GOTTY_WS_URL: 'ws://localhost:8080/ws'
      },
      ...defaultOptions
    };
    
    console.log('🏊 MCP Client Pool initialized (with Windows support)');
  }

  /**
   * Get or create an MCP client for a specific container
   * @param {string} containerName - The container name
   * @param {string} operatingSystem - The operating system (e.g., 'ubuntu-24', 'kali-linux')
   * @returns {Promise<MultiMCPClient>} The Multi-MCP client
   */
  async getClient(containerName, operatingSystem = 'kali-linux') {
    // Normalize container name
    const normalizedName = containerName || process.env.MCP_CONTAINER_NAME || 'kali-pentest';
    
    // Return existing client if available and connected
    if (this.clients.has(normalizedName)) {
      const client = this.clients.get(normalizedName);
      if (client.isConnected()) {
        return client;
      } else {
        console.warn(`⚠️  Client for ${normalizedName} is disconnected, reinitializing...`);
        this.clients.delete(normalizedName);
      }
    }

    // Wait if client is being initialized
    if (this.initializingClients.has(normalizedName)) {
      console.log(`⏳ Waiting for ${normalizedName} client initialization...`);
      return await this.initializingClients.get(normalizedName);
    }

    // Initialize new client with OS information
    const initPromise = this._initializeClient(normalizedName, operatingSystem);
    this.initializingClients.set(normalizedName, initPromise);

    try {
      const client = await initPromise;
      this.clients.set(normalizedName, client);
      return client;
    } finally {
      this.initializingClients.delete(normalizedName);
    }
  }

  /**
   * Initialize a new MCP client for a container
   * @private
   */
  async _initializeClient(containerName, operatingSystem = 'kali-linux') {
    console.log(`🔌 Initializing Multi-MCP client for container: ${containerName}`);
    
    // Use MultiMCPClient to connect to multiple MCP servers with OS information
    const client = new MultiMCPClient(containerName, operatingSystem);

    try {
      await client.connect();
      console.log(`✅ Multi-MCP client ready for container: ${containerName}`);
      return client;
    } catch (error) {
      console.error(`❌ Failed to initialize Multi-MCP client for ${containerName}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if a client exists for a container
   */
  hasClient(containerName) {
    return this.clients.has(containerName);
  }

  /**
   * Get all active container names
   */
  getActiveContainers() {
    return Array.from(this.clients.keys());
  }

  /**
   * Remove a client from the pool
   */
  async removeClient(containerName) {
    if (this.clients.has(containerName)) {
      console.log(`🗑️  Removing MCP client for: ${containerName}`);
      const client = this.clients.get(containerName);
      await client.disconnect();
      this.clients.delete(containerName);
    }
  }

  /**
   * Shutdown all clients
   */
  async shutdown() {
    console.log('🛑 Shutting down MCP client pool...');
    
    for (const [containerName, client] of this.clients.entries()) {
      console.log(`   Shutting down client for: ${containerName}`);
      try {
        await client.disconnect();
      } catch (error) {
        console.error(`   Error shutting down ${containerName}:`, error.message);
      }
    }
    
    this.clients.clear();
    this.initializingClients.clear();
    console.log('✅ MCP client pool shut down');
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      activeClients: this.clients.size,
      initializingClients: this.initializingClients.size,
      containers: Array.from(this.clients.keys())
    };
  }

  /**
   * Get or create a Windows API client for a specific project
   * Uses Windows Tools API + Agent architecture
   * @param {string} projectId - The project ID
   * @param {string} apiServiceKey - The API service key
   * @param {string} agentApiKey - The agent API key
   * @returns {Promise<WindowsAPIClient>} The Windows API client
   */
  async getWindowsClient(projectId, apiServiceKey, agentApiKey) {
    console.log(`🪟 Getting Windows MCP client for project: ${projectId}`);
    
    // Return existing client if available and connected
    if (this.windowsClients.has(projectId)) {
      const client = this.windowsClients.get(projectId);
      if (client.isConnected()) {
        console.log(`✅ Reusing existing Windows MCP client for project: ${projectId}`);
        return client;
      } else {
        console.warn(`⚠️  Windows client for ${projectId} is disconnected, reinitializing...`);
        this.windowsClients.delete(projectId);
      }
    }

    // Get project info to find the Windows MCP HTTP port
    if (!this.projectManager) {
      throw new Error('ProjectManager instance not provided to MCPClientPool');
    }
    
    const project = await this.projectManager.getProject(projectId);
    
    if (!project || !project.customPort1) {
      throw new Error(`Project ${projectId} does not have a Windows MCP HTTP port configured`);
    }

    const mcpHttpPort = project.customPort1; // Windows projects use customPort1 for MCP HTTP
    
    // Backend should connect to the Windows MCP Client running inside the Windows VM
    // The client is accessible via the host-mapped port
    // Windows MCP Client listens on port 8080 inside the VM, mapped to customPort1 on host
    const mcpHttpHost = process.env.WINDOWS_MCP_HOST || 'host.docker.internal';
    const mcpHttpUrl = `http://${mcpHttpHost}:${mcpHttpPort}`; // Connect to Windows MCP Client via mapped port
    
    console.log(`🔗 Connecting to Windows MCP Client at: ${mcpHttpUrl}`);
    console.log(`   Project ID: ${projectId}`);
    console.log(`   MCP API Key: ${agentApiKey ? '***' + agentApiKey.slice(-8) : 'missing'}`);
    console.log(`   Note: Connecting to Windows MCP Client (not Tools API)`);
    
    // Use the existing WindowsMCPClient (HTTP-based)
    const WindowsMCPClient = require('./windows-mcp-client');
    const client = new WindowsMCPClient({
      projectId,
      baseUrl: mcpHttpUrl,
      apiKey: agentApiKey
    });

    // Test connection
    const connected = await client.connect();
    
    if (!connected) {
      throw new Error(`Failed to connect to Windows MCP HTTP server at ${mcpHttpUrl}`);
    }

    // Store client
    this.windowsClients.set(projectId, client);
    console.log(`✅ Windows MCP HTTP client created and connected for project: ${projectId}`);
    
    return client;
  }

  /**
   * Execute a Windows MCP tool
   * @param {string} projectId - The project ID
   * @param {string} toolName - The tool name (without 'windows_' prefix)
   * @param {object} args - Tool arguments
   * @returns {Promise<object>} Tool execution result
   */
  async executeWindowsTool(projectId, toolName, args = {}) {
    const client = this.windowsClients.get(projectId);
    
    if (!client) {
      throw new Error(`No Windows MCP client found for project: ${projectId}`);
    }

    if (!client.isConnected()) {
      throw new Error(`Windows MCP client for project ${projectId} is not connected`);
    }

    return await client.executeTool(toolName, args);
  }

  /**
   * Check if a Windows client exists for a project
   * @param {string} projectId - The project ID
   * @returns {boolean} True if client exists and is connected
   */
  hasWindowsClient(projectId) {
    const client = this.windowsClients.get(projectId);
    return client && client.isConnected();
  }
}

module.exports = MCPClientPool;
