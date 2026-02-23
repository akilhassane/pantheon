/**
 * Provider API Integration
 * Fetches model information directly from each provider's API
 */

export interface ProviderModelInfo {
  id: string
  name: string
  provider: string
  contextLength?: number
  maxOutputTokens?: number
  parameters?: {
    temperature?: { min: number; max: number; default: number }
    maxTokens?: { min: number; max: number; default: number }
    topP?: { min: number; max: number; default: number }
    topK?: { min: number; max: number; default: number }
    frequencyPenalty?: { min: number; max: number; default: number }
    presencePenalty?: { min: number; max: number; default: number }
  }
  pricing?: {
    prompt: string
    completion: string
  }
  description?: string
  capabilities?: string[]
}

/**
 * Detect provider from API key format
 */
export function detectProvider(apiKey: string): string {
  // Check more specific patterns first
  if (apiKey.startsWith('sk-ant-')) return 'Anthropic'
  if (apiKey.startsWith('sk-or-')) return 'OpenRouter'
  if (apiKey.startsWith('sk-')) return 'OpenAI'
  if (apiKey.startsWith('AIza')) return 'Google'
  
  // 32 character hex string - could be AI/ML API or Mistral
  // Try AI/ML API first since it's more common
  if (apiKey.length === 32 && /^[a-f0-9]{32}$/i.test(apiKey)) {
    return 'AIML'
  }
  
  // Default to OpenAI-Compatible for unknown formats
  return 'OpenAI-Compatible'
}

/**
 * Get model pricing from OpenRouter
 * OpenRouter aggregates pricing from all providers
 */
