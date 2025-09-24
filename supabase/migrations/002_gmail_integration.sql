-- Gmail integration tables
CREATE TABLE IF NOT EXISTS gmail_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT,
  expiry_date BIGINT,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  subject TEXT,
  sender_email TEXT,
  sender_name TEXT,
  recipient_email TEXT,
  snippet TEXT,
  body_text TEXT,
  body_html TEXT,
  labels JSONB DEFAULT '[]'::jsonb,
  has_attachments BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_unread BOOLEAN DEFAULT true,
  is_important BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gmail_id)
);

CREATE TABLE IF NOT EXISTS email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  subject TEXT,
  participants JSONB DEFAULT '[]'::jsonb,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  is_unread BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, thread_id)
);

CREATE TABLE IF NOT EXISTS sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  sync_token TEXT,
  status TEXT DEFAULT 'idle',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, service)
);

-- RLS policies
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

-- Gmail tokens policies
CREATE POLICY "Users can manage their own Gmail tokens"
  ON gmail_tokens
  FOR ALL
  USING (auth.uid() = user_id);

-- Emails policies
CREATE POLICY "Users can view their own emails"
  ON emails
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert emails"
  ON emails
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service can update emails"
  ON emails
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Email threads policies
CREATE POLICY "Users can view their own email threads"
  ON email_threads
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can manage email threads"
  ON email_threads
  FOR ALL
  USING (auth.uid() = user_id);

-- Sync status policies
CREATE POLICY "Users can manage their sync status"
  ON sync_status
  FOR ALL
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_emails_user_id ON emails(user_id);
CREATE INDEX idx_emails_thread_id ON emails(thread_id);
CREATE INDEX idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX idx_email_threads_user_id ON email_threads(user_id);
CREATE INDEX idx_email_threads_last_message ON email_threads(last_message_at DESC);
CREATE INDEX idx_sync_status_user_service ON sync_status(user_id, service);