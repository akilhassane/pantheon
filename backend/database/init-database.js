/**
 * Initialize Supabase Database
 * 
 * This script creates the necessary tables and indexes in Supabase
 * Uses the Supabase Management API to apply schema automatically
 */

const { createClient } = require('@supabase/supabase-js');
const { getSupabaseAdmin } = require('../config/supabase-client');
const fs = require('fs');
const path = require('path');

/**
 * Apply schema using Supabase Management API
 * @param {string} schema - SQL schema to apply
 * @returns {Promise<boolean>} Success status
 */
async function applySchemaViaAPI(schema) {
  const projectRef = process.env.SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const managementToken = process.env.SUPABASE_SERVICE_KEY;

  if (!projectRef || !managementToken) {
    console.log('⚠️  Cannot auto-apply schema: Missing project ref or service key');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${managementToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: schema })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Schema application failed:', error);
      return false;
    }

    console.log('✅ Schema applied successfully via Management API');
    return true;
  } catch (error) {
    console.error('❌ Failed to apply schema via API:', error.message);
    return false;
  }
}

async function initDatabase() {
  console.log('🔧 Initializing Supabase database...');
  
  // Load environment variables
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  
  // Get Supabase admin client
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error.message);
    console.log('\nPlease ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set in your .env file');
    process.exit(1);
  }
  
  try {
    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Schema file loaded');
    
    // Try to apply schema automatically
    console.log('\n🔄 Attempting to apply schema automatically...');
    const applied = await applySchemaViaAPI(schema);
    
    if (!applied) {
      // Fallback: Show manual instructions
      const projectRef = process.env.SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      console.log('\n⚠️  Automatic schema application failed.');
      console.log('   Please run the schema manually in your Supabase SQL Editor:');
      if (projectRef) {
        console.log(`   https://app.supabase.com/project/${projectRef}/sql/new`);
      }
      console.log('\n   Copy and paste the contents of backend/database/schema.sql\n');
    }
    
    // Verify tables exist
    console.log('\n🔍 Verifying tables...');
    
    const tables = ['projects', 'sessions', 'chat_messages', 'collaborations', 'collaborator_access'];
    const results = { success: [], failed: [] };
    
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('id')
        .limit(1);
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned (OK)
        console.error(`❌ Table ${table}: ${error.message}`);
        results.failed.push(table);
      } else {
        console.log(`✅ Table ${table}: OK`);
        results.success.push(table);
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('              DATABASE INITIALIZATION SUMMARY              ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Tables verified: ${results.success.length}/${tables.length}`);
    if (results.failed.length > 0) {
      console.log(`❌ Tables missing: ${results.failed.join(', ')}`);
      console.log('\n⚠️  Please apply the schema manually (see instructions above)');
    } else {
      console.log('✅ All tables exist and are accessible');
    }
    console.log('═══════════════════════════════════════════════════════════\n');
    
    return results.failed.length === 0;
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };
