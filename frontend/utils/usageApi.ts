/**
 * Usage API Client
 * Fetches usage statistics from the backend
 */

export interface UsageStats {
  totalRequests: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  reasoningTokens: number
  totalCost: number
  byModel: Record<string, {
    requests: number
    tokens: number
    cost: number
  }>
  byDay: Record<string, {
    requests: number
    promptTokens: number
    completionTokens: number
    reasoningTokens: number
    totalTokens: number
    cost: number
  }>
  byDayByModel: Record<string, Record<string, {
    requests: number
    promptTokens: number
    completionTokens: number
    reasoningTokens: number
    totalTokens: number
    cost: number
  }>>
}

export interface UsageRecord {
  id: string
  user_id: string
  model_id: string
  provider: string
  prompt_tokens: number
  completion_tokens: number
  reasoning_tokens: number
  total_tokens: number
  estimated_cost: number
  session_id: string | null
  project_id: string | null
  created_at: string
}

/**
 * Fetch aggregated usage statistics
 */
export async function fetchUsageStats(
  userId: string,
  options: {
    modelId?: string
    startDate?: string
    endDate?: string
    groupBy?: 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month'
  } = {}
): Promise<UsageStats> {
  const params = new URLSearchParams({
    userId,
    ...options
  })

  const backendUrl = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:3002`)
    : 'http://backend:3002'
  
  console.log('🌐 Fetching usage stats from:', `${backendUrl}/api/usage/stats?${params}`)

  const response = await fetch(`${backendUrl}/api/usage/stats?${params}`)
  
  console.log('📡 Response status:', response.status, response.statusText)
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ API error response:', errorText)
    throw new Error('Failed to fetch usage stats')
  }

  const data = await response.json()
  console.log('✅ Received usage data:', data)
  
  return data
}

/**
 * Fetch detailed usage history
 */
export async function fetchUsageHistory(
  userId: string,
  options: {
    modelId?: string
    startDate?: string
    endDate?: string
    limit?: number
  } = {}
): Promise<UsageRecord[]> {
  const params = new URLSearchParams({ userId })
  
  if (options.modelId) params.append('modelId', options.modelId)
  if (options.startDate) params.append('startDate', options.startDate)
  if (options.endDate) params.append('endDate', options.endDate)
  if (options.limit) params.append('limit', String(options.limit))

  const backendUrl = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:3002`)
    : 'http://backend:3002'

  const response = await fetch(`${backendUrl}/api/usage/history?${params}`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch usage history')
  }

  return response.json()
}
