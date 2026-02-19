const fs = require('fs');
const http = require('http');

const ENCRYPTION_KEY = '811a67791d17cf4e290873077f15806f260fc4d788cc44145e33d6b3bb16e8a5';
const WINDOWS_VM_IP = 'localhost';
const WINDOWS_VM_PORT = 10018;

function callWindowsAgent(tool, args) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ tool, arguments: args });
    
    const options = {
      hostname: WINDOWS_VM_IP,
      port: WINDOWS_VM_PORT,
      path: '/execute',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ENCRYPTION_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(body);
    req.end();
  });
}

async function main() {
  try {
    const result = await callWindowsAgent('take_screenshot', {});
    
    if (result.data.success && result.data.image) {
      // Decode base64 image
      const imageBuffer = Buffer.from(result.data.image, 'base64');
      fs.writeFileSync('screenshot-decoded.png', imageBuffer);
      console.log('✅ Screenshot decoded and saved to screenshot-decoded.png');
      console.log(`📊 Image size: ${imageBuffer.length} bytes`);
      console.log(`📸 Screenshot path on VM: ${result.data.path}`);
      console.log(`📐 Dimensions: ${result.data.size.width}x${result.data.size.height}`);
      
      if (result.data.windowsAPI) {
        console.log('\n🪟 Windows API Elements:');
        console.log(`  Total: ${result.data.windowsAPI.totalElements || 0}`);
        console.log(`  Windows: ${result.data.windowsAPI.windows?.length || 0}`);
        console.log(`  Taskbar Buttons: ${result.data.windowsAPI.taskbarButtons?.length || 0}`);
      }
    } else {
      console.log('❌ Failed to get screenshot');
      console.log(JSON.stringify(result.data, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
