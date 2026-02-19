#!/usr/bin/env node

const https = require('https');

async function listModels() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/models',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
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
  console.log('\n📋 Fetching OpenRouter models...\n');
  
  const response = await listModels();
  
  if (response.error) {
    console.error('❌ Error:', response.error);
    return;
  }
  
  const freeModels = response.data.filter(m => m.pricing?.prompt === '0' || m.id.includes(':free'));
  
  console.log(`Found ${freeModels.length} free models:\n`);
  
  freeModels.slice(0, 10).forEach(model => {
    console.log(`- ${model.id}`);
    console.log(`  Name: ${model.name}`);
    if (model.context_length) console.log(`  Context: ${model.context_length}`);
    console.log('');
  });
}

main().catch(console.error);
