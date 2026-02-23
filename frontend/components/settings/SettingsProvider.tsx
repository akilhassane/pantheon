'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { SettingsManager } from '@/utils/settingsManager'
import { AppSettings } from '@/types/settings'

interface SettingsContextType {
  settings: AppSettings
  updateSetting: (path: string, value: any) => void
  resetSettings: () => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(SettingsManager.load())

  const updateSetting = (path: string, value: any) => {
    const updated = SettingsManager.update(path, value)
    setSettings(updated)
  }

  const resetSettings = () => {
    const reset = SettingsManager.reset()
    setSettings(reset)
  }

  // Apply settings on mount and when they change
  useEffect(() => {
    applySettings(settings)
  }, [settings])

  const applySettings = (settings: AppSettings) => {
    // Apply theme
    document.documentElement.setAttribute('data-theme', settings.appearance.theme)
    
    // Also update the class for better compatibility
    const isLight = settings.appearance.theme === 'light' || 
      (settings.appearance.theme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches)
    
    if (settings.appearance.theme === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else if (settings.appearance.theme === 'light') {
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
    
    // Override inline styles for light theme with gray shades
    if (isLight) {
      // Find all elements with dark inline background colors and update them
      const darkBackgrounds = ['#0a0a0a', '#101218', '#000000', 'rgb(10, 10, 10)', 'rgb(16, 18, 24)', 'rgb(0, 0, 0)']
      const lightGray = '#f8f9fa'  // Very light gray instead of white
      const allElements = document.querySelectorAll('*')
      
      allElements.forEach((element) => {
        const htmlElement = element as HTMLElement
        const inlineStyle = htmlElement.getAttribute('style')
        
        if (inlineStyle) {
          darkBackgrounds.forEach(darkColor => {
            if (inlineStyle.includes(darkColor)) {
              // Replace dark backgrounds with light gray
              const newStyle = inlineStyle
                .replace(new RegExp(darkColor, 'gi'), lightGray)
                .replace(/background-color:\s*#101218/gi, `background-color: ${lightGray}`)
                .replace(/backgroundColor:\s*#101218/gi, `backgroundColor: ${lightGray}`)
                .replace(/background:\s*#101218/gi, `background: ${lightGray}`)
              
              htmlElement.setAttribute('style', newStyle)
            }
          })
        }
      })
    }
    
    // Apply font size
    const sizes = { small: '14px', medium: '16px', large: '18px' }
    document.documentElement.style.fontSize = sizes[settings.appearance.fontSize]
    
    // Apply animations
    if (!settings.appearance.animationsEnabled) {
      document.documentElement.classList.add('no-animations')
    } else {
      document.documentElement.classList.remove('no-animations')
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
