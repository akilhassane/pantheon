/**
 * Import existing Windows container as a project in local PostgreSQL
 */

require('dotenv').config();
const { getSupabaseAdmin } = require('./backend/config/supabase-client');
const { execSync } = require('child_process');

async function importWindowsProject() {
  console.log('🔍 Scanning for existing Windows containers...');
  
  // Get list of Windows containers
  const containers = execSync('docker ps --filter "name=windows-project" --format "{{.Names}}"', { encoding: 'utf-8' })
    .trim()
    .split('\n')
    .filter(name => name && name.startsWith('windows-project-'));

  if (containers.length === 0) {
    console.log('❌ No Windows project containers found');
    return;
  }

  console.log(`✅ Found ${containers.length} Windows container(s):`);
  containers.forEach(name => console.log(`   - ${name}`));

  const supabase = getSupabaseAdmin();

  for (const containerName of containers) {
    // Extract project ID from container name (windows-project-f9cb0630 -> f9cb0630)
    const projectIdShort = containerName.replace('windows-project-', '');
    
    // Generate full UUID (pad with zeros)
    const projectId = `${projectIdShort}-0000-0000-0000-000000000000`.substring(0, 36);
    
    console.log(`\n📦 Processing container: ${containerName}`);
    console.log(`   Project ID: ${projectId}`);

    // Check if project already exists
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (existing) {
      console.log('   ℹ️  Project already exists in database');
      continue;
    }

    // Get container details
    let vncPort, terminalPort, novncPort;
    try {
      const portInfo = execSync(`docker port ${containerName}`, { encoding: 'utf-8' });
      const lines = portInfo.split('\n');
      
      for (const line of lines) {
        if (line.includes('5900/tcp')) {
          vncPort = parseInt(line.split(':')[1]);
        } else if (line.includes('8080/tcp')) {
          terminalPort = parseInt(line.split(':')[1]);
        } else if (line.includes('6080/tcp')) {
          novncPort = parseInt(line.split(':')[1]);
        }
      }
    } catch (err) {
      console.warn('   ⚠️  Could not get port mappings:', err.message);
    }

    // Create project entry
    const projectData = {
      id: projectId,
      name: `Windows 11 (Imported)`,
      owner_id: '00000000-0000-0000-0000-000000000001', // Default local user
      operating_system: 'windows-11',
      status: 'running',
      terminal_port: terminalPort || null,
      vnc_port: vncPort || null,
      novnc_port: novncPort || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('   📝 Creating project entry...');
    const { data, error } = await supabase
      .from('projects')
      .insert([projectData])
      .select()
      .single();

    if (error) {
      console.error('   ❌ Failed to create project:', error.message);
      continue;
    }

    console.log('   ✅ Project imported successfully!');
    console.log(`   📊 Details:`);
    console.log(`      - Name: ${data.name}`);
    console.log(`      - OS: ${data.operating_system}`);
    console.log(`      - Status: ${data.status}`);
    if (vncPort) console.log(`      - VNC Port: ${vncPort}`);
    if (terminalPort) console.log(`      - Terminal Port: ${terminalPort}`);
    if (novncPort) console.log(`      - noVNC Port: ${novncPort}`);
  }

  console.log('\n🎉 Import complete!');
}

importWindowsProject().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
