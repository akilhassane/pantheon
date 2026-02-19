#!/usr/bin/env node

/**
 * Set Correct Terminal Port for Windows Project
 * 
 * The terminal is actually on port 10015 (Windows Tools API web interface)
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

async function setCorrectTerminalPort() {
  console.log('🔧 Setting Correct Terminal Port for Windows Project...\n');
  
  const projectId = 'f9cb0630-0000-0000-0000-000000000000';
  
  console.log('📝 Setting terminal_port to 10015');
  console.log('   Port 10015 is the Windows Tools API web interface');
  console.log('');
  
  try {
    const result = await pool.query(
      `UPDATE projects 
       SET terminal_port = 10015
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
    console.log(`   Terminal Port: ${project.terminal_port}`);
    console.log(`   VNC Port: ${project.vnc_port}`);
    console.log(`   noVNC Port: ${project.novnc_port}`);
    console.log(`   Custom Port 1: ${project.custom_port_1}`);
    console.log(`   Custom Port 2: ${project.custom_port_2}`);
    console.log('');
    
    console.log('🎉 Terminal port configured correctly!');
    console.log('');
    console.log('🔗 Access URLs:');
    console.log(`   Terminal: http://localhost:${project.terminal_port}`);
    console.log(`   Desktop: http://localhost:${project.novnc_port}`);
    console.log('');
    console.log('💡 The terminal iframe will now load the Windows Tools API web interface');
    
  } catch (error) {
    console.error('❌ Failed to update project:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setCorrectTerminalPort().catch(console.error);
