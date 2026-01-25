/**
 * Terminal Connection Manager
 * 
 * Manages connections to the ttyd terminal service with proper error handling,
 * reconnection logic, and status tracking.
 */

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface TerminalConnectionConfig {
  url: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  connectionTimeout?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
}

export interface ConnectionState {
  status: ConnectionStatus;
  url: string;
  lastConnected?: Date;
  lastError?: {
    message: string;
    timestamp: Date;
    code?: string;
  };
  reconnectAttempt: number;
  maxReconnectAttempts: number;
}

export class TerminalConnection {
  private config: Required<TerminalConnectionConfig>;
  private state: ConnectionState;
  private reconnectTimeout?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: TerminalConnectionConfig) {
    this.config = {
      url: config.url,
      reconnectAttempts: config.reconnectAttempts ?? 3,
      reconnectDelay: config.reconnectDelay ?? 2000,
      connectionTimeout: config.connectionTimeout ?? 5000,
      onConnect: config.onConnect ?? (() => {}),
      onDisconnect: config.onDisconnect ?? (() => {}),
      onError: config.onError ?? (() => {}),
      onStatusChange: config.onStatusChange ?? (() => {}),
    };

    this.state = {
      status: 'disconnected',
      url: config.url,
      reconnectAttempt: 0,
      maxReconnectAttempts: this.config.reconnectAttempts,
    };
  }

  /**
   * Connect to the terminal service
   */
  async connect(): Promise<void> {
    if (this.state.status === 'connected') {
      console.log('[TerminalConnection] Already connected');
      return;
    }

    if (this.state.status === 'connecting') {
      console.log('[TerminalConnection] Connection already in progress');
      return;
    }

    this.updateStatus('connecting');
    console.log(`[TerminalConnection] Connecting to ${this.config.url}...`);

    try {
      // Perform health check
      const isHealthy = await this.performHealthCheck();
      
      if (isHealthy) {
        this.updateStatus('connected');
        this.state.lastConnected = new Date();
        this.state.reconnectAttempt = 0;
        this.config.onConnect();
        
        // Start periodic health checks
        this.startHealthCheckInterval();
        
        console.log('[TerminalConnection] Connected successfully');
      } else {
        throw new Error('Health check failed');
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.handleConnectionError(err);
      throw err;
    }
  }

  /**
   * Disconnect from the terminal service
   */
  disconnect(): void {
    console.log('[TerminalConnection] Disconnecting...');
    
    this.stopHealthCheckInterval();
    this.clearReconnectTimeout();
    
    if (this.state.status === 'connected') {
      this.config.onDisconnect();
    }
    
    this.updateStatus('disconnected');
    this.state.reconnectAttempt = 0;
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.state.status;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.state.status === 'connected';
  }

  /**
   * Get current connection state
   */
  getState(): Readonly<ConnectionState> {
    return { ...this.state };
  }

  /**
   * Perform health check on the terminal service
   */
  private async performHealthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.connectionTimeout);

      const response = await fetch(this.config.url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return response.ok;
    } catch (error) {
      console.error('[TerminalConnection] Health check failed:', error);
      return false;
    }
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(error: Error): void {
    console.error('[TerminalConnection] Connection error:', error.message);

    this.state.lastError = {
      message: error.message,
      timestamp: new Date(),
      code: (error as any).code,
    };

    this.updateStatus('error');
    this.config.onError(error);

    // Attempt reconnection if within retry limit
    if (this.state.reconnectAttempt < this.state.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      console.error('[TerminalConnection] Max reconnection attempts reached');
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    this.state.reconnectAttempt++;
    
    // Exponential backoff
    const delay = this.config.reconnectDelay * Math.pow(2, this.state.reconnectAttempt - 1);
    
    console.log(
      `[TerminalConnection] Scheduling reconnect attempt ${this.state.reconnectAttempt}/${this.state.maxReconnectAttempts} in ${delay}ms`
    );

    this.reconnectTimeout = setTimeout(() => {
      console.log(`[TerminalConnection] Attempting reconnect (${this.state.reconnectAttempt}/${this.state.maxReconnectAttempts})`);
      this.connect().catch((error) => {
        console.error('[TerminalConnection] Reconnect failed:', error.message);
      });
    }, delay);
  }

  /**
   * Clear reconnection timeout
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
  }

  /**
   * Start periodic health check interval
   */
  private startHealthCheckInterval(): void {
    this.stopHealthCheckInterval();
    
    // Check health every 10 seconds
    this.healthCheckInterval = setInterval(async () => {
      if (this.state.status === 'connected') {
        const isHealthy = await this.performHealthCheck();
        
        if (!isHealthy) {
          console.warn('[TerminalConnection] Health check failed, connection may be lost');
          this.handleConnectionError(new Error('Connection lost'));
        }
      }
    }, 10000);
  }

  /**
   * Stop health check interval
   */
  private stopHealthCheckInterval(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Update connection status and notify listeners
   */
  private updateStatus(status: ConnectionStatus): void {
    const previousStatus = this.state.status;
    this.state.status = status;
    
    if (previousStatus !== status) {
      console.log(`[TerminalConnection] Status changed: ${previousStatus} → ${status}`);
      this.config.onStatusChange(status);
    }
  }

  /**
   * Reset reconnection attempts
   */
  resetReconnectAttempts(): void {
    this.state.reconnectAttempt = 0;
  }

  /**
   * Manually trigger reconnection
   */
  async reconnect(): Promise<void> {
    console.log('[TerminalConnection] Manual reconnect triggered');
    this.disconnect();
    this.resetReconnectAttempts();
    await this.connect();
  }
}

/**
 * Create a terminal connection instance
 */
export function createTerminalConnection(config: TerminalConnectionConfig): TerminalConnection {
  return new TerminalConnection(config);
}
