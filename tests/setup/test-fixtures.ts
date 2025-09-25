/**
 * TEST FIXTURES - Phase 4 Testing Infrastructure
 * Mock data fixtures for emails, users, scoring patterns
 * Comprehensive test data generation for all test scenarios
 */

import { addDays, subDays, startOfWeek, endOfWeek } from 'date-fns'

/**
 * Email fixtures for different test scenarios
 */
export const EMAIL_FIXTURES = {
  // High priority emails
  urgentWork: {
    id: 'email-urgent-work',
    user_id: 'test-user-123',
    gmail_id: 'gmail-urgent-work',
    thread_id: 'thread-urgent',
    subject: 'URGENT: Server Down - Immediate Action Required',
    from_email: 'alerts@company.com',
    from_name: 'System Alerts',
    snippet: 'Critical system failure detected. Immediate investigation required. Downtime affecting all users.',
    received_at: new Date().toISOString(),
    is_important: true,
    is_starred: false,
    is_unread: true,
    labels: ['INBOX', 'IMPORTANT'],
    priority: 1,
    category: 'now',
    metadata: {
      hasAttachments: false,
      threadLength: 1,
      classification: 'urgent'
    }
  },

  vipSender: {
    id: 'email-vip-sender',
    user_id: 'test-user-123',
    gmail_id: 'gmail-vip-sender',
    thread_id: 'thread-vip',
    subject: 'Monthly Report Review',
    from_email: 'ceo@company.com',
    from_name: 'Sarah Johnson',
    snippet: 'Please review the monthly performance report and provide your feedback by Friday.',
    received_at: new Date().toISOString(),
    is_important: false,
    is_starred: true,
    is_unread: true,
    labels: ['INBOX'],
    priority: 2,
    category: 'now',
    metadata: {
      hasAttachments: true,
      threadLength: 1,
      classification: 'vip'
    }
  },

  meetingInvite: {
    id: 'email-meeting',
    user_id: 'test-user-123',
    gmail_id: 'gmail-meeting',
    thread_id: 'thread-meeting',
    subject: 'Meeting: Project Planning - Tomorrow 2PM',
    from_email: 'calendar@company.com',
    from_name: 'Calendar System',
    snippet: 'Meeting invitation for project planning session. Location: Conference Room A.',
    received_at: new Date().toISOString(),
    is_important: false,
    is_starred: false,
    is_unread: true,
    labels: ['INBOX', 'CALENDAR'],
    priority: 3,
    category: 'next',
    metadata: {
      hasAttachments: false,
      threadLength: 1,
      classification: 'meeting'
    }
  },

  // Medium priority emails
  workUpdate: {
    id: 'email-work-update',
    user_id: 'test-user-123',
    gmail_id: 'gmail-work-update',
    thread_id: 'thread-work',
    subject: 'Project Status Update - Week 15',
    from_email: 'manager@company.com',
    from_name: 'Mike Chen',
    snippet: 'Weekly project status update. All milestones on track. Next sprint planning meeting scheduled.',
    received_at: subDays(new Date(), 1).toISOString(),
    is_important: false,
    is_starred: false,
    is_unread: true,
    labels: ['INBOX'],
    priority: 5,
    category: 'next',
    metadata: {
      hasAttachments: false,
      threadLength: 3,
      classification: 'work'
    }
  },

  personalEmail: {
    id: 'email-personal',
    user_id: 'test-user-123',
    gmail_id: 'gmail-personal',
    thread_id: 'thread-personal',
    subject: 'Weekend Plans',
    from_email: 'friend@gmail.com',
    from_name: 'Alex Smith',
    snippet: 'Hey! Want to grab dinner this weekend? Let me know what works for you.',
    received_at: subDays(new Date(), 2).toISOString(),
    is_important: false,
    is_starred: false,
    is_unread: false,
    labels: ['INBOX'],
    priority: 6,
    category: 'later',
    metadata: {
      hasAttachments: false,
      threadLength: 1,
      classification: 'personal'
    }
  },

  // Low priority emails (marketing, newsletters, social)
  marketingPromo: {
    id: 'email-marketing',
    user_id: 'test-user-123',
    gmail_id: 'gmail-marketing',
    thread_id: 'thread-marketing',
    subject: '🔥 50% OFF Flash Sale - Limited Time Only!',
    from_email: 'promotions@store.com',
    from_name: 'BestBuy Deals',
    snippet: 'Don\'t miss out on our biggest sale of the year! Save 50% on electronics, home goods, and more. Shop now before it\'s gone!',
    received_at: subDays(new Date(), 1).toISOString(),
    is_important: false,
    is_starred: false,
    is_unread: true,
    labels: ['INBOX', 'PROMOTIONS'],
    priority: 8,
    category: 'later',
    metadata: {
      hasAttachments: false,
      threadLength: 1,
      classification: 'marketing'
    }
  },

  newsletter: {
    id: 'email-newsletter',
    user_id: 'test-user-123',
    gmail_id: 'gmail-newsletter',
    thread_id: 'thread-newsletter',
    subject: 'Weekly Tech Newsletter - AI Advances',
    from_email: 'newsletter@techcrunch.com',
    from_name: 'TechCrunch Weekly',
    snippet: 'This week in tech: AI breakthroughs, startup funding, and the latest gadget reviews.',
    received_at: subDays(new Date(), 3).toISOString(),
    is_important: false,
    is_starred: false,
    is_unread: false,
    labels: ['INBOX', 'NEWSLETTERS'],
    priority: 9,
    category: 'later',
    metadata: {
      hasAttachments: false,
      threadLength: 1,
      classification: 'newsletter'
    }
  },

  socialNotification: {
    id: 'email-social',
    user_id: 'test-user-123',
    gmail_id: 'gmail-social',
    thread_id: 'thread-social',
    subject: 'You have 3 new connections on LinkedIn',
    from_email: 'noreply@linkedin.com',
    from_name: 'LinkedIn Notifications',
    snippet: 'Connect with John Doe, Jane Smith, and Mike Johnson to expand your professional network.',
    received_at: subDays(new Date(), 1).toISOString(),
    is_important: false,
    is_starred: false,
    is_unread: true,
    labels: ['INBOX', 'SOCIAL'],
    priority: 10,
    category: 'later',
    metadata: {
      hasAttachments: false,
      threadLength: 1,
      classification: 'social'
    }
  },

  automatedEmail: {
    id: 'email-automated',
    user_id: 'test-user-123',
    gmail_id: 'gmail-automated',
    thread_id: 'thread-automated',
    subject: 'GitHub: Activity Summary for this week',
    from_email: 'noreply@github.com',
    from_name: 'GitHub',
    snippet: 'Your weekly activity summary: 5 commits, 2 pull requests, 1 issue resolved.',
    received_at: subDays(new Date(), 2).toISOString(),
    is_important: false,
    is_starred: false,
    is_unread: false,
    labels: ['INBOX', 'UPDATES'],
    priority: 9,
    category: 'later',
    metadata: {
      hasAttachments: false,
      threadLength: 1,
      classification: 'automated'
    }
  }
}

