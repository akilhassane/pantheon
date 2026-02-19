#!/usr/bin/env node

/**
 * Sync Google authenticated user from Supabase Auth to local PostgreSQL
 * and transfer project ownership
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { getSupabaseAdmin } = require('./backend/config/supabase-client');

const USER_EMAIL = 'akilhassane5@gmail.com';
const PROJECT_ID = 'f9cb0630-0000-0000-0000-000000000000';

async function main() {
  console.log('🔄 Syncing Google user from Supabase Auth...\n');
  
  // Create Supabase admin client to access auth users
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }
  
  const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  // Step 1: Get user from Supabase Auth
  console.log(`📧 Looking for user in Supabase Auth: ${USER_EMAIL}`);
  
  const { data: { users }, error: listError } = await supabaseAuth.auth.admin.listUsers();
  
  if (listError) {
    console.error('❌ Failed to list users:', listError.message);
    process.exit(1);
  }
  
  const authUser = users.find(u => u.email === USER_EMAIL);
  
  if (!authUser) {
    console.error(`❌ User ${USER_EMAIL} not found in Supabase Auth`);
    console.log('\nℹ️  Make sure you have signed in with Google at least once.');
    process.exit(1);
  }
  
  console.log(`✅ Found user in Supabase Auth:`);
  console.log(`   ID: ${authUser.id}`);
  console.log(`   Email: ${authUser.email}`);
  console.log(`   Provider: ${authUser.app_metadata?.provider || 'unknown'}`);
  console.log(`   Created: ${authUser.created_at}`);
  
  // Step 2: Sync to local PostgreSQL
  const supabase = getSupabaseAdmin();
  
  console.log(`\n📝 Syncing to local PostgreSQL...`);
  
  // Check if user already exists by ID
  const { data: existingUserById } = await supabase
    .from('users')
    .select('id, email')
    .eq('id', authUser.id)
    .single();
  
  if (existingUserById) {
    console.log(`✅ User already exists in local database`);
  } else {
    // Check if user exists by email (with different ID)
    const { data: existingUserByEmail } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', authUser.email)
      .single();
    
    if (existingUserByEmail) {
      console.log(`⚠️  User with email ${authUser.email} exists with different ID`);
      console.log(`   Old ID: ${existingUserByEmail.id}`);
      console.log(`   New ID: ${authUser.id}`);
      console.log(`   Updating user ID...`);
      
      // Update the user ID to match Supabase Auth
      const { error: updateError } = await supabase
        .from('users')
        .update({
          id: authUser.id,
          updated_at: new Date().toISOString()
        })
        .eq('email', authUser.email);
      
      if (updateError) {
        console.error('❌ Failed to update user ID:', updateError.message);
        console.log('\nℹ️  Deleting old user and creating new one...');
        
        // Delete old user and create new one
        await supabase.from('users').delete().eq('email', authUser.email);
        
        const { error: createError } = await supabase
          .from('users')
          .insert([{
            id: authUser.id,
            email: authUser.email,
            created_at: authUser.created_at,
            updated_at: new Date().toISOString()
          }]);
        
        if (createError) {
          console.error('❌ Failed to create user:', createError.message);
          process.exit(1);
        }
      }
      
      console.log(`✅ User ID updated to match Supabase Auth`);
    } else {
      // Create new user
      const { error: createError } = await supabase
        .from('users')
        .insert([{
          id: authUser.id,
          email: authUser.email,
          created_at: authUser.created_at,
          updated_at: new Date().toISOString()
        }]);
      
      if (createError) {
        console.error('❌ Failed to create user:', createError.message);
        process.exit(1);
      }
      
      console.log(`✅ User synced to local database`);
    }
  }
  
  // Step 3: Transfer project ownership
  console.log(`\n🔄 Transferring project ownership...`);
  console.log(`   Project ID: ${PROJECT_ID}`);
  console.log(`   New Owner: ${USER_EMAIL} (${authUser.id})`);
  
  const { data: updatedProject, error: updateError } = await supabase
    .from('projects')
    .update({
      owner_id: authUser.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', PROJECT_ID)
    .select()
    .single();
  
  if (updateError) {
    console.error('❌ Failed to transfer project:', updateError.message);
    process.exit(1);
  }
  
  console.log(`✅ Project ownership transferred!`);
  
  // Step 4: Verify (no need to delete old user, we updated it)
  console.log(`\n🔍 Verifying...`);
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, owner_id')
    .eq('owner_id', authUser.id);
  
  console.log(`✅ User now owns ${projects.length} project(s)`);
  
  console.log(`\n📊 Final Status:`);
  console.log(`   User ID: ${authUser.id}`);
  console.log(`   Email: ${authUser.email}`);
  console.log(`   Projects: ${projects.length}`);
  console.log(`   Project: ${updatedProject.name}`);
  
  console.log(`\n🎉 Complete! You can now see your project in the frontend.`);
  console.log(`\nℹ️  Refresh the frontend page to see the project.`);
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
