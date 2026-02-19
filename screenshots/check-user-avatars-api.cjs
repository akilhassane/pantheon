const fetch = require('node-fetch');

async function checkUserAvatars() {
  console.log('🔍 Checking user avatars via backend API...\n');
  
  try {
    // Get all users from backend
    const response = await fetch('http://localhost:3002/api/auth/users');
    
    if (!response.ok) {
      console.error('❌ Failed to fetch users:', response.statusText);
      return;
    }
    
    const result = await response.json();
    const users = result.users || [];
    
    console.log(`Found ${users.length} users:\n`);
    
    users.forEach(user => {
      console.log(`📧 Email: ${user.email}`);
      console.log(`🆔 ID: ${user.id}`);
      console.log(`🖼️  Avatar URL: ${user.avatar_url || 'NULL'}`);
      console.log(`📅 Created: ${user.created_at}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUserAvatars();
