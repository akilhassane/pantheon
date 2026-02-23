/**
 * Truncation Configuration Management
 * 
 * Manages user preferences for chat history truncation settings
 * with localStorage persistence.
 */

import { TruncationConfig, DEFAULT_TRUNCATION_CONFIG } from './historyManager'

const STORAGE_KEY = 'chat-truncation-config'

/**
 * Load truncation configuration from localStorage
 */
export function loadTruncationConfig(): TruncationConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return DEFAULT_TRUNCATION_CONFIG
    }

    const parsed = JSON.parse(stored)
    
    // Validate and merge with defaults
    return {
      maxHistoryMessages: parsed.maxHistoryMessages || DEFAULT_TRUNCATION_CONFIG.maxHistoryMessages,
      maxOutputSize: parsed.maxOutputSize || DEFAULT_TRUNCATION_CONFIG.maxOutputSize,
      maxPayloadSize: parsed.maxPayloadSize || DEFAULT_TRUNCATION_CONFIG.maxPayloadSize,
      aggressiveTruncationSize: parsed.aggressiveTruncationSize || DEFAULT_TRUNCATION_CONFIG.aggressiveTruncationSize
    }
  } catch (error) {
    console.error('Failed to load truncation config:', error)
    return DEFAULT_TRUNCATION_CONFIG
  }
}

/**
 * Save truncation configuration to localStorage
 */
export function saveTruncationConfig(config: Partial<TruncationConfig>): void {
  try {
    const currentConfig = loadTruncationConfig()
    const newConfig = { ...currentConfig, ...config }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig))
  } catch (error) {
    console.error('Failed to save truncation config:', error)
  }
}

/**
 * Reset truncation configuration to defaults
 */
export function resetTruncationConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to reset truncation config:', error)
  }
}

/**
 * Update a single configuration value
 */
export function updateTruncationConfigValue<K extends keyof TruncationConfig>(
  key: K,
  value: TruncationConfig[K]
): void {
  const config = loadTruncationConfig()
  config[key] = value
  saveTruncationConfig(config)
}

/**
 * Get a single configuration value
 */
export function getTruncationConfigValue<K extends keyof TruncationConfig>(
  key: K
): TruncationConfig[K] {
  const config = loadTruncationConfig()
  return config[key]
}

/**
 * Validate configuration values
 */
export function validateTruncationConfig(config: Partial<TruncationConfig>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (config.maxHistoryMessages !== undefined) {
    if (config.maxHistoryMessages < 5) {
      errors.push('maxHistoryMessages must be at least 5')
    }
    if (config.maxHistoryMessages > 100) {
      errors.push('maxHistoryMessages must be at most 100')
    }
  }

  if (config.maxOutputSize !== undefined) {
    if (config.maxOutputSize < 1024) {
      errors.push('maxOutputSize must be at least 1KB')
    }
    if (config.maxOutputSize > 100 * 1024) {
      errors.push('maxOutputSize must be at most 100KB')
    }
  }

  if (config.maxPayloadSize !== undefined) {
    if (config.maxPayloadSize < 10 * 1024 * 1024) {
      errors.push('maxPayloadSize must be at least 10MB')
    }
    if (config.maxPayloadSize > 50 * 1024 * 1024) {
      errors.push('maxPayloadSize must be at most 50MB')
    }
  }

  if (config.aggressiveTruncationSize !== undefined) {
    if (config.aggressiveTruncationSize < 10 * 1024 * 1024) {
      errors.push('aggressiveTruncationSize must be at least 10MB')
    }
    if (config.aggressiveTruncationSize > 50 * 1024 * 1024) {
      errors.push('aggressiveTruncationSize must be at most 50MB')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Get configuration presets
 */
export const TRUNCATION_PRESETS = {
  conservative: {
    name: 'Conservative',
    description: 'Keep more history, larger payloads',
    config: {
      maxHistoryMessages: 30,
      maxOutputSize: 20 * 1024,
      maxPayloadSize: 45 * 1024 * 1024,
      aggressiveTruncationSize: 48 * 1024 * 1024
    }
  },
  balanced: {
    name: 'Balanced',
    description: 'Default settings (recommended)',
    config: DEFAULT_TRUNCATION_CONFIG
  },
  aggressive: {
    name: 'Aggressive',
    description: 'Minimize payload size, faster performance',
    config: {
      maxHistoryMessages: 10,
      maxOutputSize: 5 * 1024,
      maxPayloadSize: 30 * 1024 * 1024,
      aggressiveTruncationSize: 35 * 1024 * 1024
    }
  }
}

/**
 * Apply a preset configuration
 */
export function applyPreset(presetName: keyof typeof TRUNCATION_PRESETS): void {
  const preset = TRUNCATION_PRESETS[presetName]
  if (preset) {
    saveTruncationConfig(preset.config)
  }
}
