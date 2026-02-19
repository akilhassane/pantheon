#!/usr/bin/env node

/**
 * Fix Windows Project Port Mappings
 * 
 * The ports were incorrectly set in the database.
 * This script corrects them based on the actual Docker container mappings.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixWindowsPorts() {
  console.log('🔧 Fixing Windows Project Port Mappings...\n');
  
  const projectId = 'f9cb0630-0000-0000-0000-000000000000';
  
  // Correct port mappings based on Docker container:
  // 10017 → 8006 (noVNC web interface)
  // 10018 → 10018 (terminal)
  // 10019 → 10019 (VNC)
  // 10015 → 9090 (Windows Tools API)
  
  const updates = {
    terminal_port: 10018,
    vnc_port: 10019,
    novnc_port: 10017,  // This is the noVNC web interface port
    custom_port_1: 10015,  // Windows Tools API
    custom_port_2: 10017   // Same as novnc_port for backward compatibility
  };
  
  console.log('📝 Updating project with correct ports:');
  console.log('   Terminal Port: 10018');
  console.log('   VNC Port: 10019');
  console.log('   noVNC Port: 10017 (web interface)');
  console.log('   Custom Port 1: 10015 (Windows Tools API)');
  console.log('   Custom Port 2: 10017 (noVNC)');
  console.log('');
  
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .select();
  
  if (error) {
    console.error('❌ Failed to update project:', error.message);
    process.exit(1);
  }
  
  console.log('✅ Project ports updated successfully!\n');
  console.log('📊 Updated Project Data:');
  console.log(JSON.stringify(data[0], null, 2));
  console.log('');
  
  // Verify the update
  console.log('🔍 Verifying update...');
  const { data: verifyData, error: verifyError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  
  if (verifyError) {
    console.error('❌ Failed to verify:', verifyError.message);
    process.exit(1);
  }
  
  console.log('✅ Verification successful!');
  console.log('');
  console.log('📋 Current Database Record:');
  console.log(`   ID: ${verifyData.id}`);
  console.log(`   Name: ${verifyData.name}`);
  console.log(`   Terminal Port: ${verifyData.terminal_port}`);
  console.log(`   VNC Port: ${verifyData.vnc_port}`);
  console.log(`   noVNC Port: ${verifyData.novnc_port}`);
  console.log(`   Custom Port 1: ${verifyData.custom_port_1}`);
  console.log(`   Custom Port 2: ${verifyData.custom_port_2}`);
  console.log('');
  
  console.log('🎉 Port mappings fixed! The frontend should now display the iframes correctly.');
  console.log('');
  console.log('🔗 Connection URLs:');
  console.log(`   Terminal: http://localhost:${verifyData.terminal_port}`);
  console.log(`   VNC: vnc://localhost:${verifyData.vnc_port}`);
  console.log(`   noVNC (Desktop): http://localhost:${verifyData.novnc_port}`);
  console.log(`   Windows Tools API: http://localhost:8090/api/tools`);
}

fixWindowsPorts().catch(console.error);
