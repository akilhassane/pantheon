/**
 * MCP Configuration
 * Centralized configuration for MCP client and related services
 */

const path = require('path');

const config = {
  // MCP Server Configuration
  mcp: {
    serverPath: process.env.MCP_SERVER_PATH || path.join(__dirname, '../../mcp-server/gotty-direct-writer.js'),
    serverArgs: [],
    timeout: parseInt(process.env.MCP_SERVER_TIMEOUT) || 30000,
    reconnect: {
      attempts: parseInt(process.env.MCP_RECONNECT_ATTEMPTS) || 5,
      delay: parseInt(process.env.MCP_RECONNECT_DELAY) || 1000
    },
    healthCheck: {
      enabled: process.env.MCP_HEALTH_CHECK_ENABLED !== 'false',
      interval: parseInt(process.env.MCP_HEALTH_CHECK_INTERVAL) || 10000
    }
  },

  // GoTTY Configuration
  gotty: {
    wsUrl: process.env.GOTTY_WS_URL || 'ws://gotty-terminal:8080/ws',
    httpUrl: process.env.GOTTY_HTTP_URL || 'http://gotty-terminal:8080',
    reconnectDelay: parseInt(process.env.GOTTY_RECONNECT_DELAY) || 1000
  },

  // Error Handling Configuration
  errorHandling: {
    maxRetries: parseInt(process.env.MCP_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.MCP_RETRY_DELAY) || 1000,
    enableFallback: process.env.ENABLE_FALLBACK_MODE !== 'false'
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableDebug: process.env.DEBUG === 'true',
    logMCPProtocol: process.env.LOG_MCP_PROTOCOL === 'true'
  },

  // Tool Configuration
  tools: {
    cacheEnabled: process.env.MCP_TOOLS_CACHE_ENABLED !== 'false',
    cacheDuration: parseInt(process.env.MCP_TOOLS_CACHE_DURATION) || 60000
  }
};

/**
 * Validate configuration
 */
function validateConfig() {
  const errors = [];

  // Validate MCP server path
  if (!config.mcp.serverPath) {
    errors.push('MCP server path is required');
  }

  // Validate timeout values
  if (config.mcp.timeout < 1000) {
    errors.push('MCP timeout must be at least 1000ms');
  }

  // Validate reconnect attempts
  if (config.mcp.reconnect.attempts < 0) {
    errors.push('MCP reconnect attempts must be non-negative');
  }

  // Validate GoTTY URL
  if (!config.gotty.wsUrl || !config.gotty.wsUrl.startsWith('ws')) {
    errors.push('GoTTY WebSocket URL must start with ws:// or wss://');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  return true;
}

/**
 * Get configuration value by path
 */
function get(path) {
  const keys = path.split('.');
  let value = config;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

/**
 * Set configuration value by path
 */
function set(path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  let obj = config;
  
  for (const key of keys) {
    if (!(key in obj)) {
      obj[key] = {};
    }
    obj = obj[key];
  }
  
  obj[lastKey] = value;
}

/**
 * Get all configuration
 */
function getAll() {
  return { ...config };
}

/**
 * Print configuration (for debugging)
 */
function printConfig() {
  console.log('📋 MCP Configuration:');
  console.log(JSON.stringify(config, null, 2));
}

module.exports = {
  config,
  validateConfig,
  get,
  set,
  getAll,
  printConfig
};
