const { Pool } = require('pg');

async function checkDatabaseSchema() {
  console.log('🔍 Checking Database Schema\n');
  
  const pool = new Pool({
    connectionString: process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_backend'
  });
  
  try {
    // List all tables
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 Available Tables:');
    console.log('-'.repeat(60));
    tables.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.table_name}`);
    });
    
    // Check if profiles table exists
    const hasProfiles = tables.rows.some(row => row.table_name === 'profiles');
    console.log(`\n${hasProfiles ? '✅' : '❌'} profiles table ${hasProfiles ? 'exists' : 'does NOT exist'}`);
    
    // Check users table structure
    const usersTable = tables.rows.find(row => row.table_name === 'users');
    if (usersTable) {
      console.log('\n📋 Users Table Structure:');
      console.log('-'.repeat(60));
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      columns.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(required)' : '(optional)'}`);
      });
      
      // Get sample user data
      const sampleUser = await pool.query('SELECT * FROM users LIMIT 1');
      if (sampleUser.rows.length > 0) {
        console.log('\n📋 Sample User Data:');
        console.log('-'.repeat(60));
        console.log(JSON.stringify(sampleUser.rows[0], null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkDatabaseSchema();
