/**
 * Hook to manage layout settings (sidebar positions)
 */

import { useState, useEffect } from 'react'
import { SettingsManager } from '@/utils/settingsManager'

export function useLayoutSettings() {
  const [sidebarPosition, setSidebarPosition] = useState<'left' | 'right'>('left')
  const [chatPosition, setChatPosition] = useState<'left' | 'right'>('right')

  useEffect(() => {
    // Load initial settings
    const settings = SettingsManager.load()
    const initialSidebarPos = (settings.appearance as any).sidebarPosition || 'left'
    const initialChatPos = (settings.appearance as any).chatPosition || 'right'
    
    setSidebarPosition(initialSidebarPos)
    setChatPosition(initialChatPos)

    // Listen for layout position changes
    const handleLayoutChange = (event: CustomEvent) => {
      const { path, value } = event.detail
      
      if (path === 'appearance.sidebarPosition') {
        setSidebarPosition(value)
      } else if (path === 'appearance.chatPosition') {
        setChatPosition(value)
      }
    }

    window.addEventListener('layout-position-changed', handleLayoutChange as EventListener)

    // Also listen for storage changes (for cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'app-settings' && e.newValue !== e.oldValue) {
        const settings = SettingsManager.load()
        const newSidebarPos = (settings.appearance as any).sidebarPosition || 'left'
        const newChatPos = (settings.appearance as any).chatPosition || 'right'
        
        // Only update if values actually changed
        setSidebarPosition(prev => prev !== newSidebarPos ? newSidebarPos : prev)
        setChatPosition(prev => prev !== newChatPos ? newChatPos : prev)
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('layout-position-changed', handleLayoutChange as EventListener)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  return { sidebarPosition, chatPosition }
}
