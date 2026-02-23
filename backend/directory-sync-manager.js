const { exec } = require('child_process');
const { promisify } = require('util');
const EventEmitter = require('events');

const execAsync = promisify(exec);

/**
 * DirectorySyncManager
 * 
 * Monitors the file manager window and synchronizes the terminal's working directory
 * with the currently displayed directory in the file manager.
 */
class DirectorySyncManager extends EventEmitter {
  /**
   * Create a DirectorySyncManager instance
   * @param {Object} mcpClient - MCP Client for executing terminal commands
   * @param {string} containerName - Name of the Docker container
   */
  constructor(mcpClient, containerName) {
    super();
    this.mcpClient = mcpClient;
    this.containerName = containerName;
    this.display = ':99';
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.lastDirectory = null;
    this.lastWindowTitle = null; // Track last window title to detect changes
    this.debounceTimeout = null;
    this.debounceDelay = 500; // ms
    this.pollInterval = 2000; // Poll every 2 seconds
    this.homeDirectory = null; // Will be detected dynamically
    this.username = null; // Will be detected dynamically
  }

  /**
   * Start monitoring file manager window for directory changes
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      console.log('[DirectorySyncManager] Already monitoring');
      return;
    }

    console.log('[DirectorySyncManager] Starting directory monitoring...');
    
    // Detect home directory and username
    await this._detectHomeDirectory();
    
    this.isMonitoring = true;

    // Poll for file manager window changes
    this.monitoringInterval = setInterval(async () => {
      try {
        await this._checkFileManagerWindow();
      } catch (error) {
        console.error('[DirectorySyncManager] Monitoring error:', error.message);
      }
    }, this.pollInterval);

    console.log('[DirectorySyncManager] Directory monitoring started');
  }

  /**
   * Stop monitoring file manager window
   */
  async stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    console.log('[DirectorySyncManager] Stopping directory monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }

    console.log('[DirectorySyncManager] Directory monitoring stopped');
  }

  /**
   * Check file manager window for directory changes
   * @private
   */
  async _checkFileManagerWindow() {
    try {
      // Get focused window
      const windowId = await this._getFocusedWindowId();
      if (!windowId) {
        return;
      }

      // Get window class to check if it's a file manager
      const windowClass = await this._getWindowClass(windowId);
      if (!this._isFileManager(windowClass)) {
        return;
      }

      let directory = null;

      // For Thunar, try to get the directory from the process command line
      if (windowClass && windowClass.toLowerCase().includes('thunar')) {
        const pid = await this._getWindowPid(windowId);
        if (pid) {
          directory = await this._getThunarDirectory(pid);
        }
      }

      // Fallback: try to extract from window title
      if (!directory) {
        const windowTitle = await this._getWindowTitle(windowId);
        
        // Only log if window title changed (reduce noise)
        if (windowTitle !== this.lastWindowTitle) {
          console.log(`[DirectorySyncManager] Window title changed: "${this.lastWindowTitle}" -> "${windowTitle}"`);
          this.lastWindowTitle = windowTitle;
        }
        
        if (windowTitle) {
          directory = await this.extractDirectoryFromWindow(windowTitle);
          if (directory) {
            console.log(`[DirectorySyncManager] Extracted directory: "${directory}"`);
          } else if (windowTitle !== this.lastWindowTitle) {
            console.log(`[DirectorySyncManager] Could not extract directory from title`);
          }
        }
      }

      if (!directory) {
        return;
      }

      // Check if directory changed
      if (directory !== this.lastDirectory) {
        console.log(`[DirectorySyncManager] Directory changed: ${this.lastDirectory} -> ${directory}`);
        this.lastDirectory = directory;

        // Debounce directory sync
        this._debouncedSync(directory);
      }
    } catch (error) {
      // Log but don't throw - monitoring should continue
      console.warn('[DirectorySyncManager] Check failed:', error.message);
    }
  }

