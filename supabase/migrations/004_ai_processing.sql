-- AI Usage Tracking Tables

-- Table to track all AI API calls and their costs
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Request details
  model TEXT NOT NULL, -- e.g., 'gpt-4', 'gpt-3.5-turbo'
  operation TEXT NOT NULL, -- e.g., 'email_scoring', 'email_summary', 'smart_reply'

  -- Token usage
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,

  -- Cost tracking (in cents for precision)
  cost_cents INTEGER NOT NULL DEFAULT 0,

  -- Context
  context_id TEXT, -- Reference to what was processed (e.g., email_id)
  context_type TEXT, -- Type of context (e.g., 'email', 'thread')

  -- Response
  response JSONB, -- Store the actual AI response
  error TEXT, -- Any error messages

  -- Performance
  duration_ms INTEGER -- Time taken for the API call
);

-- Index for efficient queries
CREATE INDEX idx_ai_usage_user_id ON ai_usage(user_id);
CREATE INDEX idx_ai_usage_created_at ON ai_usage(created_at DESC);
CREATE INDEX idx_ai_usage_operation ON ai_usage(operation);

-- Table for user AI budgets and limits
CREATE TABLE IF NOT EXISTS ai_budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Budget settings (in cents)
  daily_limit_cents INTEGER DEFAULT 100, -- $1.00 default daily limit
  monthly_limit_cents INTEGER DEFAULT 2000, -- $20.00 default monthly limit

  -- Current usage (updated periodically)
  daily_usage_cents INTEGER DEFAULT 0,
  monthly_usage_cents INTEGER DEFAULT 0,

  -- Alert thresholds (as percentage)
  alert_at_percent INTEGER DEFAULT 80, -- Alert when 80% of budget used

  -- Notification settings
  email_alerts BOOLEAN DEFAULT true,
  in_app_alerts BOOLEAN DEFAULT true,

  -- Last reset times
  daily_reset_at TIMESTAMPTZ DEFAULT NOW(),
  monthly_reset_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for AI-enhanced email metadata
CREATE TABLE IF NOT EXISTS email_ai_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id UUID REFERENCES emails(id) ON DELETE CASCADE UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- AI-generated scores and analysis
  priority_score DECIMAL(3,1), -- 1.0 to 10.0
  urgency_score DECIMAL(3,1), -- 1.0 to 10.0
  importance_score DECIMAL(3,1), -- 1.0 to 10.0

  -- AI-generated content
  summary TEXT, -- Brief summary of the email
  key_points JSONB, -- Array of key points
  action_items JSONB, -- Extracted action items
  sentiment TEXT, -- 'positive', 'negative', 'neutral'

  -- Categories and tags
  ai_category TEXT, -- AI-suggested category
  ai_tags TEXT[], -- AI-suggested tags

  -- Smart reply suggestions
  reply_suggestions JSONB, -- Array of suggested replies

  -- Processing metadata
  processed_at TIMESTAMPTZ,
  processing_version TEXT, -- Track which AI model/version was used
  confidence_score DECIMAL(3,2) -- 0.00 to 1.00 confidence in analysis
);

-- Index for efficient queries
CREATE INDEX idx_email_ai_metadata_email_id ON email_ai_metadata(email_id);
CREATE INDEX idx_email_ai_metadata_user_id ON email_ai_metadata(user_id);
CREATE INDEX idx_email_ai_metadata_priority_score ON email_ai_metadata(priority_score DESC);

-- Row Level Security
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_ai_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own AI usage"
  ON ai_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI usage"
  ON ai_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own AI budgets"
  ON ai_budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI budgets"
  ON ai_budgets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI budgets"
  ON ai_budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own email AI metadata"
  ON email_ai_metadata FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email AI metadata"
  ON email_ai_metadata FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email AI metadata"
  ON email_ai_metadata FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to update monthly and daily usage
CREATE OR REPLACE FUNCTION update_ai_budget_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Update daily and monthly usage
  UPDATE ai_budgets
  SET
    daily_usage_cents = daily_usage_cents + NEW.cost_cents,
    monthly_usage_cents = monthly_usage_cents + NEW.cost_cents,
    updated_at = NOW()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update budget usage after each AI call
CREATE TRIGGER update_budget_after_ai_usage
AFTER INSERT ON ai_usage
FOR EACH ROW
EXECUTE FUNCTION update_ai_budget_usage();

-- Function to reset daily budgets (call via cron)
CREATE OR REPLACE FUNCTION reset_daily_ai_budgets()
RETURNS void AS $$
BEGIN
  UPDATE ai_budgets
  SET
    daily_usage_cents = 0,
    daily_reset_at = NOW(),
    updated_at = NOW()
  WHERE daily_reset_at < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly budgets (call via cron)
CREATE OR REPLACE FUNCTION reset_monthly_ai_budgets()
RETURNS void AS $$
BEGIN
  UPDATE ai_budgets
  SET
    monthly_usage_cents = 0,
    monthly_reset_at = NOW(),
    updated_at = NOW()
  WHERE monthly_reset_at < date_trunc('month', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;