#!/usr/bin/env node

/**
 * Apply custom_modes table migration to Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: './backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('📋 Applying custom_modes table migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20260215000000_create_custom_modes_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL:');
    console.log('─'.repeat(80));
    console.log(migrationSQL);
    console.log('─'.repeat(80));
    console.log('');

    // Execute the migration
    console.log('🚀 Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // If exec_sql doesn't exist, try direct execution (this won't work for all SQL)
      console.log('⚠️  exec_sql function not found, trying alternative method...');
      
      // Split into individual statements and execute
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        console.log(`\n📝 Executing: ${statement.substring(0, 100)}...`);
        
        // For CREATE TABLE, we can use the from() API
        if (statement.toLowerCase().includes('create table')) {
          console.log('⚠️  Cannot execute CREATE TABLE via Supabase client');
          console.log('Please run this migration manually in Supabase SQL Editor:');
          console.log('https://supabase.com/dashboard/project/_/sql');
          console.log('');
          console.log('Copy and paste the migration SQL above into the SQL Editor and run it.');
          process.exit(1);
        }
      }
    } else {
      console.log('✅ Migration applied successfully!');
    }

    // Verify the table was created
    console.log('\n🔍 Verifying custom_modes table...');
    const { data: tableData, error: tableError } = await supabase
      .from('custom_modes')
      .select('*')
      .limit(1);

    if (tableError) {
      if (tableError.code === '42P01') {
        console.log('❌ Table does not exist. Please apply the migration manually.');
        console.log('\n📋 Manual Steps:');
        console.log('1. Go to: https://supabase.com/dashboard/project/_/sql');
        console.log('2. Copy the migration SQL from above');
        console.log('3. Paste it into the SQL Editor');
        console.log('4. Click "Run"');
      } else {
        console.log('⚠️  Error verifying table:', tableError.message);
      }
    } else {
      console.log('✅ Table verified successfully!');
      console.log('\n🎉 Migration complete! You can now create custom modes in the frontend.');
    }

  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.log('\n📋 Manual Migration Required:');
    console.log('1. Go to: https://supabase.com/dashboard/project/_/sql');
    console.log('2. Copy the migration SQL from: supabase/migrations/20260215000000_create_custom_modes_table.sql');
    console.log('3. Paste it into the SQL Editor');
    console.log('4. Click "Run"');
    process.exit(1);
  }
}

applyMigration();
