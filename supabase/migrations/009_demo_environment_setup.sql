-- Demo Environment Setup Migration
-- Creates all necessary tables for Phase 5 demo functionality

-- Create weekly_digests table if it doesn't exist
CREATE TABLE IF NOT EXISTS weekly_digests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_emails INTEGER DEFAULT 0,
  high_priority_emails INTEGER DEFAULT 0,
  medium_priority_emails INTEGER DEFAULT 0,
  low_priority_emails INTEGER DEFAULT 0,
  unsubscribe_actions INTEGER DEFAULT 0,
  time_saved_minutes INTEGER DEFAULT 0,
  cost_savings_cents INTEGER DEFAULT 0,
  ai_accuracy_percent DECIMAL(5,2) DEFAULT 0,
  summary_highlights TEXT[],
  action_items TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create unsubscribe_sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS unsubscribe_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  total_senders INTEGER DEFAULT 0,
  total_emails_affected INTEGER DEFAULT 0,
  estimated_time_saved_minutes INTEGER DEFAULT 0,
  categories_processed TEXT[],
  session_type VARCHAR(50) DEFAULT 'bulk_unsubscribe',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Add unsubscribed fields to emails table if they don't exist
ALTER TABLE emails
ADD COLUMN IF NOT EXISTS unsubscribed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMP WITH TIME ZONE;

-- Create email_ai_metadata table if it doesn't exist (enhanced version)
CREATE TABLE IF NOT EXISTS email_ai_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL,
  priority_score DECIMAL(3,1) DEFAULT 5.0,
  processing_version VARCHAR(50),
  confidence_score DECIMAL(3,2) DEFAULT 0.0,
  features_analyzed JSONB DEFAULT '{}',
  reply_suggestions TEXT[],
  thread_summary TEXT,
  thread_key_points TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(email_id, user_id)
);

-- Create indexes for better performance
-- Check if column is week_start_date or week_start
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'weekly_digests'
               AND column_name = 'week_start_date') THEN
        CREATE INDEX IF NOT EXISTS idx_weekly_digests_user_id_date
        ON weekly_digests(user_id, week_start_date DESC);
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'weekly_digests'
                  AND column_name = 'week_start') THEN
        CREATE INDEX IF NOT EXISTS idx_weekly_digests_user_id_date
        ON weekly_digests(user_id, week_start DESC);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_sessions_user_id
ON unsubscribe_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_emails_unsubscribed
ON emails(user_id, unsubscribed, from_email);

CREATE INDEX IF NOT EXISTS idx_email_ai_metadata_lookup
ON email_ai_metadata(email_id, user_id);

CREATE INDEX IF NOT EXISTS idx_emails_priority_date
ON emails(user_id, priority DESC, received_at DESC);

-- Add RLS (Row Level Security) policies
ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE unsubscribe_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_ai_metadata ENABLE ROW LEVEL SECURITY;

-- Weekly digests policies (drop existing first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own weekly digests" ON weekly_digests;
CREATE POLICY "Users can view their own weekly digests"
ON weekly_digests FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own weekly digests" ON weekly_digests;
CREATE POLICY "Users can insert their own weekly digests"
ON weekly_digests FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own weekly digests" ON weekly_digests;
CREATE POLICY "Users can update their own weekly digests"
ON weekly_digests FOR UPDATE
USING (auth.uid() = user_id);

-- Unsubscribe sessions policies (drop existing first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own unsubscribe sessions" ON unsubscribe_sessions;
CREATE POLICY "Users can view their own unsubscribe sessions"
ON unsubscribe_sessions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own unsubscribe sessions" ON unsubscribe_sessions;
CREATE POLICY "Users can insert their own unsubscribe sessions"
ON unsubscribe_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Email AI metadata policies (drop existing first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own email AI metadata" ON email_ai_metadata;
CREATE POLICY "Users can view their own email AI metadata"
ON email_ai_metadata FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own email AI metadata" ON email_ai_metadata;
CREATE POLICY "Users can insert their own email AI metadata"
ON email_ai_metadata FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own email AI metadata" ON email_ai_metadata;
CREATE POLICY "Users can update their own email AI metadata"
ON email_ai_metadata FOR UPDATE
USING (auth.uid() = user_id);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_weekly_digests_updated_at ON weekly_digests;
CREATE TRIGGER update_weekly_digests_updated_at
BEFORE UPDATE ON weekly_digests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_ai_metadata_updated_at ON email_ai_metadata;
CREATE TRIGGER update_email_ai_metadata_updated_at
BEFORE UPDATE ON email_ai_metadata
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Skip demo data insertion (users don't exist yet)

-- Create a view for email intelligence dashboard
CREATE OR REPLACE VIEW email_intelligence_dashboard AS
SELECT
    e.user_id,
    COUNT(*) as total_emails,
    COUNT(CASE WHEN e.priority >= 8 THEN 1 END) as high_priority,
    COUNT(CASE WHEN e.priority BETWEEN 6 AND 7 THEN 1 END) as medium_priority,
    COUNT(CASE WHEN e.priority <= 5 THEN 1 END) as low_priority,
    COUNT(CASE WHEN e.unsubscribed = true THEN 1 END) as unsubscribed_count,
    AVG(CASE WHEN m.priority_score IS NOT NULL THEN m.priority_score END) as avg_ai_score,
    AVG(CASE WHEN m.confidence_score IS NOT NULL THEN m.confidence_score END) as avg_confidence,
    COUNT(CASE WHEN m.email_id IS NOT NULL THEN 1 END) as ai_processed_count,
    MAX(e.received_at) as last_email_date
FROM emails e
LEFT JOIN email_ai_metadata m ON e.id = m.email_id AND e.user_id = m.user_id
GROUP BY e.user_id;

-- Grant permissions for the view
GRANT SELECT ON email_intelligence_dashboard TO authenticated;

-- Note: Cannot create policies on views, RLS is enforced on underlying tables

COMMENT ON TABLE weekly_digests IS 'Stores weekly email intelligence digest summaries';
COMMENT ON TABLE unsubscribe_sessions IS 'Tracks bulk unsubscribe operations and their results';
COMMENT ON TABLE email_ai_metadata IS 'Stores AI processing metadata for emails including scores and analysis';
COMMENT ON VIEW email_intelligence_dashboard IS 'Aggregated view of email intelligence metrics per user';