/**
 * Settings Manager
 * Handles loading, saving, and updating application settings
 */

import { AppSettings, DEFAULT_SETTINGS } from '@/types/settings'

export class SettingsManager {
  private static STORAGE_KEY = 'app-settings'
  private static VERSION = '2.0.0' // Bumped version to clear old preconfigured models

  /**
   * Load settings from localStorage with fallback to defaults
   */
  static load(): AppSettings {
    try {
      if (typeof window === 'undefined') {
        return DEFAULT_SETTINGS
      }

      const stored = localStorage.getItem(this.STORAGE_KEY)
      
      if (!stored) {
        return DEFAULT_SETTINGS
      }

      const parsed = JSON.parse(stored) as AppSettings
      
      // Version migration logic
      if (parsed.version !== this.VERSION) {
        return this.migrate(parsed)
      }

      // Merge with defaults to ensure all keys exist
      const merged = this.mergeWithDefaults(parsed)
      
      return merged
    } catch (error) {
      console.error('❌ Failed to load settings:', error)
      return DEFAULT_SETTINGS
    }
  }

  /**
   * Save settings to localStorage
   */
  static save(settings: AppSettings): void {
    try {
      if (typeof window === 'undefined') {
        return
      }

      const validated = this.validate(settings)
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(validated))
      
      // Dispatch custom event to notify other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('settings-updated'))
      }
    } catch (error) {
      console.error('❌ Failed to save settings:', error)
      throw new Error('Failed to save settings')
    }
  }

  /**
   * Update a specific setting by path
   * @param path - Dot-notation path (e.g., 'appearance.theme') or top-level key (e.g., 'customModes')
   * @param value - New value for the setting
   */
  static update(path: string, value: any): AppSettings {
    const settings = this.load()
    const keys = path.split('.')
    
    // Handle top-level properties
    if (keys.length === 1) {
      const key = keys[0]
      if (key in settings) {
        (settings as any)[key] = value
      } else {
        // Allow adding new top-level properties
        (settings as any)[key] = value
      }
      this.save(settings)
      return settings
    }
    
    // Navigate to the nested property
    let current: any = settings
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        throw new Error(`Invalid setting path: ${path}`)
      }
      current = current[keys[i]]
    }
    
    // Update the value
    const lastKey = keys[keys.length - 1]
    if (!(lastKey in current)) {
      throw new Error(`Invalid setting path: ${path}`)
    }
    
    current[lastKey] = value
    
    // Save and return updated settings
    this.save(settings)
    return settings
  }

  /**
   * Reset all settings to defaults
   */
  static reset(): AppSettings {
    const defaults = { ...DEFAULT_SETTINGS }
    this.save(defaults)
    return defaults
  }

  /**
   * Export settings as JSON string
   */
  static export(): string {
    const settings = this.load()
    return JSON.stringify(settings, null, 2)
  }

  /**
   * Import settings from JSON string
   * @returns true if successful, false otherwise
   */
  static import(data: string): boolean {
    try {
      const parsed = JSON.parse(data) as AppSettings
      
      // Validate structure
      if (!this.isValidSettings(parsed)) {
        throw new Error('Invalid settings structure')
      }
      
      // Merge with defaults and save
      const merged = this.mergeWithDefaults(parsed)
      this.save(merged)
      
      return true
    } catch (error) {
      console.error('❌ Failed to import settings:', error)
      return false
    }
  }

  /**
   * Merge parsed settings with defaults to ensure all keys exist
   */
  private static mergeWithDefaults(settings: Partial<AppSettings>): AppSettings {
    return {
      version: this.VERSION,
      models: {
        ...DEFAULT_SETTINGS.models,
        ...settings.models,
        configuredModels: settings.models?.configuredModels?.length 
          ? settings.models.configuredModels 
          : DEFAULT_SETTINGS.models.configuredModels
      },
      customModes: settings.customModes || DEFAULT_SETTINGS.customModes,
      defaultModeId: settings.defaultModeId || DEFAULT_SETTINGS.defaultModeId,
      appearance: {
        ...DEFAULT_SETTINGS.appearance,
        ...settings.appearance
      },
      behavior: {
        ...DEFAULT_SETTINGS.behavior,
        ...settings.behavior
      },
      keyboard: {
        shortcuts: {
          ...DEFAULT_SETTINGS.keyboard.shortcuts,
          ...(settings.keyboard?.shortcuts || {})
        }
      },
      advanced: {
        ...DEFAULT_SETTINGS.advanced,
        ...settings.advanced
      }
    }
  }

  /**
   * Validate temperature (0.0-2.0)
   */
  static validateTemperature(value: number): boolean {
    return typeof value === 'number' && value >= 0.0 && value <= 2.0
  }

  /**
   * Validate max tokens (100-8000)
   */
  static validateMaxTokens(value: number): boolean {
    return typeof value === 'number' && value >= 100 && value <= 8000 && Number.isInteger(value)
  }

  /**
   * Validate message history limit (10-1000)
   */
  static validateMessageHistoryLimit(value: number): boolean {
    return typeof value === 'number' && value >= 10 && value <= 1000 && Number.isInteger(value)
  }

  /**
   * Validate keyboard shortcut
   */
  static validateKeyboardShortcut(shortcut: any): boolean {
    return (
      shortcut &&
      typeof shortcut === 'object' &&
      typeof shortcut.key === 'string' &&
      shortcut.key.length > 0 &&
      typeof shortcut.modifiers === 'object'
    )
  }

  /**
   * Validate settings structure and values
   */
  private static validate(settings: AppSettings): AppSettings {
    // Validate theme
    if (!['dark', 'light', 'system'].includes(settings.appearance.theme)) {
      settings.appearance.theme = 'dark'
    }
    
    // Validate fontSize
    if (!['small', 'medium', 'large'].includes(settings.appearance.fontSize)) {
      settings.appearance.fontSize = 'medium'
    }
    
    // Validate codeTheme
    if (!['github-dark', 'monokai', 'dracula', 'nord'].includes(settings.appearance.codeTheme)) {
      settings.appearance.codeTheme = 'github-dark'
    }
    
    // Validate sidebarPosition
    if (!['left', 'right'].includes((settings.appearance as any).sidebarPosition || '')) {
      (settings.appearance as any).sidebarPosition = 'left'
    }
    
    // Validate chatPosition
    if (!['left', 'right'].includes((settings.appearance as any).chatPosition || '')) {
      (settings.appearance as any).chatPosition = 'right'
    }
    
    // Validate temperature
    if (!this.validateTemperature(settings.models.temperature)) {
      settings.models.temperature = 0.7
    }
    
    // Validate maxTokens
    if (!this.validateMaxTokens(settings.models.maxTokens)) {
      settings.models.maxTokens = 2000
    }
    
    // Validate topP
    if (typeof settings.models.topP !== 'number' || settings.models.topP < 0 || settings.models.topP > 1) {
      settings.models.topP = 1.0
    }
    
    // Validate frequencyPenalty
    if (typeof settings.models.frequencyPenalty !== 'number' || settings.models.frequencyPenalty < -2 || settings.models.frequencyPenalty > 2) {
      settings.models.frequencyPenalty = 0.0
    }
    
    // Validate presencePenalty
    if (typeof settings.models.presencePenalty !== 'number' || settings.models.presencePenalty < -2 || settings.models.presencePenalty > 2) {
      settings.models.presencePenalty = 0.0
    }
    
    // Validate messageHistoryLimit
    if (!this.validateMessageHistoryLimit(settings.behavior.messageHistoryLimit)) {
      settings.behavior.messageHistoryLimit = 100
    }
    
    // Validate defaultModel
    if (!settings.models.defaultModel) {
      settings.models.defaultModel = 'gemini-2.5-flash'
    }
    
    // Validate configuredModels is an array
    if (!Array.isArray(settings.models.configuredModels)) {
      settings.models.configuredModels = DEFAULT_SETTINGS.models.configuredModels
    }
    
    // Validate logLevel
    if (!['error', 'warn', 'info', 'debug'].includes(settings.advanced.logLevel)) {
      settings.advanced.logLevel = 'warn'
    }
    
    // Validate maxRetries
    if (typeof settings.advanced.maxRetries !== 'number' || settings.advanced.maxRetries < 0 || settings.advanced.maxRetries > 10) {
      settings.advanced.maxRetries = 3
    }
    
    // Validate requestTimeout
    if (typeof settings.advanced.requestTimeout !== 'number' || settings.advanced.requestTimeout < 1000 || settings.advanced.requestTimeout > 120000) {
      settings.advanced.requestTimeout = 30000
    }
    
    return settings
  }

  /**
   * Check if object has valid settings structure
   */
  private static isValidSettings(obj: any): obj is AppSettings {
    return (
      obj &&
      typeof obj === 'object' &&
      'models' in obj &&
      'appearance' in obj &&
      'behavior' in obj &&
      'keyboard' in obj &&
      'advanced' in obj
    )
  }

  /**
   * Migrate settings from older versions
   */
  private static migrate(oldSettings: AppSettings): AppSettings {
    console.log(`🔄 Migrating settings from version ${oldSettings.version} to ${this.VERSION}`)
    
    // Clear preconfigured models when migrating from v1.0.0 to v2.0.0
    if (oldSettings.version === '1.0.0') {
      console.log('🧹 Clearing preconfigured models from v1.0.0')
      const migrated = this.mergeWithDefaults({
        ...oldSettings,
        models: {
          ...oldSettings.models,
          configuredModels: [], // Clear all preconfigured models
          defaultModel: '' // Clear default model
        }
      })
      return migrated
    }
    
    // For other versions, just merge with defaults
    return this.mergeWithDefaults(oldSettings)
  }
}
