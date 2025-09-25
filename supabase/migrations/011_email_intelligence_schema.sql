-- ===============================================
-- EMAIL INTELLIGENCE SYSTEM - PHASE 1 SCHEMA
-- ===============================================
-- Migration: 008_email_intelligence_schema.sql
-- Purpose: Create tables for smart email scoring and processing system
-- Created: Phase 1 - SPARC Implementation Plan

-- ===============================================
-- EMAIL SCORES TABLE
-- Stores scoring data for each email with breakdown
-- ===============================================
-- Table already exists, just add any missing columns
DO $$
BEGIN
    -- Add gmail_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'email_scores'
                   AND column_name = 'gmail_id') THEN
        ALTER TABLE email_scores ADD COLUMN gmail_id VARCHAR;
    END IF;

    -- Add ai_processed column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'email_scores'
                   AND column_name = 'ai_processed') THEN
        ALTER TABLE email_scores ADD COLUMN ai_processed BOOLEAN DEFAULT false;
    END IF;

    -- Add ai_analysis column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'email_scores'
                   AND column_name = 'ai_analysis') THEN
        ALTER TABLE email_scores ADD COLUMN ai_analysis JSONB;
    END IF;

    -- Add ai_cost column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'email_scores'
                   AND column_name = 'ai_cost') THEN
        ALTER TABLE email_scores ADD COLUMN ai_cost DECIMAL(10, 6);
    END IF;

    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'email_scores'
                   AND column_name = 'updated_at') THEN
        ALTER TABLE email_scores ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

-- ===============================================
-- VIP SENDERS TABLE
-- User-defined VIP senders with custom scoring boosts
-- ===============================================
-- Table already exists, just add missing columns
DO $$
BEGIN
    -- Add sender_domain column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'vip_senders'
                   AND column_name = 'sender_domain') THEN
        ALTER TABLE vip_senders ADD COLUMN sender_domain VARCHAR;
    END IF;

    -- Add learned_from_user_action column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'vip_senders'
                   AND column_name = 'learned_from_user_action') THEN
        ALTER TABLE vip_senders ADD COLUMN learned_from_user_action BOOLEAN DEFAULT false;
    END IF;

    -- Add confidence_score column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'vip_senders'
                   AND column_name = 'confidence_score') THEN
        ALTER TABLE vip_senders ADD COLUMN confidence_score DECIMAL(3, 2) DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1);
    END IF;

    -- Add usage_count column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'vip_senders'
                   AND column_name = 'usage_count') THEN
        ALTER TABLE vip_senders ADD COLUMN usage_count INTEGER DEFAULT 0;
    END IF;

    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'vip_senders'
                   AND column_name = 'updated_at') THEN
        ALTER TABLE vip_senders ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

-- ===============================================
-- WEEKLY DIGESTS TABLE
-- Stores weekly digest data and user actions
-- ===============================================
-- Table already exists, just add missing columns
DO $$
BEGIN
    -- Add week_end_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'weekly_digests'
                   AND column_name = 'week_end_date') THEN
        ALTER TABLE weekly_digests ADD COLUMN week_end_date DATE;
    END IF;

    -- Add user_viewed_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'weekly_digests'
                   AND column_name = 'user_viewed_at') THEN
        ALTER TABLE weekly_digests ADD COLUMN user_viewed_at TIMESTAMP;
    END IF;

    -- Add actions_completed_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'weekly_digests'
                   AND column_name = 'actions_completed_at') THEN
        ALTER TABLE weekly_digests ADD COLUMN actions_completed_at TIMESTAMP;
    END IF;

    -- Add total_low_priority_emails column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'weekly_digests'
                   AND column_name = 'total_low_priority_emails') THEN
        ALTER TABLE weekly_digests ADD COLUMN total_low_priority_emails INTEGER DEFAULT 0;
    END IF;

    -- Add emails_processed column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'weekly_digests'
                   AND column_name = 'emails_processed') THEN
        ALTER TABLE weekly_digests ADD COLUMN emails_processed INTEGER DEFAULT 0;
    END IF;

    -- Add cost_savings column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'weekly_digests'
                   AND column_name = 'cost_savings') THEN
        ALTER TABLE weekly_digests ADD COLUMN cost_savings DECIMAL(10, 6);
    END IF;
