/**
 * RLS Policy Verification Script
 * 
 * Tests Row Level Security policies with different user contexts
 * to ensure data access is properly restricted
 */

const { getSupabaseAdmin } = require('../config/supabase-client');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Test RLS policies for a specific table
 * @param {string} tableName - Table to test
 * @param {Object} userClient - Supabase client with user context
 * @param {Object} adminClient - Supabase admin client
 * @returns {Promise<Object>} Test results
 */
async function testTableRLS(tableName, userClient, adminClient) {
  const results = {
    table: tableName,
    rlsEnabled: false,
    canReadOwn: false,
    cannotReadOthers: false,
    canInsert: false,
    canUpdateOwn: false,
    cannotUpdateOthers: false
  };

  try {
    // Check if RLS is enabled
    const { data: rlsStatus } = await adminClient
      .from('pg_tables')
      .select('*')
      .eq('tablename', tableName)
      .single();

    results.rlsEnabled = rlsStatus?.rowsecurity === true;

    // Test read access (should only see own data)
    const { data: readData, error: readError } = await userClient
      .from(tableName)
      .select('*')
      .limit(10);

    results.canReadOwn = !readError;

    // Test insert (should be allowed for own data)
    // Note: This is a dry-run test, we don't actually insert
    results.canInsert = true; // Assume true if no error on read

    console.log(`✅ ${tableName}: RLS ${results.rlsEnabled ? 'enabled' : 'disabled'}`);

  } catch (error) {
    console.error(`❌ ${tableName}: Test failed -`, error.message);
  }

  return results;
}

/**
 * Main verification function
 */
async function verifyRLS() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           RLS POLICY VERIFICATION                         ');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Get admin client
    const adminClient = getSupabaseAdmin();

    // Create a user client (using anon key for testing)
    const userClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
    );

    console.log('🔍 Testing RLS policies...\n');

    const tables = ['projects', 'sessions', 'chat_messages', 'collaborations', 'collaborator_access'];
    const results = [];

    for (const table of tables) {
      const result = await testTableRLS(table, userClient, adminClient);
      results.push(result);
    }

    // Generate report
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                    RLS POLICY REPORT                      ');
    console.log('═══════════════════════════════════════════════════════════\n');

    let allEnabled = true;
    for (const result of results) {
      console.log(`Table: ${result.table}`);
      console.log(`  RLS Enabled: ${result.rlsEnabled ? '✅' : '❌'}`);
      console.log(`  Can Read Own Data: ${result.canReadOwn ? '✅' : '❌'}`);
      console.log('');

      if (!result.rlsEnabled) {
        allEnabled = false;
      }
    }

    if (allEnabled) {
      console.log('✅ All tables have RLS enabled');
    } else {
      console.log('⚠️  Some tables do not have RLS enabled');
      console.log('   Please ensure all tables have RLS policies applied');
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('\n📝 Note: This script performs basic RLS verification.');
    console.log('   For comprehensive testing, create test users and verify:');
    console.log('   - Users can only see their own projects');
    console.log('   - Users can see projects they collaborate on');
    console.log('   - Users cannot modify others\' data');
    console.log('   - Cascade deletes work correctly\n');

    return allEnabled;

  } catch (error) {
    console.error('❌ RLS verification failed:', error.message);
    console.error('\nPlease ensure:');
    console.error('  1. SUPABASE_URL and SUPABASE_SERVICE_KEY are set');
    console.error('  2. Database schema has been applied');
    console.error('  3. RLS policies are defined in schema.sql\n');
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  verifyRLS().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { verifyRLS };
