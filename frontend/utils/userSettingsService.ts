/**
 * User Settings Service
 * 
 * Manages user-specific settings stored in PostgreSQL database
 * Provides sync between localStorage (for offline) and backend (for persistence)
 */

import { AppSettings, DEFAULT_SETTINGS } from '@/types/settings'
import { keycloakAuth } from '@/lib/keycloak-auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'

export class UserSettingsService {
  private static instance: UserSettingsService
  private cache: AppSettings | null = null
  private lastSync: number = 0
  private syncInterval: number = 60000 // 1 minute

  private constructor() {}

  static getInstance(): UserSettingsService {
    if (!UserSettingsService.instance) {
      UserSettingsService.instance = new UserSettingsService()
    }
    return UserSettingsService.instance
  }

  /**
   * Get session token for API calls
   */
  private async getSessionToken(): Promise<string | null> {
    try {
      const session = await keycloakAuth.getSession()
      return session?.access_token || null
    } catch (error) {
      console.error('[UserSettingsService] Error getting token:', error)
      return null
    }
  }

  /**
   * Get auth headers for API calls
   */
  private async getAuthHeaders() {
    const token = await this.getSessionToken()
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    }
  }

  /**
   * Load settings from backend (with localStorage fallback)
   */
  async load(userId: string): Promise<AppSettings> {
    try {
      // Check cache first
      const now = Date.now()
      if (this.cache && (now - this.lastSync) < this.syncInterval) {
        console.log('[UserSettingsService] Using cached settings')
        return this.cache
      }

      console.log('[UserSettingsService] Loading settings from backend for user:', userId)
      
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${API_URL}/api/user-settings/${userId}`, {
        headers
      })

      if (!response.ok) {
        throw new Error(`Failed to load settings: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.success) {
        // Merge with defaults to ensure all fields exist
        const settings: AppSettings = {
          ...DEFAULT_SETTINGS,
          models: {
            ...DEFAULT_SETTINGS.models,
            selectedModel: data.settings.selected_model || DEFAULT_SETTINGS.models.selectedModel,
            defaultModel: data.settings.default_model || DEFAULT_SETTINGS.models.defaultModel,
            configuredModels: data.settings.visible_models || DEFAULT_SETTINGS.models.configuredModels
          },
          appearance: {
            ...DEFAULT_SETTINGS.appearance,
            theme: data.settings.theme || DEFAULT_SETTINGS.appearance.theme,
            sidebarPosition: data.settings.sidebar_position || DEFAULT_SETTINGS.appearance.sidebarPosition,
            chatPosition: data.settings.chat_position || DEFAULT_SETTINGS.appearance.chatPosition
          },
          behavior: {
            ...DEFAULT_SETTINGS.behavior,
            autoRunCode: data.settings.auto_run_code ?? DEFAULT_SETTINGS.behavior.autoRunCode,
            showLineNumbers: data.settings.show_line_numbers ?? DEFAULT_SETTINGS.behavior.showLineNumbers,
            enableSound: data.settings.enable_sound ?? DEFAULT_SETTINGS.behavior.enableSound
          },
          defaultModeId: data.settings.selected_mode || data.settings.default_mode || undefined,
          customModes: data.settings.custom_modes || []
        }

        // Update cache
        this.cache = settings
        this.lastSync = now

        // Also save to localStorage for offline access
        if (typeof window !== 'undefined') {
          localStorage.setItem('app-settings', JSON.stringify(settings))
        }

        console.log('[UserSettingsService] Settings loaded successfully')
        return settings
      }

      throw new Error('Invalid response from server')
    } catch (error) {
      console.error('[UserSettingsService] Failed to load from backend, using localStorage:', error)
      
      // Fallback to localStorage
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('app-settings')
        if (stored) {
          try {
            return JSON.parse(stored)
          } catch (e) {
            console.error('[UserSettingsService] Failed to parse localStorage settings:', e)
          }
        }
      }

      return DEFAULT_SETTINGS
    }
  }

  /**
   * Save settings to backend (and localStorage)
   */
  async save(userId: string, settings: AppSettings): Promise<void> {
    try {
      console.log('[UserSettingsService] 🔄 Saving settings to backend for user:', userId)
      console.log('[UserSettingsService] 📊 Settings to save:', {
        selectedModel: settings.models.selectedModel,
        theme: settings.appearance.theme,
        configuredModelsCount: settings.models.configuredModels?.length || 0
      })
      
      // Transform to backend format
      const backendSettings = {
        selected_model: settings.models.selectedModel,
        default_model: settings.models.defaultModel,
        visible_models: settings.models.configuredModels,
        selected_mode: settings.defaultModeId,
        default_mode: settings.defaultModeId,
        theme: settings.appearance.theme,
        sidebar_position: settings.appearance.sidebarPosition,
        chat_position: settings.appearance.chatPosition,
        auto_run_code: settings.behavior.autoRunCode,
        show_line_numbers: settings.behavior.showLineNumbers,
        enable_sound: settings.behavior.enableSound,
        custom_modes: settings.customModes || [],
        custom_settings: {
          // Store any additional settings here
          fontSize: settings.appearance.fontSize,
          codeTheme: settings.appearance.codeTheme,
          animationsEnabled: settings.appearance.animationsEnabled,
          compactMode: settings.appearance.compactMode,
          sendOnEnter: settings.behavior.sendOnEnter,
          streamResponses: settings.behavior.streamResponses,
          autoSaveSessions: settings.behavior.autoSaveSessions,
          messageHistoryLimit: settings.behavior.messageHistoryLimit,
          terminalAutoConnect: settings.behavior.terminalAutoConnect,
          desktopModeAutoStart: settings.behavior.desktopModeAutoStart,
          confirmDelete: settings.behavior.confirmDelete,
          confirmClearHistory: settings.behavior.confirmClearHistory
        }
      }

      console.log('[UserSettingsService] 🌐 Calling API:', `${API_URL}/api/user-settings/${userId}`)
      
      const headers = await this.getAuthHeaders()
      console.log('[UserSettingsService] 🔑 Headers:', headers)
      
      const response = await fetch(`${API_URL}/api/user-settings/${userId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(backendSettings)
      })

      console.log('[UserSettingsService] 📡 Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[UserSettingsService] ❌ Response error:', errorText)
        throw new Error(`Failed to save settings: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('[UserSettingsService] 📦 Response data:', data)
      
      if (data.success) {
        // Update cache
        this.cache = settings
        this.lastSync = Date.now()

        // Also save to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('app-settings', JSON.stringify(settings))
        }

        console.log('[UserSettingsService] ✅ Settings saved successfully to backend and localStorage')
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      console.error('[UserSettingsService] ❌ Failed to save to backend, saving to localStorage only:', error)
      
      // Fallback to localStorage only
      if (typeof window !== 'undefined') {
        localStorage.setItem('app-settings', JSON.stringify(settings))
        console.log('[UserSettingsService] 💾 Settings saved to localStorage as fallback')
      }
    }
  }

  /**
   * Update a specific setting path
   */
  async update(userId: string, path: string, value: any): Promise<AppSettings> {
    const settings = await this.load(userId)
    
    // Update the setting using path notation (e.g., 'models.selectedModel')
    const pathParts = path.split('.')
    let current: any = settings
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) {
        current[pathParts[i]] = {}
      }
      current = current[pathParts[i]]
    }
    
    current[pathParts[pathParts.length - 1]] = value
    
    // Save updated settings
    await this.save(userId, settings)
    
    return settings
  }

  /**
   * Clear cache (force reload on next access)
   */
  clearCache() {
    this.cache = null
    this.lastSync = 0
  }
}

// Export singleton instance
export const userSettingsService = UserSettingsService.getInstance()
