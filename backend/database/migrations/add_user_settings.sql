-- Migration: Add user_settings table
-- Created: 2026-02-21
-- This table stores user-specific settings (models, modes, appearance, behavior, etc.)

CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    
    -- Model settings
    selected_model TEXT,
    default_model TEXT,
    visible_models JSONB DEFAULT '[]'::jsonb,
    
    -- Mode settings
    selected_mode TEXT,
    default_mode TEXT,
    
    -- Appearance settings
    theme TEXT DEFAULT 'dark',
    sidebar_position TEXT DEFAULT 'left',
    chat_position TEXT DEFAULT 'right',
    
    -- Behavior settings
    auto_run_code BOOLEAN DEFAULT false,
    show_line_numbers BOOLEAN DEFAULT true,
    enable_sound BOOLEAN DEFAULT false,
    
    -- Advanced settings
    custom_settings JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT user_settings_user_id_unique UNIQUE(user_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_settings_updated_at();

-- Add comment
COMMENT ON TABLE user_settings IS 'Stores user-specific settings for models, modes, appearance, and behavior';