/**
 * User fixtures for testing different scenarios
 */
export const USER_FIXTURES = {
  basicUser: {
    id: 'test-user-123',
    email: 'test.user@example.com',
    user_metadata: {
      full_name: 'Test User',
      avatar_url: null
    },
    app_metadata: {
      provider: 'email',
      providers: ['email']
    },
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: new Date().toISOString()
  },

  premiumUser: {
    id: 'test-user-premium',
    email: 'premium.user@example.com',
    user_metadata: {
      full_name: 'Premium User',
      subscription_tier: 'premium'
    },
    app_metadata: {
      provider: 'google',
      providers: ['google']
    },
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: new Date().toISOString()
  }
}

/**
 * VIP sender fixtures
 */
export const VIP_SENDER_FIXTURES = {
  ceoVip: {
    id: 'vip-ceo',
    user_id: 'test-user-123',
    sender_email: 'ceo@company.com',
    sender_name: 'Sarah Johnson',
    sender_domain: 'company.com',
    score_boost: 50,
    auto_category: 'now',
    learned_from_user_action: true,
    confidence_score: 0.95,
    usage_count: 25,
    created_at: subDays(new Date(), 30).toISOString(),
    updated_at: new Date().toISOString()
  },

  familyVip: {
    id: 'vip-family',
    user_id: 'test-user-123',
    sender_email: 'mom@gmail.com',
    sender_name: 'Mom',
    sender_domain: 'gmail.com',
    score_boost: 40,
    auto_category: 'next',
    learned_from_user_action: false,
    confidence_score: 0.85,
    usage_count: 10,
    created_at: subDays(new Date(), 60).toISOString(),
    updated_at: new Date().toISOString()
  }
}

