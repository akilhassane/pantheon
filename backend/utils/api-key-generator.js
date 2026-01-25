/**
 * API Key Generator
 * 
 * Generates secure API keys for Windows MCP servers using hash functions.
 * Each project gets a unique API key derived from project ID and a secret.
 */

const crypto = require('crypto');

class ApiKeyGenerator {
  constructor(options = {}) {
    // Master secret for key derivation (should be in .env in production)
    this.masterSecret = options.masterSecret || process.env.MCP_MASTER_SECRET || this._generateMasterSecret();
    
    // Algorithm for key generation
    this.algorithm = options.algorithm || 'sha256';
    
    // Key length in bytes (64 bytes = 128 hex characters)
    this.keyLength = options.keyLength || 64;
    
    console.log('[ApiKeyGenerator] Initialized with algorithm:', this.algorithm);
  }

  /**
   * Generate a master secret if none exists
   * @private
   */
  _generateMasterSecret() {
    const secret = crypto.randomBytes(32).toString('hex');
    console.warn('[ApiKeyGenerator]   No MCP_MASTER_SECRET found in environment!');
    console.warn('[ApiKeyGenerator] Generated temporary secret. Add this to .env for persistence:');
    console.warn('[ApiKeyGenerator] MCP_MASTER_SECRET=${secret}');
    return secret;
  }

  /**
   * Generate a unique API key for a project
   * Uses HMAC-SHA256 to derive a deterministic key from project ID
   * Returns BOTH the raw key (for transmission) and hashed key (for storage)
   * 
   * @param {string} projectId - Unique project identifier
   * @param {object} options - Additional options
   * @returns {object} { rawKey: string, hashedKey: string }
   */
  generateProjectKey(projectId, options = {}) {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    // Add timestamp salt for uniqueness (optional)
    const salt = options.salt || Date.now().toString();
    
    // Create HMAC using master secret
    const hmac = crypto.createHmac(this.algorithm, this.masterSecret);
    
    // Update with project ID and salt
    hmac.update(projectId);
    hmac.update(salt);
    
    // Generate raw key
    const rawKey = hmac.digest('hex');
    
    // Hash the key for storage (SHA-256)
    const hashedKey = this.hashKey(rawKey);
    
    console.log(`[ApiKeyGenerator] Generated API key for project ${projectId.substring(0, 8)}...`);
    console.log(`[ApiKeyGenerator]   Raw Key: ${rawKey.substring(0, 16)}...${rawKey.substring(rawKey.length - 8)}`);
    console.log(`[ApiKeyGenerator]   Hashed Key: ${hashedKey.substring(0, 16)}...${hashedKey.substring(hashedKey.length - 8)}`);
    
    return {
      rawKey,      // For transmission to Windows VM (one-time use)
      hashedKey    // For storage in database and .env
    };
  }

  /**
   * Generate a random API key (not project-specific)
   * Useful for one-time keys or testing
   * 
   * @returns {string} Random API key (hex string)
   */
  generateRandomKey() {
    const key = crypto.randomBytes(this.keyLength).toString('hex');
    console.log(`[ApiKeyGenerator] Generated random API key: ${key.substring(0, 16)}...${key.substring(key.length - 8)}`);
    return key;
  }

  /**
   * Verify an API key matches a project
   * Regenerates the key and compares
   * 
   * @param {string} projectId - Project identifier
   * @param {string} apiKey - API key to verify
   * @param {object} options - Options used during generation
   * @returns {boolean} True if key is valid
   */
  verifyProjectKey(projectId, apiKey, options = {}) {
    try {
      const expectedKey = this.generateProjectKey(projectId, options);
      return crypto.timingSafeEqual(
        Buffer.from(apiKey, 'hex'),
        Buffer.from(expectedKey, 'hex')
      );
    } catch (error) {
      console.error('[ApiKeyGenerator] Key verification failed:', error.message);
      return false;
    }
  }

  /**
   * Hash an API key for storage (one-way)
   * Use this to store keys securely in database
   * 
   * @param {string} apiKey - API key to hash
   * @returns {string} Hashed key
   */
  hashKey(apiKey) {
    return crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');
  }

  /**
   * Generate API key configuration for Windows VM
   * Creates a JSON object with all necessary config
   * 
   * @param {string} projectId - Project ID
   * @param {string} apiKey - Generated API key
   * @param {number} mcpPort - MCP server port
   * @returns {object} Configuration object
   */
  generateWindowsConfig(projectId, apiKey, mcpPort) {
    return {
      projectId,
      apiKey,
      mcpPort,
      generatedAt: new Date().toISOString(),
      algorithm: this.algorithm
    };
  }

  /**
   * Generate .env file content for Windows VM
   * 
   * @param {string} projectId - Project ID
   * @param {string} apiKey - Generated API key
   * @param {number} mcpPort - MCP server port (HTTP)
   * @param {number} wsPort - WebSocket port
   * @returns {string} .env file content
   */
  generateWindowsEnvFile(projectId, apiKey, mcpPort, wsPort) {
    return `# Windows MCP Server Configuration
# Generated for Project: ${projectId}
# Generated at: ${new Date().toISOString()}

# API Authentication (SHA-256 hash only - raw key never stored)
MCP_API_KEY_HASH=${apiKey}

# Server Ports
MCP_HTTP_PORT=${mcpPort}
MCP_WS_PORT=${wsPort}

# Project Configuration
PROJECT_ID=${projectId}

# Enable remote access
MCP_ENABLE_REMOTE=true

# Logging
MCP_LOG_LEVEL=info
`;
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create the API key generator instance
 * @param {object} options - Configuration options
 * @returns {ApiKeyGenerator} Singleton instance
 */
function getApiKeyGenerator(options = {}) {
  if (!instance) {
    instance = new ApiKeyGenerator(options);
  }
  return instance;
}

module.exports = {
  ApiKeyGenerator,
  getApiKeyGenerator
};
