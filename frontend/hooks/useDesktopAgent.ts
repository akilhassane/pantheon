'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AgentStatus } from '@/components/agent/AgentStatusBadge';

interface DesktopAction {
  id: string;
  type: string;
  params: any;
  description: string;
  requiresApproval: boolean;
}

interface Screenshot {
  imageData: string;
  base64: string;
  timestamp: Date;
}

interface TaskProgress {
  step: number;
  total: number;
  action: DesktopAction;
}

interface AgentState {
  enabled: boolean;
  status: AgentStatus;
  currentTask: any | null;
  lastScreenshot: Screenshot | null;
  pendingAction: DesktopAction | null;
  taskProgress: TaskProgress | null;
  error: string | null;
}

export function useDesktopAgent(sessionId: string, userId: string) {
  const [state, setState] = useState<AgentState>({
    enabled: false,
    status: 'idle',
    currentTask: null,
    lastScreenshot: null,
    pendingAction: null,
    taskProgress: null,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // Connect to WebSocket
  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Agent] WebSocket connected');
      // Store session ID on connection
      ws.send(JSON.stringify({ type: 'agent:init', sessionId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleAgentEvent(data);
      } catch (error) {
        console.error('[Agent] Failed to parse message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[Agent] WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('[Agent] WebSocket closed, reconnecting...');
      wsRef.current = null;
      
      // Reconnect after 2 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 2000);
    };
  }, [sessionId]);

  // Handle agent events
  const handleAgentEvent = useCallback((data: any) => {
    const { type } = data;

    switch (type) {
      case 'agent:status_changed':
        setState(prev => ({ ...prev, status: data.status }));
        break;

      case 'agent:screenshot':
        setState(prev => ({ 
          ...prev, 
          lastScreenshot: {
            imageData: data.screenshot.base64,
            base64: data.screenshot.base64,
            timestamp: new Date(data.screenshot.timestamp),
          }
        }));
        break;

      case 'agent:action_planned':
        setState(prev => ({ 
          ...prev, 
          currentTask: data.task,
          status: 'thinking',
        }));
        break;

      case 'agent:action_requires_approval':
        setState(prev => ({ 
          ...prev, 
          pendingAction: data.action,
          status: 'paused',
        }));
        break;

      case 'agent:action_executing':
        setState(prev => ({ ...prev, status: 'acting' }));
        break;

      case 'agent:action_completed':
        // Action completed, continue
        break;

      case 'agent:task_progress':
        setState(prev => ({ 
          ...prev, 
          taskProgress: {
            step: data.step,
            total: data.total,
            action: data.action,
          }
        }));
        break;

      case 'agent:task_completed':
        setState(prev => ({ 
          ...prev, 
          status: 'idle',
          currentTask: null,
          taskProgress: null,
        }));
        break;

      case 'agent:task_cancelled':
        setState(prev => ({ 
          ...prev, 
          status: 'idle',
          currentTask: null,
          pendingAction: null,
          taskProgress: null,
        }));
        break;

      case 'agent:error':
        setState(prev => ({ 
          ...prev, 
          status: 'error',
          error: data.error,
        }));
        break;

      case 'agent:clarification':
        // Handle clarifying question
        console.log('[Agent] Clarification needed:', data.question);
        break;
    }
  }, []);

  // Enable agent
  const enableAgent = useCallback(async () => {
    try {
      const response = await fetch('/api/agent/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessionId }),
      });

      if (response.ok) {
        setState(prev => ({ ...prev, enabled: true, status: 'idle' }));
      }
    } catch (error) {
      console.error('[Agent] Failed to enable:', error);
    }
  }, [userId, sessionId]);

  // Disable agent
  const disableAgent = useCallback(async () => {
    try {
      const response = await fetch('/api/agent/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      if (response.ok) {
        setState({
          enabled: false,
          status: 'idle',
          currentTask: null,
          lastScreenshot: null,
          pendingAction: null,
          taskProgress: null,
          error: null,
        });
      }
    } catch (error) {
      console.error('[Agent] Failed to disable:', error);
    }
  }, [sessionId]);

  // Send request
  const sendRequest = useCallback(async (request: string) => {
    try {
      const response = await fetch('/api/agent/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, request }),
      });

      if (!response.ok) {
        throw new Error('Failed to send request');
      }
    } catch (error) {
      console.error('[Agent] Failed to send request:', error);
      setState(prev => ({ ...prev, error: 'Failed to send request' }));
    }
  }, [sessionId]);

  // Approve action
  const approveAction = useCallback(async () => {
    if (!state.pendingAction) return;

    try {
      const response = await fetch('/api/agent/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId, 
          actionId: state.pendingAction.id 
        }),
      });

      if (response.ok) {
        setState(prev => ({ ...prev, pendingAction: null }));
      }
    } catch (error) {
      console.error('[Agent] Failed to approve action:', error);
    }
  }, [sessionId, state.pendingAction]);

  // Reject action
  const rejectAction = useCallback(async () => {
    if (!state.pendingAction) return;

    try {
      const response = await fetch('/api/agent/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId, 
          actionId: state.pendingAction.id 
        }),
      });

      if (response.ok) {
        setState(prev => ({ ...prev, pendingAction: null, status: 'idle' }));
      }
    } catch (error) {
      console.error('[Agent] Failed to reject action:', error);
    }
  }, [sessionId, state.pendingAction]);

  // Pause execution
  const pauseExecution = useCallback(async () => {
    try {
      await fetch('/api/agent/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch (error) {
      console.error('[Agent] Failed to pause:', error);
    }
  }, [sessionId]);

  // Resume execution
  const resumeExecution = useCallback(async () => {
    try {
      await fetch('/api/agent/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch (error) {
      console.error('[Agent] Failed to resume:', error);
    }
  }, [sessionId]);

  // Cancel task
  const cancelTask = useCallback(async () => {
    try {
      await fetch('/api/agent/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch (error) {
      console.error('[Agent] Failed to cancel:', error);
    }
  }, [sessionId]);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    ...state,
    enableAgent,
    disableAgent,
    sendRequest,
    approveAction,
    rejectAction,
    pauseExecution,
    resumeExecution,
    cancelTask,
  };
}
