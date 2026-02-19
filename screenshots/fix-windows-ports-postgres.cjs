#!/usr/bin/env node

/**
 * Fix Windows Project Port Mappings (Direct PostgreSQL)
 * 
 * The ports were incorrectly set in the database.
 * This script corrects them based on the actual Docker container mappings.
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

async function fixWindowsPorts() {
  console.log('🔧 Fixing Windows Project Port Mappings...\n');
  
  const projectId = 'f9cb0630-0000-0000-0000-000000000000';
  
  // Correct port mappings based on Docker container:
  // 10017 → 8006 (noVNC web interface)
  // 10018 → 10018 (terminal)
  // 10019 → 10019 (VNC)
  // 10015 → 9090 (Windows Tools API)
  
  console.log('📝 Updating project with correct ports:');
  console.log('   Terminal Port: 10018');
  console.log('   VNC Port: 10019');
  console.log('   noVNC Port: 10017 (web interface)');
  console.log('   Custom Port 1: 10015 (Windows Tools API)');
  console.log('   Custom Port 2: 10017 (noVNC)');
  console.log('');
  
  try {
    const result = await pool.query(
      `UPDATE projects 
       SET terminal_port = $1,
           vnc_port = $2,
           novnc_port = $3,
           custom_port_1 = $4,
           custom_port_2 = $5
       WHERE id = $6
       RETURNING *`,
      [10018, 10019, 10017, 10015, 10017, projectId]
    );
    
    if (result.rows.length === 0) {
      console.error('❌ Project not found!');
      process.exit(1);
    }
    
    const project = result.rows[0];
    
    console.log('✅ Project ports updated successfully!\n');
    console.log('📋 Updated Database Record:');
    console.log(`   ID: ${project.id}`);
    console.log(`   Name: ${project.name}`);
    console.log(`   Terminal Port: ${project.terminal_port}`);
    console.log(`   VNC Port: ${project.vnc_port}`);
    console.log(`   noVNC Port: ${project.novnc_port}`);
    console.log(`   Custom Port 1: ${project.custom_port_1}`);
    console.log(`   Custom Port 2: ${project.custom_port_2}`);
    console.log('');
    
    console.log('🎉 Port mappings fixed! The frontend should now display the iframes correctly.');
    console.log('');
    console.log('🔗 Connection URLs:');
    console.log(`   Terminal: http://localhost:${project.terminal_port}`);
    console.log(`   VNC: vnc://localhost:${project.vnc_port}`);
    console.log(`   noVNC (Desktop): http://localhost:${project.novnc_port}`);
    console.log(`   Windows Tools API: http://localhost:8090/api/tools`);
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Refresh the frontend page');
    console.log('   2. The desktop and terminal iframes should now appear');
    
  } catch (error) {
    console.error('❌ Failed to update project:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixWindowsPorts().catch(console.error);