END $$;

-- ===============================================
-- EMAIL PATTERNS TABLE
-- Learned patterns for improved scoring accuracy
-- ===============================================
CREATE TABLE IF NOT EXISTS email_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Pattern definition
    pattern_type VARCHAR NOT NULL CHECK (pattern_type IN ('sender', 'subject', 'content', 'domain')),
    pattern_value VARCHAR NOT NULL, -- The actual pattern (email, keyword, etc.)

    -- Impact on scoring
    score_impact INTEGER NOT NULL CHECK (score_impact >= -50 AND score_impact <= 50),
    confidence_score DECIMAL(3, 2) DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),

    -- Learning metadata
    learned_from_user_action BOOLEAN DEFAULT false,
    sample_count INTEGER DEFAULT 1, -- How many examples led to this pattern
    success_rate DECIMAL(3, 2) DEFAULT 0.0, -- How often this pattern was correct

    -- Pattern metadata
    last_seen_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),

    -- Constraints
    UNIQUE(user_id, pattern_type, pattern_value)
);

-- ===============================================
-- USER SCORING PREFERENCES TABLE
-- User customization for scoring algorithm
-- ===============================================
CREATE TABLE IF NOT EXISTS user_scoring_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Scoring weights (multipliers for different factors)
    vip_sender_weight DECIMAL(3, 2) DEFAULT 1.0,
    urgent_keywords_weight DECIMAL(3, 2) DEFAULT 1.0,
    marketing_penalty_weight DECIMAL(3, 2) DEFAULT 1.0,
    time_decay_weight DECIMAL(3, 2) DEFAULT 1.0,
    gmail_signals_weight DECIMAL(3, 2) DEFAULT 1.0,

    -- Processing preferences
    high_priority_threshold INTEGER DEFAULT 80 CHECK (high_priority_threshold >= 50 AND high_priority_threshold <= 100),
    medium_priority_threshold INTEGER DEFAULT 40 CHECK (medium_priority_threshold >= 10 AND medium_priority_threshold <= 80),

    -- Feature toggles
    enable_pattern_learning BOOLEAN DEFAULT true,
    enable_weekly_digest BOOLEAN DEFAULT true,
    enable_bulk_unsubscribe BOOLEAN DEFAULT true,

    -- AI preferences
    max_ai_cost_per_day DECIMAL(6, 2) DEFAULT 1.00, -- Dollar limit per day
    preferred_ai_model VARCHAR DEFAULT 'gpt-4o-mini',

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Constraints
    UNIQUE(user_id)
);

-- ===============================================
-- PERFORMANCE INDEXES
-- Optimized for fast scoring and querying
-- ===============================================
CREATE INDEX IF NOT EXISTS idx_email_scores_user_tier ON email_scores(user_id, processing_tier);
CREATE INDEX IF NOT EXISTS idx_email_scores_created ON email_scores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_scores_gmail_id ON email_scores(gmail_id) WHERE gmail_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vip_senders_user_email ON vip_senders(user_id, sender_email);
-- Create domain index only if column exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'vip_senders'
               AND column_name = 'sender_domain') THEN
        CREATE INDEX IF NOT EXISTS idx_vip_senders_domain ON vip_senders(user_id, sender_domain);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_weekly_digests_user_week ON weekly_digests(user_id, week_start_date DESC);

