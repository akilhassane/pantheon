/**
 * Windows MCP Client
 * HTTP-based client for Windows MCP server
 */

class WindowsMCPClient {
  constructor(config) {
    this.projectId = config.projectId;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.connected = false;
    this.tools = [];
    this.fetch = null;
  }

  /**
   * Lazy load fetch (ESM module)
   */
  async _getFetch() {
    if (!this.fetch) {
      this.fetch = (await import('node-fetch')).default;
    }
    return this.fetch;
  }

  /**
   * Test connection to Windows MCP server
   */
  async connect() {
    try {
      console.log(`[WindowsMCP] Connecting to ${this.baseUrl}...`);
      console.log(`[WindowsMCP] Project ID: ${this.projectId}`);
      console.log(`[WindowsMCP] API Key: ${this.apiKey ? '***' + this.apiKey.slice(-8) : 'missing'}`);
      
      const fetch = await this._getFetch();
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }

      const health = await response.json();
      console.log(`[WindowsMCP] ✅ Connected successfully - Status: ${health.status}`);
      
      // Load available tools
      await this.loadTools();
      
      this.connected = true;
      return true;
    } catch (error) {
      console.error(`[WindowsMCP] ❌ Connection failed to ${this.baseUrl}`);
      console.error(`[WindowsMCP] Error: ${error.message}`);
      console.error(`[WindowsMCP] Error type: ${error.name}`);
      
      // Provide helpful troubleshooting info
      if (error.message.includes('ECONNREFUSED')) {
        console.error(`[WindowsMCP] 💡 Tip: The Windows MCP server may not be running on the host machine`);
        console.error(`[WindowsMCP] 💡 Tip: Check if port ${this.baseUrl.split(':').pop()} is accessible`);
      } else if (error.name === 'AbortError' || error.message.includes('timeout')) {
        console.error(`[WindowsMCP] 💡 Tip: Connection timeout - the server may be slow or unreachable`);
      } else if (error.message.includes('getaddrinfo')) {
        console.error(`[WindowsMCP] 💡 Tip: DNS resolution failed - check if 'host.docker.internal' is accessible`);
        console.error(`[WindowsMCP] 💡 Tip: Try setting WINDOWS_MCP_HOST environment variable to your host IP`);
      }
      
      this.connected = false;
      return false;
    }
  }

  /**
   * Load available tools from MCP server
   */
  async loadTools() {
    try {
      const fetch = await this._getFetch();
      const response = await fetch(`${this.baseUrl}/tools`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Failed to load tools: ${response.statusText}`);
      }

      const data = await response.json();
      this.tools = data.tools || [];
      
      console.log(`[WindowsMCP] Loaded ${this.tools.length} tools:`, 
        this.tools.map(t => t.name).join(', '));
      
      return this.tools;
    } catch (error) {
      console.error(`[WindowsMCP] Failed to load tools:`, error.message);
      this.tools = [];
      return [];
    }
  }

  /**
   * Execute a Windows MCP tool
   */
  async executeTool(toolName, args = {}) {
    if (!this.connected) {
      return {
        success: false,
        error: 'Windows MCP client not connected. The Windows container may not be running or the MCP server is not started.'
      };
    }

    try {
      console.log(`[WindowsMCP] Executing tool: ${toolName}`, args);
      
      const fetch = await this._getFetch();
      // Use longer timeout for screenshot operations (large base64 data transfer)
      const timeout = toolName === 'take_screenshot' ? 180000 : 60000; // 3 minutes for screenshots, 1 minute for others
      const response = await fetch(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tool: toolName,
          arguments: args
        }),
        signal: AbortSignal.timeout(timeout)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tool execution failed: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      console.log(`[WindowsMCP] Tool ${toolName} executed:`, {
        success: result.success,
        hasOutput: !!result.output,
        hasImageData: !!result.imageData,
        hasNote: !!result.note,
        error: result.error
      });
      
      // Result is already parsed by the Windows VM thin client
      return result;
    } catch (error) {
      console.error(`[WindowsMCP] Tool execution error:`, error.message);
      
      // Provide more helpful error messages
      let errorMessage = error.message;
      const timeoutSeconds = toolName === 'take_screenshot' ? 180 : 60;
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        errorMessage = `Request timeout: The Windows MCP server at ${this.baseUrl} did not respond within ${timeoutSeconds} seconds. The Windows container may be slow or unresponsive.`;
      } else if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        errorMessage = `Connection refused: Cannot connect to Windows MCP server at ${this.baseUrl}. The Windows container may not be running or the MCP server is not started.`;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Check if client is connected
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get available tools
   */
  getTools() {
    return this.tools;
  }

  /**
   * Get tools formatted for Gemini API
   */
  getToolsForGemini() {
    return this.tools.map(tool => ({
      name: `windows_${tool.name}`,
      description: tool.description || `Execute ${tool.name}`,
      parameters: {
        type: 'object',
        properties: tool.inputSchema?.properties || {},
        required: tool.inputSchema?.required || []
      }
    }));
  }

  /**
   * Disconnect (cleanup)
   */
  disconnect() {
    this.connected = false;
    this.tools = [];
    console.log(`[WindowsMCP] Disconnected from ${this.baseUrl}`);
  }
}

module.exports = WindowsMCPClient;
