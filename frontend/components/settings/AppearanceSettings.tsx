'use client'

import { useState, useEffect } from 'react'
import { userSettingsService } from '@/utils/userSettingsService'
import { AppSettings, DEFAULT_SETTINGS } from '@/types/settings'
import { SettingToggle, SettingSegmentedControl, SettingSelect } from './SettingControl'
import { useAuth } from '@/contexts/AuthContext'

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' }
]

const FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' }
]

const CODE_THEME_OPTIONS = [
  { value: 'github-dark', label: 'GitHub Dark' },
  { value: 'monokai', label: 'Monokai' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'nord', label: 'Nord' }
]

const POSITION_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' }
]

export function AppearanceSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) {
        setSettings(DEFAULT_SETTINGS)
        return
      }
      const loaded = await userSettingsService.load(user.id)
      setSettings(loaded)
      
      // Apply current settings
      applyAppearanceChanges('appearance.theme', loaded.appearance.theme)
      applyAppearanceChanges('appearance.fontSize', loaded.appearance.fontSize)
      applyAppearanceChanges('appearance.animationsEnabled', loaded.appearance.animationsEnabled)
    }
    loadSettings()
  }, [user?.id])

  const updateSetting = async (path: string, value: any) => {
    if (!user?.id) {
      console.warn('⚠️ No user ID, cannot save settings')
      return
    }

    const updated = await userSettingsService.update(user.id, path, value)
    setSettings(updated)
    
    // Apply appearance changes immediately
    applyAppearanceChanges(path, value)
  }

  const applyAppearanceChanges = (path: string, value: any) => {
    if (path === 'appearance.theme') {
      // Apply theme changes to document
      document.documentElement.setAttribute('data-theme', value)
      
      // Emit custom event for components listening to theme changes
      window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: value } }))
      
      // Determine if light theme
      const isLight = value === 'light' || 
        (value === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches)
      
      // Also update the class for better compatibility
      if (value === 'dark') {
        document.documentElement.classList.add('dark')
        document.documentElement.classList.remove('light')
      } else if (value === 'light') {
        document.documentElement.classList.add('light')
        document.documentElement.classList.remove('dark')
      } else {
        // System theme - detect user preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        if (prefersDark) {
          document.documentElement.classList.add('dark')
          document.documentElement.classList.remove('light')
        } else {
          document.documentElement.classList.add('light')
          document.documentElement.classList.remove('dark')
        }
      }
      
      // Override inline styles for light theme with comprehensive color mapping
      if (isLight) {
        // Debounced override function for performance
        const overrideInlineStyles = () => {
          const colorMap = {
            // Dark backgrounds to light grays
            '#0a0a0a': '#f8f9fa',
            '#101218': '#f8f9fa',
            '#17181F': '#f8f9fa',
            '#000000': '#f8f9fa',
            '#252529': '#e8eaed',
            '#1a1b26': '#f0f1f3',
            '#16171E': '#ffffff',
            // RGB equivalents
            'rgb(10, 10, 10)': '#f8f9fa',
            'rgb(16, 18, 24)': '#f8f9fa',
            'rgb(23, 24, 31)': '#f8f9fa',
            'rgb(0, 0, 0)': '#f8f9fa',
            'rgb(37, 37, 41)': '#e8eaed',
            'rgb(26, 27, 38)': '#f0f1f3',
            // RGBA with opacity
            'rgba(0, 0, 0, 0.4)': 'rgba(255, 255, 255, 0.9)',
            'rgba(0, 0, 0, 0.3)': 'rgba(255, 255, 255, 0.95)',
            'rgba(0, 0, 0, 0.5)': 'rgba(255, 255, 255, 0.85)',
            // HSLA equivalents
            'hsla(0, 0%, 0%, 0.4)': 'hsla(0, 0%, 100%, 0.9)',
            'hsla(0, 0%, 0%, 0.3)': 'hsla(0, 0%, 100%, 0.95)',
          }
          
          const allElements = document.querySelectorAll('*')
          
          allElements.forEach((element) => {
            const htmlElement = element as HTMLElement
            const inlineStyle = htmlElement.getAttribute('style')
            
            if (inlineStyle) {
              let newStyle = inlineStyle
              let changed = false
              
              // Replace all color variations
              Object.entries(colorMap).forEach(([darkColor, lightColor]) => {
                const regex = new RegExp(darkColor.replace(/[()]/g, '\\$&'), 'gi')
                if (regex.test(inlineStyle)) {
                  newStyle = newStyle.replace(regex, lightColor)
                  changed = true
                }
              })
              
              // Additional pattern replacements for CSS properties
              if (changed) {
                newStyle = newStyle
                  .replace(/background-color:\s*#101218/gi, 'background-color: #f8f9fa')
                  .replace(/backgroundColor:\s*#101218/gi, 'backgroundColor: #f8f9fa')
                  .replace(/background:\s*#101218/gi, 'background: #f8f9fa')
                  .replace(/background-color:\s*#17181F/gi, 'background-color: #f8f9fa')
                  .replace(/backgroundColor:\s*#17181F/gi, 'backgroundColor: #f8f9fa')
                  .replace(/background:\s*#17181F/gi, 'background: #f8f9fa')
                
                htmlElement.setAttribute('style', newStyle)
              }
            }
          })
        }
        
        // Debounce the override function
        setTimeout(overrideInlineStyles, 100)
      } else {
        // Restore dark theme inline styles with comprehensive color mapping
        const restoreDarkStyles = () => {
          const colorMap = {
            // Light grays back to dark backgrounds
            '#f8f9fa': '#101218',
            '#f0f1f3': '#1a1b26',
            '#e8eaed': '#252529',
            '#ffffff': '#17181F',
            // RGB equivalents
            'rgb(248, 249, 250)': 'rgb(16, 18, 24)',
            'rgb(240, 241, 243)': 'rgb(26, 27, 38)',
            'rgb(232, 234, 237)': 'rgb(37, 37, 41)',
            'rgb(255, 255, 255)': 'rgb(23, 24, 31)',
            // RGBA with opacity
            'rgba(255, 255, 255, 0.9)': 'rgba(0, 0, 0, 0.4)',
            'rgba(255, 255, 255, 0.95)': 'rgba(0, 0, 0, 0.3)',
            'rgba(255, 255, 255, 0.85)': 'rgba(0, 0, 0, 0.5)',
            // HSLA equivalents
            'hsla(0, 0%, 100%, 0.9)': 'hsla(0, 0%, 0%, 0.4)',
            'hsla(0, 0%, 100%, 0.95)': 'hsla(0, 0%, 0%, 0.3)',
          }
          
          const allElements = document.querySelectorAll('*')
          
          allElements.forEach((element) => {
            const htmlElement = element as HTMLElement
            const inlineStyle = htmlElement.getAttribute('style')
            
            if (inlineStyle) {
              let newStyle = inlineStyle
              let changed = false
              
              // Replace all color variations
              Object.entries(colorMap).forEach(([lightColor, darkColor]) => {
                const regex = new RegExp(lightColor.replace(/[()]/g, '\\$&'), 'gi')
                if (regex.test(inlineStyle)) {
                  newStyle = newStyle.replace(regex, darkColor)
                  changed = true
                }
              })
              
              // Additional pattern replacements for CSS properties
              if (changed) {
                newStyle = newStyle
                  .replace(/background-color:\s*#f8f9fa/gi, 'background-color: #101218')
                  .replace(/backgroundColor:\s*#f8f9fa/gi, 'backgroundColor: #101218')
                  .replace(/background:\s*#f8f9fa/gi, 'background: #101218')
                  .replace(/background-color:\s*#ffffff/gi, 'background-color: #17181F')
                  .replace(/backgroundColor:\s*#ffffff/gi, 'backgroundColor: #17181F')
                  .replace(/background:\s*#ffffff/gi, 'background: #17181F')
                
                htmlElement.setAttribute('style', newStyle)
              }
            }
          })
        }
        
        // Debounce the restoration function
        setTimeout(restoreDarkStyles, 100)
      }
    } else if (path === 'appearance.fontSize') {
      // Apply font size changes
      const sizes = { small: '14px', medium: '16px', large: '18px' }
      document.documentElement.style.fontSize = sizes[value as keyof typeof sizes]
    } else if (path === 'appearance.animationsEnabled') {
      // Toggle animations
      document.documentElement.classList.toggle('no-animations', !value)
    } else if (path === 'appearance.sidebarPosition' || path === 'appearance.chatPosition') {
      // Trigger a custom event for layout changes
      window.dispatchEvent(new CustomEvent('layout-position-changed', { 
        detail: { path, value } 
      }))
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-zinc-800/50">
        <h2 className="text-2xl font-semibold text-white mb-2">Appearance</h2>
        <p className="text-zinc-400">Customize the look and feel of the application</p>
      </div>

      {/* Theme Section */}
      <section className="space-y-0">
        <h3 className="text-lg font-medium text-white mb-6">Theme</h3>
        <div className="space-y-0">
          <SettingSegmentedControl
            label="Color Theme"
            description="Choose your preferred color scheme"
            value={settings.appearance.theme}
            options={THEME_OPTIONS}
            onChange={async (value) => await updateSetting('appearance.theme', value)}
          />
        </div>
      </section>

      {/* Typography Section */}
      <section className="space-y-0">
        <h3 className="text-lg font-medium text-white mb-6">Typography</h3>
        <div className="space-y-0">
          <SettingSegmentedControl
            label="Font Size"
            description="Adjust text size throughout the application"
            value={settings.appearance.fontSize}
            options={FONT_SIZE_OPTIONS}
            onChange={async (value) => await updateSetting('appearance.fontSize', value)}
          />
        </div>
      </section>

      {/* Layout Section */}
      <section className="space-y-0">
        <h3 className="text-lg font-medium text-white mb-6">Layout</h3>
        <div className="space-y-0">
          <SettingSegmentedControl
            label="Sidebar Position"
            description="Choose which side the main sidebar appears on"
            value={settings.appearance.sidebarPosition || 'left'}
            options={POSITION_OPTIONS}
            onChange={async (value) => await updateSetting('appearance.sidebarPosition', value)}
          />
          
          <SettingSegmentedControl
            label="Chat Position"
            description="Choose which side the chat panel appears on"
            value={settings.appearance.chatPosition || 'right'}
            options={POSITION_OPTIONS}
            onChange={async (value) => await updateSetting('appearance.chatPosition', value)}
          />
        </div>
      </section>

      {/* Code Display Section */}
      <section className="space-y-0">
        <h3 className="text-lg font-medium text-white mb-6">Code Display</h3>
        <div className="space-y-0">
          <SettingSelect
            label="Code Theme"
            description="Syntax highlighting theme for code blocks"
            value={settings.appearance.codeTheme}
            options={CODE_THEME_OPTIONS}
            onChange={async (value) => await updateSetting('appearance.codeTheme', value)}
          />
          
          <SettingToggle
            label="Show Line Numbers"
            description="Display line numbers in code blocks"
            value={settings.appearance.showLineNumbers}
            onChange={async (value) => await updateSetting('appearance.showLineNumbers', value)}
          />
        </div>
      </section>

      {/* Animations Section */}
      <section className="space-y-0">
        <h3 className="text-lg font-medium text-white mb-6">Animations & Effects</h3>
        <div className="space-y-0">
          <SettingToggle
            label="Enable Animations"
            description="Show smooth transitions and effects throughout the app"
            value={settings.appearance.animationsEnabled}
            onChange={async (value) => await updateSetting('appearance.animationsEnabled', value)}
          />
          
          <SettingToggle
            label="Compact Mode"
            description="Reduce spacing and padding for a more compact interface"
            value={settings.appearance.compactMode}
            onChange={async (value) => await updateSetting('appearance.compactMode', value)}
          />
        </div>
      </section>
    </div>
  )
}
