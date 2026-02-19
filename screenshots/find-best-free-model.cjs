#!/usr/bin/env node

/**
 * Find the best free OpenRouter model for clicking Edge browser
 * 1. Get all models from OpenRouter
 * 2. Filter for free models
 * 3. Sort by parameter count (highest first)
 * 4. Test each with hello message
 * 5. Try click Edge workflow with best model
 */

const https = require('https');
const http = require('http');

const OPENROUTER_API_KEY = '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';
const BACKEND_URL = 'http://localhost:3002';

// Helper function for HTTP requests
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            json: () => Promise.resolve(JSON.parse(data)),
            text: () => Promise.resolve(data),
            headers: res.headers
          });
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function getAllModels() {
  console.log('📡 Fetching all models from OpenRouter...\n');
  
  const response = await httpRequest('https://openrouter.ai/api/v1/models', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.data || [];
}

function extractParameterCount(model) {
  const name = model.id.toLowerCase();
  
  // Extract parameter count from model name
  // Examples: "70b", "405b", "3.5b", "1.2b"
  const patterns = [
    /(\d+\.?\d*)b/i,  // Matches "70b", "3.5b", "1.2b"
    /(\d+)b/i         // Matches "70b", "405b"
  ];
  
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      return parseFloat(match[1]);
    }
  }
  
  return 0; // Unknown parameter count
}

function isFreeModel(model) {
  // Check if model has pricing and if it's free
  const pricing = model.pricing;
  if (!pricing) return false;
  
  // Check if prompt and completion prices are 0
  const promptPrice = parseFloat(pricing.prompt || '0');
  const completionPrice = parseFloat(pricing.completion || '0');
  
  return promptPrice === 0 && completionPrice === 0;
}

