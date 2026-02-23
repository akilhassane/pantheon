const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://axxguxepgoiasbzhidxj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  console.log('\n📊 Querying project API key from database...\n');
  
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, api_service_key, operating_system')
    .eq('id', 'f9cb0630-c860-4c13-826a-b581eece6abd')
    .single();
  
  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }
  
  console.log('✅ Project found!\n');
  console.log('Project Details:');
  console.log('  ID:', data.id);
  console.log('  Name:', data.name);
  console.log('  OS:', data.operating_system);
  console.log('  API Service Key:', data.api_service_key);
  console.log('\n');
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
