/**
 * Terminal Echo Module
 * Echoes commands to the gotty WebSocket for visual display
 * while Desktop Commander handles actual execution
 */

const WebSocket = require('ws');

class TerminalEcho {
  constructor(gottyWsUrl = 'ws://kali-pentest:8080/ws') {
    this.gottyWsUrl = gottyWsUrl;
    this.ws = null;
    this.connecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    console.log(`🖥️  Terminal Echo initialized for: ${gottyWsUrl}`);
    this.connect();
  }

  connect() {
    if (this.connecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.connecting = true;
    console.log(`🔌 Connecting to gotty WebSocket: ${this.gottyWsUrl}`);

    try {
      this.ws = new WebSocket(this.gottyWsUrl);

      this.ws.on('open', () => {
        this.connecting = false;
        this.reconnectAttempts = 0;
        console.log('✅ Terminal Echo connected to gotty WebSocket');
      });

      this.ws.on('close', () => {
        console.log('⚠️  Terminal Echo WebSocket closed');
        this.ws = null;
        this.connecting = false;
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('❌ Terminal Echo WebSocket error:', error.message);
        this.ws = null;
        this.connecting = false;
      });

    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error.message);
      this.connecting = false;
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`⚠️  Terminal Echo: Max reconnection attempts reached`);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Terminal Echo: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Echo a command to the terminal (types it character by character)
   */
  async echoCommand(command) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('⚠️  Terminal Echo: WebSocket not connected, skipping visual echo');
      return false;
    }

    try {
      console.log(`🖥️  Echoing to terminal: ${command}`);
      
      // Type each character with a small delay
      const chars = command.split('');
      for (let i = 0; i < chars.length; i++) {
        if (this.ws.readyState !== WebSocket.OPEN) {
          console.log('⚠️  WebSocket closed during echo');
          return false;
        }
        
        const char = chars[i];
        const encoded = Buffer.from(char).toString('base64');
        const message = '1' + encoded; // Type '1' = input in gotty protocol
        
        this.ws.send(message);
        
        // Small delay between characters for typing effect
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Send Enter key
      await new Promise(resolve => setTimeout(resolve, 50));
      if (this.ws.readyState === WebSocket.OPEN) {
        const enter = Buffer.from('\r').toString('base64');
        const message = '1' + enter;
        this.ws.send(message);
        console.log('✅ Command echoed to terminal');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error echoing command:', error.message);
      return false;
    }
  }

  /**
   * Echo text without Enter key
   */
  async echoText(text) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const chars = text.split('');
      for (const char of chars) {
        if (this.ws.readyState !== WebSocket.OPEN) return false;
        
        const encoded = Buffer.from(char).toString('base64');
        const message = '1' + encoded;
        this.ws.send(message);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      return true;
    } catch (error) {
      console.error('❌ Error echoing text:', error.message);
      return false;
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Close the connection
   */
  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

module.exports = TerminalEcho;