async function testModelHello(modelId) {
  try {
    console.log(`   Testing with "Hello" message...`);
    
    const body = JSON.stringify({
      model: modelId,
      messages: [
        { role: 'user', content: 'Hello! Can you respond with a brief greeting?' }
      ],
      max_tokens: 100
    });
    
    const response = await httpRequest('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Desktop Controller',
        'Content-Length': Buffer.byteLength(body)
      },
      body: body
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `${response.status}: ${errorText}` };
    }
    
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';
    
    return { success: true, reply: reply.substring(0, 100) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testClickEdge(modelId) {
  try {
    console.log(`\n🧪 Testing click Edge workflow with ${modelId}...\n`);
    
    const response = await httpRequest(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Take a screenshot, find the Microsoft Edge browser icon, and click on it.',
        model: modelId,
        mode: 'desktop',
        projectId: 'f9cb0630-c860-4c13-826a-b581eece6abd',
        history: []
      })
    });
    
    if (!response.ok) {
      return { success: false, error: `${response.status}: ${response.statusText}` };
    }
    
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    let screenshotTaken = false;
    let clickExecuted = false;
    let toolsCalled = [];
    
    for (const line of lines) {
      if (!line.startsWith('0:')) continue;
      
      try {
        const data = JSON.parse(line.substring(2));
        
        if (data.type === 'tool-execution') {
          const toolName = data.tool?.name || 'unknown';
          toolsCalled.push(toolName);
          
          if (toolName === 'windows_take_screenshot' || toolName === 'take_screenshot') {
            screenshotTaken = true;
          }
          
          if (toolName === 'windows_click' || toolName === 'click_mouse') {
            clickExecuted = true;
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
    
    return {
      success: screenshotTaken && clickExecuted,
      screenshotTaken,
      clickExecuted,
      toolsCalled
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Find Best Free OpenRouter Model for Click Edge           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  try {
    // Step 1: Get all models
    const allModels = await getAllModels();
    console.log(`✅ Found ${allModels.length} total models\n`);
    
    // Step 2: Filter for free models
    const freeModels = allModels.filter(isFreeModel);
    console.log(`✅ Found ${freeModels.length} free models\n`);
    
    // Step 3: Extract parameter counts and sort
    const modelsWithParams = freeModels.map(model => ({
      ...model,
      paramCount: extractParameterCount(model)
    }));
    
    // Sort by parameter count (highest first)
    modelsWithParams.sort((a, b) => b.paramCount - a.paramCount);
    
    console.log('📊 Free Models (sorted by parameter count):\n');
    console.log('─'.repeat(80));
    
    const workingModels = [];
    
    // Step 4: Test each model with hello message
    for (let i = 0; i < Math.min(modelsWithParams.length, 20); i++) {
      const model = modelsWithParams[i];
      const paramStr = model.paramCount > 0 ? `${model.paramCount}B` : 'Unknown';
      
      console.log(`\n${i + 1}. ${model.id}`);
      console.log(`   Parameters: ${paramStr}`);
      console.log(`   Context: ${model.context_length || 'Unknown'}`);
      
      const testResult = await testModelHello(model.id);
      
      if (testResult.success) {
        console.log(`   ✅ Response: "${testResult.reply}"`);
        workingModels.push({
          id: model.id,
          paramCount: model.paramCount,
          contextLength: model.context_length,
          reply: testResult.reply
        });
      } else {
        console.log(`   ❌ Failed: ${testResult.error}`);
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('WORKING FREE MODELS SUMMARY');
    console.log('='.repeat(80) + '\n');
    
    if (workingModels.length === 0) {
      console.log('❌ No working free models found');
      return;
    }
    
    console.log(`✅ Found ${workingModels.length} working free models:\n`);
    
    workingModels.forEach((model, idx) => {
      const paramStr = model.paramCount > 0 ? `${model.paramCount}B` : 'Unknown';
      console.log(`${idx + 1}. ${model.id}`);
      console.log(`   Parameters: ${paramStr}`);
      console.log(`   Context: ${model.contextLength || 'Unknown'}`);
      console.log('');
    });
    
    // Step 5: Try click Edge workflow with best model
    console.log('='.repeat(80));
    console.log('TESTING CLICK EDGE WORKFLOW');
    console.log('='.repeat(80));
    
    const bestModel = workingModels[0];
    console.log(`\n🏆 Best Model: ${bestModel.id}`);
    console.log(`   Parameters: ${bestModel.paramCount > 0 ? bestModel.paramCount + 'B' : 'Unknown'}`);
    console.log(`   Context: ${bestModel.contextLength || 'Unknown'}\n`);
    
    const clickResult = await testClickEdge(bestModel.id);
    
    console.log('\n📊 Click Edge Test Results:');
    console.log('─'.repeat(80));
    
    if (clickResult.success) {
      console.log('✅ SUCCESS! Model completed the workflow:');
      console.log(`   ✅ Screenshot taken: ${clickResult.screenshotTaken}`);
      console.log(`   ✅ Edge clicked: ${clickResult.clickExecuted}`);
      console.log(`   🔧 Tools called: ${clickResult.toolsCalled.join(', ')}`);
    } else if (clickResult.error) {
      console.log(`❌ Failed: ${clickResult.error}`);
    } else {
      console.log('⚠️  Partial success:');
      console.log(`   ${clickResult.screenshotTaken ? '✅' : '❌'} Screenshot taken`);
      console.log(`   ${clickResult.clickExecuted ? '✅' : '❌'} Edge clicked`);
      if (clickResult.toolsCalled && clickResult.toolsCalled.length > 0) {
        console.log(`   🔧 Tools called: ${clickResult.toolsCalled.join(', ')}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('RECOMMENDATION');
    console.log('='.repeat(80) + '\n');
    
    if (clickResult.success) {
      console.log(`🎉 Use this model: ${bestModel.id}`);
      console.log(`   Parameters: ${bestModel.paramCount > 0 ? bestModel.paramCount + 'B' : 'Unknown'}`);
      console.log(`   It successfully completed the click Edge workflow!`);
    } else {
      console.log(`⚠️  Best free model: ${bestModel.id}`);
      console.log(`   Parameters: ${bestModel.paramCount > 0 ? bestModel.paramCount + 'B' : 'Unknown'}`);
      console.log(`   Note: May need better model for complex workflows`);
      console.log(`\n💡 Consider using:`);
      console.log(`   - Gemini 2.5 Flash (free, but rate limited)`);
      console.log(`   - GPT-4o-mini ($0.15/1M tokens)`);
      console.log(`   - Claude 3.5 Haiku ($0.25/1M tokens)`);
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Run the script
main().catch(console.error);
