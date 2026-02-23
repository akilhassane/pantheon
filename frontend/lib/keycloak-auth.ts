/**
 * Keycloak Authentication
 * 
 * Simple Keycloak authentication using backend API
 * No Supabase dependency
 */

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  user: AuthUser;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const SESSION_KEY = 'auth_session';
const USER_KEY = 'user';

/**
 * Keycloak Auth Class
 */
class KeycloakAuth {
  private listeners: Array<(session: AuthSession | null) => void> = [];

  /**
   * Get current session from localStorage
   */
  async getSession(): Promise<AuthSession | null> {
    if (typeof window === 'undefined') return null;

    try {
      const sessionStr = localStorage.getItem(SESSION_KEY);
      if (!sessionStr) return null;

      const session = JSON.parse(sessionStr);
      
      // Validate token with backend
      const isValid = await this.validateToken(session.access_token);
      if (!isValid) {
        this.clearSession();
        return null;
      }

      return session;
    } catch (error) {
      console.error('[KeycloakAuth] Error getting session:', error);
      return null;
    }
  }

  /**
   * Validate token with backend
   */
  private async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/auth/validate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      return response.ok;
    } catch (error) {
      console.error('[KeycloakAuth] Token validation failed:', error);
      return false;
    }
  }

  /**
   * Sign in with OAuth provider (Google, Microsoft)
   */
  async signInWithOAuth(provider: 'google' | 'microsoft'): Promise<void> {
    if (typeof window === 'undefined') return;

    // Redirect to backend OAuth endpoint
    const redirectUri = `${window.location.origin}/auth/callback`;
    const oauthUrl = `${API_URL}/api/auth/oauth/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    console.log('[KeycloakAuth] Redirecting to OAuth:', oauthUrl);
    window.location.href = oauthUrl;
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(code: string): Promise<AuthSession> {
    const redirectUri = `${window.location.origin}/auth/callback`;
    
    const response = await fetch(`${API_URL}/api/auth/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const session: AuthSession = await response.json();
    
    // Store session
    this.setSession(session);
    
    return session;
  }

  /**
   * Sign out - only clears local session, doesn't invalidate Keycloak session
   * This allows multiple users to be signed in simultaneously in different browser contexts
   */
  async signOut(): Promise<void> {
    // Just clear local session without calling Keycloak logout
    // This allows incognito/different tabs to have different users signed in
    this.clearSession();
    this.notifyListeners(null);
  }

  /**
   * Listen for auth state changes
   */
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Store session in localStorage
   */
  private setSession(session: AuthSession): void {
    if (typeof window === 'undefined') return;

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    
    this.notifyListeners(session);
  }

  /**
   * Clear session from localStorage
   */
  private clearSession(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_KEY);
  }

  /**
   * Notify all listeners of auth state change
   */
  private notifyListeners(session: AuthSession | null): void {
    this.listeners.forEach(listener => listener(session));
  }
}

// Export singleton instance
export const keycloakAuth = new KeycloakAuth();
