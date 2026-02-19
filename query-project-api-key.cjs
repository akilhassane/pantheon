const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://axxguxepgoiasbzhidxj.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4eGd1eGVwZ29pYXNiemhpZHhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQxMjM5NiwiZXhwIjoyMDg1OTg4Mzk2fQ.vTfUPz_LGi8QvBiQyyDxpvqbKMFi-tNkoJSvntAxzBI';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  console.log('\n📊 Querying project API keys...\n');
  
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
  console.log('  Encryption Key:', data.encryption_key);
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
