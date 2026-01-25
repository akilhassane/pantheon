/**
 * Database Types
 * 
 * TypeScript types for Supabase database tables
 */

export interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  container_id: string;
  container_name: string;
  terminal_port: number;
  vnc_port: number;
  novnc_port: number;
  status: 'creating' | 'running' | 'stopped' | 'error' | 'restarting';
  created_at: string;
  last_active: string;
}

export interface Session {
  id: string;
  name: string;
  project_id: string;
  user_id: string;
  model: string;
  created_at: string;
  last_active: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface Collaboration {
  id: string;
  project_id: string;
  share_token: string;
  owner_id: string;
  is_public: boolean;
  require_approval: boolean;
  expires_at: string | null;
  created_at: string;
  last_modified: string;
}

export interface CollaboratorAccess {
  id: string;
  collaboration_id: string;
  user_id: string;
  user_name: string | null;
  permissions: 'read' | 'write';
  joined_at: string;
  last_active: string;
}

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: Project;
        Insert: Omit<Project, 'created_at' | 'last_active'>;
        Update: Partial<Omit<Project, 'id' | 'created_at'>>;
      };
      sessions: {
        Row: Session;
        Insert: Omit<Session, 'created_at' | 'last_active'>;
        Update: Partial<Omit<Session, 'id' | 'created_at'>>;
      };
      chat_messages: {
        Row: ChatMessage;
        Insert: Omit<ChatMessage, 'id' | 'timestamp'>;
        Update: Partial<Omit<ChatMessage, 'id' | 'timestamp'>>;
      };
      collaborations: {
        Row: Collaboration;
        Insert: Omit<Collaboration, 'id' | 'created_at' | 'last_modified'>;
        Update: Partial<Omit<Collaboration, 'id' | 'created_at'>>;
      };
      collaborator_access: {
        Row: CollaboratorAccess;
        Insert: Omit<CollaboratorAccess, 'id' | 'joined_at' | 'last_active'>;
        Update: Partial<Omit<CollaboratorAccess, 'id' | 'joined_at'>>;
      };
    };
  };
}
