/**
 * EMAIL INTELLIGENCE DATABASE TESTS
 * Tests for Phase 1 database schema and functionality
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'

describe('Email Intelligence Database Schema', () => {
  let supabase: any

  beforeEach(() => {
    // Initialize Supabase client for testing
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
  })

  describe('Email Scores Table', () => {
    test('should create email score with valid data', async () => {
      const testUserId = 'test-user-' + Math.random().toString(36)
      const emailScore = {
        user_id: testUserId,
        email_id: 'gmail-123',
        gmail_id: 'gmail-message-123',
        raw_score: 85,
        final_score: 90,
        processing_tier: 'high',
        score_factors: {
          baseScore: 30,
          vipBoost: 30,
          urgentKeywords: 25,
          timeDecay: 5
        },
        ai_processed: true,
        ai_cost: 0.0003
      }

      const { data, error } = await supabase
        .from('email_scores')
        .insert(emailScore)
        .select()

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].raw_score).toBe(85)
      expect(data[0].final_score).toBe(90)
      expect(data[0].processing_tier).toBe('high')
    })

    test('should enforce score constraints (0-100)', async () => {
      const invalidScore = {
        user_id: 'test-user-123',
        email_id: 'gmail-456',
        raw_score: 150, // Invalid: > 100
        final_score: 90,
        processing_tier: 'high'
      }

      const { error } = await supabase
        .from('email_scores')
        .insert(invalidScore)

      expect(error).not.toBeNull()
      expect(error.message).toContain('constraint')
    })

    test('should enforce unique constraint on user_id + email_id', async () => {
      const emailScore = {
        user_id: 'test-user-duplicate',
        email_id: 'gmail-duplicate',
        raw_score: 50,
        final_score: 50,
        processing_tier: 'medium'
      }

      // Insert first record
      await supabase.from('email_scores').insert(emailScore)

      // Try to insert duplicate
      const { error } = await supabase
        .from('email_scores')
        .insert(emailScore)

      expect(error).not.toBeNull()
      expect(error.message).toContain('duplicate')
    })
  })

  describe('VIP Senders Table', () => {
    test('should create VIP sender with custom boost', async () => {
      const vipSender = {
        user_id: 'test-user-vip',
        sender_email: 'boss@company.com',
        sender_name: 'CEO Boss',
        sender_domain: 'company.com',
        score_boost: 35,
        auto_category: 'now'
      }

      const { data, error } = await supabase
        .from('vip_senders')
        .insert(vipSender)
        .select()

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].score_boost).toBe(35)
      expect(data[0].auto_category).toBe('now')
    })

    test('should enforce score_boost constraints (0-50)', async () => {
      const invalidVIP = {
        user_id: 'test-user-123',
        sender_email: 'invalid@example.com',
        score_boost: 75 // Invalid: > 50
      }

      const { error } = await supabase
        .from('vip_senders')
        .insert(invalidVIP)

      expect(error).not.toBeNull()
      expect(error.message).toContain('constraint')
    })
  })

  describe('Weekly Digests Table', () => {
    test('should create weekly digest with structured data', async () => {
      const weeklyDigest = {
        user_id: 'test-user-digest',
        week_start_date: '2024-01-01',
        week_end_date: '2024-01-07',
        low_priority_emails: [
          {
            category: 'marketing',
            count: 15,
            senders: ['amazon.com', 'bestbuy.com'],
            subjects: ['50% off deals', 'Flash sale ends tonight']
          }
        ],
        unsubscribe_suggestions: {
          safeToUnsubscribe: [
            { sender: 'promo@store.com', count: 8, confidence: 0.95 }
          ],
          needsReview: [
            { sender: 'news@techcrunch.com', count: 3, confidence: 0.70 }
          ]
        },
        total_low_priority_emails: 15,
        cost_savings: 0.045
      }

      const { data, error } = await supabase
        .from('weekly_digests')
        .insert(weeklyDigest)
        .select()

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].total_low_priority_emails).toBe(15)
      expect(data[0].unsubscribe_suggestions.safeToUnsubscribe).toHaveLength(1)
    })

    test('should enforce unique constraint on user_id + week_start_date', async () => {
      const digest = {
        user_id: 'test-user-unique-week',
        week_start_date: '2024-01-01',
        week_end_date: '2024-01-07',
        low_priority_emails: [],
        unsubscribe_suggestions: {},
        total_low_priority_emails: 0
      }

      // Insert first record
      await supabase.from('weekly_digests').insert(digest)

      // Try to insert duplicate week
      const { error } = await supabase
        .from('weekly_digests')
        .insert(digest)

      expect(error).not.toBeNull()
      expect(error.message).toContain('duplicate')
    })
  })

  describe('Email Patterns Table', () => {
    test('should create email pattern for learning', async () => {
      const pattern = {
        user_id: 'test-user-pattern',
        pattern_type: 'sender',
        pattern_value: 'newsletter@medium.com',
        score_impact: -15,
        confidence_score: 0.85,
        learned_from_user_action: true,
        sample_count: 5,
        success_rate: 0.80
      }

      const { data, error } = await supabase
        .from('email_patterns')
        .insert(pattern)
        .select()

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].score_impact).toBe(-15)
      expect(data[0].confidence_score).toBe(0.85)
    })

    test('should enforce pattern_type constraints', async () => {
      const invalidPattern = {
        user_id: 'test-user-123',
        pattern_type: 'invalid_type', // Not in allowed values
        pattern_value: 'test',
        score_impact: 10
      }

      const { error } = await supabase
        .from('email_patterns')
        .insert(invalidPattern)

      expect(error).not.toBeNull()
      expect(error.message).toContain('constraint')
    })

    test('should enforce score_impact constraints (-50 to +50)', async () => {
      const invalidImpact = {
        user_id: 'test-user-123',
        pattern_type: 'subject',
        pattern_value: 'urgent',
        score_impact: 75 // Invalid: > 50
      }

      const { error } = await supabase
        .from('email_patterns')
        .insert(invalidImpact)

      expect(error).not.toBeNull()
      expect(error.message).toContain('constraint')
    })
  })

  describe('User Scoring Preferences Table', () => {
    test('should create default scoring preferences', async () => {
      const preferences = {
        user_id: 'test-user-prefs',
        vip_sender_weight: 1.2,
        urgent_keywords_weight: 1.5,
        high_priority_threshold: 85,
        medium_priority_threshold: 45,
        max_ai_cost_per_day: 2.00,
        preferred_ai_model: 'gpt-4o-mini'
      }

      const { data, error } = await supabase
        .from('user_scoring_preferences')
        .insert(preferences)
        .select()

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].high_priority_threshold).toBe(85)
      expect(data[0].max_ai_cost_per_day).toBe('2.00')
    })

    test('should enforce threshold constraints', async () => {
      const invalidThreshold = {
        user_id: 'test-user-123',
        high_priority_threshold: 150 // Invalid: > 100
      }

      const { error } = await supabase
        .from('user_scoring_preferences')
        .insert(invalidThreshold)

      expect(error).not.toBeNull()
      expect(error.message).toContain('constraint')
    })
  })

  describe('Materialized View', () => {
    test('should create and query user_scoring_patterns view', async () => {
      // Insert test patterns first
      const patterns = [
        {
          user_id: 'test-user-view',
          pattern_type: 'sender',
          pattern_value: 'marketing@store.com',
          score_impact: -20,
          confidence_score: 0.9
        },
        {
          user_id: 'test-user-view',
          pattern_type: 'sender',
          pattern_value: 'marketing@store.com',
          score_impact: -18,
          confidence_score: 0.8
        }
      ]

      await supabase.from('email_patterns').insert(patterns)

      // Refresh materialized view
      const { error: refreshError } = await supabase
        .rpc('refresh_user_scoring_patterns')

      expect(refreshError).toBeNull()

      // Query the view
      const { data, error } = await supabase
        .from('user_scoring_patterns')
        .select('*')
        .eq('user_id', 'test-user-view')
        .eq('pattern_value', 'marketing@store.com')

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].pattern_frequency).toBe(2)
      expect(data[0].avg_impact).toBeCloseTo(-19) // Average of -20 and -18
    })
  })

  describe('Extended Feed Items', () => {
    test('should support new scoring columns in feed_items', async () => {
      const feedItem = {
        user_id: 'test-user-feed',
        source: 'gmail',
        external_id: 'gmail-test-123',
        title: 'Test Email',
        content: 'Test content',
        category: 'next',
        priority: 5,
        raw_score: 65,
        final_score: 70,
        processing_tier: 'medium',
        ai_processed: false
      }

      const { data, error } = await supabase
        .from('feed_items')
        .insert(feedItem)
        .select()

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].raw_score).toBe(65)
      expect(data[0].final_score).toBe(70)
      expect(data[0].processing_tier).toBe('medium')
    })
  })

  describe('Cleanup Functions', () => {
    test('should cleanup old email scores', async () => {
      // Insert old email score (simulate old data)
      const oldScore = {
        user_id: 'test-user-cleanup',
        email_id: 'old-email-123',
        raw_score: 50,
        final_score: 50,
        processing_tier: 'medium',
        created_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString() // 100 days ago
      }

      await supabase.from('email_scores').insert(oldScore)

      // Run cleanup function (keep 90 days)
      const { data: cleanupResult } = await supabase
        .rpc('cleanup_old_email_scores', { days_to_keep: 90 })

      expect(cleanupResult).toBeGreaterThan(0) // Should delete the old record
    })
  })

  afterEach(async () => {
    // Clean up test data
    try {
      await supabase.from('email_scores').delete().like('user_id', 'test-user-%')
      await supabase.from('vip_senders').delete().like('user_id', 'test-user-%')
      await supabase.from('weekly_digests').delete().like('user_id', 'test-user-%')
      await supabase.from('email_patterns').delete().like('user_id', 'test-user-%')
      await supabase.from('user_scoring_preferences').delete().like('user_id', 'test-user-%')
      await supabase.from('feed_items').delete().like('user_id', 'test-user-%')
    } catch (e) {
      // Ignore cleanup errors
    }
  })
})

describe('Database Performance', () => {
  test('should query email scores efficiently with indexes', async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const startTime = Date.now()

    // Query that should use the optimized indexes
    const { data, error } = await supabase
      .from('email_scores')
      .select('*')
      .eq('user_id', 'test-performance-user')
      .eq('processing_tier', 'high')
      .order('created_at', { ascending: false })
      .limit(10)

    const queryTime = Date.now() - startTime

    expect(error).toBeNull()
    expect(queryTime).toBeLessThan(100) // Should be very fast with proper indexes
  })
})