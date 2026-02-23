'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { ModelSettings } from '@/components/settings/ModelSettings'
import { ModesSettings } from '@/components/settings/ModesSettings'
import { OperatingSystemsSettings } from '@/components/settings/OperatingSystemsSettings'
import { AppearanceSettings } from '@/components/settings/AppearanceSettings'
import { BehaviorSettings } from '@/components/settings/BehaviorSettings'
import { KeyboardSettings } from '@/components/settings/KeyboardSettings'
import { AdvancedSettings } from '@/components/settings/AdvancedSettings'
import { useLayoutSettings } from '@/hooks/useLayoutSettings'
import { keycloakAuth } from '@/lib/keycloak-auth'

type SettingsCategory = 'models' | 'modes' | 'os' | 'appearance' | 'behavior' | 'keyboard' | 'advanced'

export default function SettingsPage() {
  const router = useRouter()
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('models')
  const { sidebarPosition } = useLayoutSettings()
  const [isAuthChecking, setIsAuthChecking] = useState(true)
  const [user, setUser] = useState<any>(null)

  // Check auth state on mount and persist across refreshes
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await keycloakAuth.getSession()
        if (!session?.user) {
          // Not authenticated, redirect to home
          router.push('/')
        } else {
          setUser(session.user)
          setIsAuthChecking(false)
        }
      } catch (error) {
        console.error('Auth check error:', error)
        router.push('/')
      }
    }

    checkAuth()

    // Listen for auth changes
    const unsubscribe = keycloakAuth.onAuthStateChange((session) => {
      if (!session?.user) {
        router.push('/')
      } else {
        setUser(session.user)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [router])

  // Show loading state while checking auth
  if (isAuthChecking) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a] text-white">
        <div className="text-zinc-400">Loading...</div>
      </div>
    )
  }

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
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white settings-page-container animate-fadeIn">
      {/* Header - Sticky */}
      <div className="sticky top-0 z-50 flex items-center gap-4 px-6 py-4 border-b border-zinc-800 bg-[#0a0a0a]">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-all duration-200 hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold ml-4">Settings</h1>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden" style={{ flexDirection: sidebarPosition === 'left' ? 'row' : 'row-reverse' }}>
        {/* Navigation Sidebar */}
        <SettingsNav
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          user={user}
        />

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 px-8 py-8 overflow-y-auto">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}
