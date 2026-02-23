/**
 * Error Handling and Recovery System
 * Detects errors, analyzes them, and suggests recovery strategies
 */

class ErrorHandler {
  constructor(outputProcessor) {
    this.outputProcessor = outputProcessor;
    this.errorPatterns = this.initializeErrorPatterns();
    this.recoveryStrategies = this.initializeRecoveryStrategies();
  }

  /**
   * Initialize common error patterns
   */
  initializeErrorPatterns() {
    return [
      {
        pattern: /command not found/i,
        type: 'command_not_found',
        severity: 'medium'
      },
      {
        pattern: /permission denied/i,
        type: 'permission_denied',
        severity: 'high'
      },
      {
        pattern: /no such file or directory/i,
        type: 'file_not_found',
        severity: 'medium'
      },
      {
        pattern: /syntax error/i,
        type: 'syntax_error',
        severity: 'high'
      },
      {
        pattern: /connection refused/i,
        type: 'connection_refused',
        severity: 'high'
      },
      {
        pattern: /out of memory/i,
        type: 'out_of_memory',
        severity: 'critical'
      },
      {
        pattern: /disk full/i,
        type: 'disk_full',
        severity: 'critical'
      },
      {
        pattern: /timeout/i,
        type: 'timeout',
        severity: 'medium'
      }
    ];
  }

  /**
   * Initialize recovery strategies
   */
  initializeRecoveryStrategies() {
    return {
      command_not_found: {
        analysis: 'The command is not installed or not in PATH',
        suggestions: [
          'Check if the command is installed',
          'Install the package containing the command',
          'Verify PATH environment variable',
          'Use full path to the command'
        ],
        autoFix: (command) => [
          `which ${command}`,
          `apt-cache search ${command}`,
          `dpkg -l | grep ${command}`
        ]
      },
      permission_denied: {
        analysis: 'Insufficient permissions to execute the operation',
        suggestions: [
          'Check file/directory permissions',
          'Run with sudo if appropriate',
          'Verify user ownership',
          'Check if file is executable'
        ],
        autoFix: (path) => [
          `ls -la ${path}`,
          `stat ${path}`
        ]
      },
      file_not_found: {
        analysis: 'The specified file or directory does not exist',
        suggestions: [
          'Verify the file path is correct',
          'Check for typos in the path',
          'Ensure the file exists',
          'Check current working directory'
        ],
        autoFix: (path) => [
          `pwd`,
          `ls -la $(dirname ${path})`,
          `find . -name "$(basename ${path})"`
        ]
      },
      syntax_error: {
        analysis: 'Command syntax is incorrect',
        suggestions: [
          'Check command syntax',
          'Verify quotes and escaping',
          'Review command documentation',
          'Check for missing arguments'
        ],
        autoFix: (command) => [
          `${command} --help`,
          `man ${command.split(' ')[0]}`
        ]
      },
      connection_refused: {
        analysis: 'Unable to connect to the specified service',
        suggestions: [
          'Check if service is running',
          'Verify port number',
          'Check firewall rules',
          'Ensure network connectivity'
        ],
        autoFix: (port) => [
          `netstat -tuln | grep ${port}`,
          `ps aux | grep ${port}`
        ]
      },
      timeout: {
        analysis: 'Operation took too long to complete',
        suggestions: [
          'Increase timeout value',
          'Check network connectivity',
          'Verify service is responsive',
          'Try breaking into smaller operations'
        ],
        autoFix: () => []
      }
    };
  }

  /**
   * Analyze command error
   */
  analyzeError(command, output, exitCode) {
    const errors = this.outputProcessor.extractErrors(output);
    
    if (errors.length === 0 && exitCode === 0) {
      return null;
    }

    // Detect error type
    let errorType = 'unknown';
    let severity = 'low';

    for (const errorPattern of this.errorPatterns) {
      if (errorPattern.pattern.test(output)) {
        errorType = errorPattern.type;
        severity = errorPattern.severity;
        break;
      }
    }

    return {
      command,
      exitCode,
      errorType,
      severity,
      errorMessages: errors,
      rawOutput: output,
      timestamp: new Date()
    };
  }

  /**
   * Get recovery suggestions
   */
  getRecoverySuggestions(errorAnalysis) {
    if (!errorAnalysis) return null;

    const strategy = this.recoveryStrategies[errorAnalysis.errorType];
    
    if (!strategy) {
      return {
        analysis: 'An error occurred',
        suggestions: [
          'Check the error message',
          'Verify command syntax',
          'Review command output',
          'Try alternative approach'
        ],
        autoFixCommands: []
      };
    }

    // Extract relevant info from command for auto-fix
    const commandParts = errorAnalysis.command.split(' ');
    const mainCommand = commandParts[0];
    const args = commandParts.slice(1);

    let autoFixCommands = [];
    if (typeof strategy.autoFix === 'function') {
      autoFixCommands = strategy.autoFix(args[0] || mainCommand);
    }

    return {
      errorType: errorAnalysis.errorType,
      severity: errorAnalysis.severity,
      analysis: strategy.analysis,
      suggestions: strategy.suggestions,
      autoFixCommands,
      originalCommand: errorAnalysis.command
    };
  }

  /**
   * Attempt automatic recovery
   */
  async attemptRecovery(errorAnalysis, mcpClient) {
    const recovery = this.getRecoverySuggestions(errorAnalysis);
    
    if (!recovery || recovery.autoFixCommands.length === 0) {
      return {
        success: false,
        message: 'No automatic recovery available',
        recovery
      };
    }

    const results = [];
    
    for (const fixCommand of recovery.autoFixCommands) {
      try {
        const result = await mcpClient.executeCommand(fixCommand);
        results.push({
          command: fixCommand,
          output: result.output,
          success: result.exitCode === 0
        });
      } catch (error) {
        results.push({
          command: fixCommand,
          error: error.message,
          success: false
        });
      }
    }

    return {
      success: results.some(r => r.success),
      recovery,
      diagnosticResults: results
    };
  }

  /**
   * Generate error report
   */
  generateErrorReport(errorAnalysis, recovery) {
    const report = {
      timestamp: errorAnalysis.timestamp,
      command: errorAnalysis.command,
      exitCode: errorAnalysis.exitCode,
      errorType: errorAnalysis.errorType,
      severity: errorAnalysis.severity,
      errorMessages: errorAnalysis.errorMessages,
      analysis: recovery?.analysis || 'Unknown error',
      suggestions: recovery?.suggestions || [],
      autoFixAvailable: recovery?.autoFixCommands?.length > 0
    };

    return report;
  }

  /**
   * Log error for debugging
   */
  logError(errorAnalysis) {
    console.error('[ErrorHandler] Error detected:', {
      command: errorAnalysis.command,
      type: errorAnalysis.errorType,
      severity: errorAnalysis.severity,
      exitCode: errorAnalysis.exitCode,
      timestamp: errorAnalysis.timestamp
    });
  }
}

module.exports = ErrorHandler;
