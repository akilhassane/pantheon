const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://localhost:3002/supabase';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserAvatars() {
  console.log('🔍 Checking user avatars in database...\n');
  
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, avatar_url, created_at');
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  console.log(`Found ${users.length} users:\n`);
  
  users.forEach(user => {
    console.log(`📧 Email: ${user.email}`);
    console.log(`🆔 ID: ${user.id}`);
    console.log(`🖼️  Avatar URL: ${user.avatar_url || 'NULL'}`);
    console.log(`📅 Created: ${user.created_at}`);
    console.log('---');
  });
}

checkUserAvatars();
