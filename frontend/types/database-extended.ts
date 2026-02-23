/**
 * Extended Database Types for Complete Supabase Integration
 * 
 * This file contains TypeScript types for all new tables added in the
 * complete integration migration.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      // Existing tables (from previous migration)
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          owner_id: string
          container_id: string
          container_name: string
          terminal_port: number
          vnc_port: number
          novnc_port: number
          status: 'creating' | 'running' | 'stopped' | 'error' | 'restarting'
          created_at: string
          last_active: string
        }
        Insert: {
          id: string
          name: string
          description?: string | null
          owner_id: string
          container_id: string
          container_name: string
          terminal_port: number
          vnc_port: number
          novnc_port: number
          status?: 'creating' | 'running' | 'stopped' | 'error' | 'restarting'
          created_at?: string
          last_active?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          owner_id?: string
          container_id?: string
          container_name?: string
          terminal_port?: number
          vnc_port?: number
          novnc_port?: number
          status?: 'creating' | 'running' | 'stopped' | 'error' | 'restarting'
          created_at?: string
          last_active?: string
        }
      }
      sessions: {
        Row: {
          id: string
          name: string
          project_id: string
          user_id: string
          model: string
          created_at: string
          last_active: string
        }
        Insert: {
          id: string
          name: string
          project_id: string
          user_id: string
          model: string
          created_at?: string
          last_active?: string
        }
        Update: {
          id?: string
          name?: string
          project_id?: string
          user_id?: string
          model?: string
          created_at?: string
          last_active?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          session_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          timestamp: string
        }
        Insert: {
          id?: string
          session_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          timestamp?: string
        }
        Update: {
          id?: string
          session_id?: string
          role?: 'user' | 'assistant' | 'system'
          content?: string
          timestamp?: string
        }
      }
      // New tables from complete integration
      task_lists: {
        Row: {
          id: string
          project_id: string
          name: string
          description: string | null
          created_by: string
          created_at: string
          last_updated: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          description?: string | null
          created_by: string
          created_at?: string
          last_updated?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          description?: string | null
          created_by?: string
          created_at?: string
          last_updated?: string
        }
      }
      tasks: {
        Row: {
          id: string
          task_list_id: string
          title: string
          description: string | null
          command: string | null
          status: 'pending' | 'running' | 'completed' | 'failed'
          result: string | null
          error: string | null
          created_at: string
          started_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          task_list_id: string
          title: string
          description?: string | null
          command?: string | null
          status?: 'pending' | 'running' | 'completed' | 'failed'
          result?: string | null
          error?: string | null
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          task_list_id?: string
          title?: string
          description?: string | null
          command?: string | null
          status?: 'pending' | 'running' | 'completed' | 'failed'
          result?: string | null
          error?: string | null
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
      }
      media_blocks: {
        Row: {
          id: string
          message_id: string
          type: MediaBlockType
          data: Json
          sequence_order: number
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          type: MediaBlockType
          data: Json
          sequence_order: number
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          type?: MediaBlockType
          data?: Json
          sequence_order?: number
          created_at?: string
        }
      }
      session_states: {
        Row: {
          id: string
          session_id: string
          timestamp: string
          crud_operations: Json
          snapshot: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          timestamp?: string
          crud_operations: Json
          snapshot?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          timestamp?: string
          crud_operations?: Json
          snapshot?: Json | null
          created_at?: string
        }
      }
      image_attachments: {
        Row: {
          id: string
          message_id: string
          storage_path: string
          url: string
          thumbnail_url: string | null
          alt_text: string | null
          width: number | null
          height: number | null
          file_size: number | null
          mime_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          storage_path: string
          url: string
          thumbnail_url?: string | null
          alt_text?: string | null
          width?: number | null
          height?: number | null
          file_size?: number | null
          mime_type?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          storage_path?: string
          url?: string
          thumbnail_url?: string | null
          alt_text?: string | null
          width?: number | null
          height?: number | null
          file_size?: number | null
          mime_type?: string | null
          created_at?: string
        }
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          preferences: Json
          created_at: string
          last_modified: string
        }
        Insert: {
          id?: string
          user_id: string
          preferences?: Json
          created_at?: string
          last_modified?: string
        }
        Update: {
          id?: string
          user_id?: string
          preferences?: Json
          created_at?: string
          last_modified?: string
        }
      }
      execution_contexts: {
        Row: {
          id: string
          session_id: string
          working_directory: string
          tmux_session_id: string | null
          environment_vars: Json
          created_at: string
          last_updated: string
        }
        Insert: {
          id?: string
          session_id: string
          working_directory?: string
          tmux_session_id?: string | null
          environment_vars?: Json
          created_at?: string
          last_updated?: string
        }
        Update: {
          id?: string
          session_id?: string
          working_directory?: string
          tmux_session_id?: string | null
          environment_vars?: Json
          created_at?: string
          last_updated?: string
        }
      }
      mcp_configurations: {
        Row: {
          id: string
          project_id: string
          name: string
          command: string
          args: Json
          env: Json
          enabled: boolean
          auto_approve: Json
          created_at: string
          last_modified: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          command: string
          args?: Json
          env?: Json
          enabled?: boolean
          auto_approve?: Json
          created_at?: string
          last_modified?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          command?: string
          args?: Json
          env?: Json
          enabled?: boolean
          auto_approve?: Json
          created_at?: string
          last_modified?: string
        }
      }
      performance_metrics: {
        Row: {
          id: string
          project_id: string | null
          session_id: string | null
          user_id: string | null
          operation_type: string
          duration_ms: number
          memory_mb: number | null
          cpu_percent: number | null
          metadata: Json | null
          timestamp: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          session_id?: string | null
          user_id?: string | null
          operation_type: string
          duration_ms: number
          memory_mb?: number | null
          cpu_percent?: number | null
          metadata?: Json | null
          timestamp?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          session_id?: string | null
          user_id?: string | null
          operation_type?: string
          duration_ms?: number
          memory_mb?: number | null
          cpu_percent?: number | null
          metadata?: Json | null
          timestamp?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string
          action_type: string
          resource_type: string | null
          resource_id: string | null
          details: Json | null
          ip_address: string | null
          user_agent: string | null
          result: 'success' | 'failure' | 'blocked'
          timestamp: string
        }
        Insert: {
          id?: string
          user_id: string
          action_type: string
          resource_type?: string | null
          resource_id?: string | null
          details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          result: 'success' | 'failure' | 'blocked'
          timestamp?: string
        }
        Update: {
          id?: string
          user_id?: string
          action_type?: string
          resource_type?: string | null
          resource_id?: string | null
          details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          result?: 'success' | 'failure' | 'blocked'
          timestamp?: string
        }
      }
      schema_migrations: {
        Row: {
          id: number
          version: string
          name: string
          applied_at: string
          checksum: string
        }
        Insert: {
          id?: number
          version: string
          name: string
          applied_at?: string
          checksum: string
        }
        Update: {
          id?: number
          version?: string
          name?: string
          applied_at?: string
          checksum?: string
        }
      }
    }
  }
}

// Media Block Types
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

// Helper types for specific JSONB structures
export interface CodeBlockData {
  code: string
  language: string
  filename?: string
  startLine?: number
  endLine?: number
}

export interface FileBlockData {
  path: string
  content: string
  language?: string
  operation?: 'read' | 'write' | 'create' | 'delete'
  modified?: boolean
}

export interface CommandBlockData {
  command: string
  output: string
  status: 'success' | 'error' | 'timeout'
  exitCode?: number
  duration?: number
}

export interface ChartBlockData {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'radar'
  data: any[]
  xKey?: string
  yKeys?: string[]
  colors?: string[]
  title?: string
}

export interface TableBlockData {
  headers: string[]
  rows: string[][]
  caption?: string
}

export interface UserPreferences {
  theme?: 'dark' | 'light'
  fontSize?: number
  defaultModel?: string
  autoSave?: boolean
  notifications?: {
    email?: boolean
    push?: boolean
    collaboration?: boolean
  }
  editor?: {
    tabSize?: number
    wordWrap?: boolean
    minimap?: boolean
  }
}

export interface MCPConfiguration {
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  enabled: boolean
  autoApprove: string[]
}

// API Response Types
export type TaskList = Database['public']['Tables']['task_lists']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type MediaBlock = Database['public']['Tables']['media_blocks']['Row']
export type SessionState = Database['public']['Tables']['session_states']['Row']
export type ImageAttachment = Database['public']['Tables']['image_attachments']['Row']
export type ExecutionContext = Database['public']['Tables']['execution_contexts']['Row']
export type MCPConfig = Database['public']['Tables']['mcp_configurations']['Row']
export type PerformanceMetric = Database['public']['Tables']['performance_metrics']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']

// Insert Types
export type TaskListInsert = Database['public']['Tables']['task_lists']['Insert']
export type TaskInsert = Database['public']['Tables']['tasks']['Insert']
export type MediaBlockInsert = Database['public']['Tables']['media_blocks']['Insert']
export type SessionStateInsert = Database['public']['Tables']['session_states']['Insert']
export type ImageAttachmentInsert = Database['public']['Tables']['image_attachments']['Insert']
export type ExecutionContextInsert = Database['public']['Tables']['execution_contexts']['Insert']
export type MCPConfigInsert = Database['public']['Tables']['mcp_configurations']['Insert']
export type PerformanceMetricInsert = Database['public']['Tables']['performance_metrics']['Insert']
export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert']

// Update Types
export type TaskListUpdate = Database['public']['Tables']['task_lists']['Update']
export type TaskUpdate = Database['public']['Tables']['tasks']['Update']
export type MediaBlockUpdate = Database['public']['Tables']['media_blocks']['Update']
export type SessionStateUpdate = Database['public']['Tables']['session_states']['Update']
export type ImageAttachmentUpdate = Database['public']['Tables']['image_attachments']['Update']
export type ExecutionContextUpdate = Database['public']['Tables']['execution_contexts']['Update']
export type MCPConfigUpdate = Database['public']['Tables']['mcp_configurations']['Update']
export type PerformanceMetricUpdate = Database['public']['Tables']['performance_metrics']['Update']
export type AuditLogUpdate = Database['public']['Tables']['audit_logs']['Update']
