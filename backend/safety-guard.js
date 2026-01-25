/**
 * Safety Guard for AI Desktop Agent
 * Validates and constrains AI actions to prevent harmful operations
 */
class SafetyGuard {
  constructor(config = {}) {
    this.config = {
      // Destructive keywords that require approval
      destructiveKeywords: config.destructiveKeywords || [
        'rm -rf',
        'format',
        'delete',
        'remove',
        'shutdown',
        'reboot',
        'kill',
        'drop table',
        'truncate',
        'sudo rm',
        'del /f',
        'rmdir /s',
        'poweroff',
        'halt',
      ],
      
      // Sensitive window titles that require approval
      sensitiveWindows: config.sensitiveWindows || [
        'password',
        'credential',
        'settings',
        'system preferences',
        'control panel',
        'sudo',
        'administrator',
        'root',
        'authentication',
      ],
      
      // Application restrictions
      applicationWhitelist: config.applicationWhitelist || null,
      applicationBlacklist: config.applicationBlacklist || [],
      
      // Rate limiting
      maxActionsPerMinute: config.maxActionsPerMinute || 30,
      maxActionsPerTask: config.maxActionsPerTask || 100,
      
      // Coordinate validation
      screenBounds: config.screenBounds || { width: 1920, height: 1080 },
      
      // Text input validation
      blockPatterns: config.blockPatterns || [
        /rm\s+-rf\s+\//gi,
        /sudo\s+.*password/gi,
        /DROP\s+DATABASE/gi,
        /DROP\s+TABLE/gi,
        /TRUNCATE\s+TABLE/gi,
      ],
      
      // Require approval for destructive actions
      requireApprovalForDestructive: config.requireApprovalForDestructive !== false,
    };
    
    // State tracking
    this.actionLog = [];
    this.sessionActions = new Map(); // sessionId -> action count
    this.sessionStartTimes = new Map(); // sessionId -> start time
  }

  /**
   * Validate an action before execution
   * @param {Object} action - Action to validate
   * @param {string} sessionId - Session ID for rate limiting
   * @param {Object} context - Additional context (window title, etc.)
   * @returns {Promise<Object>} Validation result
   */
  async validateAction(action, sessionId, context = {}) {
    const validationResult = {
      allowed: true,
      requiresApproval: false,
      reason: null,
      suggestion: null,
    };

    // Check if action type is valid
    const validTypes = ['click', 'type', 'scroll', 'drag', 'hotkey', 'wait'];
    if (!validTypes.includes(action.type)) {
      validationResult.allowed = false;
      validationResult.reason = `Invalid action type: ${action.type}`;
      return validationResult;
    }

    // Check rate limiting
    if (!this.checkRateLimit(sessionId)) {
      validationResult.allowed = false;
      validationResult.reason = 'Rate limit exceeded';
      validationResult.suggestion = 'Please wait before performing more actions';
      return validationResult;
    }

    // Check if action is destructive
    if (this.isDestructive(action)) {
      if (this.config.requireApprovalForDestructive) {
        validationResult.requiresApproval = true;
        validationResult.reason = 'Destructive action detected';
      }
    }

    // Check sensitive window context
    if (context.windowTitle && this.isSensitiveWindow(context.windowTitle)) {
      validationResult.requiresApproval = true;
      validationResult.reason = 'Sensitive window detected';
    }

    // Validate specific action types
    switch (action.type) {
      case 'click':
        const clickValidation = this._validateClick(action.params);
        if (!clickValidation.valid) {
          validationResult.allowed = false;
          validationResult.reason = clickValidation.reason;
        }
        break;
        
      case 'type':
        const typeValidation = this._validateType(action.params);
        if (!typeValidation.valid) {
          validationResult.allowed = false;
          validationResult.reason = typeValidation.reason;
        }
        if (typeValidation.requiresApproval) {
          validationResult.requiresApproval = true;
          validationResult.reason = typeValidation.reason;
        }
        break;
        
      case 'hotkey':
      case 'pressKey':
      case 'press_key':
        const hotkeyValidation = this._validateHotkey(action.params);
        if (!hotkeyValidation.valid) {
          validationResult.allowed = false;
          validationResult.reason = hotkeyValidation.reason;
        }
        if (hotkeyValidation.requiresApproval) {
          validationResult.requiresApproval = true;
          validationResult.reason = hotkeyValidation.reason;
        }
        break;
    }

    return validationResult;
  }

  /**
   * Check if action requires user approval
   * @param {Object} action - Action to check
   * @returns {boolean} True if approval required
   */
  requiresApproval(action) {
    if (this.isDestructive(action)) {
      return this.config.requireApprovalForDestructive;
    }
    return false;
  }

  /**
   * Check if action is destructive
   * @param {Object} action - Action to check
   * @returns {boolean} True if destructive
   */
  isDestructive(action) {
    if (action.type === 'type') {
      const text = action.params.text.toLowerCase();
      return this.config.destructiveKeywords.some(keyword => 
        text.includes(keyword.toLowerCase())
      );
    }
    
    if (action.type === 'hotkey') {
      // Check for destructive hotkeys
      const destructiveHotkeys = [
        { modifiers: ['alt'], key: 'F4' },
        { modifiers: ['alt'], key: 'f4' },
        { modifiers: ['ctrl'], key: 'w' },
        { modifiers: ['ctrl'], key: 'W' },
        { modifiers: ['ctrl', 'shift'], key: 'q' },
        { modifiers: ['ctrl', 'shift'], key: 'Q' },
      ];
      
      return destructiveHotkeys.some(hk => {
        const modifiersMatch = JSON.stringify(hk.modifiers.sort()) === 
                              JSON.stringify((action.params.modifiers || []).sort());
        const keyMatch = hk.key.toLowerCase() === (action.params.key || '').toLowerCase();
        return modifiersMatch && keyMatch;
      });
    }
    
    return false;
  }

