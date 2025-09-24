-- Fix database schema for AI processing functionality

-- Add priority column to emails table if it doesn't exist
ALTER TABLE emails
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5;

-- Add unique constraint for feed_items upsert operations
ALTER TABLE feed_items
DROP CONSTRAINT IF EXISTS feed_items_unique_external;

ALTER TABLE feed_items
ADD CONSTRAINT feed_items_unique_external
UNIQUE (external_id, source);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_emails_priority
ON emails(priority DESC);

-- Update any existing emails with default priority
UPDATE emails
SET priority = 5
WHERE priority IS NULL;