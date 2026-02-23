-- Create model_usage table for tracking API usage statistics
CREATE TABLE IF NOT EXISTS model_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    reasoning_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    estimated_cost DECIMAL(10, 6) DEFAULT 0,
    session_id UUID,
    project_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_model_usage_user_id ON model_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_model_usage_model_id ON model_usage(model_id);
CREATE INDEX IF NOT EXISTS idx_model_usage_created_at ON model_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_model_usage_user_model ON model_usage(user_id, model_id);
CREATE INDEX IF NOT EXISTS idx_model_usage_user_created ON model_usage(user_id, created_at);
