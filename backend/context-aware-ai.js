/**
 * Context-Aware AI Response Generator
 * Injects session context, command history, and file structure into AI prompts
 */

class ContextAwareAI {
  constructor(sessionManager, systemPrompt, codebaseAwareness) {
    this.sessionManager = sessionManager;
    this.systemPrompt = systemPrompt;
    this.codebaseAwareness = codebaseAwareness;
    this.maxTokens = 8000; // Conservative limit for context
    this.contextCache = new Map();
  }

  /**
   * Build complete context for AI request
   */
  async buildContext(sessionId, userMessage, options = {}) {
    const {
      includeCommandHistory = true,
      includeFileStructure = false,
      includeProjectInfo = false,
      maxHistoryCommands = 10
    } = options;

    const context = {
      systemPrompt: '',
      sessionContext: null,
      commandHistory: [],
      fileStructure: null,
      projectInfo: null,
      workingDirectory: null
    };

    // Get session
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    context.sessionContext = session;
    context.workingDirectory = session.workingDirectory;

    // Generate system prompt with session context
    context.systemPrompt = this.systemPrompt.generatePrompt(sessionId, {
      includeHistory: includeCommandHistory,
      maxHistoryCommands
    });

    // Add command history
    if (includeCommandHistory) {
      context.commandHistory = this.sessionManager.getCommandHistory(
        sessionId,
        maxHistoryCommands
      );
    }

    // Add file structure if requested
    if (includeFileStructure) {
      context.fileStructure = await this.getFileStructureContext(
        session.workingDirectory
      );
    }

    // Add project info if requested
    if (includeProjectInfo) {
      context.projectInfo = await this.getProjectInfoContext(
        session.workingDirectory
      );
    }

    return context;
  }

  /**
   * Get file structure context
   */
  async getFileStructureContext(workingDirectory) {
    const cacheKey = `filestructure:${workingDirectory}`;
    const cached = this.contextCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.data;
    }

