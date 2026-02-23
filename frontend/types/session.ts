/**
 * Session and Terminal Context Types
 * 
 * Extended session types with terminal binding and workspace organization
 */

import { ChatMessage } from './chat'

/**
 * Project - Represents a separate OS instance (Kali container)
 * Each project has its own terminal/OS and can contain multiple chat sessions
 */
export interface Project {
  /** Unique identifier */
  id: string
  /** Project name */
  name: string
  /** Optional description */
  description?: string
  /** Color for visual identification */
  color?: string
  /** Container ID for this project's OS */
  containerId: string
  /** Container name */
  containerName: string
  /** Terminal process ID */
  terminalPid?: number
  /** Tmux session name */
  tmuxSessionName?: string
  /** Current working directory */
  workingDirectory?: string
  /** Terminal port (ttyd/gotty) */
  terminalPort: number
  /** Public terminal URL (e.g., Cloudflare tunnel URL for remote terminal access) */
  terminalUrl?: string
  /** VNC port for desktop access */
  vncPort: number
  /** noVNC web port for browser-based desktop access */
  novncPort: number
  /** Public VNC URL (e.g., Cloudflare tunnel URL for remote access) */
  vncUrl?: string
  /** Operating system (e.g., 'kali-linux', 'ubuntu-24') */
  operatingSystem?: string
  /** Session IDs belonging to this project */
  sessionIds: string[]
  /** Creation timestamp */
  createdAt: Date
  /** Last active timestamp */
  lastActive: Date
  /** Whether project is running */
  isRunning?: boolean
  /** Project status */
  status?: string
  /** Owner user ID */
  ownerId?: string
  /** Whether this is a mock project (no Docker container) */
  isMock?: boolean
}

/**
 * Session - Chat session that belongs to a project
 * Multiple sessions can share the same project/OS
 */
export interface Session {
  /** Unique identifier for the session */
  id: string
  /** Display name of the session */
  name: string
  /** Project ID this session belongs to */
  projectId: string
  /** Timestamp when the session was created */
  createdAt: Date
  /** Timestamp of the last activity in this session */
  lastActive: Date
  /** Chat message history for this session */
  chatHistory: ChatMessage[]
  /** AI model being used in this session */
  model: string
  
  // Collaboration
  /** Active users in this session */
  activeUsers: string[]
  /** Whether session is shared */
  isShared: boolean
  /** Share token for collaboration */
  shareToken?: string
}

/**
 * Workspace for organizing projects (deprecated - using Project instead)
 */
export interface Workspace {
  /** Unique identifier */
  id: string
  /** Workspace name */
  name: string
  /** Optional description */
  description?: string
  /** Color for visual identification */
  color?: string
  /** Session IDs in this workspace */
  sessionIds: string[]
  /** Creation timestamp */
  createdAt: Date
  /** Last active timestamp */
  lastActive: Date
}

/**
 * Terminal information
 */
export interface TerminalInfo {
  /** Process ID */
  pid: number
  /** Tmux session name */
  tmuxSessionName: string
  /** Current working directory */
  workingDirectory: string
  /** Shell being used */
  shell: string
  /** Number of active users */
  activeUsers: number
  /** Connection status */
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting'
  /** Last executed command */
  lastCommand?: string
  /** Last command timestamp */
  lastCommandTime?: Date
}

/**
 * Session creation request
 */
export interface CreateSessionRequest {
  /** Session name */
  name: string
  /** Workspace ID (optional) */
  workspaceId?: string
  /** Initial model */
  model?: string
}

/**
 * Session creation response
 */
export interface CreateSessionResponse {
  /** Created session */
  session: Session
  /** Terminal PID */
  terminalPid: number
}

/**
 * Session update request
 */
export interface UpdateSessionRequest {
  /** New name (optional) */
  name?: string
  /** New workspace ID (optional) */
  workspaceId?: string
  /** New model (optional) */
  model?: string
}

/**
 * Terminal operation request
 */
export interface TerminalOperationRequest {
  /** Session ID */
  sessionId: string
  /** Operation type */
  operation: 'new-window' | 'split-horizontal' | 'split-vertical' | 'execute'
  /** Command to execute (for execute operation) */
  command?: string
}

/**
 * Terminal operation response
 */
export interface TerminalOperationResponse {
  /** Success status */
  success: boolean
  /** Window/pane ID (for new-window and split operations) */
  id?: number
  /** Command output (for execute operation) */
  output?: string
  /** Exit code (for execute operation) */
  exitCode?: number
}

/**
 * Share session request
 */
export interface ShareSessionRequest {
  /** Session ID */
  sessionId: string
}

/**
 * Share session response
 */
export interface ShareSessionResponse {
  /** Share token */
  shareToken: string
  /** Share URL */
  shareUrl: string
}

/**
 * Join session request
 */
export interface JoinSessionRequest {
  /** Share token */
  shareToken: string
}

/**
 * Join session response
 */
export interface JoinSessionResponse {
  /** Session */
  session: Session
}

/**
 * Active user in a session
 */
export interface ActiveUser {
  /** User ID */
  id: string
  /** User name */
  name: string
  /** User color for identification */
  color: string
  /** Last activity timestamp */
  lastActive: Date
}

/**
 * Session export format
 */
export interface SessionExport {
  /** Session metadata */
  session: Omit<Session, 'terminalPid' | 'tmuxSessionName' | 'activeUsers' | 'shareToken'>
  /** Export timestamp */
  exportedAt: Date
  /** Export format version */
  version: string
}
