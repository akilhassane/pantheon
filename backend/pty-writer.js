/**
 * PTY Writer Module
 * Writes commands directly to the PTY that gotty is displaying
 * This avoids WebSocket conflicts with the browser
 */

const { spawn } = require('child_process');

class PTYWriter {
  constructor(containerName = 'kali-pentest') {
    this.containerName = containerName;
    this.ptyPath = null;
    console.log(`🖥️  PTY Writer initialized for container: ${containerName}`);
    this.findGottyPTY();
  }

  /**
   * Find the PTY that gotty is using
   */
  async findGottyPTY() {
    try {
      const result = await this.execInContainer(
        `ps aux | grep 'bash --login' | grep -v grep | awk '{print $2}' | head -1`
      );
      
      if (result.trim()) {
        const pid = result.trim();
        // Get the PTY for this process
        const ttyResult = await this.execInContainer(`ps -p ${pid} -o tty=`);
        const tty = ttyResult.trim();
        
        if (tty && tty !== '?') {
          this.ptyPath = `/dev/${tty}`;
          console.log(`✅ Found gotty PTY: ${this.ptyPath} (PID: ${pid})`);
        } else {
          console.log(`⚠️  Could not determine PTY for PID ${pid}`);
        }
      }
    } catch (error) {
      console.error('❌ Error finding gotty PTY:', error.message);
    }
  }

  /**
   * Execute command in container
   */
  execInContainer(command) {
    return new Promise((resolve, reject) => {
      const proc = spawn('docker', ['exec', this.containerName, 'sh', '-c', command]);
      let output = '';
      let error = '';

      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.stderr.on('data', (data) => { error += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(error || `Command failed with code ${code}`));
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Write command to the PTY (makes it appear in the terminal)
   */
  async writeCommand(command) {
    if (!this.ptyPath) {
      // Try to find PTY again
      await this.findGottyPTY();
      
      if (!this.ptyPath) {
        console.log('⚠️  PTY not found, skipping visual echo');
        return false;
      }
    }

    try {
      console.log(`🖥️  Writing to PTY ${this.ptyPath}: ${command}`);
      
      // Write command to PTY character by character for typing effect
      for (const char of command) {
        await this.execInContainer(`echo -n '${this.escapeChar(char)}' > ${this.ptyPath}`);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Send Enter
      await this.execInContainer(`echo '' > ${this.ptyPath}`);
      
      console.log('✅ Command written to PTY');
      return true;
    } catch (error) {
      console.error('❌ Error writing to PTY:', error.message);
      return false;
    }
  }

  /**
   * Escape special characters for shell
   */
  escapeChar(char) {
    // Escape single quotes and backslashes
    return char.replace(/'/g, "'\\''").replace(/\\/g, '\\\\');
  }

  /**
   * Check if PTY writer is ready
   */
  isReady() {
    return this.ptyPath !== null;
  }
}

module.exports = PTYWriter;