CREATE INDEX IF NOT EXISTS idx_patterns_user_type ON email_patterns(user_id, pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_last_seen ON email_patterns(last_seen_at DESC);

-- ===============================================
-- MATERIALIZED VIEW FOR FAST SCORING LOOKUPS
-- Precomputed scoring patterns for performance
-- ===============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS user_scoring_patterns AS
SELECT
    user_id,
    pattern_type,
    pattern_value,
    AVG(score_impact) as avg_impact,
    COUNT(*) as pattern_frequency,
    MAX(confidence_score) as max_confidence,
    MAX(last_seen_at) as last_used
FROM email_patterns
WHERE confidence_score > 0.5 -- Only confident patterns
GROUP BY user_id, pattern_type, pattern_value
HAVING COUNT(*) >= 2; -- Require at least 2 examples

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_user_scoring_patterns_lookup
ON user_scoring_patterns(user_id, pattern_type, pattern_value);

-- ===============================================
-- ROW LEVEL SECURITY
-- Ensure users only access their own data
-- ===============================================
ALTER TABLE email_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their own email scores" ON email_scores
    FOR ALL USING (auth.uid() = user_id);

ALTER TABLE vip_senders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own VIP senders" ON vip_senders
    FOR ALL USING (auth.uid() = user_id);

ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their own weekly digests" ON weekly_digests
    FOR ALL USING (auth.uid() = user_id);

ALTER TABLE email_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their own email patterns" ON email_patterns
    FOR ALL USING (auth.uid() = user_id);

ALTER TABLE user_scoring_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own scoring preferences" ON user_scoring_preferences
    FOR ALL USING (auth.uid() = user_id);

-- ===============================================
-- UPDATE TRIGGERS
-- Auto-update timestamps and maintain data integrity
-- ===============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables with updated_at columns
CREATE TRIGGER update_email_scores_updated_at BEFORE UPDATE ON email_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vip_senders_updated_at BEFORE UPDATE ON vip_senders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_scoring_preferences_updated_at BEFORE UPDATE ON user_scoring_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===============================================
-- EXTENSION FOR EXISTING FEED_ITEMS TABLE
-- Add new columns to support email intelligence
-- ===============================================
ALTER TABLE feed_items ADD COLUMN IF NOT EXISTS raw_score INTEGER;
ALTER TABLE feed_items ADD COLUMN IF NOT EXISTS final_score INTEGER;
ALTER TABLE feed_items ADD COLUMN IF NOT EXISTS processing_tier VARCHAR CHECK (processing_tier IN ('high', 'medium', 'low'));
ALTER TABLE feed_items ADD COLUMN IF NOT EXISTS ai_processed BOOLEAN DEFAULT false;

-- Index for feed_items scoring columns
CREATE INDEX IF NOT EXISTS idx_feed_items_scoring ON feed_items(user_id, processing_tier, final_score DESC);

-- ===============================================
-- INITIAL DATA - DEFAULT PREFERENCES
-- Create default scoring preferences for existing users
-- ===============================================
INSERT INTO user_scoring_preferences (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_scoring_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- ===============================================
-- REFRESH MATERIALIZED VIEW FUNCTION
-- Function to refresh the scoring patterns view
-- ===============================================
CREATE OR REPLACE FUNCTION refresh_user_scoring_patterns()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_scoring_patterns;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION refresh_user_scoring_patterns() TO authenticated;

-- ===============================================
-- CLEANUP FUNCTIONS
-- Functions to maintain data hygiene
-- ===============================================
CREATE OR REPLACE FUNCTION cleanup_old_email_scores(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_scores
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_old_weekly_digests(weeks_to_keep INTEGER DEFAULT 12)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM weekly_digests
    WHERE week_start_date < NOW() - INTERVAL '1 week' * weeks_to_keep;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cleanup_old_email_scores(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_weekly_digests(INTEGER) TO service_role;

-- ===============================================
-- MIGRATION COMPLETE
-- ===============================================
-- Summary:
-- ✅ email_scores - Core scoring data with AI processing tracking
-- ✅ vip_senders - User-defined VIP sender management
-- ✅ weekly_digests - Weekly cleanup reports with bulk actions
-- ✅ email_patterns - Machine learning pattern storage
-- ✅ user_scoring_preferences - User customization settings
-- ✅ Performance indexes for fast querying
-- ✅ Materialized view for scoring optimization
-- ✅ Row Level Security for data protection
-- ✅ Automated triggers and cleanup functions
-- ✅ Enhanced feed_items with scoring columns

-- This schema supports:
-- 🎯 Multi-tier email processing (high/medium/low)
-- 💰 AI cost tracking and optimization
-- 🤖 Pattern learning from user behavior
-- 📊 Weekly digest generation with bulk actions
-- ⚡ High-performance scoring and querying
-- 🔒 Complete data security and privacy