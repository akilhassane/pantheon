/**
 * Supabase Client Configuration
 * 
 * This module provides a Supabase client instance configured with
 * the anon key for client-side operations with RLS enforcement.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.'
  );
}

/**
 * Supabase client instance for frontend use
 * - Uses anon key (safe for client-side)
 * - RLS policies enforced
 * - Auto token refresh enabled
 * - Session persisted in localStorage
 */
// Get the redirect URL - use production URL on Vercel, localhost for local dev
const getRedirectUrl = () => {
  if (typeof window === 'undefined') {
    // Server-side: use production URL if on Vercel, otherwise localhost
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  }
  
  // Client-side: use current origin (works for both local and production)
  return window.location.origin;
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    detectSessionInUrl: true,
    // Force redirect to localhost instead of container hostname
    redirectTo: getRedirectUrl()
  }
});

/**
 * Get the current session token for API requests
 * @returns {Promise<string | null>} JWT token or null if not authenticated
 */
export async function getSessionToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Get the current authenticated user
 * @returns {Promise<import('@supabase/supabase-js').User | null>} User object or null
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
