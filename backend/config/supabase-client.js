/**
 * Supabase Admin Client Configuration
 * 
 * This module provides a singleton Supabase client instance configured with
 * the service role key for server-side admin operations.
 * 
 * SECURITY: This client bypasses Row Level Security (RLS) policies.
 * Only use on the backend. Never expose service role key to frontend.
 */

const { createClient } = require('@supabase/supabase-js');

let supabaseAdmin = null;

/**
 * Get or create the Supabase admin client instance
 * @returns {import('@supabase/supabase-js').SupabaseClient} Supabase admin client
 */
function getSupabaseAdmin() {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

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
    }
  });

  console.log('[Supabase] Admin client initialized');
  return supabaseAdmin;
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

module.exports = {
  getSupabaseAdmin,
  validateConnection
};
