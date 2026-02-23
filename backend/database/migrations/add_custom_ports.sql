-- Add custom port columns to projects table
-- Migration: add_custom_ports
-- Date: 2025-12-06

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS custom_port_1 INTEGER,
ADD COLUMN IF NOT EXISTS custom_port_2 INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN projects.custom_port_1 IS 'Custom port 1 for Windows containers (maps to 8080)';
COMMENT ON COLUMN projects.custom_port_2 IS 'Custom port 2 for Windows containers (maps to 8081)';
