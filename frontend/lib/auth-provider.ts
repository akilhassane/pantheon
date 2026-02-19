/**
 * Hybrid Authentication Provider
 * 
 * Supports both Supabase and Keycloak authentication
 * Automatically detects which provider to use based on environment variables
 */

import { supabase } from './supabase';

export type AuthProvider = 'supabase' | 'keycloak';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  provider?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  user: AuthUser;
}

/**
 * Detect which auth provider to use
 */
export function getAuthProvider(): AuthProvider {
  const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL;
  const keycloakRealm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM;
  
  if (keycloakUrl && keycloakRealm) {
    return 'keycloak';
  }
  
  return 'supabase';
}

/**
 * Keycloak OAuth Helper
 */
class KeycloakAuth {
  private keycloakUrl: string;
  private realm: string;
  private clientId: string;
  
  constructor() {
    this.keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL || '';
    this.realm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || '';
    this.clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || '';
  }
  
  /**
   * Get Keycloak OAuth URL for a provider
   */
  getOAuthUrl(provider: 'google' | 'microsoft', redirectUri: string): string {
    const identityProvider = provider === 'microsoft' ? 'microsoft' : 'google';
    return `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/auth?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&kc_idp_hint=${identityProvider}`;
  }
  
  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<AuthSession> {
    const tokenUrl = `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/token`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        code: code,
        redirect_uri: redirectUri,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to exchange code for tokens');
    }
    
    const data = await response.json();
    
    // Decode JWT to get user info (basic decode, no verification needed on client)
    const payload = JSON.parse(atob(data.access_token.split('.')[1]));
    
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        provider: 'keycloak',
      },
    };
  }
  
  /**
   * Get current session from localStorage
   */
  getSession(): AuthSession | null {
    if (typeof window === 'undefined') return null;
    
    const sessionStr = localStorage.getItem('keycloak_session');
    if (!sessionStr) return null;
    
    try {
      return JSON.parse(sessionStr);
    } catch {
      return null;
    }
  }
  
  /**
   * Save session to localStorage
   */
  setSession(session: AuthSession): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('keycloak_session', JSON.stringify(session));
  }
  
  /**
   * Clear session
   */
  clearSession(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('keycloak_session');
  }
  
  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    this.clearSession();
    
    // Redirect to Keycloak logout
    const logoutUrl = `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/logout?redirect_uri=${encodeURIComponent(window.location.origin)}`;
    window.location.href = logoutUrl;
  }
}

/**
 * Unified Auth API
 */
export class HybridAuth {
  private provider: AuthProvider;
  private keycloak: KeycloakAuth;
  
  constructor() {
    this.provider = getAuthProvider();
    this.keycloak = new KeycloakAuth();
    
    console.log(`[HybridAuth] Using provider: ${this.provider}`);
  }
  
  /**
   * Get current session
   */
  async getSession(): Promise<AuthSession | null> {
    if (this.provider === 'keycloak') {
      return this.keycloak.getSession();
    }
    
    // Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      user: {
        id: session.user.id,
        email: session.user.email || '',
        provider: 'supabase',
      },
    };
  }
  
  /**
   * Sign in with OAuth provider
   */
  async signInWithOAuth(provider: 'google' | 'microsoft'): Promise<void> {
    const redirectUri = `${window.location.origin}/auth/callback`;
    
    if (this.provider === 'keycloak') {
      const oauthUrl = this.keycloak.getOAuthUrl(provider, redirectUri);
      window.location.href = oauthUrl;
      return;
    }
    
    // Supabase
    const supabaseProvider = provider === 'microsoft' ? 'azure' : 'google';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: supabaseProvider as any,
      options: {
        redirectTo: redirectUri,
      },
    });
    
    if (error) {
      throw new Error(error.message);
    }
  }
  
  /**
   * Handle OAuth callback
   */
  async handleCallback(code: string): Promise<AuthSession> {
    const redirectUri = `${window.location.origin}/auth/callback`;
    
    if (this.provider === 'keycloak') {
      const session = await this.keycloak.exchangeCodeForTokens(code, redirectUri);
      this.keycloak.setSession(session);
      return session;
    }
    
    // Supabase handles this automatically
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No session after callback');
    }
    
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      user: {
        id: session.user.id,
        email: session.user.email || '',
        provider: 'supabase',
      },
    };
  }
  
  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    if (this.provider === 'keycloak') {
      await this.keycloak.signOut();
      return;
    }
    
    // Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }
  
  /**
   * Listen for auth state changes
   */
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    if (this.provider === 'keycloak') {
      // For Keycloak, check session on mount
      const session = this.keycloak.getSession();
      callback(session);
      
      // Return no-op unsubscribe
      return () => {};
    }
    
    // Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        callback({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          user: {
            id: session.user.id,
            email: session.user.email || '',
            provider: 'supabase',
          },
        });
      } else {
        callback(null);
      }
    });
    
    return () => subscription.unsubscribe();
  }
}

// Export singleton instance
export const hybridAuth = new HybridAuth();
