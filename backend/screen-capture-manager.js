const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

/**
 * ScreenCaptureManager
 * 
 * Handles screen capture and OCR processing for the desktop context system.
 * Captures screenshots from the X11 display and extracts text using Tesseract OCR.
 */
class ScreenCaptureManager {
  /**
   * Create a ScreenCaptureManager instance
   * @param {string} containerName - Name of the Docker container
   * @param {Object} config - Configuration options
   * @param {string} config.maxCaptureResolution - Maximum resolution (e.g., '1920x1080')
   * @param {number} config.captureTimeout - Timeout for capture operations in ms
   * @param {string} config.captureDir - Directory to store captures (default: /tmp/desktop-captures)
   */
  constructor(containerName, config = {}) {
    this.containerName = containerName;
    this.display = ':99'; // Default DISPLAY for kali-pentest container
    this.maxCaptureResolution = config.maxCaptureResolution || '1920x1080';
    this.captureTimeout = config.captureTimeout || 10000;
    this.captureDir = config.captureDir || '/tmp/desktop-captures';
    this.maxCaptures = 5; // Keep only last 5 captures
  }

  /**
   * Capture the current screen
   * @returns {Promise<Object>} Capture result
   * @returns {string} result.imagePath - Path to captured image in container
   * @returns {Date} result.timestamp - Capture timestamp
   */
  async captureScreen() {
    const timestamp = Date.now();
    const filename = `capture_${timestamp}.png`;
    const imagePath = path.posix.join(this.captureDir, filename);

    try {
      console.log('[ScreenCaptureManager] Capturing screen...');
      
      // Build scrot command with resolution limiting
      const command = `docker exec -e DISPLAY=${this.display} ${this.containerName} scrot ${imagePath}`;
      
      // Execute with timeout protection
      const capturePromise = execAsync(command);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Screen capture timeout')), this.captureTimeout)
      );

      await Promise.race([capturePromise, timeoutPromise]);

      console.log(`[ScreenCaptureManager] Screen captured: ${imagePath}`);

      return {
        imagePath,
        timestamp: new Date(timestamp)
      };
    } catch (error) {
      // Handle capture errors gracefully
      if (error.message.includes('timeout')) {
        console.error('[ScreenCaptureManager] Screen capture timed out');
        throw new Error('Screen capture timeout');
      }
      
      if (error.message.includes("Can't open display")) {
        console.error('[ScreenCaptureManager] X11 display not available');
        throw new Error('X11 display not available');
      }

      console.error('[ScreenCaptureManager] Screen capture failed:', error.message);
      throw error;
    }
  }

  /**
   * Perform OCR on a captured image
   * @param {string} imagePath - Path to image file in container
   * @returns {Promise<string>} Extracted text (limited to 10KB)
   */
  async performOCR(imagePath) {
    try {
      console.log('[ScreenCaptureManager] Performing OCR...');

      // Build tesseract command
      // Output to stdout for easier capture
      const command = `docker exec ${this.containerName} tesseract ${imagePath} stdout`;

      // Execute with timeout protection
      const ocrPromise = execAsync(command, {
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for OCR output
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('OCR processing timeout')), this.captureTimeout)
      );

      const { stdout } = await Promise.race([ocrPromise, timeoutPromise]);

      // Limit OCR text to 10KB
      let ocrText = stdout.trim();
      const maxTextSize = 10 * 1024; // 10KB
      
      if (ocrText.length > maxTextSize) {
        console.warn(`[ScreenCaptureManager] OCR text truncated from ${ocrText.length} to ${maxTextSize} bytes`);
        ocrText = ocrText.substring(0, maxTextSize) + '\n... [truncated]';
      }

      console.log(`[ScreenCaptureManager] OCR complete: ${ocrText.length} characters extracted`);

      return ocrText;
    } catch (error) {
      // Handle OCR errors gracefully
      if (error.message.includes('timeout')) {
        console.error('[ScreenCaptureManager] OCR processing timed out');
        throw new Error('OCR processing timeout');
      }

      if (error.message.includes('Tesseract') || error.message.includes('tesseract')) {
        console.error('[ScreenCaptureManager] Tesseract not available or failed');
        throw new Error('Tesseract OCR failed');
      }

      console.error('[ScreenCaptureManager] OCR failed:', error.message);
      throw error;
    }
  }

  /**
   * Clean up old screen captures
   * Keeps only the most recent captures (up to maxCaptures)
   * @returns {Promise<number>} Number of files deleted
   */
  async cleanupOldCaptures() {
    try {
      console.log('[ScreenCaptureManager] Cleaning up old captures...');

      // List all capture files sorted by modification time (oldest first)
      const listCommand = `docker exec ${this.containerName} bash -c "ls -t ${this.captureDir}/capture_*.png 2>/dev/null || true"`;
      const { stdout } = await execAsync(listCommand);

      const files = stdout.trim().split('\n').filter(f => f.length > 0);

      if (files.length <= this.maxCaptures) {
        console.log(`[ScreenCaptureManager] No cleanup needed (${files.length} files)`);
        return 0;
      }

      // Keep only the most recent maxCaptures files
      // Files are sorted newest first by ls -t, so we want to delete from index maxCaptures onwards
      const filesToDelete = files.slice(this.maxCaptures);

      if (filesToDelete.length === 0) {
        return 0;
      }

      // Delete old files
      const deleteCommand = `docker exec ${this.containerName} rm -f ${filesToDelete.join(' ')}`;
      await execAsync(deleteCommand);

      console.log(`[ScreenCaptureManager] Deleted ${filesToDelete.length} old capture(s)`);
      return filesToDelete.length;
    } catch (error) {
      // Handle cleanup errors gracefully - don't fail the whole operation
      console.warn('[ScreenCaptureManager] Cleanup failed (non-critical):', error.message);
      return 0;
    }
  }

  /**
   * Capture screen and perform OCR in one operation
   * @param {boolean} performOCR - Whether to perform OCR (default: true)
   * @returns {Promise<Object>} Capture result with optional OCR text
   * @returns {string} result.imagePath - Path to captured image
   * @returns {Date} result.timestamp - Capture timestamp
   * @returns {string} [result.ocrText] - Extracted text (if performOCR is true)
   */
  async captureAndOCR(performOCR = true) {
    try {
      // Capture screen
      const captureResult = await this.captureScreen();

      // Perform OCR if requested
      let ocrText = null;
      if (performOCR) {
        try {
          ocrText = await this.performOCR(captureResult.imagePath);
        } catch (ocrError) {
          // Log OCR error but don't fail the whole operation
          console.warn('[ScreenCaptureManager] OCR failed, continuing without text:', ocrError.message);
        }
      }

      // Clean up old captures (async, don't wait)
      this.cleanupOldCaptures().catch(err => {
        console.warn('[ScreenCaptureManager] Background cleanup failed:', err.message);
      });

      return {
        ...captureResult,
        ocrText
      };
    } catch (error) {
      console.error('[ScreenCaptureManager] Capture and OCR failed:', error.message);
      throw error;
    }
  }
}

module.exports = ScreenCaptureManager;
