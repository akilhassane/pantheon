/**
 * MCP Error Handler
 * Centralized error handling for MCP operations
 */

class MCPErrorHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.enableFallback = options.enableFallback !== false;
  }

  /**
   * Handle connection errors
   */
  handleConnectionError(error) {
    console.error('❌ MCP Connection Error:', error.message);
    
    const errorInfo = {
      type: 'connection',
      message: this.getUserFriendlyMessage(error),
      originalError: error.message,
      retryable: this.isRetryable(error),
      timestamp: new Date().toISOString()
    };

    // Log detailed error for debugging
    if (error.code === 'ENOENT') {
      console.error('   MCP server executable not found');
      errorInfo.suggestion = 'Check that mcp-server/gotty-direct-writer.js exists';
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   Connection refused');
      errorInfo.suggestion = 'Ensure GoTTY is running on the expected port';
    } else if (error.code === 'SPAWN_ERROR') {
      console.error('   Failed to spawn MCP server process');
      errorInfo.suggestion = 'Check Node.js installation and file permissions';
    }

    return errorInfo;
  }

  /**
   * Handle tool call errors
   */
  handleToolCallError(error, toolName, args) {
    console.error(`❌ MCP Tool Call Error (${toolName}):`, error.message);
    console.error('   Arguments:', JSON.stringify(args, null, 2));
    
    const errorInfo = {
      type: 'tool_call',
      toolName,
      message: this.getUserFriendlyMessage(error),
      originalError: error.message,
      retryable: this.isRetryable(error),
      timestamp: new Date().toISOString()
    };

    // Categorize tool errors
    if (error.message.includes('timeout')) {
      errorInfo.category = 'timeout';
      errorInfo.suggestion = 'The command took too long to execute. Try a simpler command or increase timeout.';
    } else if (error.message.includes('not found') || error.message.includes('unknown tool')) {
      errorInfo.category = 'invalid_tool';
      errorInfo.suggestion = `Tool '${toolName}' is not available. Check MCP server configuration.`;
    } else if (error.message.includes('invalid arguments')) {
      errorInfo.category = 'invalid_args';
      errorInfo.suggestion = 'Check the arguments passed to the tool.';
    } else {
      errorInfo.category = 'execution';
      errorInfo.suggestion = 'The tool execution failed. Check the command and try again.';
    }

    return errorInfo;
  }

  /**
   * Handle timeout errors
   */
  handleTimeoutError(error, context = {}) {
    console.error('❌ MCP Timeout Error:', error.message);
    
    const errorInfo = {
      type: 'timeout',
      message: 'Operation timed out',
      originalError: error.message,
      retryable: true,
      context,
      timestamp: new Date().toISOString(),
      suggestion: 'The operation took too long. Try again or increase the timeout value.'
    };

    return errorInfo;
  }

  /**
   * Handle protocol errors
   */
  handleProtocolError(error) {
    console.error('❌ MCP Protocol Error:', error.message);
    
    const errorInfo = {
      type: 'protocol',
      message: 'Protocol communication error',
      originalError: error.message,
      retryable: false,
      timestamp: new Date().toISOString(),
      suggestion: 'There was an error in the MCP protocol communication. This may indicate a bug.'
    };

    return errorInfo;
  }

  /**
   * Determine if an error is retryable
   */
  isRetryable(error) {
    // Connection errors are usually retryable
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      return true;
    }

    // Timeout errors are retryable
    if (error.message && error.message.includes('timeout')) {
      return true;
    }

    // Process spawn errors might be retryable
    if (error.code === 'SPAWN_ERROR') {
      return true;
    }

    // Protocol errors are usually not retryable
    if (error.message && error.message.includes('protocol')) {
      return false;
    }

    // Invalid tool/args errors are not retryable
    if (error.message && (error.message.includes('not found') || error.message.includes('invalid'))) {
      return false;
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Determine if retry should be attempted
   */
  shouldRetry(error, attemptCount) {
    if (attemptCount >= this.maxRetries) {
      console.log(`⚠️  Max retry attempts (${this.maxRetries}) reached`);
      return false;
    }

    if (!this.isRetryable(error)) {
      console.log('⚠️  Error is not retryable');
      return false;
    }

    return true;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  getRetryDelay(attemptCount) {
    const delay = this.retryDelay * Math.pow(2, attemptCount - 1);
    const maxDelay = 30000; // 30 seconds max
    return Math.min(delay, maxDelay);
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(error) {
    if (error.code === 'ENOENT') {
      return 'MCP server not found. Please check the installation.';
    }
    
    if (error.code === 'ECONNREFUSED') {
      return 'Cannot connect to terminal. Please ensure GoTTY is running.';
    }
    
    if (error.message && error.message.includes('timeout')) {
      return 'Operation timed out. Please try again.';
    }
    
    if (error.message && error.message.includes('not found')) {
      return 'The requested tool or command was not found.';
    }
    
    if (error.message && error.message.includes('invalid')) {
      return 'Invalid request. Please check your input.';
    }
    
    return 'An error occurred while executing the command. Please try again.';
  }

  /**
   * Get fallback response when MCP is unavailable
   */
  getFallbackResponse(error, context = {}) {
    if (!this.enableFallback) {
      return null;
    }

    console.log('⚠️  Using fallback response');
    
    return {
      success: false,
      error: this.getUserFriendlyMessage(error),
      fallback: true,
      message: 'The command execution system is temporarily unavailable. Please try again later.',
      context,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Log error with context
   */
  logError(error, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      context
    };

    console.error('📋 Error Log:', JSON.stringify(logEntry, null, 2));
  }

  /**
   * Create error response for API
   */
  createErrorResponse(error, context = {}) {
    const errorInfo = this.categorizeError(error);
    
    return {
      success: false,
      error: errorInfo.message,
      errorType: errorInfo.type,
      retryable: errorInfo.retryable,
      suggestion: errorInfo.suggestion,
      context,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Categorize error type
   */
  categorizeError(error) {
    if (error.code === 'ENOENT' || error.code === 'SPAWN_ERROR') {
      return this.handleConnectionError(error);
    }
    
    if (error.message && error.message.includes('timeout')) {
      return this.handleTimeoutError(error);
    }
    
    if (error.message && error.message.includes('protocol')) {
      return this.handleProtocolError(error);
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      return this.handleConnectionError(error);
    }
    
    // Default to tool call error
    return {
      type: 'unknown',
      message: this.getUserFriendlyMessage(error),
      originalError: error.message,
      retryable: this.isRetryable(error),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format error for logging
   */
  formatErrorForLogging(error, context = {}) {
    return {
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      message: error.message,
      code: error.code,
      stack: error.stack,
      context,
      userMessage: this.getUserFriendlyMessage(error)
    };
  }
}

module.exports = MCPErrorHandler;
