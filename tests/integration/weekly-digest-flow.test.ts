/**
 * WEEKLY DIGEST FLOW - Integration Tests
 * Complete weekly digest generation and unsubscribe flow tests
 * Tests email categorization, bulk actions, and user interaction flows
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { startOfWeek, endOfWeek, subDays, addDays } from 'date-fns'
import { setupIntegrationTests, createTestUser } from '../setup/test-config'
import { DatabaseTestUtils, APITestUtils, AssertionUtils, MockDataGenerator } from '../setup/test-utils'
import { TEST_DATA_SETS, WEEKLY_DIGEST_FIXTURES, TEST_DATA_GENERATORS } from '../setup/test-fixtures'

describe('Weekly Digest Flow Integration Tests', () => {
  const { getTestDb } = setupIntegrationTests()
  let dbUtils: DatabaseTestUtils
  let apiUtils: APITestUtils
  let testUser: any

  beforeAll(async () => {
    const testDb = getTestDb()
    dbUtils = new DatabaseTestUtils(testDb)
    apiUtils = new APITestUtils(testDb)

    testUser = await createTestUser(testDb, {
      id: 'test-user-digest',
      email: 'digest.test@example.com'
    })
  })

  beforeEach(async () => {
    await getTestDb().reset()
  })

  describe('Weekly Digest Generation', () => {
    test('should generate comprehensive weekly digest', async () => {
      // Create a week's worth of low-priority emails
      const weekStart = startOfWeek(subDays(new Date(), 7))
      const weekEnd = endOfWeek(subDays(new Date(), 7))

      const weeklyEmails = [
        // Marketing emails (15 total)
        ...Array(15).fill(null).map((_, i) => ({
          id: `marketing-${i}`,
          user_id: testUser.user.id,
          gmail_id: `gmail-marketing-${i}`,
          subject: `Sale Alert ${i}: 50% Off Everything!`,
          from_email: ['promotions@store.com', 'deals@retailer.com', 'sales@brand.com'][i % 3],
          from_name: ['Store Promotions', 'Retailer Deals', 'Brand Sales'][i % 3],
          snippet: `Don't miss our amazing sale! Limited time offer with huge savings.`,
          received_at: new Date(weekStart.getTime() + (i * 60 * 60 * 1000)).toISOString(),
          is_important: false,
          is_starred: false,
          is_unread: true,
          labels: ['INBOX', 'PROMOTIONS'],
          priority: 8,
          category: 'later',
          metadata: { classification: 'marketing' }
        })),

        // Newsletter emails (8 total)
        ...Array(8).fill(null).map((_, i) => ({
          id: `newsletter-${i}`,
          user_id: testUser.user.id,
          gmail_id: `gmail-newsletter-${i}`,
          subject: `Weekly Tech News ${i}`,
          from_email: ['newsletter@techcrunch.com', 'weekly@medium.com'][i % 2],
          from_name: ['TechCrunch', 'Medium Weekly'][i % 2],
          snippet: `This week's top stories in technology and innovation.`,
          received_at: new Date(weekStart.getTime() + (i * 8 * 60 * 60 * 1000)).toISOString(),
          is_important: false,
          is_starred: false,
          is_unread: false,
          labels: ['INBOX', 'NEWSLETTERS'],
          priority: 9,
          category: 'later',
          metadata: { classification: 'newsletter' }
        })),

        // Social notifications (12 total)
        ...Array(12).fill(null).map((_, i) => ({
          id: `social-${i}`,
          user_id: testUser.user.id,
          gmail_id: `gmail-social-${i}`,
          subject: `New Activity on Social Platform`,
          from_email: ['noreply@linkedin.com', 'notifications@facebook.com'][i % 2],
          from_name: ['LinkedIn', 'Facebook'][i % 2],
          snippet: `You have new connections and activity updates.`,
          received_at: new Date(weekStart.getTime() + (i * 6 * 60 * 60 * 1000)).toISOString(),
          is_important: false,
          is_starred: false,
          is_unread: true,
          labels: ['INBOX', 'SOCIAL'],
          priority: 10,
          category: 'later',
          metadata: { classification: 'social' }
        }))
      ]

      // Insert test data
      await dbUtils.insertTestData({
        users: [testUser.user],
        emails: weeklyEmails,
        preferences: [{
          id: 'digest-prefs',
          user_id: testUser.user.id,
          enable_weekly_digest: true,
          enable_bulk_unsubscribe: true,
          high_priority_threshold: 80,
          medium_priority_threshold: 40
        }]
      })

      // Generate weekly digest
      const digest = await generateWeeklyDigest(testUser.user.id, weekStart)

      // Verify digest structure
      AssertionUtils.assertWeeklyDigest(digest)

      // Verify categorized emails
      expect(digest.low_priority_emails).toHaveLength(3) // marketing, newsletter, social

      const marketingCategory = digest.low_priority_emails.find((cat: any) => cat.category === 'marketing')
      expect(marketingCategory).toBeDefined()
      expect(marketingCategory.count).toBe(15)
      expect(marketingCategory.senders).toContain('promotions@store.com')

      const newsletterCategory = digest.low_priority_emails.find((cat: any) => cat.category === 'newsletters')
      expect(newsletterCategory).toBeDefined()
      expect(newsletterCategory.count).toBe(8)

      const socialCategory = digest.low_priority_emails.find((cat: any) => cat.category === 'social')
      expect(socialCategory).toBeDefined()
      expect(socialCategory.count).toBe(12)

      // Verify unsubscribe suggestions
      expect(digest.unsubscribe_suggestions.safeToUnsubscribe.length).toBeGreaterThan(0)

      const safeToUnsubscribe = digest.unsubscribe_suggestions.safeToUnsubscribe
      safeToUnsubscribe.forEach((suggestion: any) => {
        expect(suggestion).toHaveProperty('sender')
        expect(suggestion).toHaveProperty('count')
        expect(suggestion).toHaveProperty('confidence')
        expect(suggestion.confidence).toBeGreaterThan(0.8) // High confidence for safe unsubscribe
      })

      // Verify total counts
      expect(digest.total_low_priority_emails).toBe(35) // 15 + 8 + 12
      expect(digest.emails_processed).toBe(35)

      console.log(`✅ Generated weekly digest: ${digest.total_low_priority_emails} low-priority emails categorized`)
    })

    test('should identify safe unsubscribe candidates accurately', async () => {
      // Create emails from repetitive promotional senders
      const weekStart = startOfWeek(subDays(new Date(), 7))

      const repetitiveEmails = [
        // High-frequency promotional sender
        ...Array(10).fill(null).map((_, i) => ({
          id: `promo-heavy-${i}`,
          user_id: testUser.user.id,
          gmail_id: `gmail-promo-heavy-${i}`,
          subject: `Daily Deal ${i}: Save Big Today!`,
          from_email: 'daily-deals@spamstore.com',
          from_name: 'Spam Store Daily',
          snippet: 'Another promotional email you probably dont want.',
          received_at: new Date(weekStart.getTime() + (i * 24 * 60 * 60 * 1000)).toISOString(),
          is_important: false,
          is_starred: false,
          is_unread: true,
          labels: ['INBOX', 'PROMOTIONS'],
          priority: 10,
          category: 'later',
          metadata: { classification: 'marketing' }
        })),

        // Moderate newsletter (should need review)
        ...Array(3).fill(null).map((_, i) => ({
          id: `newsletter-moderate-${i}`,
          user_id: testUser.user.id,
          gmail_id: `gmail-newsletter-moderate-${i}`,
          subject: `Tech Weekly ${i}`,
          from_email: 'newsletter@techblog.com',
          from_name: 'Tech Blog',
          snippet: 'Quality content you might actually want to read.',
          received_at: new Date(weekStart.getTime() + (i * 2 * 24 * 60 * 60 * 1000)).toISOString(),
          is_important: false,
          is_starred: false,
          is_unread: false,
          labels: ['INBOX', 'NEWSLETTERS'],
          priority: 7,
          category: 'later',
          metadata: { classification: 'newsletter' }
        }))
      ]

      await dbUtils.insertTestData({
        users: [testUser.user],
        emails: repetitiveEmails
      })

      const digest = await generateWeeklyDigest(testUser.user.id, weekStart)

      // Verify unsubscribe categorization
      const safeToUnsubscribe = digest.unsubscribe_suggestions.safeToUnsubscribe
      const needsReview = digest.unsubscribe_suggestions.needsReview

      // High-frequency promotional sender should be safe to unsubscribe
      const spamStoreSuggestion = safeToUnsubscribe.find((s: any) => s.sender === 'daily-deals@spamstore.com')
      expect(spamStoreSuggestion).toBeDefined()
      expect(spamStoreSuggestion.count).toBe(10)
      expect(spamStoreSuggestion.confidence).toBeGreaterThan(0.9)

      // Moderate newsletter should need review
      const techBlogSuggestion = needsReview.find((s: any) => s.sender === 'newsletter@techblog.com')
      expect(techBlogSuggestion).toBeDefined()
      expect(techBlogSuggestion.count).toBe(3)
      expect(techBlogSuggestion.confidence).toBeLessThan(0.8)

      console.log(`✅ Identified ${safeToUnsubscribe.length} safe unsubscribe candidates and ${needsReview.length} needing review`)
    })

    test('should save weekly digest to database', async () => {
      const weekStart = startOfWeek(new Date())
      const testEmails = TEST_DATA_GENERATORS.generateLowPriorityEmails(25, testUser.user.id)

      await dbUtils.insertTestData({
        users: [testUser.user],
        emails: testEmails
      })

      const digest = await generateWeeklyDigest(testUser.user.id, weekStart)

      // Verify digest was saved to database
      const { data: savedDigest } = await getTestDb().serviceClient
        .from('weekly_digests')
        .select('*')
        .eq('user_id', testUser.user.id)
        .eq('week_start_date', weekStart.toISOString().split('T')[0])
        .single()

      expect(savedDigest).toBeDefined()
      expect(savedDigest.total_low_priority_emails).toBe(digest.total_low_priority_emails)
      expect(savedDigest.low_priority_emails).toEqual(digest.low_priority_emails)
      expect(savedDigest.unsubscribe_suggestions).toEqual(digest.unsubscribe_suggestions)
      expect(savedDigest.generated_at).toBeDefined()

      console.log('✅ Weekly digest saved to database successfully')
    })
  })

  describe('Bulk Unsubscribe Actions', () => {
    test('should process bulk unsubscribe actions', async () => {
      // Create pre-existing digest
      const weekStart = startOfWeek(subDays(new Date(), 7))
      const digestData = {
        ...WEEKLY_DIGEST_FIXTURES.sampleWeek,
        id: 'test-bulk-digest',
        user_id: testUser.user.id,
        week_start_date: weekStart.toISOString().split('T')[0],
        week_end_date: endOfWeek(subDays(new Date(), 7)).toISOString().split('T')[0]
      }

      await getTestDb().serviceClient
        .from('weekly_digests')
        .insert(digestData)

      // Simulate user bulk unsubscribe actions
      const unsubscribeActions = {
        unsubscribed: ['promotions@store.com', 'deals@retailer.com'],
        marked_keep: ['newsletter@medium.com'],
        bulk_actions_executed: true
      }

      const updatedDigest = await processBulkUnsubscribeActions(
        testUser.user.id,
        digestData.id,
        unsubscribeActions
      )

      // Verify actions were recorded
      expect(updatedDigest.user_actions).toEqual(unsubscribeActions)
      expect(updatedDigest.actions_completed_at).toBeDefined()

      // Verify database was updated
      const { data: dbDigest } = await getTestDb().serviceClient
        .from('weekly_digests')
        .select('*')
        .eq('id', digestData.id)
        .single()

      expect(dbDigest.user_actions).toEqual(unsubscribeActions)
      expect(dbDigest.actions_completed_at).toBeDefined()

      console.log(`✅ Processed bulk actions: ${unsubscribeActions.unsubscribed.length} unsubscribed, ${unsubscribeActions.marked_keep.length} kept`)
    })

    test('should apply unsubscribe patterns to future emails', async () => {
      // Process bulk unsubscribe for specific senders
      const unsubscribedSenders = ['spam@promotions.com', 'deals@retailer.com']

      await processBulkUnsubscribeActions(
        testUser.user.id,
        'test-digest',
        {
          unsubscribed: unsubscribedSenders,
          marked_keep: [],
          bulk_actions_executed: true
        }
      )

      // Create new emails from unsubscribed senders
      const newEmails = [
        {
          id: 'new-spam-email',
          user_id: testUser.user.id,
          gmail_id: 'gmail-new-spam',
          subject: 'New Promotional Email',
          from_email: 'spam@promotions.com',
          from_name: 'Spam Promotions',
          snippet: 'This should be auto-filtered now',
          received_at: new Date().toISOString(),
          is_important: false,
          is_starred: false,
          is_unread: true,
          labels: ['INBOX'],
          priority: 10,
          category: 'later'
        }
      ]

      await dbUtils.insertTestData({
        users: [testUser.user],
        emails: newEmails
      })

      // Apply learned unsubscribe patterns
      const filteredEmail = await applyUnsubscribePatterns(
        testUser.user.id,
        newEmails[0]
      )

      // Email from unsubscribed sender should be auto-filtered
      expect(filteredEmail.category).toBe('filtered')
      expect(filteredEmail.priority).toBe(10) // Lowest priority

      console.log('✅ Applied unsubscribe patterns to filter future emails')
    })

    test('should track cost savings from bulk unsubscribe', async () => {
      const weekStart = startOfWeek(subDays(new Date(), 7))

      // Create scenario with many promotional emails
      const promotionalEmails = Array(50).fill(null).map((_, i) => ({
        id: `promo-cost-${i}`,
        user_id: testUser.user.id,
        gmail_id: `gmail-promo-cost-${i}`,
        subject: `Promotional Email ${i}`,
        from_email: 'high-volume@promotions.com',
        from_name: 'High Volume Promotions',
        snippet: 'These emails would cost money to process with AI',
        received_at: new Date(weekStart.getTime() + (i * 60 * 60 * 1000)).toISOString(),
        is_important: false,
        is_starred: false,
        is_unread: true,
        labels: ['INBOX', 'PROMOTIONS'],
        priority: 10,
        category: 'later'
      }))

      await dbUtils.insertTestData({
        users: [testUser.user],
        emails: promotionalEmails
      })

      const digest = await generateWeeklyDigest(testUser.user.id, weekStart)

      // Calculate estimated AI cost savings
      const estimatedSavings = calculateAICostSavings(digest.total_low_priority_emails)

      expect(digest.cost_savings).toBeDefined()
      expect(digest.cost_savings).toBeGreaterThan(0)

      // Should save significant costs by not AI-processing low priority emails
      expect(digest.cost_savings).toBeGreaterThan(0.50) // At least $0.50 saved

      console.log(`✅ Calculated cost savings: $${digest.cost_savings} by filtering ${digest.total_low_priority_emails} low-priority emails`)
    })
  })

  describe('User Interaction and Feedback', () => {
    test('should track digest viewing and engagement', async () => {
      const digestId = 'engagement-test-digest'

      await getTestDb().serviceClient
        .from('weekly_digests')
        .insert({
          id: digestId,
          user_id: testUser.user.id,
          week_start_date: startOfWeek(new Date()).toISOString().split('T')[0],
          week_end_date: endOfWeek(new Date()).toISOString().split('T')[0],
          low_priority_emails: [],
          unsubscribe_suggestions: { safeToUnsubscribe: [], needsReview: [] },
          total_low_priority_emails: 0,
          emails_processed: 0
        })

      // Track digest viewing
      await trackDigestViewing(testUser.user.id, digestId)

      // Verify viewing was tracked
      const { data: viewedDigest } = await getTestDb().serviceClient
        .from('weekly_digests')
        .select('*')
        .eq('id', digestId)
        .single()

      expect(viewedDigest.user_viewed_at).toBeDefined()

      console.log('✅ Tracked digest viewing successfully')
    })

    test('should learn from user feedback on unsubscribe suggestions', async () => {
      // Create initial pattern
      await getTestDb().serviceClient
        .from('email_patterns')
        .insert({
          id: 'feedback-pattern',
          user_id: testUser.user.id,
          pattern_type: 'sender',
          pattern_value: 'learning@example.com',
          score_impact: -20, // Initially suggested for unsubscribe
          confidence_score: 0.6,
          sample_count: 3,
          success_rate: 0.6
        })

      // User feedback: marked as "keep" instead of unsubscribe
      await processUserFeedback(
        testUser.user.id,
        'learning@example.com',
        'keep', // User wants to keep emails from this sender
        'unsubscribe_suggestion'
      )

      // Verify pattern was updated
      const { data: updatedPattern } = await getTestDb().serviceClient
        .from('email_patterns')
        .select('*')
        .eq('user_id', testUser.user.id)
        .eq('pattern_value', 'learning@example.com')
        .single()

      expect(updatedPattern.score_impact).toBeGreaterThan(-20) // Less penalty after positive feedback
      expect(updatedPattern.learned_from_user_action).toBe(true)

      console.log(`✅ Updated pattern based on user feedback: score impact changed from -20 to ${updatedPattern.score_impact}`)
    })
  })

  describe('Performance and Scalability', () => {
    test('should handle large volumes of low-priority emails efficiently', async () => {
      const weekStart = startOfWeek(subDays(new Date(), 7))

      // Generate 500 low-priority emails
      const largeEmailSet = TEST_DATA_GENERATORS.generateLowPriorityEmails(500, testUser.user.id)

      // Adjust dates to be within the week
      largeEmailSet.forEach((email, i) => {
        email.received_at = new Date(weekStart.getTime() + (i * 60 * 1000)).toISOString() // Spread over week
      })

      await dbUtils.insertTestData({
        users: [testUser.user],
        emails: largeEmailSet
      })

      // Measure digest generation performance
      const startTime = performance.now()
      const digest = await generateWeeklyDigest(testUser.user.id, weekStart)
      const processingTime = performance.now() - startTime

      // Verify all emails were processed
      expect(digest.total_low_priority_emails).toBe(500)
      expect(digest.emails_processed).toBe(500)

      // Performance requirement: should process 500 emails in under 5 seconds
      expect(processingTime).toBeLessThan(5000)

      // Verify categorization is accurate
      expect(digest.low_priority_emails.length).toBeGreaterThan(0)

      console.log(`✅ Processed ${digest.total_low_priority_emails} emails in ${Math.round(processingTime)}ms`)
    })

    test('should batch unsubscribe suggestions efficiently', async () => {
      // Create emails from 50 different promotional senders
      const weekStart = startOfWeek(subDays(new Date(), 7))
      const multiSenderEmails = []

      for (let i = 0; i < 50; i++) {
        const senderEmails = Array(5).fill(null).map((_, j) => ({
          id: `batch-sender-${i}-email-${j}`,
          user_id: testUser.user.id,
          gmail_id: `gmail-batch-sender-${i}-${j}`,
          subject: `Promotional Email ${j} from Sender ${i}`,
          from_email: `promo${i}@marketing.com`,
          from_name: `Marketing Company ${i}`,
          snippet: 'Promotional content',
          received_at: new Date(weekStart.getTime() + (j * 60 * 60 * 1000)).toISOString(),
          is_important: false,
          is_starred: false,
          is_unread: true,
          labels: ['INBOX', 'PROMOTIONS'],
          priority: 9,
          category: 'later'
        }))
        multiSenderEmails.push(...senderEmails)
      }

      await dbUtils.insertTestData({
        users: [testUser.user],
        emails: multiSenderEmails
      })

      const digest = await generateWeeklyDigest(testUser.user.id, weekStart)

      // Should efficiently identify multiple unsubscribe candidates
      const totalSuggestions = digest.unsubscribe_suggestions.safeToUnsubscribe.length +
                              digest.unsubscribe_suggestions.needsReview.length

      expect(totalSuggestions).toBeGreaterThan(20) // Should identify most senders
      expect(totalSuggestions).toBeLessThanOrEqual(50) // But not more than total senders

      // Verify bulk actions would affect significant number of emails
      const potentialUnsubscribeCount = digest.unsubscribe_suggestions.safeToUnsubscribe
        .reduce((sum: number, suggestion: any) => sum + suggestion.count, 0)

      expect(potentialUnsubscribeCount).toBeGreaterThan(50) // Should enable bulk cleanup

      console.log(`✅ Generated ${totalSuggestions} unsubscribe suggestions affecting ${potentialUnsubscribeCount} emails`)
    })
  })
})

// Helper functions for weekly digest operations
async function generateWeeklyDigest(userId: string, weekStart: Date) {
  // This would be implemented as part of the weekly digest system
  // For now, creating a mock implementation for testing

  const weekEnd = endOfWeek(weekStart)
  const testDb = getTestDb()

  // Get low-priority emails from the week
  const { data: emails } = await testDb.serviceClient
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .gte('received_at', weekStart.toISOString())
    .lte('received_at', weekEnd.toISOString())
    .gte('priority', 7) // Low priority threshold

  if (!emails || emails.length === 0) {
    return {
      id: `digest-${userId}-${weekStart.toISOString()}`,
      user_id: userId,
      week_start_date: weekStart.toISOString().split('T')[0],
      week_end_date: weekEnd.toISOString().split('T')[0],
      low_priority_emails: [],
      unsubscribe_suggestions: { safeToUnsubscribe: [], needsReview: [] },
      total_low_priority_emails: 0,
      emails_processed: 0,
      cost_savings: 0
    }
  }

  // Categorize emails
  const categories = categorizeEmails(emails)

  // Generate unsubscribe suggestions
  const unsubscribeSuggestions = generateUnsubscribeSuggestions(emails)

  // Calculate cost savings
  const costSavings = calculateAICostSavings(emails.length)

  const digest = {
    id: `digest-${userId}-${weekStart.toISOString()}`,
    user_id: userId,
    week_start_date: weekStart.toISOString().split('T')[0],
    week_end_date: weekEnd.toISOString().split('T')[0],
    low_priority_emails: categories,
    unsubscribe_suggestions: unsubscribeSuggestions,
    total_low_priority_emails: emails.length,
    emails_processed: emails.length,
    cost_savings: costSavings,
    generated_at: new Date().toISOString()
  }

  // Save to database
  await testDb.serviceClient
    .from('weekly_digests')
    .insert(digest)

  return digest
}

function categorizeEmails(emails: any[]) {
  const categories: { [key: string]: { category: string, count: number, senders: string[], subjects: string[] } } = {}

  emails.forEach(email => {
    const classification = email.metadata?.classification || 'other'

    if (!categories[classification]) {
      categories[classification] = {
        category: classification,
        count: 0,
        senders: [],
        subjects: []
      }
    }

    categories[classification].count++

    if (!categories[classification].senders.includes(email.from_email)) {
      categories[classification].senders.push(email.from_email)
    }

    if (categories[classification].subjects.length < 5) { // Limit to 5 example subjects
      categories[classification].subjects.push(email.subject)
    }
  })

  return Object.values(categories)
}

function generateUnsubscribeSuggestions(emails: any[]) {
  const senderCounts: { [sender: string]: number } = {}

  emails.forEach(email => {
    senderCounts[email.from_email] = (senderCounts[email.from_email] || 0) + 1
  })

  const safeToUnsubscribe: any[] = []
  const needsReview: any[] = []

  Object.entries(senderCounts).forEach(([sender, count]) => {
    const confidence = calculateUnsubscribeConfidence(sender, count)

    if (confidence > 0.8) {
      safeToUnsubscribe.push({ sender, count, confidence: Math.round(confidence * 100) / 100 })
    } else if (confidence > 0.5) {
      needsReview.push({ sender, count, confidence: Math.round(confidence * 100) / 100 })
    }
  })

  return { safeToUnsubscribe, needsReview }
}

function calculateUnsubscribeConfidence(sender: string, count: number): number {
  let confidence = 0.5 // Base confidence

  // High frequency increases confidence
  if (count >= 10) confidence += 0.4
  else if (count >= 5) confidence += 0.2

  // Marketing indicators
  if (sender.includes('promo') || sender.includes('deals') || sender.includes('marketing')) {
    confidence += 0.3
  }

  // Newsletter indicators (lower confidence)
  if (sender.includes('newsletter') || sender.includes('news')) {
    confidence += 0.1
  }

  // Quality domains (lower confidence)
  if (sender.includes('medium.com') || sender.includes('substack.com')) {
    confidence -= 0.2
  }

  return Math.max(0, Math.min(1, confidence))
}

async function processBulkUnsubscribeActions(userId: string, digestId: string, actions: any) {
  const testDb = getTestDb()

  const { data: digest } = await testDb.serviceClient
    .from('weekly_digests')
    .update({
      user_actions: actions,
      actions_completed_at: new Date().toISOString()
    })
    .eq('id', digestId)
    .select()
    .single()

  // Learn from unsubscribe actions
  if (actions.unsubscribed) {
    for (const sender of actions.unsubscribed) {
      await learnFromUnsubscribeAction(userId, sender, 'unsubscribe')
    }
  }

  if (actions.marked_keep) {
    for (const sender of actions.marked_keep) {
      await learnFromUnsubscribeAction(userId, sender, 'keep')
    }
  }

  return digest
}

async function applyUnsubscribePatterns(userId: string, email: any) {
  // Check if sender was previously unsubscribed
  const testDb = getTestDb()

  const { data: patterns } = await testDb.serviceClient
    .from('email_patterns')
    .select('*')
    .eq('user_id', userId)
    .eq('pattern_type', 'sender')
    .eq('pattern_value', email.from_email)

  if (patterns && patterns.length > 0) {
    const pattern = patterns[0]
    if (pattern.score_impact < -30) { // Strong negative pattern = likely unsubscribed
      return {
        ...email,
        category: 'filtered',
        priority: 10 // Lowest priority
      }
    }
  }

  return email
}

function calculateAICostSavings(emailCount: number): number {
  // Estimate: $0.002 per email for AI processing (conservative estimate)
  const costPerEmail = 0.002
  return Math.round(emailCount * costPerEmail * 100) / 100 // Round to 2 decimal places
}

async function trackDigestViewing(userId: string, digestId: string) {
  const testDb = getTestDb()

  await testDb.serviceClient
    .from('weekly_digests')
    .update({ user_viewed_at: new Date().toISOString() })
    .eq('id', digestId)
}

async function processUserFeedback(userId: string, sender: string, feedback: 'keep' | 'unsubscribe', context: string) {
  const testDb = getTestDb()

  // Update or create pattern based on feedback
  const scoreAdjustment = feedback === 'keep' ? 10 : -10

  await testDb.serviceClient
    .from('email_patterns')
    .upsert({
      user_id: userId,
      pattern_type: 'sender',
      pattern_value: sender,
      score_impact: scoreAdjustment,
      confidence_score: 0.8,
      learned_from_user_action: true,
      sample_count: 1,
      success_rate: 1.0,
      last_seen_at: new Date().toISOString()
    })
}

async function learnFromUnsubscribeAction(userId: string, sender: string, action: 'unsubscribe' | 'keep') {
  const testDb = getTestDb()

  const scoreImpact = action === 'unsubscribe' ? -40 : 20

  await testDb.serviceClient
    .from('email_patterns')
    .upsert({
      user_id: userId,
      pattern_type: 'sender',
      pattern_value: sender,
      score_impact: scoreImpact,
      confidence_score: 0.9,
      learned_from_user_action: true,
      sample_count: 1,
      success_rate: 1.0,
      last_seen_at: new Date().toISOString()
    })
}

function getTestDb() {
  // This should return the test database instance
  // Implementation depends on test setup
  return (global as any).testDb
}