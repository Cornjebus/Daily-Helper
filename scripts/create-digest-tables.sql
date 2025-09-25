-- Daily Digest System Schema

-- User digest preferences
CREATE TABLE IF NOT EXISTS digest_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT true,
  morning_digest_time TIME DEFAULT '08:00:00',
  afternoon_digest_time TIME DEFAULT '13:00:00',
  evening_digest_time TIME DEFAULT '17:00:00',
  delivery_method TEXT DEFAULT 'dashboard' CHECK (delivery_method IN ('dashboard', 'email', 'slack', 'both')),
  include_sources TEXT[] DEFAULT ARRAY['gmail', 'calendar', 'slack'],
  min_priority INTEGER DEFAULT 5,
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Digest history for tracking generated digests
CREATE TABLE IF NOT EXISTS digest_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_type TEXT CHECK (digest_type IN ('morning', 'afternoon', 'evening', 'manual')),
  sent_at TIMESTAMP DEFAULT NOW(),
  delivery_method TEXT DEFAULT 'dashboard',
  item_count INTEGER,
  high_priority_count INTEGER,
  content JSONB,
  status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'sent', 'failed', 'pending')),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE digest_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for digest_preferences
CREATE POLICY "Users can view own digest preferences" ON digest_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own digest preferences" ON digest_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own digest preferences" ON digest_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for digest_history
CREATE POLICY "Users can view own digest history" ON digest_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own digest history" ON digest_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_digest_preferences_user_id ON digest_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_digest_history_user_sent ON digest_history(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_digest_history_status ON digest_history(status);

-- Default preferences for new users (triggered after signup)
CREATE OR REPLACE FUNCTION create_default_digest_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO digest_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'create_digest_prefs_on_signup'
  ) THEN
    CREATE TRIGGER create_digest_prefs_on_signup
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION create_default_digest_preferences();
  END IF;
END
$$;