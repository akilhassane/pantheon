-- Migration: Add user_api_keys table
-- This table stores user-specific API keys for various AI providers
-- Keys are encrypted at rest for security

CREATE TABLE IF NOT EXISTS user_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'openrouter', 'openai', 'anthropic', 'gemini', etc.
    api_key TEXT NOT NULL, -- Encrypted API key
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one active key per user per provider
    UNIQUE(user_id, provider, is_active)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_provider ON user_api_keys(user_id, provider) WHERE is_active = true;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_user_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_api_keys_updated_at
    BEFORE UPDATE ON user_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_user_api_keys_updated_at();

-- Add comment
COMMENT ON TABLE user_api_keys IS 'Stores user-specific API keys for AI providers';
