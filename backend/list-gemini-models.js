/**
 * Test Gemini API Key
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = 'AIzaSyAGdebLZPkcdZXmrLn00I-B-pgY5NskClg';

async function main() {
  console.log('\n🔑 Testing Gemini API Key...\n');

  const modelNames = [
    'gemini-2.5-flash',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ];

  for (const modelName of modelNames) {
    try {
      console.log(`📦 Testing model: ${modelName}...`);
      
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const result = await model.generateContent('Say hello');
      const response = result.response;
      const text = response.text();
      
      console.log(`   ✅ SUCCESS! Response: ${text.substring(0, 50)}...\n`);
      return;
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
    }
  }
  
  console.log('❌ All models failed. API key may be invalid.\n');
}

main();