async function getPricingFromOpenRouter(modelId: string): Promise<{ prompt: string; completion: string } | undefined> {
  try {
    const { fetchOpenRouterModels } = await import('./openrouterApi')
    const models = await fetchOpenRouterModels()
    
    // Try exact match first
    let model = models.find(m => m.id === modelId)
    
    // If not found, try fuzzy matching with normalization
    if (!model) {
      const normalizeId = (id: string) => {
        return id
          .replace(/^(anthropic|google|openai|mistral)\//i, '') // Remove provider prefix
          .replace(/:(free|paid)$/i, '')  // Remove :free or :paid suffix
          .replace(/-\d{8}$/, '')         // Remove date suffix like -20251001
          .replace(/\./g, '-')            // Convert dots to dashes
          .replace(/-exp(erimental)?$/i, '-exp') // Normalize experimental suffix
          .toLowerCase()
      }
      
      const normalizedModelId = normalizeId(modelId)
      console.log(`🔍 Fuzzy matching pricing for ${modelId} (normalized: ${normalizedModelId})`)
      
      model = models.find(m => {
        const normalizedOrId = normalizeId(m.id)
        const match = normalizedOrId === normalizedModelId || 
                      normalizedOrId.includes(normalizedModelId) ||
                      normalizedModelId.includes(normalizedOrId)
        if (match) {
          console.log(`  ✓ Matched pricing with ${m.id}`)
        }
        return match
      })
    }
    
    if (model && model.pricing) {
      console.log(`✅ Found pricing for ${modelId} from OpenRouter:`, model.pricing)
      // OpenRouter pricing is per token, convert to per 1M tokens
      return {
        prompt: (parseFloat(model.pricing.prompt) * 1000000).toFixed(6),
        completion: (parseFloat(model.pricing.completion) * 1000000).toFixed(6)
      }
    }
    
    console.warn(`⚠️ No pricing found for ${modelId} in OpenRouter`)
    return undefined
  } catch (error) {
    console.error('❌ Error fetching pricing from OpenRouter:', error)
    return undefined
  }
}

/**
 * Fetch model info from OpenAI API
 */
async function fetchOpenAIModelInfo(apiKey: string, modelId?: string): Promise<ProviderModelInfo | null> {
  try {
    console.log('🔄 Fetching from OpenAI API...')
    console.log('Model ID:', modelId || 'auto-detect')
    
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    console.log('OpenAI API Response Status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI API error:', response.status, errorText)
      return null
    }

    const data = await response.json()
    console.log('OpenAI API returned', data.data?.length || 0, 'models')
    
    // If specific model ID provided, find it
    if (modelId) {
      // Try exact match first
      let model = data.data.find((m: any) => m.id === modelId)
      
      // Try without provider prefix
      if (!model && modelId.includes('/')) {
        const shortId = modelId.split('/')[1]
        model = data.data.find((m: any) => m.id === shortId || m.id.includes(shortId))
      }
      
      if (!model) {
        console.warn(`Model ${modelId} not found in OpenAI API response`)
        // Return default info for known models
        if (modelId.includes('gpt')) {
          const shortId = modelId.split('/').pop() || modelId
          
          // Get pricing from OpenRouter
          const pricing = await getPricingFromOpenRouter(shortId)
          
          return {
            id: shortId,
            name: shortId,
            provider: 'OpenAI',
            contextLength: getOpenAIContextLength(shortId),
            maxOutputTokens: getOpenAIMaxOutputTokens(shortId),
            parameters: getOpenAIParameters(shortId),
            pricing: pricing,
            description: `OpenAI ${shortId} model`
          }
        }
        return null
      }
      
      console.log('✅ Found OpenAI model:', model.id)
      
      // Get pricing from OpenRouter since OpenAI API doesn't provide it
      const pricing = await getPricingFromOpenRouter(model.id)
      
      return {
        id: model.id,
        name: model.id,
        provider: 'OpenAI',
        contextLength: getOpenAIContextLength(model.id),
        maxOutputTokens: getOpenAIMaxOutputTokens(model.id),
        parameters: getOpenAIParameters(model.id),
        pricing: pricing,
        description: `OpenAI ${model.id} model`
      }
    }
    
    // Return first available model info
    if (data.data && data.data.length > 0) {
      const model = data.data[0]
      console.log('✅ Using first available OpenAI model:', model.id)
      
      // Get pricing from OpenRouter
      const pricing = await getPricingFromOpenRouter(model.id)
      
      return {
        id: model.id,
        name: model.id,
        provider: 'OpenAI',
        contextLength: getOpenAIContextLength(model.id),
        maxOutputTokens: getOpenAIMaxOutputTokens(model.id),
        parameters: getOpenAIParameters(model.id),
        pricing: pricing
      }
    }
    
    return null
  } catch (error) {
    console.error('❌ Error fetching OpenAI model info:', error)
    return null
  }
}

/**
 * Get OpenAI model pricing (per 1M tokens)
 */
function getOpenAIPricing(modelId: string): { prompt: string; completion: string } | undefined {
  // Remove provider prefix if present
  const cleanId = modelId.replace('openai/', '').toLowerCase()
  
  const pricing: Record<string, { prompt: string; completion: string }> = {
    'gpt-4o': { prompt: '2.50', completion: '10.00' },
    'gpt-4o-mini': { prompt: '0.150', completion: '0.600' },
    'gpt-4o-2024-11-20': { prompt: '2.50', completion: '10.00' },
    'gpt-4o-2024-08-06': { prompt: '2.50', completion: '10.00' },
    'gpt-4o-2024-05-13': { prompt: '5.00', completion: '15.00' },
    'gpt-4-turbo': { prompt: '10.00', completion: '30.00' },
    'gpt-4-turbo-2024-04-09': { prompt: '10.00', completion: '30.00' },
    'gpt-4': { prompt: '30.00', completion: '60.00' },
    'gpt-4-32k': { prompt: '60.00', completion: '120.00' },
    'gpt-3.5-turbo': { prompt: '0.50', completion: '1.50' },
    'gpt-3.5-turbo-0125': { prompt: '0.50', completion: '1.50' },
    'gpt-3.5-turbo-1106': { prompt: '1.00', completion: '2.00' },
    'gpt-3.5-turbo-16k': { prompt: '3.00', completion: '4.00' },
    'o1-preview': { prompt: '15.00', completion: '60.00' },
    'o1-preview-2024-09-12': { prompt: '15.00', completion: '60.00' },
    'o1-mini': { prompt: '3.00', completion: '12.00' },
    'o1-mini-2024-09-12': { prompt: '3.00', completion: '12.00' },
    'o1': { prompt: '15.00', completion: '60.00' },
    'chatgpt-4o-latest': { prompt: '5.00', completion: '15.00' },
  }
  
  return pricing[cleanId]
}

