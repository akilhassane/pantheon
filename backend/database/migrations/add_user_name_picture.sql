-- Add name and picture columns to users table for Keycloak user data
-- These fields will be populated from Keycloak JWT tokens

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS picture TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);

-- Update existing users to extract name from email if not set
UPDATE users 
SET name = SPLIT_PART(email, '@', 1)
WHERE name IS NULL;
