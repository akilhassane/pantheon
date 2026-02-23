/**
 * User Preferences API Routes
 */

const express = require('express');
const router = express.Router();

function setupPreferencesRoutes(preferencesManager, authenticate) {
  
  // GET /api/preferences - Get user preferences
  router.get('/preferences', authenticate, async (req, res) => {
    try {
      const userId = req.userId;
      
      const preferences = await preferencesManager.getUserPreferences(userId);
      
      res.json({ success: true, preferences });
    } catch (error) {
      console.error('[PreferencesRoutes] Error getting preferences:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // PUT /api/preferences - Update user preferences
  router.put('/preferences', authenticate, async (req, res) => {
    try {
      const userId = req.userId;
      const preferences = req.body;
      
      const updated = await preferencesManager.updatePreferences(userId, preferences);
      
      res.json({ success: true, preferences: updated });
    } catch (error) {
      console.error('[PreferencesRoutes] Error updating preferences:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/preferences/reset - Reset to defaults
  router.post('/preferences/reset', authenticate, async (req, res) => {
    try {
      const userId = req.userId;
      
      const preferences = await preferencesManager.resetPreferences(userId);
      
      res.json({ success: true, preferences });
    } catch (error) {
      console.error('[PreferencesRoutes] Error resetting preferences:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  return router;
}

module.exports = { setupPreferencesRoutes };