/**
 * Get Anthropic model pricing (per 1M tokens)
 */
function getAnthropicPricing(modelId: string): { prompt: string; completion: string } | undefined {
  const cleanId = modelId.replace('anthropic/', '').toLowerCase()
  
  const pricing: Record<string, { prompt: string; completion: string }> = {
    'claude-3-5-sonnet-20241022': { prompt: '3.00', completion: '15.00' },
    'claude-3-5-sonnet-20240620': { prompt: '3.00', completion: '15.00' },
    'claude-3-5-haiku-20241022': { prompt: '1.00', completion: '5.00' },
    'claude-3-opus-20240229': { prompt: '15.00', completion: '75.00' },
    'claude-3-sonnet-20240229': { prompt: '3.00', completion: '15.00' },
    'claude-3-haiku-20240307': { prompt: '0.25', completion: '1.25' },
  }
  
  return pricing[cleanId]
}

/**
 * Get Gemini model pricing (per 1M tokens)
 */
function getGeminiPricing(modelId: string): { prompt: string; completion: string } | undefined {
  const cleanId = modelId.replace('google/', '').toLowerCase()
  
  const pricing: Record<string, { prompt: string; completion: string }> = {
    'gemini-2.0-flash-exp': { prompt: '0.00', completion: '0.00' }, // Free
    'gemini-1.5-pro': { prompt: '1.25', completion: '5.00' },
    'gemini-1.5-flash': { prompt: '0.075', completion: '0.30' },
    'gemini-1.5-flash-8b': { prompt: '0.0375', completion: '0.15' },
    'gemini-pro': { prompt: '0.50', completion: '1.50' },
  }
  
  return pricing[cleanId]
}

/**
 * Get OpenAI model context length
 */
function getOpenAIContextLength(modelId: string): number {
  const contextLengths: Record<string, number> = {
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-4-turbo': 128000,
    'gpt-4': 8192,
    'gpt-3.5-turbo': 16385,
    'gpt-3.5-turbo-16k': 16385
  }
  
  return contextLengths[modelId] || 8192
}

/**
 * Get OpenAI model max output tokens
 */
function getOpenAIMaxOutputTokens(modelId: string): number {
  const maxTokens: Record<string, number> = {
    'gpt-4o': 16384,
    'gpt-4o-mini': 16384,
    'gpt-4-turbo': 4096,
    'gpt-4': 4096,
    'gpt-3.5-turbo': 4096
  }
  
  return maxTokens[modelId] || 4096
}

/**
 * Get OpenAI model parameters
 */
function getOpenAIParameters(modelId: string) {
  const maxTokens = getOpenAIMaxOutputTokens(modelId)
  
  return {
    temperature: { min: 0.0, max: 2.0, default: 1.0 },
    maxTokens: { min: 1, max: maxTokens, default: Math.min(2000, maxTokens) },
    topP: { min: 0.0, max: 1.0, default: 1.0 },
    frequencyPenalty: { min: -2.0, max: 2.0, default: 0.0 },
    presencePenalty: { min: -2.0, max: 2.0, default: 0.0 }
  }
}

/**
 * Fetch model info from Anthropic API
 */
