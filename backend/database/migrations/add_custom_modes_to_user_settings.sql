-- Migration: Add custom_modes column to user_settings
-- Created: 2026-02-22
-- This column stores user-specific custom modes

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS custom_modes JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN user_settings.custom_modes IS 'Stores user-specific custom modes';
