-- Scoring, VIP senders, and Weekly Digests

-- Email scores table (0-100) with tiering and factor breakdown
CREATE TABLE IF NOT EXISTS email_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email_id UUID REFERENCES emails(id) ON DELETE CASCADE UNIQUE NOT NULL,
  raw_score INTEGER NOT NULL,
  final_score INTEGER NOT NULL,
  processing_tier TEXT NOT NULL CHECK (processing_tier IN ('high','medium','low')),
  score_factors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_scores_user_id ON email_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_email_scores_tier ON email_scores(processing_tier);

ALTER TABLE email_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own email scores" ON email_scores
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- VIP senders table
CREATE TABLE IF NOT EXISTS vip_senders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sender_email TEXT NOT NULL,
  sender_name TEXT,
  score_boost INTEGER DEFAULT 30,
  auto_category TEXT CHECK (auto_category IN ('now','next','later')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, sender_email)
);

CREATE INDEX IF NOT EXISTS idx_vip_senders_user ON vip_senders(user_id);

ALTER TABLE vip_senders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own VIPs" ON vip_senders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Weekly digests for low-tier cleanup
CREATE TABLE IF NOT EXISTS weekly_digests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start_date DATE NOT NULL,
  low_priority_emails JSONB,
  unsubscribe_suggestions JSONB,
  user_actions JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_weekly_digests_user_week ON weekly_digests(user_id, week_start_date);

ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own digests" ON weekly_digests
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

