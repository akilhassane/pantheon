/**
 * MCP Protocol Handler
 * Handles low-level MCP protocol communication (JSON-RPC)
 */

class MCPProtocolHandler {
  constructor() {
    this.requestId = 0;
  }

  /**
   * Format a JSON-RPC request
   */
  formatRequest(method, params = {}, id = null) {
    const request = {
      jsonrpc: '2.0',
      method,
      params
    };

    if (id !== null) {
      request.id = id;
    } else if (this.requiresId(method)) {
      request.id = this.getNextRequestId();
    }

    return request;
  }

  /**
   * Format an initialize request
   */
  formatInitializeRequest(clientInfo = {}) {
    return this.formatRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: clientInfo.name || 'mcp-client',
        version: clientInfo.version || '1.0.0'
      }
    });
  }

  /**
   * Format a tools/list request
   */
  formatListToolsRequest() {
    return this.formatRequest('tools/list', {});
  }

  /**
   * Format a tools/call request
   */
  formatToolCallRequest(toolName, args = {}) {
    return this.formatRequest('tools/call', {
      name: toolName,
      arguments: args
    });
  }

  /**
   * Parse a JSON-RPC response
   */
  parseResponse(data) {
    try {
      if (typeof data === 'string') {
        return JSON.parse(data);
      }
      return data;
    } catch (error) {
      throw new Error(`Failed to parse response: ${error.message}`);
    }
  }

  /**
   * Validate a JSON-RPC response
   */
  validateResponse(response) {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response: not an object');
    }

    if (response.jsonrpc !== '2.0') {
      throw new Error('Invalid response: missing or invalid jsonrpc version');
    }

    if (response.error) {
      const error = new Error(response.error.message || 'RPC error');
      error.code = response.error.code;
      error.data = response.error.data;
      throw error;
    }

    return true;
  }

  /**
   * Extract result from response
   */
  extractResult(response) {
    this.validateResponse(response);
    return response.result;
  }

  /**
   * Check if a method requires an ID
   */
  requiresId(method) {
    // Notifications don't require IDs
    const notifications = [
      'notifications/initialized',
      'notifications/progress',
      'notifications/message'
    ];
    
    return !notifications.includes(method);
  }

  /**
   * Get next request ID
   */
  getNextRequestId() {
    return ++this.requestId;
  }

  /**
   * Format error response
   */
  formatErrorResponse(id, code, message, data = null) {
    const response = {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message
      }
    };

    if (data !== null) {
      response.error.data = data;
    }

    return response;
  }

  /**
   * Format success response
   */
  formatSuccessResponse(id, result) {
    return {
      jsonrpc: '2.0',
      id,
      result
    };
  }

  /**
   * Parse multiple responses from a buffer
   */
  parseMultipleResponses(buffer) {
    const lines = buffer.toString().split('\n').filter(line => line.trim());
    const responses = [];
    const errors = [];

    for (const line of lines) {
      try {
        const response = this.parseResponse(line);
        responses.push(response);
      } catch (error) {
        errors.push({ line, error: error.message });
      }
    }

    return { responses, errors };
  }

  /**
   * Serialize request for transmission
   */
  serializeRequest(request) {
    return JSON.stringify(request) + '\n';
  }

  /**
   * Check if response is an error
   */
  isErrorResponse(response) {
    return response && response.error !== undefined;
  }

  /**
   * Check if response is a notification
   */
  isNotification(response) {
    return response && response.method && response.id === undefined;
  }

  /**
   * Extract error from response
   */
  extractError(response) {
    if (!this.isErrorResponse(response)) {
      return null;
    }

    return {
      code: response.error.code,
      message: response.error.message,
      data: response.error.data
    };
  }

  /**
   * Create a timeout error
   */
  createTimeoutError(requestId, timeout) {
    return {
      code: -32000,
      message: `Request ${requestId} timed out after ${timeout}ms`,
      data: { requestId, timeout }
    };
  }

  /**
   * Create a connection error
   */
  createConnectionError(message) {
    return {
      code: -32001,
      message: `Connection error: ${message}`,
      data: { type: 'connection' }
    };
  }

  /**
   * Create a protocol error
   */
  createProtocolError(message) {
    return {
      code: -32002,
      message: `Protocol error: ${message}`,
      data: { type: 'protocol' }
    };
  }
}

module.exports = MCPProtocolHandler;
