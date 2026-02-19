const { Pool } = require('pg');

async function checkAllCustomModes() {
  console.log('🔍 Checking All Custom Modes in Database\n');
  console.log('='.repeat(60));
  
  const pool = new Pool({
    connectionString: process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_backend'
  });
  
  const userId = '5f9e36c9-f843-41d2-bffa-a07319a82ae1';
  
  try {
    // Get all custom modes for this user
    const result = await pool.query(
      'SELECT * FROM custom_modes WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    console.log(`\n📊 Total custom modes in database: ${result.rows.length}`);
    console.log('-'.repeat(60));
    
    if (result.rows.length === 0) {
      console.log('❌ No custom modes found in database');
    } else {
      result.rows.forEach((mode, index) => {
        console.log(`\n${index + 1}. ${mode.name}`);
        console.log(`   - ID: ${mode.id}`);
        console.log(`   - User ID: ${mode.user_id}`);
        console.log(`   - Created: ${mode.created_at}`);
        console.log(`   - Updated: ${mode.updated_at}`);
        console.log(`   - System Prompt: ${mode.system_prompt?.substring(0, 100)}...`);
      });
    }
    
    // Also check via API
    console.log('\n' + '='.repeat(60));
    console.log('📡 Checking via API endpoint');
    console.log('-'.repeat(60));
    
    const fetch = (await import('node-fetch')).default;
    const backendUrl = 'http://localhost:3002';
    
    const response = await fetch(`${backendUrl}/api/custom-modes?userId=${userId}`);
    const data = await response.json();
    
    console.log(`\n📊 Total custom modes from API: ${data.modes?.length || 0}`);
    
    if (data.modes && data.modes.length > 0) {
      data.modes.forEach((mode, index) => {
        console.log(`\n${index + 1}. ${mode.name}`);
        console.log(`   - ID: ${mode.id}`);
      });
    }
    
    // Compare
    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPARISON');
    console.log('-'.repeat(60));
    console.log(`Database: ${result.rows.length} modes`);
    console.log(`API: ${data.modes?.length || 0} modes`);
    console.log(`Frontend reports: 2 modes`);
    
    if (result.rows.length !== 2) {
      console.log(`\n⚠️  MISMATCH: Database has ${result.rows.length} modes but frontend shows 2`);
      console.log(`\nThe missing mode might be:`);
      console.log(`- Not saved to database (only in frontend state)`);
      console.log(`- Saved with a different user_id`);
      console.log(`- Deleted from database`);
    } else {
      console.log(`\n✅ Database matches frontend (2 modes)`);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

checkAllCustomModes();