async function fetchAnthropicModelInfo(apiKey: string): Promise<ProviderModelInfo | null> {
  try {
    console.log('🔄 Validating Anthropic API key...')
    
    // Anthropic doesn't have a models list endpoint, so we return known model info
    // We can verify the API key by making a minimal request
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      })
    })

    console.log('Anthropic API Response Status:', response.status)

    // Check for authentication errors
    if (response.status === 401 || response.status === 403) {
      const errorText = await response.text()
      console.error('❌ Invalid Anthropic API key:', errorText)
      return null
    }

    // For Anthropic, any non-401/403 response means the key is valid
    console.log('✅ Anthropic API key validated')
    
    // Get pricing from OpenRouter since Anthropic API doesn't provide it
    const pricing = await getPricingFromOpenRouter('claude-3-5-sonnet-20241022')
    
    return {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      provider: 'Anthropic',
      contextLength: 200000,
      maxOutputTokens: 8192,
      pricing: pricing,
      parameters: {
        temperature: { min: 0.0, max: 1.0, default: 1.0 },
        maxTokens: { min: 1, max: 8192, default: 4096 },
        topP: { min: 0.0, max: 1.0, default: 1.0 },
        topK: { min: 0, max: 500, default: 40 }
      },
      description: 'Claude 3.5 Sonnet - Most intelligent model'
    }
  } catch (error) {
    console.error('❌ Error fetching Anthropic model info:', error)
    return null
  }
}

/**
 * Fetch model info from Google AI API
 */
async function fetchGoogleModelInfo(apiKey: string, modelId?: string): Promise<ProviderModelInfo | null> {
  try {
    console.log('🔄 Fetching from Google AI API...')
    console.log('Model ID:', modelId || 'auto-detect')
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)

    console.log('Google AI API Response Status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Google AI API error:', response.status, errorText)
      return null
    }

    const data = await response.json()
    console.log('Google AI API returned', data.models?.length || 0, 'models')
    
    if (data.models && data.models.length > 0) {
      // If specific model ID provided, find it
      let model = data.models[0]
      
      if (modelId) {
        // Extract the actual model name from formats like:
        // "google/gemini-2.0-flash-exp:free" -> "gemini-2.0-flash-exp"
        // "gemini-pro" -> "gemini-pro"
        let searchId = modelId
        if (modelId.includes('/')) {
          searchId = modelId.split('/')[1]
        }
        if (searchId.includes(':')) {
          searchId = searchId.split(':')[0]
        }
        
        console.log('Searching for Google model:', searchId)
        
        // Try to find the specific model
        const foundModel = data.models.find((m: any) => {
          const id = m.name.replace('models/', '')
          return id === searchId || 
                 id.includes(searchId) || 
                 searchId.includes(id) ||
                 m.displayName?.toLowerCase().includes(searchId.toLowerCase())
        })
        
        if (foundModel) {
          model = foundModel
          console.log('✅ Found specific Google model:', model.name)
        } else {
          console.warn(`Model ${searchId} not found, using first available model`)
        }
      } else {
        console.log('✅ Using first available Google model:', model.name)
      }
      
      const maxTemp = model.maxTemperature || 2.0
      const topK = model.topK || 40
      const modelId = model.name.replace('models/', '')
      
      // Get pricing from OpenRouter since Google API doesn't provide it
      const pricing = await getPricingFromOpenRouter(modelId)
      
      return {
        id: modelId,
        name: model.displayName || modelId,
        provider: 'Google',
        contextLength: model.inputTokenLimit || 32768,
        maxOutputTokens: model.outputTokenLimit || 8192,
        pricing: pricing,
        parameters: {
          temperature: { min: 0.0, max: maxTemp, default: model.temperature || 1.0 },
          maxTokens: { min: 1, max: model.outputTokenLimit || 8192, default: Math.min(2048, model.outputTokenLimit || 8192) },
          topP: { min: 0.0, max: 1.0, default: model.topP || 0.95 },
          topK: { min: 1, max: 100, default: topK }
        },
        description: model.description,
        capabilities: model.supportedGenerationMethods
      }
    }
    
    console.warn('⚠️  No models found in Google AI API response')
    return null
  } catch (error) {
    console.error('❌ Error fetching Google model info:', error)
    return null
  }
}

