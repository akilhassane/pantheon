/**
 * Update MCP API key in database
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PROJECT_ID = 'f9cb0630-c860-4c13-826a-b581eece6abd';
const MCP_API_KEY = '811a67791d17cf4e290873077f15806f260fc4d788cc44145e33d6b3bb16e8a5';

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Update MCP API Key in Database                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📋 Project ID: ${PROJECT_ID}`);
  console.log(`🔑 MCP API Key: ${MCP_API_KEY.substring(0, 20)}...\n`);
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  try {
    // First check current value
    const { data: current, error: fetchError } = await supabase
      .from('projects')
      .select('id, name, mcp_api_key, api_service_key')
      .eq('id', PROJECT_ID)
      .single();
    
    if (fetchError) {
      console.log('❌ Error fetching project:', fetchError.message);
      return;
    }
    
    console.log('📋 Current project state:');
    console.log(`   Name: ${current.name}`);
    console.log(`   MCP API Key: ${current.mcp_api_key || '(not set)'}`);
    console.log(`   API Service Key: ${current.api_service_key ? current.api_service_key.substring(0, 20) + '...' : '(not set)'}\n`);
    
    // Update the project with MCP API key
    const { data, error } = await supabase
      .from('projects')
      .update({ mcp_api_key: MCP_API_KEY })
      .eq('id', PROJECT_ID)
      .select();
    
    if (error) {
      console.log('❌ Error updating project:', error.message);
      return;
    }
    
    console.log('✅ Project updated successfully!');
    console.log('\n📋 New project state:');
    console.log(`   MCP API Key: ${data[0].mcp_api_key.substring(0, 20)}...\n`);
    
  } catch (error) {
    console.log('\n❌ Error:', error.message);
    console.error(error);
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
