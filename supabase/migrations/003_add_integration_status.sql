-- Add missing columns to user_integrations table
ALTER TABLE user_integrations
ADD COLUMN IF NOT EXISTS is_connected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Update any existing Gmail tokens to show as connected
UPDATE user_integrations
SET is_connected = true,
    connected_at = created_at
WHERE service = 'gmail'
  AND access_token IS NOT NULL;