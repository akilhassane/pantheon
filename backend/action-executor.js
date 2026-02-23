const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Action Executor for X11 Desktop Control
 * Executes desktop actions via xdotool and X11 commands
 */
class ActionExecutor {
  constructor(config = {}) {
    this.display = config.display || process.env.DISPLAY || ':99';
    this.containerName = config.containerName || 'kali-pentest';
    this.smoothMouseMovement = config.smoothMouseMovement !== false;
    this.typingSpeed = config.typingSpeed || 50; // ms per character
    this.actionDelay = config.actionDelay || 100; // ms between actions
    this.maxActionDuration = config.maxActionDuration || 10000; // Increased to 10 seconds
    this.maxActionDuration = config.maxActionDuration || 5000;
  }

  /**
   * Execute a single desktop action
   * @param {Object} action - Action object with type and params
   * @returns {Promise<Object>} Execution result
   */
  async executeAction(action) {
    const startTime = Date.now();
    
    try {
      console.log(`Executing action: ${action.type}`, action.params);
      
      let result;
      switch (action.type) {
        case 'click':
          result = await this.click(action.params.x, action.params.y, action.params.button || 'left', action.params.clickCount || 1);
          break;
        case 'type':
          result = await this.typeText(action.params.text, action.params.speed);
          break;
        case 'scroll':
          result = await this.scroll(action.params.direction, action.params.amount);
          break;
        case 'drag':
          // Support both parameter formats (startX/endX and from_x/to_x)
          const startX = action.params.startX || action.params.start_x || action.params.from_x || 0;
          const startY = action.params.startY || action.params.start_y || action.params.from_y || 0;
          const endX = action.params.endX || action.params.end_x || action.params.to_x;
          const endY = action.params.endY || action.params.end_y || action.params.to_y;
          result = await this.drag(startX, startY, endX, endY);
          break;
        case 'hotkey':
          result = await this.hotkey(action.params.modifiers || [], action.params.key);
          break;
        case 'pressKey':
        case 'press_key':
          // Support simple key press (like Enter, Tab, etc.)
          result = await this.pressKey(action.params.key, action.params.modifiers || []);
          break;
        case 'wait':
          result = await this.wait(action.params.duration);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      const duration = Date.now() - startTime;
      
      return {
        success: true,
        action,
        duration,
        result,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Action execution failed:`, error);
      
      return {
        success: false,
        action,
        duration,
        error: error.message,
      };
    }
  }

  /**
   * Execute a sequence of actions
   * @param {Array} actions - Array of action objects
   * @returns {Promise<Array>} Array of execution results
   */
  async executeSequence(actions) {
    const results = [];
    
    for (const action of actions) {
      const result = await this.executeAction(action);
      results.push(result);
      
      // Stop if action failed
      if (!result.success) {
        console.error(`Action sequence stopped due to failure at step ${results.length}`);
        break;
      }
      
      // Add delay between actions
      if (this.actionDelay > 0) {
        await this.wait(this.actionDelay);
      }
    }
    
    return results;
  }

  /**
   * Move mouse to coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {boolean} smooth - Use smooth movement
   */
  async moveMouse(x, y, smooth = null) {
    smooth = smooth !== null ? smooth : this.smoothMouseMovement;
    
    const cmd = `docker exec ${this.containerName} bash -c "export DISPLAY=${this.display} && xdotool mousemove ${smooth ? '--sync' : ''} ${x} ${y}"`;
    await this._execCommand(cmd);
  }

  /**
   * Click at coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string} button - Mouse button (left, right, middle)
   * @param {number} clickCount - Number of clicks (1 or 2)
   */
  async click(x, y, button = 'left', clickCount = 1) {
    // Map button names to xdotool button numbers
    const buttonMap = {
      left: 1,
      middle: 2,
      right: 3,
    };
    
    const buttonNum = buttonMap[button] || 1;
    
    // Move to position first
    await this.moveMouse(x, y);
    
    // Wait a bit for UI to respond to hover
    await this.wait(100);
    
    // Click
    const clickCmd = clickCount === 2 ? 'click --repeat 2' : 'click';
    const cmd = `docker exec ${this.containerName} bash -c "export DISPLAY=${this.display} && xdotool ${clickCmd} ${buttonNum}"`;
    await this._execCommand(cmd);
    
    return { x, y, button, clickCount };
  }

  /**
   * Double-click at coordinates
   */
  async doubleClick(x, y) {
    return this.click(x, y, 'left', 2);
  }

  /**
   * Drag from one point to another
   * @param {number} startX - Start X coordinate
   * @param {number} startY - Start Y coordinate
   * @param {number} endX - End X coordinate
   * @param {number} endY - End Y coordinate
   */
  async drag(startX, startY, endX, endY) {
    // Move to start position
    await this.moveMouse(startX, startY);
    await this.wait(100);
    
    // Mouse down
    await this._execCommand(`docker exec ${this.containerName} bash -c "export DISPLAY=${this.display} && xdotool mousedown 1"`);
    await this.wait(100);
    
    // Move to end position
    await this.moveMouse(endX, endY);
    await this.wait(100);
    
    // Mouse up
    await this._execCommand(`docker exec ${this.containerName} bash -c "export DISPLAY=${this.display} && xdotool mouseup 1"`);
    
    return { startX, startY, endX, endY };
  }

  /**
   * Scroll in a direction
   * @param {string} direction - up, down, left, right
   * @param {number} amount - Scroll amount (wheel clicks)
   */
  async scroll(direction, amount = 750) {
    const directionMap = {
      up: 4,
      down: 5,
      left: 6,
      right: 7,
    };
    
    const button = directionMap[direction];
    if (!button) {
      throw new Error(`Invalid scroll direction: ${direction}`);
    }
    
    const cmd = `docker exec ${this.containerName} bash -c "export DISPLAY=${this.display} && xdotool click --repeat ${amount} ${button}"`;
    await this._execCommand(cmd);
    
    return { direction, amount };
  }

  /**
   * Type text
   * @param {string} text - Text to type
   * @param {number} speed - Typing speed (ms per character)
   */
  async typeText(text, speed = null) {
    speed = speed || this.typingSpeed;
    
    // Escape for bash and xdotool
    const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
    
    const cmd = `docker exec ${this.containerName} bash -c "export DISPLAY=${this.display} && xdotool type --delay ${speed} \\"${escapedText}\\""`;
    await this._execCommand(cmd);
    
    return { text, speed };
  }

  /**
   * Press a key with optional modifiers
   * @param {string} key - Key to press
   * @param {Array} modifiers - Modifier keys (ctrl, alt, shift, meta)
   */
  async pressKey(key, modifiers = []) {
    if (modifiers.length > 0) {
      return this.hotkey(modifiers, key);
    }
    
    const cmd = `docker exec ${this.containerName} bash -c "export DISPLAY=${this.display} && xdotool key ${key}"`;
    await this._execCommand(cmd);
    
    return { key };
  }

  /**
   * Press keyboard shortcut
   * @param {Array} modifiers - Modifier keys (ctrl, alt, shift, meta/super)
   * @param {string} key - Key to press
   */
  async hotkey(modifiers, key) {
    // Map meta to super for xdotool
    const mappedModifiers = modifiers.map(m => m === 'meta' ? 'super' : m);
    
    const combo = [...mappedModifiers, key].join('+');
    const cmd = `docker exec ${this.containerName} bash -c "export DISPLAY=${this.display} && xdotool key ${combo}"`;
    await this._execCommand(cmd);
    
    return { modifiers, key, combo };
  }

  /**
   * Focus a window by ID
   * @param {string} windowId - Window ID
   */
  async focusWindow(windowId) {
    const cmd = `docker exec ${this.containerName} bash -c "export DISPLAY=${this.display} && xdotool windowactivate ${windowId}"`;
    await this._execCommand(cmd);
    
    return { windowId };
  }

  /**
   * Get active window info
   * @returns {Promise<Object>} Window information
   */
  async getActiveWindow() {
    const windowIdCmd = `docker exec ${this.containerName} bash -c "export DISPLAY=${this.display} && xdotool getwindowfocus"`;
    const { stdout: windowId } = await this._execCommand(windowIdCmd);
    
    const windowNameCmd = `docker exec ${this.containerName} bash -c "export DISPLAY=${this.display} && xdotool getwindowname ${windowId.trim()}"`;
    const { stdout: windowName } = await this._execCommand(windowNameCmd);
    
    return {
      windowId: windowId.trim(),
      title: windowName.trim(),
    };
  }

  /**
   * Wait for specified duration
   * @param {number} ms - Milliseconds to wait
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get mouse position
   * @returns {Promise<Object>} Mouse coordinates {x, y}
   */
  async getMousePosition() {
    const cmd = `docker exec ${this.containerName} bash -c "export DISPLAY=${this.display} && xdotool getmouselocation --shell"`;
    const { stdout } = await this._execCommand(cmd);
    
    const lines = stdout.trim().split('\n');
    const x = parseInt(lines[0].split('=')[1]);
    const y = parseInt(lines[1].split('=')[1]);
    
    return { x, y };
  }

  /**
   * Execute shell command with timeout
   * @private
   */
  async _execCommand(cmd) {
    const timeout = this.maxActionDuration;
    
    try {
      const result = await Promise.race([
        execAsync(cmd),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Command timeout')), timeout)
        ),
      ]);
      
      return result;
    } catch (error) {
      console.error(`Command failed: ${cmd}`, error);
      throw error;
    }
  }
}

module.exports = ActionExecutor;