/**
 * Fetch model info from Mistral API
 */
async function fetchMistralModelInfo(apiKey: string): Promise<ProviderModelInfo | null> {
  try {
    console.log('🔄 Fetching from Mistral API...')
    
    const response = await fetch('https://api.mistral.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    console.log('Mistral API Response Status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Mistral API error:', response.status, errorText)
      return null
    }

    const data = await response.json()
    console.log('Mistral API returned', data.data?.length || 0, 'models')
    
    if (data.data && data.data.length > 0) {
      const model = data.data[0]
      console.log('✅ Using Mistral model:', model.id)
      
      return {
        id: model.id,
        name: model.id,
        provider: 'Mistral',
        contextLength: model.max_context_length || 32768,
        parameters: {
          temperature: { min: 0.0, max: 1.0, default: 0.7 },
          maxTokens: { min: 1, max: 4096, default: 2048 },
          topP: { min: 0.0, max: 1.0, default: 1.0 }
        },
        description: model.description
      }
    }
    
    console.warn('⚠️  No models found in Mistral API response')
    return null
  } catch (error) {
    console.error('❌ Error fetching Mistral model info:', error)
    return null
  }
}

/**
 * Main function to fetch model info from any provider
 */
export async function fetchModelInfoFromProvider(
  apiKey: string,
  modelId?: string
): Promise<ProviderModelInfo | null> {
  const provider = detectProvider(apiKey)
  
  console.log(`Fetching model info from ${provider}...`)
  
  switch (provider) {
    case 'OpenAI':
      return await fetchOpenAIModelInfo(apiKey, modelId)
    
    case 'Anthropic':
      return await fetchAnthropicModelInfo(apiKey)
    
    case 'Google':
      return await fetchGoogleModelInfo(apiKey, modelId)
    
    case 'Mistral':
      return await fetchMistralModelInfo(apiKey)
    
    case 'OpenRouter':
      // For OpenRouter, we already have the data from openrouterApi.ts
      return null
    
    default:
      console.warn(`Unknown provider for API key: ${provider}`)
      return null
  }
}

/**
 * Enrich model config with provider API data
 */
export async function enrichModelWithProviderData(
  modelConfig: any
): Promise<any> {
  if (!modelConfig.apiKey) {
    console.warn(`No API key for model ${modelConfig.id}`)
    return modelConfig
  }

  const providerInfo = await fetchModelInfoFromProvider(modelConfig.apiKey, modelConfig.id)
  
  if (!providerInfo) {
    console.warn(`Could not fetch provider info for ${modelConfig.id}`)
    return modelConfig
  }

  return {
    ...modelConfig,
    provider: providerInfo.provider,
    contextLength: providerInfo.contextLength,
    maxOutputTokens: providerInfo.maxOutputTokens,
    parameters: providerInfo.parameters,
    pricing: providerInfo.pricing,
    description: providerInfo.description || modelConfig.description,
    capabilities: providerInfo.capabilities
  }
}

/**
 * Fetch with timeout handling
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeout = 10000): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(id)
    return response
  } catch (error: any) {
    clearTimeout(id)
    if (error.name === 'AbortError') {
      throw new Error('Request timeout. Please try again.')
    }
    throw error
  }
}

/**
 * Fetch all OpenAI models
 */
