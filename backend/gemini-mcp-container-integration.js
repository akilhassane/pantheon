const MCPContainerClient = require('./mcp-client-container');

class GeminiMCPContainerIntegration {
  constructor(containerName, mcpServerPath) {
    this.mcpClient = new MCPContainerClient(containerName, mcpServerPath);
    this.toolsCache = null;
    this.toolsCacheTime = 0;
    this.cacheDuration = 60000; // 1 minute
  }

  async initialize() {
    try {
      await this.mcpClient.connect();
      console.log('[Gemini-MCP] Integration initialized successfully');
      return true;
    } catch (error) {
      console.error('[Gemini-MCP] Failed to initialize:', error.message);
      throw error;
    }
  }

  async shutdown() {
    await this.mcpClient.disconnect();
    console.log('[Gemini-MCP] Integration shut down');
  }

  /**
   * Convert MCP tools to Gemini function declarations
   */
  convertMCPToolsToGemini(mcpTools) {
    return mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }));
  }

  /**
   * Get MCP tools in Gemini format (with caching)
   */
  async getToolsForGemini() {
    const now = Date.now();
    
    // Return cached tools if still valid
    if (this.toolsCache && (now - this.toolsCacheTime) < this.cacheDuration) {
      const cacheAge = Math.round((now - this.toolsCacheTime) / 1000);
      console.log(`[Gemini-MCP] Using cached tools (age: ${cacheAge}s)`);
      return this.toolsCache;
    }

    try {
      console.log('[Gemini-MCP] Fetching tools from MCP server...');
      
      if (!this.mcpClient.isConnected()) {
        console.warn('[Gemini-MCP] MCP client not connected');
        return [];
      }

      const mcpTools = await this.mcpClient.listTools();
      console.log(`[Gemini-MCP] Retrieved ${mcpTools.length} tools:`, mcpTools.map(t => t.name).join(', '));
      
      const geminiTools = this.convertMCPToolsToGemini(mcpTools);
      
      // Cache the result
      this.toolsCache = geminiTools;
      this.toolsCacheTime = now;
      console.log(`[Gemini-MCP] Cached ${geminiTools.length} tools`);
      
      return geminiTools;
    } catch (error) {
      console.error('[Gemini-MCP] Failed to get tools:', error.message);
      return [];
    }
  }

  /**
   * Handle Gemini function call by invoking MCP tool
   */
  async handleFunctionCall(functionCall) {
    try {
      const { name, args } = functionCall;
      console.log(`[Gemini-MCP] Handling function call: ${name}`, args);
      
      if (!this.mcpClient.isConnected()) {
        throw new Error('MCP client not connected');
      }

      const result = await this.mcpClient.callTool(name, args);
      
      // Extract text content from MCP response
      if (result.content && result.content.length > 0) {
        const textContent = result.content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join('\n');
        
        return {
          success: true,
          output: textContent,
          isError: result.isError || false
        };
      }
      
      return {
        success: true,
        output: 'Command executed successfully',
        isError: false
      };
    } catch (error) {
      console.error('[Gemini-MCP] Function call failed:', error.message);
      return {
        success: false,
        output: `Error: ${error.message}`,
        isError: true
      };
    }
  }

  /**
   * Execute a command via MCP write_command tool
   */
  async executeCommand(command) {
    return this.handleFunctionCall({
      name: 'write_command',
      args: { command }
    });
  }

  /**
   * Write text to terminal via MCP write_text tool
   */
  async writeText(text) {
    return this.handleFunctionCall({
      name: 'write_text',
      args: { text }
    });
  }

  /**
   * Send special key to terminal via MCP send_key tool
   */
  async sendKey(key) {
    return this.handleFunctionCall({
      name: 'send_key',
      args: { key }
    });
  }

  /**
   * Check if MCP client is healthy
   */
  async healthCheck() {
    return this.mcpClient.healthCheck();
  }

  isConnected() {
    return this.mcpClient.isConnected();
  }
}

module.exports = GeminiMCPContainerIntegration;
