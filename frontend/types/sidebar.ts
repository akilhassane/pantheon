/**
 * Sidebar Component Types and Interfaces
 */

import { Session, Workspace, TerminalInfo } from './session'

// ============================================================================
// Search Related Interfaces
// ============================================================================

export interface SearchResult {
  sessionId: string
  sessionName: string
  messageIndex: number
  messageRole: 'user' | 'assistant'
  messageContent: string
  matchedText: string
  contextBefore: string
  contextAfter: string
  timestamp: Date
  relevanceScore: number
}

export interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  sessions: Session[]
  onResultClick: (sessionId: string, messageIndex: number) => void
}

// ============================================================================
// History Panel Interfaces
// ============================================================================

export interface HistoryPanelProps {
  isOpen: boolean
  onClose: () => void
  sessions: Session[]
  activeSessionId: string | null
  onSessionSelect: (sessionId: string) => void
  onSessionDelete: (sessionId: string) => void
  onSessionRename: (sessionId: string, newName: string) => void
  onSessionDuplicate: (sessionId: string) => void
}

export type SessionGroup = 'today' | 'yesterday' | 'last7days' | 'older'

export interface GroupedSessions {
  today: Session[]
  yesterday: Session[]
  last7days: Session[]
  older: Session[]
}

// ============================================================================
// File Explorer Interfaces
// ============================================================================

export interface FileSystemNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: Date
  children?: FileSystemNode[]
  isExpanded?: boolean
}

export interface ProjectExplorerProps {
  isOpen: boolean
  onClose: () => void
  rootPath: string
  onFileSelect: (filePath: string) => void
  onFilePreview: (filePath: string) => void
}

// ============================================================================
// Voice Input Interfaces
// ============================================================================

export interface VoiceInputProps {
  isActive: boolean
  onTranscriptionComplete: (text: string) => void
  onError: (error: Error) => void
  onCancel: () => void
}

export interface VoiceRecordingState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioLevel: number
  error: string | null
}

// ============================================================================
// Settings Panel Interfaces
// ============================================================================

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto'
  fontSize: 'small' | 'medium' | 'large'
  sidebarBehavior: 'hover' | 'click' | 'always-expanded'
  defaultModel: string
  temperature: number
  maxTokens: number
  keyboardShortcuts: Record<string, string>
  autoSave: boolean
  debugMode: boolean
}

export interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  settings: AppSettings
  onSettingsChange: (settings: Partial<AppSettings>) => void
}

export type SettingsTab = 'appearance' | 'models' | 'shortcuts' | 'privacy' | 'advanced'

// ============================================================================
// Sidebar Button Interfaces
// ============================================================================

export interface SidebarButtonProps {
  icon: React.ReactNode
  label: string
  isActive?: boolean
  isDisabled?: boolean
  badge?: number | string
  onClick: () => void
  tooltip?: string
  href?: string
}

// ============================================================================
// Keyboard Shortcuts Interfaces
// ============================================================================

export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  cmd?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  description: string
}

export interface KeyboardShortcutsConfig {
  search: string
  history: string
  project: string
  voice: string
  settings: string
}

// ============================================================================
// Context Menu Interfaces
// ============================================================================

export interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
  separator?: boolean
}

export interface ContextMenuProps {
  items: ContextMenuItem[]
  position: { x: number; y: number }
  onClose: () => void
}


// ============================================================================
// Workspace Interfaces
// ============================================================================

export interface WorkspacesListProps {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  onWorkspaceSelect: (workspaceId: string) => void
  onWorkspaceCreate: (name: string) => void
  onWorkspaceDelete: (workspaceId: string) => void
}

// ============================================================================
// Sessions List Interfaces
// ============================================================================

export interface SessionsListProps {
  sessions: Session[]
  activeSessionId: string | null
  workspaceId?: string | null
  onSessionSelect: (sessionId: string) => void
  onSessionCreate: () => void
  onSessionDelete: (sessionId: string) => void
  onSessionRename: (sessionId: string, newName: string) => void
}

// ============================================================================
// Terminal Actions Interfaces
// ============================================================================

export interface TerminalActionsProps {
  currentSessionId: string | null
  onNewWindow: () => void
  onSplitHorizontal: () => void
  onSplitVertical: () => void
  onShowInfo: () => void
}

// ============================================================================
// Session Info Interfaces
// ============================================================================

export interface SessionInfoProps {
  session: Session | null
  terminalInfo: TerminalInfo | null
}

// ============================================================================
// App Sidebar Interfaces
// ============================================================================

export interface AppSidebarProps {
  sessions: Session[]
  workspaces: Workspace[]
  activeSessionId: string | null
  activeWorkspaceId: string | null
  onSessionSelect: (sessionId: string) => void
  onWorkspaceSelect: (workspaceId: string) => void
}
