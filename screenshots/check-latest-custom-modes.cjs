// Check the latest custom modes in the database
const { Pool } = require('pg');

async function checkLatestCustomModes() {
  console.log('🔍 Checking Latest Custom Modes in Database\n');
  console.log('='.repeat(60));
  
  const pool = new Pool({
    connectionString: process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_backend'
  });
  
  const userId = '5f9e36c9-f843-41d2-bffa-a07319a82ae1';
  
  try {
    // Get all custom modes for this user, ordered by most recent first
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
        const isNew = (Date.now() - new Date(mode.created_at).getTime()) < 60000; // Less than 1 minute old
        const newBadge = isNew ? ' 🆕 NEW!' : '';
        
        console.log(`\n${index + 1}. ${mode.name}${newBadge}`);
        console.log(`   - ID: ${mode.id}`);
        console.log(`   - User ID: ${mode.user_id}`);
        console.log(`   - Description: ${mode.description || 'N/A'}`);
        console.log(`   - Created: ${mode.created_at}`);
        console.log(`   - Updated: ${mode.updated_at}`);
        console.log(`   - System Prompt: ${mode.system_prompt?.substring(0, 150)}...`);
        
        if (isNew) {
          console.log(`   ⏰ Created ${Math.floor((Date.now() - new Date(mode.created_at).getTime()) / 1000)} seconds ago`);
        }
      });
    }
    
    // Check for modes created in the last 5 minutes
    const recentResult = await pool.query(
      `SELECT * FROM custom_modes 
       WHERE user_id = $1 
       AND created_at > NOW() - INTERVAL '5 minutes'
       ORDER BY created_at DESC`,
      [userId]
    );
    
    console.log('\n' + '='.repeat(60));
    console.log('📅 Modes created in the last 5 minutes:');
    console.log('-'.repeat(60));
    
    if (recentResult.rows.length === 0) {
      console.log('❌ No modes created in the last 5 minutes');
    } else {
      console.log(`✅ Found ${recentResult.rows.length} recent mode(s):`);
      recentResult.rows.forEach((mode, index) => {
        console.log(`\n${index + 1}. ${mode.name}`);
        console.log(`   - Created: ${mode.created_at}`);
        console.log(`   - Description: ${mode.description || 'N/A'}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

checkLatestCustomModes();
