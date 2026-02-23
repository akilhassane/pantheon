/**
 * Authentication Middleware
 * 
 * Verifies JWT tokens from Supabase Auth and attaches user info to request
 */

const { getSupabaseAdmin } = require('../config/supabase-client');

/**
 * Middleware to authenticate requests using Supabase JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function authenticateRequest(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    console.log(`[Auth] ${req.method} ${req.path} - Auth header:`, authHeader ? 'present' : 'missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Auth] No valid authorization header');
      return res.status(401).json({ 
        error: 'No authorization token provided',
        message: 'Please include a valid Bearer token in the Authorization header'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[Auth] Token:', token.substring(0, 20) + '...');
    
    // Development bypass: Allow "test-token" for testing
    // Check both NODE_ENV and if token is test-token
    const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    if (isDevelopment && token === 'test-token') {
      console.log('[Auth] Using test-token bypass for development');
      req.user = { id: '00000000-0000-0000-0000-000000000001', email: 'test@example.com' };
      req.userId = '00000000-0000-0000-0000-000000000001';
      return next();
    }

    // Verify token with Supabase
    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('[Auth] Token verification failed:', error?.message || 'User not found');
      return res.status(401).json({ 
        error: 'Invalid or expired token',
        message: 'Please log in again'
      });
    }

    // Attach user to request object
    req.user = user;
    req.userId = user.id;

    // Continue to next middleware/route handler
    next();

  } catch (error) {
    console.error('[Auth] Authentication error:', error.message);
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: 'An error occurred while verifying your credentials'
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't block if missing
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      req.user = null;
      req.userId = null;
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!error && user) {
      req.user = user;
      req.userId = user.id;
    } else {
      req.user = null;
      req.userId = null;
    }

    next();

  } catch (error) {
    console.error('[Auth] Optional auth error:', error.message);
    req.user = null;
    req.userId = null;
    next();
  }
}

module.exports = {
  authenticateRequest,
  optionalAuth
};
