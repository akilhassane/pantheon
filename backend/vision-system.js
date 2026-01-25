const ScreenCaptureManager = require('./screen-capture-manager');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

/**
 * Enhanced Vision System for AI Desktop Agent
 * Provides continuous screen capture, OCR, and image processing
 */
class VisionSystem {
  constructor(config = {}) {
    this.containerName = config.containerName || 'kali-pentest';
    this.captureInterval = config.captureInterval || 1000; // 1 FPS default
    this.imageQuality = config.imageQuality || 80;
    this.maxImageSize = config.maxImageSize || 1024;
    this.enableOCR = config.enableOCR !== false;
    
    // Initialize screen capture manager
    this.captureManager = new ScreenCaptureManager(this.containerName, {
      captureDir: '/tmp/agent-captures',
      captureTimeout: 10000,
    });
    
    // State
    this.isCapturing = false;
    this.captureTimer = null;
    this.lastScreenshot = null;
    this.screenshotCache = [];
    this.maxCacheSize = config.screenshotCacheSize || 10;
    
    // Callbacks
    this.onScreenshotCallback = null;
  }

  /**
   * Start continuous screen capture
   * @param {number} fps - Frames per second (optional, uses config default)
   * @param {Function} onScreenshot - Callback for each screenshot
   */
  async startCapture(fps = null, onScreenshot = null) {
    if (this.isCapturing) {
      console.log('[VisionSystem] Capture already running');
      return;
    }

    const interval = fps ? 1000 / fps : this.captureInterval;
    this.onScreenshotCallback = onScreenshot;
    
    console.log(`[VisionSystem] Starting continuous capture at ${1000/interval} FPS`);
    
    this.isCapturing = true;
    
    // Capture immediately
    await this._captureFrame();
    
    // Then start interval
    this.captureTimer = setInterval(async () => {
      if (this.isCapturing) {
        await this._captureFrame();
      }
    }, interval);
  }

  /**
   * Stop continuous capture
   */
  async stopCapture() {
    if (!this.isCapturing) {
      return;
    }

    console.log('[VisionSystem] Stopping continuous capture');
    
    this.isCapturing = false;
    
    if (this.captureTimer) {
      clearInterval(this.captureTimer);
      this.captureTimer = null;
    }
  }

  /**
   * Capture a single screenshot
   * @returns {Promise<Object>} Screenshot object
   */
  async captureScreen() {
    try {
      const result = await this.captureManager.captureAndOCR(this.enableOCR);
      
      // Read image and convert to base64
      const imageData = await this._readImageFromContainer(result.imagePath);
      const base64 = await this._compressAndEncode(imageData);
      
      const screenshot = {
        imageData,
        base64,
        width: 1920, // TODO: Get actual dimensions
        height: 1080,
        timestamp: result.timestamp,
        imagePath: result.imagePath,
        ocrText: result.ocrText || null,
      };
      
      this.lastScreenshot = screenshot;
      this._addToCache(screenshot);
      
      return screenshot;
    } catch (error) {
      console.error('[VisionSystem] Screenshot capture failed:', error);
      throw error;
    }
  }

  /**
   * Capture a specific window
   * @param {string} windowId - X11 window ID
   * @returns {Promise<Object>} Screenshot object
   */
  async captureWindow(windowId) {
    try {
      const timestamp = Date.now();
      const filename = `window_${windowId}_${timestamp}.png`;
      const imagePath = `/tmp/agent-captures/${filename}`;
      
      // Use import command to capture specific window
      const cmd = `docker exec -e DISPLAY=:99 ${this.containerName} import -window ${windowId} ${imagePath}`;
      await execAsync(cmd);
      
      // Read and process image
      const imageData = await this._readImageFromContainer(imagePath);
      const base64 = await this._compressAndEncode(imageData);
      
      // Get window info
      const windowInfo = await this._getWindowInfo(windowId);
      
      const screenshot = {
        imageData,
        base64,
        width: windowInfo.width || 1920,
        height: windowInfo.height || 1080,
        timestamp: new Date(timestamp),
        imagePath,
        windowInfo,
      };
      
      return screenshot;
    } catch (error) {
      console.error('[VisionSystem] Window capture failed:', error);
      throw error;
    }
  }

