/**
 * Desktop Action Intent Detector
 * Detects when user intent requires desktop actions vs terminal commands
 * and suggests appropriate tools
 */

class DesktopActionIntentDetector {
  constructor() {
    // Keywords that indicate desktop actions
    this.desktopActionKeywords = [
      // Application launching
      'open', 'launch', 'start', 'run', 'execute',
      // UI interaction
      'click', 'press', 'type', 'enter', 'select', 'choose',
      // Navigation
      'go to', 'navigate', 'switch to', 'focus', 'move to',
      // Window management
      'close', 'minimize', 'maximize', 'resize', 'move',
      // Browser-specific
      'browser', 'firefox', 'chrome', 'web', 'internet',
      // Visual
      'show', 'display', 'see', 'look at', 'view', 'screenshot',
      // Input
      'fill', 'input', 'write', 'paste'
    ];

    // Application names
    this.applicationNames = [
      'firefox', 'chrome', 'chromium', 'browser',
      'terminal', 'konsole', 'gnome-terminal',
      'editor', 'gedit', 'kate', 'vim', 'nano',
      'calculator', 'calc',
      'files', 'nautilus', 'thunar', 'dolphin',
      'settings', 'preferences',
      'thunderbird', 'mail',
      'libreoffice', 'writer', 'calc', 'impress'
    ];

    // UI element keywords
    this.uiElementKeywords = [
      'button', 'link', 'menu', 'icon', 'window',
      'dialog', 'form', 'field', 'input', 'checkbox',
      'radio', 'dropdown', 'tab', 'panel'
    ];
  }

  /**
   * Detect if user intent requires desktop actions
   * @param {string} userMessage - User's message/request
   * @returns {Object} Intent detection result
   */
  detectIntent(userMessage) {
    const lowerMessage = userMessage.toLowerCase();

    // Check for desktop action keywords
    const hasDesktopKeyword = this.desktopActionKeywords.some(keyword =>
      lowerMessage.includes(keyword)
    );

    // Check for application names
    const hasApplicationName = this.applicationNames.some(app =>
      lowerMessage.includes(app)
    );

    // Check for UI element keywords
    const hasUIElement = this.uiElementKeywords.some(element =>
      lowerMessage.includes(element)
    );

    // Determine intent type
    if (hasDesktopKeyword || hasApplicationName || hasUIElement) {
      const confidence = this._calculateConfidence(
        hasDesktopKeyword,
        hasApplicationName,
        hasUIElement
      );

      return {
        type: 'desktop_action',
        confidence,
        suggestedTools: this.suggestTools(lowerMessage),
        detectedKeywords: this._getDetectedKeywords(lowerMessage),
        detectedApplications: this._getDetectedApplications(lowerMessage)
      };
    }

    return {
      type: 'terminal_command',
      confidence: 'medium',
      suggestedTools: ['write_command'],
      detectedKeywords: [],
      detectedApplications: []
    };
  }

  /**
   * Calculate confidence level
   * @private
   */
  _calculateConfidence(hasKeyword, hasApp, hasUI) {
    const score = (hasKeyword ? 1 : 0) + (hasApp ? 1 : 0) + (hasUI ? 1 : 0);
    
    if (score >= 2) return 'high';
    if (score === 1) return 'medium';
    return 'low';
  }

  /**
   * Get detected keywords from message
   * @private
   */
  _getDetectedKeywords(message) {
    return this.desktopActionKeywords.filter(keyword =>
      message.includes(keyword)
    );
  }

  /**
   * Get detected applications from message
   * @private
   */
  _getDetectedApplications(message) {
    return this.applicationNames.filter(app =>
      message.includes(app)
    );
  }

