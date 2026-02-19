// This script checks what's in localStorage for custom modes
// Since we can't directly access browser localStorage from Node.js,
// we'll create a script that the user can run in their browser console

console.log(`
=============================================================
BROWSER CONSOLE SCRIPT - Copy and paste this into your browser console:
=============================================================

// Check localStorage for custom modes
const settings = localStorage.getItem('app-settings');
if (settings) {
  const parsed = JSON.parse(settings);
  console.log('📋 Custom Modes in localStorage:', parsed.customModes);
  console.log('📊 Count:', parsed.customModes?.length || 0);
  
  if (parsed.customModes && parsed.customModes.length > 0) {
    parsed.customModes.forEach((mode, index) => {
      console.log(\`\n\${index + 1}. \${mode.name}\`);
      console.log(\`   - ID: \${mode.id}\`);
      console.log(\`   - Description: \${mode.description || 'N/A'}\`);
      console.log(\`   - System Prompt: \${mode.systemPrompt?.substring(0, 100)}...\`);
    });
  }
} else {
  console.log('❌ No app-settings found in localStorage');
}

=============================================================
`);

// Also let's check if there are any modes with different user_id in database
const { Pool } = require('pg');

async function checkAllModesAllUsers() {
  console.log('\n🔍 Checking ALL custom modes in database (all users)\n');
  console.log('='.repeat(60));
  
  const pool = new Pool({
    connectionString: process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_backend'
  });
  
  try {
    // Get ALL custom modes regardless of user
    const result = await pool.query(
      'SELECT * FROM custom_modes ORDER BY created_at DESC'
    );
    
    console.log(`\n📊 Total custom modes in database (all users): ${result.rows.length}`);
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
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAllModesAllUsers();
