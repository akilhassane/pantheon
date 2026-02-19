#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'ai_backend',
  user: 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres'
});

async function restoreTerminalPort() {
  console.log('🔧 Restoring terminal port for Windows project...\n');
  
  const projectId = 'f9cb0630-0000-0000-0000-000000000000';
  
  try {
    const result = await pool.query(
      `UPDATE projects 
       SET terminal_port = 10018
       WHERE id = $1
       RETURNING *`,
      [projectId]
    );
    
    const project = result.rows[0];
    
    console.log('✅ Terminal port restored to 10018');
    console.log(`   Project: ${project.name}`);
    console.log(`   Terminal Port: ${project.terminal_port}`);
    
  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

restoreTerminalPort().catch(console.error);