/**
 * Email pattern fixtures for learning system
 */
export const EMAIL_PATTERN_FIXTURES = {
  urgentKeywords: {
    id: 'pattern-urgent',
    user_id: 'test-user-123',
    pattern_type: 'subject',
    pattern_value: 'urgent',
    score_impact: 30,
    confidence_score: 0.9,
    learned_from_user_action: true,
    sample_count: 15,
    success_rate: 0.87,
    last_seen_at: new Date().toISOString(),
    created_at: subDays(new Date(), 7).toISOString()
  },

  marketingDomain: {
    id: 'pattern-marketing',
    user_id: 'test-user-123',
    pattern_type: 'domain',
    pattern_value: 'promotions',
    score_impact: -25,
    confidence_score: 0.85,
    learned_from_user_action: true,
    sample_count: 45,
    success_rate: 0.92,
    last_seen_at: subDays(new Date(), 1).toISOString(),
    created_at: subDays(new Date(), 14).toISOString()
  },

  meetingKeywords: {
    id: 'pattern-meeting',
    user_id: 'test-user-123',
    pattern_type: 'subject',
    pattern_value: 'meeting',
    score_impact: 20,
    confidence_score: 0.75,
    learned_from_user_action: false,
    sample_count: 8,
    success_rate: 0.75,
    last_seen_at: subDays(new Date(), 2).toISOString(),
    created_at: subDays(new Date(), 21).toISOString()
  }
}

/**
 * User scoring preference fixtures
 */
export const SCORING_PREFERENCES_FIXTURES = {
  default: {
    id: 'pref-default',
    user_id: 'test-user-123',
    vip_sender_weight: 1.0,
    urgent_keywords_weight: 1.0,
    marketing_penalty_weight: 1.0,
    time_decay_weight: 1.0,
    gmail_signals_weight: 1.0,
    high_priority_threshold: 80,
    medium_priority_threshold: 40,
    enable_pattern_learning: true,
    enable_weekly_digest: true,
    enable_bulk_unsubscribe: true,
    max_ai_cost_per_day: 1.00,
    preferred_ai_model: 'gpt-4o-mini',
    created_at: subDays(new Date(), 30).toISOString(),
    updated_at: new Date().toISOString()
  },

  customized: {
    id: 'pref-custom',
    user_id: 'test-user-premium',
    vip_sender_weight: 1.5,
    urgent_keywords_weight: 1.2,
    marketing_penalty_weight: 0.8,
    time_decay_weight: 0.9,
    gmail_signals_weight: 1.1,
    high_priority_threshold: 75,
    medium_priority_threshold: 35,
    enable_pattern_learning: true,
    enable_weekly_digest: true,
    enable_bulk_unsubscribe: true,
    max_ai_cost_per_day: 5.00,
    preferred_ai_model: 'gpt-4',
    created_at: subDays(new Date(), 60).toISOString(),
    updated_at: new Date().toISOString()
  }
}

/**
 * Weekly digest fixtures
 */
