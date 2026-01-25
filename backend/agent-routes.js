const express = require('express');
const DesktopAgentOrchestrator = require('./desktop-agent-orchestrator');
const { getConfig, validateConfig } = require('./config/agent.config');

/**
 * Setup AI Desktop Agent routes and WebSocket handlers
 * @param {Express} app - Express app
 * @param {WebSocket.Server} wss - WebSocket server
 * @returns {DesktopAgentOrchestrator} Orchestrator instance
 */
function setupAgentRoutes(app, wss) {
  // Validate configuration
  try {
    validateConfig();
  } catch (error) {
    console.error('[AgentRoutes] Configuration validation failed:', error.message);
    throw error;
  }

  // Initialize orchestrator
  const config = getConfig();
  const orchestrator = new DesktopAgentOrchestrator(config);

  console.log('[AgentRoutes] Desktop Agent Orchestrator initialized');

  // Forward orchestrator events to WebSocket clients
  const agentEvents = [
    'agent:status_changed',
    'agent:screenshot',
    'agent:action_planned',
    'agent:action_executing',
    'agent:action_completed',
    'agent:action_blocked',
    'agent:action_requires_approval',
    'agent:task_progress',
    'agent:task_completed',
    'agent:task_cancelled',
    'agent:clarification',
    'agent:error',
  ];

  agentEvents.forEach(event => {
    orchestrator.on(event, (data) => {
      broadcastToSession(data.sessionId, event, data);
    });
  });

  // Helper to broadcast to specific session
  function broadcastToSession(sessionId, event, data) {
    const message = JSON.stringify({ type: event, ...data });
    
    wss.clients.forEach(client => {
      if (client.readyState === 1 && client.sessionId === sessionId) {
        client.send(message);
      }
    });
  }

  // REST API Routes

  /**
   * POST /api/agent/enable
   * Enable agent mode for a session
   */
  app.post('/api/agent/enable', async (req, res) => {
    try {
      const { userId, sessionId } = req.body;
      
      if (!userId || !sessionId) {
        return res.status(400).json({ error: 'userId and sessionId required' });
      }

      const session = await orchestrator.enableAgent(userId, sessionId);
      
      res.json({
        success: true,
        session: {
          id: session.id,
          status: session.status,
          createdAt: session.createdAt,
        },
      });
    } catch (error) {
      console.error('[AgentRoutes] Enable agent failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/agent/disable
   * Disable agent mode for a session
   */
  app.post('/api/agent/disable', async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId required' });
      }

      await orchestrator.disableAgent(sessionId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('[AgentRoutes] Disable agent failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/agent/request
   * Process a user request
   */
  app.post('/api/agent/request', async (req, res) => {
    try {
      const { request, sessionId } = req.body;
      
      if (!request || !sessionId) {
        return res.status(400).json({ error: 'request and sessionId required' });
      }

      // Process request asynchronously
      orchestrator.processUserRequest(request, sessionId).catch(error => {
        console.error('[AgentRoutes] Request processing error:', error);
      });
      
      res.json({ success: true, message: 'Request processing started' });
    } catch (error) {
      console.error('[AgentRoutes] Request failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/agent/approve
   * Approve a pending action
   */
  app.post('/api/agent/approve', async (req, res) => {
    try {
      const { actionId, sessionId } = req.body;
      
      if (!actionId || !sessionId) {
        return res.status(400).json({ error: 'actionId and sessionId required' });
      }

      await orchestrator.approveAction(actionId, sessionId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('[AgentRoutes] Approve action failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/agent/reject
   * Reject a pending action
   */
  app.post('/api/agent/reject', async (req, res) => {
    try {
      const { actionId, sessionId } = req.body;
      
      if (!actionId || !sessionId) {
        return res.status(400).json({ error: 'actionId and sessionId required' });
      }

      await orchestrator.rejectAction(actionId, sessionId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('[AgentRoutes] Reject action failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/agent/pause
   * Pause execution
   */
  app.post('/api/agent/pause', async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId required' });
      }

      await orchestrator.pauseExecution(sessionId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('[AgentRoutes] Pause failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/agent/resume
   * Resume execution
   */
  app.post('/api/agent/resume', async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId required' });
      }

      await orchestrator.resumeExecution(sessionId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('[AgentRoutes] Resume failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/agent/cancel
   * Cancel current task
   */
  app.post('/api/agent/cancel', async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId required' });
      }

      await orchestrator.cancelTask(sessionId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('[AgentRoutes] Cancel failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/agent/status/:sessionId
   * Get agent status
   */
  app.get('/api/agent/status/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const status = orchestrator.getAgentStatus(sessionId);
      const task = orchestrator.getCurrentTask(sessionId);
      
      res.json({
        status,
        currentTask: task ? {
          id: task.id,
          userIntent: task.userIntent,
          status: task.status,
          currentStep: task.currentStepIndex + 1,
          totalSteps: task.actionPlan.steps.length,
        } : null,
      });
    } catch (error) {
      console.error('[AgentRoutes] Get status failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // WebSocket message handlers
  wss.on('connection', (ws) => {
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle agent-specific messages
        if (data.type && data.type.startsWith('agent:')) {
          handleAgentWebSocketMessage(ws, data);
        }
      } catch (error) {
        console.error('[AgentRoutes] WebSocket message error:', error);
      }
    });
  });

  function handleAgentWebSocketMessage(ws, data) {
    const { type, sessionId } = data;
    
    // Store session ID on WebSocket connection
    if (sessionId) {
      ws.sessionId = sessionId;
    }
    
    switch (type) {
      case 'agent:enable':
        orchestrator.enableAgent(data.userId, sessionId)
          .then(() => {
            ws.send(JSON.stringify({ type: 'agent:enabled', sessionId }));
          })
          .catch(error => {
            ws.send(JSON.stringify({ type: 'agent:error', error: error.message }));
          });
        break;
        
      case 'agent:disable':
        orchestrator.disableAgent(sessionId)
          .then(() => {
            ws.send(JSON.stringify({ type: 'agent:disabled', sessionId }));
          })
          .catch(error => {
            ws.send(JSON.stringify({ type: 'agent:error', error: error.message }));
          });
        break;
        
      case 'agent:pause':
        orchestrator.pauseExecution(sessionId);
        break;
        
      case 'agent:resume':
        orchestrator.resumeExecution(sessionId);
        break;
        
      case 'agent:cancel':
        orchestrator.cancelTask(sessionId);
        break;
        
      case 'agent:approve_action':
        orchestrator.approveAction(data.actionId, sessionId);
        break;
        
      case 'agent:reject_action':
        orchestrator.rejectAction(data.actionId, sessionId);
        break;
    }
  }

  return orchestrator;
}

module.exports = { setupAgentRoutes };
