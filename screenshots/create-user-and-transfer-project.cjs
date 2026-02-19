#!/usr/bin/env node

/**
 * Create user and transfer project ownership
 */

require('dotenv').config();
const { getSupabaseAdmin } = require('./backend/config/supabase-client');

const USER_EMAIL = 'akilhassane5@gmail.com';
const PROJECT_ID = 'f9cb0630-0000-0000-0000-000000000000';

async function main() {
  console.log('🔄 Creating user and transferring project ownership...\n');
  
  const supabase = getSupabaseAdmin();
  
  // Step 1: Check if user already exists
  console.log(`📧 Checking for user: ${USER_EMAIL}`);
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', USER_EMAIL)
    .single();
  
  let userId;
  
  if (existingUser) {
    console.log(`✅ User already exists: ${existingUser.id}`);
    userId = existingUser.id;
  } else {
    // Step 2: Create new user
    console.log(`📝 Creating new user...`);
    
    // Generate a UUID for the user (you can use their actual Supabase auth ID later)
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([{
        email: USER_EMAIL,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Failed to create user:', createError.message);
      process.exit(1);
    }
    
    console.log(`✅ User created: ${newUser.id}`);
    userId = newUser.id;
  }
  
  // Step 3: Transfer project ownership
  console.log(`\n🔄 Transferring project ownership...`);
  console.log(`   Project ID: ${PROJECT_ID}`);
  console.log(`   New Owner: ${USER_EMAIL} (${userId})`);
  
  const { data: updatedProject, error: updateError } = await supabase
    .from('projects')
    .update({
      owner_id: userId,
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
  console.log(`\n📊 Project Details:`);
  console.log(`   Name: ${updatedProject.name}`);
  console.log(`   Owner: ${USER_EMAIL}`);
  console.log(`   Status: ${updatedProject.status}`);
  
  // Step 4: Verify
  console.log(`\n🔍 Verifying...`);
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, owner_id')
    .eq('owner_id', userId);
  
  console.log(`✅ User now owns ${projects.length} project(s)`);
  
  console.log(`\n🎉 Complete! User ${USER_EMAIL} now owns the Windows project.`);
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
