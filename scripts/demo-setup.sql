-- =============================================================================
-- DEMO ENVIRONMENT SETUP SCRIPT
-- Creates demo users and sample data showcasing email intelligence features
-- =============================================================================

BEGIN;

-- Create demo users
INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
VALUES
  ('demo-user-executive', 'demo.executive@company.com', NOW(), NOW(), NOW()),
  ('demo-user-manager', 'demo.manager@company.com', NOW(), NOW(), NOW()),
  ('demo-user-individual', 'demo.individual@company.com', NOW(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create demo user profiles
INSERT INTO public.profiles (id, full_name, email, created_at, updated_at)
VALUES
  ('demo-user-executive', 'Alex Executive', 'demo.executive@company.com', NOW(), NOW()),
  ('demo-user-manager', 'Jordan Manager', 'demo.manager@company.com', NOW(), NOW()),
  ('demo-user-individual', 'Taylor Individual', 'demo.individual@company.com', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  updated_at = NOW();

-- Create demo email accounts
INSERT INTO public.email_accounts (id, user_id, email, provider, is_primary, created_at, updated_at)
VALUES
  ('demo-exec-gmail', 'demo-user-executive', 'demo.executive@company.com', 'gmail', true, NOW(), NOW()),
  ('demo-manager-gmail', 'demo-user-manager', 'demo.manager@company.com', 'gmail', true, NOW(), NOW()),
  ('demo-individual-gmail', 'demo-user-individual', 'demo.individual@company.com', 'gmail', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  updated_at = NOW();

-- Create sample emails showcasing different priority levels and AI features

-- HIGH PRIORITY EMAILS (CEO, Urgent, Important)
INSERT INTO public.emails (
  id, user_id, thread_id, subject, from_email, from_name, to_email,
  snippet, is_important, is_starred, is_unread, priority, received_at, created_at
) VALUES
  -- Executive receiving urgent board meeting email
  ('demo-email-1', 'demo-user-executive', 'thread-exec-1', 'URGENT: Emergency Board Meeting - Q4 Revenue Discussion',
   'ceo@company.com', 'Sarah Chen (CEO)', 'demo.executive@company.com',
   'We need to discuss the Q4 revenue shortfall immediately. Emergency board meeting scheduled for tomorrow at 9 AM. Please confirm attendance and review attached financial reports.',
   true, true, true, 9, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),

  -- Manager receiving critical project deadline
  ('demo-email-2', 'demo-user-manager', 'thread-mgr-1', 'Critical: Project Apollo Launch Delayed - Action Required',
   'vp.engineering@company.com', 'Michael Rodriguez (VP Engineering)', 'demo.manager@company.com',
   'The Apollo project launch has been delayed due to critical security vulnerabilities. We need your team to prioritize the security patches. Expected timeline: 48 hours.',
   true, true, true, 8, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),

-- MEDIUM-HIGH PRIORITY (Important meetings, client communications)
  ('demo-email-3', 'demo-user-executive', 'thread-exec-2', 'Client Meeting: Acme Corp Partnership Discussion',
   'partnerships@company.com', 'Lisa Park (Partnerships)', 'demo.executive@company.com',
   'Acme Corp is interested in a strategic partnership worth $2.5M annually. Meeting scheduled for Friday at 2 PM. Please review the proposal deck attached.',
   false, true, true, 7, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'),

  ('demo-email-4', 'demo-user-manager', 'thread-mgr-2', 'Team Performance Review: Q4 Goals Discussion',
   'hr@company.com', 'David Kim (HR Director)', 'demo.manager@company.com',
   'Time for quarterly performance reviews. Your team has shown excellent progress. Lets discuss Q4 goals and potential promotions in our meeting next Tuesday.',
   false, false, true, 6, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours'),

-- MEDIUM PRIORITY (General work items, newsletters)
  ('demo-email-5', 'demo-user-individual', 'thread-ind-1', 'Weekly Team Update: Sprint 23 Retrospective',
   'scrum.master@company.com', 'Emily Watson (Scrum Master)', 'demo.individual@company.com',
   'Sprint 23 completed successfully with 95% story completion rate. Great work on the new features! Next sprint planning on Monday at 10 AM.',
   false, false, true, 5, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'),

  ('demo-email-6', 'demo-user-individual', 'thread-ind-2', 'Tech Talk: AI in Software Development - This Friday',
   'events@company.com', 'Tech Events Team', 'demo.individual@company.com',
   'Join us for an exciting tech talk about AI in software development. Our guest speaker is Dr. Jennifer Liu from Stanford AI Lab. Free lunch provided!',
   false, false, false, 4, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

-- LOW PRIORITY (Newsletters, promotional emails)
  ('demo-email-7', 'demo-user-executive', 'thread-exec-3', 'Industry Report: Q4 Market Analysis',
   'insights@marketresearch.com', 'Market Research Weekly', 'demo.executive@company.com',
   'The latest market analysis shows interesting trends in the tech sector. Cloud computing growth continues at 23% YoY. Full report attached.',
   false, false, false, 3, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),

  ('demo-email-8', 'demo-user-manager', 'thread-mgr-3', 'LinkedIn Learning: New Course Recommendations',
   'noreply@linkedin.com', 'LinkedIn Learning', 'demo.manager@company.com',
   'Based on your role as Engineering Manager, we recommend these courses: Advanced Team Leadership, Agile Project Management, and Technical Architecture Design.',
   false, false, false, 2, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),

  ('demo-email-9', 'demo-user-individual', 'thread-ind-3', 'Newsletter: Developer Tools Weekly #247',
   'newsletter@devtools.com', 'Developer Tools Weekly', 'demo.individual@company.com',
   'This weeks top developer tools: new VS Code extensions, GitHub Copilot updates, and Docker improvements. Plus an interview with the creator of React.',
   false, false, false, 2, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days');

-- Create AI processing metadata for emails
INSERT INTO public.email_ai_metadata (
  email_id, user_id, priority_score, processing_version, confidence_score,
  summary, key_points, reply_suggestions, created_at, updated_at
) VALUES
  ('demo-email-1', 'demo-user-executive', 9, 'gpt-4o-mini', 0.95,
   'Urgent board meeting about Q4 revenue shortfall requiring immediate attention',
   ARRAY['Emergency meeting tomorrow 9 AM', 'Q4 revenue discussion', 'Attendance confirmation required', 'Financial reports to review'],
   ARRAY['I will attend the emergency meeting and review the financial reports beforehand.', 'Confirmed for tomorrow 9 AM. I have reviewed the preliminary numbers.', 'I understand the urgency and will prioritize this discussion.'],
   NOW(), NOW()),

  ('demo-email-2', 'demo-user-manager', 8, 'gpt-4o-mini', 0.92,
   'Critical project delay due to security vulnerabilities needs immediate team action',
   ARRAY['Apollo project delayed', 'Security vulnerabilities found', '48-hour timeline for fixes', 'Team priority reassignment needed'],
   ARRAY['My team will prioritize the security patches immediately. ETA for completion: 36 hours.', 'Understood. Reallocating resources to address security issues first.', 'We will work overtime to meet the 48-hour deadline.'],
   NOW(), NOW()),

  ('demo-email-3', 'demo-user-executive', 7, 'gpt-4o-mini', 0.88,
   'High-value partnership opportunity with Acme Corp worth $2.5M annually',
   ARRAY['$2.5M annual partnership opportunity', 'Strategic partnership with Acme Corp', 'Meeting Friday 2 PM', 'Proposal deck review required'],
   ARRAY['Very interested in this partnership. I will review the proposal and prepare strategic questions.', 'This aligns well with our growth strategy. Lets schedule prep time before the meeting.', 'Please send the proposal deck by Thursday so I can review thoroughly.'],
   NOW(), NOW()),

  ('demo-email-4', 'demo-user-manager', 6, 'gpt-4o-mini', 0.85,
   'Quarterly performance review discussion with focus on Q4 goals and promotions',
   ARRAY['Quarterly performance reviews', 'Team progress recognition', 'Q4 goals discussion', 'Potential promotion opportunities'],
   ARRAY['Thank you for recognizing the teams progress. I look forward to discussing Q4 goals.', 'I have prepared performance summaries for each team member.', 'Lets also discuss professional development opportunities for the team.'],
   NOW(), NOW()),

  ('demo-email-5', 'demo-user-individual', 5, 'gpt-4o-mini', 0.82,
   'Successful sprint completion with planning for next iteration',
   ARRAY['Sprint 23 completed', '95% story completion rate', 'Next sprint planning Monday 10 AM', 'Team performance recognition'],
   ARRAY['Great job team! Looking forward to sprint 24 planning.', 'The high completion rate shows our improved estimation skills.', 'I will prepare my input for the next sprint planning session.'],
   NOW(), NOW());

-- Create email threads for summarization demo
INSERT INTO public.email_threads (id, user_id, subject, participants, email_count, last_activity, created_at, updated_at)
VALUES
  ('thread-exec-1', 'demo-user-executive', 'URGENT: Emergency Board Meeting - Q4 Revenue Discussion',
   ARRAY['ceo@company.com', 'demo.executive@company.com', 'board@company.com'], 3, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 day', NOW()),
  ('thread-mgr-1', 'demo-user-manager', 'Critical: Project Apollo Launch Delayed - Action Required',
   ARRAY['vp.engineering@company.com', 'demo.manager@company.com', 'security@company.com'], 4, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '2 days', NOW()),
  ('thread-exec-2', 'demo-user-executive', 'Client Meeting: Acme Corp Partnership Discussion',
   ARRAY['partnerships@company.com', 'demo.executive@company.com', 'legal@company.com'], 5, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 week', NOW());

-- Create thread summaries
INSERT INTO public.thread_summaries (thread_id, user_id, summary, key_points, last_updated, created_at)
VALUES
  ('thread-exec-1', 'demo-user-executive',
   'Emergency board meeting called to address Q4 revenue shortfall. Multiple stakeholders discussing financial impact and recovery strategies.',
   ARRAY['Q4 revenue 15% below target', 'Board meeting scheduled for tomorrow', 'Financial reports need immediate review', 'Recovery plan discussion required'],
   NOW(), NOW()),
  ('thread-mgr-1', 'demo-user-manager',
   'Project Apollo launch delayed due to critical security vulnerabilities discovered in final testing phase. Engineering teams coordinating rapid response.',
   ARRAY['Security vulnerabilities in Apollo project', '48-hour fix timeline established', 'Resources reallocated to security team', 'Launch postponed indefinitely'],
   NOW(), NOW()),
  ('thread-exec-2', 'demo-user-executive',
   'Strategic partnership negotiations with Acme Corp progressing. Legal review of terms ongoing with positive outlook for $2.5M annual contract.',
   ARRAY['$2.5M annual partnership value', 'Legal terms under review', 'Due diligence phase complete', 'Contract signing planned for next month'],
   NOW(), NOW());

-- Create feed items to showcase intelligent categorization
INSERT INTO public.feed_items (
  id, user_id, source, external_id, title, content, category, priority, metadata, created_at, updated_at
) VALUES
  ('feed-1', 'demo-user-executive', 'gmail', 'demo-email-1', 'URGENT: Emergency Board Meeting - Q4 Revenue Discussion',
   'We need to discuss the Q4 revenue shortfall immediately...', 'now', 9,
   '{"from": "ceo@company.com", "ai_score": 9, "ai_processed": true, "ai_model": "gpt-4o-mini", "ai_reasoning": "Critical business issue requiring immediate executive attention"}',
   NOW() - INTERVAL '2 hours', NOW()),

  ('feed-2', 'demo-user-manager', 'gmail', 'demo-email-2', 'Critical: Project Apollo Launch Delayed - Action Required',
   'The Apollo project launch has been delayed due to critical security...', 'now', 8,
   '{"from": "vp.engineering@company.com", "ai_score": 8, "ai_processed": true, "ai_model": "gpt-4o-mini", "ai_reasoning": "Time-sensitive project issue requiring management intervention"}',
   NOW() - INTERVAL '1 hour', NOW()),

  ('feed-3', 'demo-user-executive', 'gmail', 'demo-email-3', 'Client Meeting: Acme Corp Partnership Discussion',
   'Acme Corp is interested in a strategic partnership worth $2.5M annually...', 'next', 7,
   '{"from": "partnerships@company.com", "ai_score": 7, "ai_processed": true, "ai_model": "gpt-4o-mini", "ai_reasoning": "High-value business opportunity requiring strategic review"}',
   NOW() - INTERVAL '3 hours', NOW()),

  ('feed-4', 'demo-user-individual', 'gmail', 'demo-email-5', 'Weekly Team Update: Sprint 23 Retrospective',
   'Sprint 23 completed successfully with 95% story completion rate...', 'next', 5,
   '{"from": "scrum.master@company.com", "ai_score": 5, "ai_processed": true, "ai_model": "gpt-4o-mini", "ai_reasoning": "Regular team communication with positive updates"}',
   NOW() - INTERVAL '6 hours', NOW()),

  ('feed-5', 'demo-user-individual', 'gmail', 'demo-email-9', 'Newsletter: Developer Tools Weekly #247',
   'This weeks top developer tools: new VS Code extensions...', 'later', 2,
   '{"from": "newsletter@devtools.com", "ai_score": 2, "ai_processed": true, "ai_model": "gpt-4o-mini", "ai_reasoning": "Informational newsletter with low urgency"}',
   NOW() - INTERVAL '4 days', NOW());

-- Create AI budget tracking for cost reduction demo
INSERT INTO public.ai_budgets (
  user_id, daily_limit_cents, monthly_limit_cents, daily_usage_cents, monthly_usage_cents,
  alert_at_percent, created_at, updated_at
) VALUES
  ('demo-user-executive', 500, 10000, 45, 320, 80, NOW() - INTERVAL '1 month', NOW()),
  ('demo-user-manager', 300, 6000, 28, 185, 80, NOW() - INTERVAL '1 month', NOW()),
  ('demo-user-individual', 200, 4000, 15, 98, 80, NOW() - INTERVAL '1 month', NOW())
ON CONFLICT (user_id) DO UPDATE SET
  daily_usage_cents = EXCLUDED.daily_usage_cents,
  monthly_usage_cents = EXCLUDED.monthly_usage_cents,
  updated_at = NOW();

-- Create sample AI usage records showing cost optimization
INSERT INTO public.ai_usage (
  user_id, operation, model, prompt_tokens, completion_tokens, cost_cents, context_id, context_type,
  created_at
) VALUES
  -- Executive user - showing efficient high-priority processing
  ('demo-user-executive', 'email_scoring', 'gpt-4o-mini', 125, 45, 3, 'demo-email-1', 'email', NOW() - INTERVAL '2 hours'),
  ('demo-user-executive', 'email_scoring', 'gpt-4o-mini', 110, 38, 2, 'demo-email-3', 'email', NOW() - INTERVAL '3 hours'),
  ('demo-user-executive', 'thread_summary', 'gpt-4o-mini', 380, 95, 8, 'thread-exec-1', 'thread', NOW() - INTERVAL '1 hour'),

  -- Manager user - balanced processing
  ('demo-user-manager', 'email_scoring', 'gpt-4o-mini', 135, 42, 3, 'demo-email-2', 'email', NOW() - INTERVAL '1 hour'),
  ('demo-user-manager', 'email_scoring', 'gpt-4o-mini', 98, 35, 2, 'demo-email-4', 'email', NOW() - INTERVAL '5 hours'),
  ('demo-user-manager', 'smart_reply', 'gpt-4o-mini', 145, 85, 4, 'demo-email-2', 'email', NOW() - INTERVAL '30 minutes'),

  -- Individual user - cost-efficient processing
  ('demo-user-individual', 'email_scoring', 'gpt-4o-mini', 88, 28, 2, 'demo-email-5', 'email', NOW() - INTERVAL '6 hours'),
  ('demo-user-individual', 'email_scoring', 'gpt-4o-mini', 75, 22, 1, 'demo-email-6', 'email', NOW() - INTERVAL '1 day'),
  ('demo-user-individual', 'email_scoring', 'gpt-4o-mini', 65, 18, 1, 'demo-email-9', 'email', NOW() - INTERVAL '4 days');

-- Create digest preferences for weekly digest demo
INSERT INTO public.digest_preferences (
  user_id, frequency, categories, priority_threshold, include_summaries, include_suggestions,
  send_time, timezone, created_at, updated_at
) VALUES
  ('demo-user-executive', 'daily', ARRAY['now', 'next'], 7, true, true, '08:00:00', 'UTC', NOW(), NOW()),
  ('demo-user-manager', 'weekly', ARRAY['now', 'next'], 5, true, false, '09:00:00', 'UTC', NOW(), NOW()),
  ('demo-user-individual', 'weekly', ARRAY['next', 'later'], 3, false, true, '10:00:00', 'UTC', NOW(), NOW())
ON CONFLICT (user_id) DO UPDATE SET
  updated_at = NOW();

-- Create sample digest history showing engagement
INSERT INTO public.digest_history (
  user_id, digest_type, period_start, period_end, items_count, opened_at, created_at
) VALUES
  ('demo-user-executive', 'daily', NOW()::date - INTERVAL '1 day', NOW()::date, 12, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '1 day'),
  ('demo-user-executive', 'weekly', NOW()::date - INTERVAL '1 week', NOW()::date, 45, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 week'),
  ('demo-user-manager', 'weekly', NOW()::date - INTERVAL '1 week', NOW()::date, 28, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 week'),
  ('demo-user-individual', 'weekly', NOW()::date - INTERVAL '1 week', NOW()::date, 35, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 week');

COMMIT;

-- Create indexes for better demo performance
CREATE INDEX IF NOT EXISTS idx_demo_emails_priority ON emails(priority DESC, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_feed_priority ON feed_items(priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_ai_usage_cost ON ai_usage(created_at DESC, cost_cents DESC);