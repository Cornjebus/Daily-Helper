-- ===============================================
-- AUTOMATION RULES SYSTEM
-- ===============================================
-- Migration: 012_automation_rules.sql
-- Purpose: Create tables for user-defined automation rules
-- Created: Full automation implementation

-- ===============================================
-- AUTOMATION RULES TABLE
-- ===============================================
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Rule definition
  name VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,

  -- Trigger configuration
  trigger_type VARCHAR NOT NULL CHECK (trigger_type IN (
    'sender_email', 'sender_domain', 'subject_contains', 'subject_regex',
    'body_contains', 'has_attachment', 'is_unread', 'score_threshold', 'tier'
  )),
  trigger_value JSONB NOT NULL,
  trigger_operator VARCHAR CHECK (trigger_operator IN (
    'equals', 'contains', 'regex', 'greater_than', 'less_than'
  )),

  -- Action configuration
  action_type VARCHAR NOT NULL CHECK (action_type IN (
    'set_priority', 'set_tier', 'add_label', 'archive',
    'mark_read', 'forward_to', 'notify', 'auto_reply'
  )),
  action_value JSONB,

  -- Execution order
  priority INTEGER DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),

  -- Statistics
  execution_count INTEGER DEFAULT 0,
  last_executed TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  UNIQUE(user_id, name)
);

-- ===============================================
-- PENDING ACTIONS TABLE
-- For actions that need background processing
-- ===============================================
CREATE TABLE IF NOT EXISTS pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_id UUID,

  -- Action details
  action_type VARCHAR NOT NULL CHECK (action_type IN (
    'forward', 'auto_reply', 'send_notification'
  )),
  action_data JSONB,

  -- Processing status
  status VARCHAR DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed'
  )),
  processed_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ===============================================
-- RULE EXECUTION LOG
-- Track rule executions for debugging
-- ===============================================
CREATE TABLE IF NOT EXISTS rule_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES automation_rules(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_id UUID,

  -- Execution details
  triggered BOOLEAN DEFAULT true,
  action_executed BOOLEAN DEFAULT true,
  action_result JSONB,

  -- Error tracking
  error_occurred BOOLEAN DEFAULT false,
  error_message TEXT,

  -- Timing
  execution_time_ms INTEGER,
  executed_at TIMESTAMP DEFAULT NOW()
);

-- ===============================================
-- INDEXES
-- ===============================================
CREATE INDEX IF NOT EXISTS idx_automation_rules_user ON automation_rules(user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_automation_rules_priority ON automation_rules(priority ASC);
CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON pending_actions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_rule_execution_log_rule ON rule_execution_log(rule_id, executed_at DESC);

-- ===============================================
-- ROW LEVEL SECURITY
-- ===============================================
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own rules" ON automation_rules
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE pending_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their pending actions" ON pending_actions
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE rule_execution_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their rule execution logs" ON rule_execution_log
  FOR ALL USING (auth.uid() = user_id);

-- ===============================================
-- FUNCTIONS
-- ===============================================

-- Function to increment rule execution count
CREATE OR REPLACE FUNCTION increment_rule_execution(
  rule_id UUID,
  executed_at TIMESTAMP
) RETURNS void AS $$
BEGIN
  UPDATE automation_rules
  SET
    execution_count = execution_count + 1,
    last_executed = executed_at
  WHERE id = rule_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create automation rules table if not exists
CREATE OR REPLACE FUNCTION create_automation_rules_if_not_exists()
RETURNS void AS $$
BEGIN
  -- This is a no-op since we create the table above
  -- But keeping for compatibility with the code
  NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_automation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_automation_updated_at();

CREATE TRIGGER update_pending_actions_updated_at
  BEFORE UPDATE ON pending_actions
  FOR EACH ROW EXECUTE FUNCTION update_automation_updated_at();

-- ===============================================
-- DEFAULT RULES TEMPLATES
-- Insert some example rules for new users
-- ===============================================
CREATE OR REPLACE FUNCTION create_default_rules_for_user(user_id UUID)
RETURNS void AS $$
BEGIN
  -- Archive marketing emails
  INSERT INTO automation_rules (
    user_id, name, description, enabled,
    trigger_type, trigger_value,
    action_type, action_value,
    priority
  ) VALUES (
    user_id,
    'Archive Marketing Emails',
    'Automatically archive emails with unsubscribe links',
    false, -- Disabled by default
    'body_contains',
    '"unsubscribe"'::jsonb,
    'archive',
    'true'::jsonb,
    10
  ) ON CONFLICT (user_id, name) DO NOTHING;

  -- Mark newsletters as read
  INSERT INTO automation_rules (
    user_id, name, description, enabled,
    trigger_type, trigger_value,
    action_type, action_value,
    priority
  ) VALUES (
    user_id,
    'Auto-Read Newsletters',
    'Mark newsletters as read automatically',
    false, -- Disabled by default
    'subject_contains',
    '"newsletter"'::jsonb,
    'mark_read',
    'true'::jsonb,
    20
  ) ON CONFLICT (user_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION increment_rule_execution(UUID, TIMESTAMP) TO authenticated;
GRANT EXECUTE ON FUNCTION create_automation_rules_if_not_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION create_default_rules_for_user(UUID) TO service_role;

-- ===============================================
-- MIGRATION COMPLETE
-- ===============================================
-- Summary:
-- ✅ automation_rules - User-defined email automation rules
-- ✅ pending_actions - Queue for actions requiring background processing
-- ✅ rule_execution_log - Audit trail of rule executions
-- ✅ Row Level Security for all tables
-- ✅ Helper functions for rule management
-- ✅ Default rule templates for new users