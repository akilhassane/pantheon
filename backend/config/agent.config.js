/**
 * AI Desktop Agent Configuration
 * Central configuration for all agent components
 */

const agentConfig = {
  // Vision System Configuration
  vision: {
    captureInterval: 1000, // ms between screenshots (1 FPS)
    imageQuality: 80, // JPEG quality 0-100
    maxImageSize: 1024, // max width/height in pixels for API efficiency
    enableOCR: true, // Enable text extraction
    enableUIDetection: false, // UI element detection (future feature)
  },

  // Gemini API Configuration
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.0-flash-exp', // Vision-capable model
    timeout: 30000, // ms
    maxRetries: 3,
    temperature: 0.7, // Response creativity (0-1)
  },

  // Safety Guard Configuration
  safety: {
    maxActionsPerMinute: 30,
    maxActionsPerTask: 100,
    requireApprovalForDestructive: true,
    
    // Destructive keywords that require approval
    destructiveKeywords: [
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
      'rmdir /s'
    ],
    
    // Sensitive window titles that require approval
    sensitiveWindows: [
      'password',
      'credential',
      'settings',
      'system preferences',
      'control panel',
      'sudo',
      'administrator'
    ],
    
    // Application restrictions
    applicationWhitelist: null, // null = all allowed, or array of allowed apps
    applicationBlacklist: [], // Apps to never interact with
    
    // Text input validation
    blockPatterns: [
      /rm\s+-rf\s+\//gi, // Dangerous rm commands
      /sudo\s+.*password/gi, // Sudo with password
      /DROP\s+DATABASE/gi, // SQL drops
    ],
  },

  // Action Executor Configuration
  execution: {
    display: process.env.DISPLAY || ':99', // X11 display
    smoothMouseMovement: true, // Interpolate mouse movement
    typingSpeed: 50, // ms per character
    actionDelay: 100, // ms delay between actions
    maxActionDuration: 5000, // max time for single action
  },

  // Agent Orchestrator Configuration
  orchestrator: {
    maxConcurrentTasks: 1, // Only one task at a time per session
    taskTimeout: 300000, // 5 minutes max per task
    maxRetryAttempts: 3, // Max retries for failed actions
    enableAutoRecovery: true, // Attempt to recover from errors
  },

  // Performance Configuration
  performance: {
    enableMonitoring: true,
    logPerformanceMetrics: true,
    screenshotCacheSize: 10, // Keep last N screenshots in memory
  },

  // Security Configuration
  security: {
    enableActionLogging: true,
    logRetentionDays: 7,
    requireUserAuthentication: true,
    sessionTimeout: 3600000, // 1 hour
  },

  // Development/Debug Configuration
  debug: {
    enabled: process.env.DEBUG === 'true',
    logLevel: process.env.LOG_LEVEL || 'info',
    saveScreenshots: true, // Save screenshots to disk for debugging
    screenshotPath: '/tmp/agent-screenshots',
  },
};

/**
 * Validate configuration
 */
function validateConfig() {
  const errors = [];

  if (!agentConfig.gemini.apiKey) {
    errors.push('GEMINI_API_KEY environment variable is required');
  }

  if (!agentConfig.execution.display) {
    errors.push('DISPLAY environment variable is required for X11 control');
  }

  if (agentConfig.vision.captureInterval < 100) {
    errors.push('Vision capture interval must be at least 100ms');
  }

  if (agentConfig.safety.maxActionsPerMinute < 1) {
    errors.push('Max actions per minute must be at least 1');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  return true;
}

/**
 * Get configuration with environment overrides
 */
function getConfig() {
  // Apply environment variable overrides
  if (process.env.AGENT_CAPTURE_INTERVAL) {
    agentConfig.vision.captureInterval = parseInt(process.env.AGENT_CAPTURE_INTERVAL);
  }

  if (process.env.AGENT_MAX_ACTIONS_PER_MINUTE) {
    agentConfig.safety.maxActionsPerMinute = parseInt(process.env.AGENT_MAX_ACTIONS_PER_MINUTE);
  }

  if (process.env.AGENT_TYPING_SPEED) {
    agentConfig.execution.typingSpeed = parseInt(process.env.AGENT_TYPING_SPEED);
  }

  return agentConfig;
}

module.exports = {
  agentConfig,
  validateConfig,
  getConfig,
};