  /**
   * Get focused window ID
   * @private
   */
  async _getFocusedWindowId() {
    try {
      const command = `docker exec -e DISPLAY=${this.display} ${this.containerName} xdotool getwindowfocus`;
      const { stdout } = await execAsync(command);
      const windowId = stdout.trim();
      return /^\d+$/.test(windowId) ? windowId : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get window class
   * @private
   */
  async _getWindowClass(windowId) {
    try {
      const command = `docker exec -e DISPLAY=${this.display} ${this.containerName} xprop -id ${windowId} WM_CLASS`;
      const { stdout } = await execAsync(command);
      const match = stdout.match(/WM_CLASS\(.*?\)\s*=\s*"(.+?)",\s*"(.+?)"/);
      return match ? match[2] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get window title
   * @private
   */
  async _getWindowTitle(windowId) {
    try {
      const command = `docker exec -e DISPLAY=${this.display} ${this.containerName} xprop -id ${windowId} WM_NAME`;
      const { stdout } = await execAsync(command);
      const match = stdout.match(/WM_NAME\(.*?\)\s*=\s*"(.+?)"/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get window PID
   * @private
   */
  async _getWindowPid(windowId) {
    try {
      const command = `docker exec -e DISPLAY=${this.display} ${this.containerName} xprop -id ${windowId} _NET_WM_PID`;
      const { stdout } = await execAsync(command);
      const match = stdout.match(/_NET_WM_PID\(CARDINAL\)\s*=\s*(\d+)/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get Thunar's current directory by checking its command line arguments
   * @private
   */
  async _getThunarDirectory(pid) {
    try {
      // Try to get the directory from Thunar's command line
      const command = `docker exec ${this.containerName} cat /proc/${pid}/cmdline`;
      const { stdout } = await execAsync(command);
      
      // cmdline is null-separated, split and look for directory paths
      const args = stdout.split('\0').filter(arg => arg.startsWith('/'));
      if (args.length > 0) {
        // Return the first path argument
        return args[0];
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if window class is a file manager
   * @private
   */
  _isFileManager(windowClass) {
    if (!windowClass) return false;
    const fileManagers = ['Thunar', 'thunar', 'Nautilus', 'nautilus', 'Nemo', 'nemo', 'Dolphin', 'dolphin', 'PCManFM', 'pcmanfm'];
    return fileManagers.includes(windowClass);
  }

  /**
   * Detect home directory and username dynamically
   * @private
   */
  async _detectHomeDirectory() {
    try {
      // First, try to detect the user running the X11 session (desktop/file manager)
      // This is more accurate than just checking whoami
      const psCommand = `docker exec ${this.containerName} ps aux`;
      const { stdout: psOutput } = await execAsync(psCommand);
      
      // Look for xfce4-session or file manager processes to find the desktop user
      const xfceMatch = psOutput.match(/^(\S+)\s+\d+.*xfce4-session/m);
      const thunarMatch = psOutput.match(/^(\S+)\s+\d+.*[Tt]hunar/m);
      
      let desktopUser = null;
      if (xfceMatch) {
        desktopUser = xfceMatch[1];
      } else if (thunarMatch) {
        desktopUser = thunarMatch[1];
      }
      
      // If we found a desktop user, get their home directory
      if (desktopUser && desktopUser !== 'root') {
        // Handle abbreviated usernames like "pentest+" -> "pentester"
        if (desktopUser.endsWith('+')) {
          // Get full username from /etc/passwd
          const passwdCommand = `docker exec ${this.containerName} cat /etc/passwd`;
          const { stdout: passwdOutput } = await execAsync(passwdCommand);
          const passwdMatch = passwdOutput.match(new RegExp(`^(${desktopUser.slice(0, -1)}[^:]*):.*?:.*?:.*?:.*?:([^:]+):`, 'm'));
          if (passwdMatch) {
            this.username = passwdMatch[1];
            this.homeDirectory = passwdMatch[2];
          }
        } else {
          this.username = desktopUser;
          // Get home directory from /etc/passwd
          const passwdCommand = `docker exec ${this.containerName} grep "^${desktopUser}:" /etc/passwd`;
          const { stdout: passwdLine } = await execAsync(passwdCommand);
          const homeMatch = passwdLine.match(/:([^:]+):[^:]+$/);
          if (homeMatch) {
            this.homeDirectory = homeMatch[1];
          }
        }
      }
      
      // Fallback: use container's default user
      if (!this.homeDirectory) {
        const command = `docker exec ${this.containerName} sh -c "echo $HOME"`;
        const { stdout } = await execAsync(command);
        this.homeDirectory = stdout.trim();
        
        // Extract username from home directory (e.g., /home/kali -> kali)
        const match = this.homeDirectory.match(/\/home\/([^/]+)$/);
        if (match) {
          this.username = match[1];
        } else {
          // Fallback: try to get username directly
          const userCommand = `docker exec ${this.containerName} whoami`;
          const { stdout: userStdout } = await execAsync(userCommand);
          this.username = userStdout.trim();
          // If home directory wasn't detected, construct it
          if (!this.homeDirectory || this.homeDirectory === '/root') {
            this.homeDirectory = `/home/${this.username}`;
          }
        }
      }
      
      console.log(`[DirectorySyncManager] Detected home directory: ${this.homeDirectory}, username: ${this.username}`);
    } catch (error) {
      console.warn('[DirectorySyncManager] Failed to detect home directory, using defaults:', error.message);
      // Fallback to common defaults
      this.homeDirectory = '/home/pentester';
      this.username = 'pentester';
    }
  }

  /**
   * Debounced directory sync
   * @private
   */
  _debouncedSync(directory) {
    // Clear existing timeout
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    // Set new timeout
    this.debounceTimeout = setTimeout(async () => {
      try {
        await this.syncTerminalDirectory(directory);
      } catch (error) {
        console.error('[DirectorySyncManager] Sync failed:', error.message);
      }
    }, this.debounceDelay);
  }

  /**
   * Extract directory path from window title
   * @param {string} windowTitle - Window title from file manager
   * @returns {Promise<string|null>} Directory path or null
   */
  async extractDirectoryFromWindow(windowTitle) {
    if (!windowTitle) {
      return null;
    }

    // Thunar and other file managers can show:
    // 1. Full path with suffix: "/etc/nginx/conf.d - File Manager"
    // 2. Full path without suffix: "/var/log/apache2"
    // 3. Directory name only: "Documents - File Manager"
    
    let directory = null;

    // Pattern 1: Full absolute path in title
    // First, try to match path with " - File Manager" or similar suffix
    const pathWithSuffixMatch = windowTitle.match(/^(\/[^-]+?)\s+-\s+(?:File Manager|Thunar|Nautilus|Nemo|Dolphin|PCManFM)/);
    if (pathWithSuffixMatch) {
      directory = pathWithSuffixMatch[1].trim();
      // Remove trailing slashes except for root
      if (directory !== '/' && directory.endsWith('/')) {
        directory = directory.slice(0, -1);
      }
    }
    // If no suffix, try to match just a path (e.g., "/var/log/apache2")
    else if (windowTitle.startsWith('/')) {
      // Match the entire path - everything that looks like a valid path
      const pathOnlyMatch = windowTitle.match(/^(\/[^\n\r]*?)(?:\s*$)/);
      if (pathOnlyMatch) {
        directory = pathOnlyMatch[1].trim();
        // Remove trailing slashes except for root
        if (directory !== '/' && directory.endsWith('/')) {
          directory = directory.slice(0, -1);
        }
      }
    }
    // Pattern 2: Just directory name (e.g., "Documents - File Manager" or "Documents - Thunar")
    else {
      const dirNameMatch = windowTitle.match(/^([^-]+?)\s*-\s*(?:File Manager|Thunar|Nautilus|Nemo|Dolphin|PCManFM)$/);
      if (dirNameMatch) {
        const dirName = dirNameMatch[1].trim();
        
        // Use dynamically detected home directory
        const homeDir = this.homeDirectory || '/home/pentester';
        
        // Try common directories mapping first
        const commonDirs = {
          'File Manager': homeDir,
          'Home': homeDir,
          'Desktop': `${homeDir}/Desktop`,
          'Documents': `${homeDir}/Documents`,
          'Downloads': `${homeDir}/Downloads`,
          'Pictures': `${homeDir}/Pictures`,
          'Music': `${homeDir}/Music`,
          'Videos': `${homeDir}/Videos`,
          // Common system directories
          'root': '/root',
          'etc': '/etc',
          'var': '/var',
          'usr': '/usr',
          'opt': '/opt',
          'tmp': '/tmp',
          'bin': '/bin',
          'sbin': '/sbin',
          'lib': '/lib',
          'boot': '/boot',
          'dev': '/dev',
          'proc': '/proc',
          'sys': '/sys',
          'mnt': '/mnt',
          'media': '/media',
          'srv': '/srv'
        };
        
        if (commonDirs[dirName]) {
          directory = commonDirs[dirName];
        } else {
          // Try to find the directory by searching common locations first (fast)
          const possiblePaths = [
            `/${dirName}`,                      // Root level (e.g., /app, /workspace)
            `${homeDir}/${dirName}`,            // User home (dynamic)
            `/usr/${dirName}`,                  // System directories
            `/opt/${dirName}`,                  // Optional software
            `/var/${dirName}`,                  // Variable data
            `/etc/${dirName}`,                  // Configuration
            `/mnt/${dirName}`,                  // Mount points
            `/media/${dirName}`                 // Media mounts
          ];
          
          // Check each possible path
          for (const path of possiblePaths) {
            const exists = await this._directoryExists(path);
            if (exists) {
              directory = path;
              break;
            }
          }
          
          // If still not found, do a deeper search in home directory and common locations
          if (!directory) {
            directory = await this._findDirectoryByName(dirName, homeDir);
          }
        }
      }
    }

    if (!directory) {
      return null;
    }

    // Sanitize path to prevent command injection
    directory = this._sanitizePath(directory);

    // Validate directory exists
    const exists = await this._directoryExists(directory);
    if (!exists) {
      console.warn(`[DirectorySyncManager] Directory does not exist: ${directory}`);
      return null;
    }

    return directory;
  }

  /**
   * Sanitize directory path to prevent command injection
   * @private
   */
  _sanitizePath(path) {
    // Remove any shell metacharacters
    // Allow only: alphanumeric, /, -, _, .
    return path.replace(/[^a-zA-Z0-9/_.-]/g, '');
  }

  /**
   * Check if directory exists in container
   * @private
   */
  async _directoryExists(directory) {
    try {
      const command = `docker exec ${this.containerName} test -d "${directory}" && echo "exists"`;
      const { stdout } = await execAsync(command);
      return stdout.trim() === 'exists';
    } catch (error) {
      return false;
    }
  }

  /**
   * Find directory by name using find command
   * Searches in home directory and common locations
   * Prioritizes subdirectories of the last known location
   * @private
   */
  async _findDirectoryByName(dirName, homeDir) {
    try {
      // If we have a last known directory, check if dirName is a subdirectory first
      if (this.lastDirectory) {
        const subdirPath = `${this.lastDirectory}/${dirName}`;
        const exists = await this._directoryExists(subdirPath);
        if (exists) {
          console.log(`[DirectorySyncManager] Found as subdirectory: ${subdirPath}`);
          return subdirPath;
        }
        
        // Also check parent directory (user might have navigated up then into a sibling)
        const parentDir = this.lastDirectory.substring(0, this.lastDirectory.lastIndexOf('/')) || '/';
        const siblingPath = `${parentDir}/${dirName}`;
        if (siblingPath !== subdirPath) {
          const siblingExists = await this._directoryExists(siblingPath);
          if (siblingExists) {
            console.log(`[DirectorySyncManager] Found as sibling directory: ${siblingPath}`);
            return siblingPath;
          }
        }
      }
      
      // Search in home directory first (most likely location)
      // Use maxdepth 3 to balance between coverage and performance
      const searchPaths = [
        homeDir,
        '/etc',
        '/var',
        '/opt'
      ];
      
      for (const searchPath of searchPaths) {
        try {
          const command = `docker exec ${this.containerName} find "${searchPath}" -maxdepth 3 -type d -name "${dirName}" 2>/dev/null | head -n 1`;
          const { stdout } = await execAsync(command);
          const foundPath = stdout.trim();
          
          if (foundPath) {
            console.log(`[DirectorySyncManager] Found directory via search: ${foundPath}`);
            return foundPath;
          }
        } catch (error) {
          // Continue to next search path
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.warn('[DirectorySyncManager] Directory search failed:', error.message);
      return null;
    }
  }

  /**
   * Sync terminal working directory
   * @param {string} path - Directory path to sync to
   */
  async syncTerminalDirectory(path) {
    try {
      console.log(`[DirectorySyncManager] Syncing terminal to: ${path}`);

      // Sanitize path
      const sanitizedPath = this._sanitizePath(path);

      // Validate directory exists
      const exists = await this._directoryExists(sanitizedPath);
      if (!exists) {
        throw new Error(`Directory does not exist: ${sanitizedPath}`);
      }

      // Use MCP Client to execute cd command
      // The write_command tool will type the command in the terminal
      const command = `cd "${sanitizedPath}"`;
      
      try {
        await this.mcpClient.callTool('write_command', { command });
        console.log(`[DirectorySyncManager] Terminal synced to: ${sanitizedPath}`);

        // Emit directory-changed event
        this.emit('directory-changed', sanitizedPath);
      } catch (mcpError) {
        console.error('[DirectorySyncManager] MCP command failed:', mcpError.message);
        throw new Error(`Failed to sync terminal directory: ${mcpError.message}`);
      }
    } catch (error) {
      console.error('[DirectorySyncManager] Sync failed:', error.message);
      throw error;
    }
  }
}

module.exports = DirectorySyncManager;
