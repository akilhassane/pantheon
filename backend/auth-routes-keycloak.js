/**
 * Authentication Routes with Keycloak Support
 * 
 * Handles user authentication with both Supabase (legacy) and Keycloak (new)
 */

const express = require('express');
const router = express.Router();

/**
 * Setup authentication routes with Keycloak support
 * @param {Object} supabase - Supabase client
 * @param {Object} keycloakAuth - Keycloak auth instance (optional)
 * @returns {express.Router} Express router
 */
function setupAuthRoutes(supabase, keycloakAuth = null) {
  
  /**
   * POST /api/auth/validate-token
   * Validate JWT token (supports both Supabase and Keycloak)
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

      // Try Keycloak validation first if configured
      if (keycloakAuth) {
        try {
          const decoded = await keycloakAuth.validateToken(token);
          const userInfo = keycloakAuth.extractUserInfo(decoded);
          
          // Sync user to local database
          await syncUserToDatabase(supabase, userInfo);
          
          return res.json({
            success: true,
            provider: 'keycloak',
            user: userInfo
          });
        } catch (keycloakError) {
          console.log('[AuthRoutes] Keycloak validation failed, trying Supabase:', keycloakError.message);
        }
      }

      // Fall back to Supabase validation
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({
          error: 'INVALID_TOKEN',
          message: 'Token validation failed'
        });
      }

      // Sync user to local database
      await syncUserToDatabase(supabase, {
        id: user.id,
        email: user.email,
        username: user.email.split('@')[0],
        name: user.user_metadata?.full_name || user.email
      });

      res.json({
        success: true,
        provider: 'supabase',
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
   * POST /api/auth/sync-user
   * Sync user from auth provider to local PostgreSQL
   */
  router.post('/sync-user', async (req, res) => {
    try {
      const { userId, email, username, name } = req.body;
      
      if (!userId || !email) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'userId and email are required'
        });
      }

      const user = await syncUserToDatabase(supabase, {
        id: userId,
        email,
        username: username || email.split('@')[0],
        name: name || email
      });

      res.json({
        success: true,
        message: 'User synced successfully',
        user: user
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

  /**
   * GET /api/auth/me
   * Get current user info (requires authentication)
   */
  router.get('/me', keycloakAuth ? keycloakAuth.middleware() : (req, res, next) => next(), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
      }

      // Get full user details from database
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', req.user.id)
        .single();

      if (error || !user) {
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: 'User not found in database'
        });
      }

      res.json({
        success: true,
        user: user
      });

    } catch (error) {
      console.error('[AuthRoutes] Error getting current user:', error.message);
      res.status(500).json({
        error: 'GET_USER_ERROR',
        message: error.message
      });
    }
  });

  return router;
}

/**
 * Helper function to sync user to local database
 */
async function syncUserToDatabase(supabase, userInfo) {
  console.log(`[AuthRoutes] Syncing user: ${userInfo.email} (${userInfo.id})`);

  // Check if user already exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', userInfo.id)
    .single();

  if (existing) {
    console.log(`[AuthRoutes] User already exists in local database`);
    return existing;
  }

  // Create user in local database
  const { data: newUser, error } = await supabase
    .from('users')
    .insert([{
      id: userInfo.id,
      email: userInfo.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) {
    console.error(`[AuthRoutes] Failed to create user:`, error.message);
    throw error;
  }

  console.log(`[AuthRoutes] ✅ User synced successfully`);
  return newUser;
}

module.exports = { setupAuthRoutes };
