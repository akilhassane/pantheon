/**
 * Session Context Manager
 * Manages session state, command history, and terminal context for each chat session
 */

const { execSync } = require('child_process');
const SessionPersistenceLayer = require('./session-persistence');

class SessionContextManager {
  constructor() {
    // In-memory storage: Map<sessionId, SessionContext>
    this.sessions = new Map();
    this.maxCommandsPerSession = 100;
    
    // NEW: Conversation to tmux session mapping
    this.conversationToSession = new Map();
    
    // NEW: Session persistence layer
    this.sessionPersistence = new SessionPersistenceLayer();
    
    // NEW: Auto-save timer and command counter
    this.autoSaveTimer = null;
    this.commandCountSinceLastSave = 0;
    this.COMMANDS_BEFORE_SAVE = 10; // Save after every 10 commands
  }

  /**
   * Create a new session
   * @param {string} sessionId - Unique session identifier
   * @param {Object} options - Optional session configuration
   * @returns {Object} Created session context
   */
  createSession(sessionId, options = {}) {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    const sessionContext = {
      sessionId,
      conversationId: options.conversationId || null,
      tmuxSessionId: options.tmuxSessionId || sessionId,
      commandHistory: [],
      workingDirectory: options.workingDirectory || '/root',
      environmentVariables: options.environmentVariables || {},
      openFiles: [],
      lastCommandTime: null,
      terminalState: {
        pwd: options.workingDirectory || '/root',
        user: 'root',
        hostname: 'kali',
        lastPrompt: 'root@kali:~#'
      },
      // Context state tracking for autonomous AI
      contextState: {
        currentDirectory: options.workingDirectory || '/root',
        availableTools: [],
        installedPackages: [],
        createdResources: [],
        environmentState: {
          osType: null,
          osDistribution: null,
          packageManager: null,
          shellType: null,
          isRoot: null
        },
        networkState: {
          hasInternet: null,
          lastChecked: null
        },
        lastStateDiscovery: null
      },
      createdAt: new Date(),
      lastAccessedAt: new Date()
    };

    this.sessions.set(sessionId, sessionContext);
    console.log(`[SessionManager] Created session: ${sessionId} (tmux: ${sessionContext.tmuxSessionId})`);
    return sessionContext;
  }

