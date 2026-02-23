/**
 * Multi-Command Execution Engine
 * Allows AI to execute multiple commands sequentially to complete complex tasks
 */

class MultiCommandExecutor {
  constructor(mcpClient, sessionContextManager) {
    this.mcpClient = mcpClient;
    this.sessionManager = sessionContextManager;
    this.maxCommands = 20;
    this.commandTimeout = 30000; // 30 seconds per command
  }

  /**
   * Execute a task that may require multiple commands
   * @param {string} sessionId - Session identifier
   * @param {string} task - High-level task description
   * @param {Function} aiDecisionCallback - AI function to decide next command
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Object} Task execution result
   */
  async executeTask(sessionId, task, aiDecisionCallback, progressCallback = null) {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const executedCommands = [];
    const startTime = Date.now();
    let currentStep = 0;

    console.log(`[MultiCommandExecutor] Starting task for session ${sessionId}: ${task}`);

    try {
      while (currentStep < this.maxCommands) {
        // Report progress
        if (progressCallback) {
          progressCallback({
            step: currentStep + 1,
            maxSteps: this.maxCommands,
            executedCommands: executedCommands.length,
            status: 'running'
          });
        }

        // AI decides next command based on context and previous outputs
        const nextCommand = await aiDecisionCallback({
          task,
          session,
          executedCommands,
          currentStep
        });

        // Task complete - AI returned null or empty command
        if (!nextCommand || nextCommand.trim() === '') {
          console.log(`[MultiCommandExecutor] Task complete at step ${currentStep}`);
          break;
        }

        // Execute command
        console.log(`[MultiCommandExecutor] Executing command ${currentStep + 1}: ${nextCommand}`);
        const commandResult = await this.executeCommand(sessionId, nextCommand);
        
        executedCommands.push(commandResult);

        // Add to session history
        this.sessionManager.addCommandToHistory(sessionId, commandResult);

        // Check for critical errors
        if (commandResult.exitCode !== 0 && commandResult.critical) {
          console.log(`[MultiCommandExecutor] Critical error encountered, stopping execution`);
          break;
        }

        currentStep++;
      }

      const duration = Date.now() - startTime;

      // Final progress report
      if (progressCallback) {
        progressCallback({
          step: currentStep,
          maxSteps: this.maxCommands,
          executedCommands: executedCommands.length,
          status: 'completed'
        });
      }

      return {
        success: true,
        task,
        sessionId,
        executedCommands,
        totalCommands: executedCommands.length,
        duration,
        completedAt: new Date()
      };

    } catch (error) {
      console.error(`[MultiCommandExecutor] Error executing task:`, error);
      
      if (progressCallback) {
        progressCallback({
          step: currentStep,
          maxSteps: this.maxCommands,
          executedCommands: executedCommands.length,
          status: 'error',
          error: error.message
        });
      }

      return {
        success: false,
        task,
        sessionId,
        executedCommands,
        totalCommands: executedCommands.length,
        duration: Date.now() - startTime,
        error: error.message,
        failedAt: new Date()
      };
    }
  }

  /**
   * Execute a single command via MCP
   * @param {string} sessionId - Session identifier
   * @param {string} command - Command to execute
   * @returns {Object} Command execution result
   */
  async executeCommand(sessionId, command) {
    const startTime = Date.now();
    
    try {
      // Execute via MCP client
      const result = await this.mcpClient.executeCommand(command, {
        timeout: this.commandTimeout,
        sessionId
      });

      const duration = Date.now() - startTime;

      return {
        command,
        output: result.output || '',
        exitCode: result.exitCode || 0,
        duration,
        timestamp: new Date(),
        success: result.exitCode === 0,
        error: result.error || null
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error(`[MultiCommandExecutor] Command execution failed:`, error);
      
      return {
        command,
        output: error.message || '',
        exitCode: 1,
        duration,
        timestamp: new Date(),
        success: false,
        error: error.message,
        critical: true
      };
    }
  }

  /**
   * Execute commands with retry logic
   * @param {string} sessionId - Session identifier
   * @param {string} command - Command to execute
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Object} Command execution result
   */
  async executeCommandWithRetry(sessionId, command, maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[MultiCommandExecutor] Attempt ${attempt}/${maxRetries} for command: ${command}`);
        const result = await this.executeCommand(sessionId, command);
        
        if (result.success) {
          return result;
        }
        
        lastError = result.error;
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        lastError = error.message;
        console.error(`[MultiCommandExecutor] Retry attempt ${attempt} failed:`, error);
      }
    }

    throw new Error(`Command failed after ${maxRetries} attempts: ${lastError}`);
  }

  /**
   * Execute multiple commands in parallel
   * @param {string} sessionId - Session identifier
   * @param {Array<string>} commands - Commands to execute
   * @returns {Array<Object>} Array of command results
   */
  async executeCommandsParallel(sessionId, commands) {
    console.log(`[MultiCommandExecutor] Executing ${commands.length} commands in parallel`);
    
    const promises = commands.map(command => 
      this.executeCommand(sessionId, command)
    );

    const results = await Promise.allSettled(promises);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          command: commands[index],
          output: result.reason.message,
          exitCode: 1,
          success: false,
          error: result.reason.message,
          timestamp: new Date()
        };
      }
    });
  }

  /**
   * Get execution statistics
   * @param {Array<Object>} executedCommands - Array of executed commands
   * @returns {Object} Execution statistics
   */
  getExecutionStats(executedCommands) {
    const totalCommands = executedCommands.length;
    const successfulCommands = executedCommands.filter(cmd => cmd.success).length;
    const failedCommands = totalCommands - successfulCommands;
    const totalDuration = executedCommands.reduce((sum, cmd) => sum + (cmd.duration || 0), 0);
    const avgDuration = totalCommands > 0 ? totalDuration / totalCommands : 0;

    return {
      totalCommands,
      successfulCommands,
      failedCommands,
      successRate: totalCommands > 0 ? (successfulCommands / totalCommands) * 100 : 0,
      totalDuration,
      avgDuration
    };
  }
}

module.exports = MultiCommandExecutor;
