/**
 * Create Supabase Tables using Supabase Client
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function createTables() {
  console.log('🔧 Creating Supabase tables...\n');
  
  // Load environment variables
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env');
    process.exit(1);
  }
  
  console.log('📡 Connecting to Supabase...');
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Executing schema SQL via RPC...\n');
    
    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Found ${statements.length} SQL statements to execute...\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      // Skip comments
      if (statement.trim().startsWith('--')) continue;
      
      try {
        // Use the REST API to execute SQL
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement
        });
        
        if (error) {
          // Try alternative method - direct query
          console.log(`Statement ${i + 1}/${statements.length}: Trying alternative method...`);
          
          // For table creation, we can use the from() method with a workaround
          // But this won't work for CREATE TABLE statements
          // We need to use the SQL Editor or psql
          throw error;
        }
        
        console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
      } catch (err) {
        console.error(`⚠️  Statement ${i + 1} failed:`, err.message);
      }
    }
    
    console.log('\n🔍 Verifying tables...');
    const tables = ['projects', 'sessions', 'chat_messages', 'collaborations', 'collaborator_access'];
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('count')
        .limit(1);
      
      if (error) {
        console.log(`❌ Table '${table}': ${error.message}`);
      } else {
        console.log(`✅ Table '${table}' exists and is accessible`);
      }
    }
    
    console.log('\n📋 Note: Supabase JS client cannot execute DDL statements directly.');
    console.log('Please run the schema SQL in the Supabase SQL Editor:');
    console.log('👉 https://app.supabase.com/project/ekkrtmslvdypwilhdpgk/sql\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📋 Please run the schema SQL manually in Supabase SQL Editor:');
    console.log('👉 https://app.supabase.com/project/ekkrtmslvdypwilhdpgk/sql');
  }
}

createTables();