  /**
   * Check if window is sensitive
   * @param {string} windowTitle - Window title
   * @returns {boolean} True if sensitive
   */
  isSensitiveWindow(windowTitle) {
    const title = windowTitle.toLowerCase();
    return this.config.sensitiveWindows.some(sensitive => 
      title.includes(sensitive.toLowerCase())
    );
  }

  /**
   * Check rate limit for session
   * @param {string} sessionId - Session ID
   * @returns {boolean} True if within limits
   */
  checkRateLimit(sessionId) {
    const now = Date.now();
    
    // Initialize session if needed
    if (!this.sessionActions.has(sessionId)) {
      this.sessionActions.set(sessionId, 0);
      this.sessionStartTimes.set(sessionId, now);
    }
    
    const actionCount = this.sessionActions.get(sessionId);
    const startTime = this.sessionStartTimes.get(sessionId);
    const elapsedMinutes = (now - startTime) / 60000;
    
    // Check per-minute rate
    if (elapsedMinutes > 0) {
      const actionsPerMinute = actionCount / elapsedMinutes;
      if (actionsPerMinute > this.config.maxActionsPerMinute) {
        return false;
      }
    }
    
    // Check total actions per task
    if (actionCount >= this.config.maxActionsPerTask) {
      return false;
    }
    
    return true;
  }

  /**
   * Log an action for audit trail
   * @param {Object} action - Action that was executed
   * @param {Object} result - Execution result
   * @param {string} sessionId - Session ID
   */
  logAction(action, result, sessionId) {
    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      action,
      result,
      timestamp: new Date(),
      approved: result.approved || false,
    };
    
    this.actionLog.push(logEntry);
    
    // Update session action count
    const currentCount = this.sessionActions.get(sessionId) || 0;
    this.sessionActions.set(sessionId, currentCount + 1);
    
    // Keep log size manageable (last 1000 actions)
    if (this.actionLog.length > 1000) {
      this.actionLog = this.actionLog.slice(-1000);
    }
  }

  /**
   * Get action log for session
   * @param {string} sessionId - Session ID
   * @returns {Array} Action log entries
   */
  getActionLog(sessionId) {
    return this.actionLog.filter(entry => entry.sessionId === sessionId);
  }

  /**
   * Clear session data
   * @param {string} sessionId - Session ID
   */
  clearSession(sessionId) {
    this.sessionActions.delete(sessionId);
    this.sessionStartTimes.delete(sessionId);
  }

  /**
   * Validate click action
   * @private
   */
  _validateClick(params) {
    const { x, y } = params;
    
    // Check coordinates are within screen bounds
    if (x < 0 || x > this.config.screenBounds.width ||
        y < 0 || y > this.config.screenBounds.height) {
      return {
        valid: false,
        reason: `Click coordinates (${x}, ${y}) are out of screen bounds`,
      };
    }
    
    return { valid: true };
  }

  /**
   * Validate type action
   * @private
   */
  _validateType(params) {
    const { text } = params;
    
    // Check for blocked patterns
    for (const pattern of this.config.blockPatterns) {
      if (pattern.test(text)) {
        return {
          valid: false,
          reason: 'Text contains blocked pattern',
        };
      }
    }
    
    // Check for destructive keywords
    const textLower = text.toLowerCase();
    for (const keyword of this.config.destructiveKeywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        return {
          valid: true,
          requiresApproval: true,
          reason: `Text contains destructive keyword: ${keyword}`,
        };
      }
    }
    
    return { valid: true };
  }

  /**
   * Validate hotkey action
   * @private
   */
  _validateHotkey(params) {
    const { modifiers = [], key } = params;
    
    // If key is undefined or null, it's not a valid hotkey
    if (!key) {
      return { valid: true }; // Allow it, might be a simple key press
    }
    
    // Check for destructive hotkeys
    const destructiveHotkeys = [
      { modifiers: ['alt'], key: 'F4', description: 'Close window' },
      { modifiers: ['alt'], key: 'f4', description: 'Close window' },
      { modifiers: ['ctrl'], key: 'w', description: 'Close tab' },
      { modifiers: ['ctrl'], key: 'W', description: 'Close tab' },
      { modifiers: ['ctrl', 'shift'], key: 'q', description: 'Quit application' },
      { modifiers: ['ctrl', 'shift'], key: 'Q', description: 'Quit application' },
    ];
    
    for (const hk of destructiveHotkeys) {
      const modifiersMatch = JSON.stringify(hk.modifiers.sort()) === 
                            JSON.stringify(modifiers.sort());
      const keyMatch = hk.key.toLowerCase() === key.toLowerCase();
      
      if (modifiersMatch && keyMatch) {
        return {
          valid: true,
          requiresApproval: true,
          reason: `Destructive hotkey: ${hk.description}`,
        };
      }
    }
    
    return { valid: true };
  }

  /**
   * Get statistics for session
   * @param {string} sessionId - Session ID
   * @returns {Object} Session statistics
   */
  getSessionStats(sessionId) {
    const actionCount = this.sessionActions.get(sessionId) || 0;
    const startTime = this.sessionStartTimes.get(sessionId);
    const elapsedTime = startTime ? Date.now() - startTime : 0;
    const elapsedMinutes = elapsedTime / 60000;
    
    return {
      actionCount,
      elapsedTime,
      elapsedMinutes,
      actionsPerMinute: elapsedMinutes > 0 ? actionCount / elapsedMinutes : 0,
      remainingActions: this.config.maxActionsPerTask - actionCount,
    };
  }
}

module.exports = SafetyGuard;
