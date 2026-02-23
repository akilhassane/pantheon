/**
 * Multi-Provider API Integration
 * Direct API calls to OpenAI, Anthropic, Google, Mistral, Cohere, and other providers
 */

// Note: node-fetch v3 is ESM-only, but we're using CommonJS
// The fetch API is available globally in Node.js 18+, so we don't need to import it
// If running on older Node.js, uncomment the line below:
// const fetch = require('node-fetch');

/**
 * Detect provider from model ID
 */
function detectProviderFromModel(modelId) {
  // OpenAI models
  if (modelId.startsWith('gpt-') || modelId.includes('openai/')) {
    return 'openai';
  }
  
  // Anthropic models
  if (modelId.startsWith('claude-') || modelId.includes('anthropic/')) {
    return 'anthropic';
  }
  
  // Google models (direct Gemini API)
  if (modelId.startsWith('gemini-') && !modelId.includes('/')) {
    return 'google';
  }
  
  // Mistral models
  if (modelId.startsWith('mistral-') || modelId.includes('mistral/')) {
    return 'mistral';
  }
  
  // Cohere models
  if (modelId.startsWith('command-') || modelId.includes('cohere/')) {
    return 'cohere';
  }
  
  // Meta/Llama models (via Replicate or Together)
  if (modelId.startsWith('llama-') || modelId.includes('meta-llama/') || modelId.includes('llama')) {
    return 'openrouter'; // Route through OpenRouter for Llama
  }
  
  // Default to OpenRouter for all other models
  return 'openrouter';
}

/**
 * Call OpenAI API
 */
async function callOpenAI(modelId, messages, apiKey, options = {}) {
  console.log(`🔄 Calling OpenAI API with model: ${modelId}`);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelId.replace('openai/', ''),
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2048,
      top_p: options.topP || 1.0,
      frequency_penalty: options.frequencyPenalty || 0.0,
      presence_penalty: options.presencePenalty || 0.0
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    response: data.choices[0].message.content,
    model: modelId,
    usage: data.usage
  };
}

/**
 * Call Anthropic API
 */
async function callAnthropic(modelId, messages, apiKey, options = {}) {
  console.log(`🔄 Calling Anthropic API with model: ${modelId}`);
  
  // Extract system message if present
  const systemMessage = messages.find(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelId.replace('anthropic/', ''),
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 1.0,
      top_p: options.topP || 1.0,
      top_k: options.topK || 40,
      system: systemMessage?.content || undefined,
      messages: conversationMessages.map(m => ({
        role: m.role === 'model' ? 'assistant' : m.role,
        content: m.content
      }))
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Anthropic API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    response: data.content[0].text,
    model: modelId,
    usage: data.usage
  };
}

/**
 * Call Google Gemini API (direct)
 */
async function callGoogleGemini(modelId, messages, apiKey, options = {}) {
  console.log(`🔄 Calling Google Gemini API with model: ${modelId}`);
  
  // This function is for direct Gemini API calls
  // The existing Gemini integration in server.js handles this
  throw new Error('Use existing Gemini integration in server.js');
}

/**
 * Call Mistral API
 */
async function callMistral(modelId, messages, apiKey, options = {}) {
  console.log(`🔄 Calling Mistral API with model: ${modelId}`);
  
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelId.replace('mistral/', ''),
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2048,
      top_p: options.topP || 1.0
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Mistral API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    response: data.choices[0].message.content,
    model: modelId,
    usage: data.usage
  };
}

/**
 * Call Cohere API
 */
async function callCohere(modelId, messages, apiKey, options = {}) {
  console.log(`🔄 Calling Cohere API with model: ${modelId}`);
  
  // Extract system message and conversation
  const systemMessage = messages.find(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');
  
  // Get the last user message
  const lastMessage = conversationMessages[conversationMessages.length - 1];
  const chatHistory = conversationMessages.slice(0, -1).map(m => ({
    role: m.role === 'model' ? 'CHATBOT' : 'USER',
    message: m.content
  }));
  
  const response = await fetch('https://api.cohere.ai/v1/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelId.replace('cohere/', '').replace('command-', 'command'),
      message: lastMessage.content,
      chat_history: chatHistory,
      preamble: systemMessage?.content || undefined,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2048,
      p: options.topP || 0.75
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Cohere API error: ${errorData.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    response: data.text,
    model: modelId,
    usage: data.meta?.tokens
  };
}

/**
 * Call OpenRouter API (fallback for all other models)
 */
async function callOpenRouter(modelId, messages, apiKey, options = {}) {
  console.log(`🔄 Calling OpenRouter API with model: ${modelId}`);
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Kali Pentest Terminal'
    },
    body: JSON.stringify({
      model: modelId,
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2048,
      top_p: options.topP || 1.0,
      frequency_penalty: options.frequencyPenalty || 0.0,
      presence_penalty: options.presencePenalty || 0.0
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenRouter API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    response: data.choices[0].message.content,
    model: modelId,
    usage: data.usage
  };
}

/**
 * Main function to call any provider
 */
async function callProviderAPI(modelId, messages, modelConfig, options = {}) {
  const provider = detectProviderFromModel(modelId);
  
  console.log(`\n🤖 ========== PROVIDER API CALL ==========`);
  console.log(`   Model: ${modelId}`);
  console.log(`   Provider: ${provider}`);
  console.log(`   Messages: ${messages.length}`);
  console.log(`=========================================\n`);
  
  // Get API key from model config or environment
  let apiKey;
  
  switch (provider) {
    case 'openai':
      apiKey = modelConfig?.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OpenAI API key not configured');
      return await callOpenAI(modelId, messages, apiKey, options);
    
    case 'anthropic':
      apiKey = modelConfig?.apiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('Anthropic API key not configured');
      return await callAnthropic(modelId, messages, apiKey, options);
    
    case 'google':
      // Use existing Gemini integration
      return null; // Signal to use existing Gemini code
    
    case 'mistral':
      apiKey = modelConfig?.apiKey || process.env.MISTRAL_API_KEY;
      if (!apiKey) throw new Error('Mistral API key not configured');
      return await callMistral(modelId, messages, apiKey, options);
    
    case 'cohere':
      apiKey = modelConfig?.apiKey || process.env.COHERE_API_KEY;
      if (!apiKey) throw new Error('Cohere API key not configured');
      return await callCohere(modelId, messages, apiKey, options);
    
    case 'openrouter':
    default:
      apiKey = modelConfig?.apiKey || process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error('OpenRouter API key not configured');
      return await callOpenRouter(modelId, messages, apiKey, options);
  }
}

module.exports = {
  detectProviderFromModel,
  callProviderAPI,
  callOpenAI,
  callAnthropic,
  callMistral,
  callCohere,
  callOpenRouter
};
