-- Learning System Schema
-- This migration adds tables for tracking user actions and learning from them

-- User Actions Table - Track all user interactions
CREATE TABLE IF NOT EXISTS user_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('star', 'archive', 'reply', 'delete', 'read', 'unread')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    email_score DECIMAL(3,2), -- Store the email score at time of action
    sender_email VARCHAR(255),
    subject TEXT,
    patterns TEXT[], -- Store patterns that were active for this email
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- VIP Senders Table - Track and learn VIP status
CREATE TABLE IF NOT EXISTS vip_senders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_email VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL,
    vip_score DECIMAL(3,2) NOT NULL DEFAULT 0.0 CHECK (vip_score >= 0.0 AND vip_score <= 1.0),
    confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    interaction_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_interaction TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sender_email, user_id)
);

-- Email Patterns Table - Store and adjust pattern weights
CREATE TABLE IF NOT EXISTS email_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pattern_name VARCHAR(100) NOT NULL UNIQUE,
    pattern_type VARCHAR(20) NOT NULL CHECK (pattern_type IN ('keyword', 'sender', 'subject', 'content', 'time', 'urgency')),
    weight DECIMAL(3,2) NOT NULL DEFAULT 1.0 CHECK (weight >= 0.1 AND weight <= 2.0),
    sample_size INTEGER NOT NULL DEFAULT 0,
    effectiveness_score DECIMAL(3,2) DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Pattern Effectiveness Table - Track how well patterns predict user behavior
CREATE TABLE IF NOT EXISTS pattern_effectiveness (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pattern_name VARCHAR(100) NOT NULL REFERENCES email_patterns(pattern_name) ON DELETE CASCADE,
    effectiveness_score DECIMAL(4,3) NOT NULL DEFAULT 0.0,
    sample_size INTEGER NOT NULL DEFAULT 0,
    positive_actions INTEGER NOT NULL DEFAULT 0,
    negative_actions INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pattern_name)
);

