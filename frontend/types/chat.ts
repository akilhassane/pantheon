/**
 * Chat and Session Management Types
 * 
 * This file contains all TypeScript interfaces and types for the enhanced chat interface,
 * including session management and task execution functionality.
 */

/**
 * Represents a single chat session with its history and metadata
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
  /** Timestamp when the session was deleted (null if not deleted) */
  deletedAt?: Date | null
  /** Chat message history for this session */
  chatHistory: ChatMessage[]
  /** AI model being used in this session */
  model: string
  /** Custom mode ID (if using a custom mode) */
  customModeId?: string | null
  /** Active users in this session */
  activeUsers: string[]
  /** Whether session is shared */
  isShared: boolean
  /** Share token for collaboration */
  shareToken?: string
  /** Whether this session is part of a collaboration */
  isCollaboration?: boolean
  /** Streaming state for this session */
  streamingStatus?: 'ready' | 'submitted' | 'streaming' | 'error'
  /** Abort controller for this session's streaming */
  abortController?: AbortController
  /** Whether this session is pending backend sync (optimistic creation) */
  _pendingSync?: boolean
}

/**
 * Represents a single chat message
 */
export interface ChatMessage {
  /** Role of the message sender */
  role: 'user' | 'assistant'
  /** Content of the message */
  content: string
  /** Optional intro text (text before command execution) */
  introText?: string
  /** Optional timestamp */
  timestamp?: Date
  /** Optional command execution results */
  commandOutputs?: CommandOutput[]
  /** Optional media blocks for rich content (code, images, tables, etc.) */
  mediaBlocks?: import('./media').MediaBlock[]
  /** Optional image attachments */
  images?: ImageAttachment[]
  /** Optional thinking process (for streaming thinking display) */
  thinkingProcess?: string
  /** Optional file attachments */
  attachments?: FileAttachment[]
}

/**
 * File attachment in a message
 */
export interface FileAttachment {
  /** File name */
  name: string
  /** File type */
  type: 'image' | 'video' | 'text' | 'other'
  /** MIME type */
  mimeType: string
  /** File data (base64 or text content) */
  data: string
  /** File size in bytes */
  size: number
}

/**
 * Represents the result of a command execution
 */
export interface CommandOutput {
  /** The command that was executed */
  command: string
  /** The output from the command */
  output: string
  /** Status of the command execution */
  status?: 'success' | 'error' | 'timeout'
  /** Exit code */
  exitCode?: number
  /** Execution duration in milliseconds */
  duration?: number
}

/**
 * Represents a collection of tasks
 */
export interface TaskList {
  /** Unique identifier for the task list */
  id: string
  /** Display name of the task list */
  name: string
  /** Array of tasks in this list */
  tasks: Task[]
  /** Optional description */
  description?: string
}

/**
 * Represents a single executable task
 */
export interface Task {
  /** Unique identifier for the task */
  id: string
  /** Display title of the task */
  title: string
  /** Optional command to execute */
  command?: string
  /** Optional description of what the task does */
  description?: string
  /** Current status of the task */
  status: TaskStatus
  /** Result of task execution (if completed or failed) */
  result?: string
  /** Error message (if failed) */
  error?: string
}

/**
 * Possible states for a task
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

/**
 * Data structure for storing sessions in localStorage
 */
export interface StoredSessions {
  /** Array of all sessions */
  sessions: Session[]
  /** ID of the currently active session */
  activeSessionId: string
  /** Timestamp of last update */
  lastUpdated: Date
}

/**
 * Data structure for storing task lists in localStorage
 */
export interface StoredTaskLists {
  /** Array of all task lists */
  taskLists: TaskList[]
  /** Timestamp of last update */
  lastUpdated: Date
}

/**
 * Props for confirmation dialog component
 */
export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Title of the dialog */
  title: string
  /** Message to display */
  message: string
  /** Text for confirm button */
  confirmText?: string
  /** Text for cancel button */
  cancelText?: string
  /** Callback when confirmed */
  onConfirm: () => void
  /** Callback when cancelled */
  onCancel: () => void
}

/**
 * Props for toast notification
 */
export interface ToastNotification {
  /** Unique ID for the toast */
  id: string
  /** Type of notification */
  type: 'success' | 'error' | 'info' | 'warning'
  /** Message to display */
  message: string
  /** Duration in milliseconds (0 for persistent) */
  duration?: number
}

/**
 * Image attachment in a message
 */
export interface ImageAttachment {
  /** Unique identifier */
  id: string
  /** Image URL */
  url: string
  /** Alt text */
  alt?: string
  /** Thumbnail URL */
  thumbnail?: string
  /** Image width */
  width?: number
  /** Image height */
  height?: number
}

/**
 * Media block types
 */
export type MediaBlockType = 
  | 'command'
  | 'command-execution'
  | 'code'
  | 'file'
  | 'image'
  | 'session-suggestion'
  | 'error'
  | 'thinking'
  | 'crud'
  | 'mermaid'
  | 'json'
  | 'chart'
  | 'table'
  | 'desktop-tool'
  | 'screenshot'
  | 'text'

/**
 * Base media block interface
 */
export interface MediaBlock {
  /** Unique identifier */
  id: string
  /** Type of media block */
  type: MediaBlockType
  /** Block data (varies by type) */
  data: CommandBlockData | CommandExecutionBlockData | CodeBlockData | FileBlockData | ImageBlockData | ErrorBlockData | ThinkingBlockData | CRUDBlockData | MermaidBlockData | SessionSuggestionBlockData | JSONBlockData | ChartBlockData | TableBlockData | DesktopToolBlockData | ScreenshotBlockData | TextBlockData
  /** Optional timestamp */
  timestamp?: Date
  /** Whether block is focused */
  focused?: boolean
}

