-- Complete Supabase Integration Migration
-- Version: 20250108_complete_integration
-- Description: Add all remaining tables for complete data persistence

-- ============================================================================
-- 1. TASK MANAGEMENT TABLES
-- ============================================================================

-- Task Lists Table
CREATE TABLE IF NOT EXISTS task_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_list_id UUID NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  command TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  result TEXT,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT tasks_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

-- ============================================================================
-- 2. MEDIA BLOCKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS media_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  data JSONB NOT NULL,
  sequence_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT media_blocks_type_check CHECK (type IN (
    'command', 'command-execution', 'code', 'file', 'image',
    'session-suggestion', 'error', 'thinking', 'crud', 'mermaid',
    'json', 'chart', 'table'
  ))
);

-- ============================================================================
-- 3. SESSION STATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS session_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  crud_operations JSONB NOT NULL,
  snapshot JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. IMAGE ATTACHMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS image_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  alt_text TEXT,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  mime_type VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. USER PREFERENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 6. EXECUTION CONTEXTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS execution_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  working_directory TEXT NOT NULL DEFAULT '/workspace',
  tmux_session_id VARCHAR(255),
  environment_vars JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 7. MCP CONFIGURATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  command TEXT NOT NULL,
  args JSONB DEFAULT '[]',
  env JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  auto_approve JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- ============================================================================
-- 8. PERFORMANCE METRICS TABLE (PARTITIONED)
-- ============================================================================

CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  user_id UUID,
  operation_type VARCHAR(100) NOT NULL,
  duration_ms INTEGER NOT NULL,
  memory_mb NUMERIC(10,2),
  cpu_percent NUMERIC(5,2),
  metadata JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create initial partitions for performance_metrics
CREATE TABLE IF NOT EXISTS performance_metrics_2025_01 PARTITION OF performance_metrics
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS performance_metrics_2025_02 PARTITION OF performance_metrics
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE IF NOT EXISTS performance_metrics_2025_03 PARTITION OF performance_metrics
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- ============================================================================
-- 9. AUDIT LOGS TABLE (PARTITIONED)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  result VARCHAR(20) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id, timestamp),
  CONSTRAINT audit_logs_result_check CHECK (result IN ('success', 'failure', 'blocked'))
) PARTITION BY RANGE (timestamp);

