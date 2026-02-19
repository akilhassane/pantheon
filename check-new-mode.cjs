// Check for any mode named "New Mode" in the database
const { Pool } = require('pg');

async function checkNewMode() {
  console.log('🔍 Checking for "New Mode" in Database\n');
  console.log('='.repeat(60));
  
  const pool = new Pool({
    connectionString: process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_backend'
  });
  
  const userId = '5f9e36c9-f843-41d2-bffa-a07319a82ae1';
  
  try {
    // Get all custom modes for this user
    const allResult = await pool.query(
      'SELECT * FROM custom_modes WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    console.log(`\n📊 All custom modes in database: ${allResult.rows.length}`);
    console.log('-'.repeat(60));
    
    allResult.rows.forEach((mode, index) => {
      console.log(`${index + 1}. ${mode.name} (ID: ${mode.id.substring(0, 8)}...)`);
    });
    
    // Check for "New Mode" specifically
    const newModeResult = await pool.query(
      `SELECT * FROM custom_modes WHERE user_id = $1 AND name = 'New Mode' ORDER BY created_at DESC`,
      [userId]
    );
    
    console.log('\n' + '='.repeat(60));
    console.log('🔍 Modes named "New Mode":');
    console.log('-'.repeat(60));
    
    if (newModeResult.rows.length === 0) {
      console.log('❌ No modes named "New Mode" found');
      console.log('\nThis means either:');
      console.log('1. The mode was created but immediately renamed');
      console.log('2. The mode creation failed');
      console.log('3. The mode is only in localStorage, not database');
    } else {
      console.log(`✅ Found ${newModeResult.rows.length} mode(s) named "New Mode":`);
      newModeResult.rows.forEach((mode, index) => {
        console.log(`\n${index + 1}. New Mode`);
        console.log(`   - ID: ${mode.id}`);
        console.log(`   - Created: ${mode.created_at}`);
        console.log(`   - Description: ${mode.description || 'N/A'}`);
        console.log(`   - System Prompt: ${mode.system_prompt || 'N/A'}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkNewMode();