  /**
   * Get session context
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Session context or null if not found
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessedAt = new Date();
    }
    return session || null;
  }

  /**
   * Update session context
   * @param {string} sessionId - Session identifier
   * @param {Object} updates - Partial session context updates
   * @returns {Object} Updated session context
   */
  updateSession(sessionId, updates) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Merge updates
    Object.assign(session, updates);
    session.lastAccessedAt = new Date();

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Delete session
   * @param {string} sessionId - Session identifier
   * @returns {boolean} True if deleted, false if not found
   */
  deleteSession(sessionId) {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      console.log(`[SessionManager] Deleted session: ${sessionId}`);
    }
    return deleted;
  }

  /**
   * Add command to session history
   * @param {string} sessionId - Session identifier
   * @param {Object} commandEntry - Command history entry
   */
  addCommandToHistory(sessionId, commandEntry) {
    // Special handling for "shared" session - create it if it doesn't exist
    if (sessionId === 'shared' && !this.sessions.has(sessionId)) {
      console.log('[SessionManager] Auto-creating "shared" session for command history');
      this.createSession('shared', { tmuxSessionId: 'shared' });
    }
    
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const entry = {
      command: commandEntry.command,
      output: commandEntry.output || '',
      exitCode: commandEntry.exitCode || 0,
      timestamp: new Date(),
      workingDirectory: session.workingDirectory,
      duration: commandEntry.duration || 0
    };

    session.commandHistory.push(entry);
    session.lastCommandTime = entry.timestamp;

    // Limit history size
    if (session.commandHistory.length > this.maxCommandsPerSession) {
      session.commandHistory.shift();
    }

    this.sessions.set(sessionId, session);
    
    // Auto-save after every 10 commands
    this.commandCountSinceLastSave++;
    if (this.commandCountSinceLastSave >= this.COMMANDS_BEFORE_SAVE) {
      this.commandCountSinceLastSave = 0;
      this.saveSession(sessionId).catch(error => {
        console.error(`[SessionManager] Auto-save failed for session ${sessionId}:`, error);
      });
    }
    
    return entry;
  }

  /**
   * Get command history for session
   * @param {string} sessionId - Session identifier
   * @param {number} limit - Maximum number of commands to return
   * @returns {Array} Command history
   */
  getCommandHistory(sessionId, limit = null) {
    const session = this.getSession(sessionId);
    if (!session) {
      return [];
    }

    const history = session.commandHistory;
    if (limit && limit > 0) {
      return history.slice(-limit);
    }
    return history;
  }

  /**
   * Update terminal state
   * @param {string} sessionId - Session identifier
   * @param {Object} terminalState - Terminal state updates
   */
  updateTerminalState(sessionId, terminalState) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    Object.assign(session.terminalState, terminalState);
    
    // Update working directory if pwd changed
    if (terminalState.pwd) {
      session.workingDirectory = terminalState.pwd;
    }

    this.sessions.set(sessionId, session);
  }

  /**
   * Update current directory in context state
   * @param {string} sessionId - Session identifier
   * @param {string} directory - New current directory
   */
  updateCurrentDirectory(sessionId, directory) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.contextState.currentDirectory = directory;
    session.workingDirectory = directory;
    session.terminalState.pwd = directory;
    this.sessions.set(sessionId, session);
  }

  /**
   * Add installed package to context state
   * @param {string} sessionId - Session identifier
   * @param {string} packageName - Name of installed package
   */
  addInstalledPackage(sessionId, packageName) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!session.contextState.installedPackages.includes(packageName)) {
      session.contextState.installedPackages.push(packageName);
      this.sessions.set(sessionId, session);
    }
  }

  /**
   * Add created resource to context state
   * @param {string} sessionId - Session identifier
   * @param {Object} resource - Resource information {type, path, name}
   */
  addCreatedResource(sessionId, resource) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.contextState.createdResources.push({
      ...resource,
      createdAt: new Date()
    });
    this.sessions.set(sessionId, session);
  }

  /**
   * Update environment state
   * @param {string} sessionId - Session identifier
   * @param {Object} state - Environment state updates
   */
  updateEnvironmentState(sessionId, state) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    Object.assign(session.contextState.environmentState, state);
    session.contextState.lastStateDiscovery = new Date();
    this.sessions.set(sessionId, session);
  }

  /**
   * Update available tools list
   * @param {string} sessionId - Session identifier
   * @param {Array<string>} tools - List of available tools
   */
  updateAvailableTools(sessionId, tools) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.contextState.availableTools = tools;
    this.sessions.set(sessionId, session);
  }

  /**
   * Update network state
   * @param {string} sessionId - Session identifier
   * @param {boolean} hasInternet - Whether internet is available
   */
  updateNetworkState(sessionId, hasInternet) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.contextState.networkState = {
      hasInternet,
      lastChecked: new Date()
    };
    this.sessions.set(sessionId, session);
  }

  /**
   * Get current directory from context state
   * @param {string} sessionId - Session identifier
   * @returns {string|null} Current directory or null
   */
  getCurrentDirectory(sessionId) {
    const session = this.getSession(sessionId);
    return session ? session.contextState.currentDirectory : null;
  }

  /**
   * Get installed packages from context state
   * @param {string} sessionId - Session identifier
   * @returns {Array<string>} List of installed packages
   */
  getInstalledPackages(sessionId) {
    const session = this.getSession(sessionId);
    return session ? session.contextState.installedPackages : [];
  }

  /**
   * Get created resources from context state
   * @param {string} sessionId - Session identifier
   * @returns {Array<Object>} List of created resources
   */
  getCreatedResources(sessionId) {
    const session = this.getSession(sessionId);
    return session ? session.contextState.createdResources : [];
  }

  /**
   * Get environment state from context
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Environment state or null
   */
  getEnvironmentState(sessionId) {
    const session = this.getSession(sessionId);
    return session ? session.contextState.environmentState : null;
  }

  /**
   * Get complete context state
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Complete context state or null
   */
  getContextState(sessionId) {
    const session = this.getSession(sessionId);
    return session ? session.contextState : null;
  }

  /**
   * Serialize session context for persistence
   * @param {string} sessionId - Session identifier
   * @returns {string} JSON string of session context
   */
  serializeSession(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return JSON.stringify(session, null, 2);
  }

  /**
   * Deserialize and restore session context
   * @param {string} serializedSession - JSON string of session context
   * @returns {Object} Restored session context
   */
  deserializeSession(serializedSession) {
    const session = JSON.parse(serializedSession);
    
    // Convert date strings back to Date objects
    session.createdAt = new Date(session.createdAt);
    session.lastAccessedAt = new Date(session.lastAccessedAt);
    if (session.lastCommandTime) {
      session.lastCommandTime = new Date(session.lastCommandTime);
    }
    
    session.commandHistory = session.commandHistory.map(entry => ({
      ...entry,
      timestamp: new Date(entry.timestamp)
    }));

    this.sessions.set(session.sessionId, session);
    console.log(`[SessionManager] Restored session: ${session.sessionId}`);
    return session;
  }

  /**
   * Get all active sessions
   * @returns {Array} Array of session IDs
   */
  getAllSessions() {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get session count
   * @returns {number} Number of active sessions
   */
  getSessionCount() {
    return this.sessions.size;
  }

  /**
   * Clear old sessions (cleanup)
   * @param {number} maxAgeMs - Maximum age in milliseconds
   * @returns {number} Number of sessions cleared
   */
  clearOldSessions(maxAgeMs = 24 * 60 * 60 * 1000) { // Default: 24 hours
    let cleared = 0;
    const now = Date.now();

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now - session.lastAccessedAt.getTime();
      if (age > maxAgeMs) {
        this.deleteSession(sessionId);
        cleared++;
      }
    }

    if (cleared > 0) {
      console.log(`[SessionManager] Cleared ${cleared} old sessions`);
    }
    return cleared;
  }

  /**
   * Get session statistics
   * @param {string} sessionId - Session identifier
   * @returns {Object} Session statistics
   */
  getSessionStats(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    return {
      sessionId: session.sessionId,
      commandCount: session.commandHistory.length,
      createdAt: session.createdAt,
      lastAccessedAt: session.lastAccessedAt,
      lastCommandTime: session.lastCommandTime,
      workingDirectory: session.workingDirectory,
      uptime: Date.now() - session.createdAt.getTime()
    };
  }

  /**
   * Parse command output for state changes
   * @param {string} sessionId - Session identifier
   * @param {string} command - Executed command
   * @param {string} output - Command output
   */
  parseCommandForStateChanges(sessionId, command, output) {
    const session = this.getSession(sessionId);
    if (!session) {
      console.warn(`[SessionManager] Cannot parse state changes: session ${sessionId} not found`);
      return;
    }

    try {
      // Detect directory changes (cd commands)
      if (command.trim().startsWith('cd ')) {
        const newDir = command.substring(3).trim();
        
        if (newDir.startsWith('/')) {
          // Absolute path
          this.updateCurrentDirectory(sessionId, newDir);
          console.log(`[SessionManager] Detected directory change to: ${newDir}`);
        } else if (newDir === '..') {
          // Parent directory
          const currentDir = session.workingDirectory;
          const parentDir = currentDir.substring(0, currentDir.lastIndexOf('/')) || '/';
          this.updateCurrentDirectory(sessionId, parentDir);
          console.log(`[SessionManager] Detected directory change to parent: ${parentDir}`);
        } else if (newDir === '~') {
          // Home directory
          this.updateCurrentDirectory(sessionId, '/root');
          console.log(`[SessionManager] Detected directory change to home: /root`);
        } else if (newDir && newDir !== '-') {
          // Relative path
          const newPath = `${session.workingDirectory}/${newDir}`.replace('//', '/');
          this.updateCurrentDirectory(sessionId, newPath);
          console.log(`[SessionManager] Detected directory change to: ${newPath}`);
        }
      }

      // Detect environment variable changes (export commands)
      if (command.trim().startsWith('export ')) {
        const match = command.match(/export\s+(\w+)=(.+)/);
        if (match) {
          const [, varName, value] = match;
          const cleanValue = value.replace(/['"]/g, '').trim();
          this.trackEnvironmentChange(sessionId, varName, cleanValue);
          console.log(`[SessionManager] Detected environment variable: ${varName}=${cleanValue}`);
        }
      }

      // Detect package installations (apt install, apt-get install)
      if (command.includes('apt install') || command.includes('apt-get install')) {
        const match = command.match(/install\s+(.+)/);
        if (match) {
          const packages = match[1].split(' ').filter(pkg => pkg && !pkg.startsWith('-') && pkg !== 'install');
          packages.forEach(pkg => {
            this.addInstalledPackage(sessionId, pkg);
            console.log(`[SessionManager] Detected package installation: ${pkg}`);
          });
        }
      }

      // Detect file creation (touch command)
      if (command.trim().startsWith('touch ')) {
        const fileName = command.substring(6).trim().split(' ')[0];
        if (fileName) {
          const filePath = fileName.startsWith('/') 
            ? fileName 
            : `${session.workingDirectory}/${fileName}`.replace('//', '/');
          
          this.addCreatedResource(sessionId, {
            type: 'file',
            path: filePath,
            name: fileName
          });
          console.log(`[SessionManager] Detected file creation: ${filePath}`);
        }
      }

      // Detect file creation (output redirection >)
      if (command.includes('>') && !command.includes('>>')) {
        const match = command.match(/>\s*([^\s&|;]+)/);
        if (match) {
          const fileName = match[1];
          const filePath = fileName.startsWith('/') 
            ? fileName 
            : `${session.workingDirectory}/${fileName}`.replace('//', '/');
          
          this.addCreatedResource(sessionId, {
            type: 'file',
            path: filePath,
            name: fileName
          });
          console.log(`[SessionManager] Detected file creation via redirection: ${filePath}`);
        }
      }

      // Detect directory creation (mkdir command)
      if (command.trim().startsWith('mkdir ')) {
        const dirName = command.substring(6).trim().split(' ').filter(d => !d.startsWith('-'))[0];
        if (dirName) {
          const dirPath = dirName.startsWith('/') 
            ? dirName 
            : `${session.workingDirectory}/${dirName}`.replace('//', '/');
          
          this.addCreatedResource(sessionId, {
            type: 'directory',
            path: dirPath,
            name: dirName
          });
          console.log(`[SessionManager] Detected directory creation: ${dirPath}`);
        }
      }

    } catch (error) {
      console.error(`[SessionManager] Error parsing command for state changes:`, error);
    }
  }

  /**
   * Track environment variable change
   * @param {string} sessionId - Session identifier
   * @param {string} varName - Variable name
   * @param {string} value - Variable value
   */
  trackEnvironmentChange(sessionId, varName, value) {
    const session = this.getSession(sessionId);
    if (!session) {
      console.warn(`[SessionManager] Cannot track env change: session ${sessionId} not found`);
      return;
    }

    if (!session.environmentVariables) {
      session.environmentVariables = {};
    }

    session.environmentVariables[varName] = value;
    this.sessions.set(sessionId, session);

    console.log(`[SessionManager] Tracked env change: ${varName}=${value}`);
  }

  /**
   * Generate context-aware system prompt
   * @param {string} sessionId - Session identifier
   * @returns {string} Context prompt to inject into system prompt
   */
  generateContextPrompt(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      return '';
    }

    let contextPrompt = '\n\n═══════════════════════════════════════════════════════════════════════\n';
    contextPrompt += 'CURRENT TERMINAL SESSION CONTEXT\n';
    contextPrompt += '═══════════════════════════════════════════════════════════════════════\n\n';

    // Tmux session ID
    contextPrompt += `Tmux Session: ${session.tmuxSessionId || session.sessionId}\n`;

    // Working directory
    contextPrompt += `Working Directory: ${session.workingDirectory || '/root'}\n`;

    // Recent commands (last 5)
    const recentCommands = this.getCommandHistory(sessionId, 5);
    if (recentCommands.length > 0) {
      contextPrompt += `\nRecent Commands:\n`;
      recentCommands.forEach((cmd, idx) => {
        const exitStatus = cmd.exitCode === 0 ? '✓' : '✗';
        contextPrompt += `  ${idx + 1}. ${cmd.command} ${exitStatus} (exit: ${cmd.exitCode}, pwd: ${cmd.workingDirectory})\n`;
      });
    }

    // Running processes
    if (session.contextState?.runningProcesses?.length > 0) {
      contextPrompt += `\nRunning Processes:\n`;
      session.contextState.runningProcesses.slice(0, 10).forEach(proc => {
        contextPrompt += `  - ${proc.id}: ${proc.command} (status: ${proc.status})\n`;
      });
    }

    // Environment variables (key ones)
    if (session.environmentVariables && Object.keys(session.environmentVariables).length > 0) {
      contextPrompt += `\nEnvironment Variables:\n`;
      Object.entries(session.environmentVariables).forEach(([key, value]) => {
        // Don't expose sensitive variables
        if (!key.toLowerCase().includes('password') && !key.toLowerCase().includes('secret')) {
          contextPrompt += `  ${key}=${value}\n`;
        }
      });
    }

    // Installed packages
    if (session.contextState?.installedPackages?.length > 0) {
      contextPrompt += `\nInstalled Packages: ${session.contextState.installedPackages.join(', ')}\n`;
    }

    // Created resources (last 5)
    if (session.contextState?.createdResources?.length > 0) {
      contextPrompt += `\nCreated Resources:\n`;
      session.contextState.createdResources.slice(-5).forEach(resource => {
        contextPrompt += `  - ${resource.type}: ${resource.path}\n`;
      });
    }

    contextPrompt += '\n═══════════════════════════════════════════════════════════════════════\n';
    contextPrompt += 'Use this context to make informed decisions. All commands will execute\n';
    contextPrompt += `in tmux session "${session.tmuxSessionId || session.sessionId}" with the above state.\n`;
    contextPrompt += '═══════════════════════════════════════════════════════════════════════\n\n';

    return contextPrompt;
  }

  /**
   * Query commands by description or pattern
   * @param {string} sessionId - Session identifier
   * @param {string} query - Search query
   * @returns {Array} Matching commands
   */
  queryCommandsByDescription(sessionId, query) {
    const history = this.getCommandHistory(sessionId);
    const queryLower = query.toLowerCase();

    return history.filter(cmd => {
      return cmd.command.toLowerCase().includes(queryLower) ||
             (cmd.output && cmd.output.toLowerCase().includes(queryLower));
    });
  }

  /**
   * Get or create tmux session for conversation
   * @param {string} conversationId - Unique conversation identifier
   * @returns {string} tmuxSessionId
   */
  getOrCreateTmuxSession(conversationId) {
    // Check if conversation already has a tmux session
    if (this.conversationToSession.has(conversationId)) {
      const tmuxSessionId = this.conversationToSession.get(conversationId);
      console.log(`[SessionManager] Using existing tmux session ${tmuxSessionId} for conversation ${conversationId}`);
      return tmuxSessionId;
    }

    // CRITICAL: Always use "shared" session for browser visibility
    const tmuxSessionId = 'shared';
    console.log(`[SessionManager] Using shared tmux session for conversation ${conversationId}`);

    // Don't create - shared session already exists
    // this.createTmuxSession(tmuxSessionId);

    // Map conversation to session
    this.conversationToSession.set(conversationId, tmuxSessionId);

    // Initialize session context if it doesn't exist
    if (!this.sessions.has(tmuxSessionId)) {
      this.createSession(tmuxSessionId, {
        conversationId,
        tmuxSessionId,
        workingDirectory: '/root'
      });
    }

    console.log(`[SessionManager] Created tmux session ${tmuxSessionId} for conversation ${conversationId}`);
    return tmuxSessionId;
  }

  /**
   * Create tmux session if it doesn't exist
   * NOTE: This method doesn't actually create the tmux session directly.
   * The MCP tools (running in the container) will create the session when needed.
   * This method just logs that we're tracking this session ID.
   * 
   * @param {string} tmuxSessionId - Tmux session identifier
   * @returns {boolean} Always returns true (session will be created by MCP tools)
   */
  createTmuxSession(tmuxSessionId) {
    // Don't try to create tmux session from Windows host
    // The MCP tools running in the Docker container will handle tmux session creation
    console.log(`[SessionManager] Tracking tmux session: ${tmuxSessionId} (will be created by MCP tools if needed)`);
    return true;
  }

  /**
   * Get session for conversation
   * @param {string} conversationId - Conversation identifier
   * @returns {string|null} Session ID or null if not found
   */
  getSessionForConversation(conversationId) {
    return this.conversationToSession.get(conversationId) || null;
  }

  /**
   * Start periodic auto-save timer
   * Saves all sessions every 5 minutes
   */
  startAutoSave() {
    if (this.autoSaveTimer) {
      console.log('[SessionManager] Auto-save already running');
      return;
    }

    const AUTOSAVE_INTERVAL = 5 * 60 * 1000; // 5 minutes
    this.autoSaveTimer = setInterval(() => {
      this.saveAllSessions().catch(error => {
        console.error('[SessionManager] Auto-save failed:', error);
      });
    }, AUTOSAVE_INTERVAL);

    console.log('[SessionManager] Auto-save started (interval: 5 minutes)');
  }

  /**
   * Stop periodic auto-save timer
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      console.log('[SessionManager] Auto-save stopped');
    }
  }

  /**
   * Save all active sessions to disk
   * @returns {Promise<number>} Number of sessions saved
   */
  async saveAllSessions() {
    console.log(`[SessionManager] Saving ${this.sessions.size} sessions...`);
    let savedCount = 0;

    for (const [sessionId, sessionContext] of this.sessions.entries()) {
      try {
        const success = await this.sessionPersistence.saveSession(sessionId, sessionContext);
        if (success) {
          savedCount++;
        }
      } catch (error) {
        console.error(`[SessionManager] Failed to save session ${sessionId}:`, error);
      }
    }

    console.log(`[SessionManager] Saved ${savedCount}/${this.sessions.size} sessions`);
    return savedCount;
  }

  /**
   * Save a single session to disk
   * @param {string} sessionId - Session identifier
   * @returns {Promise<boolean>} True if saved successfully
   */
  async saveSession(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      console.warn(`[SessionManager] Cannot save non-existent session: ${sessionId}`);
      return false;
    }

    try {
      return await this.sessionPersistence.saveSession(sessionId, session);
    } catch (error) {
      console.error(`[SessionManager] Failed to save session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Restore all sessions from disk on startup
   * @returns {Promise<number>} Number of sessions restored
   */
  async restoreSessionsOnStartup() {
    console.log('[SessionManager] Restoring sessions from disk...');
    
    try {
      const sessionIds = await this.sessionPersistence.listSessions();
      console.log(`[SessionManager] Found ${sessionIds.length} saved sessions`);

      let restoredCount = 0;

      for (const sessionId of sessionIds) {
        try {
          const sessionContext = await this.sessionPersistence.loadSession(sessionId);
          
          if (!sessionContext) {
            console.warn(`[SessionManager] Failed to load session ${sessionId}`);
            continue;
          }

          // Restore session to memory
          this.sessions.set(sessionId, sessionContext);

          // Restore conversation mapping if available
          if (sessionContext.conversationId) {
            this.conversationToSession.set(sessionContext.conversationId, sessionId);
          }

          // Verify tmux session still exists, recreate if needed
          if (sessionContext.tmuxSessionId) {
            this.createTmuxSession(sessionContext.tmuxSessionId);
          }

          restoredCount++;
          console.log(`[SessionManager] Restored session ${sessionId} (tmux: ${sessionContext.tmuxSessionId})`);
        } catch (error) {
          console.error(`[SessionManager] Failed to restore session ${sessionId}:`, error);
        }
      }

      console.log(`[SessionManager] Restored ${restoredCount}/${sessionIds.length} sessions`);
      return restoredCount;
    } catch (error) {
      console.error('[SessionManager] Failed to restore sessions:', error);
      return 0;
    }
  }

  /**
   * Setup graceful shutdown handler
   * Saves all sessions before exit
   */
  setupGracefulShutdown() {
    const shutdownHandler = async (signal) => {
      console.log(`\n[SessionManager] Received ${signal}, saving sessions before exit...`);
      
      // Stop auto-save timer
      this.stopAutoSave();

      // Save all sessions
      try {
        await this.saveAllSessions();
        console.log('[SessionManager] All sessions saved successfully');
      } catch (error) {
        console.error('[SessionManager] Failed to save sessions on shutdown:', error);
      }

      process.exit(0);
    };

    process.on('SIGINT', shutdownHandler);
    process.on('SIGTERM', shutdownHandler);
    
    console.log('[SessionManager] Graceful shutdown handlers registered');
  }
}

module.exports = SessionContextManager;
