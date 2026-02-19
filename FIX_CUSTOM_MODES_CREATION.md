# Fix: Custom Modes Creation Error

## Problem
When trying to create a new mode in the frontend settings, you get the error:
```
Failed to create mode. Please try again.
```

## Root Cause
The `custom_modes` table doesn't exist in your Supabase database. The frontend is trying to insert into this table, but it hasn't been created yet.

## Solution

You need to create the `custom_modes` table in your Supabase database.

### Option 1: Manual Migration (Recommended)

1. **Open Supabase SQL Editor:**
   - Go to: https://supabase.com/dashboard
   - Select your project
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

2. **Copy and paste this SQL:**

```sql
-- Create custom_modes table for user-defined AI modes
CREATE TABLE IF NOT EXISTS custom_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_custom_modes_user_id ON custom_modes(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_custom_modes_created_at ON custom_modes(created_at DESC);

-- Enable Row Level Security
ALTER TABLE custom_modes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own modes
CREATE POLICY "Users can view their own custom modes"
  ON custom_modes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own modes
CREATE POLICY "Users can create their own custom modes"
  ON custom_modes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own modes
CREATE POLICY "Users can update their own custom modes"
  ON custom_modes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own modes
CREATE POLICY "Users can delete their own custom modes"
  ON custom_modes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_modes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function
CREATE TRIGGER update_custom_modes_updated_at_trigger
  BEFORE UPDATE ON custom_modes
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_modes_updated_at();
```

3. **Run the query:**
   - Click "Run" or press Ctrl+Enter
   - You should see "Success. No rows returned"

4. **Verify the table was created:**
   - Click "Table Editor" in the left sidebar
   - You should see `custom_modes` in the list of tables

### Option 2: Using the Script (If you have Supabase CLI)

If you have the Supabase CLI installed:

```bash
# Navigate to your project directory
cd C:\MCP\mcp-server

# Apply the migration
supabase db push
```

## What This Migration Does

1. **Creates the `custom_modes` table** with these columns:
   - `id`: Unique identifier (UUID)
   - `user_id`: Reference to the user who created the mode
   - `name`: Name of the mode
   - `description`: Optional description
   - `system_prompt`: The custom system prompt for this mode
   - `created_at`: When the mode was created
   - `updated_at`: When the mode was last updated

2. **Adds indexes** for faster queries on `user_id` and `created_at`

3. **Enables Row Level Security (RLS)** so users can only see/edit their own modes

4. **Creates policies** for SELECT, INSERT, UPDATE, and DELETE operations

5. **Adds a trigger** to automatically update the `updated_at` timestamp

## After Migration

Once the migration is applied:

1. Refresh your frontend
2. Go to Settings → Modes
3. Click "Create New Mode"
4. It should now work without errors!

## Verification

To verify the table was created correctly, run this query in Supabase SQL Editor:

```sql
SELECT * FROM custom_modes LIMIT 10;
```

You should see an empty result (no rows) but no errors.

## Troubleshooting

### Error: "relation 'custom_modes' already exists"
This means the table already exists. You can skip the migration.

### Error: "permission denied"
Make sure you're using the SQL Editor in your Supabase dashboard, which has admin permissions.

### Still getting "Failed to create mode"
1. Check the browser console (F12) for detailed error messages
2. Check that you're logged in to the frontend
3. Verify the table exists in Supabase Table Editor
4. Check that RLS policies are enabled

## Files Created

- `supabase/migrations/20260215000000_create_custom_modes_table.sql` - The migration file
- `apply-custom-modes-migration.cjs` - Script to apply migration (requires Supabase service key)
- `FIX_CUSTOM_MODES_CREATION.md` - This guide

## Status

✅ Migration file created
⏳ Waiting for you to apply the migration
🔄 After migration, custom modes creation will work
