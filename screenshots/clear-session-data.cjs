/**
 * Clear all session data from database
 * Keeps projects and users intact
 * Works with both Supabase cloud and local PostgreSQL
 */

require('dotenv').config();
const { getSupabaseAdmin } = require('./backend/config/supabase-client');

async function clearSessionData() {
  console.log('🔗 Connecting to database...');
  const supabase = getSupabaseAdmin();

  try {
    // Count existing data
    console.log('\n📊 Current data counts:');
    
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id');
    
    if (sessionsError) {
      console.error('Error counting sessions:', sessionsError.message);
    } else {
      console.log(`   Sessions: ${sessions?.length || 0}`);
    }

    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('id');
    
    if (messagesError) {
      console.error('Error counting messages:', messagesError.message);
    } else {
      console.log(`   Chat messages: ${messages?.length || 0}`);
    }

    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id');
    
    if (projectsError) {
      console.error('Error counting projects:', projectsError.message);
    } else {
      console.log(`   Projects: ${projects?.length || 0} (will be kept)`);
    }

    // Delete chat messages first (foreign key constraint)
    console.log('\n🗑️  Deleting chat messages...');
    const { error: deleteMessagesError } = await supabase
      .from('chat_messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteMessagesError) {
      console.error('❌ Failed to delete chat messages:', deleteMessagesError.message);
      process.exit(1);
    }
    console.log('✅ Chat messages deleted');

    // Delete sessions
    console.log('\n🗑️  Deleting sessions...');
    const { error: deleteSessionsError } = await supabase
      .from('sessions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteSessionsError) {
      console.error('❌ Failed to delete sessions:', deleteSessionsError.message);
      process.exit(1);
    }
    console.log('✅ Sessions deleted');

    // Verify cleanup
    console.log('\n✅ Cleanup complete! Final counts:');
    
    const { data: finalSessions } = await supabase
      .from('sessions')
      .select('id');
    console.log(`   Sessions: ${finalSessions?.length || 0}`);

    const { data: finalMessages } = await supabase
      .from('chat_messages')
      .select('id');
    console.log(`   Chat messages: ${finalMessages?.length || 0}`);

    const { data: finalProjects } = await supabase
      .from('projects')
      .select('id');
    console.log(`   Projects: ${finalProjects?.length || 0} (preserved)`);

    console.log('\n🎉 Session data cleared successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

clearSessionData();
