#!/usr/bin/env node

/**
 * Phase 5 Demo Environment Setup Script
 * Creates realistic demo data showcasing email intelligence features
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Initialize Supabase client
function initSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
  }

  return createClient(supabaseUrl, supabaseKey)
}

// Demo user data
const DEMO_USERS = [
  {
    email: 'demo@rallyintelligence.com',
    password: 'DemoPass123!',
    full_name: 'Demo User',
    tier: 'pro'
  },
  {
    email: 'executive@rallyintelligence.com',
    password: 'ExecPass123!',
    full_name: 'Executive Demo',
    tier: 'enterprise'
  }
]

// Realistic demo email data
const DEMO_EMAILS = [
  // High Priority VIP Emails
  {
    subject: 'Q4 Board Meeting - Final Agenda Review URGENT',
    from_email: 'ceo@acmecorp.com',
    from_name: 'Sarah Johnson, CEO',
    snippet: 'Hi team, we need to finalize the Q4 board presentation by EOD. The investors are particularly interested in our AI cost reduction metrics. Please review the attached agenda and confirm your sections.',
    is_important: true,
    is_starred: true,
    is_unread: true,
    priority: 9,
    ai_score: 9.2,
    ai_reasoning: 'CEO urgent request with board meeting deadline - highest priority',
    vip_sender: true,
    category: 'now'
  },
  {
    subject: 'Critical: Production API Issues - Immediate Response Needed',
    from_email: 'alerts@system-monitor.com',
    from_name: 'System Alerts',
    snippet: 'ALERT: Gmail API rate limits exceeded. Email processing delayed. Current queue: 2,847 emails. Estimated recovery: 2 hours. Auto-scaling activated.',
    is_important: true,
    is_unread: true,
    priority: 10,
    ai_score: 9.8,
    ai_reasoning: 'Critical system alert requiring immediate attention',
    category: 'now'
  },
  {
    subject: 'Invoice Overdue - Payment Required Within 24 Hours',
    from_email: 'billing@cloudservices.com',
    from_name: 'CloudServices Billing',
    snippet: 'Your account has an overdue balance of $2,847.50. To avoid service interruption, please remit payment within 24 hours. Account ID: CS-2024-7891',
    is_important: true,
    is_unread: true,
    priority: 8,
    ai_score: 8.5,
    ai_reasoning: 'Overdue payment notice with service interruption risk',
    category: 'now'
  },

  // Medium Priority Business Emails
  {
    subject: 'Weekly Engineering Standup - Tomorrow 2PM',
    from_email: 'engineering-lead@company.com',
    from_name: 'Mike Chen, Engineering Lead',
    snippet: 'Team, reminder about our weekly standup tomorrow at 2PM. Agenda: Sprint review, AI processing optimization results (67% cost reduction achieved!), and Q4 planning.',
    is_unread: true,
    priority: 6,
    ai_score: 6.3,
    ai_reasoning: 'Regular meeting reminder with important project updates',
    category: 'next'
  },
  {
    subject: 'Client Demo Feedback: Rally Intelligence Platform',
    from_email: 'client@bigtech.com',
    from_name: 'Jennifer Adams, CTO BigTech',
    snippet: 'The demo was impressive! Particularly interested in the email intelligence features. The 67% cost reduction and mass unsubscribe functionality could save us millions. Can we schedule a technical deep-dive?',
    is_starred: true,
    is_unread: true,
    priority: 7,
    ai_score: 7.4,
    ai_reasoning: 'Positive client feedback requesting follow-up meeting',
    vip_sender: true,
    category: 'next'
  },
  {
    subject: 'Performance Metrics: August Email Processing Report',
    from_email: 'analytics@rallyintelligence.com',
    from_name: 'Analytics Team',
    snippet: 'Monthly report: 1.2M emails processed, average response time 97ms, 67% cost reduction vs baseline, 94% accuracy in priority scoring. Full report attached.',
    priority: 5,
    ai_score: 5.8,
    ai_reasoning: 'Routine analytics report with positive metrics',
    category: 'later'
  },

  // Low Priority Marketing/Spam Emails
  {
    subject: 'Exclusive: 50% Off Premium Email Templates!',
    from_email: 'noreply@marketingspam.com',
    from_name: 'Template Designs Pro',
    snippet: 'Limited time offer! Get professional email templates for just $29.99 (normally $59.99). Over 500 designs available. Use code SAVE50 at checkout.',
    priority: 2,
    ai_score: 2.1,
    ai_reasoning: 'Marketing email with promotional content - low priority',
    category: 'later',
    bulk_sender: true
  },
  {
    subject: 'Your Weekly Newsletter: Tech Industry Updates',
    from_email: 'newsletter@techupdates.com',
    from_name: 'TechUpdates Newsletter',
    snippet: 'This week: AI breakthroughs in email processing, new startup funding rounds, and industry job market trends. Plus, exclusive interviews with top CTOs.',
    priority: 3,
    ai_score: 3.2,
    ai_reasoning: 'Newsletter content - routine reading, low urgency',
    category: 'later',
    bulk_sender: true
  },
  {
    subject: 'Unsubscribe Notice: 47 Marketing Lists Detected',
    from_email: 'unsubscribe@rallyintelligence.com',
    from_name: 'Rally Intelligence',
    snippet: 'Weekly digest: We detected 47 marketing emails this week. Bulk unsubscribe has been initiated for inactive lists. Estimated time saved: 23 minutes.',
    priority: 4,
    ai_score: 4.1,
    ai_reasoning: 'System automation report showing time savings',
    category: 'later'
  },

  // Thread Examples for Summarization
  {
    subject: 'RE: API Integration Discussion (Thread of 8)',
    from_email: 'dev-team@company.com',
    from_name: 'Development Team',
    snippet: 'Final decision: Using REST APIs with JWT authentication. Estimated timeline: 2 sprints. Mike will lead backend integration, Lisa handles frontend.',
    priority: 6,
    ai_score: 6.7,
    ai_reasoning: 'Important technical decision in ongoing discussion',
    thread_summary: 'Thread discussing API integration approach, authentication method, and resource allocation across 8 messages',
    thread_key_points: [
      'REST API approach approved over GraphQL',
      'JWT authentication selected for security',
      'Timeline: 2 sprints for full implementation',
      'Team assignments: Mike (backend), Lisa (frontend)'
    ],
    category: 'next'
  },

  // Demonstration of Cost Savings
  {
    subject: 'Cost Optimization Report: Q3 Email Processing',
    from_email: 'finance@rallyintelligence.com',
    from_name: 'Finance Team',
    snippet: 'Impressive results! Email processing costs down 67% compared to Q2. Previous: $18,429/month. Current: $6,082/month. Annual savings projection: $148,164.',
    is_starred: true,
    priority: 7,
    ai_score: 7.2,
    ai_reasoning: 'Significant cost savings report from finance team',
    category: 'next'
  }
]

// Weekly digest templates
const WEEKLY_DIGEST_DATA = {
  high_priority_count: 12,
  medium_priority_count: 34,
  low_priority_count: 156,
  total_processed: 202,
  cost_savings_percent: 67,
  cost_savings_amount: '$12,347',
  time_saved_minutes: 347,
  unsubscribe_actions: 23,
  ai_accuracy_percent: 94.2,
  processing_speed_ms: 97
}

// Performance metrics for demo
const PERFORMANCE_METRICS = {
  daily_stats: {
    emails_processed: 1847,
    avg_processing_time_ms: 97,
    api_calls_made: 234,
    cost_per_email_cents: 0.33,
    accuracy_rate: 94.2,
    sla_compliance: 99.8
  },
  cost_comparison: {
    previous_month: 18429, // $184.29
    current_month: 6082,   // $60.82
    savings_percent: 67,
    savings_amount: 12347  // $123.47
  },
  performance_trends: [
    { date: '2024-09-18', processing_time: 142, cost: 0.52 },
    { date: '2024-09-19', processing_time: 128, cost: 0.48 },
    { date: '2024-09-20', processing_time: 105, cost: 0.41 },
    { date: '2024-09-21', processing_time: 98, cost: 0.35 },
    { date: '2024-09-22', processing_time: 97, cost: 0.33 }
  ]
}

async function createDemoUser(supabase, userData) {
  console.log(`👤 Creating demo user: ${userData.email}`)

  // Create user with Supabase Auth
  const { data, error } = await supabase.auth.admin.createUser({
    email: userData.email,
    password: userData.password,
    email_confirm: true,
    user_metadata: {
      full_name: userData.full_name,
      tier: userData.tier
    }
  })

  if (error) {
    console.error(`❌ Error creating user ${userData.email}:`, error)
    return null
  }

  console.log(`✅ Created user: ${userData.email} (${data.user.id})`)
  return data.user
}

async function createDemoEmails(supabase, userId) {
  console.log(`📧 Creating demo emails for user: ${userId}`)

  const emailsToInsert = DEMO_EMAILS.map((email, index) => ({
    id: `demo-email-${index + 1}`,
    user_id: userId,
    gmail_id: `demo-gmail-${index + 1}`,
    thread_id: `demo-thread-${Math.ceil((index + 1) / 3)}`,
    subject: email.subject,
    from_email: email.from_email,
    from_name: email.from_name,
    snippet: email.snippet,
    is_important: email.is_important || false,
    is_starred: email.is_starred || false,
    is_unread: email.is_unread || false,
    priority: email.priority,
    received_at: new Date(Date.now() - (index * 3600000)).toISOString(), // Spread across last 24 hours
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }))

  const { error: emailError } = await supabase
    .from('emails')
    .insert(emailsToInsert)

  if (emailError) {
    console.error('❌ Error creating demo emails:', emailError)
    return false
  }

  // Create AI metadata
  const aiMetadata = DEMO_EMAILS.map((email, index) => ({
    email_id: `demo-email-${index + 1}`,
    user_id: userId,
    priority_score: email.ai_score || email.priority,
    processing_version: 'gpt-4o-mini',
    confidence_score: 0.94,
    features_analyzed: {
      vip_sender: email.vip_sender || false,
      bulk_sender: email.bulk_sender || false,
      has_attachments: Math.random() > 0.7,
      thread_length: Math.floor(Math.random() * 10) + 1
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }))

  const { error: metadataError } = await supabase
    .from('email_ai_metadata')
    .insert(aiMetadata)

  if (metadataError) {
    console.error('❌ Error creating AI metadata:', metadataError)
    return false
  }

  // Create feed items
  const feedItems = DEMO_EMAILS.map((email, index) => ({
    user_id: userId,
    source: 'gmail',
    external_id: `demo-email-${index + 1}`,
    title: email.subject,
    content: email.snippet,
    category: email.category,
    priority: email.priority,
    metadata: {
      from: email.from_email,
      ai_score: email.ai_score,
      ai_processed: true,
      ai_model: 'gpt-4o-mini',
      ai_reasoning: email.ai_reasoning
    },
    created_at: new Date(Date.now() - (index * 3600000)).toISOString()
  }))

  const { error: feedError } = await supabase
    .from('feed_items')
    .insert(feedItems)

  if (feedError) {
    console.error('❌ Error creating feed items:', feedError)
    return false
  }

  console.log(`✅ Created ${DEMO_EMAILS.length} demo emails with AI metadata`)
  return true
}

async function createPerformanceMetrics(supabase, userId) {
  console.log('📊 Creating performance metrics...')

  // Create AI usage records
  const usageRecords = []
  const now = new Date()

  for (let i = 0; i < 30; i++) {
    const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000))
    const emailsProcessed = Math.floor(Math.random() * 500) + 1000

    for (let j = 0; j < Math.min(emailsProcessed, 100); j++) { // Limit records for demo
      usageRecords.push({
        user_id: userId,
        operation: Math.random() > 0.7 ? 'email_summary' : 'email_scoring',
        model: 'gpt-4o-mini',
        prompt_tokens: Math.floor(Math.random() * 200) + 100,
        completion_tokens: Math.floor(Math.random() * 50) + 20,
        total_tokens: 0, // Will be calculated
        cost_cents: Math.floor(Math.random() * 5) + 2,
        created_at: new Date(date.getTime() + (j * 60000)).toISOString()
      })
    }
  }

  // Calculate total tokens
  usageRecords.forEach(record => {
    record.total_tokens = record.prompt_tokens + record.completion_tokens
  })

  const { error: usageError } = await supabase
    .from('ai_usage')
    .insert(usageRecords.slice(0, 500)) // Limit for demo

  if (usageError) {
    console.error('❌ Error creating usage records:', usageError)
    return false
  }

  // Create budget record
  const { error: budgetError } = await supabase
    .from('ai_budgets')
    .insert({
      user_id: userId,
      daily_limit_cents: 500,
      monthly_limit_cents: 10000,
      alert_at_percent: 80,
      daily_usage_cents: 167,
      monthly_usage_cents: 3420
    })

  if (budgetError) {
    console.error('❌ Error creating budget:', budgetError)
    return false
  }

  console.log('✅ Created performance metrics and usage data')
  return true
}

async function createWeeklyDigest(supabase, userId) {
  console.log('📄 Creating weekly digest data...')

  const digestData = {
    user_id: userId,
    week_start: new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
    week_end: new Date().toISOString().split('T')[0],
    total_emails: WEEKLY_DIGEST_DATA.total_processed,
    high_priority_emails: WEEKLY_DIGEST_DATA.high_priority_count,
    medium_priority_emails: WEEKLY_DIGEST_DATA.medium_priority_count,
    low_priority_emails: WEEKLY_DIGEST_DATA.low_priority_count,
    unsubscribe_actions: WEEKLY_DIGEST_DATA.unsubscribe_actions,
    time_saved_minutes: WEEKLY_DIGEST_DATA.time_saved_minutes,
    cost_savings_cents: parseInt(WEEKLY_DIGEST_DATA.cost_savings_amount.replace('$', '').replace(',', '')) * 100,
    ai_accuracy_percent: WEEKLY_DIGEST_DATA.ai_accuracy_percent,
    summary_highlights: [
      'Achieved 67% cost reduction in email processing',
      '94.2% AI accuracy in priority scoring',
      'Bulk unsubscribed from 23 marketing lists',
      'Saved 5.8 hours of manual email processing'
    ],
    action_items: [
      'Review high-priority emails from CEO and board members',
      'Follow up on client demo feedback',
      'Address production API rate limiting issues',
      'Process overdue invoice payment'
    ],
    created_at: new Date().toISOString()
  }

  const { error } = await supabase
    .from('weekly_digests')
    .insert(digestData)

  if (error) {
    console.error('❌ Error creating weekly digest:', error)
    return false
  }

  console.log('✅ Created weekly digest')
  return true
}

async function setupDemoEnvironment() {
  console.log('🚀 Setting up Phase 5 Demo Environment...')
  console.log('=====================================')

  const supabase = initSupabase()

  try {
    // Create demo users
    for (const userData of DEMO_USERS) {
      const user = await createDemoUser(supabase, userData)
      if (user) {
        // Create demo data for this user
        await createDemoEmails(supabase, user.id)
        await createPerformanceMetrics(supabase, user.id)
        await createWeeklyDigest(supabase, user.id)
      }
    }

    console.log('')
    console.log('✅ Demo Environment Setup Complete!')
    console.log('==================================')
    console.log('')
    console.log('🔑 Demo Credentials:')
    console.log('Main Demo: demo@rallyintelligence.com / DemoPass123!')
    console.log('Executive Demo: executive@rallyintelligence.com / ExecPass123!')
    console.log('')
    console.log('📊 Demo Features:')
    console.log('• 67% cost reduction demonstrated')
    console.log('• Realistic email priority scoring')
    console.log('• VIP sender detection')
    console.log('• Marketing email penalties')
    console.log('• Weekly digest with bulk unsubscribe')
    console.log('• Performance metrics and trends')
    console.log('• AI accuracy tracking (94.2%)')
    console.log('')

    return true
  } catch (error) {
    console.error('❌ Demo setup failed:', error)
    return false
  }
}

// Run if called directly
if (require.main === module) {
  setupDemoEnvironment().then(success => {
    process.exit(success ? 0 : 1)
  })
}

module.exports = { setupDemoEnvironment }