-- Create initial partitions for audit_logs
CREATE TABLE IF NOT EXISTS audit_logs_2025_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS audit_logs_2025_02 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE IF NOT EXISTS audit_logs_2025_03 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- ============================================================================
-- 10. SCHEMA MIGRATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  version VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  checksum VARCHAR(64) NOT NULL
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Task management indexes
CREATE INDEX IF NOT EXISTS idx_task_lists_project_id ON task_lists(project_id);
CREATE INDEX IF NOT EXISTS idx_task_lists_created_by ON task_lists(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_task_list_id ON tasks(task_list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Media blocks indexes
CREATE INDEX IF NOT EXISTS idx_media_blocks_message_id ON media_blocks(message_id);
CREATE INDEX IF NOT EXISTS idx_media_blocks_type ON media_blocks(type);
CREATE INDEX IF NOT EXISTS idx_media_blocks_sequence ON media_blocks(message_id, sequence_order);

-- Session states indexes
CREATE INDEX IF NOT EXISTS idx_session_states_session_id ON session_states(session_id);
CREATE INDEX IF NOT EXISTS idx_session_states_timestamp ON session_states(timestamp DESC);

-- Image attachments indexes
CREATE INDEX IF NOT EXISTS idx_image_attachments_message_id ON image_attachments(message_id);

-- Execution contexts indexes
CREATE INDEX IF NOT EXISTS idx_execution_contexts_session_id ON execution_contexts(session_id);

-- MCP configurations indexes
CREATE INDEX IF NOT EXISTS idx_mcp_configurations_project_id ON mcp_configurations(project_id);
CREATE INDEX IF NOT EXISTS idx_mcp_configurations_enabled ON mcp_configurations(enabled);

-- Performance metrics indexes (on partitions)
CREATE INDEX IF NOT EXISTS idx_performance_metrics_project_id 
  ON performance_metrics(project_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_operation 
  ON performance_metrics(operation_type, timestamp DESC);

-- Audit logs indexes (on partitions)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id 
  ON audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type 
  ON audit_logs(action_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource 
  ON audit_logs(resource_type, resource_id, timestamp DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE task_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TASK LISTS RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view task lists in accessible projects" ON task_lists
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT c.project_id FROM collaborations c
      JOIN collaborator_access ca ON ca.collaboration_id = c.id
      WHERE ca.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create task lists in own projects" ON task_lists
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can update task lists in own projects" ON task_lists
  FOR UPDATE USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can delete task lists in own projects" ON task_lists
  FOR DELETE USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- ============================================================================
-- TASKS RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view tasks in accessible task lists" ON tasks
  FOR SELECT USING (
    task_list_id IN (
      SELECT tl.id FROM task_lists tl
      WHERE tl.project_id IN (
        SELECT id FROM projects WHERE owner_id = auth.uid()
        UNION
        SELECT c.project_id FROM collaborations c
        JOIN collaborator_access ca ON ca.collaboration_id = c.id
        WHERE ca.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create tasks in accessible task lists" ON tasks
  FOR INSERT WITH CHECK (
    task_list_id IN (
      SELECT tl.id FROM task_lists tl
      WHERE tl.project_id IN (
        SELECT id FROM projects WHERE owner_id = auth.uid()
        UNION
        SELECT c.project_id FROM collaborations c
        JOIN collaborator_access ca ON ca.collaboration_id = c.id
        WHERE ca.user_id = auth.uid() AND ca.permissions = 'write'
      )
    )
  );

CREATE POLICY "Users can update tasks in accessible task lists" ON tasks
  FOR UPDATE USING (
    task_list_id IN (
      SELECT tl.id FROM task_lists tl
      WHERE tl.project_id IN (
        SELECT id FROM projects WHERE owner_id = auth.uid()
        UNION
        SELECT c.project_id FROM collaborations c
        JOIN collaborator_access ca ON ca.collaboration_id = c.id
        WHERE ca.user_id = auth.uid() AND ca.permissions = 'write'
      )
    )
  );

CREATE POLICY "Users can delete tasks in own projects" ON tasks
  FOR DELETE USING (
    task_list_id IN (
      SELECT tl.id FROM task_lists tl
      WHERE tl.project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
    )
  );

-- ============================================================================
-- MEDIA BLOCKS RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view media blocks in accessible messages" ON media_blocks
  FOR SELECT USING (
    message_id IN (
      SELECT cm.id FROM chat_messages cm
      JOIN sessions s ON s.id = cm.session_id
      JOIN projects p ON p.id = s.project_id
      WHERE p.owner_id = auth.uid()
      OR p.id IN (
        SELECT c.project_id FROM collaborations c
        JOIN collaborator_access ca ON ca.collaboration_id = c.id
        WHERE ca.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert media blocks in accessible sessions" ON media_blocks
  FOR INSERT WITH CHECK (
    message_id IN (
      SELECT cm.id FROM chat_messages cm
      JOIN sessions s ON s.id = cm.session_id
      JOIN projects p ON p.id = s.project_id
      WHERE p.owner_id = auth.uid()
      OR (
        p.id IN (
          SELECT c.project_id FROM collaborations c
          JOIN collaborator_access ca ON ca.collaboration_id = c.id
          WHERE ca.user_id = auth.uid() AND ca.permissions = 'write'
        )
      )
    )
  );

-- ============================================================================
-- SESSION STATES RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view session states in accessible sessions" ON session_states
  FOR SELECT USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN projects p ON p.id = s.project_id
      WHERE p.owner_id = auth.uid()
      OR p.id IN (
        SELECT c.project_id FROM collaborations c
        JOIN collaborator_access ca ON ca.collaboration_id = c.id
        WHERE ca.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert session states in accessible sessions" ON session_states
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN projects p ON p.id = s.project_id
      WHERE p.owner_id = auth.uid()
      OR (
        p.id IN (
          SELECT c.project_id FROM collaborations c
          JOIN collaborator_access ca ON ca.collaboration_id = c.id
          WHERE ca.user_id = auth.uid() AND ca.permissions = 'write'
        )
      )
    )
  );

-- ============================================================================
-- IMAGE ATTACHMENTS RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view image attachments in accessible messages" ON image_attachments
  FOR SELECT USING (
    message_id IN (
      SELECT cm.id FROM chat_messages cm
      JOIN sessions s ON s.id = cm.session_id
      JOIN projects p ON p.id = s.project_id
      WHERE p.owner_id = auth.uid()
      OR p.id IN (
        SELECT c.project_id FROM collaborations c
        JOIN collaborator_access ca ON ca.collaboration_id = c.id
        WHERE ca.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert image attachments in accessible sessions" ON image_attachments
  FOR INSERT WITH CHECK (
    message_id IN (
      SELECT cm.id FROM chat_messages cm
      JOIN sessions s ON s.id = cm.session_id
      JOIN projects p ON p.id = s.project_id
      WHERE p.owner_id = auth.uid()
      OR (
        p.id IN (
          SELECT c.project_id FROM collaborations c
          JOIN collaborator_access ca ON ca.collaboration_id = c.id
          WHERE ca.user_id = auth.uid() AND ca.permissions = 'write'
        )
      )
    )
  );

-- ============================================================================
-- USER PREFERENCES RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own preferences" ON user_preferences
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- EXECUTION CONTEXTS RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view execution contexts in accessible sessions" ON execution_contexts
  FOR SELECT USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN projects p ON p.id = s.project_id
      WHERE p.owner_id = auth.uid()
      OR p.id IN (
        SELECT c.project_id FROM collaborations c
        JOIN collaborator_access ca ON ca.collaboration_id = c.id
        WHERE ca.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage execution contexts in own sessions" ON execution_contexts
  FOR ALL USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN projects p ON p.id = s.project_id
      WHERE p.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- MCP CONFIGURATIONS RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view MCP configs in accessible projects" ON mcp_configurations
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT c.project_id FROM collaborations c
      JOIN collaborator_access ca ON ca.collaboration_id = c.id
      WHERE ca.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage MCP configs in own projects" ON mcp_configurations
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- ============================================================================
-- PERFORMANCE METRICS RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view metrics in accessible projects" ON performance_metrics
  FOR SELECT USING (
    project_id IS NULL OR project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT c.project_id FROM collaborations c
      JOIN collaborator_access ca ON ca.collaboration_id = c.id
      WHERE ca.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert performance metrics" ON performance_metrics
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- AUDIT LOGS RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view own audit logs" ON audit_logs
  FOR SELECT USING (user_id = auth.uid());

-- Note: Admin policy would require a user_roles table
-- CREATE POLICY "Admins can view all audit logs" ON audit_logs
--   FOR SELECT USING (
--     EXISTS (
--       SELECT 1 FROM user_roles 
--       WHERE user_id = auth.uid() AND role = 'admin'
--     )
--   );

CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- PARTITION MANAGEMENT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  table_name TEXT;
BEGIN
  -- Create partitions for next 3 months
  FOR i IN 0..2 LOOP
    start_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
    end_date := start_date + INTERVAL '1 month';
    
    -- Performance metrics partition
    table_name := 'performance_metrics_' || TO_CHAR(start_date, 'YYYY_MM');
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF performance_metrics FOR VALUES FROM (%L) TO (%L)',
      table_name, start_date, end_date);
    
    -- Audit logs partition
    table_name := 'audit_logs_' || TO_CHAR(start_date, 'YYYY_MM');
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
      table_name, start_date, end_date);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RECORD MIGRATION
-- ============================================================================

INSERT INTO schema_migrations (version, name, checksum)
VALUES (
  '20250108_complete_integration',
  'Complete Supabase Integration - All Tables',
  'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
)
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
