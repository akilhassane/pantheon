/**
 * Update MCP API key in database
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iqxqvvqxqxqxqxqx.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key';

const PROJECT_ID = 'f9cb0630-c860-4c13-826a-b581eece6abd';
const MCP_API_KEY = '811a67791d17cf4e290873077f15806f260fc4d788cc44145e33d6b3bb16e8a5';

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Update MCP API Key in Database                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📋 Project ID: ${PROJECT_ID}`);
  console.log(`🔑 MCP API Key: ${MCP_API_KEY}\n`);
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  try {
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
    console.log('\nUpdated project:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.log('\n❌ Error:', error.message);
    console.error(error);
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
