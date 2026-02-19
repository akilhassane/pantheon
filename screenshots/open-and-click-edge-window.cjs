#!/usr/bin/env node

/**
 * Open Edge and Click on Window - No AI Model
 * 
 * This script:
 * 1. Takes a screenshot
 * 2. Finds Edge taskbar icon and clicks it to open Edge
 * 3. Waits for Edge to open
 * 4. Takes another screenshot
 * 5. Finds Edge window on desktop and clicks it
 */

const WindowsMCPClient = require('./windows-mcp-client.js');

const PROJECT_ID = 'f9cb0630-c860-4c13-826a-b581eece6abd';
const MCP_PORT = 10018;
const MCP_API_KEY = '811a67791d17cf4e290873077f15806f260fc4d788cc44145e33d6b3bb16e8a5';
const MCP_HOST = 'host.docker.internal';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Open Edge and Click Window (No AI)                       ║');
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

    // Step 1: Take screenshot to find taskbar icon
    console.log('STEP 1: Find Edge Taskbar Icon');
    console.log('─'.repeat(80));
    console.log('📸 Taking screenshot...\n');
    
    let screenshotResult = await mcpClient.executeTool('take_screenshot', {});
    
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
    
    // Find Edge taskbar icon
    console.log('🔍 Searching for Edge taskbar icon...\n');
    
    const uiElements = screenshotData.uiElements?.elements || [];
    let edgeTaskbarIcon = null;
    
    for (const element of uiElements) {
      const name = element.name?.toLowerCase() || '';
      
      if ((name.includes('edge') || name.includes('microsoft edge')) && 
          element.y > 1000) { // Taskbar area
        
        const centerX = element.x + (element.width / 2);
        const centerY = element.y + (element.height / 2);
        
        console.log(`✅ Found Edge taskbar icon!`);
        console.log(`   Name: ${element.name}`);
        console.log(`   Position: (${element.x}, ${element.y})`);
        console.log(`   Center: (${centerX}, ${centerY})`);
        
        edgeTaskbarIcon = { x: centerX, y: centerY, name: element.name };
        break;
      }
    }
    
    if (!edgeTaskbarIcon) {
      console.log('❌ Edge taskbar icon not found');
      console.log('💡 Make sure Edge is pinned to the taskbar');
      process.exit(1);
    }
    
    // Step 2: Click taskbar icon to open Edge
    console.log('\nSTEP 2: Open Edge Browser');
    console.log('─'.repeat(80));
    console.log(`🖱️  Clicking Edge taskbar icon at (${edgeTaskbarIcon.x}, ${edgeTaskbarIcon.y})...\n`);
    
    const clickResult = await mcpClient.executeTool('click_mouse', {
      x: edgeTaskbarIcon.x,
      y: edgeTaskbarIcon.y
    });
    
    if (!clickResult.success) {
      throw new Error(`Click failed: ${clickResult.error}`);
    }
    
    console.log('✅ Clicked taskbar icon\n');
    console.log('⏳ Waiting 3 seconds for Edge to open...\n');
    await sleep(3000);
    
    // Step 3: Take another screenshot to find the window
    console.log('STEP 3: Find Edge Window on Desktop');
    console.log('─'.repeat(80));
    console.log('📸 Taking screenshot...\n');
    
    screenshotResult = await mcpClient.executeTool('take_screenshot', {});
    
    if (!screenshotResult.success) {
      throw new Error(`Screenshot failed: ${screenshotResult.error}`);
    }
    
    console.log('✅ Screenshot taken\n');
    
    // Parse screenshot data
    screenshotData = screenshotResult;
    if (screenshotResult.message && typeof screenshotResult.message === 'string') {
      try {
        screenshotData = JSON.parse(screenshotResult.message);
      } catch (e) {}
    }
    
    // Find Edge window
    console.log('🔍 Searching for Edge window...\n');
    
    const openWindows = screenshotData.windowsAPI?.open_windows || [];
    const uiElements2 = screenshotData.uiElements?.elements || [];
    
    console.log(`📊 Found ${openWindows.length} open windows`);
    console.log(`📊 Found ${uiElements2.length} UI elements\n`);
    
    let edgeWindow = null;
    
    // First try open_windows
    for (const window of openWindows) {
      const title = window.title?.toLowerCase() || '';
      const className = window.class_name?.toLowerCase() || '';
      
      if ((title.includes('edge') || title.includes('microsoft edge') || 
           className.includes('chrome_widgetwin')) && 
          window.visible && !window.minimized) {
        
        const centerX = window.x + (window.width / 2);
        const centerY = window.y + (window.height / 2);
        
        console.log(`✅ Found Edge browser window!`);
        console.log(`   Title: ${window.title}`);
        console.log(`   Class: ${window.class_name}`);
        console.log(`   Position: (${window.x}, ${window.y})`);
        console.log(`   Size: ${window.width}x${window.height}`);
        console.log(`   Center: (${centerX}, ${centerY})`);
        
        edgeWindow = { x: centerX, y: centerY, name: window.title };
        break;
      }
    }
    
    // If not found, try UI elements for Window control type
    if (!edgeWindow) {
      console.log('🔍 Searching all UI elements for Edge window...\n');
      
      for (const element of uiElements2) {
        const name = element.name?.toLowerCase() || '';
        const controlType = element.control_type_name?.toLowerCase() || '';
        
        // Look for Document type with "new tab" or large elements with Edge in name
        if (((controlType === 'document' && name.includes('tab')) ||
             (name.includes('edge') || name.includes('microsoft edge'))) &&
            element.y < 1000 && // Not in taskbar
            element.width > 200 && element.height > 200) { // Reasonably large
          
          const centerX = Math.round(element.x + (element.width / 2));
          const centerY = Math.round(element.y + (element.height / 2));
          
          console.log(`✅ Found Edge window/content!`);
          console.log(`   Name: ${element.name}`);
          console.log(`   Control Type: ${element.control_type_name}`);
          console.log(`   Position: (${element.x}, ${element.y})`);
          console.log(`   Size: ${element.width}x${element.height}`);
          console.log(`   Center: (${centerX}, ${centerY})`);
          
          edgeWindow = { x: centerX, y: centerY, name: element.name };
          break;
        }
      }
    }
    
    if (!edgeWindow) {
      console.log('❌ Edge window not found');
      console.log('\n📋 Large UI elements (>200x200):');
      uiElements2
        .filter(e => e.width > 200 && e.height > 200 && e.y < 1000)
        .slice(0, 10)
        .forEach((e, idx) => {
          console.log(`   ${idx + 1}. "${e.name}" (${e.control_type_name}) at (${e.x}, ${e.y}) - ${e.width}x${e.height}`);
        });
      console.log('\n💡 Edge may still be loading, minimized, or not detected');
      process.exit(1);
    }
    
    // Step 4: Click on Edge window
    console.log('\nSTEP 4: Click on Edge Window');
    console.log('─'.repeat(80));
    console.log(`🖱️  Clicking Edge window at (${edgeWindow.x}, ${edgeWindow.y})...\n`);
    
    const windowClickResult = await mcpClient.executeTool('click_mouse', {
      x: edgeWindow.x,
      y: edgeWindow.y
    });
    
    if (!windowClickResult.success) {
      throw new Error(`Click failed: ${windowClickResult.error}`);
    }
    
    console.log('✅ Clicked Edge window\n');
    
    // Success!
    console.log('═'.repeat(80));
    console.log('🎉 SUCCESS!');
    console.log('═'.repeat(80));
    console.log('\n✅ Found Edge taskbar icon');
    console.log('✅ Opened Edge browser');
    console.log(`✅ Found Edge window at (${edgeWindow.x}, ${edgeWindow.y})`);
    console.log('✅ Clicked on Edge window');
    console.log('\n💡 Edge browser window is now focused\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
