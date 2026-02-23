/**
 * Reconnect Windows Tools API to Existing Project Networks
 * 
 * This script runs on backend startup to ensure windows-tools-api
 * is connected to all existing project networks.
 */

const Docker = require('dockerode');

async function reconnectWindowsToolsAPI() {
  const docker = new Docker();
  
  console.log('[Startup] 🔗 Reconnecting windows-tools-api to existing project networks...');
  
  try {
    // Get all networks
    const networks = await docker.listNetworks();
    
    // Filter for project networks
    const projectNetworks = networks.filter(net => 
      net.Name.startsWith('project-') && net.Name.endsWith('-network')
    );
    
    if (projectNetworks.length === 0) {
      console.log('[Startup] ℹ️  No existing project networks found');
      return;
    }
    
    console.log(`[Startup] 📡 Found ${projectNetworks.length} project network(s)`);
    
    // Get windows-tools-api container
    let toolsApiContainer;
    try {
      toolsApiContainer = docker.getContainer('windows-tools-api');
      await toolsApiContainer.inspect();
    } catch (err) {
      console.warn('[Startup] ⚠️  windows-tools-api container not found, skipping reconnection');
      return;
    }
    
    // Connect to each project network
    let connectedCount = 0;
    let alreadyConnectedCount = 0;
    
    for (const netInfo of projectNetworks) {
      try {
        const network = docker.getNetwork(netInfo.Name);
        
        // Try to connect
        await network.connect({ Container: 'windows-tools-api' });
        console.log(`[Startup] ✅ Connected windows-tools-api to ${netInfo.Name}`);
        connectedCount++;
        
      } catch (connectErr) {
        if (connectErr.message.includes('already exists')) {
          console.log(`[Startup] ✓ windows-tools-api already connected to ${netInfo.Name}`);
          alreadyConnectedCount++;
        } else {
          console.warn(`[Startup] ⚠️  Failed to connect to ${netInfo.Name}:`, connectErr.message);
        }
      }
    }
    
    console.log(`[Startup] 🎉 Reconnection complete: ${connectedCount} new, ${alreadyConnectedCount} existing`);
    
  } catch (error) {
    console.error('[Startup] ❌ Failed to reconnect windows-tools-api:', error.message);
  }
}

// Export for use in server.js
module.exports = { reconnectWindowsToolsAPI };

// Allow running standalone
if (require.main === module) {
  reconnectWindowsToolsAPI()
    .then(() => {
      console.log('[Startup] Done');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Startup] Error:', err);
      process.exit(1);
    });
}
