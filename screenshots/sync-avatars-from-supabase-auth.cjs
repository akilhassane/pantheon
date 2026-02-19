const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const supabaseUrl = 'https://axxguxepgoiasbzhidxj.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4eGd1eGVwZ29pYXNiemhpZHhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQxMjM5NiwiZXhwIjoyMDg1OTg4Mzk2fQ.vTfUPz_LGi8QvBiQyyDxpvqbKMFi-tNkoJSvntAxzBI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncAvatarsFromSupabaseAuth() {
  const pgClient = new Client({
    host: 'localhost',
    port: 5432,
    database: 'ai_backend',
    user: 'postgres',
    password: 'postgres'
  });
  
  try {
    await pgClient.connect();
    console.log('🔍 Syncing avatars from Supabase Auth...\n');
    
    // Get all users from local database
    const localUsersResult = await pgClient.query('SELECT id, email, avatar_url FROM users');
    console.log(`Found ${localUsersResult.rows.length} users in local database\n`);
    
    for (const localUser of localUsersResult.rows) {
      console.log(`\n📧 Processing: ${localUser.email}`);
      console.log(`   Current avatar_url: ${localUser.avatar_url || 'NULL'}`);
      
      try {
        // Get user from Supabase Auth
        const { data: { user }, error } = await supabase.auth.admin.getUserById(localUser.id);
        
        if (error || !user) {
          console.log(`   ⚠️ User not found in Supabase Auth`);
          continue;
        }
        
        // Try to extract avatar from multiple sources
        let avatarUrl = null;
        
        // Try user_metadata first
        if (user.user_metadata?.avatar_url) {
          avatarUrl = user.user_metadata.avatar_url;
          console.log(`   ✅ Found avatar_url in user_metadata`);
        } else if (user.user_metadata?.picture) {
          avatarUrl = user.user_metadata.picture;
          console.log(`   ✅ Found picture in user_metadata`);
        }
        
        // Try identities array
        if (!avatarUrl && user.identities && user.identities.length > 0) {
          const googleIdentity = user.identities.find(id => id.provider === 'google');
          if (googleIdentity?.identity_data?.picture) {
            avatarUrl = googleIdentity.identity_data.picture;
            console.log(`   ✅ Found picture in identities[google].identity_data`);
          } else if (googleIdentity?.identity_data?.avatar_url) {
            avatarUrl = googleIdentity.identity_data.avatar_url;
            console.log(`   ✅ Found avatar_url in identities[google].identity_data`);
          }
        }
        
        if (avatarUrl && avatarUrl !== localUser.avatar_url) {
          // Update avatar in local database
          await pgClient.query(
            'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2',
            [avatarUrl, localUser.id]
          );
          console.log(`   ✅ Updated avatar_url: ${avatarUrl.substring(0, 50)}...`);
        } else if (!avatarUrl) {
          console.log(`   ⚠️ No avatar URL found in Supabase Auth`);
        } else {
          console.log(`   ℹ️ Avatar URL already up to date`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error processing user:`, error.message);
      }
    }
    
    console.log('\n\n=== FINAL RESULTS ===\n');
    const finalResult = await pgClient.query('SELECT id, email, avatar_url FROM users ORDER BY created_at DESC');
    
    finalResult.rows.forEach(user => {
      console.log(`📧 ${user.email}`);
      console.log(`🖼️  ${user.avatar_url || 'NULL'}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pgClient.end();
  }
}

syncAvatarsFromSupabaseAuth();
