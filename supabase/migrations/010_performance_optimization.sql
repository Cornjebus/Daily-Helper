-- Performance Optimization Migration
-- Adds indexes, functions, and optimizations for < 100ms email scoring SLA

BEGIN;

-- Drop existing indexes if they exist to recreate them optimally
DROP INDEX IF EXISTS emails_user_id_received_at_idx;
DROP INDEX IF EXISTS email_ai_metadata_email_id_idx;

-- High-performance indexes for email processing
CREATE INDEX IF NOT EXISTS emails_user_received_unprocessed_idx
ON emails (user_id, received_at DESC)
WHERE priority IS NULL;

CREATE INDEX IF NOT EXISTS emails_priority_score_idx
ON emails (priority, received_at DESC)
WHERE priority IS NOT NULL;

-- AI metadata indexes for fast lookups
CREATE INDEX IF NOT EXISTS email_ai_metadata_score_confidence_idx
ON email_ai_metadata (priority_score, confidence_score);

CREATE INDEX IF NOT EXISTS email_ai_metadata_processing_version_idx
ON email_ai_metadata (processing_version, updated_at);

-- Thread processing indexes
CREATE INDEX IF NOT EXISTS email_threads_message_count_idx
ON email_threads (user_id, last_message_at DESC, message_count)
WHERE message_count > 3;

-- Feed items indexes for dashboard performance
CREATE INDEX IF NOT EXISTS feed_items_source_external_priority_idx
ON feed_items (source, external_id, priority);

CREATE INDEX IF NOT EXISTS feed_items_user_priority_updated_idx
ON feed_items (user_id, priority, updated_at DESC);

-- AI usage indexes for cost tracking
CREATE INDEX IF NOT EXISTS ai_usage_user_operation_date_idx
ON ai_usage (user_id, operation, created_at DESC);

-- Partial indexes for common high-performance queries
CREATE INDEX IF NOT EXISTS emails_important_unread_idx
ON emails (user_id, received_at DESC)
WHERE (is_important = true OR is_unread = true);

CREATE INDEX IF NOT EXISTS feed_items_high_priority_idx
ON feed_items (user_id, updated_at DESC)
WHERE priority <= 3;

-- Composite index for email scoring cache lookups
CREATE INDEX IF NOT EXISTS emails_cache_signature_idx
ON emails (from_email, subject, is_important, is_starred, is_unread);