  /**
   * Suggest which tools to use based on intent
   * @param {string} message - User's message
   * @returns {Array<string>} List of suggested tool names
   */
  suggestTools(message) {
    const tools = [];

    // Opening/launching applications
    if (message.includes('open') || message.includes('launch') || message.includes('start')) {
      tools.push('desktop-vision_get_windows');
      tools.push('desktop-vision_press_key');
    }

    // Clicking UI elements
    if (message.includes('click') || message.includes('button') || message.includes('link')) {
      tools.push('desktop-vision_see_screen');
      tools.push('desktop-vision_click');
    }

    // Typing text
    if (message.includes('type') || message.includes('enter') || message.includes('fill') || message.includes('input')) {
      tools.push('desktop-vision_type_text');
      tools.push('desktop-vision_click'); // May need to click to focus first
    }

    // Visual inspection
    if (message.includes('see') || message.includes('show') || message.includes('display') || message.includes('screenshot')) {
      tools.push('desktop-vision_see_screen');
      tools.push('desktop-vision_read_screen_text');
    }

    // Window management
    if (message.includes('close') || message.includes('minimize') || message.includes('maximize')) {
      tools.push('desktop-vision_get_windows');
      tools.push('desktop-vision_press_key');
    }

    // Navigation
    if (message.includes('navigate') || message.includes('go to') || message.includes('switch')) {
      tools.push('desktop-vision_get_windows');
      tools.push('desktop-vision_click');
    }

    // Scrolling
    if (message.includes('scroll') || message.includes('page down') || message.includes('page up')) {
      tools.push('desktop-vision_scroll');
    }

    // Always include get_windows for desktop actions if not already added
    if (tools.length > 0 && !tools.includes('desktop-vision_get_windows')) {
      tools.unshift('desktop-vision_get_windows');
    }

    // If no specific tools identified but it's a desktop action, suggest observation tools
    if (tools.length === 0) {
      tools.push('desktop-vision_get_windows');
      tools.push('desktop-vision_see_screen');
    }

    return tools;
  }

  /**
   * Get action type from message
   * @param {string} message - User's message
   * @returns {string} Action type
   */
  getActionType(message) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('open') || lowerMessage.includes('launch') || lowerMessage.includes('start')) {
      return 'launch_application';
    }

    if (lowerMessage.includes('click')) {
      return 'click_element';
    }

    if (lowerMessage.includes('type') || lowerMessage.includes('enter') || lowerMessage.includes('fill')) {
      return 'type_text';
    }

    if (lowerMessage.includes('close')) {
      return 'close_window';
    }

    if (lowerMessage.includes('scroll')) {
      return 'scroll';
    }

    if (lowerMessage.includes('see') || lowerMessage.includes('show') || lowerMessage.includes('screenshot')) {
      return 'observe';
    }

    return 'unknown';
  }

  /**
   * Check if message is asking to open a specific application
   * @param {string} message - User's message
   * @returns {Object|null} Application info or null
   */
  detectApplicationLaunch(message) {
    const lowerMessage = message.toLowerCase();

    // Check if it's a launch request
    const isLaunchRequest = ['open', 'launch', 'start', 'run'].some(verb =>
      lowerMessage.includes(verb)
    );

    if (!isLaunchRequest) {
      return null;
    }

    // Detect specific applications
    const appMappings = {
      'firefox': { name: 'Firefox', command: 'firefox', searchTerm: 'firefox' },
      'browser': { name: 'Firefox', command: 'firefox', searchTerm: 'firefox' },
      'chrome': { name: 'Chrome', command: 'google-chrome', searchTerm: 'chrome' },
      'chromium': { name: 'Chromium', command: 'chromium', searchTerm: 'chromium' },
      'terminal': { name: 'Terminal', command: 'gnome-terminal', searchTerm: 'terminal' },
      'calculator': { name: 'Calculator', command: 'gnome-calculator', searchTerm: 'calculator' },
      'files': { name: 'Files', command: 'nautilus', searchTerm: 'files' },
      'editor': { name: 'Text Editor', command: 'gedit', searchTerm: 'text editor' }
    };

    for (const [keyword, appInfo] of Object.entries(appMappings)) {
      if (lowerMessage.includes(keyword)) {
        return {
          detected: true,
          ...appInfo,
          launchMethod: 'application_menu' // Default method
        };
      }
    }

    return null;
  }

  /**
   * Get suggested launch method for an application
   * @param {string} appName - Application name
   * @returns {Array<string>} List of launch methods in priority order
   */
  getSuggestedLaunchMethods(appName) {
    // Priority order of launch methods
    return [
      'application_menu',  // Super key + type name + Enter
      'desktop_icon',      // Click icon on desktop
      'command_line'       // Use terminal command
    ];
  }
}

module.exports = DesktopActionIntentDetector;
