/**
 * OpenRouter API Integration
 * Fetches model information, parameters, and provider details
 */

export interface OpenRouterModel {
  id: string
  name: string
  description?: string
  pricing: {
    prompt: string
    completion: string
    image?: string
    request?: string
  }
  context_length: number
  architecture?: {
    modality: string
    tokenizer: string
    instruct_type?: string
  }
  top_provider?: {
    context_length: number
    max_completion_tokens?: number
    is_moderated: boolean
  }
  per_request_limits?: {
    prompt_tokens?: string
    completion_tokens?: string
  }
  supported_parameters?: string[]
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[]
}

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1'

/**
 * Fetch all available models from OpenRouter
 */
export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY
  
  if (!apiKey) {
    console.error('❌ NEXT_PUBLIC_OPENROUTER_API_KEY is not set')
    return []
  }
  
  try {
    console.log('🔄 Fetching models from OpenRouter API...')
    console.log('API Base:', OPENROUTER_API_BASE)
    
    const response = await fetch(`${OPENROUTER_API_BASE}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
        'X-Title': 'Kali Assistant'
      },
    })

    console.log('Response status:', response.status, response.statusText)

    if (!response.ok) {
      console.error(`❌ OpenRouter API error: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      console.error('Error details:', errorText)
      throw new Error(`Failed to fetch models: ${response.statusText}`)
    }

    const data: OpenRouterModelsResponse = await response.json()
    console.log(`✅ Fetched ${data.data?.length || 0} models from OpenRouter`)
    
    if (data.data && data.data.length > 0) {
      console.log('Sample model:', data.data[0].id, data.data[0].name)
    }
    
    return data.data || []
  } catch (error: any) {
    console.error('❌ Error fetching OpenRouter models:', error)
    console.error('Error type:', error.name)
    console.error('Error message:', error.message)
    return []
  }
}

/**
 * Get model details by ID
 */
export async function getModelDetails(modelId: string): Promise<OpenRouterModel | null> {
  try {
    const models = await fetchOpenRouterModels()
    return models.find(m => m.id === modelId) || null
  } catch (error) {
    console.error('Error getting model details:', error)
    return null
  }
}

/**
 * Extract provider name from model ID
 */
export function getProviderFromModelId(modelId: string): string {
  const parts = modelId.split('/')
  if (parts.length > 1) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  }
  
  // Fallback for models without provider prefix
  if (modelId.startsWith('gpt')) return 'OpenAI'
  if (modelId.startsWith('claude')) return 'Anthropic'
  if (modelId.startsWith('gemini')) return 'Google'
  if (modelId.startsWith('mistral')) return 'Mistral'
  if (modelId.startsWith('llama')) return 'Meta'
  
  return 'Unknown'
}

/**
 * Format pricing for display
 */
export function formatPricing(pricing: OpenRouterModel['pricing']): string {
  const promptPrice = parseFloat(pricing.prompt) * 1000000
  const completionPrice = parseFloat(pricing.completion) * 1000000
  
  return `$${promptPrice.toFixed(2)}/$${completionPrice.toFixed(2)} per 1M tokens`
}

/**
 * Get default parameters (fallback)
 */
export function getDefaultParameters() {
  return {
    temperature: {
      min: 0.0,
      max: 2.0,
      default: 0.7
    },
    maxTokens: {
      min: 1,
      max: 4000,
      default: 2000
    },
    topP: {
      min: 0.0,
      max: 1.0,
      default: 1.0
    },
    topK: {
      min: 0,
      max: 100,
      default: 40
    },
    frequencyPenalty: {
      min: -2.0,
      max: 2.0,
      default: 0.0
    },
    presencePenalty: {
      min: -2.0,
      max: 2.0,
      default: 0.0
    }
  }
}

/**
 * Get model parameters with ranges from OpenRouter data
 */
export function getModelParameters(model: OpenRouterModel) {
  const maxCompletionTokens = model.top_provider?.max_completion_tokens || 
                               Math.min(model.context_length / 2, 4000)
  
  const supportedParams = model.supported_parameters || []
  
  const params: any = {}
  
  // Temperature - supported by most models
  if (supportedParams.includes('temperature') || supportedParams.length === 0) {
    params.temperature = {
      min: 0.0,
      max: 2.0,
      default: 0.7
    }
  }
  
  // Max tokens - always available
  params.maxTokens = {
    min: 1,
    max: maxCompletionTokens,
    default: Math.min(2000, maxCompletionTokens)
  }
  
  // Top P
  if (supportedParams.includes('top_p') || supportedParams.length === 0) {
    params.topP = {
      min: 0.0,
      max: 1.0,
      default: 1.0
    }
  }
  
  // Top K
  if (supportedParams.includes('top_k')) {
    params.topK = {
      min: 0,
      max: 100,
      default: 40
    }
  }
  
  // Frequency Penalty
  if (supportedParams.includes('frequency_penalty') || supportedParams.length === 0) {
    params.frequencyPenalty = {
      min: -2.0,
      max: 2.0,
      default: 0.0
    }
  }
  
  // Presence Penalty
  if (supportedParams.includes('presence_penalty') || supportedParams.length === 0) {
    params.presencePenalty = {
      min: -2.0,
      max: 2.0,
      default: 0.0
    }
  }
  
  // Repetition Penalty (some models use this instead of frequency/presence)
  if (supportedParams.includes('repetition_penalty')) {
    params.repetitionPenalty = {
      min: 0.0,
      max: 2.0,
      default: 1.0
    }
  }
  
  // Min P (some models support this)
  if (supportedParams.includes('min_p')) {
    params.minP = {
      min: 0.0,
      max: 1.0,
      default: 0.0
    }
  }
  
  // Top A (some models support this)
  if (supportedParams.includes('top_a')) {
    params.topA = {
      min: 0.0,
      max: 1.0,
      default: 0.0
    }
  }
  
  return params
}
