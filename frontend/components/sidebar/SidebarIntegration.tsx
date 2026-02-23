'use client'

/**
 * Sidebar Integration Component
 * This component manages all sidebar panel states and provides the UI components
 * Import this into page.tsx and use the hook + components
 */

import React, { useState } from 'react'
import { Session } from '@/types/chat'
import { AppSettings } from '@/types/sidebar'
import { useGlobalShortcuts } from '@/hooks/useKeyboardShortcuts'
import SearchModal from './SearchModal'
import HistoryPanel from './HistoryPanel'
import ProjectExplorer from './ProjectExplorer'
import VoiceInput from './VoiceInput'
import SettingsPanel from './SettingsPanel'

interface UseSidebarPanelsProps {
  sessions: Session[]
  activeSessionId: string | null
  onSessionSelect: (sessionId: string) => void
  onSessionDelete: (sessionId: string) => void
  onSessionRename: (sessionId: string, newName: string) => void
  onSessionDuplicate: (sessionId: string) => void
  onVoiceTranscription: (text: string) => void
}

export function useSidebarPanels({
  sessions,
  activeSessionId,
  onSessionSelect,
  onSessionDelete,
  onSessionRename,
  onSessionDuplicate,
  onVoiceTranscription
}: UseSidebarPanelsProps) {
  // Panel states
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false)
  const [projectExplorerOpen, setProjectExplorerOpen] = useState(false)
  const [voiceInputActive, setVoiceInputActive] = useState(false)
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)

  // Settings state
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    fontSize: 'medium',
    sidebarBehavior: 'hover',
    defaultModel: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2048,
    keyboardShortcuts: {},
    autoSave: true,
    debugMode: false
  })

  // Keyboard shortcuts
  useGlobalShortcuts({
    onSearch: () => setSearchModalOpen(true),
    onHistory: () => setHistoryPanelOpen(prev => !prev),
    onProject: () => setProjectExplorerOpen(prev => !prev),
    onVoice: () => setVoiceInputActive(true),
    onSettings: () => setSettingsPanelOpen(true)
  })

  // Handlers
  const handleSearchResultClick = (sessionId: string, messageIndex: number) => {
    onSessionSelect(sessionId)
    // TODO: Scroll to message at messageIndex
  }

  const handleFileSelect = (filePath: string) => {
    console.log('File selected:', filePath)
    // TODO: Insert file reference into chat input
  }

  const handleFilePreview = (filePath: string) => {
    console.log('File preview:', filePath)
    // TODO: Show file preview
  }

  const handleVoiceTranscription = (text: string) => {
    onVoiceTranscription(text)
    setVoiceInputActive(false)
  }

  const handleVoiceError = (error: Error) => {
    console.error('Voice input error:', error)
    setVoiceInputActive(false)
  }

  const handleVoiceCancel = () => {
    setVoiceInputActive(false)
  }

  const handleSettingsChange = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
    // TODO: Persist settings to localStorage
  }

  return {
    // States
    searchModalOpen,
    historyPanelOpen,
    projectExplorerOpen,
    voiceInputActive,
    settingsPanelOpen,
    settings,
    
    // Setters
    setSearchModalOpen,
    setHistoryPanelOpen,
    setProjectExplorerOpen,
    setVoiceInputActive,
    setSettingsPanelOpen,
    
    // Handlers
    handleSearchResultClick,
    handleFileSelect,
    handleFilePreview,
    handleVoiceTranscription,
    handleVoiceError,
    handleVoiceCancel,
    handleSettingsChange
  }
}

interface SidebarPanelsProps {
  panels: ReturnType<typeof useSidebarPanels>
  sessions: Session[]
  activeSessionId: string | null
  onSessionSelect: (sessionId: string) => void
  onSessionDelete: (sessionId: string) => void
  onSessionRename: (sessionId: string, newName: string) => void
  onSessionDuplicate: (sessionId: string) => void
}

export function SidebarPanels({
  panels,
  sessions,
  activeSessionId,
  onSessionSelect,
  onSessionDelete,
  onSessionRename,
  onSessionDuplicate
}: SidebarPanelsProps) {
  return (
    <>
      <SearchModal
        isOpen={panels.searchModalOpen}
        onClose={() => panels.setSearchModalOpen(false)}
        sessions={sessions}
        onResultClick={panels.handleSearchResultClick}
      />

      <HistoryPanel
        isOpen={panels.historyPanelOpen}
        onClose={() => panels.setHistoryPanelOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSessionSelect={onSessionSelect}
        onSessionDelete={onSessionDelete}
        onSessionRename={onSessionRename}
        onSessionDuplicate={onSessionDuplicate}
      />

      <ProjectExplorer
        isOpen={panels.projectExplorerOpen}
        onClose={() => panels.setProjectExplorerOpen(false)}
        rootPath="/"
        onFileSelect={panels.handleFileSelect}
        onFilePreview={panels.handleFilePreview}
      />

      <VoiceInput
        isActive={panels.voiceInputActive}
        onTranscriptionComplete={panels.handleVoiceTranscription}
        onError={panels.handleVoiceError}
        onCancel={panels.handleVoiceCancel}
      />

      <SettingsPanel
        isOpen={panels.settingsPanelOpen}
        onClose={() => panels.setSettingsPanelOpen(false)}
        settings={panels.settings}
        onSettingsChange={panels.handleSettingsChange}
      />
    </>
  )
}
