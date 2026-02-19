#!/usr/bin/env node

/**
 * Find and Click Edge Desktop Icon - No AI Model
 * 
 * This script:
 * 1. Takes a screenshot
 * 2. Finds Edge desktop shortcut icon
 * 3. Clicks on it
 */

const WindowsMCPClient = require('./windows-mcp-client.js');

const PROJECT_ID = 'f9cb0630-c860-4c13-826a-b581eece6abd';
const MCP_PORT = 10018;
const MCP_API_KEY = '811a67791d17cf4e290873077f15806f260fc4d788cc44145e33d6b3bb16e8a5';
const MCP_HOST = 'host.docker.internal';

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Find and Click Edge Desktop Icon (No AI)                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Initialize Windows MCP client
    console.log('🔌 Connecting to Windows MCP server...\n');
    
    const mcpClient = new WindowsMCPClient({
      projectId: PROJECT_ID,
      baseUrl: `http://${MCP_HOST}:${MCP_PORT}`,
      apiKey: MCP_API_KEY
    });

    const connected = await mcpClient.connect();
    
    if (!connected) {
      console.error('❌ Failed to connect to Windows MCP server');
      console.error('💡 Make sure the Windows VM and MCP server are running');
      process.exit(1);
    }

    // Step 1: Take screenshot
    console.log('STEP 1: Find Edge Desktop Icon');
    console.log('─'.repeat(80));
    console.log('📸 Taking screenshot...\n');
    
    const screenshotResult = await mcpClient.executeTool('take_screenshot', {});
    
    if (!screenshotResult.success) {
      throw new Error(`Screenshot failed: ${screenshotResult.error}`);
    }
    
    console.log('✅ Screenshot taken\n');
    
    // Parse screenshot data
    let screenshotData = screenshotResult;
    if (screenshotResult.message && typeof screenshotResult.message === 'string') {
      try {
        screenshotData = JSON.parse(screenshotResult.message);
      } catch (e) {}
    }
    
    // Find desktop icons
    console.log('🔍 Searching for desktop icons...\n');
    
    const uiElements = screenshotData.uiElements?.elements || [];
    console.log(`📊 Total UI elements: ${uiElements.length}\n`);
    
    // Desktop icons are typically:
    // - ListItem control type
    // - In the top-left area of the screen (x < 300, y < 800)
    // - Have recognizable names
    
    const desktopIcons = uiElements.filter(element => {
      const controlType = element.control_type_name?.toLowerCase() || '';
      return controlType === 'listitem' && 
             element.x < 300 && 
             element.y < 800;
    });
    
    console.log(`📋 Found ${desktopIcons.length} desktop icons:\n`);
    
    desktopIcons.forEach((icon, idx) => {
      console.log(`   ${idx + 1}. "${icon.name}" at (${icon.x}, ${icon.y})`);
    });
    
    // Find Edge icon
    let edgeIcon = null;
    
    for (const icon of desktopIcons) {
      const name = icon.name?.toLowerCase() || '';
      
      if (name.includes('edge') || name.includes('microsoft edge')) {
        const centerX = Math.round(icon.x + (icon.width / 2));
        const centerY = Math.round(icon.y + (icon.height / 2));
        
        console.log(`\n✅ Found Edge desktop icon!`);
        console.log(`   Name: ${icon.name}`);
        console.log(`   Control Type: ${icon.control_type_name}`);
        console.log(`   Position: (${icon.x}, ${icon.y})`);
        console.log(`   Size: ${icon.width}x${icon.height}`);
        console.log(`   Center: (${centerX}, ${centerY})`);
        
        edgeIcon = { x: centerX, y: centerY, name: icon.name };
        break;
      }
    }
    
    if (!edgeIcon) {
      console.log('\n❌ Edge desktop icon not found');
      console.log('\n💡 Available desktop icons:');
      desktopIcons.slice(0, 10).forEach((icon, idx) => {
        console.log(`   ${idx + 1}. "${icon.name}"`);
      });
      console.log('\n💡 Make sure Edge shortcut is on the desktop');
      console.log('💡 Desktop icons are detected in the top-left area (x < 300, y < 800)');
      process.exit(1);
    }
    
    // Step 2: Click on Edge desktop icon
    console.log('\nSTEP 2: Click on Edge Desktop Icon');
    console.log('─'.repeat(80));
    console.log(`🖱️  Clicking at position (${edgeIcon.x}, ${edgeIcon.y})...\n`);
    
    const clickResult = await mcpClient.executeTool('click_mouse', {
      x: edgeIcon.x,
      y: edgeIcon.y
    });
    
    if (!clickResult.success) {
      throw new Error(`Click failed: ${clickResult.error}`);
    }
    
    console.log('✅ Click executed\n');
    
    // Success!
    console.log('═'.repeat(80));
    console.log('🎉 SUCCESS!');
    console.log('═'.repeat(80));
    console.log('\n✅ Screenshot taken');
    console.log(`✅ Edge desktop icon found at (${edgeIcon.x}, ${edgeIcon.y})`);
    console.log('✅ Clicked on Edge desktop icon');
    console.log('\n💡 Edge browser should now be launching from desktop icon\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
