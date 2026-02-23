/**
 * Keycloak Authentication Module
 * 
 * Validates JWT tokens issued by Keycloak and provides user authentication
 */

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

class KeycloakAuth {
  constructor(config) {
    this.keycloakUrl = config.keycloakUrl;
    this.realm = config.realm;
    this.clientId = config.clientId;
    
    // JWKS client for fetching public keys
    this.jwksClient = jwksClient({
      jwksUri: `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/certs`,
      cache: true,
      cacheMaxAge: 86400000, // 24 hours
      rateLimit: true,
      jwksRequestsPerMinute: 10
    });
    
    console.log(`[KeycloakAuth] Initialized for realm: ${this.realm}`);
  }

  /**
   * Get signing key from JWKS
   */
  getKey(header, callback) {
    this.jwksClient.getSigningKey(header.kid, (err, key) => {
      if (err) {
        console.error('[KeycloakAuth] Error fetching signing key:', err.message);
        return callback(err);
      }
      const signingKey = key.publicKey || key.rsaPublicKey;
      callback(null, signingKey);
    });
  }

  /**
   * Validate Keycloak JWT token
   * @param {string} token - JWT token from Authorization header
   * @returns {Promise<Object>} Decoded token payload
   */
  async validateToken(token) {
    return new Promise((resolve, reject) => {
      // Accept both internal (keycloak:8080) and public (localhost:8080) issuer URLs
      const publicUrl = process.env.KEYCLOAK_PUBLIC_URL || 'http://localhost:8080';
      const validIssuers = [
        `${this.keycloakUrl}/realms/${this.realm}`,
        `${publicUrl}/realms/${this.realm}`
      ];
      
      jwt.verify(
        token,
        (header, callback) => this.getKey(header, callback),
        {
          audience: this.clientId,
          issuer: validIssuers,
          algorithms: ['RS256']
        },
        (err, decoded) => {
          if (err) {
            console.error('[KeycloakAuth] Token validation failed:', err.message);
            return reject(err);
          }
          
          // Silently validate tokens - only log errors
          // console.log(`[KeycloakAuth] Token validated for user: ${decoded.preferred_username || decoded.sub}`);
          resolve(decoded);
        }
      );
    });
  }

  /**
   * Extract user information from decoded token
   * @param {Object} decoded - Decoded JWT payload
   * @returns {Object} User information
   */
  extractUserInfo(decoded) {
    return {
      id: decoded.sub,
      email: decoded.email,
      username: decoded.preferred_username,
      name: decoded.name,
      givenName: decoded.given_name,
      familyName: decoded.family_name,
      emailVerified: decoded.email_verified,
      roles: decoded.realm_access?.roles || [],
      clientRoles: decoded.resource_access?.[this.clientId]?.roles || []
    };
  }

  /**
   * Express middleware for protecting routes
   */
  middleware() {
    return async (req, res, next) => {
      try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            error: 'UNAUTHORIZED',
            message: 'Missing or invalid Authorization header'
          });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Validate token
        const decoded = await this.validateToken(token);
        
        // Extract user info
        const userInfo = this.extractUserInfo(decoded);
        
        // Attach user info to request
        req.user = userInfo;
        req.token = decoded;
        
        next();
      } catch (error) {
        console.error('[KeycloakAuth] Authentication failed:', error.message);
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Invalid or expired token'
        });
      }
    };
  }

  /**
   * Check if user has specific role
   * @param {Object} user - User object from req.user
   * @param {string} role - Role name to check
   * @returns {boolean}
   */
  hasRole(user, role) {
    return user.roles.includes(role) || user.clientRoles.includes(role);
  }

  /**
   * Express middleware for role-based access control
   * @param {string|string[]} requiredRoles - Required role(s)
   */
  requireRole(requiredRoles) {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
      }

      const hasRequiredRole = roles.some(role => this.hasRole(req.user, role));
      
      if (!hasRequiredRole) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: `Required role(s): ${roles.join(', ')}`
        });
      }

      next();
    };
  }
}

/**
 * Create Keycloak auth instance from environment variables
 */
function createKeycloakAuth() {
  const keycloakUrl = process.env.KEYCLOAK_URL;
  const realm = process.env.KEYCLOAK_REALM;
  const clientId = process.env.KEYCLOAK_CLIENT_ID;

  if (!keycloakUrl || !realm || !clientId) {
    console.warn('[KeycloakAuth] Keycloak configuration not found, authentication disabled');
    return null;
  }

  return new KeycloakAuth({
    keycloakUrl,
    realm,
    clientId
  });
}

module.exports = {
  KeycloakAuth,
  createKeycloakAuth
};
