/**
 * Authentication Routes
 * 
 * Handles user authentication and syncing between Supabase Auth and local PostgreSQL
 */

const express = require('express');
const router = express.Router();

/**
 * Setup authentication routes
 * @param {Object} supabase - Supabase client
 * @returns {express.Router} Express router
 */
function setupAuthRoutes(supabase) {
  
  /**
   * POST /api/auth/sync-user
   * Sync user from Supabase Auth to local PostgreSQL
   */
  router.post('/sync-user', async (req, res) => {
    try {
      const { userId, email, provider, metadata } = req.body;
      
      if (!userId || !email) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'userId and email are required'
        });
      }

      // Silently sync users - only log on creation or errors
      // console.log(`[AuthRoutes] Syncing user: ${email} (${userId})`);
      // console.log(`[AuthRoutes] Avatar URL from metadata:`, metadata?.avatar_url);

      // Check if user already exists in local database
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      if (existing) {
        // Silently update - only log errors
        // console.log(`[AuthRoutes] User already exists, updating avatar_url`);
        
        // Update avatar_url in case it changed
        const { error: updateError } = await supabase
          .from('users')
          .update({
            avatar_url: metadata?.avatar_url || metadata?.picture || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
        
        if (updateError) {
          console.error(`[AuthRoutes] Failed to update user:`, updateError.message);
        }
        // Silently updated - no log spam
        // console.log(`[AuthRoutes] ✅ User avatar updated`);
        
        return res.json({
          success: true,
          message: 'User synced and avatar updated',
          user: existing
        });
      }

      // Create user in local database
      const { data: newUser, error } = await supabase
        .from('users')
        .insert([{
          id: userId,
          email: email,
          avatar_url: metadata?.avatar_url || metadata?.picture || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error(`[AuthRoutes] Failed to create user:`, error.message);
        return res.status(500).json({
          error: 'USER_SYNC_FAILED',
          message: error.message
        });
      }

      console.log(`[AuthRoutes] ✅ User synced successfully`);

      res.json({
        success: true,
        message: 'User synced successfully',
        user: newUser
      });

    } catch (error) {
      console.error('[AuthRoutes] Error syncing user:', error.message);
      res.status(500).json({
        error: 'SYNC_ERROR',
        message: error.message
      });
    }
  });

  /**
   * POST /api/auth/validate-token
   * Validate JWT token and sync user if needed
   */
  router.post('/validate-token', async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Token is required'
        });
      }

      // Validate token with Supabase Auth
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({
          error: 'INVALID_TOKEN',
          message: 'Token validation failed'
        });
      }

      // Check if user exists in local database
      const { data: localUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      // If user doesn't exist locally, create them
      if (!localUser) {
        console.log(`[AuthRoutes] User not found locally, syncing: ${user.email}`);
        
        const { data: newUser, error: syncError } = await supabase
          .from('users')
          .insert([{
            id: user.id,
            email: user.email,
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (syncError) {
          console.error(`[AuthRoutes] Failed to sync user:`, syncError.message);
        } else {
          console.log(`[AuthRoutes] ✅ User synced automatically`);
        }
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          provider: user.app_metadata?.provider
        }
      });

    } catch (error) {
      console.error('[AuthRoutes] Error validating token:', error.message);
      res.status(500).json({
        error: 'VALIDATION_ERROR',
        message: error.message
      });
    }
  });

  /**
   * GET /api/auth/user/:userId
   * Get user details from local database
   */
  router.get('/user/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: 'User not found in local database'
        });
      }

      res.json({
        success: true,
        user: user
      });

    } catch (error) {
      console.error('[AuthRoutes] Error getting user:', error.message);
      res.status(500).json({
        error: 'GET_USER_ERROR',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = { setupAuthRoutes };
