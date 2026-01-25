'use client'

import { useState } from 'react'
import { SettingsManager } from '@/utils/settingsManager'
import { AppSettings } from '@/types/settings'
import { SettingToggle, SettingInput } from './SettingControl'
import { Separator } from '@/components/ui/separator'

export function BehaviorSettings() {
  const [settings, setSettings] = useState<AppSettings>(SettingsManager.load())
  const [validationError, setValidationError] = useState<string>('')

  const updateSetting = (path: string, value: any) => {
    const updated = SettingsManager.update(path, value)
    setSettings(updated)
  }

  const handleMessageHistoryChange = (value: string) => {
    const num = parseInt(value)
    if (isNaN(num)) {
      setValidationError('Please enter a valid number')
      return
    }
    if (num < 10 || num > 1000) {
      setValidationError('Value must be between 10 and 1000')
      return
    }
    setValidationError('')
    updateSetting('behavior.messageHistoryLimit', num)
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-2">Behavior</h2>
        <p className="text-zinc-400">Configure how the application functions</p>
      </div>

      {/* Sessions Section */}
      <section>
        <h3 className="text-lg font-medium text-white mb-4">Sessions</h3>
        <div className="space-y-0">
          <SettingToggle
            label="Auto-save Sessions"
            description="Automatically save chat sessions as you work"
            value={settings.behavior.autoSaveSessions}
            onChange={(value) => updateSetting('behavior.autoSaveSessions', value)}
          />
          
          <div className="py-4 border-b border-zinc-800/50">
            <SettingInput
              label="Message History Limit"
              description="Maximum number of messages to keep in history (10-1000)"
              type="number"
              value={settings.behavior.messageHistoryLimit}
              onChange={handleMessageHistoryChange}
              placeholder="100"
            />
            {validationError && (
              <p className="text-sm text-red-400 mt-2">{validationError}</p>
            )}
          </div>
        </div>
      </section>

      <Separator className="bg-zinc-800" />

      {/* Chat Behavior Section */}
      <section>
        <h3 className="text-lg font-medium text-white mb-4">Chat Behavior</h3>
        <div className="space-y-0">
          <SettingToggle
            label="Send on Enter"
            description="Press Enter to send messages (Shift+Enter for new line)"
            value={settings.behavior.sendOnEnter}
            onChange={(value) => updateSetting('behavior.sendOnEnter', value)}
          />
          
          <SettingToggle
            label="Stream Responses"
            description="Display AI responses as they are generated"
            value={settings.behavior.streamResponses}
            onChange={(value) => updateSetting('behavior.streamResponses', value)}
          />
        </div>
      </section>

      <Separator className="bg-zinc-800" />

      {/* Terminal Section */}
      <section>
        <h3 className="text-lg font-medium text-white mb-4">Terminal</h3>
        <SettingToggle
          label="Auto-connect Terminal"
          description="Automatically connect to terminal on application startup"
          value={settings.behavior.terminalAutoConnect}
          onChange={(value) => updateSetting('behavior.terminalAutoConnect', value)}
        />
      </section>

      <Separator className="bg-zinc-800" />

      {/* Desktop Mode Section */}
      <section>
        <h3 className="text-lg font-medium text-white mb-4">Desktop Mode</h3>
        <SettingToggle
          label="Auto-start Desktop Mode"
          description="Automatically enable desktop control features on startup"
          value={settings.behavior.desktopModeAutoStart}
          onChange={(value) => updateSetting('behavior.desktopModeAutoStart', value)}
        />
      </section>

      <Separator className="bg-zinc-800" />

      {/* Confirmations Section */}
      <section>
        <h3 className="text-lg font-medium text-white mb-4">Confirmations</h3>
        <div className="space-y-0">
          <SettingToggle
            label="Confirm Before Deleting"
            description="Show confirmation dialog before deleting sessions or messages"
            value={settings.behavior.confirmDelete}
            onChange={(value) => updateSetting('behavior.confirmDelete', value)}
          />
          
          <SettingToggle
            label="Confirm Before Clearing History"
            description="Show confirmation dialog before clearing chat history"
            value={settings.behavior.confirmClearHistory}
            onChange={(value) => updateSetting('behavior.confirmClearHistory', value)}
          />
        </div>
      </section>
    </div>
  )
}
