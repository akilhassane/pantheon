-- Migration: Add operating_system column to projects table
-- Date: 2025-01-17
-- Description: Adds operating_system field to track which OS each project uses

-- Add operating_system column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' 
    AND column_name = 'operating_system'
  ) THEN
    ALTER TABLE projects 
    ADD COLUMN operating_system VARCHAR(50) NOT NULL DEFAULT 'kali-linux';
    
    RAISE NOTICE 'Added operating_system column to projects table';
  ELSE
    RAISE NOTICE 'operating_system column already exists';
  END IF;
END $$;

-- Update existing projects to have kali-linux as default OS
UPDATE projects 
SET operating_system = 'kali-linux' 
WHERE operating_system IS NULL OR operating_system = '';

-- Add index for faster OS-based queries
CREATE INDEX IF NOT EXISTS idx_projects_operating_system ON projects(operating_system);

COMMENT ON COLUMN projects.operating_system IS 'Operating system identifier (e.g., kali-linux, ubuntu-24, windows-11)';
