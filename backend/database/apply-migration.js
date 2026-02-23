/**
 * Database Migration Application Script
 * 
 * Applies the complete integration migration to Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Calculate checksum for migration file
 */
function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Check if migration has already been applied
 */
async function isMigrationApplied(version) {
  const { data, error } = await supabase
    .from('schema_migrations')
    .select('version')
    .eq('version', version)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    throw error;
  }
  
  return !!data;
}

/**
 * Apply migration to database
 */
async function applyMigration() {
  console.log('🚀 Starting database migration...\n');
  
  const migrationPath = path.join(__dirname, 'migrations', '20250108_complete_integration.sql');
  
  // Read migration file
  console.log('📖 Reading migration file...');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  const checksum = calculateChecksum(migrationSQL);
  
  console.log(`   File: ${migrationPath}`);
  console.log(`   Checksum: ${checksum.substring(0, 16)}...\n`);
  
  // Check if already applied
  const version = '20250108_complete_integration';
  const alreadyApplied = await isMigrationApplied(version);
  
  if (alreadyApplied) {
    console.log('ℹ️  Migration already applied. Skipping...');
    return;
  }
  
  console.log('⚙️  Applying migration...');
  
  // Execute migration SQL
  // Note: Supabase client doesn't support raw SQL execution directly
  // We need to use the SQL editor or pg client
  console.log('\n⚠️  IMPORTANT:');
  console.log('   The Supabase JS client cannot execute raw SQL migrations.');
  console.log('   Please apply this migration using one of these methods:\n');
  console.log('   1. Supabase Dashboard SQL Editor:');
  console.log(`      https://app.supabase.com/project/${supabaseUrl.split('.')[0].split('//')[1]}/sql/new`);
  console.log('      Copy and paste the contents of:');
  console.log(`      ${migrationPath}\n`);
  console.log('   2. Using psql command line:');
  console.log(`      psql $DATABASE_URL -f ${migrationPath}\n`);
  console.log('   3. Using Supabase CLI:');
  console.log(`      supabase db push\n`);
  
  console.log('📋 Migration file ready at:');
  console.log(`   ${migrationPath}\n`);
}

/**
 * Verify migration was applied successfully
 */
async function verifyMigration() {
  console.log('🔍 Verifying migration...\n');
  
  const tablesToCheck = [
    'task_lists',
    'tasks',
    'media_blocks',
    'session_states',
    'image_attachments',
    'user_preferences',
    'execution_contexts',
    'mcp_configurations',
    'performance_metrics',
    'audit_logs',
    'schema_migrations'
  ];
  
  console.log('Checking tables:');
  
  for (const table of tablesToCheck) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(0);
      
      if (error) {
        console.log(`   ❌ ${table} - NOT FOUND`);
      } else {
        console.log(`   ✅ ${table}`);
      }
    } catch (err) {
      console.log(`   ❌ ${table} - ERROR: ${err.message}`);
    }
  }
  
  console.log('\n✨ Verification complete!');
}

// Main execution
async function main() {
  try {
    await applyMigration();
    
    // Ask user if they want to verify
    console.log('\n❓ Would you like to verify the migration? (Run with --verify flag)');
    
    if (process.argv.includes('--verify')) {
      await verifyMigration();
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
