'use client'

import { useState } from 'react'
import { SettingsManager } from '@/utils/settingsManager'
import { AppSettings } from '@/types/settings'
import { SettingToggle } from './SettingControl'
import { Download, Upload, Trash2, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react'

export function AdvancedSettings() {
  const [settings, setSettings] = useState<AppSettings>(SettingsManager.load())
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const updateSetting = (path: string, value: any) => {
    const updated = SettingsManager.update(path, value)
    setSettings(updated)
  }

  const handleExport = () => {
    const data = SettingsManager.export()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `settings-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const success = SettingsManager.import(text)
        
        if (success) {
          setSettings(SettingsManager.load())
          setImportStatus('success')
          setTimeout(() => setImportStatus('idle'), 3000)
        } else {
          setImportStatus('error')
          setTimeout(() => setImportStatus('idle'), 3000)
        }
      } catch (error) {
        setImportStatus('error')
        setTimeout(() => setImportStatus('idle'), 3000)
      }
    }
    input.click()
  }

  const handleReset = () => {
    const reset = SettingsManager.reset()
    setSettings(reset)
    setShowResetConfirm(false)
  }

  const handleClearCache = () => {
    // Clear localStorage except settings
    const settingsBackup = localStorage.getItem('app-settings')
    localStorage.clear()
    if (settingsBackup) {
      localStorage.setItem('app-settings', settingsBackup)
    }
    setShowClearConfirm(false)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-zinc-800/50">
        <h2 className="text-2xl font-semibold text-white mb-2">Advanced</h2>
        <p className="text-zinc-400">Advanced options and developer settings</p>
      </div>

      {/* Warning Banner */}
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-400">Advanced Settings</p>
            <p className="text-sm text-yellow-300/80 mt-1 leading-relaxed">
              These settings are for advanced users. Changing them may affect application performance and stability.
            </p>
          </div>
        </div>
      </div>

      {/* Developer Options */}
      <section className="space-y-0">
        <h3 className="text-lg font-medium text-white mb-6">Developer Options</h3>
        <div className="space-y-0">
          <SettingToggle
            label="Debug Mode"
            description="Enable developer tools and debugging features"
            value={settings.advanced.debugMode}
            onChange={(value) => {
              updateSetting('advanced.debugMode', value)
            }}
          />
          
          <div className="py-4 border-b border-zinc-800/50">
            <label className="text-sm font-medium text-white block mb-1.5">
              Log Level
            </label>
            <p className="text-sm text-zinc-400 mb-3 leading-relaxed">
              Control the verbosity of application logs
            </p>
            <select
              value={settings.advanced.logLevel}
              onChange={(e) => updateSetting('advanced.logLevel', e.target.value)}
              className="
                w-full px-3 py-2.5 bg-zinc-900 rounded-lg
                text-white text-sm
                border border-zinc-800
                focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent
                transition-all duration-200
                cursor-pointer
              "
            >
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>

          <div className="py-4 border-b border-zinc-800/50">
            <label className="text-sm font-medium text-white block mb-1.5">
              Max Retries
            </label>
            <p className="text-sm text-zinc-400 mb-3 leading-relaxed">
              Maximum number of retry attempts for failed requests (0-10)
            </p>
            <input
              type="number"
              min="0"
              max="10"
              value={settings.advanced.maxRetries}
              onChange={(e) => {
                const num = parseInt(e.target.value)
                if (!isNaN(num) && num >= 0 && num <= 10) {
                  updateSetting('advanced.maxRetries', num)
                }
              }}
              className="
                w-full px-3 py-2.5 bg-zinc-900 rounded-lg
                text-white text-sm placeholder-zinc-500
                border border-zinc-800
                focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent
                transition-all duration-200
              "
            />
          </div>

          <div className="py-4 border-b border-zinc-800/50">
            <label className="text-sm font-medium text-white block mb-1.5">
              Request Timeout
            </label>
            <p className="text-sm text-zinc-400 mb-3 leading-relaxed">
              Timeout for API requests in milliseconds (1000-120000)
            </p>
            <input
              type="number"
              min="1000"
              max="120000"
              step="1000"
              value={settings.advanced.requestTimeout}
              onChange={(e) => {
                const num = parseInt(e.target.value)
                if (!isNaN(num) && num >= 1000 && num <= 120000) {
                  updateSetting('advanced.requestTimeout', num)
                }
              }}
              className="
                w-full px-3 py-2.5 bg-zinc-900 rounded-lg
                text-white text-sm placeholder-zinc-500
                border border-zinc-800
                focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent
                transition-all duration-200
              "
            />
          </div>

          <SettingToggle
            label="Enable Telemetry"
            description="Help improve the application by sending anonymous usage data"
            value={settings.advanced.enableTelemetry}
            onChange={(value) => updateSetting('advanced.enableTelemetry', value)}
          />
        </div>
      </section>

      {/* Experimental Features */}
      <section className="space-y-0">
        <h3 className="text-lg font-medium text-white mb-6">Experimental Features</h3>
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-400">Warning</p>
              <p className="text-sm text-yellow-300/80 mt-1 leading-relaxed">
                Experimental features may be unstable and could affect application performance
              </p>
            </div>
          </div>
        </div>
        
        <div className="space-y-0">
          <SettingToggle
            label="Enable Experimental Features"
            description="Access to beta features and experimental functionality"
            value={settings.advanced.experimentalFeatures}
            onChange={(value) => updateSetting('advanced.experimentalFeatures', value)}
          />
        </div>
      </section>

      {/* Data Management */}
      <section className="space-y-0">
        <h3 className="text-lg font-medium text-white mb-6">Data Management</h3>
        
        {/* Import Status */}
        {importStatus !== 'idle' && (
          <div className={`
            flex items-center gap-3 p-4 rounded-lg mb-4
            ${importStatus === 'success' 
              ? 'bg-green-500/10 border border-green-500/30' 
              : 'bg-red-500/10 border border-red-500/30'
            }
          `}>
            {importStatus === 'success' ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-400" />
                <p className="text-sm text-green-400">Settings imported successfully</p>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <p className="text-sm text-red-400">Failed to import settings</p>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleExport}
            className="
              flex items-center justify-center gap-2 px-4 py-3
              bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg
              transition-colors duration-200
            "
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Export Settings</span>
          </button>

          <button
            onClick={handleImport}
            className="
              flex items-center justify-center gap-2 px-4 py-3
              bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg
              transition-colors duration-200
            "
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">Import Settings</span>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {/* Clear Cache */}
          {showClearConfirm ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400 mb-3">
                Are you sure? This will clear all cached data except your settings.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleClearCache}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Yes, Clear Cache
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="
                w-full flex items-center justify-center gap-2 px-4 py-3
                bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg
                transition-colors duration-200
              "
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm font-medium">Clear Cache</span>
            </button>
          )}

          {/* Reset to Defaults */}
          {showResetConfirm ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400 mb-3">
                Are you sure? This will reset all settings to their default values.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Yes, Reset All
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="
                w-full flex items-center justify-center gap-2 px-4 py-3
                bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg
                transition-colors duration-200
              "
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-sm font-medium">Reset to Defaults</span>
            </button>
          )}
        </div>
      </section>

      {/* About */}
      <section className="space-y-0">
        <h3 className="text-lg font-medium text-white mb-6">About</h3>
        <div className="space-y-0 text-sm">
          <div className="flex justify-between items-center py-4 border-b border-zinc-800/50">
            <span className="text-zinc-400">Version</span>
            <span className="text-white font-mono">1.0.0</span>
          </div>
          <div className="flex justify-between items-center py-4 border-b border-zinc-800/50">
            <span className="text-zinc-400">Build Date</span>
            <span className="text-white">November 2025</span>
          </div>
          <div className="flex justify-between items-center py-4">
            <span className="text-zinc-400">License</span>
            <span className="text-white">MIT</span>
          </div>
        </div>
      </section>
    </div>
  )
}
