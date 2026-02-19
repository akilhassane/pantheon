const { Pool } = require('pg');

async function fixOwnerProfileAndHelloMode() {
  console.log('🔧 Fixing Owner Profile and Hello Mode\n');
  console.log('='.repeat(60));
  
  const pool = new Pool({
    connectionString: process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_backend'
  });
  
  const userId = '5f9e36c9-f843-41d2-bffa-a07319a82ae1';
  const userEmail = 'akilhassane5@gmail.com';
  
  try {
    // Fix 1: Create/Update user in users table
    console.log('\n📋 Fix 1: Create/Update User');
    console.log('-'.repeat(60));
    
    // Check if user exists
    const checkUser = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (checkUser.rows.length === 0) {
      console.log('❌ User does not exist, creating...');
      
      // Create user
      await pool.query(
        `INSERT INTO users (id, email, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())`,
        [userId, userEmail]
      );
      
      console.log('✅ User created successfully');
    } else {
      console.log('ℹ️  User exists, updating email...');
      
      // Update user
      await pool.query(
        `UPDATE users 
         SET email = $2, updated_at = NOW()
         WHERE id = $1`,
        [userId, userEmail]
      );
      
      console.log('✅ User updated successfully');
    }
    
    // Verify user
    const verifyUser = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (verifyUser.rows.length > 0) {
      const user = verifyUser.rows[0];
      console.log('\n✅ User verified:');
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Email: ${user.email}`);
      console.log(`   - Created: ${user.created_at}`);
    }
    
    // Fix 2: Create "Hello" custom mode
    console.log('\n📋 Fix 2: Create "Hello" Custom Mode');
    console.log('-'.repeat(60));
    
    // Check if hello mode exists
    const checkMode = await pool.query(
      `SELECT * FROM custom_modes WHERE user_id = $1 AND name ILIKE '%hello%'`,
      [userId]
    );
    
    if (checkMode.rows.length === 0) {
      console.log('❌ Hello mode does not exist, creating...');
      
      // Create hello mode
      const helloModeId = require('crypto').randomUUID();
      await pool.query(
        `INSERT INTO custom_modes (id, user_id, name, system_prompt, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [
          helloModeId,
          userId,
          'Hello',
          'You are a friendly AI assistant. Always greet users warmly and be helpful.'
        ]
      );
      
      console.log('✅ Hello mode created successfully');
      console.log(`   - Mode ID: ${helloModeId}`);
    } else {
      console.log('✅ Hello mode already exists');
      console.log(`   - Mode ID: ${checkMode.rows[0].id}`);
      console.log(`   - Name: ${checkMode.rows[0].name}`);
    }
    
    // Verify custom modes
    const verifyModes = await pool.query(
      'SELECT * FROM custom_modes WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    console.log(`\n✅ Total custom modes for user: ${verifyModes.rows.length}`);
    verifyModes.rows.forEach((mode, index) => {
      console.log(`   ${index + 1}. ${mode.name} (ID: ${mode.id})`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL FIXES APPLIED SUCCESSFULLY!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

fixOwnerProfileAndHelloMode();