-- Performance monitoring table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  tier TEXT CHECK (tier IN ('nano', 'mini', 'standard', 'premium')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS performance_metrics_user_operation_idx ON performance_metrics (user_id, operation, created_at DESC);
CREATE INDEX IF NOT EXISTS performance_metrics_duration_idx ON performance_metrics (operation, duration_ms) WHERE success = true;

-- Cache statistics table for monitoring
CREATE TABLE IF NOT EXISTS cache_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_type TEXT NOT NULL,
  hit_rate DECIMAL(5,4) NOT NULL,
  total_requests INTEGER NOT NULL,
  avg_response_time_ms DECIMAL(8,2) NOT NULL,
  memory_usage_bytes BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cache_statistics_type_created_idx ON cache_statistics (cache_type, created_at DESC);

-- Function to get user processing stats with optimized aggregation
CREATE OR REPLACE FUNCTION get_user_processing_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH email_stats AS (
    SELECT
      COUNT(*) as total_emails,
      COUNT(CASE WHEN priority IS NOT NULL THEN 1 END) as processed_emails,
      AVG(CASE WHEN priority IS NOT NULL THEN priority END) as avg_priority
    FROM emails
    WHERE user_id = p_user_id
      AND received_at > NOW() - INTERVAL '30 days' -- Limit to recent emails for performance
  ),
  thread_stats AS (
    SELECT
      COUNT(*) as total_threads,
      COUNT(CASE WHEN message_count > 3 THEN 1 END) as active_threads
    FROM email_threads
    WHERE user_id = p_user_id
      AND last_message_at > NOW() - INTERVAL '30 days'
  ),
  score_stats AS (
    SELECT
      AVG(eam.priority_score) as avg_priority_score,
      COUNT(*) as ai_processed_count
    FROM email_ai_metadata eam
    JOIN emails e ON e.id = eam.email_id
    WHERE e.user_id = p_user_id
      AND eam.updated_at > NOW() - INTERVAL '30 days'
  ),
  performance_stats AS (
    SELECT
      AVG(duration_ms) as avg_processing_time,
      COUNT(*) FILTER (WHERE success = false) as error_count,
      COUNT(*) as total_operations
    FROM performance_metrics
    WHERE user_id = p_user_id
      AND created_at > NOW() - INTERVAL '24 hours'
  )
  SELECT json_build_object(
    'total_emails', COALESCE(es.total_emails, 0),
    'processed_emails', COALESCE(es.processed_emails, 0),
    'total_threads', COALESCE(ts.total_threads, 0),
    'active_threads', COALESCE(ts.active_threads, 0),
    'avg_priority_score', COALESCE(ss.avg_priority_score, 0),
    'avg_priority', COALESCE(es.avg_priority, 0),
    'ai_processed_count', COALESCE(ss.ai_processed_count, 0),
    'avg_processing_time_ms', COALESCE(ps.avg_processing_time, 0),
    'error_rate', CASE
      WHEN COALESCE(ps.total_operations, 0) > 0
      THEN COALESCE(ps.error_count, 0)::DECIMAL / ps.total_operations
      ELSE 0
    END,
    'processing_rate', CASE
      WHEN COALESCE(es.total_emails, 0) > 0
      THEN COALESCE(es.processed_emails, 0)::DECIMAL / es.total_emails
      ELSE 0
    END,
    'updated_at', NOW()
  ) INTO result
  FROM email_stats es, thread_stats ts, score_stats ss, performance_stats ps;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record performance metrics
CREATE OR REPLACE FUNCTION record_performance_metric(
  p_user_id UUID,
  p_operation TEXT,
  p_duration_ms INTEGER,
  p_success BOOLEAN DEFAULT true,
  p_metadata JSONB DEFAULT '{}',
  p_tier TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  metric_id UUID;
BEGIN
  INSERT INTO performance_metrics (user_id, operation, duration_ms, success, metadata, tier)
  VALUES (p_user_id, p_operation, p_duration_ms, p_success, p_metadata, p_tier)
  RETURNING id INTO metric_id;

  RETURN metric_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get performance summary
CREATE OR REPLACE FUNCTION get_performance_summary(
  p_time_window_hours INTEGER DEFAULT 24
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH performance_data AS (
    SELECT
      operation,
      AVG(duration_ms) as avg_duration,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_duration,
      COUNT(*) as total_operations,
      COUNT(*) FILTER (WHERE success = false) as error_count,
      COUNT(*) FILTER (WHERE duration_ms > 100 AND operation = 'email_scoring') as sla_violations
    FROM performance_metrics
    WHERE created_at > NOW() - (p_time_window_hours || ' hours')::INTERVAL
    GROUP BY operation
  ),
  tier_distribution AS (
    SELECT
      tier,
      COUNT(*) as usage_count,
      AVG(duration_ms) as avg_duration
    FROM performance_metrics
    WHERE created_at > NOW() - (p_time_window_hours || ' hours')::INTERVAL
      AND tier IS NOT NULL
    GROUP BY tier
  )
  SELECT json_build_object(
    'operations', json_agg(
      json_build_object(
        'operation', pd.operation,
        'avg_duration_ms', ROUND(pd.avg_duration::NUMERIC, 2),
        'p95_duration_ms', ROUND(pd.p95_duration::NUMERIC, 2),
        'p99_duration_ms', ROUND(pd.p99_duration::NUMERIC, 2),
        'total_operations', pd.total_operations,
        'error_rate', CASE
          WHEN pd.total_operations > 0
          THEN ROUND((pd.error_count::DECIMAL / pd.total_operations) * 100, 2)
          ELSE 0
        END,
        'sla_compliance', CASE
          WHEN pd.operation = 'email_scoring' AND pd.total_operations > 0
          THEN ROUND(((pd.total_operations - pd.sla_violations)::DECIMAL / pd.total_operations) * 100, 2)
          ELSE NULL
        END
      )
    ),
    'tier_distribution', (
      SELECT json_agg(
        json_build_object(
          'tier', tier,
          'usage_count', usage_count,
          'avg_duration_ms', ROUND(avg_duration::NUMERIC, 2),
          'percentage', ROUND((usage_count::DECIMAL / SUM(usage_count) OVER ()) * 100, 2)
        )
      )
      FROM tier_distribution
    ),
    'generated_at', NOW()
  ) INTO result
  FROM performance_data pd;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update email_ai_metadata user_id
CREATE OR REPLACE FUNCTION update_ai_metadata_user_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-populate user_id from emails table
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id
    FROM emails
    WHERE id = NEW.email_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ai_metadata_user_id ON email_ai_metadata;
CREATE TRIGGER trigger_update_ai_metadata_user_id
  BEFORE INSERT OR UPDATE ON email_ai_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_metadata_user_id();

-- Performance optimization hints
-- Add table statistics refresh
ANALYZE emails;
ANALYZE email_ai_metadata;
ANALYZE email_threads;
ANALYZE feed_items;
ANALYZE ai_usage;

-- Enable RLS policies for performance tables
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_statistics ENABLE ROW LEVEL SECURITY;

-- RLS policies (drop and recreate to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own performance metrics" ON performance_metrics;
CREATE POLICY "Users can view their own performance metrics" ON performance_metrics
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service can insert performance metrics" ON performance_metrics;
CREATE POLICY "Service can insert performance metrics" ON performance_metrics
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view cache statistics" ON cache_statistics;
CREATE POLICY "Admins can view cache statistics" ON cache_statistics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_user_processing_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_performance_metric(UUID, TEXT, INTEGER, BOOLEAN, JSONB, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_performance_summary(INTEGER) TO authenticated, service_role;

-- Insert initial performance targets
INSERT INTO cache_statistics (cache_type, hit_rate, total_requests, avg_response_time_ms, memory_usage_bytes)
VALUES
  ('email_scoring', 0.85, 0, 25.0, 0),
  ('database_queries', 0.75, 0, 150.0, 0)
ON CONFLICT DO NOTHING;

COMMIT;

-- Add helpful comments
COMMENT ON TABLE performance_metrics IS 'Real-time performance metrics for monitoring SLA compliance';
COMMENT ON TABLE cache_statistics IS 'Cache performance statistics for optimization';
COMMENT ON FUNCTION get_user_processing_stats(UUID) IS 'Optimized aggregation of user email processing statistics';
COMMENT ON FUNCTION record_performance_metric(UUID, TEXT, INTEGER, BOOLEAN, JSONB, TEXT) IS 'Records performance metrics for monitoring';
COMMENT ON FUNCTION get_performance_summary(INTEGER) IS 'Generates performance summary report for specified time window';