/**
 * Multi-MCP Client
 * Connects to multiple MCP servers and aggregates their tools
 */

class MultiMCPClient {
  constructor(containerName, operatingSystem = 'kali-linux') {
    this.containerName = containerName;
    this.operatingSystem = operatingSystem;
    this.servers = new Map(); // serverName → { client, transport, process }
    this.connected = false;
    this.Client = null;
    this.StdioClientTransport = null;
    
    // Determine the correct user based on OS
    this.containerUser = this.getContainerUser(operatingSystem);
    console.log(`[MultiMCP] Container: ${containerName}, OS: ${operatingSystem}, User: ${this.containerUser}`);
  }

  /**
   * Get the correct container user based on operating system
   */
  getContainerUser(os) {
    const osUserMap = {
      'kali-linux': 'pentester',
      'kali-rolling': 'pentester',
      'ubuntu-22': 'ubuntu',
      'ubuntu-24': 'ubuntu',
      'windows-11': 'Administrator',
      'debian-11': 'root',
      'debian-12': 'root',
      'fedora-39': 'root',
      'fedora-40': 'root',
      'arch-linux': 'root',
      'windows-11': 'ContainerAdministrator'
    };
    
    return osUserMap[os] || 'root'; // Default to root if OS not found
  }

  /**
   * Load MCP SDK (ESM modules)
   */
  async loadSDK() {
    if (!this.Client) {
      const clientModule = await import('@modelcontextprotocol/sdk/client/index.js');
      const transportModule = await import('@modelcontextprotocol/sdk/client/stdio.js');
      this.Client = clientModule.Client;
      this.StdioClientTransport = transportModule.StdioClientTransport;
    }
  }

  /**
   * Connect to multiple MCP servers
   */
  async connect() {
    try {
      console.log('[MultiMCP] Connecting to MCP servers...');
      console.log(`[MultiMCP] Using container user: ${this.containerUser} for OS: ${this.operatingSystem}`);
      
      // Load SDK first
      await this.loadSDK();
      
      // Windows uses a different MCP server architecture
      const isWindows = this.operatingSystem === 'windows-11';
      
      if (isWindows) {
        console.log('[MultiMCP] Detected Windows container - connecting to Windows MCP server');
        
        // For Windows, we need to exec into the Linux container, then run a command
        // that connects to the Windows VM and starts the MCP server there
        // The MCP server in Windows communicates via stdio which we pipe through
        await this.connectServer('windows-mcp', {
          command: 'docker',
          args: [
            'exec',
            '-i',
            this.containerName,
            'sh',
            '-c',
            // This command gets the Windows IP and uses PowerShell remoting to run the MCP server
            'WINDOWS_IP=$(cat /var/lib/misc/dnsmasq.leases 2>/dev/null | awk \'{print $3}\' | head -1); ' +
            'if [ -z "$WINDOWS_IP" ]; then echo "Error: Windows VM not found" >&2; exit 1; fi; ' +
            'echo "Connecting to Windows at $WINDOWS_IP" >&2; ' +
            // Use PowerShell remoting to execute the MCP server in Windows
            'powershell.exe -Command "Invoke-Command -ComputerName $WINDOWS_IP -ScriptBlock { cd C:\\WindowsMCP; node windows-mcp-server.js }"'
          ]
        });
        
      } else {
        // Linux containers use tmux-writer and desktop-vision
        console.log('[MultiMCP] Detected Linux container - using tmux-writer and desktop-vision');
        
        // Connect to tmux-writer (terminal commands)
        await this.connectServer('tmux-writer', {
          command: 'docker',
          args: [
            'exec',
            '-i',
            '-u', this.containerUser,  // OS-aware user
            this.containerName,
            'node',
            '/app/mcp-server/tmux-writer.js'
          ]
        });

        // Connect to desktop-vision (desktop interaction)
        await this.connectServer('desktop-vision', {
          command: 'docker',
          args: [
            'exec',
            '-i',
            '-u', this.containerUser,  // OS-aware user
            '-e', 'DISPLAY=:0',  // Use :0 (VNC display) instead of :99
            this.containerName,
            'node',
            '/app/mcp-server/desktop-vision-mcp.js'
          ]
        });
      }

      this.connected = true;
      console.log('[MultiMCP] ✅ Connected to all MCP servers');
      return true;
    } catch (error) {
      console.error('[MultiMCP] Connection failed:', error.message);
      this.connected = false;
      throw error;
    }
  }