-- Learning Metrics Table - Store overall learning system metrics
CREATE TABLE IF NOT EXISTS learning_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_type VARCHAR(50) NOT NULL,
    metrics JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(metric_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_actions_user_id ON user_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_email_id ON user_actions(email_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_timestamp ON user_actions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_actions_action ON user_actions(action);
CREATE INDEX IF NOT EXISTS idx_user_actions_sender_email ON user_actions(sender_email);

CREATE INDEX IF NOT EXISTS idx_vip_senders_user_id ON vip_senders(user_id);
CREATE INDEX IF NOT EXISTS idx_vip_senders_sender_email ON vip_senders(sender_email);
CREATE INDEX IF NOT EXISTS idx_vip_senders_vip_score ON vip_senders(vip_score DESC);
CREATE INDEX IF NOT EXISTS idx_vip_senders_last_interaction ON vip_senders(last_interaction DESC);

CREATE INDEX IF NOT EXISTS idx_email_patterns_pattern_name ON email_patterns(pattern_name);
CREATE INDEX IF NOT EXISTS idx_email_patterns_pattern_type ON email_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_email_patterns_weight ON email_patterns(weight DESC);
CREATE INDEX IF NOT EXISTS idx_email_patterns_is_active ON email_patterns(is_active);

CREATE INDEX IF NOT EXISTS idx_pattern_effectiveness_effectiveness ON pattern_effectiveness(effectiveness_score DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_effectiveness_sample_size ON pattern_effectiveness(sample_size DESC);

-- Insert default email patterns
INSERT INTO email_patterns (pattern_name, pattern_type, weight) VALUES
    ('urgent_keywords', 'keyword', 1.5),
    ('meeting_keywords', 'keyword', 1.2),
    ('deadline_keywords', 'keyword', 1.4),
    ('question_keywords', 'keyword', 1.1),
    ('action_required', 'keyword', 1.3),
    ('high_priority_senders', 'sender', 1.8),
    ('internal_senders', 'sender', 1.0),
    ('external_senders', 'sender', 0.8),
    ('meeting_subject', 'subject', 1.2),
    ('fwd_re_subject', 'subject', 0.9),
    ('morning_time', 'time', 1.1),
    ('business_hours', 'time', 1.0),
    ('weekend_time', 'time', 0.7),
    ('exclamation_urgency', 'urgency', 1.3),
    ('caps_urgency', 'urgency', 1.2),
    ('asap_urgency', 'urgency', 1.6)
ON CONFLICT (pattern_name) DO NOTHING;

-- Triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vip_senders_updated_at
    BEFORE UPDATE ON vip_senders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_patterns_updated_at
    BEFORE UPDATE ON email_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for security
ALTER TABLE user_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_metrics ENABLE ROW LEVEL SECURITY;

-- Users can only see their own actions and VIP senders
CREATE POLICY "Users can view own user_actions" ON user_actions
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own user_actions" ON user_actions
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can view own vip_senders" ON vip_senders
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can manage own vip_senders" ON vip_senders
    FOR ALL USING (auth.uid()::text = user_id);

-- Email patterns and effectiveness are globally readable
CREATE POLICY "Email patterns are globally readable" ON email_patterns
    FOR SELECT USING (true);

CREATE POLICY "Pattern effectiveness is globally readable" ON pattern_effectiveness
    FOR SELECT USING (true);

-- Learning metrics are globally readable (aggregated data)
CREATE POLICY "Learning metrics are globally readable" ON learning_metrics
    FOR SELECT USING (true);

-- Function to get user's VIP senders with learning insights
CREATE OR REPLACE FUNCTION get_user_vip_insights(user_uuid UUID)
RETURNS TABLE (
    sender_email VARCHAR(255),
    vip_score DECIMAL(3,2),
    confidence_score DECIMAL(3,2),
    interaction_count INTEGER,
    recent_positive_actions INTEGER,
    recent_negative_actions INTEGER,
    trend VARCHAR(20)
)
LANGUAGE sql STABLE
AS $$
    SELECT
        vs.sender_email,
        vs.vip_score,
        vs.confidence_score,
        vs.interaction_count,
        COALESCE(ra.positive_count, 0) as recent_positive_actions,
        COALESCE(ra.negative_count, 0) as recent_negative_actions,
        CASE
            WHEN COALESCE(ra.positive_count, 0) > COALESCE(ra.negative_count, 0) THEN 'improving'
            WHEN COALESCE(ra.positive_count, 0) < COALESCE(ra.negative_count, 0) THEN 'declining'
            ELSE 'stable'
        END as trend
    FROM vip_senders vs
    LEFT JOIN (
        SELECT
            sender_email,
            SUM(CASE WHEN action IN ('star', 'reply') THEN 1 ELSE 0 END) as positive_count,
            SUM(CASE WHEN action IN ('archive', 'delete') THEN 1 ELSE 0 END) as negative_count
        FROM user_actions
        WHERE user_id = user_uuid::text
        AND timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY sender_email
    ) ra ON vs.sender_email = ra.sender_email
    WHERE vs.user_id = user_uuid::text
    ORDER BY vs.vip_score DESC, vs.confidence_score DESC;
$$;

-- Function to get pattern effectiveness insights
CREATE OR REPLACE FUNCTION get_pattern_insights()
RETURNS TABLE (
    pattern_name VARCHAR(100),
    pattern_type VARCHAR(20),
    current_weight DECIMAL(3,2),
    effectiveness_score DECIMAL(4,3),
    sample_size INTEGER,
    confidence_level VARCHAR(20),
    recommendation VARCHAR(50)
)
LANGUAGE sql STABLE
AS $$
    SELECT
        ep.pattern_name,
        ep.pattern_type,
        ep.weight as current_weight,
        COALESCE(pe.effectiveness_score, 0.0) as effectiveness_score,
        COALESCE(pe.sample_size, 0) as sample_size,
        CASE
            WHEN COALESCE(pe.sample_size, 0) >= 100 THEN 'high'
            WHEN COALESCE(pe.sample_size, 0) >= 50 THEN 'medium'
            WHEN COALESCE(pe.sample_size, 0) >= 20 THEN 'low'
            ELSE 'insufficient'
        END as confidence_level,
        CASE
            WHEN COALESCE(pe.effectiveness_score, 0) > 0.3 AND ep.weight < 1.5 THEN 'increase_weight'
            WHEN COALESCE(pe.effectiveness_score, 0) < -0.3 AND ep.weight > 0.5 THEN 'decrease_weight'
            WHEN COALESCE(pe.effectiveness_score, 0) < -0.5 THEN 'consider_disabling'
            ELSE 'maintain'
        END as recommendation
    FROM email_patterns ep
    LEFT JOIN pattern_effectiveness pe ON ep.pattern_name = pe.pattern_name
    WHERE ep.is_active = true
    ORDER BY COALESCE(pe.effectiveness_score, 0) DESC, ep.weight DESC;
$$;

-- Comments
COMMENT ON TABLE user_actions IS 'Tracks all user interactions with emails for learning';
COMMENT ON TABLE vip_senders IS 'Learns and tracks VIP sender status based on user interactions';
COMMENT ON TABLE email_patterns IS 'Stores email scoring patterns with learnable weights';
COMMENT ON TABLE pattern_effectiveness IS 'Tracks how effective each pattern is at predicting user behavior';
COMMENT ON TABLE learning_metrics IS 'Stores overall learning system performance metrics';