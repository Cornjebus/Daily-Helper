-- Fix schema mismatches between migrations and application code

-- Fix ai_usage table to match application expectations
ALTER TABLE ai_usage
ADD COLUMN IF NOT EXISTS context_id TEXT,
ADD COLUMN IF NOT EXISTS context_type TEXT,
ADD COLUMN IF NOT EXISTS response JSONB,
ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

-- Rename cost to cost_cents to match application code
ALTER TABLE ai_usage
ADD COLUMN IF NOT EXISTS cost_cents INTEGER;

-- Update existing cost data to cost_cents (convert decimal to cents)
UPDATE ai_usage
SET cost_cents = ROUND(cost * 100)
WHERE cost IS NOT NULL AND cost_cents IS NULL;

-- Drop old cost column after migration
-- ALTER TABLE ai_usage DROP COLUMN IF EXISTS cost;

-- Update the ai_usage table constraints
ALTER TABLE ai_usage
ALTER COLUMN user_id SET NOT NULL;

-- Add from_email column to match application expectations (keeping sender_email for compatibility)
ALTER TABLE emails
ADD COLUMN IF NOT EXISTS from_email TEXT;

-- Copy data from sender_email to from_email for existing records
UPDATE emails
SET from_email = sender_email
WHERE from_email IS NULL AND sender_email IS NOT NULL;

-- Make sure feed_items has proper constraints
ALTER TABLE feed_items
DROP CONSTRAINT IF EXISTS feed_items_unique_external;

ALTER TABLE feed_items
ADD CONSTRAINT feed_items_unique_external
UNIQUE (external_id, source);

-- Update indexes for new columns
CREATE INDEX IF NOT EXISTS idx_ai_usage_context_id ON ai_usage(context_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_context_type ON ai_usage(context_type);

-- Update the budget trigger function to use cost_cents instead of cost
CREATE OR REPLACE FUNCTION update_ai_budget_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Update daily and monthly usage using cost_cents
  UPDATE ai_budgets
  SET
    daily_usage_cents = daily_usage_cents + COALESCE(NEW.cost_cents, ROUND(NEW.cost * 100), 0),
    monthly_usage_cents = monthly_usage_cents + COALESCE(NEW.cost_cents, ROUND(NEW.cost * 100), 0),
    updated_at = NOW()
  WHERE user_id = NEW.user_id;

  -- Create budget if it doesn't exist
  INSERT INTO ai_budgets (user_id, daily_usage_cents, monthly_usage_cents)
  VALUES (NEW.user_id, COALESCE(NEW.cost_cents, ROUND(NEW.cost * 100), 0), COALESCE(NEW.cost_cents, ROUND(NEW.cost * 100), 0))
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;