/**
 * MCP Configuration API Routes
 */

const express = require('express');
const router = express.Router();

function setupMCPConfigRoutes(mcpConfigManager, authenticate) {
  
  // POST /api/projects/:projectId/mcp-configs - Create config
  router.post('/projects/:projectId/mcp-configs', authenticate, async (req, res) => {
    try {
      const { projectId } = req.params;
      const config = req.body;
      
      if (!config.name || !config.command) {
        return res.status(400).json({ error: 'Name and command are required' });
      }
      
      const mcpConfig = await mcpConfigManager.createMCPConfig(projectId, config);
      
      res.status(201).json({ success: true, config: mcpConfig });
    } catch (error) {
      console.error('[MCPConfigRoutes] Error creating config:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/projects/:projectId/mcp-configs - List configs
  router.get('/projects/:projectId/mcp-configs', authenticate, async (req, res) => {
    try {
      const { projectId } = req.params;
      const { enabled_only } = req.query;
      
      let configs;
      if (enabled_only === 'true') {
        configs = await mcpConfigManager.getEnabledMCPConfigs(projectId);
      } else {
        configs = await mcpConfigManager.getMCPConfigs(projectId);
      }
      
      res.json({ success: true, configs });
    } catch (error) {
      console.error('[MCPConfigRoutes] Error getting configs:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // PUT /api/mcp-configs/:id - Update config
  router.put('/mcp-configs/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const config = await mcpConfigManager.updateMCPConfig(id, updates);
      
      res.json({ success: true, config });
    } catch (error) {
      console.error('[MCPConfigRoutes] Error updating config:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // PATCH /api/mcp-configs/:id/toggle - Toggle enabled
  router.patch('/mcp-configs/:id/toggle', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      
      const config = await mcpConfigManager.toggleMCPConfig(id);
      
      res.json({ success: true, config });
    } catch (error) {
      console.error('[MCPConfigRoutes] Error toggling config:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // DELETE /api/mcp-configs/:id - Delete config
  router.delete('/mcp-configs/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      
      await mcpConfigManager.deleteMCPConfig(id);
      
      res.json({ success: true });
    } catch (error) {
      console.error('[MCPConfigRoutes] Error deleting config:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  return router;
}

module.exports = { setupMCPConfigRoutes };
