/**
 * TEST UTILITIES - Phase 4 Testing Infrastructure
 * Testing utilities for database operations, API calls, assertions
 * Production-ready helpers with proper error handling and cleanup
 */

import { NextRequest } from 'next/server'
import { createTestDatabase, TestDatabase } from './test-config'
import { TEST_DATA_SETS, EMAIL_FIXTURES } from './test-fixtures'

/**
 * Database test utilities
 */
export class DatabaseTestUtils {
  constructor(private testDb: TestDatabase) {}

  /**
   * Insert test data and return inserted records
   */
  async insertTestData(dataSet: any = TEST_DATA_SETS.minimal) {
    const inserted = {
      users: [],
      emails: [],
      vipSenders: [],
      patterns: [],
      preferences: [],
      weeklyDigests: [],
      aiUsage: [],
      aiMetadata: []
    }

    // Insert users (simulated for auth system)
    if (dataSet.users) {
      inserted.users = dataSet.users
    }

    // Insert emails
    if (dataSet.emails && dataSet.emails.length > 0) {
      const { data, error } = await this.testDb.serviceClient
        .from('emails')
        .insert(dataSet.emails)
        .select()

      if (error) throw new Error(`Failed to insert emails: ${error.message}`)
      inserted.emails = data || []
    }

    // Insert feed_items (for email display)
    if (dataSet.emails && dataSet.emails.length > 0) {
      const feedItems = dataSet.emails.map((email: any) => ({
        user_id: email.user_id,
        source: 'gmail',
        external_id: email.id,
        title: email.subject,
        content: email.snippet,
        category: email.category,
        priority: email.priority,
        metadata: email.metadata,
        created_at: email.received_at,
        updated_at: email.received_at
      }))

      await this.testDb.serviceClient
        .from('feed_items')
        .insert(feedItems)
    }

    // Insert VIP senders
    if (dataSet.vipSenders && dataSet.vipSenders.length > 0) {
      const { data, error } = await this.testDb.serviceClient
        .from('vip_senders')
        .insert(dataSet.vipSenders)
        .select()

      if (error) throw new Error(`Failed to insert VIP senders: ${error.message}`)
      inserted.vipSenders = data || []
    }

    // Insert patterns
    if (dataSet.patterns && dataSet.patterns.length > 0) {
      const { data, error } = await this.testDb.serviceClient
        .from('email_patterns')
        .insert(dataSet.patterns)
        .select()

      if (error) throw new Error(`Failed to insert patterns: ${error.message}`)
      inserted.patterns = data || []
    }

    // Insert preferences
    if (dataSet.preferences && dataSet.preferences.length > 0) {
      const { data, error } = await this.testDb.serviceClient
        .from('user_scoring_preferences')
        .insert(dataSet.preferences)
        .select()

      if (error) throw new Error(`Failed to insert preferences: ${error.message}`)
      inserted.preferences = data || []
    }

    // Insert weekly digests
    if (dataSet.weeklyDigests && dataSet.weeklyDigests.length > 0) {
      const { data, error } = await this.testDb.serviceClient
        .from('weekly_digests')
        .insert(dataSet.weeklyDigests)
        .select()

      if (error) throw new Error(`Failed to insert weekly digests: ${error.message}`)
      inserted.weeklyDigests = data || []
    }

    // Insert AI usage
    if (dataSet.aiUsage && dataSet.aiUsage.length > 0) {
      const { data, error } = await this.testDb.serviceClient
        .from('ai_usage')
        .insert(dataSet.aiUsage)
        .select()

      if (error) throw new Error(`Failed to insert AI usage: ${error.message}`)
      inserted.aiUsage = data || []
    }

    // Insert AI metadata
    if (dataSet.aiMetadata && dataSet.aiMetadata.length > 0) {
      const { data, error } = await this.testDb.serviceClient
        .from('email_ai_metadata')
        .insert(dataSet.aiMetadata)
        .select()

      if (error) throw new Error(`Failed to insert AI metadata: ${error.message}`)
      inserted.aiMetadata = data || []
    }

    return inserted
  }

