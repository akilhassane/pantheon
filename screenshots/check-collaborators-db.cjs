const { Client } = require('pg');

async function checkCollaborators() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'ai_backend',
    user: 'postgres',
    password: 'postgres'
  });
  
  try {
    await client.connect();
    console.log('🔍 Checking collaborators in database...\n');
    
    // Get all collaborations with user info
    const result = await client.query(`
      SELECT 
        c.id,
        c.project_id,
        c.user_id,
        c.role,
        c.is_visible,
        u.email,
        u.avatar_url,
        p.name as project_name
      FROM collaborations c
      JOIN users u ON c.user_id = u.id
      JOIN projects p ON c.project_id = p.id
      ORDER BY c.created_at DESC
    `);
    
    console.log(`Found ${result.rows.length} collaborations:\n`);
    
    result.rows.forEach((collab, index) => {
      console.log(`${index + 1}. ${collab.email}`);
      console.log(`   Project: ${collab.project_name}`);
      console.log(`   Role: ${collab.role}`);
      console.log(`   Visible: ${collab.is_visible}`);
      console.log(`   Avatar: ${collab.avatar_url || 'NULL'}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkCollaborators();
