const { Client } = require('pg');

async function checkUserAvatars() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'ai_backend',
    user: 'postgres',
    password: 'postgres'
  });
  
  try {
    await client.connect();
    console.log('🔍 Checking user avatars in database...\n');
    
    const result = await client.query('SELECT id, email, avatar_url, created_at FROM users ORDER BY created_at DESC');
    
    console.log(`Found ${result.rows.length} users:\n`);
    
    result.rows.forEach(user => {
      console.log(`📧 Email: ${user.email}`);
      console.log(`🆔 ID: ${user.id}`);
      console.log(`🖼️  Avatar URL: ${user.avatar_url || 'NULL'}`);
      console.log(`📅 Created: ${user.created_at}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkUserAvatars();
