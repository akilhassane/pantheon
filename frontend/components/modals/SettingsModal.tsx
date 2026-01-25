'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { ModelSettings } from '@/components/settings/ModelSettings'
import { ModesSettings } from '@/components/settings/ModesSettings'
import { OperatingSystemsSettings } from '@/components/settings/OperatingSystemsSettings'
import { AppearanceSettings } from '@/components/settings/AppearanceSettings'
import { BehaviorSettings } from '@/components/settings/BehaviorSettings'
import { KeyboardSettings } from '@/components/settings/KeyboardSettings'
import { AdvancedSettings } from '@/components/settings/AdvancedSettings'
import { useLayoutSettings } from '@/hooks/useLayoutSettings'
import type { User } from '@supabase/supabase-js'

type SettingsCategory = 'models' | 'modes' | 'os' | 'appearance' | 'behavior' | 'keyboard' | 'advanced'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  user?: User | null
}

export function SettingsModal({ isOpen, onClose, user }: SettingsModalProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('models')
  const [isClosing, setIsClosing] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isContentVisible, setIsContentVisible] = useState(true)
  const { sidebarPosition } = useLayoutSettings()

  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the component is mounted before animating
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 10)
      return () => clearTimeout(timer)
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  const handleCategoryChange = (category: SettingsCategory) => {
    // Fade out current content
    setIsContentVisible(false)
    
    // Wait for fade out, then change category and fade in
    setTimeout(() => {
      setActiveCategory(category)
      requestAnimationFrame(() => {
        setIsContentVisible(true)
      })
    }, 150)
  }

  const handleClose = () => {
    setIsClosing(true)
    setIsVisible(false)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 300)
  }

  if (!isOpen && !isClosing) return null

  const renderContent = () => {
    switch (activeCategory) {
      case 'models':
        return <ModelSettings />
      case 'modes':
        return <ModesSettings />
      case 'os':
        return <OperatingSystemsSettings />
      case 'appearance':
        return <AppearanceSettings />
      case 'behavior':
        return <BehaviorSettings />
      case 'keyboard':
        return <KeyboardSettings />
      case 'advanced':
        return <AdvancedSettings />
      default:
        return <ModelSettings />
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-200"
      style={{
        opacity: isVisible ? 1 : 0,
      }}
    >
      <div 
        className="w-full h-full max-w-7xl max-h-[90vh] bg-[#0a0a0a] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-zinc-800 transition-all duration-300 ease-out"
        style={{
          transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(20px)',
          opacity: isVisible ? 1 : 0,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#0a0a0a]">
          <h1 className="text-xl font-semibold text-white">Settings</h1>
          <button
            onClick={handleClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-1 overflow-hidden" style={{ flexDirection: sidebarPosition === 'left' ? 'row' : 'row-reverse' }}>
          {/* Navigation Sidebar */}
          <SettingsNav
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
            user={user}
          />

          {/* Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div 
              className="flex-1 px-8 py-8 overflow-y-auto transition-all duration-200"
              style={{
                opacity: isContentVisible ? 1 : 0,
                transform: isContentVisible ? 'translateX(0)' : 'translateX(10px)',
              }}
            >
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
