import { useEffect } from 'react'

interface KeyboardShortcutsConfig {
  onSearch?: () => void
  onNewSession?: () => void
  onNewTerminal?: () => void
  onToggleSidebar?: () => void
  onSettings?: () => void
  onHistory?: () => void
  onProject?: () => void
  onVoice?: () => void
}

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modifier = isMac ? event.metaKey : event.ctrlKey

      // Ctrl/Cmd + K - Search
      if (modifier && event.key === 'k') {
        event.preventDefault()
        config.onSearch?.()
      }

      // Ctrl/Cmd + N - New Session
      if (modifier && event.key === 'n' && !event.shiftKey) {
        event.preventDefault()
        config.onNewSession?.()
      }

      // Ctrl/Cmd + Shift + N - New Terminal
      if (modifier && event.shiftKey && event.key === 'N') {
        event.preventDefault()
        config.onNewTerminal?.()
      }

      // Ctrl/Cmd + B - Toggle Sidebar
      if (modifier && event.key === 'b') {
        event.preventDefault()
        config.onToggleSidebar?.()
      }

      // Ctrl/Cmd + , - Settings
      if (modifier && event.key === ',') {
        event.preventDefault()
        config.onSettings?.()
      }

      // Ctrl/Cmd + H - History
      if (modifier && event.key === 'h') {
        event.preventDefault()
        config.onHistory?.()
      }

      // Ctrl/Cmd + P - Project
      if (modifier && event.key === 'p') {
        event.preventDefault()
        config.onProject?.()
      }

      // Ctrl + Shift + V - Voice
      if (event.ctrlKey && event.shiftKey && event.key === 'V') {
        event.preventDefault()
        config.onVoice?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [config])
}

export function useGlobalShortcuts(config: KeyboardShortcutsConfig) {
  return useKeyboardShortcuts(config)
}
