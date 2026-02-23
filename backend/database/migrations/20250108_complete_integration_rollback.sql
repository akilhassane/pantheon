-- Rollback Script for Complete Supabase Integration Migration
-- Version: 20250108_complete_integration
-- Description: Safely removes all tables and objects created by the migration

-- ============================================================================
-- DROP RLS POLICIES
-- ============================================================================

-- Performance metrics policies
DROP POLICY IF EXISTS "System can insert performance metrics" ON performance_metrics;
DROP POLICY IF EXISTS "Users can view metrics in accessible projects" ON performance_metrics;

-- Audit logs policies
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;

-- MCP configurations policies
DROP POLICY IF EXISTS "Users can manage MCP configs in own projects" ON mcp_configurations;
DROP POLICY IF EXISTS "Users can view MCP configs in accessible projects" ON mcp_configurations;

-- Execution contexts policies
DROP POLICY IF EXISTS "Users can manage execution contexts in own sessions" ON execution_contexts;
DROP POLICY IF EXISTS "Users can view execution contexts in accessible sessions" ON execution_contexts;

-- User preferences policies
DROP POLICY IF EXISTS "Users can delete own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;

-- Image attachments policies
DROP POLICY IF EXISTS "Users can insert image attachments in accessible sessions" ON image_attachments;
DROP POLICY IF EXISTS "Users can view image attachments in accessible messages" ON image_attachments;

-- Session states policies
DROP POLICY IF EXISTS "Users can insert session states in accessible sessions" ON session_states;
DROP POLICY IF EXISTS "Users can view session states in accessible sessions" ON session_states;

-- Media blocks policies
DROP POLICY IF EXISTS "Users can insert media blocks in accessible sessions" ON media_blocks;
DROP POLICY IF EXISTS "Users can view media blocks in accessible messages" ON media_blocks;

-- Tasks policies
DROP POLICY IF EXISTS "Users can delete tasks in own projects" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks in accessible task lists" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks in accessible task lists" ON tasks;
DROP POLICY IF EXISTS "Users can view tasks in accessible task lists" ON tasks;

-- Task lists policies
DROP POLICY IF EXISTS "Users can delete task lists in own projects" ON task_lists;
DROP POLICY IF EXISTS "Users can update task lists in own projects" ON task_lists;
DROP POLICY IF EXISTS "Users can create task lists in own projects" ON task_lists;
DROP POLICY IF EXISTS "Users can view task lists in accessible projects" ON task_lists;

-- ============================================================================
-- DROP INDEXES
-- ============================================================================

-- Audit logs indexes
DROP INDEX IF EXISTS idx_audit_logs_resource;
DROP INDEX IF EXISTS idx_audit_logs_action_type;
DROP INDEX IF EXISTS idx_audit_logs_user_id;

-- Performance metrics indexes
DROP INDEX IF EXISTS idx_performance_metrics_operation;
DROP INDEX IF EXISTS idx_performance_metrics_project_id;

-- MCP configurations indexes
DROP INDEX IF EXISTS idx_mcp_configurations_enabled;
DROP INDEX IF EXISTS idx_mcp_configurations_project_id;

-- Execution contexts indexes
DROP INDEX IF EXISTS idx_execution_contexts_session_id;

-- Image attachments indexes
DROP INDEX IF EXISTS idx_image_attachments_message_id;

-- Session states indexes
DROP INDEX IF EXISTS idx_session_states_timestamp;
DROP INDEX IF EXISTS idx_session_states_session_id;

-- Media blocks indexes
DROP INDEX IF EXISTS idx_media_blocks_sequence;
DROP INDEX IF EXISTS idx_media_blocks_type;
DROP INDEX IF EXISTS idx_media_blocks_message_id;

-- Task management indexes
DROP INDEX IF EXISTS idx_tasks_status;
DROP INDEX IF EXISTS idx_tasks_task_list_id;
DROP INDEX IF EXISTS idx_task_lists_created_by;
DROP INDEX IF EXISTS idx_task_lists_project_id;

-- ============================================================================
-- DROP FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS create_monthly_partitions();

-- ============================================================================
-- DROP TABLES (in reverse dependency order)
-- ============================================================================

-- Drop partitioned tables and their partitions
DROP TABLE IF EXISTS audit_logs_2025_03 CASCADE;
DROP TABLE IF EXISTS audit_logs_2025_02 CASCADE;
DROP TABLE IF EXISTS audit_logs_2025_01 CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;

DROP TABLE IF EXISTS performance_metrics_2025_03 CASCADE;
DROP TABLE IF EXISTS performance_metrics_2025_02 CASCADE;
DROP TABLE IF EXISTS performance_metrics_2025_01 CASCADE;
DROP TABLE IF EXISTS performance_metrics CASCADE;

-- Drop regular tables
DROP TABLE IF EXISTS mcp_configurations CASCADE;
DROP TABLE IF EXISTS execution_contexts CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS image_attachments CASCADE;
DROP TABLE IF EXISTS session_states CASCADE;
DROP TABLE IF EXISTS media_blocks CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS task_lists CASCADE;

-- ============================================================================
-- REMOVE MIGRATION RECORD
-- ============================================================================

DELETE FROM schema_migrations WHERE version = '20250108_complete_integration';

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================

-- Note: This rollback script removes all tables and data created by the migration.
-- Make sure you have a backup before running this script!