  /**
   * Extract text from image using OCR
   * @param {Buffer} image - Image buffer
   * @returns {Promise<string>} Extracted text
   */
  async extractText(image) {
    try {
      // Save image temporarily
      const tempPath = `/tmp/agent-captures/ocr_temp_${Date.now()}.png`;
      const localTempPath = path.join(__dirname, 'temp_ocr.png');
      
      await fs.writeFile(localTempPath, image);
      
      // Copy to container
      await execAsync(`docker cp ${localTempPath} ${this.containerName}:${tempPath}`);
      
      // Perform OCR
      const text = await this.captureManager.performOCR(tempPath);
      
      // Cleanup
      await fs.unlink(localTempPath).catch(() => {});
      await execAsync(`docker exec ${this.containerName} rm -f ${tempPath}`).catch(() => {});
      
      return text;
    } catch (error) {
      console.error('[VisionSystem] OCR failed:', error);
      return '';
    }
  }

  /**
   * Detect changes between two screenshots
   * @param {Object} before - Before screenshot
   * @param {Object} after - After screenshot
   * @returns {Promise<Object>} Visual diff information
   */
  async detectChanges(before, after) {
    // Simple implementation: compare OCR text
    // TODO: Implement pixel-based diff for more accuracy
    
    const beforeText = before.ocrText || '';
    const afterText = after.ocrText || '';
    
    const textChanged = beforeText !== afterText;
    const timeDiff = after.timestamp - before.timestamp;
    
    return {
      hasChanges: textChanged,
      textChanged,
      timeDiff,
      beforeText: beforeText.substring(0, 500),
      afterText: afterText.substring(0, 500),
    };
  }

  /**
   * Get last captured screenshot
   * @returns {Object|null} Last screenshot or null
   */
  getLastScreenshot() {
    return this.lastScreenshot;
  }

  /**
   * Get screenshot cache
   * @returns {Array} Array of cached screenshots
   */
  getScreenshotCache() {
    return this.screenshotCache;
  }

  /**
   * Clear screenshot cache
   */
  clearCache() {
    this.screenshotCache = [];
  }

  /**
   * Capture frame (internal)
   * @private
   */
  async _captureFrame() {
    try {
      const screenshot = await this.captureScreen();
      
      // Call callback if provided
      if (this.onScreenshotCallback) {
        this.onScreenshotCallback(screenshot);
      }
    } catch (error) {
      console.error('[VisionSystem] Frame capture failed:', error);
    }
  }

  /**
   * Read image from container
   * @private
   */
  async _readImageFromContainer(imagePath) {
    try {
      // Copy image from container to local temp file
      const localTempPath = path.join(__dirname, `temp_${Date.now()}.png`);
      await execAsync(`docker cp ${this.containerName}:${imagePath} ${localTempPath}`);
      
      // Read image data
      const imageData = await fs.readFile(localTempPath);
      
      // Cleanup local temp file
      await fs.unlink(localTempPath).catch(() => {});
      
      return imageData;
    } catch (error) {
      console.error('[VisionSystem] Failed to read image from container:', error);
      throw error;
    }
  }

  /**
   * Compress and encode image to base64
   * @private
   */
  async _compressAndEncode(imageData) {
    try {
      // For now, just convert to base64
      // TODO: Implement actual compression with sharp or similar
      const base64 = `data:image/png;base64,${imageData.toString('base64')}`;
      return base64;
    } catch (error) {
      console.error('[VisionSystem] Image encoding failed:', error);
      throw error;
    }
  }

  /**
   * Get window information
   * @private
   */
  async _getWindowInfo(windowId) {
    try {
      const cmd = `docker exec -e DISPLAY=:99 ${this.containerName} xwininfo -id ${windowId}`;
      const { stdout } = await execAsync(cmd);
      
      // Parse window info
      const widthMatch = stdout.match(/Width:\s+(\d+)/);
      const heightMatch = stdout.match(/Height:\s+(\d+)/);
      const titleMatch = stdout.match(/xwininfo: Window id:.*"(.*)"/);
      
      return {
        windowId,
        width: widthMatch ? parseInt(widthMatch[1]) : null,
        height: heightMatch ? parseInt(heightMatch[1]) : null,
        title: titleMatch ? titleMatch[1] : null,
      };
    } catch (error) {
      console.error('[VisionSystem] Failed to get window info:', error);
      return { windowId };
    }
  }

  /**
   * Add screenshot to cache
   * @private
   */
  _addToCache(screenshot) {
    this.screenshotCache.push(screenshot);
    
    // Keep cache size limited
    if (this.screenshotCache.length > this.maxCacheSize) {
      this.screenshotCache.shift();
    }
  }
}

module.exports = VisionSystem;
