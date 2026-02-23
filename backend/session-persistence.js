/**
 * Session Persistence Layer
 * Handles saving and loading session context to/from disk
 */

const fs = require('fs').promises;
const path = require('path');

class SessionPersistenceLayer {
  constructor() {
    this.storageDir = path.join(__dirname, '.session-storage');
    this.ensureStorageDir();
  }

  /**
   * Ensure storage directory exists
   */
  async ensureStorageDir() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      console.log(`[Persistence] Storage directory ready: ${this.storageDir}`);
    } catch (error) {
      console.error('[Persistence] Failed to create storage directory:', error);
    }
  }

  /**
   * Save session context to disk
   * @param {string} sessionId - Session identifier
   * @param {Object} sessionContext - Session context object
   * @returns {Promise<boolean>} True if saved successfully
   */
  async saveSession(sessionId, sessionContext) {
    const filePath = path.join(this.storageDir, `${sessionId}.json`);

    try {
      await fs.writeFile(filePath, JSON.stringify(sessionContext, null, 2), 'utf8');
      console.log(`[Persistence] Saved session ${sessionId} to disk`);
      return true;
    } catch (error) {
      console.error(`[Persistence] Failed to save session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Load session context from disk
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object|null>} Session context or null if not found
   */
  async loadSession(sessionId) {
    const filePath = path.join(this.storageDir, `${sessionId}.json`);

    try {
      const data = await fs.readFile(filePath, 'utf8');
      const sessionContext = JSON.parse(data);
      console.log(`[Persistence] Loaded session ${sessionId} from disk`);
      return sessionContext;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`[Persistence] Failed to load session ${sessionId}:`, error);
      }
      return null;
    }
  }

  /**
   * Delete session from disk
   * @param {string} sessionId - Session identifier
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteSession(sessionId) {
    const filePath = path.join(this.storageDir, `${sessionId}.json`);

    try {
      await fs.unlink(filePath);
      console.log(`[Persistence] Deleted session ${sessionId} from disk`);
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`[Persistence] Failed to delete session ${sessionId}:`, error);
      }
      return false;
    }
  }

  /**
   * List all saved sessions
   * @returns {Promise<Array<string>>} Array of session IDs
   */
  async listSessions() {
    try {
      const files = await fs.readdir(this.storageDir);
      const sessionIds = files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
      console.log(`[Persistence] Found ${sessionIds.length} saved sessions`);
      return sessionIds;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[Persistence] Failed to list sessions:', error);
      }
      return [];
    }
  }

  /**
   * Check if session exists on disk
   * @param {string} sessionId - Session identifier
   * @returns {Promise<boolean>} True if session file exists
   */
  async sessionExists(sessionId) {
    const filePath = path.join(this.storageDir, `${sessionId}.json`);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get storage directory path
   * @returns {string} Storage directory path
   */
  getStorageDir() {
    return this.storageDir;
  }
}

module.exports = SessionPersistenceLayer;
