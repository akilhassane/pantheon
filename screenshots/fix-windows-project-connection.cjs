#!/usr/bin/env node

/**
 * Fix Windows project connection by generating and setting MCP API key
 */

require('dotenv').config();
const crypto = require('crypto');
const { getSupabaseAdmin } = require('./backend/config/supabase-client');

const PROJECT_ID = 'f9cb0630-0000-0000-0000-000000000000';
const MASTER_SECRET = process.env.MCP_MASTER_SECRET;

function generateApiKey(projectId, masterSecret) {
  const data = `${projectId}:${masterSecret}:${Date.now()}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function main() {
  console.log('🔧 Fixing Windows project connection...\n');
  
  if (!MASTER_SECRET) {
    console.error('❌ MCP_MASTER_SECRET not found in environment');
    process.exit(1);
  }
  
  const supabase = getSupabaseAdmin();
  
  // Generate API key
  const apiKey = generateApiKey(PROJECT_ID, MASTER_SECRET);
  console.log(`🔑 Generated MCP API Key: ${apiKey.substring(0, 16)}...`);
  
  // Update project with API key
  console.log(`\n📝 Updating project with API key...`);
  const { data: project, error } = await supabase
    .from('projects')
    .update({
      mcp_api_key: apiKey,
      updated_at: new Date().toISOString()
    })
    .eq('id', PROJECT_ID)
    .select()
    .single();
  
  if (error) {
    console.error('❌ Failed to update project:', error.message);
    process.exit(1);
  }
  
  console.log(`✅ Project updated successfully`);
  console.log(`\n📊 Project Details:`);
  console.log(`   ID: ${project.id}`);
  console.log(`   Name: ${project.name}`);
  console.log(`   Status: ${project.status}`);
  console.log(`   Terminal Port: ${project.terminal_port}`);
  console.log(`   VNC Port: ${project.vnc_port}`);
  console.log(`   Custom Port 1: ${project.custom_port_1}`);
  console.log(`   Custom Port 2: ${project.custom_port_2}`);
  console.log(`   MCP API Key: ${project.mcp_api_key ? 'Set ✅' : 'Not set ❌'}`);
  
  console.log(`\n🎉 Windows project connection fixed!`);
  console.log(`\nℹ️  The frontend should now be able to connect to the Windows container.`);
  console.log(`   Refresh the page to see the changes.`);
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
