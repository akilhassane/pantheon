'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { userSettingsService } from '@/utils/userSettingsService'
import { AppSettings, ModelConfig, DEFAULT_SETTINGS } from '@/types/settings'
import { ModelParametersSection } from './ModelParametersSection'
import { ModelDiagnostics } from './ModelDiagnostics'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Trash2, Loader2, CheckCircle, XCircle, Eye, EyeOff, Plus, Activity, BarChart3, Search } from 'lucide-react'
import { ProviderModelInfo, fetchAllModelsFromProvider } from '@/utils/providerApis'
import { ModelImportList } from './ModelImportList'
import { fetchUsageStats, UsageStats } from '@/utils/usageApi'
import { useAuth } from '@/contexts/AuthContext'


type ModelTab = 'add' | 'configured' | 'activity' | 'usage'

interface ModelSettingsProps {
  isVisible?: boolean
}

/**
 * Sanitize model ID - handles cases where the model ID might be a JSON object
 * (due to a bug where the entire Gemini model config was stored instead of just the ID)
 */
function sanitizeModelId(modelId: string): string {
  // If it looks like JSON (starts with { or [), try to extract the actual model name
  if (typeof modelId === 'string' && (modelId.startsWith('{') || modelId.startsWith('['))) {
    try {
      const parsed = JSON.parse(modelId);
      // If it's a Gemini config object, extract the model name
      if (parsed.model) {
        return parsed.model;
      }
      // If we can't extract a model name, return a placeholder
      return 'Unknown Model';
    } catch (e) {
      // If parsing fails, return a placeholder
      return 'Invalid Model ID';
    }
  }
  return modelId;
}

