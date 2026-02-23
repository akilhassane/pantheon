/**
 * Multi-MCP Client Manager
 * Manages connections to multiple MCP servers and aggregates their tools
 */

const MCPClientManager = require('./mcp-client-manager');
const fs = require('fs');
const path = require('path');

class MultiMCPClientManager {
  constructor(options = {}) {
    this.options = options;
    this.clients = new Map(); // serverName -> MCPClientManager
    this.serverConfigs = new Map(); // serverName -> config
    this.sessionManager = options.sessionManager || null;
  }

  /**
   * Load MCP server configurations from .kiro/settings/mcp.json
   */
  loadServerConfigs() {
    const configPath = path.join(process.cwd(), '.kiro', 'settings', 'mcp.json');
    
    try {
      console.log(`📂 Loading MCP configurations from: ${configPath}`);
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      if (!config.mcpServers) {
        console.warn('⚠️  No mcpServers found in configuration');
        return;
      }

      // Store server configurations
      for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
        if (serverConfig.disabled) {
          console.log(`⏭️  Skipping disabled server: ${serverName}`);
          continue;
        }

        this.serverConfigs.set(serverName, {
          name: serverName,
          ...serverConfig
        });
        console.log(`✅ Loaded configuration for: ${serverName}`);
      }

      console.log(`📋 Total servers configured: ${this.serverConfigs.size}`);
    } catch (error) {
      console.error(`❌ Failed to load MCP configurations: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize all configured MCP servers
   */
  async initializeAll() {
    console.log('🚀 Initializing all MCP servers...');
    
    // Load configurations
    this.loadServerConfigs();

    // Initialize each server
    const initPromises = [];
    for (const [serverName, config] of this.serverConfigs.entries()) {
      initPromises.push(this.initializeServer(serverName, config));
    }

    // Wait for all initializations (continue even if some fail)
    const results = await Promise.allSettled(initPromises);
    
    // Log results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`✅ MCP Server initialization complete: ${successful} successful, ${failed} failed`);
    console.log(`📊 Connected servers: ${Array.from(this.clients.keys()).join(', ')}`);
    
    return {
      successful,
      failed,
      total: this.serverConfigs.size
    };
  }

  /**
   * Initialize a single MCP server
   */
  async initializeServer(serverName, config) {
    try {
      console.log(`🔌 Initializing MCP server: ${serverName}`);
      console.log(`   Command: ${config.command} ${config.args?.join(' ') || ''}`);

      // Determine if this should run on host or in container
      // Check for explicit useContainer flag first, then fall back to command check
      console.log(`   useContainer flag: ${config.useContainer}`);
      const useHostProcess = config.useContainer === true ? false : (config.command === 'node' || config.command === 'npx');
      console.log(`   Computed useHostProcess: ${useHostProcess}`);
      
      // Build server path
      let serverPath;
      if (config.args && config.args.length > 0) {
        serverPath = config.args[0];
      } else {
        throw new Error(`No server path specified in args for ${serverName}`);
      }

      // Create MCP client options
      const clientOptions = {
        serverPath: serverPath,
        serverArgs: config.args?.slice(1) || [],
        containerName: this.options.containerName || 'kali-pentest',
        useHostProcess: useHostProcess,
        sessionManager: this.sessionManager,
        env: config.env || {},
        timeout: 30000,
        reconnectAttempts: 5,
        reconnectDelay: 1000
      };

      console.log(`   Host process: ${useHostProcess}`);
      console.log(`   Server path: ${serverPath}`);

      // Create and initialize client
      const client = new MCPClientManager(clientOptions);
      await client.initialize();

      // Store client
      this.clients.set(serverName, client);
      
      console.log(`✅ Successfully initialized: ${serverName}`);
      return { serverName, success: true };

    } catch (error) {
      console.error(`❌ Failed to initialize ${serverName}: ${error.message}`);
      return { serverName, success: false, error: error.message };
    }
  }

  /**
   * List all tools from all connected servers
   */
  async listAllTools() {
    const allTools = [];
    const toolsByServer = new Map();

    for (const [serverName, client] of this.clients.entries()) {
      try {
        if (!client.isClientConnected()) {
          console.warn(`⚠️  Server ${serverName} is not connected, skipping`);
          continue;
        }

        const tools = await client.listTools();
        console.log(`📋 Retrieved ${tools.length} tools from ${serverName}`);

        // Add server metadata to each tool
        const toolsWithMetadata = tools.map(tool => ({
          ...tool,
          _server: serverName,
          _originalName: tool.name,
          // Prefix tool name with server name to avoid conflicts
          name: `${serverName}_${tool.name}`
        }));

        allTools.push(...toolsWithMetadata);
        toolsByServer.set(serverName, toolsWithMetadata);

      } catch (error) {
        console.error(`❌ Failed to list tools from ${serverName}: ${error.message}`);
      }
    }

    console.log(`📊 Total tools from all servers: ${allTools.length}`);
    
    // Log tools by server
    for (const [serverName, tools] of toolsByServer.entries()) {
      console.log(`   ${serverName}: ${tools.map(t => t._originalName).join(', ')}`);
    }

    return allTools;
  }

  /**
   * Call a tool on the appropriate server
   */
  async callTool(toolName, args = {}) {
    // Extract server name from prefixed tool name
    const parts = toolName.split('_');
    if (parts.length < 2) {
      throw new Error(`Invalid tool name format: ${toolName}. Expected format: serverName_toolName`);
    }

    const serverName = parts[0];
    const originalToolName = parts.slice(1).join('_');

    // Get the client for this server
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`No MCP client found for server: ${serverName}`);
    }

    if (!client.isClientConnected()) {
      throw new Error(`MCP server ${serverName} is not connected`);
    }

    console.log(`🔧 Routing tool call to ${serverName}: ${originalToolName}`);
    
    // Call the tool on the specific server
    return await client.callTool(originalToolName, args);
  }

  /**
   * Call a tool with session context (for terminal tools)
   */
  async callToolWithContext(conversationId, toolName, args = {}) {
    // Extract server name
    const parts = toolName.split('_');
    if (parts.length < 2) {
      throw new Error(`Invalid tool name format: ${toolName}`);
    }

    const serverName = parts[0];
    const originalToolName = parts.slice(1).join('_');

    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`No MCP client found for server: ${serverName}`);
    }

    if (!client.isClientConnected()) {
      throw new Error(`MCP server ${serverName} is not connected`);
    }

    console.log(`🔧 Routing tool call with context to ${serverName}: ${originalToolName}`);
    
    // Call with context if the client supports it
    if (client.callToolWithContext) {
      return await client.callToolWithContext(conversationId, originalToolName, args);
    } else {
      return await client.callTool(originalToolName, args);
    }
  }

  /**
   * Check if any client is connected
   */
  isClientConnected() {
    for (const client of this.clients.values()) {
      if (client.isClientConnected()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get status of all servers
   */
  getStatus() {
    const status = {
      totalServers: this.serverConfigs.size,
      connectedServers: 0,
      servers: {}
    };

    for (const [serverName, client] of this.clients.entries()) {
      const clientStatus = client.getStatus();
      status.servers[serverName] = clientStatus;
      if (clientStatus.isConnected) {
        status.connectedServers++;
      }
    }

    return status;
  }

  /**
   * Shutdown all MCP clients
   */
  async shutdown() {
    console.log('🛑 Shutting down all MCP clients...');
    
    const shutdownPromises = [];
    for (const [serverName, client] of this.clients.entries()) {
      console.log(`   Shutting down: ${serverName}`);
      shutdownPromises.push(client.shutdown());
    }

    await Promise.allSettled(shutdownPromises);
    this.clients.clear();
    
    console.log('✅ All MCP clients shut down');
  }

  /**
   * Set session manager for all clients
   */
  setSessionManager(sessionManager) {
    this.sessionManager = sessionManager;
    for (const client of this.clients.values()) {
      if (client.setSessionManager) {
        client.setSessionManager(sessionManager);
      }
    }
  }

  /**
   * Generate system prompt with context (delegates to primary terminal client)
   */
  generateSystemPrompt(conversationId, basePrompt) {
    // Use the first terminal-related client for context
    for (const [serverName, client] of this.clients.entries()) {
      if (client.generateSystemPrompt) {
        return client.generateSystemPrompt(conversationId, basePrompt);
      }
    }
    return basePrompt;
  }
}

module.exports = MultiMCPClientManager;
