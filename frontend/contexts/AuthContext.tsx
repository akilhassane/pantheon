'use client';

/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the application
 * Uses Keycloak authentication through backend API
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { keycloakAuth, AuthUser, AuthSession } from '@/lib/keycloak-auth';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Development mode bypass - skip auth if NEXT_PUBLIC_DEV_MODE is set
  const devMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

  useEffect(() => {
    if (devMode) {
      // Create a mock user for development
      const mockUser = {
        id: 'dev-user-123',
        email: 'dev@localhost',
      } as AuthUser;
      
      setUser(mockUser);
      setLoading(false);
      console.log('[Auth] Development mode - using mock user');
      return;
    }

    // Check if we have an OAuth callback code in the URL
    const handleOAuthCallback = async () => {
      if (typeof window === 'undefined') return;
      
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        console.log('[AuthContext] OAuth callback detected, exchanging code for tokens...');
        try {
          const session = await keycloakAuth.handleCallback(code);
          console.log('[AuthContext] OAuth callback successful, user:', session.user.email);
          setUser(session.user);
          setLoading(false);
          
          // Clean up URL (remove code parameter)
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        } catch (error) {
          console.error('[AuthContext] OAuth callback failed:', error);
          setLoading(false);
          return;
        }
      }
    };

    // Handle OAuth callback first
    handleOAuthCallback().then(() => {
      // If no callback, check for existing session
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.get('code')) {
        console.log('[AuthContext] Checking for active session...');
        keycloakAuth.getSession().then((session) => {
          console.log('[AuthContext] Session check result:', session ? 'Session found' : 'No session');
          setUser(session?.user ?? null);
          setLoading(false);
        }).catch((error) => {
          console.error('[Auth] Failed to get session:', error);
          setLoading(false);
        });
      }
    });

    // Listen for auth changes
    const unsubscribe = keycloakAuth.onAuthStateChange((session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [devMode]);

  const signIn = async (email: string, password: string) => {
    if (devMode) {
      console.log('[Auth] Development mode - sign in bypassed');
      return;
    }

    throw new Error('Email/password sign in not supported. Please use OAuth providers.');
  };

  const signUp = async (email: string, password: string) => {
    if (devMode) {
      console.log('[Auth] Development mode - sign up bypassed');
      return;
    }

    throw new Error('Email/password sign up not supported. Please use OAuth providers.');
  };

  const signOut = async () => {
    if (devMode) {
      console.log('[Auth] Development mode - sign out bypassed');
      return;
    }

    await keycloakAuth.signOut();
  };

  const signInWithGoogle = async () => {
    if (devMode) {
      console.log('[Auth] Development mode - Google sign in bypassed');
      return;
    }

    await keycloakAuth.signInWithOAuth('google');
  };

  const signInWithGithub = async () => {
    if (devMode) {
      console.log('[Auth] Development mode - GitHub sign in bypassed');
      return;
    }

    throw new Error('GitHub sign in not supported. Please use Google or Microsoft.');
  };

  const signInWithMicrosoft = async () => {
    if (devMode) {
      console.log('[Auth] Development mode - Microsoft sign in bypassed');
      return;
    }

    await keycloakAuth.signInWithOAuth('microsoft');
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    signInWithGithub,
    signInWithMicrosoft,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