export const WEEKLY_DIGEST_FIXTURES = {
  sampleWeek: {
    id: 'digest-week-1',
    user_id: 'test-user-123',
    week_start_date: startOfWeek(subDays(new Date(), 7)),
    week_end_date: endOfWeek(subDays(new Date(), 7)),
    low_priority_emails: [
      {
        category: 'marketing',
        count: 15,
        senders: ['promotions@store.com', 'deals@retailer.com', 'sales@brand.com'],
        subjects: ['50% off everything', 'Flash sale ends tonight', 'Black Friday deals']
      },
      {
        category: 'newsletters',
        count: 8,
        senders: ['newsletter@medium.com', 'weekly@techcrunch.com'],
        subjects: ['Weekly digest', 'Tech news roundup', 'Industry insights']
      },
      {
        category: 'social',
        count: 12,
        senders: ['noreply@linkedin.com', 'notifications@facebook.com'],
        subjects: ['New connections', 'Friend requests', 'Activity updates']
      }
    ],
    unsubscribe_suggestions: {
      safeToUnsubscribe: [
        { sender: 'promotions@store.com', count: 8, confidence: 0.95 },
        { sender: 'deals@retailer.com', count: 5, confidence: 0.88 }
      ],
      needsReview: [
        { sender: 'newsletter@medium.com', count: 3, confidence: 0.70 }
      ]
    },
    user_actions: {},
    generated_at: subDays(new Date(), 1).toISOString(),
    user_viewed_at: null,
    actions_completed_at: null,
    total_low_priority_emails: 35,
    emails_processed: 35,
    cost_savings: 0.75
  }
}

/**
 * AI usage tracking fixtures
 */
export const AI_USAGE_FIXTURES = {
  scoring: {
    id: 'usage-scoring-1',
    user_id: 'test-user-123',
    created_at: new Date().toISOString(),
    model: 'gpt-4o-mini',
    operation: 'email_scoring',
    prompt_tokens: 150,
    completion_tokens: 30,
    total_tokens: 180,
    cost_cents: 2,
    context_id: 'email-urgent-work',
    context_type: 'email',
    response: {
      score: 9,
      reasoning: 'High priority due to urgent keywords and important sender'
    },
    error: null,
    duration_ms: 850
  },

  summary: {
    id: 'usage-summary-1',
    user_id: 'test-user-123',
    created_at: new Date().toISOString(),
    model: 'gpt-4o-mini',
    operation: 'email_summary',
    prompt_tokens: 300,
    completion_tokens: 80,
    total_tokens: 380,
    cost_cents: 4,
    context_id: 'thread-work',
    context_type: 'thread',
    response: {
      summary: 'Thread discussing project timeline and deliverables',
      keyPoints: ['Milestone 1 completed', 'Timeline adjustment needed', 'Resource allocation review']
    },
    error: null,
    duration_ms: 1200
  }
}

/**
 * Email AI metadata fixtures
 */
export const EMAIL_AI_METADATA_FIXTURES = {
  urgentProcessed: {
    id: 'ai-meta-urgent',
    email_id: 'email-urgent-work',
    user_id: 'test-user-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    priority_score: 9.2,
    urgency_score: 9.5,
    importance_score: 8.8,
    summary: 'Critical system failure requiring immediate attention',
    key_points: ['System down', 'All users affected', 'Immediate action needed'],
    action_items: ['Investigate cause', 'Restore service', 'Communicate with users'],
    sentiment: 'negative',
    ai_category: 'urgent',
    ai_tags: ['system', 'critical', 'downtime'],
    reply_suggestions: [
      'Acknowledged. Investigating immediately.',
      'On it. Will update in 15 minutes.',
      'Emergency response team activated.'
    ],
    processed_at: new Date().toISOString(),
    processing_version: 'gpt-4o-mini',
    confidence_score: 0.95
  }
}

/**
 * Utility functions for generating test data
 */