  /**
   * Get emails with optional filtering
   */
  async getEmails(userId: string, filters: any = {}) {
    let query = this.testDb.serviceClient
      .from('emails')
      .select(`
        *,
        email_ai_metadata(*)
      `)
      .eq('user_id', userId)

    if (filters.priority) {
      query = query.eq('priority', filters.priority)
    }

    if (filters.category) {
      query = query.eq('category', filters.category)
    }

    if (filters.isUnread !== undefined) {
      query = query.eq('is_unread', filters.isUnread)
    }

    if (filters.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query.order('received_at', { ascending: false })

    if (error) throw new Error(`Failed to get emails: ${error.message}`)
    return data || []
  }

  /**
   * Get email scores for analysis
   */
  async getEmailScores(userId: string, emailIds: string[] = []) {
    let query = this.testDb.serviceClient
      .from('email_scores')
      .select('*')
      .eq('user_id', userId)

    if (emailIds.length > 0) {
      query = query.in('email_id', emailIds)
    }

    const { data, error } = await query

    if (error) throw new Error(`Failed to get email scores: ${error.message}`)
    return data || []
  }

  /**
   * Get AI usage statistics
   */
  async getAIUsage(userId: string, operation?: string) {
    let query = this.testDb.serviceClient
      .from('ai_usage')
      .select('*')
      .eq('user_id', userId)

    if (operation) {
      query = query.eq('operation', operation)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to get AI usage: ${error.message}`)
    return data || []
  }

  /**
   * Create email with realistic data
   */
  async createTestEmail(userId: string, overrides: any = {}) {
    const baseEmail = {
      ...EMAIL_FIXTURES.workUpdate,
      id: `test-email-${Date.now()}`,
      gmail_id: `gmail-test-${Date.now()}`,
      user_id: userId,
      received_at: new Date().toISOString(),
      ...overrides
    }

    const { data, error } = await this.testDb.serviceClient
      .from('emails')
      .insert(baseEmail)
      .select()
      .single()

    if (error) throw new Error(`Failed to create test email: ${error.message}`)

    // Also create feed_item
    await this.testDb.serviceClient
      .from('feed_items')
      .insert({
        user_id: baseEmail.user_id,
        source: 'gmail',
        external_id: baseEmail.id,
        title: baseEmail.subject,
        content: baseEmail.snippet,
        category: baseEmail.category,
        priority: baseEmail.priority,
        metadata: baseEmail.metadata,
        created_at: baseEmail.received_at
      })

    return data
  }

  /**
   * Verify database state after operations
   */
  async verifyDatabaseState(expectations: {
    emailCount?: number
    aiUsageCount?: number
    vipSenderCount?: number
    patternCount?: number
    userId: string
  }) {
    const { userId, ...counts } = expectations

    if (counts.emailCount !== undefined) {
      const emails = await this.getEmails(userId)
      expect(emails).toHaveLength(counts.emailCount)
    }

    if (counts.aiUsageCount !== undefined) {
      const usage = await this.getAIUsage(userId)
      expect(usage).toHaveLength(counts.aiUsageCount)
    }

    if (counts.vipSenderCount !== undefined) {
      const { data } = await this.testDb.serviceClient
        .from('vip_senders')
        .select('*')
        .eq('user_id', userId)
      expect(data || []).toHaveLength(counts.vipSenderCount)
    }

    if (counts.patternCount !== undefined) {
      const { data } = await this.testDb.serviceClient
        .from('email_patterns')
        .select('*')
        .eq('user_id', userId)
      expect(data || []).toHaveLength(counts.patternCount)
    }
  }
}

/**
 * API test utilities for making HTTP requests
 */
export class APITestUtils {
  constructor(private testDb: TestDatabase) {}

  /**
   * Create mock Next.js request
   */
  createMockRequest(method: string = 'POST', body: any = {}, headers: any = {}) {
    return {
      method,
      json: () => Promise.resolve(body),
      headers: new Headers({
        'content-type': 'application/json',
        ...headers
      }),
      url: 'http://localhost:3000/test',
      nextUrl: {
        pathname: '/test',
        search: '',
        searchParams: new URLSearchParams()
      }
    } as NextRequest
  }

  /**
   * Mock authenticated user for API requests
   */
  mockAuthenticatedUser(userId: string = 'test-user-123') {
    // Mock the Supabase auth.getUser() method
    jest.spyOn(this.testDb.client.auth, 'getUser').mockResolvedValue({
      data: {
        user: {
          id: userId,
          email: `${userId}@example.com`,
          user_metadata: {},
          app_metadata: {},
          aud: 'authenticated',
          created_at: '2024-01-01T00:00:00.000Z'
        }
      },
      error: null
    })

    return userId
  }

  /**
   * Test API endpoint with error handling
   */
  async testAPIEndpoint(
    handler: Function,
    request: NextRequest,
    expectedStatus: number = 200
  ) {
    try {
      const response = await handler(request)

      expect(response.status).toBe(expectedStatus)

      if (response.json) {
        const responseData = await response.json()
        return responseData
      }

      return response
    } catch (error) {
      console.error('API test error:', error)
      throw error
    }
  }

  /**
   * Simulate AI processing API call
   */
  async testAIProcessingEndpoint(
    handler: Function,
    userId: string = 'test-user-123',
    mockAIResponses: boolean = true
  ) {
    this.mockAuthenticatedUser(userId)

    if (mockAIResponses) {
      // Mock successful AI responses
      const mockOpenAI = require('./test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockResolvedValue({
        score: 7,
        reasoning: 'Mock AI scoring for test'
      })
    }

    const request = this.createMockRequest('POST')
    return await this.testAPIEndpoint(handler, request)
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceTestUtils {
  private timers: Map<string, number> = new Map()

  /**
   * Start timing an operation
   */
  startTimer(name: string): void {
    this.timers.set(name, performance.now())
  }

  /**
   * Stop timer and return duration
   */
  stopTimer(name: string): number {
    const startTime = this.timers.get(name)
    if (!startTime) {
      throw new Error(`Timer '${name}' was not started`)
    }

    const duration = performance.now() - startTime
    this.timers.delete(name)
    return duration
  }

  /**
   * Measure function execution time
   */
  async measureAsync<T>(fn: () => Promise<T>, name: string = 'operation'): Promise<{
    result: T
    duration: number
  }> {
    this.startTimer(name)
    try {
      const result = await fn()
      const duration = this.stopTimer(name)
      return { result, duration }
    } catch (error) {
      this.stopTimer(name) // Clean up timer even on error
      throw error
    }
  }

  /**
   * Measure sync function execution time
   */
  measure<T>(fn: () => T, name: string = 'operation'): {
    result: T
    duration: number
  } {
    this.startTimer(name)
    try {
      const result = fn()
      const duration = this.stopTimer(name)
      return { result, duration }
    } catch (error) {
      this.stopTimer(name) // Clean up timer even on error
      throw error
    }
  }

  /**
   * Run performance benchmark
   */
  async benchmark(
    fn: () => Promise<any>,
    iterations: number = 10,
    name: string = 'benchmark'
  ): Promise<{
    averageDuration: number
    minDuration: number
    maxDuration: number
    totalDuration: number
    iterations: number
  }> {
    const durations: number[] = []

    for (let i = 0; i < iterations; i++) {
      const { duration } = await this.measureAsync(fn, `${name}-${i}`)
      durations.push(duration)
    }

    return {
      averageDuration: durations.reduce((a, b) => a + b) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalDuration: durations.reduce((a, b) => a + b),
      iterations
    }
  }

  /**
   * Assert performance requirements
   */
  assertPerformance(duration: number, maxMs: number, operation: string = 'Operation') {
    if (duration > maxMs) {
      throw new Error(`${operation} took ${duration}ms, expected < ${maxMs}ms`)
    }
    expect(duration).toBeLessThan(maxMs)
  }
}

/**
 * Email scoring test utilities
 */
export class EmailScoringTestUtils {
  constructor(private testDb: TestDatabase) {}

  /**
   * Test email scoring with validation
   */
  async testEmailScoring(emails: any[], expectedScores: number[] = []) {
    const results = []

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i]

      // Mock the scoring function or test real implementation
      const score = this.calculateMockScore(email)

      results.push({
        email: email,
        score,
        expectedScore: expectedScores[i] || null
      })

      // Validate score is in valid range
      expect(score).toBeValidEmailScore()

      // Check against expected if provided
      if (expectedScores[i] !== undefined) {
        expect(Math.abs(score - expectedScores[i])).toBeLessThanOrEqual(1)
      }
    }

    return results
  }

  /**
   * Mock scoring calculation for testing
   */
  private calculateMockScore(email: any): number {
    let score = 5 // Base score

    // High priority indicators
    if (email.is_important) score += 3
    if (email.is_starred) score += 2
    if (email.is_unread) score += 1

    // Subject analysis
    const subject = (email.subject || '').toLowerCase()
    if (subject.includes('urgent') || subject.includes('asap')) score += 3
    if (subject.includes('meeting') || subject.includes('call')) score += 1

    // Sender analysis
    const sender = (email.from_email || '').toLowerCase()
    if (sender.includes('ceo') || sender.includes('manager')) score += 2
    if (sender.includes('promo') || sender.includes('marketing')) score -= 3
    if (sender.includes('newsletter') || sender.includes('notification')) score -= 2

    // Ensure score is within bounds
    return Math.max(1, Math.min(10, Math.round(score)))
  }

  /**
   * Validate processing tier assignment
   */
  validateProcessingTiers(scores: number[]): { high: number, medium: number, low: number } {
    const tiers = { high: 0, medium: 0, low: 0 }

    scores.forEach(score => {
      if (score >= 8) tiers.high++
      else if (score >= 4) tiers.medium++
      else tiers.low++
    })

    return tiers
  }
}

/**
 * Assertion utilities for common test patterns
 */
export class AssertionUtils {
  /**
   * Assert email has required structure
   */
  static assertEmailStructure(email: any) {
    expect(email).toHaveProperty('id')
    expect(email).toHaveProperty('user_id')
    expect(email).toHaveProperty('subject')
    expect(email).toHaveProperty('from_email')
    expect(email).toHaveProperty('received_at')
    expect(email).toHaveProperty('priority')
    expect(email).toHaveProperty('category')
  }

  /**
   * Assert AI processing results
   */
  static assertAIProcessingResults(results: any) {
    expect(results).toHaveProperty('success', true)
    expect(results).toHaveProperty('processed')
    expect(results.processed).toHaveProperty('scored')
    expect(results.processed).toHaveProperty('summarized')
    expect(results.processed).toHaveProperty('errors')
  }

  /**
   * Assert cost tracking data
   */
  static assertCostTracking(usage: any) {
    expect(usage).toHaveProperty('model')
    expect(usage).toHaveProperty('operation')
    expect(usage).toHaveProperty('total_tokens')
    expect(usage).toHaveProperty('cost_cents')
    expect(usage.total_tokens).toBeGreaterThanOrEqual(0)
    expect(usage.cost_cents).toBeGreaterThanOrEqual(0)
  }

  /**
   * Assert weekly digest structure
   */
  static assertWeeklyDigest(digest: any) {
    expect(digest).toHaveProperty('week_start_date')
    expect(digest).toHaveProperty('week_end_date')
    expect(digest).toHaveProperty('low_priority_emails')
    expect(digest).toHaveProperty('unsubscribe_suggestions')
    expect(digest.low_priority_emails).toBeInstanceOf(Array)
    expect(digest.unsubscribe_suggestions).toHaveProperty('safeToUnsubscribe')
    expect(digest.unsubscribe_suggestions).toHaveProperty('needsReview')
  }

  /**
   * Assert performance requirements
   */
  static assertPerformanceRequirements(
    operation: string,
    duration: number,
    requirements: { [key: string]: number }
  ) {
    const maxDuration = requirements[operation]
    if (maxDuration) {
      expect(duration).toBeLessThan(maxDuration)
    }
  }
}

/**
 * Mock data generators for tests
 */
export class MockDataGenerator {
  /**
   * Generate realistic email data
   */
  static generateRealisticEmail(overrides: any = {}) {
    const templates = Object.values(EMAIL_FIXTURES)
    const template = templates[Math.floor(Math.random() * templates.length)]

    return {
      ...template,
      id: `mock-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      gmail_id: `gmail-mock-${Date.now()}`,
      received_at: new Date().toISOString(),
      ...overrides
    }
  }

  /**
   * Generate batch of emails with distribution
   */
  static generateEmailBatch(count: number, distribution: {
    high: number // percentage
    medium: number // percentage
    low: number // percentage
  } = { high: 20, medium: 30, low: 50 }) {
    const emails = []
    const highCount = Math.floor((count * distribution.high) / 100)
    const mediumCount = Math.floor((count * distribution.medium) / 100)
    const lowCount = count - highCount - mediumCount

    // High priority emails
    for (let i = 0; i < highCount; i++) {
      emails.push(this.generateRealisticEmail({
        is_important: true,
        priority: Math.floor(Math.random() * 3) + 1, // 1-3
        category: 'now'
      }))
    }

    // Medium priority emails
    for (let i = 0; i < mediumCount; i++) {
      emails.push(this.generateRealisticEmail({
        priority: Math.floor(Math.random() * 3) + 4, // 4-6
        category: 'next'
      }))
    }

    // Low priority emails
    for (let i = 0; i < lowCount; i++) {
      emails.push(this.generateRealisticEmail({
        priority: Math.floor(Math.random() * 3) + 7, // 7-10
        category: 'later',
        from_email: ['promotions@store.com', 'newsletter@site.com', 'noreply@social.com'][Math.floor(Math.random() * 3)]
      }))
    }

    return emails
  }
}

/**
 * Export all utilities as a single object
 */
export default {
  DatabaseTestUtils,
  APITestUtils,
  PerformanceTestUtils,
  EmailScoringTestUtils,
  AssertionUtils,
  MockDataGenerator
}

// Re-export for convenience
export {
  DatabaseTestUtils,
  APITestUtils,
  PerformanceTestUtils,
  EmailScoringTestUtils,
  AssertionUtils,
  MockDataGenerator
}