async function fetchAllOpenAIModels(apiKey: string): Promise<ProviderModelInfo[]> {
  try {
    console.log('🔄 Fetching all OpenAI models...')
    
    const response = await fetchWithTimeout('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key')
      }
      throw new Error('Failed to fetch OpenAI models')
    }

    const data = await response.json()
    console.log(`✅ Fetched ${data.data?.length || 0} OpenAI models`)
    
    if (!data.data || data.data.length === 0) {
      throw new Error('No models found')
    }

    return data.data.map((model: any) => ({
      id: model.id,
      name: model.id,
      provider: 'OpenAI',
      contextLength: getOpenAIContextLength(model.id),
      maxOutputTokens: getOpenAIMaxOutputTokens(model.id),
      parameters: getOpenAIParameters(model.id),
      pricing: getOpenAIPricing(model.id),
      description: `OpenAI ${model.id} model`
    }))
  } catch (error: any) {
    console.error('❌ Error fetching OpenAI models:', error)
    throw error
  }
}

/**
 * Fetch all Google AI models
 */
async function fetchAllGoogleModels(apiKey: string): Promise<ProviderModelInfo[]> {
  try {
    console.log('🔄 Fetching all Google AI models...')
    
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {}
    )

    if (!response.ok) {
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        throw new Error('Invalid API key')
      }
      throw new Error('Failed to fetch Google models')
    }

    const data = await response.json()
    console.log(`✅ Fetched ${data.models?.length || 0} Google AI models`)
    
    if (!data.models || data.models.length === 0) {
      throw new Error('No models found')
    }

    return Promise.all(data.models
      .filter((model: any) => model.supportedGenerationMethods?.includes('generateContent'))
      .map(async (model: any) => {
        const maxTemp = model.maxTemperature || 2.0
        const topK = model.topK || 40
        const modelId = model.name.replace('models/', '')
        
        // Get pricing from OpenRouter since Google API doesn't provide it
        const pricing = await getPricingFromOpenRouter(modelId)
        
        return {
          id: modelId,
          name: model.displayName || modelId,
          provider: 'Google',
          contextLength: model.inputTokenLimit,
          maxOutputTokens: model.outputTokenLimit,
          pricing,
          parameters: {
            temperature: {
              min: 0.0,
              max: maxTemp,
              default: model.temperature || 1.0
            },
            maxTokens: {
              min: 1,
              max: model.outputTokenLimit || 8192,
              default: Math.min(2048, model.outputTokenLimit || 8192)
            },
            topP: {
              min: 0.0,
              max: 1.0,
              default: model.topP || 0.95
            },
            topK: {
              min: 1,
              max: 100,
              default: topK
            }
          },
          description: model.description,
          capabilities: model.supportedGenerationMethods
        }
      }))
  } catch (error: any) {
    console.error('❌ Error fetching Google models:', error)
    throw error
  }
}

/**
 * Fetch all Anthropic models from their API
 */
