/**
 * Supabase Admin Client Configuration
 * 
 * This module provides a singleton Supabase client instance configured with
 * the service role key for server-side admin operations.
 * 
 * SECURITY: This client bypasses Row Level Security (RLS) policies.
 * Only use on the backend. Never expose service role key to frontend.
 * 
 * LOCAL POSTGRES SUPPORT: When USE_LOCAL_POSTGRES=true, uses local PostgreSQL
 * instead of Supabase cloud database.
 */

const { createClient } = require('@supabase/supabase-js');
const { createPostgresClient } = require('./postgres-client');

let supabaseAdmin = null;
let useLocalPostgres = false;

/**
 * Get or create the Supabase admin client instance
 * @returns {import('@supabase/supabase-js').SupabaseClient} Supabase admin client
 */
function getSupabaseAdmin() {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  // Check if we should use local PostgreSQL
  useLocalPostgres = process.env.USE_LOCAL_POSTGRES === 'true';

  if (useLocalPostgres) {
    console.log('[Database] Using LOCAL PostgreSQL database');
    const databaseUrl = process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error(
        'Missing LOCAL_DATABASE_URL or DATABASE_URL environment variable for local PostgreSQL.'
      );
    }

    // Create a PostgreSQL client with Supabase-compatible interface
    supabaseAdmin = createPostgresClient();

    console.log('[Database] Local PostgreSQL client initialized');
    console.log('[Database] Database URL:', databaseUrl.replace(/:[^:@]+@/, ':****@')); // Hide password
  } else {
    console.log('[Database] Using CLOUD Supabase database');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.'
      );
    }

    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        fetch: (...args) => {
          const [url, options = {}] = args;
          // Add 60 second timeout to all Supabase requests (allows time for database wake-up on free tier)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);
          
          return fetch(url, {
            ...options,
            signal: controller.signal
          }).finally(() => clearTimeout(timeoutId));
        }
      }
    });

    console.log('[Database] Cloud admin client initialized');
  }

  return supabaseAdmin;
}

/**
 * Check if using local PostgreSQL
 * @returns {boolean} True if using local PostgreSQL
 */
function isUsingLocalPostgres() {
  return useLocalPostgres;
}

/**
 * Validate Supabase connection
 * @returns {Promise<boolean>} True if connection is valid
 */
async function validateConnection() {
  try {
    const client = getSupabaseAdmin();
    
    // Test connection by querying a table
    const { error } = await client
      .from('projects')
      .select('id')
      .limit(1);

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned (OK)
      console.error('[Supabase] Connection validation failed:', error.message);
      return false;
    }

    console.log('[Supabase] Connection validated successfully');
    return true;
  } catch (error) {
    console.error('[Supabase] Connection validation error:', error.message);
    return false;
  }
}

/**
 * Retry a Supabase query with exponential backoff
 * Useful for handling database wake-up delays on free tier
 * @param {Function} queryFn - Async function that performs the query
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Query result
 */
async function retryQuery(queryFn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry = null
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error;
      
      // Check if it's a timeout/abort error
      const isTimeout = error.name === 'AbortError' || 
                       error.message?.includes('aborted') ||
                       error.message?.includes('timeout');
      
      if (!isTimeout || attempt === maxRetries) {
        throw error;
      }

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, maxRetries, delay, error);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Increase delay for next attempt (exponential backoff)
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

module.exports = {
  getSupabaseAdmin,
  validateConnection,
  retryQuery,
  isUsingLocalPostgres
};
