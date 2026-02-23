/**
 * Authentication Routes with Keycloak Support
 * 
 * Handles user authentication with both Supabase (legacy) and Keycloak (new)
 */

const express = require('express');

/**
 * Setup authentication routes with Keycloak support
 * @param {Object} supabase - Supabase client
 * @param {Object} keycloakAuth - Keycloak auth instance (optional)
 * @returns {express.Router} Express router
 */
function setupAuthRoutes(supabase, keycloakAuth = null) {
  const router = express.Router();
  
  /**
   * GET /api/auth/oauth/:provider
   * Initiate OAuth flow with Keycloak
   */
  router.get('/oauth/:provider', (req, res) => {
    try {
      const { provider } = req.params;
      const redirectUri = req.query.redirect_uri || `${req.protocol}://${req.get('host')}/auth/callback`;
      
      if (!keycloakAuth) {
        return res.status(500).json({
          error: 'KEYCLOAK_NOT_CONFIGURED',
          message: 'Keycloak authentication is not configured'
        });
      }

      // Validate provider
      if (!['google', 'microsoft'].includes(provider)) {
        return res.status(400).json({
          error: 'INVALID_PROVIDER',
          message: 'Provider must be google or microsoft'
        });
      }

      // Get Keycloak OAuth URL
      // Use public URL for browser redirects (localhost:8080)
      // Use internal URL for backend API calls (keycloak:8080)
      const keycloakPublicUrl = process.env.KEYCLOAK_PUBLIC_URL || 'http://localhost:8080';
      const keycloakRealm = process.env.KEYCLOAK_REALM || 'master';
      const keycloakClientId = process.env.KEYCLOAK_CLIENT_ID || 'pantheon-backend';
      
      // Map provider to Keycloak identity provider
      const idpHint = provider === 'microsoft' ? 'microsoft' : 'google';
      
      const oauthUrl = `${keycloakPublicUrl}/realms/${keycloakRealm}/protocol/openid-connect/auth?` +
        `client_id=${keycloakClientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=openid%20email%20profile&` +
        `kc_idp_hint=${idpHint}`;
      
      console.log('[AuthRoutes] Redirecting to Keycloak OAuth:', oauthUrl);
      
      // Redirect to Keycloak
      res.redirect(oauthUrl);

    } catch (error) {
      console.error('[AuthRoutes] Error initiating OAuth:', error.message);
      res.status(500).json({
        error: 'OAUTH_ERROR',
        message: error.message
      });
    }
  });

  /**
   * POST /api/auth/callback
   * Handle OAuth callback and exchange code for tokens
   */
  router.post('/callback', async (req, res) => {
    try {
      const { code, redirect_uri } = req.body;
      
      if (!code) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Authorization code is required'
        });
      }

      if (!keycloakAuth) {
        return res.status(500).json({
          error: 'KEYCLOAK_NOT_CONFIGURED',
          message: 'Keycloak authentication is not configured'
        });
      }

      // Exchange code for tokens
      const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
      const keycloakRealm = process.env.KEYCLOAK_REALM || 'master';
      const keycloakClientId = process.env.KEYCLOAK_CLIENT_ID || 'pantheon-backend';
      
      const tokenUrl = `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`;
      
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: keycloakClientId,
          code: code,
          redirect_uri: redirect_uri || `${req.protocol}://${req.get('host')}/auth/callback`,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('[AuthRoutes] Token exchange failed:', errorText);
        return res.status(400).json({
          error: 'TOKEN_EXCHANGE_FAILED',
          message: 'Failed to exchange code for tokens'
        });
      }

      const tokens = await tokenResponse.json();
      
      // Decode JWT to get user info
      const payload = JSON.parse(Buffer.from(tokens.access_token.split('.')[1], 'base64').toString());
      
      console.log('[AuthRoutes] JWT payload:', {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        preferred_username: payload.preferred_username
      });
      
      let userInfo = {
        id: payload.sub,
        email: payload.email,
        name: payload.name || payload.preferred_username,
        picture: payload.picture
      };
      
      // If name or picture is missing from JWT, fetch from userinfo endpoint
      if (!userInfo.name || !userInfo.picture) {
        console.log('[AuthRoutes] Name or picture missing from JWT, fetching from userinfo endpoint...');
        try {
          const userinfoUrl = `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/userinfo`;
          const userinfoResponse = await fetch(userinfoUrl, {
            headers: {
              'Authorization': `Bearer ${tokens.access_token}`
            }
          });
          
          if (userinfoResponse.ok) {
            const userinfoData = await userinfoResponse.json();
            console.log('[AuthRoutes] Userinfo data:', userinfoData);
            
            // Update userInfo with data from userinfo endpoint
            userInfo.name = userInfo.name || userinfoData.name || userinfoData.given_name || userInfo.email.split('@')[0];
            userInfo.picture = userInfo.picture || userinfoData.picture;
          }
        } catch (userinfoError) {
          console.error('[AuthRoutes] Failed to fetch userinfo:', userinfoError.message);
        }
      }
      
      console.log('[AuthRoutes] Final user info:', userInfo);

      // Sync user to local database and get the database user
      const dbUser = await syncUserToDatabase(supabase, userInfo);

      // Return session with database user ID (not Keycloak ID)
      res.json({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: {
          id: dbUser.id, // Use database ID
          email: dbUser.email,
          name: dbUser.name,
          picture: dbUser.picture
        }
      });

    } catch (error) {
      console.error('[AuthRoutes] Error handling callback:', error.message);
      res.status(500).json({
        error: 'CALLBACK_ERROR',
        message: error.message
      });
    }
  });

  /**
   * POST /api/auth/signout
   * Sign out user - only clears backend session, doesn't invalidate Keycloak session
   * This allows multiple users in different browser contexts
   */
  router.post('/signout', async (req, res) => {
    try {
      // Just return success - don't redirect to Keycloak logout
      // This allows incognito/different tabs to have different users
      res.json({
        success: true,
        message: 'Signed out successfully'
      });
    } catch (error) {
      console.error('[AuthRoutes] Error signing out:', error.message);
      res.status(500).json({
        error: 'SIGNOUT_ERROR',
        message: error.message
      });
    }
  });

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
          
          // Sync user to local database and get the database user
          const dbUser = await syncUserToDatabase(supabase, userInfo);
          
          return res.json({
            success: true,
            provider: 'keycloak',
            user: {
              id: dbUser.id, // Use database ID
              email: dbUser.email,
              name: dbUser.name,
              picture: dbUser.picture
            }
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

      // Sync user to local database and get the database user
      const dbUser = await syncUserToDatabase(supabase, {
        id: user.id,
        email: user.email,
        username: user.email.split('@')[0],
        name: user.user_metadata?.full_name || user.email
      });

      res.json({
        success: true,
        provider: 'supabase',
        user: {
          id: dbUser.id, // Use database ID
          email: dbUser.email,
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
 * IMPORTANT: Looks up users by EMAIL, not by Keycloak ID
 * This ensures each email address has its own separate account
 */
async function syncUserToDatabase(supabase, userInfo) {
  // Only log on first sync (user creation) or errors
  // Reduced logging to avoid spam

  // CRITICAL: Look up user by EMAIL, not by Keycloak ID
  // This allows multiple Google accounts to have separate users in our system
  const { data: existing } = await supabase
    .from('users')
    .select('id, name, picture, email')
    .eq('email', userInfo.email)
    .single();

  if (existing) {
    // User exists, silently update
    
    // Update name and picture if they've changed
    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({
        name: userInfo.name || existing.name,
        picture: userInfo.picture || existing.picture,
        updated_at: new Date().toISOString()
      })
      .eq('email', userInfo.email)
      .select()
      .single();
    
    if (updateError) {
      console.error(`[AuthRoutes] Failed to update user:`, updateError.message);
    }
    // Silently updated - no log spam
    
    // CRITICAL: Return the database user with the correct ID
    const finalUser = updated || existing;
    // Override the Keycloak ID with our database ID
    return {
      ...finalUser,
      id: finalUser.id // Use database ID, not Keycloak ID
    };
  }

  // User doesn't exist - create with Keycloak ID
  console.log(`[AuthRoutes] 🆕 Creating new user: ${userInfo.email} (ID: ${userInfo.id})`);
  
  // Use the Keycloak ID directly
  const { data: newUser, error } = await supabase
    .from('users')
    .insert([{
      id: userInfo.id, // CRITICAL: Use Keycloak ID
      email: userInfo.email,
      name: userInfo.name || userInfo.email.split('@')[0],
      picture: userInfo.picture || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) {
    console.error(`[AuthRoutes] ❌ Failed to create user:`, error.message);
    throw error;
  }

  console.log(`[AuthRoutes] ✅ User created: ${newUser.email}`);
  return newUser;
}

module.exports = { setupAuthRoutes };
