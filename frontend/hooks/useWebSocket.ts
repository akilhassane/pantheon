/**
 * React Hook for WebSocket Connection
 * Provides easy access to WebSocket events and connection status
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getWebSocketClient, WebSocketClient } from '@/lib/websocket-client';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

interface CommandEvent {
  command: string;
  output?: string;
  exitCode?: number;
  duration?: number;
  success?: boolean;
}

interface ChatResponseEvent {
  messageId: string;
  chunk?: string;
}

export function useWebSocket(sessionId: string | null) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastCommand, setLastCommand] = useState<CommandEvent | null>(null);
  const [streamingResponse, setStreamingResponse] = useState<string>('');
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  
  const wsClient = useRef<WebSocketClient | null>(null);
  const handlersRegistered = useRef(false);

  // Initialize WebSocket client
  useEffect(() => {
    wsClient.current = getWebSocketClient();
    
    // Connect
    wsClient.current.connect().then(() => {
      setStatus('connected');
    }).catch((error) => {
      console.error('WebSocket connection failed:', error);
      setStatus('disconnected');
    });

    return () => {
      // Cleanup on unmount
      if (wsClient.current) {
        wsClient.current.disconnect();
      }
    };
  }, []);

  // Register session
  useEffect(() => {
    if (wsClient.current && sessionId && status === 'connected') {
      wsClient.current.registerSession(sessionId);
    }

    return () => {
      if (wsClient.current && sessionId) {
        wsClient.current.unregisterSession();
      }
    };
  }, [sessionId, status]);

  // Register event handlers
  useEffect(() => {
    if (!wsClient.current || handlersRegistered.current) return;

    const client = wsClient.current;

    // Connection events
    const handleConnected = () => {
      setStatus('connected');
    };

    // Command events
    const handleCommandStart = (data: any) => {
      setLastCommand({
        command: data.command
      });
    };

    const handleCommandOutput = (data: any) => {
      setLastCommand(prev => prev ? {
        ...prev,
        output: (prev.output || '') + data.output
      } : null);
    };

    const handleCommandEnd = (data: any) => {
      setLastCommand(prev => prev ? {
        ...prev,
        exitCode: data.exitCode,
        duration: data.duration,
        success: data.success
      } : null);
    };

    // Chat response events
    const handleResponseStart = (data: any) => {
      setCurrentMessageId(data.messageId);
      setStreamingResponse('');
    };

    const handleResponseChunk = (data: any) => {
      if (data.messageId === currentMessageId) {
        setStreamingResponse(prev => prev + data.chunk);
      }
    };

    const handleResponseEnd = (data: any) => {
      if (data.messageId === currentMessageId) {
        setCurrentMessageId(null);
      }
    };

    // Error events
    const handleError = (data: any) => {
      console.error('[WebSocket] Error:', data.message);
    };

    // Register all handlers
    client.on('connected', handleConnected);
    client.on('command:start', handleCommandStart);
    client.on('command:output', handleCommandOutput);
    client.on('command:end', handleCommandEnd);
    client.on('chat:response:start', handleResponseStart);
    client.on('chat:response:chunk', handleResponseChunk);
    client.on('chat:response:end', handleResponseEnd);
    client.on('error', handleError);

    handlersRegistered.current = true;

    // Cleanup
    return () => {
      client.off('connected', handleConnected);
      client.off('command:start', handleCommandStart);
      client.off('command:output', handleCommandOutput);
      client.off('command:end', handleCommandEnd);
      client.off('chat:response:start', handleResponseStart);
      client.off('chat:response:chunk', handleResponseChunk);
      client.off('chat:response:end', handleResponseEnd);
      client.off('error', handleError);
      handlersRegistered.current = false;
    };
  }, [currentMessageId]);

  // Subscribe to specific event
  const subscribe = useCallback((eventType: string, handler: (data: any) => void) => {
    if (wsClient.current) {
      wsClient.current.on(eventType as any, handler);
      
      return () => {
        wsClient.current?.off(eventType as any, handler);
      };
    }
  }, []);

  // Send message
  const send = useCallback((data: any) => {
    if (wsClient.current) {
      wsClient.current.send(data);
    }
  }, []);

  return {
    status,
    lastCommand,
    streamingResponse,
    isStreaming: currentMessageId !== null,
    subscribe,
    send,
    isConnected: status === 'connected'
  };
}

export default useWebSocket;