  /**
   * Connect to a single MCP server
   */
  async connectServer(serverName, transportConfig) {
    try {
      console.log(`[MultiMCP] Connecting to ${serverName}...`);

      // Create MCP client
      const client = new this.Client({
        name: `multi-mcp-${serverName}`,
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      // Create transport
      const transport = new this.StdioClientTransport(transportConfig);

      // Connect
      await client.connect(transport);

      // Store
      this.servers.set(serverName, {
        client,
        transport,
        process: transport._process
      });

      console.log(`[MultiMCP] ✅ Connected to ${serverName}`);
    } catch (error) {
      console.error(`[MultiMCP] Failed to connect to ${serverName}:`, error.message);
      throw error;
    }
  }

  /**
   * List all tools from all connected servers
   */
  async listTools() {
    console.log('[MultiMCP] listTools() called');
    console.log(`[MultiMCP] Connected: ${this.connected}, Servers: ${this.servers.size}`);
    
    if (!this.connected) {
      console.error('[MultiMCP] Not connected to MCP servers');
      throw new Error('Not connected to MCP servers');
    }

    const allTools = [];

    for (const [serverName, { client }] of this.servers) {
      try {
        console.log(`[MultiMCP] Listing tools from ${serverName}...`);
        const result = await client.listTools();
        const tools = result.tools || [];

        console.log(`[MultiMCP] Raw tools from ${serverName}:`, tools.map(t => t.name).join(', '));

        // Prefix tool names with server name to avoid conflicts
        const prefixedTools = tools.map(tool => ({
          ...tool,
          name: `${serverName}_${tool.name}`,
          _originalName: tool.name,
          _server: serverName
        }));

        allTools.push(...prefixedTools);
        console.log(`[MultiMCP] Got ${tools.length} tools from ${serverName}`);
      } catch (error) {
        console.error(`[MultiMCP] Failed to list tools from ${serverName}:`, error.message);
        console.error(`[MultiMCP] Error stack:`, error.stack);
      }
    }

    console.log(`[MultiMCP] Total tools: ${allTools.length}`);
    console.log(`[MultiMCP] Tool names:`, allTools.map(t => t.name).join(', '));
    return allTools;
  }

  /**
   * Call a tool on the appropriate server
   */
  async callTool(toolName, args) {
    if (!this.connected) {
      throw new Error('Not connected to MCP servers');
    }

    // Extract server name from prefixed tool name
    const parts = toolName.split('_');
    const serverName = parts[0];
    const originalToolName = parts.slice(1).join('_');

    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    console.log(`[MultiMCP] Calling ${originalToolName} on ${serverName}`);

    return await server.client.callTool({
      name: originalToolName,
      arguments: args
    });
  }

  /**
   * Call a tool with context (for compatibility with old API)
   * Note: Context is not used in MultiMCPClient, but kept for API compatibility
   */
  async callToolWithContext(conversationId, toolName, args) {
    console.log(`[MultiMCP] callToolWithContext called (conversationId: ${conversationId})`);
    // Just call the tool without context
    return await this.callTool(toolName, args);
  }

  /**
   * Disconnect from all servers
   */
  async disconnect() {
    console.log('[MultiMCP] Disconnecting from all servers...');

    for (const [serverName, { client, process }] of this.servers) {
      try {
        await client.close();
        if (process) {
          process.kill();
        }
        console.log(`[MultiMCP] Disconnected from ${serverName}`);
      } catch (error) {
        console.error(`[MultiMCP] Error disconnecting from ${serverName}:`, error.message);
      }
    }

    this.servers.clear();
    this.connected = false;
    console.log('[MultiMCP] Disconnected from all servers');
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected && this.servers.size > 0;
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.connected) {
        return { healthy: false, error: 'Not connected' };
      }

      // Try to list tools from all servers
      await this.listTools();
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

module.exports = MultiMCPClient;
