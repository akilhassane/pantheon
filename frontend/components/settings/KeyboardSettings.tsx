'use client'

import { useState } from 'react'
import { SettingsManager } from '@/utils/settingsManager'
import { AppSettings, DEFAULT_SETTINGS } from '@/types/settings'
import { Search, AlertCircle } from 'lucide-react'

interface ShortcutAction {
  id: string
  label: string
  description: string
}

const SHORTCUT_ACTIONS: ShortcutAction[] = [
  { id: 'newSession', label: 'New Session', description: 'Create a new chat session' },
  { id: 'newProject', label: 'New Project', description: 'Start a new project' },
  { id: 'search', label: 'Search', description: 'Open search dialog' },
  { id: 'settings', label: 'Settings', description: 'Open settings page' },
  { id: 'toggleSidebar', label: 'Toggle Sidebar', description: 'Show/hide sidebar' },
  { id: 'closeTab', label: 'Close Tab', description: 'Close current tab' }
]

export function KeyboardSettings() {
  const [settings, setSettings] = useState<AppSettings>(SettingsManager.load())
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [conflictWarning, setConflictWarning] = useState<string | null>(null)

  const updateShortcut = (actionId: string, newBinding: string) => {
    // Check for conflicts
    const existingAction = Object.entries(settings.keyboard.shortcuts).find(
      ([id, binding]) => id !== actionId && JSON.stringify(binding) === JSON.stringify(newBinding)
    )

    if (existingAction) {
      setConflictWarning(`This shortcut is already used by "${SHORTCUT_ACTIONS.find(a => a.id === existingAction[0])?.label}"`)
      return
    }

    setConflictWarning(null)
    const updated = SettingsManager.update(`keyboard.shortcuts.${actionId}`, newBinding)
    setSettings(updated)
    setEditingShortcut(null)
  }

  const handleKeyPress = (e: React.KeyboardEvent, actionId: string) => {
    e.preventDefault()
    
    // Add the actual key if it's not a modifier
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      const binding = {
        key: e.key.toLowerCase(),
        modifiers: {
          ctrl: e.ctrlKey,
          shift: e.shiftKey,
          alt: e.altKey,
          meta: e.metaKey
        }
      }
      updateShortcut(actionId, binding as any)
    }
  }

  const resetToDefaults = () => {
    Object.entries(DEFAULT_SETTINGS.keyboard.shortcuts).forEach(([actionId, binding]) => {
      SettingsManager.update(`keyboard.shortcuts.${actionId}`, binding)
    })
    setSettings(SettingsManager.load())
    setConflictWarning(null)
  }

  const filteredActions = SHORTCUT_ACTIONS.filter(action =>
    action.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    action.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-2">Keyboard Shortcuts</h2>
        <p className="text-zinc-400">Customize keyboard shortcuts for quick actions</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search shortcuts..."
          className="
            w-full pl-10 pr-4 py-2 bg-zinc-900 rounded-lg
            text-white placeholder-zinc-500
            focus:outline-none focus:ring-2 focus:ring-zinc-500
          "
        />
      </div>

      {/* Conflict Warning */}
      {conflictWarning && (
        <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-400">Shortcut Conflict</p>
            <p className="text-sm text-yellow-300/80 mt-1">{conflictWarning}</p>
          </div>
        </div>
      )}

      {/* Shortcuts List */}
      <div className="space-y-2">
        {filteredActions.map((action) => {
          const shortcut = settings.keyboard.shortcuts[action.id as keyof typeof settings.keyboard.shortcuts]
          const currentBinding = shortcut 
            ? `${shortcut.modifiers.ctrl ? 'Ctrl+' : ''}${shortcut.modifiers.shift ? 'Shift+' : ''}${shortcut.modifiers.alt ? 'Alt+' : ''}${shortcut.modifiers.meta ? 'Meta+' : ''}${shortcut.key.toUpperCase()}`
            : 'Not set'
          const isEditing = editingShortcut === action.id

          return (
            <div
              key={action.id}
              className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">{action.label}</h4>
                <p className="text-xs text-zinc-400 mt-1">{action.description}</p>
              </div>

              <div className="flex items-center gap-3">
                {isEditing ? (
                  <div
                    onKeyDown={(e) => handleKeyPress(e, action.id)}
                    tabIndex={0}
                    className="
                      px-4 py-2 bg-zinc-700/20 rounded-lg
                      text-sm text-zinc-400 font-mono
                      focus:outline-none
                      animate-pulse
                    "
                  >
                    Press keys...
                  </div>
                ) : (
                  <div className="px-4 py-2 bg-zinc-800 rounded-lg text-sm text-zinc-300 font-mono">
                    {currentBinding}
                  </div>
                )}

                <button
                  onClick={() => setEditingShortcut(isEditing ? null : action.id)}
                  className="
                    px-3 py-2 text-sm font-medium rounded-lg
                    transition-colors duration-200
                    text-zinc-400 hover:bg-zinc-700/10
                  "
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Reset Button */}
      <div className="pt-4 border-t border-zinc-800">
        <button
          onClick={resetToDefaults}
          className="
            px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg
            transition-colors duration-200
          "
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
