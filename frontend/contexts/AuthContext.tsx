'use client';

/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the application
 * Supports both Supabase and Keycloak authentication
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { hybridAuth, AuthUser, AuthSession } from '@/lib/auth-provider';

interface AuthContextType {
  user: User | AuthUser | null;
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
  const [user, setUser] = useState<User | AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Development mode bypass - skip auth if NEXT_PUBLIC_DEV_MODE is set
  const devMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

  useEffect(() => {
    if (devMode) {
      // Create a mock user for development
      const mockUser = {
        id: 'dev-user-123',
        email: 'dev@localhost',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as User;
      
      setUser(mockUser);
      setLoading(false);
      console.log('[Auth] Development mode - using mock user');
      return;
    }

    // Check active session on mount using hybrid auth
    hybridAuth.getSession().then((session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      console.error('[Auth] Failed to get session:', error);
      setLoading(false);
    });

    // Listen for auth changes
    const unsubscribe = hybridAuth.onAuthStateChange((session) => {
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

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error: any) {
      // Check if it's a timeout/network error
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        throw new Error('Connection to authentication service timed out. Please check your network connection and try again.');
      }
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    if (devMode) {
      console.log('[Auth] Development mode - sign up bypassed');
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const signOut = async () => {
    if (devMode) {
      console.log('[Auth] Development mode - sign out bypassed');
      return;
    }

    await hybridAuth.signOut();
  };

  const signInWithGoogle = async () => {
    if (devMode) {
      console.log('[Auth] Development mode - Google sign in bypassed');
      return;
    }

    await hybridAuth.signInWithOAuth('google');
  };

  const signInWithGithub = async () => {
    if (devMode) {
      console.log('[Auth] Development mode - GitHub sign in bypassed');
      return;
    }

    // GitHub only supported via Supabase
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const signInWithMicrosoft = async () => {
    if (devMode) {
      console.log('[Auth] Development mode - Microsoft sign in bypassed');
      return;
    }

    await hybridAuth.signInWithOAuth('microsoft');
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
