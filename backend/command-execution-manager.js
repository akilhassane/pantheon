/**
 * Command Execution Manager
 * Handles command retry logic, timeout management, and loop detection
 */

class CommandExecutionManager {
  constructor(mcpClient, options = {}) {
    this.mcpClient = mcpClient;
    this.maxRetries = options.maxRetries || 3;
    this.commandTimeout = options.commandTimeout || 30000; // 30 seconds
    this.maxSameCommandRetries = options.maxSameCommandRetries || 5;
    
    // Track command execution history per session
    this.commandHistory = new Map(); // sessionId -> array of commands
    this.pendingCommands = new Map(); // sessionId -> current command info
  }

  /**
   * Execute a command with retry logic and loop detection
   */
  async executeCommandWithManagement(sessionId, command, options = {}) {
    const {
      onProgress = null, // Callback for progress updates
      onRetry = null,    // Callback when retrying
      onTimeout = null,  // Callback on timeout
      onLoopDetected = null // Callback when loop detected
    } = options;

    // Check for command loops
    if (this.detectCommandLoop(sessionId, command)) {
      console.warn(`[CommandExecManager] Loop detected for command: ${command}`);
      if (onLoopDetected) {
        await onLoopDetected(command, this.getCommandCount(sessionId, command));
      }
      throw new Error(`Command loop detected: "${command}" has been executed too many times. Please try a different approach.`);
    }

    // Record command in history
    this.recordCommand(sessionId, command);

    // Mark command as pending
    this.pendingCommands.set(sessionId, {
      command,
      startTime: Date.now(),
      retryCount: 0
    });

    let lastError = null;
    let attempt = 0;

    while (attempt < this.maxRetries) {
      attempt++;
      
      try {
        console.log(`[CommandExecManager] Executing command (attempt ${attempt}/${this.maxRetries}): ${command}`);
        
        if (onProgress) {
          await onProgress({
            status: 'executing',
            attempt,
            maxAttempts: this.maxRetries,
            command
          });
        }

        // Execute command with timeout
        const result = await this.executeWithTimeout(command, this.commandTimeout);

        // Clear pending command
        this.pendingCommands.delete(sessionId);

        // Success
        console.log(`[CommandExecManager] Command succeeded on attempt ${attempt}`);
        return {
          success: true,
          output: result.output,
          exitCode: result.exitCode || 0,
          duration: Date.now() - this.pendingCommands.get(sessionId)?.startTime || 0,
          attempts: attempt
        };

      } catch (error) {
        lastError = error;
        console.error(`[CommandExecManager] Command failed (attempt ${attempt}):`, error.message);

        // Check if it's a timeout
        if (error.message.includes('timeout')) {
          if (onTimeout) {
            await onTimeout(command, attempt);
          }
        }

        // If not the last attempt, retry
        if (attempt < this.maxRetries) {
          console.log(`[CommandExecManager] Retrying command in 2 seconds...`);
          
          if (onRetry) {
            await onRetry(command, attempt, this.maxRetries);
          }

          // Update pending command retry count
          const pending = this.pendingCommands.get(sessionId);
          if (pending) {
            pending.retryCount = attempt;
          }

          // Wait before retry
          await this.sleep(2000);
        }
      }
    }

    // All retries failed
    this.pendingCommands.delete(sessionId);
    
    console.error(`[CommandExecManager] Command failed after ${this.maxRetries} attempts`);
    return {
      success: false,
      error: lastError?.message || 'Command execution failed',
      output: lastError?.output || '',
      exitCode: lastError?.exitCode || 1,
      duration: Date.now() - (this.pendingCommands.get(sessionId)?.startTime || Date.now()),
      attempts: this.maxRetries
    };
  }

  /**
   * Execute command with timeout
   */
  async executeWithTimeout(command, timeout) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Command execution timeout after ${timeout}ms`));
      }, timeout);

      try {
        // Use callTool instead of executeCommand
        const result = await this.mcpClient.callTool('write_command', { command });
        clearTimeout(timeoutId);
        
        // Extract output from MCP response format
        let output = '';
        if (result && result.content && Array.isArray(result.content)) {
          output = result.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('\n');
        }
        
        resolve({ output, exitCode: 0 });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Detect if a command is being executed in a loop
   */
  detectCommandLoop(sessionId, command) {
    const count = this.getCommandCount(sessionId, command);
    return count >= this.maxSameCommandRetries;
  }

  /**
   * Get the number of times a command has been executed in this session
   */
  getCommandCount(sessionId, command) {
    const history = this.commandHistory.get(sessionId) || [];
    return history.filter(cmd => cmd === command).length;
  }

  /**
   * Record a command in the session history
   */
  recordCommand(sessionId, command) {
    if (!this.commandHistory.has(sessionId)) {
      this.commandHistory.set(sessionId, []);
    }
    this.commandHistory.get(sessionId).push(command);

    // Keep only last 50 commands to prevent memory issues
    const history = this.commandHistory.get(sessionId);
    if (history.length > 50) {
      history.shift();
    }
  }

  /**
   * Check if a command is currently pending for a session
   */
  isCommandPending(sessionId) {
    return this.pendingCommands.has(sessionId);
  }

  /**
   * Get pending command info
   */
  getPendingCommand(sessionId) {
    return this.pendingCommands.get(sessionId);
  }

  /**
   * Clear session history
   */
  clearSessionHistory(sessionId) {
    this.commandHistory.delete(sessionId);
    this.pendingCommands.delete(sessionId);
  }

  /**
   * Get session command history
   */
  getSessionHistory(sessionId) {
    return this.commandHistory.get(sessionId) || [];
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = CommandExecutionManager;
