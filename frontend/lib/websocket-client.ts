/**
 * WebSocket Client for Real-Time Updates
 * Handles connection to backend WebSocket server and event streaming
 */

type WebSocketEventType =
  | 'connected'
  | 'session:registered'
  | 'command:start'
  | 'command:output'
  | 'command:end'
  | 'command_echo'
  | 'chat:response:start'
  | 'chat:response:chunk'
  | 'chat:response:end'
  | 'error'
  | 'session:created'
  | 'session:deleted';

interface WebSocketEvent {
  type: WebSocketEventType;
  [key: string]: any;
}

type EventHandler = (data: any) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventHandlers: Map<WebSocketEventType, Set<EventHandler>> = new Map();
  private isConnecting = false;
  private isIntentionallyClosed = false;
  private sessionId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected');
      return Promise.resolve();
    }

    if (this.isConnecting) {
      console.log('[WebSocket] Connection already in progress');
      return Promise.resolve();
    }

    this.isConnecting = true;
    this.isIntentionallyClosed = false;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          this.isConnecting = false;
        };

        this.ws.onclose = () => {
          console.log('[WebSocket] Disconnected');
          this.isConnecting = false;
          this.stopHeartbeat();

          if (!this.isIntentionallyClosed) {
            this.handleReconnect();
          }
        };

      } catch (error) {
        console.error('[WebSocket] Connection failed:', error);
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: string) {
    try {
      const event: WebSocketEvent = JSON.parse(data);
      
      // Emit to specific event handlers
      const handlers = this.eventHandlers.get(event.type);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(event);
          } catch (error) {
            console.error(`[WebSocket] Handler error for ${event.type}:`, error);
          }
        });
      }

      // Emit to wildcard handlers
      const wildcardHandlers = this.eventHandlers.get('*' as WebSocketEventType);
      if (wildcardHandlers) {
        wildcardHandlers.forEach(handler => {
          try {
            handler(event);
          } catch (error) {
            console.error('[WebSocket] Wildcard handler error:', error);
          }
        });
      }

    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  }

  /**
   * Register session with server
   */
  registerSession(sessionId: string) {
    this.sessionId = sessionId;
    this.send({
      type: 'session:register',
      sessionId
    });
  }

  /**
   * Unregister from current session
   */
  unregisterSession() {
    if (this.sessionId) {
      this.send({
        type: 'session:unregister'
      });
      this.sessionId = null;
    }
  }

  /**
   * Send message to server
   */
  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WebSocket] Cannot send, not connected');
    }
  }

  /**
   * Subscribe to event
   */
  on(eventType: WebSocketEventType | '*', handler: EventHandler) {
    if (!this.eventHandlers.has(eventType as WebSocketEventType)) {
      this.eventHandlers.set(eventType as WebSocketEventType, new Set());
    }
    this.eventHandlers.get(eventType as WebSocketEventType)!.add(handler);
  }

  /**
   * Unsubscribe from event
   */
  off(eventType: WebSocketEventType | '*', handler: EventHandler) {
    const handlers = this.eventHandlers.get(eventType as WebSocketEventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Handle reconnection
   */
  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      this.emit('error', {
        type: 'error',
        message: 'Failed to reconnect to server',
        reconnectAttempts: this.reconnectAttempts
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect().then(() => {
        // Re-register session if we had one
        if (this.sessionId) {
          this.registerSession(this.sessionId);
        }
      });
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Emit event to handlers
   */
  private emit(eventType: WebSocketEventType, data: any) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Get connection status
   */
  getStatus(): 'connected' | 'connecting' | 'disconnected' {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return 'connected';
    } else if (this.isConnecting) {
      return 'connecting';
    } else {
      return 'disconnected';
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Create singleton instance
let wsClient: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (!wsClient) {
    // Auto-detect protocol based on current page protocol
    let wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) {
      const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//localhost:3001`;
    }
    wsClient = new WebSocketClient(wsUrl);
  }
  return wsClient;
}

export default WebSocketClient;
