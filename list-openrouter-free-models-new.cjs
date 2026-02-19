#!/usr/bin/env node

/**
 * List all free models available on OpenRouter
 */

const https = require('https');

const OPENROUTER_API_KEY = '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';

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║         OpenRouter Free Models List                       ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

async function listModels() {
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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    console.log('📡 Fetching models from OpenRouter...\n');
    
    const response = await listModels();
    
    if (response.error) {
      console.error('❌ Error:', response.error);
      return;
    }

    const models = response.data || [];
    
    // Filter free models
    const freeModels = models.filter(m => {
      const pricing = m.pricing || {};
      const promptPrice = parseFloat(pricing.prompt || '0');
      const completionPrice = parseFloat(pricing.completion || '0');
      return promptPrice === 0 && completionPrice === 0;
    });

    console.log(`✅ Found ${freeModels.length} free models:\n`);
    console.log('═'.repeat(80));
    
    freeModels.forEach((model, idx) => {
      console.log(`\n${idx + 1}. ${model.id}`);
      console.log(`   Name: ${model.name}`);
      console.log(`   Context: ${model.context_length || 'N/A'} tokens`);
      console.log(`   Architecture: ${model.architecture?.modality || 'text'}`);
      
      if (model.top_provider) {
        console.log(`   Provider: ${model.top_provider.name || 'N/A'}`);
      }
      
      if (model.description) {
        const desc = model.description.substring(0, 100);
        console.log(`   Description: ${desc}${model.description.length > 100 ? '...' : ''}`);
      }
    });

    console.log('\n' + '═'.repeat(80));
    console.log('\n📊 SUMMARY:');
    console.log(`   Total models: ${models.length}`);
    console.log(`   Free models: ${freeModels.length}`);
    
    // Show recommended models
    console.log('\n🎯 RECOMMENDED FREE MODELS FOR TOOL CALLING:\n');
    
    const recommended = [
      'google/gemma-2-9b-it:free',
      'google/gemma-3-27b-it:free',
      'nvidia/llama-3.1-nemotron-70b-instruct:free',
      'meta-llama/llama-3.2-3b-instruct:free',
      'meta-llama/llama-3.1-8b-instruct:free',
      'qwen/qwen-2.5-7b-instruct:free',
      'microsoft/phi-3-medium-128k-instruct:free'
    ];

    recommended.forEach(modelId => {
      const model = freeModels.find(m => m.id === modelId);
      if (model) {
        console.log(`   ✅ ${modelId}`);
        console.log(`      Context: ${model.context_length || 'N/A'} tokens`);
      } else {
        console.log(`   ❌ ${modelId} (not available)`);
      }
    });

    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