export const TEST_DATA_GENERATORS = {
  /**
   * Generate a batch of emails with mixed priorities
   */
  generateMixedEmails(count: number, userId: string = 'test-user-123') {
    const templates = Object.values(EMAIL_FIXTURES)
    const emails = []

    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length]
      emails.push({
        ...template,
        id: `generated-email-${i}`,
        gmail_id: `gmail-generated-${i}`,
        user_id: userId,
        subject: `${template.subject} #${i}`,
        received_at: subDays(new Date(), Math.floor(i / 5)).toISOString()
      })
    }

    return emails
  },

  /**
   * Generate high priority emails only
   */
  generateHighPriorityEmails(count: number, userId: string = 'test-user-123') {
    const highPriorityTemplates = [
      EMAIL_FIXTURES.urgentWork,
      EMAIL_FIXTURES.vipSender,
      EMAIL_FIXTURES.meetingInvite
    ]

    return Array(count).fill(null).map((_, i) => {
      const template = highPriorityTemplates[i % highPriorityTemplates.length]
      return {
        ...template,
        id: `high-priority-${i}`,
        gmail_id: `gmail-high-${i}`,
        user_id: userId,
        subject: `${template.subject} #${i}`,
        received_at: subDays(new Date(), Math.floor(i / 3)).toISOString()
      }
    })
  },

  /**
   * Generate low priority emails only
   */
  generateLowPriorityEmails(count: number, userId: string = 'test-user-123') {
    const lowPriorityTemplates = [
      EMAIL_FIXTURES.marketingPromo,
      EMAIL_FIXTURES.newsletter,
      EMAIL_FIXTURES.socialNotification,
      EMAIL_FIXTURES.automatedEmail
    ]

    return Array(count).fill(null).map((_, i) => {
      const template = lowPriorityTemplates[i % lowPriorityTemplates.length]
      return {
        ...template,
        id: `low-priority-${i}`,
        gmail_id: `gmail-low-${i}`,
        user_id: userId,
        subject: `${template.subject} #${i}`,
        received_at: subDays(new Date(), Math.floor(i / 10)).toISOString()
      }
    })
  },

  /**
   * Generate emails for a specific date range
   */
  generateEmailsForDateRange(startDate: Date, endDate: Date, emailsPerDay: number = 10, userId: string = 'test-user-123') {
    const emails = []
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const dayEmails = this.generateMixedEmails(emailsPerDay, userId)

      dayEmails.forEach((email, i) => {
        email.id = `${currentDate.toISOString().split('T')[0]}-email-${i}`
        email.gmail_id = `${currentDate.toISOString().split('T')[0]}-gmail-${i}`
        email.received_at = new Date(
          currentDate.getTime() + (i * 60 * 60 * 1000) // Spread throughout day
        ).toISOString()
      })

      emails.push(...dayEmails)
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return emails
  }
}

/**
 * Pre-built test data sets for common scenarios
 */
export const TEST_DATA_SETS = {
  // Minimal data for unit tests
  minimal: {
    users: [USER_FIXTURES.basicUser],
    emails: [EMAIL_FIXTURES.urgentWork, EMAIL_FIXTURES.marketingPromo],
    vipSenders: [VIP_SENDER_FIXTURES.ceoVip],
    patterns: [EMAIL_PATTERN_FIXTURES.urgentKeywords],
    preferences: [SCORING_PREFERENCES_FIXTURES.default]
  },

  // Comprehensive data for integration tests
  comprehensive: {
    users: Object.values(USER_FIXTURES),
    emails: Object.values(EMAIL_FIXTURES),
    vipSenders: Object.values(VIP_SENDER_FIXTURES),
    patterns: Object.values(EMAIL_PATTERN_FIXTURES),
    preferences: Object.values(SCORING_PREFERENCES_FIXTURES),
    weeklyDigests: [WEEKLY_DIGEST_FIXTURES.sampleWeek],
    aiUsage: Object.values(AI_USAGE_FIXTURES),
    aiMetadata: [EMAIL_AI_METADATA_FIXTURES.urgentProcessed]
  },

  // Performance test data (100 emails)
  performance: {
    users: [USER_FIXTURES.basicUser],
    emails: TEST_DATA_GENERATORS.generateMixedEmails(100),
    vipSenders: Object.values(VIP_SENDER_FIXTURES),
    patterns: Object.values(EMAIL_PATTERN_FIXTURES),
    preferences: [SCORING_PREFERENCES_FIXTURES.default]
  }
}

export default {
  EMAIL_FIXTURES,
  USER_FIXTURES,
  VIP_SENDER_FIXTURES,
  EMAIL_PATTERN_FIXTURES,
  SCORING_PREFERENCES_FIXTURES,
  WEEKLY_DIGEST_FIXTURES,
  AI_USAGE_FIXTURES,
  EMAIL_AI_METADATA_FIXTURES,
  TEST_DATA_GENERATORS,
  TEST_DATA_SETS
}