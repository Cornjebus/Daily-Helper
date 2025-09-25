-- Hourly summaries and reply drafts for Junie MVP

CREATE TABLE IF NOT EXISTS hourly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hour_timestamp TIMESTAMPTZ NOT NULL,
  total_emails INTEGER NOT NULL DEFAULT 0,
  important_count INTEGER NOT NULL DEFAULT 0,
  chaos_count INTEGER NOT NULL DEFAULT 0,
  summary_text TEXT,
  important_emails JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hourly_summaries_user_time ON hourly_summaries(user_id, hour_timestamp DESC);

ALTER TABLE hourly_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own hourly summaries" ON hourly_summaries
  FOR ALL USING (auth.uid() = user_id);

-- Reply drafts and logs
CREATE TABLE IF NOT EXISTS reply_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_content TEXT,
  ai_suggestions JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reply_drafts_user_email ON reply_drafts(user_id, email_id);

ALTER TABLE reply_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own reply drafts" ON reply_drafts
  FOR ALL USING (auth.uid() = user_id);

