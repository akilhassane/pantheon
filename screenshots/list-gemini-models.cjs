#!/usr/bin/env node

const https = require('https');

const GEMINI_API_KEY = 'AIzaSyAGdebLZPkcdZXmrLn00I-B-pgY5NskClg';

console.log('📋 Listing available Gemini models...\n');

const options = {
  hostname: 'generativelanguage.googleapis.com',
  path: `/v1beta/models?key=${GEMINI_API_KEY}`,
  method: 'GET'
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (response.models) {
        console.log('Available models:\n');
        response.models.forEach(model => {
          console.log(`- ${model.name}`);
          console.log(`  Display: ${model.displayName}`);
          console.log(`  Methods: ${model.supportedGenerationMethods.join(', ')}`);
          console.log('');
        });
      } else {
        console.log('Response:', JSON.stringify(response, null, 2));
      }
    } catch (e) {
      console.log('Error:', e.message);
      console.log('Raw:', data);
    }
  });
});

req.on('error', (e) => {
  console.log('Request error:', e.message);
});

req.end();
