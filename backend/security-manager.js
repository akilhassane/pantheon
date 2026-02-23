/**
 * Security Manager
 * Detects dangerous commands, implements rate limiting, and maintains audit logs
 */

class SecurityManager {
  constructor() {
    this.dangerousCommands = this.initializeDangerousCommands();
    this.commandLog = [];
    this.rateLimits = new Map();
    this.maxCommandsPerMinute = 30;
    this.maxCommandsPerHour = 500;
  }

  /**
   * Initialize dangerous command patterns
   */
  initializeDangerousCommands() {
    return [
      {
        pattern: /rm\s+-rf\s+\//,
        name: 'Recursive root deletion',
        severity: 'critical',
        description: 'This will delete all files on the system',
        requireConfirmation: true
      },
      {
        pattern: /dd\s+.*of=\/dev\/sd/,
        name: 'Disk write operation',
        severity: 'critical',
        description: 'This will overwrite disk data',
        requireConfirmation: true
      },
      {
        pattern: /mkfs/,
        name: 'Format filesystem',
        severity: 'critical',
        description: 'This will format a disk partition',
        requireConfirmation: true
      },
      {
        pattern: /chmod\s+777/,
        name: 'Overly permissive permissions',
        severity: 'high',
        description: 'This makes files accessible to everyone',
        requireConfirmation: true
      },
      {
        pattern: />\s*\/dev\/sd/,
        name: 'Direct disk write',
        severity: 'critical',
        description: 'This writes directly to disk device',
        requireConfirmation: true
      },
      {
        pattern: /:\(\)\{\s*:\|:&\s*\};:/,
        name: 'Fork bomb',
        severity: 'critical',
        description: 'This will crash the system',
        requireConfirmation: true
      },
      {
        pattern: /curl.*\|\s*bash/,
        name: 'Pipe to bash',
        severity: 'high',
        description: 'Executing remote script without inspection',
        requireConfirmation: true
      },
      {
        pattern: /wget.*\|\s*sh/,
        name: 'Pipe to shell',
        severity: 'high',
        description: 'Executing remote script without inspection',
        requireConfirmation: true
      }
    ];
  }

  /**
   * Check if command is dangerous
   */
  checkCommand(command) {
    for (const dangerous of this.dangerousCommands) {
      if (dangerous.pattern.test(command)) {
        return {
          isDangerous: true,
          ...dangerous,
          command
        };
      }
    }

    return {
      isDangerous: false,
      command
    };
  }

  /**
   * Validate command before execution
   */
  validateCommand(command, sessionId) {
    const validation = {
      allowed: true,
      warnings: [],
      errors: [],
      requiresConfirmation: false
    };

    // Check for dangerous commands
    const dangerCheck = this.checkCommand(command);
    if (dangerCheck.isDangerous) {
      validation.warnings.push({
        type: 'dangerous_command',
        severity: dangerCheck.severity,
        message: `${dangerCheck.name}: ${dangerCheck.description}`,
        requiresConfirmation: dangerCheck.requireConfirmation
      });
      validation.requiresConfirmation = dangerCheck.requireConfirmation;
    }

    // Check rate limits
    const rateLimit = this.checkRateLimit(sessionId);
    if (!rateLimit.allowed) {
      validation.allowed = false;
      validation.errors.push({
        type: 'rate_limit',
        message: rateLimit.message
      });
    }

    // Check command syntax
    if (command.trim() === '') {
      validation.allowed = false;
      validation.errors.push({
        type: 'empty_command',
        message: 'Command cannot be empty'
      });
    }

    return validation;
  }

  /**
   * Check rate limits
   */
  checkRateLimit(sessionId) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    if (!this.rateLimits.has(sessionId)) {
      this.rateLimits.set(sessionId, []);
    }

    const timestamps = this.rateLimits.get(sessionId);
    
    // Clean old timestamps
    const recentTimestamps = timestamps.filter(t => t > oneHourAgo);
    this.rateLimits.set(sessionId, recentTimestamps);

    // Check minute limit
    const lastMinute = recentTimestamps.filter(t => t > oneMinuteAgo);
    if (lastMinute.length >= this.maxCommandsPerMinute) {
      return {
        allowed: false,
        message: `Rate limit exceeded: ${this.maxCommandsPerMinute} commands per minute`
      };
    }

    // Check hour limit
    if (recentTimestamps.length >= this.maxCommandsPerHour) {
      return {
        allowed: false,
        message: `Rate limit exceeded: ${this.maxCommandsPerHour} commands per hour`
      };
    }

    // Record this command
    recentTimestamps.push(now);

    return {
      allowed: true,
      remaining: {
        perMinute: this.maxCommandsPerMinute - lastMinute.length,
        perHour: this.maxCommandsPerHour - recentTimestamps.length
      }
    };
  }

  /**
   * Log command execution
   */
  logCommand(sessionId, command, result) {
    const logEntry = {
      sessionId,
      command,
      timestamp: new Date(),
      exitCode: result.exitCode,
      success: result.success,
      duration: result.duration,
      dangerous: this.checkCommand(command).isDangerous
    };

    this.commandLog.push(logEntry);

    // Keep only last 1000 entries
    if (this.commandLog.length > 1000) {
      this.commandLog.shift();
    }

    return logEntry;
  }

  /**
   * Get audit log
   */
  getAuditLog(options = {}) {
    const {
      sessionId = null,
      dangerousOnly = false,
      limit = 100
    } = options;

    let filtered = this.commandLog;

    if (sessionId) {
      filtered = filtered.filter(entry => entry.sessionId === sessionId);
    }

    if (dangerousOnly) {
      filtered = filtered.filter(entry => entry.dangerous);
    }

    return filtered.slice(-limit);
  }

  /**
   * Get security statistics
   */
  getSecurityStats(sessionId = null) {
    let logs = this.commandLog;
    
    if (sessionId) {
      logs = logs.filter(entry => entry.sessionId === sessionId);
    }

    const stats = {
      totalCommands: logs.length,
      dangerousCommands: logs.filter(e => e.dangerous).length,
      failedCommands: logs.filter(e => !e.success).length,
      successRate: logs.length > 0 
        ? (logs.filter(e => e.success).length / logs.length * 100).toFixed(2)
        : 0,
      averageDuration: logs.length > 0
        ? logs.reduce((sum, e) => sum + (e.duration || 0), 0) / logs.length
        : 0
    };

    return stats;
  }

  /**
   * Clear rate limits for session
   */
  clearRateLimits(sessionId) {
    this.rateLimits.delete(sessionId);
  }

  /**
   * Export audit log
   */
  exportAuditLog(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.commandLog, null, 2);
    } else if (format === 'csv') {
      const headers = 'Timestamp,Session ID,Command,Exit Code,Success,Duration,Dangerous\n';
      const rows = this.commandLog.map(entry => 
        `${entry.timestamp.toISOString()},${entry.sessionId},"${entry.command}",${entry.exitCode},${entry.success},${entry.duration},${entry.dangerous}`
      ).join('\n');
      return headers + rows;
    }
    
    return '';
  }
}

module.exports = SecurityManager;
