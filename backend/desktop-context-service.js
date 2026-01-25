const WindowFocusDetector = require('./window-focus-detector');
const ScreenCaptureManager = require('./screen-capture-manager');
const DirectorySyncManager = require('./directory-sync-manager');
const EventEmitter = require('events');

/**
 * DesktopContextService
 * 
 * Orchestrates desktop context capture by coordinating window focus detection,
 * screen capture, OCR, and directory synchronization.
 */
class DesktopContextService extends EventEmitter {
  /**
   * Create a DesktopContextService instance
   * @param {Object} mcpClient - MCP Client for terminal commands
   * @param {Object} config - Configuration options
   */
  constructor(mcpClient, config = {}) {
    super();
    this.mcpClient = mcpClient;
    this.containerName = config.containerName || 'kali-pentest';
    
    // Configuration
    this.config = {
      captureInterval: config.captureInterval || 5000,
      captureEnabled: config.captureEnabled !== false,
      ocrEnabled: config.ocrEnabled !== false,
      directorySyncEnabled: config.directorySyncEnabled !== false,
      maxCaptureResolution: config.maxCaptureResolution || '1920x1080',
      captureTimeout: config.captureTimeout || 10000
    };

    // Components
    this.windowFocusDetector = null;
    this.screenCaptureManager = null;
    this.directorySyncManager = null;

    // State
    this.isRunning = false;
    this.captureInterval = null;
    this.currentContext = {
      focusedWindow: null,
      currentDirectory: null,
      screenContent: null,
      lastUpdate: null,
      captureEnabled: this.config.captureEnabled,
      ocrEnabled: this.config.ocrEnabled,
      directorySyncEnabled: this.config.directorySyncEnabled
    };
  }

  /**
   * Initialize the service and its components
   */
  async initialize() {
    console.log('[DesktopContextService] Initializing...');

    // Initialize WindowFocusDetector
    this.windowFocusDetector = new WindowFocusDetector(this.containerName);

    // Initialize ScreenCaptureManager
    this.screenCaptureManager = new ScreenCaptureManager(this.containerName, {
      maxCaptureResolution: this.config.maxCaptureResolution,
      captureTimeout: this.config.captureTimeout
    });

    // Initialize DirectorySyncManager
    this.directorySyncManager = new DirectorySyncManager(this.mcpClient, this.containerName);

    // Listen to directory changes
    this.directorySyncManager.on('directory-changed', (directory) => {
      console.log(`[DesktopContextService] Directory changed: ${directory}`);
      this.currentContext.currentDirectory = directory;
      this.broadcastContext();
    });

    console.log('[DesktopContextService] Initialized');
  }

  /**
   * Start the context capture service
   */
  async start() {
    if (this.isRunning) {
      console.log('[DesktopContextService] Already running');
      return;
    }

    console.log('[DesktopContextService] Starting...');
    this.isRunning = true;

    // Start directory monitoring if enabled
    if (this.config.directorySyncEnabled) {
      await this.directorySyncManager.startMonitoring();
    }

    // Start capture loop
    this._startCaptureLoop();

    console.log('[DesktopContextService] Started');
  }

  /**
   * Stop the context capture service
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('[DesktopContextService] Stopping...');
    this.isRunning = false;

    // Stop capture loop
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    // Stop directory monitoring
    if (this.directorySyncManager) {
      await this.directorySyncManager.stopMonitoring();
    }

    console.log('[DesktopContextService] Stopped');
  }

  /**
   * Start the capture loop
   * @private
   */
  _startCaptureLoop() {
    // Initial capture
    this._captureContext().catch(err => {
      console.error('[DesktopContextService] Initial capture failed:', err.message);
    });

    // Set up interval
    this.captureInterval = setInterval(async () => {
      try {
        await this._captureContext();
      } catch (error) {
        console.error('[DesktopContextService] Capture error:', error.message);
      }
    }, this.config.captureInterval);
  }

  /**
   * Capture desktop context
   * @private
   */
  async _captureContext() {
    try {
      console.log('[DesktopContextService] Capturing context...');

      // Capture window focus
      let focusedWindow = null;
      try {
        focusedWindow = await this.windowFocusDetector.getFocusedWindow();
        if (focusedWindow) {
          console.log(`[DesktopContextService] Focused window: ${focusedWindow.application} - ${focusedWindow.title}`);
        } else {
          console.log('[DesktopContextService] No window focused');
        }
      } catch (error) {
        console.warn('[DesktopContextService] Window focus detection failed:', error.message);
      }

      // Capture screen and perform OCR if enabled
      let screenContent = null;
      if (this.config.captureEnabled) {
        try {
          const captureResult = await this.screenCaptureManager.captureAndOCR(this.config.ocrEnabled);
          screenContent = captureResult.ocrText;
        } catch (error) {
          console.warn('[DesktopContextService] Screen capture failed:', error.message);
        }
      }

      // Update context
      this.currentContext = {
        focusedWindow,
        currentDirectory: this.currentContext.currentDirectory, // Preserve from directory sync
        screenContent,
        lastUpdate: new Date(),
        captureEnabled: this.config.captureEnabled,
        ocrEnabled: this.config.ocrEnabled,
        directorySyncEnabled: this.config.directorySyncEnabled
      };

      // Broadcast context update
      this.broadcastContext();

      console.log('[DesktopContextService] Context captured successfully');
    } catch (error) {
      console.error('[DesktopContextService] Context capture failed:', error.message);
      // Continue running even if capture fails
    }
  }

  /**
   * Get current desktop context
   * @returns {Object} Current context
   */
  getContext() {
    return { ...this.currentContext };
  }

  /**
   * Broadcast context update to listeners
   */
  broadcastContext() {
    this.emit('context-update', this.getContext());
  }

  /**
   * Update service settings
   * @param {Object} settings - New settings
   */
  async updateSettings(settings) {
    console.log('[DesktopContextService] Updating settings:', settings);

    const wasRunning = this.isRunning;

    // Stop if running
    if (wasRunning) {
      await this.stop();
    }

    // Update configuration
    if (settings.captureInterval !== undefined) {
      this.config.captureInterval = Math.max(5000, Math.min(60000, settings.captureInterval));
    }
    if (settings.captureEnabled !== undefined) {
      this.config.captureEnabled = settings.captureEnabled;
    }
    if (settings.ocrEnabled !== undefined) {
      this.config.ocrEnabled = settings.ocrEnabled;
    }
    if (settings.directorySyncEnabled !== undefined) {
      this.config.directorySyncEnabled = settings.directorySyncEnabled;
    }

    // Update context state
    this.currentContext.captureEnabled = this.config.captureEnabled;
    this.currentContext.ocrEnabled = this.config.ocrEnabled;
    this.currentContext.directorySyncEnabled = this.config.directorySyncEnabled;

    // Restart if was running
    if (wasRunning) {
      await this.start();
    }

    // Broadcast updated context
    this.broadcastContext();

    console.log('[DesktopContextService] Settings updated');
  }
}

module.exports = DesktopContextService;
