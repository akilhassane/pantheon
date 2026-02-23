// Agent Management Routes
const express = require('express');

function setupAgentRoutes(agentHandler) {
  const router = express.Router();

  /**
   * GET /api/agents
   * List all connected agents
   */
  router.get('/', (req, res) => {
    try {
      const agents = agentHandler.getConnectedAgents();
      res.json({
        success: true,
        agents,
        count: agents.length
      });
    } catch (error) {
      console.error('[AgentRoutes] Error listing agents:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/agents/:agentId
   * Get specific agent info
   */
  router.get('/:agentId', (req, res) => {
    try {
      const { agentId } = req.params;
      const agent = agentHandler.getAgentInfo(agentId);
      
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found'
        });
      }

      res.json({
        success: true,
        agent
      });
    } catch (error) {
      console.error('[AgentRoutes] Error getting agent:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/agents/:agentId/containers
   * Create container on agent
   */
  router.post('/:agentId/containers', async (req, res) => {
    try {
      const { agentId } = req.params;
      const containerOptions = req.body;

      console.log(`[AgentRoutes] Creating container on agent ${agentId}`);
      
      const result = await agentHandler.createContainer(agentId, containerOptions);
      
      res.json({
        success: true,
        result
      });
    } catch (error) {
      console.error('[AgentRoutes] Error creating container:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/agents/:agentId/containers
   * List containers on agent
   */
  router.get('/:agentId/containers', async (req, res) => {
    try {
      const { agentId } = req.params;
      
      const result = await agentHandler.listContainers(agentId);
      
      res.json({
        success: true,
        containers: result.containers || []
      });
    } catch (error) {
      console.error('[AgentRoutes] Error listing containers:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/agents/:agentId/containers/:containerId/start
   * Start container on agent
   */
  router.post('/:agentId/containers/:containerId/start', async (req, res) => {
    try {
      const { agentId, containerId } = req.params;
      
      const result = await agentHandler.startContainer(agentId, containerId);
      
      res.json({
        success: true,
        result
      });
    } catch (error) {
      console.error('[AgentRoutes] Error starting container:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/agents/:agentId/containers/:containerId/stop
   * Stop container on agent
   */
  router.post('/:agentId/containers/:containerId/stop', async (req, res) => {
    try {
      const { agentId, containerId } = req.params;
      
      const result = await agentHandler.stopContainer(agentId, containerId);
      
      res.json({
        success: true,
        result
      });
    } catch (error) {
      console.error('[AgentRoutes] Error stopping container:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/agents/:agentId/containers/:containerId
   * Remove container from agent
   */
  router.delete('/:agentId/containers/:containerId', async (req, res) => {
    try {
      const { agentId, containerId } = req.params;
      
      const result = await agentHandler.removeContainer(agentId, containerId);
      
      res.json({
        success: true,
        result
      });
    } catch (error) {
      console.error('[AgentRoutes] Error removing container:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/agents/:agentId/containers/:containerId/exec
   * Execute command in container
   */
  router.post('/:agentId/containers/:containerId/exec', async (req, res) => {
    try {
      const { agentId, containerId } = req.params;
      const { command } = req.body;
      
      if (!command) {
        return res.status(400).json({
          success: false,
          error: 'Command is required'
        });
      }
      
      const result = await agentHandler.executeInContainer(agentId, containerId, command);
      
      res.json({
        success: true,
        result
      });
    } catch (error) {
      console.error('[AgentRoutes] Error executing command:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/agents/:agentId/containers/:containerId/logs
   * Get container logs
   */
  router.get('/:agentId/containers/:containerId/logs', async (req, res) => {
    try {
      const { agentId, containerId } = req.params;
      const tail = parseInt(req.query.tail) || 100;
      
      const result = await agentHandler.getContainerLogs(agentId, containerId, tail);
      
      res.json({
        success: true,
        logs: result.logs || ''
      });
    } catch (error) {
      console.error('[AgentRoutes] Error getting logs:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

module.exports = { setupAgentRoutes };
