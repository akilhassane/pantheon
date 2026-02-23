#!/usr/bin/env node

/**
 * Diagnose Taskbar Detection Issues
 * Checks what windows are detected and why File Explorer/Edge might be missing
 */

const http = require('http');

const MCP_HOST = 'host.docker.internal';
const MCP_PORT = 10018;
const MCP_API_KEY = '811a67791d17cf4e290873077f15806f260fc4d788cc44145e33d6b3bb16e8a5';

console.log('🔍 Diagnosing Taskbar Detection in Windows VM\n');

function callScreenshot() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      tool: 'take_screenshot',
      arguments: {}
    });

    const options = {
      hostname: MCP_HOST,
      port: MCP_PORT,
      path: '/execute',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${MCP_API_KEY}`
      },
      timeout: 60000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Failed to parse JSON: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.write(postData);
    req.end();
  });
}

async function diagnose() {
  try {
    console.log('📸 Taking screenshot from Windows VM...\n');
    const result = await callScreenshot();
    
    if (!result.success) {
      console.log('❌ Screenshot failed');
      return;
    }
    
    const windowsAPI = result.windowsAPI || {};
    const taskbarIcons = windowsAPI.taskbar_icons || [];
    const windows = windowsAPI.windows || [];
    const summary = windowsAPI.summary || {};
    
    console.log('📊 RAW DATA FROM WINDOWS VM:\n');
    console.log('Summary:', JSON.stringify(summary, null, 2));
    console.log('');
    
    console.log('🎯 Taskbar Icons Detected:', taskbarIcons.length);
    taskbarIcons.forEach((icon, idx) => {
      console.log(`  ${idx + 1}. ${icon.name} (${icon.type})`);
    });
    console.log('');
    
    console.log('🪟 Windows Detected:', windows.length);
    windows.forEach((win, idx) => {
      console.log(`  ${idx + 1}. ${win.name}`);
      console.log(`     Maximized: ${win.is_maximized}, Minimized: ${win.is_minimized}`);
    });
    console.log('');
    
    // Check OCR data for clues
    if (result.ocr && result.ocr.textElements) {
      console.log('📝 OCR Text Elements:', result.ocr.textElements.length);
      const relevantText = result.ocr.textElements.filter(el => 
        el.text && (
          el.text.toLowerCase().includes('explorer') ||
          el.text.toLowerCase().includes('edge') ||
          el.text.toLowerCase().includes('file') ||
          el.text.toLowerCase().includes('browser')
        )
      );
      if (relevantText.length > 0) {
        console.log('   Found relevant text:');
        relevantText.forEach(el => {
          console.log(`   - "${el.text}" at (${el.x}, ${el.y})`);
        });
      } else {
        console.log('   No relevant text found (Explorer, Edge, File, Browser)');
      }
      console.log('');
    }
    
    // Check UI Elements
    if (result.uiElements && result.uiElements.elements) {
      console.log('🔧 UI Elements:', result.uiElements.elements.length);
      const relevantUI = result.uiElements.elements.filter(el =>
        el.name && (
          el.name.toLowerCase().includes('explorer') ||
          el.name.toLowerCase().includes('edge') ||
          el.name.toLowerCase().includes('file')
        )
      );
      if (relevantUI.length > 0) {
        console.log('   Found relevant UI elements:');
        relevantUI.forEach(el => {
          console.log(`   - ${el.name} (${el.type}) at (${el.x}, ${el.y})`);
        });
      } else {
        console.log('   No relevant UI elements found');
      }
      console.log('');
    }
    
    console.log('🔍 DIAGNOSIS:\n');
    
    if (taskbarIcons.length === 5 && 
        taskbarIcons.some(i => i.name === 'Start') &&
        taskbarIcons.some(i => i.name === 'Search')) {
      console.log('✅ Basic taskbar elements detected (Start, Search)');
    }
    
    if (!taskbarIcons.some(i => i.name && i.name.toLowerCase().includes('explorer'))) {
      console.log('❌ File Explorer NOT detected in taskbar');
      console.log('   Possible reasons:');
      console.log('   1. File Explorer is not open in the Windows VM');
      console.log('   2. File Explorer is minimized');
      console.log('   3. File Explorer window has no title text');
      console.log('   4. File Explorer is pinned but not running');
    }
    
    if (!taskbarIcons.some(i => i.name && i.name.toLowerCase().includes('edge'))) {
      console.log('❌ Edge Browser NOT detected in taskbar');
      console.log('   Possible reasons:');
      console.log('   1. Edge is not open in the Windows VM');
      console.log('   2. Edge is minimized');
      console.log('   3. Edge window has no title text');
      console.log('   4. Edge is pinned but not running');
    }
    
    console.log('\n💡 RECOMMENDATION:\n');
    console.log('The screenshot.py script only detects OPEN (non-minimized) windows.');
    console.log('It does NOT detect pinned taskbar icons that are not running.');
    console.log('\nTo fix this, you would need to:');
    console.log('1. Use UI Automation to detect actual taskbar buttons (pinned + running)');
    console.log('2. Or ensure File Explorer and Edge are actually open in the VM');
    console.log('3. Or modify screenshot.py to detect pinned icons via different method');
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
  }
}

diagnose();
