// Quick script to update VNC URL for existing container
require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateVncUrl() {
  const containerId = 'windows-project-21cecb6c';
  const vncUrl = 'https://where-frame-cancelled-plans.trycloudflare.com';
  
  console.log('🔄 Updating VNC URL...');
  console.log(`   Container ID: ${containerId}`);
  console.log(`   VNC URL: ${vncUrl}`);
  
  // Update the project
  const { data, error } = await supabase
    .from('projects')
    .update({ vnc_url: vncUrl })
    .eq('container_id', containerId)
    .select();
  
  if (error) {
    console.error('❌ Failed to update:', error.message);
    process.exit(1);
  }
  
  if (!data || data.length === 0) {
    console.error('❌ No project found with container ID:', containerId);
    process.exit(1);
  }
  
  console.log('✅ Successfully updated!');
  console.log('   Project ID:', data[0].id);
  console.log('   Project Name:', data[0].name);
  console.log('   VNC URL:', data[0].vnc_url);
  console.log('');
  console.log('🎉 Now open your Vercel frontend and check the Desktop tab!');
  console.log('   URL: https://frontend-beryl-beta-62.vercel.app');
}

updateVncUrl().catch(console.error);
