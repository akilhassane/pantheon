-- Change user ID from UUID to TEXT to support Keycloak's numeric IDs
-- This allows us to use Keycloak's user IDs directly

-- First, we need to handle foreign key constraints
-- Drop ALL foreign key constraints that reference users table
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_owner_id_fkey;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE custom_modes DROP CONSTRAINT IF EXISTS custom_modes_user_id_fkey;
ALTER TABLE collaborations DROP CONSTRAINT IF EXISTS collaborations_user_id_fkey;
ALTER TABLE usage_tracking DROP CONSTRAINT IF EXISTS usage_tracking_user_id_fkey;
ALTER TABLE project_shares DROP CONSTRAINT IF EXISTS project_shares_owner_id_fkey;
ALTER TABLE user_api_keys DROP CONSTRAINT IF EXISTS user_api_keys_user_id_fkey;
ALTER TABLE model_usage DROP CONSTRAINT IF EXISTS model_usage_user_id_fkey;
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;

-- Change the users.id column type
ALTER TABLE users ALTER COLUMN id TYPE TEXT;

-- Change ALL foreign key columns to TEXT
ALTER TABLE projects ALTER COLUMN owner_id TYPE TEXT;
ALTER TABLE sessions ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE custom_modes ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE collaborations ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE usage_tracking ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE project_shares ALTER COLUMN owner_id TYPE TEXT;
ALTER TABLE user_api_keys ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE model_usage ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE user_settings ALTER COLUMN user_id TYPE TEXT;

-- Recreate ALL foreign key constraints
ALTER TABLE projects 
  ADD CONSTRAINT projects_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE sessions 
  ADD CONSTRAINT sessions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE custom_modes 
  ADD CONSTRAINT custom_modes_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE collaborations 
  ADD CONSTRAINT collaborations_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE usage_tracking 
  ADD CONSTRAINT usage_tracking_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE project_shares 
  ADD CONSTRAINT project_shares_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_api_keys 
  ADD CONSTRAINT user_api_keys_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE model_usage 
  ADD CONSTRAINT model_usage_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_settings 
  ADD CONSTRAINT user_settings_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
