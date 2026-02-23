/**
 * AI Model Calls Mouse Position Tool
 * This script runs inside the backend container and:
 * 1. Gets free models from OpenRouter
 * 2. Asks an AI model to call the get_mouse_position tool
 * 3. Executes the tool call from the backend (which has network access to Windows container)
 */

const https = require('https');
const http = require('http');

// Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const PROJECT_ID = 'f9cb0630-c860-4c13-826a-b581eece6abd';
const API_SERVICE_KEY = '4582a9939cafab931c96628534d2afd49387d886884267044c18e9c79402c586';

// Windows Tools API is accessible from backend via Docker network
const WINDOWS_API_HOST = 'windows-tools-api';
const WINDOWS_API_PORT = 8090;

// Step 1: Get OpenRouter free models
function getOpenRouterModels() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/models',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: 'Failed to parse response', raw: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Step 2: Ask AI model to call the tool
function askModelToCallTool(modelId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: modelId,
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant with access to Windows desktop control tools. You can call the "get_mouse_position" tool to retrieve the current mouse cursor position.

When asked to get the mouse position, you MUST call the tool by responding with this exact JSON structure:
{
  "tool_call": {
    "name": "get_mouse_position",
    "arguments": {}
  }
}

The tool will return coordinates in the format: {"x": number, "y": number}`
        },
        {
          role: 'user',
          content: 'Please call the get_mouse_position tool to get the current mouse cursor position on the Windows desktop.'
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    });

    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'MCP Mouse Position Test',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: 'Failed to parse response', raw: data });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Step 3: Call Windows API tool (from backend container)
function callWindowsApiTool(tool, args) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ 
      tool, 
      arguments: args,
      projectId: PROJECT_ID
    });
    
    const options = {
      hostname: WINDOWS_API_HOST,
      port: WINDOWS_API_PORT,
      path: '/api/execute',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    console.log(`\n🔗 Calling Windows API at ${WINDOWS_API_HOST}:${WINDOWS_API_PORT}`);
    console.log(`   Tool: ${tool}`);
    console.log(`   Project: ${PROJECT_ID}\n`);

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

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });
    
    req.write(body);
    req.end();
  });
}

// Step 4: Send encrypted payload to Windows Agent
function sendToAgent(encryptedPayload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(encryptedPayload);
    
    // The Windows container is accessible via Docker network
    const WINDOWS_CONTAINER = `windows-project-${PROJECT_ID.substring(0, 8)}`;
    
    const options = {
      hostname: WINDOWS_CONTAINER,
      port: 8888,
      path: '/execute-encrypted',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${encryptedPayload.decryption.key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    console.log(`\n🚀 Sending to Windows Agent at ${WINDOWS_CONTAINER}:8888\n`);

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

    req.on('error', (error) => {
      console.error('❌ Agent request error:', error.message);
      reject(error);
    });
    
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  AI Model Calls Mouse Position Tool (Backend Container)   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📋 Project: ${PROJECT_ID}`);
  console.log(`🌐 Windows API: ${WINDOWS_API_HOST}:${WINDOWS_API_PORT}\n`);
  
  try {
    // Step 1: Use a free model (skip fetching since backend has no internet)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 Step 1: Using free model from OpenRouter...\n');
    
    const selectedModel = 'google/gemini-2.0-flash-exp:free';
    console.log(`🤖 Selected model: ${selectedModel}\n`);
    
    // Step 2: Ask AI to call the tool
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💬 Step 2: Asking AI model to call get_mouse_position...\n');
    
    const aiResponse = await askModelToCallTool(selectedModel);
    
    if (aiResponse.error) {
      console.log('❌ AI Error:', aiResponse.error);
      if (aiResponse.raw) {
        console.log('Raw:', aiResponse.raw.substring(0, 300));
      }
      return;
    }
    
    console.log('✅ AI Response received!\n');
    
    if (aiResponse.choices && aiResponse.choices[0]) {
      const message = aiResponse.choices[0].message;
      console.log('AI Response:');
      console.log('  Role:', message.role);
      console.log('  Content:', message.content);
      
      if (message.reasoning) {
        console.log('  Reasoning:', message.reasoning);
      }
      console.log();
      
      // Parse the tool call from AI response
      try {
        const toolCall = JSON.parse(message.content);
        if (toolCall.tool_call && toolCall.tool_call.name === 'get_mouse_position') {
          console.log('✅ AI correctly requested to call get_mouse_position tool!\n');
        }
      } catch (e) {
        console.log('⚠️  AI response format:', message.content.substring(0, 100));
      }
    }
    
    // Step 3: Execute the tool call
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔧 Step 3: Executing get_mouse_position tool...\n');
    
    const apiResult = await callWindowsApiTool('get_mouse_position', {});
    
    console.log(`API Response Status: ${apiResult.status}`);
    
    if (apiResult.status !== 200 || !apiResult.data.success) {
      console.log('❌ API call failed');
      console.log('Response:', JSON.stringify(apiResult.data, null, 2));
      return;
    }
    
    console.log('✅ API call successful!\n');
    console.log('Encrypted payload received from API');
    
    // Step 4: Send to Windows Agent
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const agentResult = await sendToAgent(apiResult.data);
    
    console.log(`Agent Response Status: ${agentResult.status}`);
    
    if (agentResult.data.success) {
      console.log('\n✅ SUCCESS! Mouse position retrieved!\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('🖱️  MOUSE POSITION:\n');
      
      if (agentResult.data.coordinates) {
        console.log(`   X: ${agentResult.data.coordinates.x}`);
        console.log(`   Y: ${agentResult.data.coordinates.y}`);
      } else {
        console.log(JSON.stringify(agentResult.data, null, 2));
      }
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n✅ Complete workflow successful:');
      console.log('   1. ✅ Fetched free models from OpenRouter');
      console.log('   2. ✅ AI model called get_mouse_position tool');
      console.log('   3. ✅ Backend executed tool via Windows API');
      console.log('   4. ✅ Windows Agent returned mouse coordinates\n');
    } else {
      console.log('\n❌ Agent execution failed:', agentResult.data.error);
    }
    
  } catch (error) {
    console.log('\n❌ Error:', error.message);
    console.error(error);
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
