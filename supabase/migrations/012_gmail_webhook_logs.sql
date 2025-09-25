-- Gmail Webhook Logs Table
-- Tracks webhook processing results and errors for monitoring and debugging

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service TEXT NOT NULL DEFAULT 'gmail',
  history_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'no_new_emails')),
  email_count INTEGER DEFAULT 0,
  error_message TEXT,
  processing_time_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_webhook_logs_user_id ON webhook_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_service ON webhook_logs(service);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed_at ON webhook_logs(processed_at);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_user_service_status ON webhook_logs(user_id, service, status);

-- RLS policies
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own webhook logs" ON webhook_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert webhook logs" ON webhook_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update webhook logs" ON webhook_logs
  FOR UPDATE USING (true);

-- Gmail Push Notification Subscriptions Table
-- Tracks active Gmail push notification subscriptions

CREATE TABLE IF NOT EXISTS gmail_push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_name TEXT NOT NULL,
  topic_name TEXT NOT NULL,
  push_endpoint TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  history_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'failed', 'cancelled')),
  last_notification_at TIMESTAMP WITH TIME ZONE,
  notification_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, subscription_name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gmail_push_subscriptions_user_id ON gmail_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_push_subscriptions_status ON gmail_push_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_gmail_push_subscriptions_expires_at ON gmail_push_subscriptions(expires_at);

-- RLS policies
ALTER TABLE gmail_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push subscriptions" ON gmail_push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Function to clean up old webhook logs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM webhook_logs
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get webhook processing statistics
CREATE OR REPLACE FUNCTION get_webhook_stats(
  p_user_id UUID DEFAULT NULL,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  total_notifications INTEGER,
  successful_notifications INTEGER,
  failed_notifications INTEGER,
  avg_processing_time_ms FLOAT,
  total_emails_processed INTEGER,
  success_rate FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_notifications,
    COUNT(*) FILTER (WHERE status = 'success')::INTEGER as successful_notifications,
    COUNT(*) FILTER (WHERE status = 'failed')::INTEGER as failed_notifications,
    AVG(processing_time_ms)::FLOAT as avg_processing_time_ms,
    COALESCE(SUM(email_count), 0)::INTEGER as total_emails_processed,
    (COUNT(*) FILTER (WHERE status = 'success')::FLOAT / GREATEST(COUNT(*), 1) * 100)::FLOAT as success_rate
  FROM webhook_logs
  WHERE
    (p_user_id IS NULL OR user_id = p_user_id)
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL
    AND service = 'gmail';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gmail_push_subscriptions_updated_at
  BEFORE UPDATE ON gmail_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE webhook_logs IS 'Tracks Gmail webhook processing results for monitoring and debugging';
COMMENT ON TABLE gmail_push_subscriptions IS 'Manages Gmail push notification subscriptions for real-time email processing';
COMMENT ON FUNCTION cleanup_old_webhook_logs() IS 'Removes webhook logs older than 30 days to prevent table bloat';
COMMENT ON FUNCTION get_webhook_stats(UUID, INTEGER) IS 'Returns webhook processing statistics for monitoring dashboard';