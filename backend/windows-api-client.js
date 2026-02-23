/**
 * Windows API Client
 * Uses Windows Tools API + Agent architecture
 * API encrypts scripts → Agent decrypts and executes
 */

class WindowsAPIClient {
  constructor(config) {
    this.projectId = config.projectId;
    this.apiUrl = config.apiUrl || 'http://172.28.0.2:8090'; // Windows Tools API (updated default)
    this.agentUrl = config.agentUrl || 'http://172.28.0.2:8888'; // Windows Agent (updated default)
    this.apiServiceKey = config.apiServiceKey;
    this.agentApiKey = config.agentApiKey;
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
   * Test connection to Windows Tools API and Agent
   */
  async connect() {
    try {
      console.log(`[WindowsAPI] Connecting to API: ${this.apiUrl}`);
      console.log(`[WindowsAPI] Connecting to Agent: ${this.agentUrl}`);
      console.log(`[WindowsAPI] Project ID: ${this.projectId}`);
      console.log(`[WindowsAPI] API Service Key: ${this.apiServiceKey ? '***' + this.apiServiceKey.slice(-8) : 'missing'}`);
      
      const fetch = await this._getFetch();
      
      // Test API connection
      const apiResponse = await fetch(`${this.apiUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (!apiResponse.ok) {
        throw new Error(`API health check failed: ${apiResponse.status}`);
      }

      console.log(`[WindowsAPI] ✅ API connected`);
      
      // Test Agent connection
      const agentResponse = await fetch(`${this.agentUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (!agentResponse.ok) {
        throw new Error(`Agent health check failed: ${agentResponse.status}`);
      }

      const agentHealth = await agentResponse.json();
      console.log(`[WindowsAPI] ✅ Agent connected - Mode: ${agentHealth.mode}`);
      
      // Load available tools from API
      await this.loadTools();
      
      this.connected = true;
      return true;
    } catch (error) {
      console.error(`[WindowsAPI] ❌ Connection failed`);
      console.error(`[WindowsAPI] Error: ${error.message}`);
      
      this.connected = false;
      return false;
    }
  }

  /**
   * Load available tools from Windows Tools API
   */
  async loadTools() {
    try {
      const fetch = await this._getFetch();
      const response = await fetch(`${this.apiUrl}/api/tools`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiServiceKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Failed to load tools: ${response.statusText}`);
      }

      const data = await response.json();
      this.tools = data.tools || [];
      
      console.log(`[WindowsAPI] Loaded ${this.tools.length} tools:`, 
        this.tools.map(t => t.name).join(', '));
      
      return this.tools;
    } catch (error) {
      console.error(`[WindowsAPI] Failed to load tools:`, error.message);
      this.tools = [];
      return [];
    }
  }

  /**
   * Execute a Windows tool via API + Agent
   */
  async executeTool(toolName, args = {}) {
    if (!this.connected) {
      return {
        success: false,
        error: 'Windows API client not connected. The API or Agent may not be running.'
      };
    }

    try {
      console.log(`[WindowsAPI] Executing tool: ${toolName}`, args);
      
      const fetch = await this._getFetch();
      
      // Step 1: Call API to get encrypted script
      console.log(`[WindowsAPI] Step 1: Getting encrypted script from API...`);
      const apiResponse = await fetch(`${this.apiUrl}/api/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tool: toolName,
          args: args
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw new Error(`API request failed: ${apiResponse.statusText} - ${errorText}`);
      }

      const encryptedPayload = await apiResponse.json();
      
      if (!encryptedPayload.success) {
        throw new Error(`API error: ${encryptedPayload.error}`);
      }

      console.log(`[WindowsAPI] ✓ Received encrypted script (${encryptedPayload.encryptedScript.length} bytes)`);
      
      // Step 2: Send encrypted script to Agent for execution
      console.log(`[WindowsAPI] Step 2: Sending to Agent for execution...`);
      const timeout = toolName === 'take_screenshot' ? 180000 : 60000;
      const agentResponse = await fetch(`${this.agentUrl}/execute-encrypted`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.agentApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(encryptedPayload),
        signal: AbortSignal.timeout(timeout)
      });

      if (!agentResponse.ok) {
        const errorText = await agentResponse.text();
        throw new Error(`Agent execution failed: ${agentResponse.statusText} - ${errorText}`);
      }

      const result = await agentResponse.json();
      
      console.log(`[WindowsAPI] ✓ Tool ${toolName} executed:`, {
        success: result.success,
        hasScreenshot: !!result.screenshot,
        hasOCR: !!result.ocr,
        hasUIElements: !!result.uiElements,
        hasVisual: !!result.visual,
        error: result.error
      });
      
      return result;
    } catch (error) {
      console.error(`[WindowsAPI] Tool execution error:`, error.message);
      
      return {
        success: false,
        error: error.message
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
   * Disconnect (cleanup)
   */
  disconnect() {
    this.connected = false;
    this.tools = [];
    console.log(`[WindowsAPI] Disconnected`);
  }
}

module.exports = WindowsAPIClient;
