// Script to sync custom modes from database to localStorage
// This will ensure localStorage matches the database

const { Pool } = require('pg');

async function syncCustomModesToLocalStorage() {
  console.log('🔄 Syncing Custom Modes from Database to localStorage\n');
  console.log('='.repeat(60));
  
  const pool = new Pool({
    connectionString: process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_backend'
  });
  
  const userId = '5f9e36c9-f843-41d2-bffa-a07319a82ae1';
  
  try {
    // Get all custom modes for this user from database
    const result = await pool.query(
      'SELECT * FROM custom_modes WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    console.log(`\n📊 Found ${result.rows.length} custom modes in database`);
    console.log('-'.repeat(60));
    
    if (result.rows.length === 0) {
      console.log('❌ No custom modes found in database');
    } else {
      result.rows.forEach((mode, index) => {
        console.log(`\n${index + 1}. ${mode.name}`);
        console.log(`   - ID: ${mode.id}`);
        console.log(`   - Created: ${mode.created_at}`);
      });
    }
    
    // Transform to frontend format
    const modes = result.rows.map(mode => ({
      id: mode.id,
      name: mode.name,
      description: mode.description || '',
      systemPrompt: mode.system_prompt,
      createdAt: new Date(mode.created_at).getTime(),
      user_id: mode.user_id,
      created_at: mode.created_at,
      updated_at: mode.updated_at
    }));
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 BROWSER CONSOLE SCRIPT');
    console.log('Copy and paste this into your browser console to sync:');
    console.log('='.repeat(60));
    console.log(`
// Sync custom modes from database to localStorage
const modesFromDatabase = ${JSON.stringify(modes, null, 2)};

// Get current settings
const settingsStr = localStorage.getItem('app-settings');
let settings = settingsStr ? JSON.parse(settingsStr) : {};

// Update custom modes
settings.customModes = modesFromDatabase;

// Save back to localStorage
localStorage.setItem('app-settings', JSON.stringify(settings));

console.log('✅ Custom modes synced to localStorage');
console.log('📊 Count:', modesFromDatabase.length);
console.log('🔄 Please refresh the page to see the changes');
`);
    
    console.log('='.repeat(60));
    console.log('\n✅ After running the script above, refresh your browser');
    console.log('   The frontend should now show 1 custom mode (matching database)');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

syncCustomModesToLocalStorage();