async function fetchAllAnthropicModels(apiKey: string): Promise<ProviderModelInfo[]> {
  try {
    console.log('🔄 Fetching Anthropic models from API...')
    
    // Fetch models from Anthropic's /v1/models endpoint
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    }, 15000)

    // Check for authentication errors
    if (response.status === 401 || response.status === 403) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || 'Invalid API key')
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch Anthropic models: ${response.status}`)
    }

    const data = await response.json()
    console.log(`✅ Fetched ${data.data?.length || 0} Anthropic models`)
    
    if (!data.data || data.data.length === 0) {
      throw new Error('No models found')
    }

    // Map Anthropic models to our format
    return Promise.all(data.data.map(async (model: any) => {
      // Determine context length and max output based on model family
      let contextLength = 200000 // Default for Claude 3+
      let maxOutputTokens = 8192  // Default
      
      // Claude 4.x models
      if (model.id.includes('claude-4') || model.id.includes('claude-haiku-4') || 
          model.id.includes('claude-sonnet-4') || model.id.includes('claude-opus-4')) {
        contextLength = 200000
        maxOutputTokens = 8192
      }
      // Claude 3.x models
      else if (model.id.includes('claude-3')) {
        contextLength = 200000
        maxOutputTokens = model.id.includes('opus') || model.id.includes('sonnet-3-7') ? 8192 : 4096
      }

      // Get pricing from OpenRouter since Anthropic API doesn't provide it
      const pricing = await getPricingFromOpenRouter(model.id)

      return {
        id: model.id,
        name: model.display_name || model.id,
        provider: 'Anthropic',
        contextLength,
        maxOutputTokens,
        pricing,
        parameters: {
          temperature: { min: 0.0, max: 1.0, default: 1.0 },
          maxTokens: { min: 1, max: maxOutputTokens, default: Math.min(4096, maxOutputTokens) },
          topP: { min: 0.0, max: 1.0, default: 1.0 },
          topK: { min: 0, max: 500, default: 40 }
        },
        description: `${model.display_name} - Created ${new Date(model.created_at).toLocaleDateString()}`
      }
    }))
  } catch (error: any) {
    console.error('❌ Error fetching Anthropic models:', error)
    throw error
  }
}

/**
 * Fetch all Mistral models
 */
async function fetchAllMistralModels(apiKey: string): Promise<ProviderModelInfo[]> {
  try {
    console.log('🔄 Fetching all Mistral models...')
    
    const response = await fetchWithTimeout('https://api.mistral.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key')
      }
      throw new Error('Failed to fetch Mistral models')
    }

    const data = await response.json()
    console.log(`✅ Fetched ${data.data?.length || 0} Mistral models`)
    
    if (!data.data || data.data.length === 0) {
      throw new Error('No models found')
    }

    return data.data.map((model: any) => ({
      id: model.id,
      name: model.id,
      provider: 'Mistral',
      contextLength: model.max_context_length || 32768,
      parameters: {
        temperature: { min: 0.0, max: 1.0, default: 0.7 },
        maxTokens: { min: 1, max: 4096, default: 2048 },
        topP: { min: 0.0, max: 1.0, default: 1.0 }
      },
      description: model.description
    }))
  } catch (error: any) {
    console.error('❌ Error fetching Mistral models:', error)
    throw error
  }
}

/**
 * Fetch all OpenRouter models with custom API key
 */
async function fetchAllOpenRouterModels(apiKey: string): Promise<ProviderModelInfo[]> {
  try {
    console.log('🔄 Fetching all OpenRouter models...')
    
    const response = await fetchWithTimeout('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
        'X-Title': 'Kali Assistant'
      }
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API key')
      }
      throw new Error('Failed to fetch OpenRouter models')
    }

    const data = await response.json()
    console.log(`✅ Fetched ${data.data?.length || 0} OpenRouter models`)
    
    if (!data.data || data.data.length === 0) {
      throw new Error('No models found')
    }

    return data.data.map((model: any) => {
      const maxCompletionTokens = model.top_provider?.max_completion_tokens || 
                                   Math.min(model.context_length / 2, 4000)
      
      return {
        id: model.id,
        name: model.name,
        provider: 'OpenRouter',
        contextLength: model.context_length,
        maxOutputTokens: maxCompletionTokens,
        parameters: {
          temperature: { min: 0.0, max: 2.0, default: 0.7 },
          maxTokens: { min: 1, max: maxCompletionTokens, default: Math.min(2000, maxCompletionTokens) },
          topP: { min: 0.0, max: 1.0, default: 1.0 },
          frequencyPenalty: { min: -2.0, max: 2.0, default: 0.0 },
          presencePenalty: { min: -2.0, max: 2.0, default: 0.0 }
        },
        pricing: model.pricing,
        description: model.description
      }
    })
  } catch (error: any) {
    console.error('❌ Error fetching OpenRouter models:', error)
    throw error
  }
}

/**
 * Fetch all AI/ML API models
 */
async function fetchAllAIMLModels(apiKey: string): Promise<ProviderModelInfo[]> {
  try {
    console.log('🔄 Fetching all AI/ML API models...')
    
    const response = await fetchWithTimeout('https://api.aimlapi.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API key')
      }
      throw new Error('Failed to fetch AI/ML API models')
    }

    const data = await response.json()
    console.log(`✅ Fetched ${data.data?.length || 0} AI/ML API models`)
    
    if (!data.data || data.data.length === 0) {
      throw new Error('No models found')
    }

    return data.data.map((model: any) => ({
      id: model.id,
      name: model.id,
      provider: 'AIML',
      contextLength: getOpenAIContextLength(model.id),
      maxOutputTokens: getOpenAIMaxOutputTokens(model.id),
      parameters: getOpenAIParameters(model.id),
      description: `AI/ML API - ${model.id} model`
    }))
  } catch (error: any) {
    console.error('❌ Error fetching AI/ML API models:', error)
    throw error
  }
}

/**
 * Fetch all available models from a provider using an API key
 * Uses backend proxy to avoid CORS issues
 */
export async function fetchAllModelsFromProvider(
  apiKey: string,
  manualProvider?: string
): Promise<ProviderModelInfo[]> {
  const provider = manualProvider || detectProvider(apiKey)
  
  console.log(`Fetching all models from ${provider} via backend proxy...`)
  
  try {
    // Use backend proxy for supported providers
    if (['OpenAI', 'Anthropic', 'Google'].includes(provider)) {
      const backendUrl = typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:3002`)
        : 'http://backend:3002'
      
      const response = await fetch(`${backendUrl}/api/models/fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          provider
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch models')
      }

      const data = await response.json()
      console.log(`✅ Fetched ${data.models.length} models from ${data.provider}`)
      
      // Enrich models with parameter info
      return data.models.map((model: any) => ({
        ...model,
        parameters: getModelParameters(model.provider, model.id, model.maxOutputTokens)
      }))
    }
    
    // Fallback to direct API calls for other providers
    switch (provider) {
      case 'Mistral':
        return await fetchAllMistralModels(apiKey)
      
      case 'OpenRouter':
        return await fetchAllOpenRouterModels(apiKey)
      
      case 'AIML':
        return await fetchAllAIMLModels(apiKey)
      
      case 'OpenAI-Compatible':
        return await fetchAllOpenAIModels(apiKey)
      
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  } catch (error: any) {
    console.error('❌ Error fetching models:', error)
    throw error
  }
}

/**
 * Get model parameters based on provider
 */
function getModelParameters(provider: string, modelId: string, maxOutputTokens?: number) {
  switch (provider) {
    case 'Anthropic':
      return {
        temperature: { min: 0.0, max: 1.0, default: 1.0 },
        maxTokens: { min: 1, max: maxOutputTokens || 8192, default: 4096 },
        topP: { min: 0.0, max: 1.0, default: 1.0 },
        topK: { min: 0, max: 500, default: 40 }
      }
    
    case 'OpenAI':
      return {
        temperature: { min: 0.0, max: 2.0, default: 1.0 },
        maxTokens: { min: 1, max: maxOutputTokens || 4096, default: Math.min(2000, maxOutputTokens || 4096) },
        topP: { min: 0.0, max: 1.0, default: 1.0 },
        frequencyPenalty: { min: -2.0, max: 2.0, default: 0.0 },
        presencePenalty: { min: -2.0, max: 2.0, default: 0.0 }
      }
    
    case 'Google':
      return {
        temperature: { min: 0.0, max: 2.0, default: 1.0 },
        maxTokens: { min: 1, max: maxOutputTokens || 8192, default: Math.min(2048, maxOutputTokens || 8192) },
        topP: { min: 0.0, max: 1.0, default: 0.95 },
        topK: { min: 1, max: 100, default: 40 }
      }
    
    default:
      return {
        temperature: { min: 0.0, max: 2.0, default: 1.0 },
        maxTokens: { min: 1, max: maxOutputTokens || 4096, default: 2048 },
        topP: { min: 0.0, max: 1.0, default: 1.0 }
      }
  }
}
