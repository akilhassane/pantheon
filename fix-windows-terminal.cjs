#!/usr/bin/env node

/**
 * Fix Windows Project Terminal
 * 
 * Windows containers don't have a traditional terminal service.
 * This script sets terminal_port to NULL so the frontend shows
 * an appropriate message instead of trying to load a non-existent terminal.
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'ai_backend',
  user: 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres'
});

async function fixWindowsTerminal() {
  console.log('🔧 Fixing Windows Project Terminal...\n');
  
  const projectId = 'f9cb0630-0000-0000-0000-000000000000';
  
  console.log('📝 Setting terminal_port to NULL for Windows project');
  console.log('   Reason: Windows containers use desktop (RDP/VNC) instead of terminal');
  console.log('');
  
  try {
    const result = await pool.query(
      `UPDATE projects 
       SET terminal_port = NULL
       WHERE id = $1
       RETURNING *`,
      [projectId]
    );
    
    if (result.rows.length === 0) {
      console.error('❌ Project not found!');
      process.exit(1);
    }
    
    const project = result.rows[0];
    
    console.log('✅ Project updated successfully!\n');
    console.log('📋 Updated Database Record:');
    console.log(`   ID: ${project.id}`);
    console.log(`   Name: ${project.name}`);
    console.log(`   Operating System: ${project.operating_system}`);
    console.log(`   Terminal Port: ${project.terminal_port || 'NULL (not available)'}`);
    console.log(`   VNC Port: ${project.vnc_port}`);
    console.log(`   noVNC Port: ${project.novnc_port}`);
    console.log('');
    
    console.log('🎉 Terminal configuration fixed!');
    console.log('');
    console.log('💡 What this means:');
    console.log('   - The terminal tab will show "Terminal not available for Windows"');
    console.log('   - Users should use the Desktop tab to interact with Windows');
    console.log('   - The desktop provides full Windows UI access via noVNC');
    console.log('');
    console.log('🔗 Desktop Access:');
    console.log(`   noVNC (Desktop): http://localhost:${project.novnc_port}`);
    
  } catch (error) {
    console.error('❌ Failed to update project:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixWindowsTerminal().catch(console.error);
