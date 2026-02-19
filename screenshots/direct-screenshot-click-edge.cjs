#!/usr/bin/env node

/**
 * Direct Screenshot and Click Edge - No AI Model
 * 
 * This script:
 * 1. Connects to Windows MCP client
 * 2. Takes a screenshot
 * 3. Finds Edge browser coordinates
 * 4. Clicks on Edge browser
 */

const WindowsMCPClient = require('./windows-mcp-client.js');

const PROJECT_ID = 'f9cb0630-c860-4c13-826a-b581eece6abd';
const MCP_PORT = 10018;
const MCP_API_KEY = '811a67791d17cf4e290873077f15806f260fc4d788cc44145e33d6b3bb16e8a5';
const MCP_HOST = 'host.docker.internal';

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Direct Screenshot and Click Edge (No AI)                 ║');
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
    console.log('STEP 1: Take Screenshot');
    console.log('─'.repeat(80));
    console.log('📸 Taking screenshot...\n');
    
    const screenshotResult = await mcpClient.executeTool('take_screenshot', {});
    
    if (!screenshotResult.success) {
      throw new Error(`Screenshot failed: ${screenshotResult.error}`);
    }
    
    console.log('✅ Screenshot taken successfully\n');
    
    // Step 2: Find Edge browser window on desktop
    console.log('STEP 2: Find Edge Browser Window on Desktop');
    console.log('─'.repeat(80));
    console.log('🔍 Searching for Edge browser window...\n');
    
    // Parse the screenshot data
    let screenshotData = screenshotResult;
    
    // Check if data is in message field (JSON string)
    if (screenshotResult.message && typeof screenshotResult.message === 'string') {
      try {
        screenshotData = JSON.parse(screenshotResult.message);
      } catch (e) {
        // If not JSON, use the result as-is
      }
    }
    
    // Look for Edge windows in Windows API data
    const openWindows = screenshotData.windowsAPI?.open_windows || [];
    console.log(`📊 Found ${openWindows.length} open windows`);
    
    let edgeCoords = null;
    
    // Search for Edge browser window
    for (const window of openWindows) {
      const title = window.title?.toLowerCase() || '';
      const className = window.class_name?.toLowerCase() || '';
      
      if (title.includes('edge') || title.includes('microsoft edge') || 
          className.includes('edge') || className.includes('chrome_widgetwin')) {
        
        // Calculate center of window
        const centerX = window.x + (window.width / 2);
        const centerY = window.y + (window.height / 2);
        
        console.log(`\n✅ Found Edge browser window!`);
        console.log(`   Title: ${window.title}`);
        console.log(`   Class: ${window.class_name}`);
        console.log(`   Position: (${window.x}, ${window.y})`);
        console.log(`   Size: ${window.width}x${window.height}`);
        console.log(`   Center: (${centerX}, ${centerY})`);
        console.log(`   Visible: ${window.visible}`);
        console.log(`   Minimized: ${window.minimized}`);
        
        edgeCoords = {
          x: centerX,
          y: centerY,
          name: window.title,
          hwnd: window.hwnd
        };
        break;
      }
    }
    
    if (!edgeCoords) {
      // Also check UI elements for Edge window
      const uiElements = screenshotData.uiElements?.elements || [];
      console.log(`📊 Found ${uiElements.length} UI elements`);
      
      for (const element of uiElements) {
        const name = element.name?.toLowerCase() || '';
        const controlType = element.control_type_name?.toLowerCase() || '';
        
        // Look for Window control type with Edge in the name
        if (controlType === 'window' && 
            (name.includes('edge') || name.includes('microsoft edge'))) {
          
          const centerX = element.x + (element.width / 2);
          const centerY = element.y + (element.height / 2);
          
          console.log(`\n✅ Found Edge browser window in UI elements!`);
          console.log(`   Name: ${element.name}`);
          console.log(`   Control Type: ${element.control_type_name}`);
          console.log(`   Position: (${element.x}, ${element.y})`);
          console.log(`   Size: ${element.width}x${element.height}`);
          console.log(`   Center: (${centerX}, ${centerY})`);
          
          edgeCoords = {
            x: centerX,
            y: centerY,
            name: element.name
          };
          break;
        }
      }
    }
    
    if (!edgeCoords) {
      console.log('\n❌ Edge browser window not found on desktop');
      console.log('\n📋 Available open windows:');
      openWindows.slice(0, 10).forEach((window, idx) => {
        console.log(`   ${idx + 1}. "${window.title}" (${window.class_name}) - ${window.visible ? 'Visible' : 'Hidden'}`);
      });
      console.log('\n💡 Make sure Edge browser is open and visible on the desktop');
      console.log('💡 If Edge is minimized, it won\'t be detected as a desktop window');
      process.exit(1);
    }
    
    // Step 3: Click on Edge window
    console.log('\nSTEP 3: Click on Edge Browser Window');
    console.log('─'.repeat(80));
    console.log(`🖱️  Clicking at position (${edgeCoords.x}, ${edgeCoords.y})...\n`);
    
    const clickResult = await mcpClient.executeTool('click_mouse', {
      x: edgeCoords.x,
      y: edgeCoords.y
    });
    
    if (!clickResult.success) {
      throw new Error(`Click failed: ${clickResult.error}`);
    }
    
    console.log('✅ Click executed successfully\n');
    
    // Success!
    console.log('═'.repeat(80));
    console.log('🎉 SUCCESS!');
    console.log('═'.repeat(80));
    console.log('\n✅ Screenshot taken');
    console.log(`✅ Edge browser window found at (${edgeCoords.x}, ${edgeCoords.y})`);
    console.log('✅ Click executed on Edge window');
    console.log('\n💡 Edge browser window should now be focused\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
