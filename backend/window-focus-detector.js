const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * WindowFocusDetector
 * 
 * Detects the currently focused window in the X11 desktop environment
 * and extracts window properties like title and application name.
 * 
 * Uses xdotool and xprop to interact with the X11 window manager.
 */
class WindowFocusDetector {
  /**
   * Create a WindowFocusDetector instance
   * @param {string} containerName - Name of the Docker container running X11
   */
  constructor(containerName) {
    this.containerName = containerName;
    this.display = ':99'; // Default DISPLAY for kali-pentest container
  }

  /**
   * Get the currently focused window
   * @returns {Promise<Object|null>} Window information or null if no window focused
   * @returns {Object} result
   * @returns {string} result.windowId - X11 window ID
   * @returns {string} result.title - Window title
   * @returns {string} result.application - Friendly application name
   * @returns {string} result.windowClass - Raw window class
   */
  async getFocusedWindow() {
    try {
      // Get focused window ID using xdotool
      const windowId = await this._getWindowId();
      
      if (!windowId) {
        console.log('[WindowFocusDetector] No window currently focused');
        return null;
      }

      // Get window properties
      const properties = await this.getWindowProperties(windowId);
      
      return {
        windowId,
        ...properties
      };
    } catch (error) {
      console.error('[WindowFocusDetector] Error getting focused window:', error.message);
      throw error;
    }
  }

  /**
   * Get the focused window ID using xdotool
   * @private
   * @returns {Promise<string|null>} Window ID or null
   */
  async _getWindowId() {
    try {
      const command = `docker exec -e DISPLAY=${this.display} ${this.containerName} xdotool getwindowfocus`;
      const { stdout, stderr } = await execAsync(command);

      if (stderr && stderr.includes('Error')) {
        throw new Error(`xdotool error: ${stderr}`);
      }

      const windowId = stdout.trim();
      
      // Check if it's a valid window ID (numeric)
      if (!/^\d+$/.test(windowId)) {
        console.warn('[WindowFocusDetector] Invalid window ID:', windowId);
        return null;
      }

      return windowId;
    } catch (error) {
      // Handle X11 connection errors gracefully
      if (error.message.includes("Can't open display")) {
        console.warn('[WindowFocusDetector] X11 display not available');
        return null;
      }
      throw error;
    }
  }

  /**
   * Get window properties using xprop
   * @param {string} windowId - X11 window ID
   * @returns {Promise<Object>} Window properties
   * @returns {string} result.title - Window title (from WM_NAME)
   * @returns {string} result.application - Friendly application name
   * @returns {string} result.windowClass - Raw window class (from WM_CLASS)
   */
  async getWindowProperties(windowId) {
    try {
      // Validate window ID is numeric
      if (!/^\d+$/.test(windowId)) {
        throw new Error(`Invalid window ID: ${windowId}`);
      }

      const command = `docker exec -e DISPLAY=${this.display} ${this.containerName} xprop -id ${windowId} WM_NAME WM_CLASS`;
      const { stdout, stderr } = await execAsync(command);

      if (stderr && stderr.includes('Error')) {
        throw new Error(`xprop error: ${stderr}`);
      }

      // Parse xprop output
      const properties = this._parseXpropOutput(stdout);
      
      // Extract friendly application name from window class
      const application = this._extractApplicationName(properties.windowClass);

      return {
        title: properties.title || 'Unknown',
        application: application || 'Unknown',
        windowClass: properties.windowClass || 'Unknown'
      };
    } catch (error) {
      // Handle cases where window properties are unavailable
      if (error.message.includes('no such window')) {
        console.warn('[WindowFocusDetector] Window no longer exists:', windowId);
        return {
          title: 'Unknown',
          application: 'Unknown',
          windowClass: 'Unknown'
        };
      }
      throw error;
    }
  }

  /**
   * Parse xprop output to extract window properties
   * @private
   * @param {string} output - Raw xprop output
   * @returns {Object} Parsed properties
   */
  _parseXpropOutput(output) {
    const properties = {
      title: null,
      windowClass: null
    };

    // Parse WM_NAME (window title)
    const nameMatch = output.match(/WM_NAME\(.*?\)\s*=\s*"(.+?)"/);
    if (nameMatch) {
      properties.title = nameMatch[1];
    }

    // Parse WM_CLASS (application class)
    // WM_CLASS format: WM_CLASS(STRING) = "instance", "class"
    const classMatch = output.match(/WM_CLASS\(.*?\)\s*=\s*"(.+?)",\s*"(.+?)"/);
    if (classMatch) {
      // Use the class name (second value) as it's more descriptive
      properties.windowClass = classMatch[2];
    }

    return properties;
  }

  /**
   * Extract friendly application name from window class
   * @private
   * @param {string} windowClass - Raw window class from WM_CLASS
   * @returns {string} Friendly application name
   */
  _extractApplicationName(windowClass) {
    if (!windowClass || windowClass === 'Unknown') {
      return 'Unknown';
    }

    // Map common window classes to friendly names
    const appNameMap = {
      'Thunar': 'File Manager',
      'Firefox': 'Firefox Browser',
      'firefox': 'Firefox Browser',
      'Chromium': 'Chromium Browser',
      'chromium': 'Chromium Browser',
      'Xfce4-terminal': 'Terminal',
      'xfce4-terminal': 'Terminal',
      'Gnome-terminal': 'Terminal',
      'gnome-terminal': 'Terminal',
      'Code': 'VS Code',
      'code': 'VS Code',
      'Gedit': 'Text Editor',
      'gedit': 'Text Editor',
      'Mousepad': 'Text Editor',
      'mousepad': 'Text Editor',
      'Evince': 'Document Viewer',
      'evince': 'Document Viewer',
      'Gimp': 'GIMP',
      'gimp': 'GIMP',
      'Vlc': 'VLC Media Player',
      'vlc': 'VLC Media Player',
      'Xfdesktop': 'Desktop',
      'xfdesktop': 'Desktop',
      'Xfce4-panel': 'Panel',
      'xfce4-panel': 'Panel'
    };

    // Return mapped name or original class name
    return appNameMap[windowClass] || windowClass;
  }
}

module.exports = WindowFocusDetector;
