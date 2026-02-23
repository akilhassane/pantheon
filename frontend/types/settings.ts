/**
 * Application Settings Types
 * Defines all configurable settings for the application
 */

export interface KeyboardShortcut {
  key: string
  modifiers: {
    ctrl?: boolean
    shift?: boolean
    alt?: boolean
    meta?: boolean
  }
}

export interface ModelConfig {
  id: string
  name: string
  apiKey: string
  apiKeyId?: string // ID of the API key in the database
  visible: boolean
  addedAt: number
  provider?: string
  contextLength?: number
  maxOutputTokens?: number
  pricing?: {
    prompt: string
    completion: string
  }
  description?: string
  capabilities?: string[]
  parameters?: {
    temperature?: { min: number; max: number; default: number }
    maxTokens?: { min: number; max: number; default: number }
    topP?: { min: number; max: number; default: number }
    topK?: { min: number; max: number; default: number }
    frequencyPenalty?: { min: number; max: number; default: number }
    presencePenalty?: { min: number; max: number; default: number }
  }
}

export interface CustomMode {
  id: string
  name: string
  description: string
  systemPrompt: string
  createdAt: number
}

export interface AppSettings {
  version: string
  
  // Model Settings
  models: {
    configuredModels: ModelConfig[]
    defaultModel: string
    temperature: number
    maxTokens: number
    topP: number
    frequencyPenalty: number
    presencePenalty: number
  }
  
  // Custom Modes
  customModes?: CustomMode[]
  defaultModeId?: string
  
  // Appearance Settings
  appearance: {
    theme: 'dark' | 'light' | 'system'
    fontSize: 'small' | 'medium' | 'large'
    codeTheme: 'github-dark' | 'monokai' | 'dracula' | 'nord'
    animationsEnabled: boolean
    compactMode: boolean
    showLineNumbers: boolean
    sidebarPosition: 'left' | 'right'
    chatPosition: 'left' | 'right'
  }
  
  // Behavior Settings
  behavior: {
    autoSaveSessions: boolean
    messageHistoryLimit: number
    terminalAutoConnect: boolean
    desktopModeAutoStart: boolean
    confirmDelete: boolean
    confirmClearHistory: boolean
    sendOnEnter: boolean
    streamResponses: boolean
  }
  
  // Keyboard Shortcuts
  keyboard: {
    shortcuts: {
      newSession: KeyboardShortcut
      newProject: KeyboardShortcut
      search: KeyboardShortcut
      settings: KeyboardShortcut
      toggleSidebar: KeyboardShortcut
      focusInput: KeyboardShortcut
      clearChat: KeyboardShortcut
    }
  }
  
  // Advanced Settings
  advanced: {
    debugMode: boolean
    logLevel: 'error' | 'warn' | 'info' | 'debug'
    maxRetries: number
    requestTimeout: number
    enableTelemetry: boolean
    experimentalFeatures: boolean
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  version: '2.0.0', // Updated to match SettingsManager version
  
  models: {
    configuredModels: [],
    defaultModel: '',
    temperature: 0.7,
    maxTokens: 2000,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
  },
  
  customModes: [],
  defaultModeId: undefined,
  
  appearance: {
    theme: 'dark',
    fontSize: 'medium',
    codeTheme: 'github-dark',
    animationsEnabled: true,
    compactMode: false,
    showLineNumbers: true,
    sidebarPosition: 'left',
    chatPosition: 'right',
  },
  
  behavior: {
    autoSaveSessions: true,
    messageHistoryLimit: 100,
    terminalAutoConnect: true,
    desktopModeAutoStart: false,
    confirmDelete: true,
    confirmClearHistory: true,
    sendOnEnter: true,
    streamResponses: true,
  },
  
  keyboard: {
    shortcuts: {
      newSession: { key: 'n', modifiers: { ctrl: true } },
      newProject: { key: 'p', modifiers: { ctrl: true, shift: true } },
      search: { key: 'k', modifiers: { ctrl: true } },
      settings: { key: ',', modifiers: { ctrl: true } },
      toggleSidebar: { key: 'b', modifiers: { ctrl: true } },
      focusInput: { key: 'l', modifiers: { ctrl: true } },
      clearChat: { key: 'l', modifiers: { ctrl: true, shift: true } },
    },
  },
  
  advanced: {
    debugMode: false,
    logLevel: 'warn',
    maxRetries: 3,
    requestTimeout: 30000,
    enableTelemetry: false,
    experimentalFeatures: false,
  }
}

export type SettingPath = 
  | `models.${keyof AppSettings['models']}`
  | `appearance.${keyof AppSettings['appearance']}`
  | `behavior.${keyof AppSettings['behavior']}`
  | `keyboard.shortcuts.${keyof AppSettings['keyboard']['shortcuts']}`
  | `advanced.${keyof AppSettings['advanced']}`
