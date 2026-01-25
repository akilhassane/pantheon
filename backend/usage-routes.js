/**
 * Usage Tracking Routes
 * API endpoints for fetching usage statistics
 */

const express = require('express');
const router = express.Router();
const { getUserUsage, getUsageStats } = require('./usage-tracking');

/**
 * GET /api/usage/stats
 * Get aggregated usage statistics for the authenticated user
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      modelId,
      startDate,
      endDate,
      groupBy = 'day'
    } = req.query;

    const result = await getUsageStats(userId, {
      modelId,
      startDate,
      endDate,
      groupBy
    });

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/usage/history
 * Get detailed usage history for the authenticated user
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      modelId,
      startDate,
      endDate,
      limit = 100
    } = req.query;

    const result = await getUserUsage(userId, {
      modelId,
      startDate,
      endDate,
      limit: parseInt(limit)
    });

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error('Error fetching usage history:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