export function ModelSettings({ isVisible = true }: ModelSettingsProps) {
  const { user } = useAuth() // Get user from AuthContext
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<ModelTab>('configured')
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [newModelName, setNewModelName] = useState('')
  const [newApiKey, setNewApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [fetchedModels, setFetchedModels] = useState<ProviderModelInfo[]>([])
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set())
  const [isFetching, setIsFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string>('')
  const [modelSearchQuery, setModelSearchQuery] = useState('')
  
  // Usage tracking state
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [isLoadingUsage, setIsLoadingUsage] = useState(false)
  const [usageError, setUsageError] = useState<string>('')
  
  // Per-model usage state (for right column in Configured Models tab)
  const [modelUsageStats, setModelUsageStats] = useState<UsageStats | null>(null)
  const [isLoadingModelUsage, setIsLoadingModelUsage] = useState(false)
  
  // Per-model chart interaction state
  const [modelHoveredDataIndex, setModelHoveredDataIndex] = useState<number | null>(null)
  const [modelMousePosition, setModelMousePosition] = useState<{ x: number; y: number } | null>(null)
  const modelChartRef = useRef<HTMLDivElement>(null)
  const [modelTooltipPosition, setModelTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  
  // Chart interaction state
  const [hoveredDataIndex, setHoveredDataIndex] = useState<number | null>(null)
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null)
  const [tooltipMousePosition, setTooltipMousePosition] = useState<{ x: number; y: number } | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1) // 1 = 100%, 2 = 200%, etc.
  const [panOffset, setPanOffset] = useState(0) // Horizontal pan offset in percentage
  const [isPanning, setIsPanning] = useState(false)
  const [panStartX, setPanStartX] = useState(0)
  
  // Donut chart hover states
  const [hoveredTop5Index, setHoveredTop5Index] = useState<number | null>(null)
  const [hoveredUsageIndex, setHoveredUsageIndex] = useState<number | null>(null)
  const [hoveredCostIndex, setHoveredCostIndex] = useState<number | null>(null)
  
  // Animation states
  const [lineAnimationProgress, setLineAnimationProgress] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const animationFrameRef = useRef<number | null>(null)
  
  // Donut chart visibility tracking and animation progress
  const [top5AnimationProgress, setTop5AnimationProgress] = useState(0)
  const [usageAnimationProgress, setUsageAnimationProgress] = useState(0)
  const [costAnimationProgress, setCostAnimationProgress] = useState(0)
  const [hasTop5Animated, setHasTop5Animated] = useState(false)
  const [hasUsageAnimated, setHasUsageAnimated] = useState(false)
  const [hasCostAnimated, setHasCostAnimated] = useState(false)
  const top5ChartRef = useRef<HTMLDivElement>(null)
  const usageChartRef = useRef<HTMLDivElement>(null)
  const costChartRef = useRef<HTMLDivElement>(null)
  
  // Resizable dividers
  const [leftColumnWidth, setLeftColumnWidth] = useState(224) // 224px = w-56
  const [centerColumnWidth, setCenterColumnWidth] = useState(384) // 384px = w-96
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const [isResizingCenter, setIsResizingCenter] = useState(false)

  // Handle left divider resize
  const handleLeftMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsResizingLeft(true)
    e.preventDefault()
  }

  // Handle center divider resize
  const handleCenterMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsResizingCenter(true)
    e.preventDefault()
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = document.querySelector('.model-settings-container')
      if (!container) return
      
      const containerRect = container.getBoundingClientRect()
      
      if (isResizingLeft) {
        const newWidth = e.clientX - containerRect.left
        if (newWidth >= 180 && newWidth <= 400) {
          setLeftColumnWidth(newWidth)
        }
      }
      
      if (isResizingCenter) {
        const newWidth = e.clientX - containerRect.left - leftColumnWidth
        if (newWidth >= 300 && newWidth <= 600) {
          setCenterColumnWidth(newWidth)
        }
      }
    }

    const handleMouseUp = () => {
      setIsResizingLeft(false)
      setIsResizingCenter(false)
    }

    if (isResizingLeft || isResizingCenter) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingLeft, isResizingCenter, leftColumnWidth])

  // Reset all hover states when settings modal is hidden
  useEffect(() => {
    if (!isVisible) {
      // Reset all chart hover states
      setHoveredDataIndex(null)
      setTooltipMousePosition(null)
      setModelHoveredDataIndex(null)
      setModelTooltipPosition(null)
      setHoveredTop5Index(null)
      setHoveredUsageIndex(null)
      setHoveredCostIndex(null)
      setMousePosition(null)
      setModelMousePosition(null)
    }
  }, [isVisible])

  // Reset zoom and pan when switching tabs
  useEffect(() => {
    setZoomLevel(1)
    setPanOffset(0)
  }, [activeTab])

  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) {
        console.log('⚠️ No user ID, using default settings')
        setSettings(DEFAULT_SETTINGS)
        setIsLoaded(true)
        return
      }

      // Load settings from backend (with localStorage fallback)
      const loaded = await userSettingsService.load(user.id)
      
      // Fetch OpenRouter models for enrichment only
      const { fetchOpenRouterModels, getProviderFromModelId, getModelParameters } = await import('@/utils/openrouterApi')
      const { enrichModelWithProviderData } = await import('@/utils/providerApis')
      
      try {
        const openRouterModels = await fetchOpenRouterModels()
        
        // Only enrich existing models, don't auto-populate
        if (loaded.models.configuredModels.length > 0) {
          // Enrich existing configured models with data from their provider APIs
          
          const enrichedModels = await Promise.all(
            loaded.models.configuredModels.map(async (model) => {
              // Fallback to OpenRouter data (always use OpenRouter for pricing since direct API calls fail due to CORS)
              // Try to find matching OpenRouter model with fuzzy matching
              let orModel = openRouterModels.find(m => m.id === model.id)
              
              // If not found, try fuzzy matching
              if (!orModel) {
                // Normalize model ID for comparison
                const normalizeId = (id: string | undefined) => {
                  if (!id) return ''
                  return id
                    .replace(/^(anthropic|google|openai|mistral)\//i, '') // Remove provider prefix
                    .replace(/:(free|paid)$/i, '')  // Remove :free or :paid suffix
                    .replace(/-\d{8}$/, '')         // Remove date suffix like -20251001
                    .replace(/\./g, '-')            // Convert dots to dashes
                    .replace(/-exp(erimental)?$/i, '-exp') // Normalize experimental suffix
                    .toLowerCase()
                }
                
                const normalizedModelId = normalizeId(model.id)
                console.log(`🔍 Fuzzy matching for ${model.id} (normalized: ${normalizedModelId})`)
                
                orModel = openRouterModels.find(m => {
                  const normalizedOrId = normalizeId(m?.id)
                  if (!normalizedOrId) return false
                  const match = normalizedOrId === normalizedModelId || 
                                normalizedOrId.includes(normalizedModelId) ||
                                normalizedModelId.includes(normalizedOrId)
                  if (match) {
                    console.log(`  ✓ Matched with ${m.id}`)
                  }
                  return match
                })
              }
              
              if (orModel) {
                console.log(`✓ Enriching ${model.id} with OpenRouter data`)
                console.log(`  Has pricing:`, !!orModel.pricing, orModel.pricing)
                const enrichedModel = {
                  ...model,
                  name: orModel.name,
                  provider: getProviderFromModelId(orModel.id),
                  contextLength: orModel.context_length,
                  pricing: orModel.pricing ? {
                    prompt: (parseFloat(orModel.pricing.prompt) * 1000000).toFixed(2),
                    completion: (parseFloat(orModel.pricing.completion) * 1000000).toFixed(2)
                  } : undefined,
                  description: orModel.description,
                  parameters: getModelParameters(orModel)
                }
                console.log(`  Enriched pricing:`, enrichedModel.pricing)
                return enrichedModel
              }
              
              return model
            })
          )
          
          loaded.models.configuredModels = enrichedModels
        }
      } catch (error) {
        console.error('Failed to fetch model data:', error)
      }
      
      setSettings(loaded)
      setIsLoaded(true)
    }
    
    loadSettings()
    
    // Listen for storage changes to reload settings in real-time
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'app-settings') {
        console.log('🔄 [ModelSettings] Settings changed, reloading...')
        loadSettings()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [user?.id])

  useEffect(() => {
    if (settings.models.configuredModels.length > 0 && !selectedModelId) {
      setSelectedModelId(settings.models.configuredModels[0].id)
    }
  }, [settings.models.configuredModels, selectedModelId])

  // Fetch usage data when Activity tab is active
  useEffect(() => {
    const loadUsageData = async () => {
      if (activeTab !== 'activity') return
      
      setIsLoadingUsage(true)
      setUsageError('')
      
      try {
        // Get current user from auth context
        const currentUser = user
        
        if (!currentUser) {
          setUsageError('Please sign in to view usage statistics')
          return
        }

        console.log('📊 Loading usage data for user:', currentUser.id);

        // First, fetch with 'second' grouping to get individual requests
        // This allows us to determine the time range and choose appropriate grouping
        // NOTE: Always fetch ALL models for the Activity tab (don't filter by selectedModelId)
        const initialStats = await fetchUsageStats(currentUser.id, {
          groupBy: 'second' // Keep as 'second' to show all individual requests
        })

        // Determine time range from the data
        const dates = Object.keys(initialStats.byDay).sort();
        if (dates.length > 0) {
          // Always use the initial stats with 'second' grouping to show all individual requests
          setUsageStats(initialStats);
        } else {
          setUsageStats(initialStats);
        }

        console.log('📊 Received usage stats:', initialStats);
        
        // Always start at 1200% zoom (12x) and focus on the most recent data
        const initialZoom = 12;
        setZoomLevel(initialZoom);
        
        if (dates.length > 0) {
          // Position the most recent data at 95% from the left edge of viewport
          // At 12x zoom:
          // - Content is scaled 12x from the left edge
          // - We want the rightmost point at 95% of viewport
          // - So we need to show from 95% - (100/zoom)% to 95% of the scaled content
          // - translateX to shift: -(100 - 100/zoom - 5)
          const viewportCoverage = 100 / initialZoom; // How much of content fits in viewport (8.33%)
          const rightMargin = 5; // 5% margin from right edge (so last point at 95%)
          const panToShowEnd = -(100 - viewportCoverage - rightMargin);
          
          // Shift slightly to the left (increase the negative offset by 1%)
          setPanOffset(panToShowEnd - 1);
        } else {
          setPanOffset(0);
        }
        
        // Start animations after data loads
        setIsAnimating(true)
        setLineAnimationProgress(0)
        
        // Animate line chart from 0 to 100% over 1 second
        const startTime = Date.now()
        const animateLine = () => {
          const elapsed = Date.now() - startTime
          const duration = 1000 // 1 second
          const progress = Math.min(elapsed / duration, 1)
          
          // Ease-out cubic for smooth deceleration
          const eased = 1 - Math.pow(1 - progress, 3)
          setLineAnimationProgress(eased)
          
          if (progress < 1) {
            animationFrameRef.current = requestAnimationFrame(animateLine)
          } else {
            setIsAnimating(false)
          }
        }
        
        animationFrameRef.current = requestAnimationFrame(animateLine)
      } catch (error: any) {
        console.error('Error loading usage data:', error)
        setUsageError(error.message || 'Failed to load usage data')
      } finally {
        setIsLoadingUsage(false)
      }
    }

    loadUsageData()
    
    // Listen for chat completion events to refresh usage data
    const handleChatComplete = () => {
      if (activeTab === 'activity') {
        console.log('🔄 Chat completed, refreshing usage data...')
        loadUsageData()
      }
    }
    
    window.addEventListener('chat-complete', handleChatComplete)
    
    return () => {
      window.removeEventListener('chat-complete', handleChatComplete)
      // Clean up animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [activeTab])

  // Fetch per-model usage data for right column in Configured Models tab
  useEffect(() => {
    const loadModelUsageData = async () => {
      if (activeTab !== 'configured' || !selectedModelId) {
        setModelUsageStats(null)
        return
      }
      
      setIsLoadingModelUsage(true)
      
      try {
        const currentUser = user
        if (!currentUser) return

        // Get last 30 days of data for this specific model
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - 30)

        const stats = await fetchUsageStats(currentUser.id, {
          modelId: selectedModelId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          groupBy: 'day'
        })

        console.log('📊 Per-model usage stats received:', {
          modelId: selectedModelId,
          totalRequests: stats.totalRequests,
          totalTokens: stats.totalTokens,
          byDayKeys: Object.keys(stats.byDay),
          byDayCount: Object.keys(stats.byDay).length,
          sampleData: Object.keys(stats.byDay).slice(0, 5).map(date => ({
            date,
            data: stats.byDay[date]
          }))
        });

        setModelUsageStats(stats)
      } catch (error) {
        console.error('Error loading model usage:', error)
      } finally {
        setIsLoadingModelUsage(false)
      }
    }

    loadModelUsageData()
    
    // Refresh on chat completion
    const handleChatComplete = () => {
      if (activeTab === 'configured' && selectedModelId) {
        loadModelUsageData()
      }
    }
    
    window.addEventListener('chat-complete', handleChatComplete)
    
    return () => {
      window.removeEventListener('chat-complete', handleChatComplete)
    }
  }, [activeTab, selectedModelId])

  // Intersection Observer for donut chart animations
  useEffect(() => {
    if (activeTab !== 'activity' || !usageStats || usageStats.totalRequests === 0) return

    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1 // Trigger when 10% visible
    }

    const animateDonut = (setAnimated: (value: boolean) => void, setProgress: (value: number) => void, name: string) => {
      console.log(`🎨 Starting ${name} donut animation`)
      setAnimated(true)
      const startTime = Date.now()
      
      const animate = () => {
        const elapsed = Date.now() - startTime
        const duration = 200 // 0.2 seconds for faster sequential drawing
        const progress = Math.min(elapsed / duration, 1)
        
        // Ease-out expo for very smooth, natural deceleration
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
        setProgress(eased)
        
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          console.log(`✅ ${name} donut animation complete`)
        }
      }
      
      requestAnimationFrame(animate)
    }

    // Single observer for all charts
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const target = entry.target as HTMLElement
        const chartName = target.getAttribute('data-chart-name')
        
        console.log(`👀 ${chartName} intersection:`, entry.isIntersecting, 'ratio:', entry.intersectionRatio)
        
        if (entry.isIntersecting) {
          if (chartName === 'top5' && !hasTop5Animated) {
            animateDonut(setHasTop5Animated, setTop5AnimationProgress, 'Top5')
          } else if (chartName === 'usage' && !hasUsageAnimated) {
            animateDonut(setHasUsageAnimated, setUsageAnimationProgress, 'Usage')
          } else if (chartName === 'cost' && !hasCostAnimated) {
            animateDonut(setHasCostAnimated, setCostAnimationProgress, 'Cost')
          }
        }
      })
    }, observerOptions)

    // Use requestAnimationFrame to ensure DOM is fully painted
    const observeCharts = () => {
      requestAnimationFrame(() => {
        if (top5ChartRef.current) {
          console.log('📍 Observing Top5 chart')
          observer.observe(top5ChartRef.current)
        } else {
          console.warn('⚠️ Top5 chart ref not found')
        }
        
        if (usageChartRef.current) {
          console.log('📍 Observing Usage chart')
          observer.observe(usageChartRef.current)
        } else {
          console.warn('⚠️ Usage chart ref not found')
        }
        
        if (costChartRef.current) {
          console.log('📍 Observing Cost chart')
          observer.observe(costChartRef.current)
        } else {
          console.warn('⚠️ Cost chart ref not found')
        }
      })
    }

    // Call immediately - requestAnimationFrame will handle timing
    observeCharts()

    return () => {
      observer.disconnect()
    }
  }, [activeTab, usageStats, hasTop5Animated, hasUsageAnimated, hasCostAnimated])

  // Reset animation states when switching to activity tab
  useEffect(() => {
    if (activeTab === 'activity') {
      // Reset animation flags but keep progress at 0 initially
      setHasTop5Animated(false)
      setHasUsageAnimated(false)
      setHasCostAnimated(false)
      setTop5AnimationProgress(0)
      setUsageAnimationProgress(0)
      setCostAnimationProgress(0)
    }
  }, [activeTab])

  const updateSetting = async (path: string, value: any) => {
    if (!user?.id) {
      console.warn('⚠️ No user ID, cannot save settings')
      return
    }

    console.log('[ModelSettings] Updating setting:', path, 'for user:', user.id)
    console.log('[ModelSettings] Value:', JSON.stringify(value, null, 2))

    try {
      // Update settings in backend
      const updated = await userSettingsService.update(user.id, path, value)
      console.log('[ModelSettings] ✅ Setting updated successfully')
      setSettings(updated)
    } catch (error) {
      console.error('[ModelSettings] ❌ Failed to update setting:', error)
      throw error
    }
  }

  const handleFetchModels = async () => {
    // Check if user is logged in
    if (!user?.id) {
      setFetchError('Please sign in to fetch models')
      return
    }

    if (!newApiKey.trim()) {
      setFetchError('Please enter an API key')
      return
    }

    setIsFetching(true)
    setFetchError('')
    setFetchedModels([])

    try {
      const { fetchAllModelsFromProvider } = await import('@/utils/providerApis')
      const models = await fetchAllModelsFromProvider(newApiKey.trim())
      setFetchedModels(models)
      setSelectedModelIds(new Set())
      
      // Save API key to backend database after successful validation
      if (models.length > 0) {
        const provider = models[0].provider // Get provider from first model
        console.log('🔑 Attempting to save API key for provider:', provider)
        try {
          // Get current user from auth context
          const currentUser = user
          console.log('👤 Current user:', currentUser?.id)
          
          if (currentUser) {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'
            console.log('🌐 API URL:', apiUrl)
            console.log('📤 Sending POST request to:', `${apiUrl}/api/user/api-keys`)
            
            const response = await fetch(`${apiUrl}/api/user/api-keys`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-id': currentUser.id
              },
              body: JSON.stringify({
                provider: provider,
                apiKey: newApiKey.trim()
              })
            })
            
            console.log('📥 Response status:', response.status)
            
            if (!response.ok) {
              const errorText = await response.text()
              console.error('❌ Failed to save API key to database:', errorText)
            } else {
              const result = await response.json()
              console.log('✅ API key saved to database for provider:', provider, result)
              
              // Store the API key ID for use with models
              if (result.keyId) {
                // Store keyId in a state variable so handleImportModels can use it
                (window as any).__lastApiKeyId = result.keyId
              }
            }
          } else {
            console.warn('⚠️ No user found, cannot save API key')
          }
        } catch (saveError) {
          console.error('💥 Error saving API key to database:', saveError)
          // Don't fail the whole operation if database save fails
        }
      } else {
        console.warn('⚠️ No models fetched, skipping API key save')
      }
    } catch (error: any) {
      setFetchError(error.message || 'Failed to fetch models')
    } finally {
      setIsFetching(false)
    }
  }

  const handleToggleModelSelection = (modelId: string) => {
    setSelectedModelIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(modelId)) {
        newSet.delete(modelId)
      } else {
        newSet.add(modelId)
      }
      return newSet
    })
  }

  const handleImportModels = async () => {
    console.log('[ModelSettings] handleImportModels called')
    console.log('[ModelSettings] User ID:', user?.id)
    console.log('[ModelSettings] Selected model IDs:', Array.from(selectedModelIds))
    
    // Check if user is logged in
    if (!user?.id) {
      console.error('[ModelSettings] No user ID, cannot import models')
      setTestStatus('error')
      setErrorMessage('Please sign in to import models')
      return
    }

    if (selectedModelIds.size === 0) {
      console.warn('[ModelSettings] No models selected')
      return
    }

    setIsAdding(true)
    setTestStatus('testing')
    setErrorMessage('')

    try {
      const newModels: ModelConfig[] = []
      const apiKeyId = (window as any).__lastApiKeyId // Get the stored API key ID
      
      console.log('[ModelSettings] API Key ID:', apiKeyId)
      console.log('[ModelSettings] API Key:', newApiKey.substring(0, 20) + '...')
      
      for (const modelId of selectedModelIds) {
        const model = fetchedModels.find(m => m.id === modelId)
        if (!model) {
          console.warn('[ModelSettings] Model not found:', modelId)
          continue
        }

        console.log('[ModelSettings] Creating config for model:', model.id)

        const modelConfig: ModelConfig = {
          id: model.id,
          name: model.name,
          apiKey: newApiKey.trim(),
          apiKeyId: apiKeyId, // Store the API key ID with the model
          visible: true,
          addedAt: Date.now(),
          provider: model.provider,
          contextLength: model.contextLength,
          maxOutputTokens: model.maxOutputTokens,
          pricing: model.pricing,
          description: model.description,
          parameters: model.parameters,
          capabilities: model.capabilities
        }

        newModels.push(modelConfig)
      }

      console.log('[ModelSettings] New models to add:', newModels.length)
      console.log('[ModelSettings] Existing models:', settings.models.configuredModels.length)

      const updatedModels = [...settings.models.configuredModels, ...newModels]
      console.log('[ModelSettings] Total models after update:', updatedModels.length)
      
      await updateSetting('models.configuredModels', updatedModels)

      console.log('[ModelSettings] ✅ Models imported successfully')
      setTestStatus('success')
      setErrorMessage(`Successfully imported ${newModels.length} model${newModels.length > 1 ? 's' : ''}`)
      
      // Clear the stored API key ID
      delete (window as any).__lastApiKeyId
      
      setTimeout(() => {
        setTestStatus('idle')
        setNewApiKey('')
        setFetchedModels([])
        setSelectedModelIds(new Set())
        setModelSearchQuery('')
        setActiveTab('configured')
      }, 1500)
    } catch (error: any) {
      console.error('[ModelSettings] ❌ Failed to import models:', error)
      setTestStatus('error')
      setErrorMessage(error.message || 'Failed to import models')
    } finally {
      setIsAdding(false)
    }
  }

  const handleAddModel = async () => {
    if (!newModelName.trim() || !newApiKey.trim()) {
      setErrorMessage('Please enter both model name and API key')
      setTestStatus('error')
      return
    }

    setIsAdding(true)
    setTestStatus('testing')
    setErrorMessage('')

    try {
      const { enrichModelWithProviderData } = await import('@/utils/providerApis')
      
      const newModel: ModelConfig = {
        id: `custom-${Date.now()}`,
        name: newModelName.trim(),
        apiKey: newApiKey.trim(),
        visible: true,
        addedAt: Date.now()
      }

      // Fetch provider data using the API key
      const enrichedModel = await enrichModelWithProviderData(newModel)

      const updatedModels = [...settings.models.configuredModels, enrichedModel]
      await updateSetting('models.configuredModels', updatedModels)

      setTestStatus('success')
      setNewModelName('')
      setNewApiKey('')
      
      setTimeout(() => {
        setTestStatus('idle')
        setActiveTab('configured')
      }, 1500)
    } catch (error: any) {
      setTestStatus('error')
      setErrorMessage(error.message || 'Failed to add model')
    } finally {
      setIsAdding(false)
    }
  }

  const handleDeleteModel = async (modelId: string) => {
    const updatedModels = settings.models.configuredModels.filter(m => m.id !== modelId)
    await updateSetting('models.configuredModels', updatedModels)

    if (settings.models.defaultModel === modelId) {
      await updateSetting('models.defaultModel', updatedModels[0]?.id || '')
    }
    if (selectedModelId === modelId) {
      setSelectedModelId(updatedModels[0]?.id || null)
    }
  }

  const handleToggleVisibility = async (modelId: string) => {
    const updatedModels = settings.models.configuredModels.map(m =>
      m.id === modelId ? { ...m, visible: !m.visible } : m
    )
    await updateSetting('models.configuredModels', updatedModels)
  }

  const handleSetDefault = async (modelId: string) => {
    await updateSetting('models.defaultModel', modelId)
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event('settings-updated'))
  }

  const selectedModel = settings.models.configuredModels.find(m => m.id === selectedModelId)

  // Only show Add Model tab if user is logged in
  const tabs = user?.id 
    ? [
        { id: 'add' as ModelTab, label: 'Add Model', icon: Plus },
        { id: 'configured' as ModelTab, label: 'Configured Models', icon: null },
        { id: 'activity' as ModelTab, label: 'Activity', icon: Activity },
      ]
    : [
        { id: 'configured' as ModelTab, label: 'Configured Models', icon: null },
        { id: 'activity' as ModelTab, label: 'Activity', icon: Activity },
      ]

  // If not logged in and on Add Model tab, switch to Configured Models
  React.useEffect(() => {
    if (!user?.id && activeTab === 'add') {
      setActiveTab('configured')
    }
  }, [user?.id, activeTab])

  return (
    <div className="flex flex-col min-h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white mb-2">Models & API</h2>
        <p className="text-zinc-400">Configure AI model settings and API credentials</p>
      </div>

      {/* Horizontal Navigation Tabs */}
      <div className="border-b border-zinc-800 flex-shrink-0">
        <nav className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === tab.id
                    ? 'border-zinc-500 text-white'
                    : 'border-transparent text-zinc-400 hover:text-white'
                  }
                `}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 mt-6">
        {/* Add Model Tab */}
        {activeTab === 'add' && (
          <div className="flex gap-4 h-full">
            {/* Left Column - API Key Input */}
            <div className="w-96 flex-shrink-0 border-r border-zinc-800 pr-4">
              <h3 className="text-lg font-medium text-white mb-4">Add New Model</h3>
              
              {/* Authentication Warning */}
              {!user?.id && (
                <div className="mb-4 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                  <p className="text-sm text-yellow-400">
                    Please sign in to fetch and add models
                  </p>
                </div>
              )}
              
              <div className="space-y-4 p-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <div>
                  <Label htmlFor="api-key" className="text-sm font-medium text-white">
                    API Key
                  </Label>
                  <div className="relative mt-2">
                    <Input
                      id="api-key"
                      type={showApiKey ? 'text' : 'password'}
                      value={newApiKey}
                      onChange={(e) => {
                        setNewApiKey(e.target.value)
                        setFetchError('')
                      }}
                      placeholder="Enter your API key..."
                      className="bg-zinc-900 border-zinc-700 text-white pr-10"
                      disabled={!user?.id}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                      disabled={!user?.id}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  onClick={handleFetchModels}
                  disabled={isFetching || !newApiKey.trim() || !user?.id}
                  className="w-full bg-[#27272A] hover:bg-zinc-800 text-white disabled:bg-zinc-700"
                >
                  {isFetching && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isFetching ? 'Fetch Models' : 'Fetch Models'}
                </Button>

                {fetchError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <XCircle className="w-4 h-4" />
                    <span>{fetchError}</span>
                  </div>
                )}

                {fetchedModels.length > 0 && (
                  <div className="pt-4 border-t border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-zinc-400">
                        {selectedModelIds.size} selected
                      </span>
                    </div>

                    {testStatus === 'error' && errorMessage && (
                      <div className="flex items-center gap-2 text-red-400 text-sm mb-3">
                        <XCircle className="w-4 h-4" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    {testStatus === 'success' && errorMessage && (
                      <div className="flex items-center gap-2 text-green-400 text-sm mb-3">
                        <CheckCircle className="w-4 h-4" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    <Button
                      onClick={handleImportModels}
                      disabled={isAdding || selectedModelIds.size === 0}
                      className="w-full bg-[#27272A] hover:bg-zinc-800 text-white disabled:bg-zinc-700"
                    >
                      {isAdding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {isAdding ? 'Importing...' : `Import ${selectedModelIds.size} Model${selectedModelIds.size !== 1 ? 's' : ''}`}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Available Models */}
            <div className="flex-1 overflow-y-auto relative z-0">
              {fetchedModels.length > 0 ? (
                <div className="space-y-4 relative z-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-medium text-white">
                      Available Models ({fetchedModels.length})
                    </h4>
                  </div>

                  <div className="relative z-10 px-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 z-10" />
                    <Input
                      type="text"
                      placeholder="Search models..."
                      value={modelSearchQuery}
                      onChange={(e) => setModelSearchQuery(e.target.value)}
                      className="pl-10 bg-zinc-900 border-zinc-700 text-white relative z-10"
                    />
                  </div>

                  <ModelImportList
                    models={fetchedModels}
                    selectedIds={selectedModelIds}
                    onToggleSelection={handleToggleModelSelection}
                    searchQuery={modelSearchQuery}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-400">
                  <div className="text-center">
                    <p className="text-lg mb-2">No models fetched yet</p>
                    <p className="text-sm">Enter an API key and click "Fetch Models" to get started</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Configured Models Tab */}
        {activeTab === 'configured' && (
          <div className="flex gap-0 model-settings-container h-full relative">
            {/* Left Column - Models List (Sticky) */}
            <div 
              className="flex-shrink-0 pr-4 flex flex-col sticky top-0 self-start"
              style={{ width: `${leftColumnWidth}px`, maxHeight: '100vh' }}
            >
              <h3 className="text-sm font-medium text-zinc-400 mb-3 px-2 uppercase tracking-wider flex-shrink-0">Your Models</h3>
              
              {/* Search Bar */}
              <div className="relative mb-3 flex-shrink-0">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none z-10" />
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-zinc-900 border-zinc-700 text-white text-sm w-full"
                  style={{ minWidth: '0' }}
                />
              </div>

              <div className="flex-1 overflow-y-auto">
                {!isLoaded ? (
                  <div className="text-center py-8 text-zinc-400 text-sm">
                    Loading...
                  </div>
                ) : settings.models.configuredModels.length === 0 ? (
                  <div className="text-center py-8 text-zinc-400 text-sm">
                    No models yet
                  </div>
                ) : (
                  <div className="space-y-1">
                    {settings.models.configuredModels
                      .filter(model => 
                        model?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        model?.id?.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModelId(model.id)}
                      className={`
                        w-full text-left px-3 py-2 rounded-lg transition-colors
                        ${selectedModelId === model.id
                          ? 'bg-[#27272A] text-white'
                          : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{model.name}</span>
                        {settings.models.defaultModel === model.id && (
                          <span className="text-xs bg-[#27272A] text-white px-1.5 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                    {settings.models.configuredModels.filter(model => 
                      model?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      model?.id?.toLowerCase().includes(searchQuery.toLowerCase())
                    ).length === 0 && (
                      <div className="text-center py-8 text-zinc-400 text-sm">
                        No models found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Left Draggable Divider */}
            <div
              className="w-px cursor-col-resize hover:bg-zinc-500 transition-colors flex-shrink-0 sticky top-0 self-start bg-zinc-800"
              onMouseDown={handleLeftMouseDown}
              style={{ 
                backgroundColor: isResizingLeft ? '#71717a' : '#27272a',
                height: '100vh'
              }}
            />

            {/* Center Column - Model Details (Scrollable) */}
            <div 
              className="flex-shrink-0 overflow-y-auto px-4 border-r border-zinc-800"
              style={{ width: `${centerColumnWidth}px` }}
            >
              {selectedModel ? (
                <div className="space-y-6">
                  {/* Model Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-white">{selectedModel.name}</h3>
                      <p className="text-sm text-zinc-400 mt-1">
                        {selectedModel.apiKey 
                          ? `API Key: ${selectedModel.apiKey.substring(0, 8)}...${selectedModel.apiKey.substring(selectedModel.apiKey.length - 4)}`
                          : 'No API key configured'
                        }
                      </p>
                    </div>
                    <Button
                      onClick={() => handleDeleteModel(selectedModel.id)}
                      size="sm"
                      variant="ghost"
                      className="text-white hover:text-zinc-300 hover:bg-zinc-700"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>

                  <Separator className="bg-zinc-800" />

                  {/* Provider Info */}
                  <section>
                    <h4 className="text-sm font-medium text-white mb-3">Provider Information</h4>
                    <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-zinc-400">Provider</span>
                        <span className="text-sm text-white font-medium">
                          {selectedModel.provider || 'Unknown'}
                        </span>
                      </div>
                      {selectedModel.contextLength && (
                        <div className="flex justify-between">
                          <span className="text-sm text-zinc-400">Context Length</span>
                          <span className="text-sm text-white font-medium">
                            {selectedModel.contextLength.toLocaleString()} tokens
                          </span>
                        </div>
                      )}
                      {selectedModel.maxOutputTokens && (
                        <div className="flex justify-between">
                          <span className="text-sm text-zinc-400">Max Output Tokens</span>
                          <span className="text-sm text-white font-medium">
                            {selectedModel.maxOutputTokens.toLocaleString()} tokens
                          </span>
                        </div>
                      )}
                      {selectedModel.pricing && (
                        <div className="flex justify-between">
                          <span className="text-sm text-zinc-400">Pricing</span>
                          <span className="text-sm text-white font-medium">
                            ${parseFloat(selectedModel.pricing.prompt).toFixed(2)} / 
                            ${parseFloat(selectedModel.pricing.completion).toFixed(2)} per 1M
                          </span>
                        </div>
                      )}
                      
                      {/* Provider Pricing */}
                      {selectedModel.pricing && (
                        <div className="pt-2 border-t border-zinc-800">
                          <div className="mb-2">
                            <span className="text-xs text-zinc-400 block mb-1">Provider Pricing</span>
                            <p className="text-xs text-zinc-500">Cost per token from model provider</p>
                          </div>
                          
                          <div className="space-y-2">
                            <div>
                              <Label className="text-xs text-zinc-400">
                                Prompt ($ per 1M tokens)
                              </Label>
                              <div className="h-8 px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-md text-white text-xs flex items-center">
                                {selectedModel.pricing.prompt ? parseFloat(selectedModel.pricing.prompt).toFixed(2) : "0.00"}
                              </div>
                            </div>
                            
                            <div>
                              <Label className="text-xs text-zinc-400">
                                Completion ($ per 1M tokens)
                              </Label>
                              <div className="h-8 px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-md text-white text-xs flex items-center">
                                {selectedModel.pricing.completion ? parseFloat(selectedModel.pricing.completion).toFixed(2) : "0.00"}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {selectedModel.description && (
                        <div className="pt-2 border-t border-zinc-800">
                          <span className="text-xs text-zinc-400 block mb-1">Description</span>
                          <p className="text-sm text-zinc-300">{selectedModel.description}</p>
                        </div>
                      )}
                      <div className="pt-2 border-t border-zinc-800">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-400">Visibility</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-zinc-300">
                              {selectedModel.visible ? 'Visible' : 'Hidden'}
                            </span>
                            <Switch
                              checked={selectedModel.visible}
                              onCheckedChange={() => handleToggleVisibility(selectedModel.id)}
                              className="data-[state=checked]:bg-white"
                            />
                          </div>
                        </div>
                      </div>
                      {settings.models.defaultModel !== selectedModel.id && (
                        <Button
                          onClick={() => handleSetDefault(selectedModel.id)}
                          size="sm"
                          variant="outline"
                          className="w-full mt-2"
                        >
                          Set as Default Model
                        </Button>
                      )}
                      {selectedModel.apiKey && (
                        <Button
                          onClick={async () => {
                            const { enrichModelWithProviderData } = await import('@/utils/providerApis')
                            const enriched = await enrichModelWithProviderData(selectedModel)
                            
                            // Update the model in settings
                            const updatedModels = settings.models.configuredModels.map(m =>
                              m.id === selectedModel.id ? enriched : m
                            )
                            await updateSetting('models.configuredModels', updatedModels)
                          }}
                          size="sm"
                          variant="outline"
                          className="w-full mt-2"
                        >
                          Refresh from Provider API
                        </Button>
                      )}
                    </div>
                  </section>

                  <Separator className="bg-zinc-800" />

                  {/* Model Parameters */}
                  <section>
                    <h4 className="text-sm font-medium text-white mb-3">Parameters</h4>
                    <div className="space-y-4">
                      <ModelParametersSection
                        modelParameters={selectedModel.parameters}
                      />
                    </div>
                  </section>

                  <Separator className="bg-zinc-800" />

                  {/* Diagnostics */}
                  <ModelDiagnostics model={selectedModel} />

                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-400">
                  Select a model to view details
                </div>
              )}
            </div>

            {/* Center Draggable Divider */}
            <div
              className="w-1 cursor-col-resize hover:bg-zinc-500 transition-colors flex-shrink-0"
              onMouseDown={handleCenterMouseDown}
              style={{ 
                backgroundColor: isResizingCenter ? '#71717a' : 'transparent',
              }}
            />

            {/* Right Column - Activity (Fixed with internal scroll) */}
            <div className="flex-1 px-4 flex flex-col overflow-hidden">
              {selectedModel ? (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex-shrink-0">
                    <h4 className="text-sm font-medium text-zinc-400 mb-2 uppercase tracking-wider">Activity</h4>
                    <p className="text-xs text-zinc-400 mb-4">Last 30 days for {selectedModel.name}</p>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto">
                    {isLoadingModelUsage ? (
                      <div className="flex items-center justify-center h-48">
                        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                      </div>
                    ) : !modelUsageStats || modelUsageStats.totalRequests === 0 ? (
                      <div className="p-8 bg-zinc-900/50 rounded-lg border border-zinc-800 text-center">
                        <p className="text-sm text-zinc-400">No usage data yet</p>
                        <p className="text-xs text-zinc-500 mt-1">Start using this model to see activity</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Activity Chart */}
                        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 overflow-visible">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-4 text-xs flex-wrap">
                            <div className="flex items-center gap-2">
                              <svg width="24" height="12" className="flex-shrink-0">
                                <path d="M 0 6 Q 6 6, 12 6 Q 18 6, 24 6" fill="none" stroke="rgb(255, 255, 255)" strokeWidth="3" strokeLinecap="round" />
                              </svg>
                              <span className="text-zinc-400">Total tokens</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <svg width="24" height="12" className="flex-shrink-0">
                                <path d="M 0 6 Q 6 6, 12 6 Q 18 6, 24 6" fill="none" stroke="rgb(156, 163, 175)" strokeWidth="2.5" strokeLinecap="round" />
                              </svg>
                              <span className="text-zinc-400">Prompt tokens</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <svg width="24" height="12" className="flex-shrink-0">
                                <path d="M 0 6 Q 6 6, 12 6 Q 18 6, 24 6" fill="none" stroke="rgb(234, 179, 8)" strokeWidth="2.5" strokeLinecap="round" />
                              </svg>
                              <span className="text-zinc-400">Completion tokens</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <svg width="24" height="12" className="flex-shrink-0">
                                <path d="M 0 6 Q 6 6, 12 6 Q 18 6, 24 6" fill="none" stroke="rgb(59, 130, 246)" strokeWidth="2.5" strokeLinecap="round" />
                              </svg>
                              <span className="text-zinc-400">Reasoning tokens</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Chart */}
                        <div className="relative overflow-visible">
                          {(() => {
                            const dates = Object.keys(modelUsageStats.byDay).sort()
                            const displayDates = dates
                            
                            if (dates.length === 0) return <div className="text-zinc-500 text-center py-8">No data yet</div>
                            
                            const maxTokens = Math.max(...dates.map(date => modelUsageStats.byDay[date].totalTokens), 1)
                            
                            const getNiceScale = (max: number) => {
                              const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
                              const normalized = max / magnitude;
                              
                              let multiplier;
                              if (normalized <= 1) multiplier = 1;
                              else if (normalized <= 1.25) multiplier = 1.25;
                              else if (normalized <= 1.5) multiplier = 1.5;
                              else if (normalized <= 2) multiplier = 2;
                              else if (normalized <= 2.5) multiplier = 2.5;
                              else if (normalized <= 5) multiplier = 5;
                              else if (normalized <= 7.5) multiplier = 7.5;
                              else multiplier = 10;
                              
                              const baseScale = multiplier * magnitude;
                              // Add 43% headroom (multiply by 1.43) so max bar reaches ~70% height
                              return baseScale * 1.43;
                            };
                            
                            const scale = getNiceScale(maxTokens);
                            
                            return (
                              <>
                                {/* Y-axis labels */}
                                <div className="absolute left-0 top-0 bottom-8 w-16 flex flex-col justify-between text-xs text-zinc-500 text-right pr-3">
                                  {[scale, scale * 0.75, scale * 0.5, scale * 0.25, 0].map((value, i) => (
                                    <div key={i} className="font-mono">
                                      {value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : Math.round(value)}
                                    </div>
                                  ))}
                                </div>
                                
                                {/* Chart area */}
                                <div className="ml-20">
                                  <div 
                                    ref={modelChartRef}
                                    className="relative h-48 cursor-crosshair overflow-visible"
                                    onMouseMove={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                                      setModelMousePosition({ x, y });
                                    }}
                                    onMouseLeave={() => {
                                      setModelMousePosition(null);
                                      setModelHoveredDataIndex(null);
                                      setModelTooltipPosition(null);
                                    }}
                                  >
                                    {/* Grid lines */}
                                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                      {[0, 1, 2, 3, 4].map((i) => (
                                        <div key={i} className="w-full border-t border-zinc-800/50"></div>
                                      ))}
                                    </div>
                                    
                                    {/* Crosshair */}
                                    {modelMousePosition && (
                                      <div className="absolute inset-0 pointer-events-none">
                                        <div
                                          className="absolute top-0 bottom-0 w-px"
                                          style={{ 
                                            left: `${modelMousePosition.x}%`,
                                            background: 'repeating-linear-gradient(to bottom, rgb(156, 163, 175) 0px, rgb(156, 163, 175) 4px, transparent 4px, transparent 8px)'
                                          }}
                                        />
                                        <div
                                          className="absolute left-0 right-0 h-px"
                                          style={{ 
                                            top: `${modelMousePosition.y}%`,
                                            background: 'repeating-linear-gradient(to right, rgb(156, 163, 175) 0px, rgb(156, 163, 175) 4px, transparent 4px, transparent 8px)'
                                          }}
                                        />
                                      </div>
                                    )}
                                    
                                    {/* Line chart */}
                                    <div className="absolute inset-0 overflow-hidden">
                                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'hidden' }}>
                                        {(() => {
                                          // Time-based positioning: points are positioned based on actual time values
                                          const getTimeBasedXPosition = (dateStr: string) => {
                                            if (displayDates.length === 1) return 50;
                                            
                                            const firstDate = new Date(displayDates[0]).getTime();
                                            const lastDate = new Date(displayDates[displayDates.length - 1]).getTime();
                                            const currentDate = new Date(dateStr).getTime();
                                            
                                            const padding = 5;
                                            const usableWidth = 100 - (padding * 2);
                                            
                                            // Calculate position based on time proportion
                                            const timeRatio = (currentDate - firstDate) / (lastDate - firstDate);
                                            return padding + timeRatio * usableWidth;
                                          };
                                          
                                          if (displayDates.length <= 1) return null;
                                          
                                          const createSmoothPath = (points: Array<{x: number, y: number}>) => {
                                            if (points.length < 2) return '';
                                            let path = `M ${points[0].x} ${points[0].y}`;
                                            for (let i = 0; i < points.length - 1; i++) {
                                              const current = points[i];
                                              const next = points[i + 1];
                                              const midX = (current.x + next.x) / 2;
                                              path += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
                                            }
                                            return path;
                                          };
                                          
                                          return (
                                            <>
                                              {/* Prompt tokens line (silver) */}
                                              <path
                                                d={createSmoothPath(displayDates.map((date) => {
                                                  const dayData = modelUsageStats.byDay[date];
                                                  const promptHeight = (dayData.promptTokens / scale) * 100;
                                                  const x = getTimeBasedXPosition(date);
                                                  return { x, y: 100 - promptHeight };
                                                }))}
                                                fill="none"
                                                stroke="rgb(156, 163, 175)"
                                                strokeWidth="0.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                style={{ opacity: 0.7 }}
                                              />
                                              
                                              {/* Completion tokens line (yellow) */}
                                              <path
                                                d={createSmoothPath(displayDates.map((date) => {
                                                  const dayData = modelUsageStats.byDay[date];
                                                  const completionHeight = (dayData.completionTokens / scale) * 100;
                                                  const x = getTimeBasedXPosition(date);
                                                  return { x, y: 100 - completionHeight };
                                                }))}
                                                fill="none"
                                                stroke="rgb(234, 179, 8)"
                                                strokeWidth="0.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                style={{ opacity: 0.7 }}
                                              />
                                              
                                              {/* Reasoning tokens line (blue) */}
                                              {displayDates.some(date => modelUsageStats.byDay[date].reasoningTokens > 0) && (
                                                <path
                                                  d={createSmoothPath(displayDates.map((date) => {
                                                    const dayData = modelUsageStats.byDay[date];
                                                    const reasoningHeight = (dayData.reasoningTokens / scale) * 100;
                                                    const x = getTimeBasedXPosition(date);
                                                    return { x, y: 100 - reasoningHeight };
                                                  }))}
                                                  fill="none"
                                                  stroke="rgb(59, 130, 246)"
                                                  strokeWidth="0.5"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  style={{ opacity: 0.7 }}
                                                />
                                              )}
                                              
                                              {/* Total tokens line (white) */}
                                              <path
                                                d={createSmoothPath(displayDates.map((date) => {
                                                  const dayData = modelUsageStats.byDay[date];
                                                  const totalHeight = ((dayData.promptTokens + dayData.reasoningTokens + dayData.completionTokens) / scale) * 100;
                                                  const x = getTimeBasedXPosition(date);
                                                  return { x, y: 100 - totalHeight };
                                                }))}
                                                fill="none"
                                                stroke="rgb(255, 255, 255)"
                                                strokeWidth="0.8"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                              />
                                            </>
                                          );
                                        })()}
                                      </svg>
                                      
                                      {/* Vertical hover zones - full height invisible bars for each data point */}
                                      <div className="absolute inset-0 pointer-events-none">
                                        {displayDates.map((date, i) => {
                                          // Time-based positioning
                                          const getTimeBasedXPosition = (dateStr: string) => {
                                            if (displayDates.length === 1) return 50;
                                            
                                            const firstDate = new Date(displayDates[0]).getTime();
                                            const lastDate = new Date(displayDates[displayDates.length - 1]).getTime();
                                            const currentDate = new Date(dateStr).getTime();
                                            
                                            const padding = 5;
                                            const usableWidth = 100 - (padding * 2);
                                            
                                            const timeRatio = (currentDate - firstDate) / (lastDate - firstDate);
                                            return padding + timeRatio * usableWidth;
                                          };
                                          
                                          const xPercent = getTimeBasedXPosition(date);
                                          
                                          // Calculate width of hover zone based on spacing between points
                                          // Very wide zones for easy hovering and tooltip display - 150% of spacing, max 30%
                                          const spacing = displayDates.length > 1 ? 90 / (displayDates.length - 1) : 90;
                                          const hoverWidth = Math.min(spacing * 1.5, 30); // 150% of spacing, max 30%
                                          
                                          return (
                                            <div
                                              key={`hover-zone-${date}`}
                                              className="absolute pointer-events-auto cursor-pointer"
                                              style={{
                                                left: `${xPercent}%`,
                                                top: 0,
                                                bottom: 0,
                                                width: `${hoverWidth}%`,
                                                transform: 'translateX(-50%)',
                                                zIndex: 10
                                              }}
                                              onMouseEnter={() => setModelHoveredDataIndex(i)}
                                              onMouseMove={(e) => {
                                                setModelTooltipPosition({ x: e.clientX, y: e.clientY });
                                              }}
                                              onMouseLeave={() => {
                                                setModelHoveredDataIndex(null);
                                                setModelTooltipPosition(null);
                                              }}
                                            />
                                          );
                                        })}
                                      </div>
                                      
                                      {/* Dots and labels */}
                                      <div className="absolute inset-0 pointer-events-none">
                                        {displayDates.map((date, i) => {
                                          const dayData = modelUsageStats.byDay[date];
                                          const totalHeight = ((dayData.promptTokens + dayData.reasoningTokens + dayData.completionTokens) / scale) * 100;
                                          
                                          // Time-based positioning
                                          const getTimeBasedXPosition = (dateStr: string) => {
                                            if (displayDates.length === 1) return 50;
                                            
                                            const firstDate = new Date(displayDates[0]).getTime();
                                            const lastDate = new Date(displayDates[displayDates.length - 1]).getTime();
                                            const currentDate = new Date(dateStr).getTime();
                                            
                                            const padding = 5;
                                            const usableWidth = 100 - (padding * 2);
                                            
                                            const timeRatio = (currentDate - firstDate) / (lastDate - firstDate);
                                            return padding + timeRatio * usableWidth;
                                          };
                                          
                                          const xPercent = getTimeBasedXPosition(date);
                                          const yPercent = 100 - totalHeight;
                                          
                                          const formatValue = (val: number) => {
                                            if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
                                            return val.toString();
                                          };
                                          
                                          return (
                                            <div
                                              key={`dot-${date}`}
                                              className="absolute pointer-events-none"
                                              style={{
                                                left: `${xPercent}%`,
                                                top: `${yPercent}%`,
                                                transform: 'translate(-50%, -50%)',
                                                zIndex: modelHoveredDataIndex === i ? 100000 : 1
                                              }}
                                            >
                                              <div
                                                className="w-2.5 h-2.5 rounded-full cursor-pointer transition-all hover:scale-125"
                                                style={{
                                                  backgroundColor: 'rgb(255, 255, 255)',
                                                  border: '1.5px solid rgb(200, 200, 200)',
                                                  boxShadow: modelHoveredDataIndex === i ? '0 0 12px rgba(255, 255, 255, 1)' : '0 0 4px rgba(255, 255, 255, 0.6)'
                                                }}
                                              />
                                              
                                              {/* Value label - hide only when THIS dot is hovered */}
                                              {modelHoveredDataIndex !== i && (
                                                <div
                                                  className="absolute whitespace-nowrap text-[11px] font-bold text-white pointer-events-none"
                                                  style={{
                                                    left: '50%',
                                                    bottom: '100%',
                                                    transform: 'translateX(-50%)',
                                                    marginBottom: '6px',
                                                    textShadow: '0 0 4px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.7)'
                                                  }}
                                                >
                                                  {formatValue(dayData.totalTokens)}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      
                                      {/* Dimming circles overlay - above dots */}
                                      {isVisible && modelHoveredDataIndex !== null && (
                                        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
                                          {displayDates.map((date, i) => {
                                            if (modelHoveredDataIndex === i) return null;
                                            
                                            const dayData = modelUsageStats.byDay[date];
                                            const totalHeight = ((dayData.promptTokens + dayData.reasoningTokens + dayData.completionTokens) / scale) * 100;
                                            
                                            // Time-based positioning
                                            const getTimeBasedXPosition = (dateStr: string) => {
                                              if (displayDates.length === 1) return 50;
                                              
                                              const firstDate = new Date(displayDates[0]).getTime();
                                              const lastDate = new Date(displayDates[displayDates.length - 1]).getTime();
                                              const currentDate = new Date(dateStr).getTime();
                                              
                                              const padding = 5;
                                              const usableWidth = 100 - (padding * 2);
                                              
                                              const timeRatio = (currentDate - firstDate) / (lastDate - firstDate);
                                              return padding + timeRatio * usableWidth;
                                            };
                                            
                                            const xPercent = getTimeBasedXPosition(date);
                                            const yPercent = 100 - totalHeight;
                                            
                                            return (
                                              <div
                                                key={`dim-circle-${i}`}
                                                className="absolute"
                                                style={{
                                                  left: `${xPercent}%`,
                                                  top: `${yPercent}%`,
                                                  transform: 'translate(-50%, -50%)'
                                                }}
                                              >
                                                <div
                                                  className="w-2.5 h-2.5 rounded-full"
                                                  style={{
                                                    backgroundColor: 'rgb(24, 24, 27)',
                                                    opacity: 0.4
                                                  }}
                                                />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Tooltip */}
                                    {isVisible && modelHoveredDataIndex !== null && modelHoveredDataIndex >= 0 && modelTooltipPosition && typeof window !== 'undefined' && createPortal(
                                      (() => {
                                        const i = modelHoveredDataIndex;
                                        const date = displayDates[i];
                                        const dayData = modelUsageStats.byDay[date];
                                        
                                        const formatTooltipDate = (dateStr: string) => {
                                          const d = new Date(dateStr);
                                          const month = d.toLocaleDateString('en-US', { month: 'short' });
                                          const day = d.getDate();
                                          const year = d.getFullYear();
                                          return `${month} ${day}, ${year}`;
                                        };
                                        
                                        // Calculate the data point's screen position
                                        const chartContainer = modelChartRef.current;
                                        if (!chartContainer) return null;
                                        
                                        const chartRect = chartContainer.getBoundingClientRect();
                                        
                                        // Time-based positioning
                                        const getTimeBasedXPosition = (dateStr: string) => {
                                          if (displayDates.length === 1) return 50;
                                          
                                          const firstDate = new Date(displayDates[0]).getTime();
                                          const lastDate = new Date(displayDates[displayDates.length - 1]).getTime();
                                          const currentDate = new Date(dateStr).getTime();
                                          
                                          const padding = 5;
                                          const usableWidth = 100 - (padding * 2);
                                          
                                          const timeRatio = (currentDate - firstDate) / (lastDate - firstDate);
                                          return padding + timeRatio * usableWidth;
                                        };
                                        
                                        const totalHeight = ((dayData.promptTokens + dayData.reasoningTokens + dayData.completionTokens) / scale) * 100;
                                        const xPercent = getTimeBasedXPosition(date);
                                        const yPercent = 100 - totalHeight;
                                        
                                        // Calculate actual screen position of the data point
                                        let screenX = chartRect.left + (xPercent / 100) * chartRect.width;
                                        let screenY = chartRect.top + (yPercent / 100) * chartRect.height;
                                        
                                        // Add subtle offset based on cursor position (max 20px in any direction)
                                        if (modelTooltipPosition) {
                                          const offsetX = Math.max(-20, Math.min(20, (modelTooltipPosition.x - screenX) * 0.3));
                                          const offsetY = Math.max(-20, Math.min(20, (modelTooltipPosition.y - screenY) * 0.3));
                                          screenX += offsetX;
                                          screenY += offsetY;
                                        }
                                        
                                        // Smart tooltip positioning based on viewport position
                                        const viewportWidth = window.innerWidth;
                                        const viewportHeight = window.innerHeight;
                                        
                                        const isNearTop = screenY < 200;
                                        const isNearBottom = screenY > viewportHeight - 200;
                                        const isNearLeft = screenX < 200;
                                        const isNearRight = screenX > viewportWidth - 200;
                                        
                                        let tooltipStyle: React.CSSProperties = {
                                          position: 'fixed',
                                          zIndex: 99999,
                                          pointerEvents: 'none'
                                        };
                                        
                                        // Default: above and centered
                                        tooltipStyle.left = `${screenX}px`;
                                        tooltipStyle.top = `${screenY}px`;
                                        tooltipStyle.transform = 'translate(-50%, calc(-100% - 12px))';
                                        
                                        // Adjust if near edges
                                        if (isNearTop && !isNearBottom) {
                                          // Show below
                                          tooltipStyle.transform = 'translate(-50%, 12px)';
                                        }
                                        
                                        if (isNearLeft && !isNearRight) {
                                          // Show to the right
                                          tooltipStyle.transform = isNearTop 
                                            ? 'translate(12px, 12px)' 
                                            : 'translate(12px, calc(-100% - 12px))';
                                        } else if (isNearRight && !isNearLeft) {
                                          // Show to the left
                                          tooltipStyle.transform = isNearTop 
                                            ? 'translate(calc(-100% - 12px), 12px)' 
                                            : 'translate(calc(-100% - 12px), calc(-100% - 12px))';
                                        }
                                        
                                        return (
                                          <div 
                                            className="fixed pointer-events-none"
                                            style={tooltipStyle}
                                          >
                                            <div className="bg-zinc-800 rounded-lg p-3 text-xs whitespace-nowrap border border-zinc-700" style={{ boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)' }}>
                                              <div className="font-medium text-white mb-2">
                                                {formatTooltipDate(date)}
                                              </div>
                                              <div className="space-y-1.5">
                                                <div className="flex items-center justify-between gap-6">
                                                  <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded" style={{ backgroundColor: 'rgb(156, 163, 175)' }}></div>
                                                    <span className="text-zinc-400">Prompt:</span>
                                                  </div>
                                                  <span className="text-white font-medium">{dayData.promptTokens.toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-6">
                                                  <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded" style={{ backgroundColor: 'rgb(59, 130, 246)' }}></div>
                                                    <span style={{ color: 'rgb(59, 130, 246)' }}>Reasoning:</span>
                                                  </div>
                                                  <span className="text-white font-medium">{dayData.reasoningTokens.toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-6">
                                                  <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded" style={{ backgroundColor: 'rgb(234, 179, 8)' }}></div>
                                                    <span style={{ color: 'rgb(234, 179, 8)' }}>Completion:</span>
                                                  </div>
                                                  <span className="text-white font-medium">{dayData.completionTokens.toLocaleString()}</span>
                                                </div>
                                                <div className="border-t border-zinc-700 pt-1.5 mt-1.5">
                                                  <div className="flex items-center justify-between gap-6">
                                                    <span className="text-white">Total:</span>
                                                    <span className="text-white font-semibold">{dayData.totalTokens.toLocaleString()}</span>
                                                  </div>
                                                  <div className="flex items-center justify-between gap-6 mt-1">
                                                    <span className="text-zinc-400">Requests:</span>
                                                    <span className="text-white font-medium">{dayData.requests}</span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })(),
                                      document.body
                                    )}
                                  </div>
                                  
                                  {/* X-axis date labels */}
                                  <div className="relative h-6 mt-2 overflow-hidden">
                                    {(() => {
                                      // Time-based positioning: dates are positioned based on actual time values
                                      // This ensures proper alignment even with gaps in data
                                      const getTimeBasedXPosition = (dateStr: string) => {
                                        if (displayDates.length === 1) return 50;
                                        
                                        const firstDate = new Date(displayDates[0]).getTime();
                                        const lastDate = new Date(displayDates[displayDates.length - 1]).getTime();
                                        const currentDate = new Date(dateStr).getTime();
                                        
                                        const padding = 5;
                                        const usableWidth = 100 - (padding * 2);
                                        
                                        // Calculate position based on time proportion
                                        const timeRatio = (currentDate - firstDate) / (lastDate - firstDate);
                                        return padding + timeRatio * usableWidth;
                                      };
                                      
                                      return displayDates.map((date, i) => {
                                        const xPercent = getTimeBasedXPosition(date);
                                        
                                        // Dynamic label density based on zoom level
                                        // At 1x zoom: show every 2nd label if >7 points
                                        // At 2x zoom: show every label if >7 points
                                        // At 4x+ zoom: show all labels
                                        let skipInterval = 1;
                                        if (displayDates.length > 7) {
                                          if (zoomLevel < 2) {
                                            skipInterval = 2; // Show every 2nd
                                          } else if (zoomLevel < 4) {
                                            skipInterval = 1; // Show all
                                          } else {
                                            skipInterval = 1; // Show all at high zoom
                                          }
                                        }
                                        
                                        const shouldShow = i % skipInterval === 0;
                                        
                                        if (!shouldShow) return null;
                                        
                                        // Format date - always show just the date for cleaner display
                                        const formatDate = (dateStr: string) => {
                                          const d = new Date(dateStr);
                                          return d.toLocaleDateString('en-US', { 
                                            month: 'short', 
                                            day: 'numeric' 
                                          });
                                        };
                                        
                                        return (
                                          <div
                                            key={`label-${date}`}
                                            className="absolute text-[10px] text-zinc-500 whitespace-nowrap"
                                            style={{
                                              left: `${xPercent}%`,
                                              transform: `translateX(-50%) scaleX(${1 / zoomLevel})`,
                                              top: 0
                                            }}
                                          >
                                            {formatDate(date)}
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Activity Stats */}
                      <div className="space-y-3">
                        <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                          <div className="text-xs text-zinc-400 mb-1">Total Requests (30d)</div>
                          <div className="text-xl font-semibold text-white">{modelUsageStats.totalRequests.toLocaleString()}</div>
                        </div>
                        <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                          <div className="text-xs text-zinc-400 mb-1">Total Tokens (30d)</div>
                          <div className="text-xl font-semibold text-white">
                            {modelUsageStats.totalTokens >= 1000000 
                              ? `${(modelUsageStats.totalTokens / 1000000).toFixed(2)}M`
                              : modelUsageStats.totalTokens >= 1000
                              ? `${(modelUsageStats.totalTokens / 1000).toFixed(1)}K`
                              : modelUsageStats.totalTokens.toLocaleString()
                            }
                          </div>
                        </div>
                        <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                          <div className="text-xs text-zinc-400 mb-1">Estimated Cost (30d)</div>
                          <div className="text-xl font-semibold text-white">${modelUsageStats.totalCost.toFixed(4)}</div>
                        </div>
                      </div>

                      {/* Token Breakdown */}
                      <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                        <div className="text-xs font-medium text-white mb-3">Token Breakdown</div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgb(156, 163, 175)' }}></div>
                              <span className="text-xs text-zinc-400">Prompt</span>
                            </div>
                            <span className="text-xs text-white font-medium">
                              {modelUsageStats.promptTokens.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgb(234, 179, 8)' }}></div>
                              <span className="text-xs text-zinc-400">Completion</span>
                            </div>
                            <span className="text-xs text-white font-medium">
                              {modelUsageStats.completionTokens.toLocaleString()}
                            </span>
                          </div>
                          {modelUsageStats.reasoningTokens > 0 && (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgb(59, 130, 246)' }}></div>
                                <span className="text-xs text-zinc-400">Reasoning</span>
                              </div>
                              <span className="text-xs text-white font-medium">
                                {modelUsageStats.reasoningTokens.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
                  Select a model
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="space-y-6 pr-2 pt-4 pb-8" style={{ overflow: 'visible' }}>
            <div>
              <h3 className="text-lg font-medium text-white mb-2">Recent Activity</h3>
              <p className="text-sm text-zinc-400">Total usage across all models</p>
            </div>
            
            {isLoadingUsage ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
              </div>
            ) : usageError ? (
              <div className="flex items-center justify-center h-64 text-zinc-400">
                {usageError}
              </div>
            ) : !usageStats || usageStats.totalRequests === 0 ? (
              <div className="flex items-center justify-center h-64 text-zinc-400">
                <div className="text-center">
                  <p className="text-sm">No usage data available</p>
                  <p className="text-xs text-zinc-500 mt-2">
                    Start using your models to see activity
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Backdrop when maximized */}
                {isMaximized && (
                  <div 
                    className="fixed inset-0 bg-black/90 z-40"
                    onClick={() => setIsMaximized(false)}
                  />
                )}
                
                {/* Activity Chart */}
                <div className={`bg-zinc-900 rounded-lg border border-zinc-800 p-6 transition-all overflow-visible ${isMaximized ? 'fixed inset-4 z-50 overflow-auto' : ''}`}>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-white mb-2">Token Usage Over Time</h4>
                      <div className="flex items-center gap-4 text-xs flex-wrap">
                        <div className="flex items-center gap-2">
                          <svg width="24" height="12" className="flex-shrink-0">
                            <path d="M 0 6 Q 6 6, 12 6 Q 18 6, 24 6" fill="none" stroke="rgb(255, 255, 255)" strokeWidth="3" strokeLinecap="round" />
                          </svg>
                          <span className="text-zinc-400">Total tokens</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg width="24" height="12" className="flex-shrink-0">
                            <path d="M 0 6 Q 6 6, 12 6 Q 18 6, 24 6" fill="none" stroke="rgb(156, 163, 175)" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                          <span className="text-zinc-400">Prompt tokens</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg width="24" height="12" className="flex-shrink-0">
                            <path d="M 0 6 Q 6 6, 12 6 Q 18 6, 24 6" fill="none" stroke="rgb(234, 179, 8)" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                          <span className="text-zinc-400">Completion tokens</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg width="24" height="12" className="flex-shrink-0">
                            <path d="M 0 6 Q 6 6, 12 6 Q 18 6, 24 6" fill="none" stroke="rgb(59, 130, 246)" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                          <span className="text-zinc-400">Reasoning tokens</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Chart Controls */}
                    <div className="flex items-center gap-2">
                      {/* Zoom Controls */}
                      <div className="flex items-center gap-1 bg-zinc-800 rounded px-2 h-8">
                        <button
                          onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
                          className="text-zinc-400 hover:text-white transition-colors px-2 text-sm"
                          title="Zoom Out"
                        >
                          −
                        </button>
                        <span className="text-xs text-zinc-400 min-w-[3rem] text-center">
                          {Math.round(zoomLevel * 100)}%
                        </span>
                        <button
                          onClick={() => setZoomLevel(Math.min(20, zoomLevel + 0.25))}
                          className="text-zinc-400 hover:text-white transition-colors px-2 text-sm"
                          title="Zoom In"
                        >
                          +
                        </button>
                      </div>
                      
                      {/* Reset Button */}
                      <button
                        onClick={() => {
                          setZoomLevel(1);
                          setPanOffset(0);
                        }}
                        className="text-zinc-400 hover:text-white transition-colors px-3 h-8 text-xs bg-zinc-800 rounded"
                        title="Reset View"
                      >
                        Reset
                      </button>
                      
                      {/* Maximize Button */}
                      <button
                        onClick={() => setIsMaximized(!isMaximized)}
                        className="text-zinc-400 hover:text-white transition-colors px-3 h-8 text-base bg-zinc-800 rounded"
                        title={isMaximized ? "Minimize" : "Maximize"}
                      >
                        {isMaximized ? "✕" : "⛶"}
                      </button>
                    </div>
                  </div>
                  
                  {/* Bar Chart with Values */}
                  <div className="relative">
                    {(() => {
                      // Calculate scale ONCE for the entire chart
                      const dates = Object.keys(usageStats.byDay).sort();
                      
                      console.log('🎨 RENDERING CHART:', {
                        totalDates: dates.length,
                        allDates: dates,
                        byDayKeys: Object.keys(usageStats.byDay),
                        byDayData: usageStats.byDay,
                        byDayByModel: usageStats.byDayByModel,
                        hasModelData: !!usageStats.byDayByModel
                      });
                      
                      if (dates.length === 0) return <div className="text-zinc-500 text-center py-8">No data yet</div>;
                      
                      // Show all data points - panning will allow viewing all history
                      const displayDates = dates;
                      // Calculate max from all data
                      const maxTokens = Math.max(...displayDates.map(date => usageStats.byDay[date].totalTokens), 1);
                      
                      console.log('📊 Chart data:', {
                        totalDates: dates.length,
                        displayDates: displayDates.length,
                        dates: displayDates,
                        maxTokens,
                        dataPoints: displayDates.map(date => ({
                          date,
                          tokens: usageStats.byDay[date].totalTokens
                        }))
                      });
                      
                      // Smart scaling: round up to nice numbers but stay close to max
                      // Add 33% headroom so bars don't exceed 75% of chart height
                      // Y-axis scale is FIXED - not affected by zoom
                      const getNiceScale = (max: number) => {
                        const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
                        const normalized = max / magnitude;
                        
                        let multiplier;
                        if (normalized <= 1) multiplier = 1;
                        else if (normalized <= 1.25) multiplier = 1.25;
                        else if (normalized <= 1.5) multiplier = 1.5;
                        else if (normalized <= 2) multiplier = 2;
                        else if (normalized <= 2.5) multiplier = 2.5;
                        else if (normalized <= 5) multiplier = 5;
                        else if (normalized <= 7.5) multiplier = 7.5;
                        else multiplier = 10;
                        
                        const baseScale = multiplier * magnitude;
                        // Add 33% headroom (multiply by 1.33) so max bar reaches ~75% height
                        return baseScale * 1.33;
                      };
                      
                      const scale = getNiceScale(maxTokens);
                      
                      console.log('📊 Chart scale:', { maxTokens, scale, ratio: maxTokens / scale });
                      
                      return (
                        <>
                          {/* Y-axis labels */}
                          <div className="absolute left-0 top-0 bottom-8 w-16 flex flex-col justify-between text-xs text-zinc-500 text-right pr-3">
                            {[scale, scale * 0.75, scale * 0.5, scale * 0.25, 0].map((value, i) => (
                              <div key={i} className="font-mono">
                                {value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : Math.round(value)}
                              </div>
                            ))}
                          </div>
                          
                          {/* Chart area */}
                          <div className="ml-20">
                            <div 
                              className={`relative overflow-x-hidden overflow-y-visible ${isPanning ? 'cursor-grabbing' : 'cursor-grab'} ${isMaximized ? 'h-[calc(100vh-16rem)]' : 'h-64'}`}
                              onMouseDown={(e) => {
                                if (e.button === 0) { // Left click - allow panning at any zoom level
                                  setIsPanning(true);
                                  setPanStartX(e.clientX);
                                  // Hide tooltip while panning
                                  setHoveredDataIndex(null);
                                }
                              }}
                              onWheel={(e) => {
                                // Prevent browser zoom (Ctrl+Wheel) and page scroll
                                if (e.ctrlKey || e.metaKey) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }
                                e.preventDefault();
                                e.stopPropagation();
                                
                                // Get cursor position relative to chart
                                const rect = e.currentTarget.getBoundingClientRect();
                                const cursorX = ((e.clientX - rect.left) / rect.width) * 100; // 0-100%
                                
                                // Calculate zoom change
                                const delta = e.deltaY > 0 ? -0.1 : 0.1; // Scroll down = zoom out, scroll up = zoom in
                                const oldZoom = zoomLevel;
                                const newZoom = Math.max(0.5, Math.min(20, zoomLevel + delta));
                                
                                if (newZoom !== oldZoom) {
                                  // Adjust pan offset to keep cursor position stable
                                  // The cursor should point to the same data point before and after zoom
                                  const zoomRatio = newZoom / oldZoom;
                                  const cursorOffset = (cursorX - 50) / 50; // Normalize to -1 to 1 (center is 0)
                                  const panAdjustment = panOffset * (zoomRatio - 1) * cursorOffset;
                                  
                                  // Pan limit scales with zoom: at 2x zoom, you can pan ±100%, at 4x zoom ±200%, etc.
                                  const maxPan = 50 * newZoom;
                                  
                                  setZoomLevel(newZoom);
                                  setPanOffset(prev => Math.max(-maxPan, Math.min(maxPan, prev + panAdjustment)));
                                }
                                
                                return false;
                              }}
                              onMouseMove={(e) => {
                                if (isPanning) {
                                  const deltaX = e.clientX - panStartX;
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const panDelta = (deltaX / rect.width) * 100;
                                  
                                  // Pan limit scales with zoom level
                                  const maxPan = 50 * zoomLevel;
                                  
                                  setPanOffset(prev => Math.max(-maxPan, Math.min(maxPan, prev + panDelta)));
                                  setPanStartX(e.clientX);
                                  return;
                                }
                                
                                // Always show crosshair and update position
                                const rect = e.currentTarget.getBoundingClientRect();
                                const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
                                const y = ((e.clientY - rect.top) / rect.height) * 100;
                                setMousePosition({ x: mouseX, y });
                              }}
                              onMouseUp={() => setIsPanning(false)}
                              onMouseLeave={() => {
                                setIsPanning(false);
                                setMousePosition(null);
                                setHoveredDataIndex(null);
                              }}
                            >
                              {/* Grid lines */}
                              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                {[0, 1, 2, 3, 4].map((i) => (
                                  <div key={i} className="w-full border-t border-zinc-800/50"></div>
                                ))}
                              </div>
                              
                              {/* Crosshair */}
                              {/* Crosshair with dashed lines */}
                              {mousePosition && (
                                <div className="absolute inset-0 pointer-events-none">
                                  {/* Vertical dashed line */}
                                  <div
                                    className="absolute top-0 bottom-0 w-px"
                                    style={{ 
                                      left: `${mousePosition.x}%`,
                                      background: 'repeating-linear-gradient(to bottom, rgb(156, 163, 175) 0px, rgb(156, 163, 175) 4px, transparent 4px, transparent 8px)'
                                    }}
                                  />
                                  {/* Horizontal dashed line */}
                                  <div
                                    className="absolute left-0 right-0 h-px"
                                    style={{ 
                                      top: `${mousePosition.y}%`,
                                      background: 'repeating-linear-gradient(to right, rgb(156, 163, 175) 0px, rgb(156, 163, 175) 4px, transparent 4px, transparent 8px)'
                                    }}
                                  />
                                </div>
                              )}
                              
                              {/* Line chart - container scales with zoom */}
                              <div 
                                className="absolute inset-0 overflow-hidden activity-chart-container"
                                style={{
                                  transform: `scaleX(${zoomLevel}) translateX(${panOffset}%)`,
                                  transformOrigin: 'left center'
                                }}
                              >
                                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'hidden' }}>
                                  <defs>
                                    <clipPath id="line-reveal-clip">
                                      <rect x="0" y="0" width={lineAnimationProgress * 100} height="100" />
                                    </clipPath>
                                  </defs>
                                  {(() => {
                                    // Calculate X position - spread evenly across full width
                                    const getXPosition = (index: number, total: number) => {
                                      if (total === 1) return 50; // Center single point
                                      // Add padding on edges (5% on each side) and spread evenly
                                      const padding = 5;
                                      const usableWidth = 100 - (padding * 2);
                                      return padding + (index / (total - 1)) * usableWidth;
                                    };
                                  
                                  return (
                                    <>
                                      {/* Draw smooth curved lines connecting points */}
                                      {(() => {
                                        console.log('🎨 Line rendering:', {
                                          displayDatesLength: displayDates.length,
                                          willDrawLines: displayDates.length > 1,
                                          samplePoints: displayDates.slice(0, 3).map((date, i) => ({
                                            date,
                                            x: getXPosition(i, displayDates.length),
                                            totalTokens: usageStats.byDay[date].totalTokens
                                          }))
                                        });
                                        
                                        if (displayDates.length <= 1) {
                                          return null;
                                        }
                                        
                                        // Helper function to create smooth curve path
                                        const createSmoothPath = (points: Array<{x: number, y: number}>) => {
                                          if (points.length < 2) return '';
                                          
                                          let path = `M ${points[0].x} ${points[0].y}`;
                                          
                                          for (let i = 0; i < points.length - 1; i++) {
                                            const current = points[i];
                                            const next = points[i + 1];
                                            
                                            // Calculate control points for smooth curve
                                            const midX = (current.x + next.x) / 2;
                                            
                                            // Use cubic bezier curve for smoothness
                                            path += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
                                          }
                                          
                                          console.log('📈 Path created:', path.substring(0, 100) + '...');
                                          return path;
                                        };
                                        
                                        return (
                                          <>
                                            {/* Prompt tokens line (silver) */}
                                            <path
                                              d={createSmoothPath(displayDates.map((date, i) => {
                                                const dayData = usageStats.byDay[date];
                                                const promptHeight = (dayData.promptTokens / scale) * 100;
                                                const x = getXPosition(i, displayDates.length);
                                                const y = 100 - promptHeight;
                                                return { x, y };
                                              }))}
                                              fill="none"
                                              stroke="rgb(156, 163, 175)"
                                              strokeWidth="0.5"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              className="transition-all"
                                              style={{ opacity: 0.7 }}
                                              clipPath="url(#line-reveal-clip)"
                                            />
                                          
                                          {/* Completion tokens line (yellow) */}
                                          <path
                                            d={createSmoothPath(displayDates.map((date, i) => {
                                              const dayData = usageStats.byDay[date];
                                              const completionHeight = (dayData.completionTokens / scale) * 100;
                                              const x = getXPosition(i, displayDates.length);
                                              const y = 100 - completionHeight;
                                              return { x, y };
                                            }))}
                                            fill="none"
                                            stroke="rgb(234, 179, 8)"
                                            strokeWidth="0.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="transition-all"
                                            style={{ opacity: 0.7 }}
                                            clipPath="url(#line-reveal-clip)"
                                          />
                                          
                                          {/* Reasoning tokens line (blue) - if any */}
                                          {displayDates.some(date => usageStats.byDay[date].reasoningTokens > 0) && (
                                            <path
                                              d={createSmoothPath(displayDates.map((date, i) => {
                                                const dayData = usageStats.byDay[date];
                                                const reasoningHeight = (dayData.reasoningTokens / scale) * 100;
                                                const x = getXPosition(i, displayDates.length);
                                                const y = 100 - reasoningHeight;
                                                return { x, y };
                                              }))}
                                              fill="none"
                                              stroke="rgb(59, 130, 246)"
                                              strokeWidth="0.5"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              className="transition-all"
                                              style={{ opacity: 0.7 }}
                                              clipPath="url(#line-reveal-clip)"
                                            />
                                          )}
                                          
                                          {/* Total tokens line (white - main line, drawn last so it's on top) */}
                                          <path
                                            d={createSmoothPath(displayDates.map((date, i) => {
                                              const dayData = usageStats.byDay[date];
                                              const totalHeight = ((dayData.promptTokens + dayData.reasoningTokens + dayData.completionTokens) / scale) * 100;
                                              const x = getXPosition(i, displayDates.length);
                                              const y = 100 - totalHeight;
                                              return { x, y };
                                            }))}
                                            fill="none"
                                            stroke="rgb(255, 255, 255)"
                                            strokeWidth="0.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="transition-all"
                                            clipPath="url(#line-reveal-clip)"
                                          />
                                        </>
                                      );
                                      })()}
                                    </>
                                  );
                                })()}
                              </svg>
                              
                              {/* Vertical hover zones - full height invisible bars for each data point */}
                              <div className="absolute inset-0 pointer-events-none">
                                {displayDates.map((date, i) => {
                                  const getXPosition = (index: number, total: number) => {
                                    if (total === 1) return 50;
                                    const padding = 5;
                                    const usableWidth = 100 - (padding * 2);
                                    return padding + (index / (total - 1)) * usableWidth;
                                  };
                                  
                                  const xPercent = getXPosition(i, displayDates.length);
                                  
                                  // Calculate width of hover zone based on spacing between points
                                  // Comfortable zones with good breathing room - 85% of spacing
                                  const spacing = displayDates.length > 1 ? 90 / (displayDates.length - 1) : 90;
                                  const hoverWidth = spacing * 0.85; // 85% of spacing, nice gaps
                                  
                                  return (
                                    <div
                                      key={`hover-zone-${date}`}
                                      className="absolute pointer-events-auto cursor-pointer"
                                      style={{
                                        left: `${xPercent}%`,
                                        top: 0,
                                        bottom: 0,
                                        width: `${hoverWidth}%`,
                                        transform: `translateX(-50%)`,
                                        zIndex: 10
                                      }}
                                      onMouseEnter={() => setHoveredDataIndex(i)}
                                      onMouseMove={(e) => {
                                        setTooltipMousePosition({ x: e.clientX, y: e.clientY });
                                      }}
                                      onMouseLeave={() => {
                                        setHoveredDataIndex(null);
                                        setTooltipMousePosition(null);
                                      }}
                                    />
                                  );
                                })}
                              </div>
                              
                              {/* Dots and labels layer - HTML elements maintain proper aspect ratio */}
                              <div className="absolute inset-0 pointer-events-none">
                                {displayDates.map((date, i) => {
                                  const dayData = usageStats.byDay[date];
                                  const totalHeight = ((dayData.promptTokens + dayData.reasoningTokens + dayData.completionTokens) / scale) * 100;
                                  
                                  const getXPosition = (index: number, total: number) => {
                                    if (total === 1) return 50;
                                    const padding = 5;
                                    const usableWidth = 100 - (padding * 2);
                                    return padding + (index / (total - 1)) * usableWidth;
                                  };
                                  
                                  const xPercent = getXPosition(i, displayDates.length);
                                  const yPercent = 100 - totalHeight;
                                  
                                  const formatValue = (val: number) => {
                                    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
                                    return val.toString();
                                  };
                                  
                                  // Get model names for this date point
                                  // Only show if we have byDayByModel data for this specific date
                                  const modelsAtPoint = usageStats.byDayByModel?.[date] 
                                    ? Object.keys(usageStats.byDayByModel[date]).filter(modelId => 
                                        usageStats.byDayByModel[date][modelId].totalTokens > 0
                                      )
                                    : [];
                                  
                                  // Calculate if this dot should be visible based on animation progress
                                  const dotProgress = (xPercent / 100);
                                  const isVisible = lineAnimationProgress >= dotProgress;
                                  const dotOpacity = isVisible ? 1 : 0;
                                  const dotScale = isVisible ? 1 : 0.5;
                                  
                                  return (
                                    <div
                                      key={`dot-${date}`}
                                      className="absolute pointer-events-auto"
                                      style={{
                                        left: `${xPercent}%`,
                                        top: `${yPercent}%`,
                                        transform: `translate(-50%, -50%) scaleX(${1 / zoomLevel})`,
                                        zIndex: hoveredDataIndex === i ? 100000 : 1,
                                        opacity: dotOpacity,
                                        transition: 'opacity 0.2s ease-out, transform 0.2s ease-out'
                                      }}
                                      onMouseEnter={() => {
                                        setHoveredDataIndex(i);
                                      }}
                                      onMouseMove={(e) => {
                                        setTooltipMousePosition({ x: e.clientX, y: e.clientY });
                                      }}
                                      onMouseLeave={() => {
                                        setHoveredDataIndex(null);
                                        setTooltipMousePosition(null);
                                      }}
                                    >
                                      {/* Dot */}
                                      <div
                                        className="w-2.5 h-2.5 rounded-full cursor-pointer transition-all hover:scale-125"
                                        style={{
                                          backgroundColor: 'rgb(255, 255, 255)',
                                          border: '1.5px solid rgb(200, 200, 200)',
                                          boxShadow: '0 0 4px rgba(255, 255, 255, 0.6)',
                                          transform: `scale(${dotScale})`
                                        }}
                                      />
                                      
                                      {/* Value label - show fewer labels as zoom decreases */}
                                      {hoveredDataIndex !== i &&
                                        (() => {
                                          // Calculate how many labels to skip based on zoom level
                                          // At 430% (4.3x) or higher: show all labels (skip 0)
                                          // Below 430%: show progressively fewer labels
                                          let skipInterval = 1 // Show every Nth label

                                          if (zoomLevel >= 4.3) {
                                            skipInterval = 1 // Show all
                                          } else if (zoomLevel >= 3.0) {
                                            skipInterval = 2 // Show every 2nd
                                          } else if (zoomLevel >= 2.0) {
                                            skipInterval = 3 // Show every 3rd
                                          } else if (zoomLevel >= 1.5) {
                                            skipInterval = 5 // Show every 5th
                                          } else {
                                            skipInterval = 10 // Show every 10th
                                          }

                                          // Only show this label if its index is a multiple of skipInterval
                                          if (i % skipInterval !== 0) return null

                                          return (
                                            <div
                                              className="absolute whitespace-nowrap text-[11px] font-bold text-white pointer-events-none"
                                              style={{
                                                left: '50%',
                                                bottom: '100%',
                                                transform: 'translateX(-50%)',
                                                marginBottom: '6px',
                                                textShadow: '0 0 4px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.7)'
                                              }}
                                            >
                                              {formatValue(dayData.totalTokens)}
                                            </div>
                                          )
                                        })()}
                                      
                                      {/* Tooltip - positioned relative to viewport */}
                                      {isVisible && hoveredDataIndex === i && (() => {
                                        // Calculate screen position from chart position (data point position)
                                        const chartContainer = document.querySelector('.activity-chart-container');
                                        if (!chartContainer) return null;
                                        
                                        const chartRect = chartContainer.getBoundingClientRect();
                                        
                                        // Calculate the actual screen position of the dot
                                        // Account for zoom and pan transformations
                                        const transformedX = (xPercent / 100) * chartRect.width;
                                        let screenX = chartRect.left + transformedX;
                                        let screenY = chartRect.top + (yPercent / 100) * chartRect.height;
                                        
                                        // Add subtle offset based on cursor position (max 20px in any direction)
                                        if (tooltipMousePosition) {
                                          const offsetX = Math.max(-20, Math.min(20, (tooltipMousePosition.x - screenX) * 0.3));
                                          const offsetY = Math.max(-20, Math.min(20, (tooltipMousePosition.y - screenY) * 0.3));
                                          screenX += offsetX;
                                          screenY += offsetY;
                                        }
                                        
                                        const formatTooltipDate = (dateStr: string) => {
                                            // Handle different date formats
                                            let d: Date;
                                            try {
                                              // Handle incomplete ISO formats (hour grouping: "2026-01-01T03")
                                              let fullDateStr = dateStr;
                                              if (/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(dateStr)) {
                                                // Hour format: add minutes and seconds
                                                fullDateStr = dateStr + ':00:00';
                                              } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateStr)) {
                                                // Minute format: add seconds
                                                fullDateStr = dateStr + ':00';
                                              } else if (/^\d{4}-\d{2}$/.test(dateStr)) {
                                                // Month format: add day
                                                fullDateStr = dateStr + '-01';
                                              }
                                              
                                              d = new Date(fullDateStr);
                                              // Check if date is valid
                                              if (isNaN(d.getTime())) {
                                                console.error('Invalid date:', dateStr, 'converted to:', fullDateStr);
                                                return dateStr; // Return original string if invalid
                                              }
                                            } catch (e) {
                                              console.error('Error parsing date:', dateStr, e);
                                              return dateStr;
                                            }
                                            
                                            const firstDate = new Date(displayDates[0]);
                                            const lastDate = new Date(displayDates[displayDates.length - 1]);
                                            const timeRangeMs = lastDate.getTime() - firstDate.getTime();
                                            
                                            const MINUTE = 60 * 1000;
                                            const HOUR = 60 * MINUTE;
                                            const DAY = 24 * HOUR;
                                            const WEEK = 7 * DAY;
                                            
                                            // Professional format with bullet separator: "Jan 23, 2026 • 11:45:30 PM"
                                            const month = d.toLocaleDateString('en-US', { month: 'short' });
                                            const day = d.getDate();
                                            const year = d.getFullYear();
                                            const time = d.toLocaleTimeString('en-US', { 
                                              hour: 'numeric',
                                              minute: '2-digit',
                                              second: '2-digit',
                                              hour12: true
                                            });
                                            return `${month} ${day}, ${year} • ${time}`;
                                          };
                                          
                                          // Get models used at this specific date
                                          const modelsAtThisDate = usageStats.byDayByModel?.[date] 
                                            ? Object.keys(usageStats.byDayByModel[date])
                                                .filter(modelId => usageStats.byDayByModel[date][modelId].totalTokens > 0)
                                                .map(modelId => {
                                                  // Sanitize the model ID first
                                                  const sanitizedId = sanitizeModelId(modelId);
                                                  // Find the friendly name from configured models
                                                  const model = settings.models.configuredModels.find(m => m.id === sanitizedId);
                                                  return model?.name || sanitizedId;
                                                })
                                            : [];
                                          
                                          // Smart tooltip positioning based on viewport position
                                          const viewportWidth = window.innerWidth;
                                          const viewportHeight = window.innerHeight;
                                          
                                          const isNearTop = screenY < 200;
                                          const isNearBottom = screenY > viewportHeight - 200;
                                          const isNearLeft = screenX < 200;
                                          const isNearRight = screenX > viewportWidth - 200;
                                          
                                          let tooltipStyle: React.CSSProperties = {
                                            position: 'fixed',
                                            zIndex: 99999,
                                            pointerEvents: 'none'
                                          };
                                          
                                          // Default: above and centered
                                          tooltipStyle.left = `${screenX}px`;
                                          tooltipStyle.top = `${screenY}px`;
                                          tooltipStyle.transform = 'translate(-50%, calc(-100% - 12px))';
                                          
                                          // Adjust based on position
                                          if (isNearTop) {
                                            if (isNearLeft) {
                                              tooltipStyle.transform = 'translate(12px, -50%)';
                                            } else if (isNearRight) {
                                              tooltipStyle.transform = 'translate(calc(-100% - 12px), -50%)';
                                            } else {
                                              tooltipStyle.transform = 'translate(-50%, 12px)';
                                            }
                                          } else if (isNearBottom) {
                                            tooltipStyle.transform = 'translate(-50%, calc(-100% - 12px))';
                                          } else if (isNearLeft) {
                                            tooltipStyle.transform = 'translate(12px, -50%)';
                                          } else if (isNearRight) {
                                            tooltipStyle.transform = 'translate(calc(-100% - 12px), -50%)';
                                          }
                                          
                                          return createPortal(
                                            <div style={tooltipStyle}>
                                              <div className="bg-zinc-800 rounded-lg p-3 text-xs whitespace-nowrap border border-zinc-700" style={{ boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)' }}>
                                                {/* Model name(s) at the top - ALWAYS show */}
                                                <div className="mb-2 pb-2 border-b border-zinc-700">
                                                  <div className="font-semibold text-white text-sm">
                                                    {modelsAtThisDate.length > 0 ? modelsAtThisDate.join(', ') : 'No model data'}
                                                  </div>
                                                </div>
                                                
                                                <div className="font-medium text-zinc-400 mb-2">
                                                  {formatTooltipDate(date)}
                                                </div>
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between gap-6">
                                                      <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded" style={{ backgroundColor: 'rgb(156, 163, 175)' }}></div>
                                                        <span className="text-zinc-400">Prompt:</span>
                                                      </div>
                                                      <span className="text-white font-medium">{dayData.promptTokens.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-6">
                                                      <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded" style={{ backgroundColor: 'rgb(59, 130, 246)' }}></div>
                                                        <span style={{ color: 'rgb(59, 130, 246)' }}>Reasoning:</span>
                                                      </div>
                                                      <span className="text-white font-medium">{dayData.reasoningTokens.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-6">
                                                      <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded" style={{ backgroundColor: 'rgb(234, 179, 8)' }}></div>
                                                        <span style={{ color: 'rgb(234, 179, 8)' }}>Completion:</span>
                                                      </div>
                                                      <span className="text-white font-medium">{dayData.completionTokens.toLocaleString()}</span>
                                                    </div>
                                                    <div className="border-t border-zinc-700 pt-1.5 mt-1.5">
                                                      <div className="flex items-center justify-between gap-6">
                                                        <span className="text-white">Total:</span>
                                                        <span className="text-white font-semibold">{dayData.totalTokens.toLocaleString()}</span>
                                                      </div>
                                                      <div className="flex items-center justify-between gap-6 mt-1">
                                                        <span className="text-zinc-400">Requests:</span>
                                                        <span className="text-white font-medium">{dayData.requests}</span>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>,
                                            document.body
                                          );
                                        })()}
                                    </div>
                                  );
                                })}
                              </div>
                              
                              {/* Dimming circles overlay - inside zoomed container, above dots */}
                              {isVisible && hoveredDataIndex !== null && (
                                <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
                                  {displayDates.map((date, i) => {
                                    if (hoveredDataIndex === i) return null;
                                    
                                    const dayData = usageStats.byDay[date];
                                    const totalHeight = ((dayData.promptTokens + dayData.reasoningTokens + dayData.completionTokens) / scale) * 100;
                                    
                                    const getXPosition = (index: number, total: number) => {
                                      if (total === 1) return 50;
                                      const padding = 5;
                                      const usableWidth = 100 - (padding * 2);
                                      return padding + (index / (total - 1)) * usableWidth;
                                    };
                                    
                                    const xPercent = getXPosition(i, displayDates.length);
                                    const yPercent = 100 - totalHeight;
                                    
                                    return (
                                      <div
                                        key={`dim-circle-${i}`}
                                        className="absolute"
                                        style={{
                                          left: `${xPercent}%`,
                                          top: `${yPercent}%`,
                                          transform: `translate(-50%, -50%) scaleX(${1 / zoomLevel})`
                                        }}
                                      >
                                        <div
                                          className="w-2.5 h-2.5 rounded-full"
                                          style={{
                                            backgroundColor: 'rgb(24, 24, 27)',
                                            opacity: 0.4
                                          }}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            </div>
                            
                            {/* X-axis labels */}
                            <div className="relative mt-3 text-xs text-zinc-500 pt-2 overflow-hidden" style={{ height: '20px' }}>
                              <div 
                                style={{
                                  transform: `scaleX(${zoomLevel}) translateX(${panOffset}%)`,
                                  transformOrigin: 'left center',
                                  position: 'absolute',
                                  inset: 0
                                }}
                              >
                              {(() => {
                                // Helper function to parse incomplete date formats
                                const parseDate = (dateStr: string): Date => {
                                  let fullDateStr = dateStr;
                                  if (/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(dateStr)) {
                                    fullDateStr = dateStr + ':00:00';
                                  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateStr)) {
                                    fullDateStr = dateStr + ':00';
                                  } else if (/^\d{4}-\d{2}$/.test(dateStr)) {
                                    fullDateStr = dateStr + '-01';
                                  }
                                  return new Date(fullDateStr);
                                };
                                
                                // Calculate time range to determine appropriate scale
                                const firstDate = parseDate(displayDates[0]);
                                const lastDate = parseDate(displayDates[displayDates.length - 1]);
                                const timeRangeMs = lastDate.getTime() - firstDate.getTime();
                                
                                // Time constants
                                const SECOND = 1000;
                                const MINUTE = 60 * SECOND;
                                const HOUR = 60 * MINUTE;
                                const DAY = 24 * HOUR;
                                const WEEK = 7 * DAY;
                                const MONTH = 30 * DAY;
                                
                                // Determine format based on time range - always include time when available
                                let formatDate: (date: Date) => string;
                                
                                if (timeRangeMs < 2 * MINUTE) {
                                  // Very short range: show full timestamp
                                  formatDate = (date) => date.toLocaleString('en-US', { 
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit', 
                                    minute: '2-digit', 
                                    second: '2-digit',
                                    hour12: false
                                  });
                                } else if (timeRangeMs < 2 * HOUR) {
                                  // Short range: show date with hours and minutes
                                  formatDate = (date) => date.toLocaleString('en-US', { 
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    hour12: false
                                  });
                                } else if (timeRangeMs < 2 * DAY) {
                                  // Medium range: show date with time
                                  formatDate = (date) => date.toLocaleString('en-US', { 
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric', 
                                    minute: '2-digit',
                                    hour12: true 
                                  });
                                } else if (timeRangeMs < 2 * WEEK) {
                                  // Week range: show weekday and time
                                  formatDate = (date) => date.toLocaleString('en-US', { 
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  });
                                } else if (timeRangeMs < 2 * MONTH) {
                                  // Month range: show date with time
                                  formatDate = (date) => date.toLocaleString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  });
                                } else if (timeRangeMs < 365 * DAY) {
                                  // Year range: show date with time
                                  formatDate = (date) => date.toLocaleString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  });
                                } else {
                                  // Long range: show date with time
                                  formatDate = (date) => date.toLocaleString('en-US', { 
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  });
                                }
                                
                                // Calculate X position - same as dots
                                const getXPosition = (index: number, total: number) => {
                                  if (total === 1) return 50;
                                  const padding = 5;
                                  const usableWidth = 100 - (padding * 2);
                                  return padding + (index / (total - 1)) * usableWidth;
                                };
                                
                                // Show actual data point labels, with smart thinning based on zoom
                                // At 1x zoom: show ~7 labels
                                // At 2x zoom: show ~14 labels (twice as many)
                                // At 4x zoom: show ~28 labels (four times as many)
                                const baseLabelsPerScreen = 7;
                                const targetLabelsVisible = Math.floor(baseLabelsPerScreen * zoomLevel);
                                const skipInterval = Math.max(1, Math.ceil(displayDates.length / targetLabelsVisible));
                                
                                // Collect indices of labels to show
                                const labelsToShow: number[] = [];
                                for (let i = 0; i < displayDates.length; i++) {
                                  if (i === 0 || i === displayDates.length - 1 || i % skipInterval === 0) {
                                    labelsToShow.push(i);
                                  }
                                }
                                
                                return labelsToShow.map((dataIndex, labelIndex) => {
                                  const date = displayDates[dataIndex];
                                  const timestamp = parseDate(date);
                                  
                                  // Position labels evenly across the width
                                  const padding = 5;
                                  const usableWidth = 100 - (padding * 2);
                                  const xPercent = labelsToShow.length === 1 
                                    ? 50 
                                    : padding + (labelIndex / (labelsToShow.length - 1)) * usableWidth;
                                  
                                  return (
                                    <div 
                                      key={dataIndex} 
                                      className="absolute whitespace-nowrap"
                                      style={{ 
                                        left: `${xPercent}%`,
                                        transform: `translateX(-50%) scaleX(${1 / zoomLevel})`
                                      }}
                                    >
                                      {formatDate(timestamp)}
                                    </div>
                                  );
                                });
                              })()}
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4">
                    <div className="text-2xl font-semibold text-white">{usageStats.totalRequests.toLocaleString()}</div>
                    <div className="text-sm text-zinc-400 mt-1">Monthly Total Requests</div>
                  </div>
                  <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4">
                    <div className="text-2xl font-semibold text-white">{(usageStats.totalTokens / 1000000).toFixed(2)}M</div>
                    <div className="text-sm text-zinc-400 mt-1">Monthly Tokens Used</div>
                  </div>
                  <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4">
                    <div className="text-2xl font-semibold text-white">${usageStats.totalCost.toFixed(2)}</div>
                    <div className="text-sm text-zinc-400 mt-1">Monthly Total Cost</div>
                  </div>
                </div>

                {/* Donut Charts Grid - 2 on top, 1 below */}
                <div className="space-y-6 mt-6">
                  {/* Top Row - 2 Charts */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Top 5 Models - Donut Chart */}
                    <div ref={top5ChartRef} data-chart-name="top5" className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-6">
                  <h4 className="text-lg font-medium text-white mb-4">Top 5 Models This Month</h4>
                  {(() => {
                    // Calculate top 5 models by total tokens
                    if (!usageStats.byModel || Object.keys(usageStats.byModel).length === 0) {
                      return <div className="text-center py-8 text-zinc-400">No data available</div>;
                    }

                    const modelStats = Object.entries(usageStats.byModel)
                      .filter(([, stats]) => stats && stats.tokens > 0)
                      .map(([modelId, stats]) => {
                        const sanitizedId = sanitizeModelId(modelId);
                        return {
                          modelId: sanitizedId,
                          name: settings.models.configuredModels.find(m => m.id === sanitizedId)?.name || sanitizedId,
                          totalTokens: stats?.tokens || 0,
                          percentage: ((stats?.tokens || 0) / usageStats.totalTokens) * 100
                        };
                      })
                      .sort((a, b) => b.totalTokens - a.totalTokens)
                      .slice(0, 5);

                    if (modelStats.length === 0) {
                      return <div className="text-center py-8 text-zinc-400">No data available</div>;
                    }

                    const colors = [
                      'rgb(59, 130, 246)',   // blue
                      'rgb(234, 179, 8)',    // yellow
                      'rgb(156, 163, 175)',  // gray
                      'rgb(34, 197, 94)',    // green
                      'rgb(239, 68, 68)'     // red
                    ];

                    return (
                      <div className="flex items-center gap-8">
                        {/* Donut Chart */}
                        <div className="relative w-48 h-48 flex-shrink-0">
                          <svg viewBox="0 0 100 100" className="transform -rotate-90">
                            {(() => {
                              let currentAngle = 0;
                              return modelStats.map((model, i) => {
                                const angle = (model.percentage / 100) * 360;
                                const startAngle = currentAngle;
                                currentAngle += angle;

                                // Convert to radians
                                const startRad = (startAngle * Math.PI) / 180;
                                const endRad = (currentAngle * Math.PI) / 180;

                                // Calculate arc path for donut
                                const outerRadius = 45;
                                const innerRadius = 32; // Larger hole

                                const x1 = 50 + outerRadius * Math.cos(startRad);
                                const y1 = 50 + outerRadius * Math.sin(startRad);
                                const x2 = 50 + outerRadius * Math.cos(endRad);
                                const y2 = 50 + outerRadius * Math.sin(endRad);
                                const x3 = 50 + innerRadius * Math.cos(endRad);
                                const y3 = 50 + innerRadius * Math.sin(endRad);
                                const x4 = 50 + innerRadius * Math.cos(startRad);
                                const y4 = 50 + innerRadius * Math.sin(startRad);

                                const largeArc = angle > 180 ? 1 : 0;

                                const pathData = [
                                  `M ${x1} ${y1}`,
                                  `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}`,
                                  `L ${x3} ${y3}`,
                                  `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
                                  'Z'
                                ].join(' ');

                                // Calculate animation progress for this segment
                                // Each segment draws one after another with NO overlap
                                const animProgress = top5AnimationProgress;
                                
                                // Calculate which segment should be drawing based on progress
                                const segmentStartProgress = startAngle / 360;
                                const segmentEndProgress = currentAngle / 360;
                                
                                let visibleAngle = 0;
                                
                                if (animProgress >= segmentEndProgress) {
                                  // This segment is fully drawn
                                  visibleAngle = angle;
                                } else if (animProgress >= segmentStartProgress) {
                                  // This segment is currently drawing (only if previous is complete)
                                  const segmentProgress = (animProgress - segmentStartProgress) / (segmentEndProgress - segmentStartProgress);
                                  visibleAngle = angle * segmentProgress;
                                }
                                // else: segment hasn't started yet, visibleAngle stays 0
                                
                                // Create path for visible portion
                                const visibleEndRad = (startAngle + visibleAngle) * Math.PI / 180;
                                const vx2 = 50 + outerRadius * Math.cos(visibleEndRad);
                                const vy2 = 50 + outerRadius * Math.sin(visibleEndRad);
                                const vx3 = 50 + innerRadius * Math.cos(visibleEndRad);
                                const vy3 = 50 + innerRadius * Math.sin(visibleEndRad);
                                const visibleLargeArc = visibleAngle > 180 ? 1 : 0;
                                
                                const visiblePathData = visibleAngle > 0 ? [
                                  `M ${x1} ${y1}`,
                                  `A ${outerRadius} ${outerRadius} 0 ${visibleLargeArc} 1 ${vx2} ${vy2}`,
                                  `L ${vx3} ${vy3}`,
                                  `A ${innerRadius} ${innerRadius} 0 ${visibleLargeArc} 0 ${x4} ${y4}`,
                                  'Z'
                                ].join(' ') : '';

                                return (
                                  <g key={model.modelId}>
                                    <path
                                      d={visiblePathData}
                                      fill={colors[i]}
                                      className="transition-all cursor-pointer"
                                      style={{ 
                                        opacity: hoveredTop5Index === null || hoveredTop5Index === i ? 1 : 0.3,
                                        filter: hoveredTop5Index === i ? 'brightness(1.2)' : 'none'
                                      }}
                                      onMouseEnter={() => setHoveredTop5Index(i)}
                                      onMouseLeave={() => setHoveredTop5Index(null)}
                                    />
                                  </g>
                                );
                              });
                            })()}
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                              {hoveredTop5Index !== null ? (
                                <>
                                  <div className="text-lg font-bold text-white">{modelStats[hoveredTop5Index].percentage.toFixed(1)}%</div>
                                  <div className="text-[10px] text-zinc-400 max-w-[80px] truncate">{modelStats[hoveredTop5Index].name}</div>
                                </>
                              ) : (
                                <>
                                  <div className="text-2xl font-bold text-white">{modelStats.length}</div>
                                  <div className="text-xs text-zinc-400">Models</div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Legend */}
                        <div className="flex-1 space-y-3">
                          {modelStats.map((model, i) => (
                            <div key={model.modelId} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i] }}></div>
                                <span className="text-sm text-white">{model.name}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium text-white">{model.percentage.toFixed(1)}%</div>
                                <div className="text-xs text-zinc-400">{(model.totalTokens / 1000).toFixed(1)}K tokens</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                  {/* Usage Per Model - Donut Chart */}
                  <div ref={usageChartRef} data-chart-name="usage" className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-6">
                  <h4 className="text-lg font-medium text-white mb-4">Usage Per Model</h4>
                  {(() => {
                    if (!usageStats.byModel || Object.keys(usageStats.byModel).length === 0) {
                      return <div className="text-center py-8 text-zinc-400">No data available</div>;
                    }

                    const modelStats = Object.entries(usageStats.byModel)
                      .filter(([, stats]) => stats && stats.tokens > 0)
                      .map(([modelId, stats]) => {
                        const sanitizedId = sanitizeModelId(modelId);
                        return {
                          modelId: sanitizedId,
                          name: settings.models.configuredModels.find(m => m.id === sanitizedId)?.name || sanitizedId,
                          totalTokens: stats?.tokens || 0,
                          requests: stats?.requests || 0,
                          percentage: ((stats?.tokens || 0) / usageStats.totalTokens) * 100
                        };
                      })
                      .sort((a, b) => b.totalTokens - a.totalTokens);

                    if (modelStats.length === 0) {
                      return <div className="text-center py-8 text-zinc-400">No data available</div>;
                    }

                    const colors = [
                      'rgb(59, 130, 246)',   // blue
                      'rgb(234, 179, 8)',    // yellow
                      'rgb(156, 163, 175)',  // gray
                      'rgb(34, 197, 94)',    // green
                      'rgb(239, 68, 68)',    // red
                      'rgb(168, 85, 247)',   // purple
                      'rgb(236, 72, 153)',   // pink
                      'rgb(20, 184, 166)',   // teal
                      'rgb(251, 146, 60)',   // orange
                      'rgb(132, 204, 22)'    // lime
                    ];

                    return (
                      <div className="flex items-center gap-8">
                        {/* Donut Chart */}
                        <div className="relative w-48 h-48 flex-shrink-0">
                          <svg viewBox="0 0 100 100" className="transform -rotate-90">
                            {(() => {
                              let currentAngle = 0;
                              return modelStats.map((model, i) => {
                                const angle = (model.percentage / 100) * 360;
                                const startAngle = currentAngle;
                                currentAngle += angle;

                                const startRad = (startAngle * Math.PI) / 180;
                                const endRad = (currentAngle * Math.PI) / 180;

                                const outerRadius = 45;
                                const innerRadius = 32; // Larger hole for Usage Per Model

                                const x1 = 50 + outerRadius * Math.cos(startRad);
                                const y1 = 50 + outerRadius * Math.sin(startRad);
                                const x2 = 50 + outerRadius * Math.cos(endRad);
                                const y2 = 50 + outerRadius * Math.sin(endRad);
                                const x3 = 50 + innerRadius * Math.cos(endRad);
                                const y3 = 50 + innerRadius * Math.sin(endRad);
                                const x4 = 50 + innerRadius * Math.cos(startRad);
                                const y4 = 50 + innerRadius * Math.sin(startRad);

                                const largeArc = angle > 180 ? 1 : 0;

                                const pathData = [
                                  `M ${x1} ${y1}`,
                                  `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}`,
                                  `L ${x3} ${y3}`,
                                  `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
                                  'Z'
                                ].join(' ');

                                // Calculate animation progress for this segment
                                // Each segment draws one after another with NO overlap
                                const animProgress = usageAnimationProgress;
                                
                                // Calculate which segment should be drawing based on progress
                                const segmentStartProgress = startAngle / 360;
                                const segmentEndProgress = currentAngle / 360;
                                
                                let visibleAngle = 0;
                                
                                if (animProgress >= segmentEndProgress) {
                                  // This segment is fully drawn
                                  visibleAngle = angle;
                                } else if (animProgress >= segmentStartProgress) {
                                  // This segment is currently drawing (only if previous is complete)
                                  const segmentProgress = (animProgress - segmentStartProgress) / (segmentEndProgress - segmentStartProgress);
                                  visibleAngle = angle * segmentProgress;
                                }
                                // else: segment hasn't started yet, visibleAngle stays 0
                                
                                // Create path for visible portion
                                const visibleEndRad = (startAngle + visibleAngle) * Math.PI / 180;
                                const vx2 = 50 + outerRadius * Math.cos(visibleEndRad);
                                const vy2 = 50 + outerRadius * Math.sin(visibleEndRad);
                                const vx3 = 50 + innerRadius * Math.cos(visibleEndRad);
                                const vy3 = 50 + innerRadius * Math.sin(visibleEndRad);
                                const visibleLargeArc = visibleAngle > 180 ? 1 : 0;
                                
                                const visiblePathData = visibleAngle > 0 ? [
                                  `M ${x1} ${y1}`,
                                  `A ${outerRadius} ${outerRadius} 0 ${visibleLargeArc} 1 ${vx2} ${vy2}`,
                                  `L ${vx3} ${vy3}`,
                                  `A ${innerRadius} ${innerRadius} 0 ${visibleLargeArc} 0 ${x4} ${y4}`,
                                  'Z'
                                ].join(' ') : '';

                                return (
                                  <g key={model.modelId}>
                                    <path
                                      d={visiblePathData}
                                      fill={colors[i % colors.length]}
                                      className="transition-all cursor-pointer"
                                      style={{ 
                                        opacity: hoveredUsageIndex === null || hoveredUsageIndex === i ? 1 : 0.3,
                                        filter: hoveredUsageIndex === i ? 'brightness(1.2)' : 'none'
                                      }}
                                      onMouseEnter={() => setHoveredUsageIndex(i)}
                                      onMouseLeave={() => setHoveredUsageIndex(null)}
                                    />
                                  </g>
                                );
                              });
                            })()}
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                              {hoveredUsageIndex !== null ? (
                                <>
                                  <div className="text-lg font-bold text-white">{modelStats[hoveredUsageIndex].requests}</div>
                                  <div className="text-[10px] text-zinc-400">requests</div>
                                </>
                              ) : (
                                <>
                                  <div className="text-2xl font-bold text-white">{(usageStats.totalTokens / 1000000).toFixed(1)}M</div>
                                  <div className="text-xs text-zinc-400">Total Tokens</div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Legend */}
                        <div className="flex-1 space-y-2 max-h-96 overflow-y-auto">
                          {modelStats.map((model, i) => (
                            <div key={model.modelId} className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }}></div>
                                <span className="text-sm text-white truncate">{model.name}</span>
                              </div>
                              <div className="text-right ml-4 flex-shrink-0">
                                <div className="text-sm font-medium text-white">{model.percentage.toFixed(1)}%</div>
                                <div className="text-xs text-zinc-400">{model.requests} req</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                  </div>

                  {/* Bottom Row - 1 Chart */}
                  <div className="grid grid-cols-1">
                  {/* Cost Per Model - Donut Chart */}
                  <div ref={costChartRef} data-chart-name="cost" className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-6">
                  <h4 className="text-lg font-medium text-white mb-4">Cost Per Model</h4>
                  {(() => {
                    if (!usageStats.byModel || Object.keys(usageStats.byModel).length === 0) {
                      return <div className="text-center py-8 text-zinc-400">No data available</div>;
                    }

                    const modelCosts = Object.entries(usageStats.byModel)
                      .map(([modelId, stats]) => {
                        const sanitizedId = sanitizeModelId(modelId);
                        return {
                          modelId: sanitizedId,
                          name: settings.models.configuredModels.find(m => m.id === sanitizedId)?.name || sanitizedId,
                          cost: stats?.cost || 0,
                          tokens: stats?.tokens || 0,
                          percentage: usageStats.totalCost > 0 ? ((stats?.cost || 0) / usageStats.totalCost) * 100 : (100 / Object.keys(usageStats.byModel).length)
                        };
                      })
                      .sort((a, b) => b.cost - a.cost);

                    if (modelCosts.length === 0) {
                      return <div className="text-center py-8 text-zinc-400">No data available</div>;
                    }

                    const colors = [
                      'rgb(59, 130, 246)',   // blue
                      'rgb(234, 179, 8)',    // yellow
                      'rgb(156, 163, 175)',  // gray
                      'rgb(34, 197, 94)',    // green
                      'rgb(239, 68, 68)',    // red
                      'rgb(168, 85, 247)',   // purple
                      'rgb(236, 72, 153)',   // pink
                      'rgb(20, 184, 166)',   // teal
                      'rgb(251, 146, 60)',   // orange
                      'rgb(132, 204, 22)'    // lime
                    ];

                    return (
                      <div className="flex items-center gap-8">
                        {/* Donut Chart */}
                        <div className="relative w-48 h-48 flex-shrink-0">
                          <svg viewBox="0 0 100 100" className="transform -rotate-90">
                            {(() => {
                              let currentAngle = 0;
                              return modelCosts.map((model, i) => {
                                const angle = (model.percentage / 100) * 360;
                                const startAngle = currentAngle;
                                currentAngle += angle;

                                const startRad = (startAngle * Math.PI) / 180;
                                const endRad = (currentAngle * Math.PI) / 180;

                                const outerRadius = 45;
                                const innerRadius = 32; // Larger hole for Cost Per Model

                                const x1 = 50 + outerRadius * Math.cos(startRad);
                                const y1 = 50 + outerRadius * Math.sin(startRad);
                                const x2 = 50 + outerRadius * Math.cos(endRad);
                                const y2 = 50 + outerRadius * Math.sin(endRad);
                                const x3 = 50 + innerRadius * Math.cos(endRad);
                                const y3 = 50 + innerRadius * Math.sin(endRad);
                                const x4 = 50 + innerRadius * Math.cos(startRad);
                                const y4 = 50 + innerRadius * Math.sin(startRad);

                                const largeArc = angle > 180 ? 1 : 0;

                                const pathData = [
                                  `M ${x1} ${y1}`,
                                  `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}`,
                                  `L ${x3} ${y3}`,
                                  `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
                                  'Z'
                                ].join(' ');

                                // Calculate animation progress for this segment
                                // Each segment draws one after another with NO overlap
                                const animProgress = costAnimationProgress;
                                
                                // Calculate which segment should be drawing based on progress
                                const segmentStartProgress = startAngle / 360;
                                const segmentEndProgress = currentAngle / 360;
                                
                                let visibleAngle = 0;
                                
                                if (animProgress >= segmentEndProgress) {
                                  // This segment is fully drawn
                                  visibleAngle = angle;
                                } else if (animProgress >= segmentStartProgress) {
                                  // This segment is currently drawing (only if previous is complete)
                                  const segmentProgress = (animProgress - segmentStartProgress) / (segmentEndProgress - segmentStartProgress);
                                  visibleAngle = angle * segmentProgress;
                                }
                                // else: segment hasn't started yet, visibleAngle stays 0
                                
                                // Create path for visible portion
                                const visibleEndRad = (startAngle + visibleAngle) * Math.PI / 180;
                                const vx2 = 50 + outerRadius * Math.cos(visibleEndRad);
                                const vy2 = 50 + outerRadius * Math.sin(visibleEndRad);
                                const vx3 = 50 + innerRadius * Math.cos(visibleEndRad);
                                const vy3 = 50 + innerRadius * Math.sin(visibleEndRad);
                                const visibleLargeArc = visibleAngle > 180 ? 1 : 0;
                                
                                const visiblePathData = visibleAngle > 0 ? [
                                  `M ${x1} ${y1}`,
                                  `A ${outerRadius} ${outerRadius} 0 ${visibleLargeArc} 1 ${vx2} ${vy2}`,
                                  `L ${vx3} ${vy3}`,
                                  `A ${innerRadius} ${innerRadius} 0 ${visibleLargeArc} 0 ${x4} ${y4}`,
                                  'Z'
                                ].join(' ') : '';

                                return (
                                  <g key={model.modelId}>
                                    <path
                                      d={visiblePathData}
                                      fill={colors[i % colors.length]}
                                      className="transition-all cursor-pointer"
                                      style={{ 
                                        opacity: hoveredCostIndex === null || hoveredCostIndex === i ? 1 : 0.3,
                                        filter: hoveredCostIndex === i ? 'brightness(1.2)' : 'none'
                                      }}
                                      onMouseEnter={() => setHoveredCostIndex(i)}
                                      onMouseLeave={() => setHoveredCostIndex(null)}
                                    />
                                  </g>
                                );
                              });
                            })()}
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                              {hoveredCostIndex !== null ? (
                                <>
                                  <div className="text-lg font-bold text-white">${modelCosts[hoveredCostIndex].cost.toFixed(4)}</div>
                                  <div className="text-[10px] text-zinc-400 max-w-[80px] truncate">{modelCosts[hoveredCostIndex].name}</div>
                                </>
                              ) : (
                                <>
                                  <div className="text-2xl font-bold text-white">${usageStats.totalCost.toFixed(2)}</div>
                                  <div className="text-xs text-zinc-400">Total Cost</div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Legend */}
                        <div className="flex-1 space-y-2 max-h-96 overflow-y-auto">
                          {modelCosts.map((model, i) => (
                            <div key={model.modelId} className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }}></div>
                                <span className="text-sm text-white truncate">{model.name}</span>
                              </div>
                              <div className="text-right ml-4 flex-shrink-0">
                                <div className="text-sm font-medium text-white">{model.percentage.toFixed(1)}%</div>
                                <div className="text-xs text-zinc-400">${model.cost.toFixed(4)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