/**
 * Command output block data
 */
export interface CommandBlockData {
  /** The command that was executed */
  command: string
  /** The output from the command */
  output: string
  /** Status of the command execution */
  status: 'success' | 'error' | 'timeout'
  /** Exit code */
  exitCode?: number
  /** Execution duration in milliseconds */
  duration?: number
}

/**
 * Command execution block data (for loading state)
 */
export interface CommandExecutionBlockData {
  /** The command being executed */
  command: string
  /** Execution status */
  status: 'pending' | 'executing' | 'completed' | 'error'
  /** The output from the command (when completed) */
  output?: string
  /** Exit code (when completed) */
  exitCode?: number
  /** Execution duration in milliseconds (when completed) */
  duration?: number
}

/**
 * Desktop tool block data (for desktop mode vision/action tools)
 */
export interface DesktopToolBlockData {
  /** The tool name */
  toolName: string
  /** Tool arguments */
  args: Record<string, any>
  /** The output from the tool */
  output: string
  /** Status of the tool execution */
  status: 'success' | 'error' | 'pending'
  /** Execution duration in milliseconds */
  duration?: number | null
  /** Optional image data (base64) */
  imageData?: string
}

/**
 * Screenshot block data (for desktop mode screenshots)
 */
export interface ScreenshotBlockData {
  /** Screen data from Windows API */
  screenData: any
  /** Optional image data (base64) */
  imageData?: string
  /** Screenshot timestamp */
  timestamp: string
}

/**
 * Code block data
 */
export interface CodeBlockData {
  /** Code content */
  code: string
  /** Programming language */
  language: string
  /** Optional filename */
  filename?: string
  /** Starting line number */
  startLine?: number
  /** Ending line number */
  endLine?: number
}

/**
 * File block data
 */
export interface FileBlockData {
  /** File path */
  path: string
  /** File content */
  content: string
  /** Programming language for syntax highlighting */
  language?: string
  /** File operation type */
  operation?: 'read' | 'write' | 'create' | 'delete'
  /** Whether file was modified */
  modified?: boolean
}

/**
 * Image block data
 */
export interface ImageBlockData {
  /** Image URL */
  url: string
  /** Alt text */
  alt?: string
  /** Image width */
  width?: number
  /** Image height */
  height?: number
}

/**
 * Error block data
 */
export interface ErrorBlockData {
  /** Error message */
  message: string
  /** Error type */
  type?: string
  /** Stack trace */
  stack?: string
  /** Error code */
  code?: string
}

/**
 * Thinking block data
 */
export interface ThinkingBlockData {
  /** Thinking steps */
  steps: ThinkingStep[]
  /** Whether block is collapsed */
  collapsed?: boolean
}

/**
 * Individual thinking step
 */
export interface ThinkingStep {
  /** Step description */
  description: string
  /** Tool calls made in this step */
  toolCalls?: string[]
  /** Step timestamp */
  timestamp?: Date
}

/**
 * CRUD operation block data
 */
export interface CRUDBlockData {
  /** Operation type */
  operation: 'create' | 'read' | 'update' | 'delete'
  /** Resource identifier */
  resource: string
  /** Operation data */
  data?: any
  /** Before data (for updates) */
  beforeData?: any
  /** After data (for updates) */
  afterData?: any
  /** Operation status */
  status: 'success' | 'error'
  /** Operation timestamp */
  timestamp?: Date
  /** Session state ID for restoration */
  sessionStateId?: string
  /** Change details */
  changes?: ChangeDetail[]
}

/**
 * Change detail for CRUD operations
 */
export interface ChangeDetail {
  /** Field name */
  field: string
  /** Before value */
  before: any
  /** After value */
  after: any
  /** Change type */
  type: 'added' | 'modified' | 'removed'
}

/**
 * Mermaid diagram block data
 */
export interface MermaidBlockData {
  /** Mermaid code */
  code: string
  /** Diagram type */
  diagramType?: string
  /** Render error message */
  renderError?: string
}

/**
 * Session suggestion block data
 */
export interface SessionSuggestionBlockData {
  /** Current message count */
  messageCount: number
  /** Whether the suggestion was dismissed */
  dismissed?: boolean
}

/**
 * Session state for CRUD restoration
 */
export interface SessionState {
  /** Unique identifier */
  id: string
  /** State timestamp */
  timestamp: Date
  /** CRUD operations up to this state */
  crudOperations: CRUDBlockData[]
  /** State snapshot */
  snapshot: any
}

/**
 * JSON block data
 */
export interface JSONBlockData {
  /** JSON data */
  data: any
  /** Whether block is collapsed */
  collapsed?: boolean
}

/**
 * Chart block data
 */
export interface ChartBlockData {
  /** Chart type */
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'radar'
  /** Chart data */
  data: any[]
  /** X-axis key */
  xKey?: string
  /** Y-axis keys */
  yKeys?: string[]
  /** Chart colors */
  colors?: string[]
  /** Chart title */
  title?: string
}

/**
 * Table block data
 */
export interface TableBlockData {
  /** Table headers */
  headers: string[]
  /** Table rows */
  rows: string[][]
  /** Optional caption */
  caption?: string
}

/**
 * Text block data (for plain text between tool calls)
 */
export interface TextBlockData {
  /** Text content */
  text: string
}