    try {
      const listing = await this.codebaseAwareness.listDirectory(
        workingDirectory,
        { recursive: false, includeHidden: false }
      );

      const context = {
        workingDirectory,
        entries: listing.entries,
        fileCount: listing.files,
        directoryCount: listing.directories
      };

      this.contextCache.set(cacheKey, {
        data: context,
        timestamp: Date.now()
      });

      return context;

    } catch (error) {
      console.error('Error getting file structure context:', error);
      return null;
    }
  }

  /**
   * Get project info context
   */
  async getProjectInfoContext(workingDirectory) {
    const cacheKey = `projectinfo:${workingDirectory}`;
    const cached = this.contextCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 min cache
      return cached.data;
    }

    try {
      const projectInfo = await this.codebaseAwareness.analyzeProjectStructure(
        workingDirectory
      );

      this.contextCache.set(cacheKey, {
        data: projectInfo,
        timestamp: Date.now()
      });

      return projectInfo;

    } catch (error) {
      console.error('Error getting project info context:', error);
      return null;
    }
  }

  /**
   * Format context for AI prompt
   */
  formatContextForPrompt(context) {
    let formattedContext = context.systemPrompt;

    // Add working directory
    if (context.workingDirectory) {
      formattedContext += `\n\nCurrent Working Directory: ${context.workingDirectory}`;
    }

    // Add command history summary
    if (context.commandHistory && context.commandHistory.length > 0) {
      formattedContext += '\n\nRecent Commands:';
      context.commandHistory.forEach((cmd, index) => {
        formattedContext += `\n${index + 1}. ${cmd.command}`;
        if (cmd.exitCode !== 0) {
          formattedContext += ` (failed with exit code ${cmd.exitCode})`;
        }
      });
    }

    // Add file structure
    if (context.fileStructure) {
      formattedContext += '\n\nCurrent Directory Contents:';
      formattedContext += `\n- ${context.fileStructure.fileCount} files`;
      formattedContext += `\n- ${context.fileStructure.directoryCount} directories`;
      
      if (context.fileStructure.entries && context.fileStructure.entries.length > 0) {
        formattedContext += '\n\nKey files and directories:';
        context.fileStructure.entries.slice(0, 10).forEach(entry => {
          const type = entry.isDirectory ? '[DIR]' : '[FILE]';
          formattedContext += `\n${type} ${entry.name}`;
        });
      }
    }

    // Add project info
    if (context.projectInfo && !context.projectInfo.error) {
      formattedContext += '\n\nProject Information:';
      formattedContext += `\n- Type: ${context.projectInfo.projectType}`;
      if (context.projectInfo.languages.length > 0) {
        formattedContext += `\n- Languages: ${context.projectInfo.languages.join(', ')}`;
      }
      if (context.projectInfo.packageManager) {
        formattedContext += `\n- Package Manager: ${context.projectInfo.packageManager}`;
      }
      if (context.projectInfo.hasDocker) {
        formattedContext += '\n- Has Docker configuration';
      }
      if (context.projectInfo.hasTests) {
        formattedContext += '\n- Has test suite';
      }
    }

    return formattedContext;
  }

  /**
   * Truncate context to fit token limit
   */
  truncateContext(context, maxTokens = this.maxTokens) {
    const estimatedTokens = Math.ceil(context.length / 4);
    
    if (estimatedTokens <= maxTokens) {
      return context;
    }

    // Calculate how much to keep
    const targetLength = maxTokens * 4;
    const keepRatio = targetLength / context.length;

    // Keep system prompt and recent context
    const lines = context.split('\n');
    const systemPromptEnd = lines.findIndex(line => 
      line.includes('CURRENT SESSION CONTEXT')
    );

    if (systemPromptEnd === -1) {
      // Just truncate from the end
      return context.substring(0, targetLength) + '\n\n[Context truncated due to length]';
    }

    // Keep system prompt intact, truncate history
    const systemPrompt = lines.slice(0, systemPromptEnd).join('\n');
    const sessionContext = lines.slice(systemPromptEnd).join('\n');
    
    const availableLength = targetLength - systemPrompt.length;
    const truncatedSession = sessionContext.substring(0, availableLength);

    return systemPrompt + '\n' + truncatedSession + '\n\n[Context truncated due to length]';
  }

  /**
   * Enhance user message with context references
   */
  enhanceUserMessage(userMessage, context) {
    let enhanced = userMessage;

    // Add references to recent commands if relevant
    if (context.commandHistory && context.commandHistory.length > 0) {
      const lastCommand = context.commandHistory[context.commandHistory.length - 1];
      
      // Check if user is referring to "last command" or "previous"
      if (/last|previous|that|it/i.test(userMessage)) {
        enhanced += `\n\n[Note: Last command was: ${lastCommand.command}]`;
      }
    }

    return enhanced;
  }

  /**
   * Determine optimal context level based on message
   */
  determineContextLevel(userMessage) {
    const message = userMessage.toLowerCase();

    // High context: Complex tasks, debugging, analysis
    if (
      message.includes('debug') ||
      message.includes('analyze') ||
      message.includes('investigate') ||
      message.includes('find all') ||
      message.includes('search')
    ) {
      return {
        includeCommandHistory: true,
        includeFileStructure: true,
        includeProjectInfo: true,
        maxHistoryCommands: 20
      };
    }

    // Medium context: File operations, code tasks
    if (
      message.includes('file') ||
      message.includes('directory') ||
      message.includes('code') ||
      message.includes('install') ||
      message.includes('run')
    ) {
      return {
        includeCommandHistory: true,
        includeFileStructure: true,
        includeProjectInfo: false,
        maxHistoryCommands: 10
      };
    }

    // Low context: Simple commands, quick queries
    return {
      includeCommandHistory: true,
      includeFileStructure: false,
      includeProjectInfo: false,
      maxHistoryCommands: 5
    };
  }

  /**
   * Build AI request with full context
   */
  async buildAIRequest(sessionId, userMessage, options = {}) {
    // Determine context level if not specified
    const contextLevel = options.contextLevel || 
      this.determineContextLevel(userMessage);

    // Build context
    const context = await this.buildContext(sessionId, userMessage, contextLevel);

    // Format context for prompt
    const formattedContext = this.formatContextForPrompt(context);

    // Truncate if needed
    const finalContext = this.truncateContext(formattedContext);

    // Enhance user message
    const enhancedMessage = this.enhanceUserMessage(userMessage, context);

    return {
      systemPrompt: finalContext,
      userMessage: enhancedMessage,
      context,
      metadata: {
        sessionId,
        workingDirectory: context.workingDirectory,
        commandHistoryLength: context.commandHistory.length,
        hasFileStructure: !!context.fileStructure,
        hasProjectInfo: !!context.projectInfo
      }
    };
  }

  /**
   * Update context after command execution
   */
  async updateContextAfterCommand(sessionId, command, result) {
    // Invalidate relevant caches
    const session = this.sessionManager.getSession(sessionId);
    if (session) {
      // Clear file structure cache if command might have changed it
      if (this.isFileModifyingCommand(command)) {
        const cacheKey = `filestructure:${session.workingDirectory}`;
        this.contextCache.delete(cacheKey);
      }

      // Clear project info cache if significant changes
      if (this.isProjectModifyingCommand(command)) {
        const cacheKey = `projectinfo:${session.workingDirectory}`;
        this.contextCache.delete(cacheKey);
      }
    }
  }

  /**
   * Check if command modifies files
   */
  isFileModifyingCommand(command) {
    const modifyingCommands = [
      'touch', 'mkdir', 'rm', 'mv', 'cp',
      'echo', 'cat >', 'tee', 'dd',
      'git clone', 'git pull', 'npm install',
      'pip install', 'cargo build'
    ];

    return modifyingCommands.some(cmd => command.includes(cmd));
  }

  /**
   * Check if command modifies project structure
   */
  isProjectModifyingCommand(command) {
    const projectCommands = [
      'npm install', 'npm uninstall',
      'pip install', 'pip uninstall',
      'cargo add', 'cargo remove',
      'git clone', 'git pull'
    ];

    return projectCommands.some(cmd => command.includes(cmd));
  }

  /**
   * Get context statistics
   */
  getContextStats(context) {
    const formatted = this.formatContextForPrompt(context);
    
    return {
      totalLength: formatted.length,
      estimatedTokens: Math.ceil(formatted.length / 4),
      commandHistoryCount: context.commandHistory.length,
      hasFileStructure: !!context.fileStructure,
      hasProjectInfo: !!context.projectInfo,
      cacheSize: this.contextCache.size
    };
  }

  /**
   * Clear context cache
   */
  clearCache() {
    this.contextCache.clear();
  }
}

module.exports = ContextAwareAI;
