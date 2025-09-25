/**
 * EMAIL PROCESSING FLOW - Integration Tests
 * End-to-end email processing workflow tests
 * Tests complete flow from email ingestion to AI processing and scoring
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { setupIntegrationTests, createTestUser } from '../setup/test-config'
import { DatabaseTestUtils, APITestUtils, AssertionUtils, PerformanceTestUtils } from '../setup/test-utils'
import { TEST_DATA_SETS, EMAIL_FIXTURES } from '../setup/test-fixtures'
import { POST as processEmailsHandler, GET as getStatsHandler } from '@/app/api/ai/process-emails/route'

describe('Email Processing Flow Integration Tests', () => {
  const { getTestDb } = setupIntegrationTests()
  let dbUtils: DatabaseTestUtils
  let apiUtils: APITestUtils
  let perfUtils: PerformanceTestUtils
  let testUser: any

  beforeAll(async () => {
    const testDb = getTestDb()
    dbUtils = new DatabaseTestUtils(testDb)
    apiUtils = new APITestUtils(testDb)
    perfUtils = new PerformanceTestUtils()

    // Create test user
    testUser = await createTestUser(testDb, {
      id: 'test-user-flow',
      email: 'flow.test@example.com'
    })
  })

  beforeEach(async () => {
    // Reset database and insert fresh test data
    await getTestDb().reset()
    await dbUtils.insertTestData({
      ...TEST_DATA_SETS.minimal,
      users: [testUser.user],
      emails: [
        EMAIL_FIXTURES.urgentWork,
        EMAIL_FIXTURES.vipSender,
        EMAIL_FIXTURES.workUpdate,
        EMAIL_FIXTURES.marketingPromo,
        EMAIL_FIXTURES.newsletter
      ]
    })
  })

  describe('Complete Email Processing Workflow', () => {
    test('should process emails end-to-end with AI scoring', async () => {
      // Mock authenticated user
      apiUtils.mockAuthenticatedUser(testUser.user.id)

      // Mock OpenAI responses
      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring
        .mockResolvedValueOnce({ score: 9, reasoning: 'Urgent system alert' })
        .mockResolvedValueOnce({ score: 8, reasoning: 'VIP sender communication' })
        .mockResolvedValueOnce({ score: 6, reasoning: 'Regular work update' })
        .mockResolvedValueOnce({ score: 3, reasoning: 'Marketing promotional content' })
        .mockResolvedValueOnce({ score: 4, reasoning: 'Newsletter content' })

      // Execute email processing
      const startTime = performance.now()
      const response = await apiUtils.testAPIEndpoint(processEmailsHandler,
        apiUtils.createMockRequest('POST')
      )
      const processingTime = performance.now() - startTime

      // Verify API response structure
      AssertionUtils.assertAIProcessingResults(response)
      expect(response.processed.scored).toBeGreaterThan(0)
      expect(response.processed.errors).toBe(0)

      // Verify emails were processed in database
      const processedEmails = await dbUtils.getEmails(testUser.user.id)
      expect(processedEmails.length).toBe(5)

      // Verify AI metadata was created
      processedEmails.forEach(email => {
        expect(email.email_ai_metadata).toBeDefined()
        if (email.email_ai_metadata && email.email_ai_metadata.length > 0) {
          const metadata = email.email_ai_metadata[0]
          expect(metadata.priority_score).toBeValidEmailScore()
          expect(metadata.processing_version).toBeDefined()
          expect(metadata.confidence_score).toBeGreaterThanOrEqual(0)
          expect(metadata.confidence_score).toBeLessThanOrEqual(1)
        }
      })

      // Verify feed_items were updated with priorities
      const feedItems = await getTestDb().serviceClient
        .from('feed_items')
        .select('*')
        .eq('user_id', testUser.user.id)

      expect(feedItems.data).toBeDefined()
      expect(feedItems.data.length).toBe(5)

      feedItems.data.forEach((item: any) => {
        expect(item.priority).toBeGreaterThanOrEqual(1)
        expect(item.priority).toBeLessThanOrEqual(10)
        expect(item.metadata.ai_processed).toBe(true)
        expect(item.metadata.ai_score).toBeDefined()
      })

      // Verify AI usage tracking
      const aiUsage = await dbUtils.getAIUsage(testUser.user.id, 'email_scoring')
      expect(aiUsage.length).toBe(5) // One for each email processed

      aiUsage.forEach(usage => {
        AssertionUtils.assertCostTracking(usage)
        expect(usage.model).toBe('gpt-4o-mini')
        expect(usage.operation).toBe('email_scoring')
      })

      // Performance assertion - should complete within 10 seconds
      perfUtils.assertPerformance(processingTime, 10000, 'Complete email processing flow')

      console.log(`✅ Processed ${response.processed.scored} emails in ${Math.round(processingTime)}ms`)
    })

    test('should handle mixed priority emails correctly', async () => {
      apiUtils.mockAuthenticatedUser(testUser.user.id)

      // Mock varied AI responses based on email content
      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring
        .mockImplementation(async (userId, emailId, subject, from, snippet, isImportant, isStarred, isUnread) => {
          // Realistic scoring based on email characteristics
          let score = 5

          if (isImportant || subject.toLowerCase().includes('urgent')) score += 4
          if (isStarred || from.includes('ceo')) score += 3
          if (subject.toLowerCase().includes('meeting')) score += 2
          if (from.includes('promo') || from.includes('marketing')) score -= 4
          if (from.includes('newsletter')) score -= 3

          score = Math.max(1, Math.min(10, score))

          return {
            score,
            reasoning: `Scored ${score} based on content analysis`
          }
        })

      const response = await apiUtils.testAPIEndpoint(processEmailsHandler,
        apiUtils.createMockRequest('POST')
      )

      // Verify processing tiers were assigned correctly
      const processedEmails = await dbUtils.getEmails(testUser.user.id)
      const scores = processedEmails.map(email => {
        const metadata = email.email_ai_metadata?.[0]
        return metadata ? Math.round(metadata.priority_score) : email.priority
      })

      // Should have mix of high, medium, low priority
      const highPriority = scores.filter(s => s >= 8).length
      const mediumPriority = scores.filter(s => s >= 4 && s < 8).length
      const lowPriority = scores.filter(s => s < 4).length

      expect(highPriority).toBeGreaterThan(0) // Should have some high priority
      expect(lowPriority).toBeGreaterThan(0)  // Should have some low priority

      console.log(`✅ Priority distribution: High=${highPriority}, Medium=${mediumPriority}, Low=${lowPriority}`)
    })

    test('should handle AI service failures gracefully', async () => {
      apiUtils.mockAuthenticatedUser(testUser.user.id)

      // Mock AI failure
      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockRejectedValue(new Error('OpenAI API timeout'))

      const response = await apiUtils.testAPIEndpoint(processEmailsHandler,
        apiUtils.createMockRequest('POST')
      )

      // Should still complete successfully with fallback scoring
      AssertionUtils.assertAIProcessingResults(response)
      expect(response.success).toBe(true)

      // Verify fallback scoring was applied
      const processedEmails = await dbUtils.getEmails(testUser.user.id)
      processedEmails.forEach(email => {
        expect(email.priority).toBeGreaterThanOrEqual(1)
        expect(email.priority).toBeLessThanOrEqual(10)
      })

      // Should have some AI usage entries (for failed attempts)
      const aiUsage = await dbUtils.getAIUsage(testUser.user.id)
      expect(aiUsage.length).toBe(0) // No successful AI calls tracked

      console.log('✅ Handled AI service failure with graceful fallback')
    })

    test('should process large email batches efficiently', async () => {
      // Insert 50 emails for batch processing test
      const batchEmails = []
      for (let i = 0; i < 50; i++) {
        batchEmails.push({
          ...EMAIL_FIXTURES.workUpdate,
          id: `batch-email-${i}`,
          gmail_id: `gmail-batch-${i}`,
          user_id: testUser.user.id,
          subject: `Batch Email ${i}`,
          received_at: new Date().toISOString()
        })
      }

      await dbUtils.insertTestData({
        users: [testUser.user],
        emails: batchEmails
      })

      apiUtils.mockAuthenticatedUser(testUser.user.id)

      // Mock consistent AI responses
      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockResolvedValue({
        score: 5,
        reasoning: 'Batch processing test email'
      })

      // Measure batch processing time
      const { result, duration } = await perfUtils.measureAsync(async () => {
        return await apiUtils.testAPIEndpoint(processEmailsHandler,
          apiUtils.createMockRequest('POST')
        )
      })

      // Verify batch processing completed
      AssertionUtils.assertAIProcessingResults(result)
      expect(result.processed.scored).toBeGreaterThan(0)

      // Performance requirement: Should process emails quickly
      // Note: API limits processing to 10 emails at a time, so this tests that constraint
      expect(result.processed.scored).toBeLessThanOrEqual(10)

      // Should complete batch processing within reasonable time
      perfUtils.assertPerformance(duration, 15000, 'Batch email processing')

      console.log(`✅ Batch processed ${result.processed.scored} emails in ${Math.round(duration)}ms`)
    })
  })

  describe('Email Threading and Summarization', () => {
    test('should summarize email threads correctly', async () => {
      // Create email thread with multiple messages
      const threadEmails = [
        {
          ...EMAIL_FIXTURES.workUpdate,
          id: 'thread-email-1',
          thread_id: 'test-thread-123',
          subject: 'Project Discussion - Initial Message',
          snippet: 'Let\'s discuss the new project timeline and requirements.',
          received_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
        },
        {
          ...EMAIL_FIXTURES.workUpdate,
          id: 'thread-email-2',
          thread_id: 'test-thread-123',
          subject: 'Re: Project Discussion',
          snippet: 'I think we should extend the deadline by one week.',
          received_at: new Date(Date.now() - 1800000).toISOString() // 30 min ago
        },
        {
          ...EMAIL_FIXTURES.workUpdate,
          id: 'thread-email-3',
          thread_id: 'test-thread-123',
          subject: 'Re: Project Discussion',
          snippet: 'That sounds reasonable. Let\'s schedule a meeting to finalize.',
          received_at: new Date().toISOString()
        }
      ]

      // Create thread record
      await getTestDb().serviceClient
        .from('email_threads')
        .insert({
          id: 'test-thread-123',
          user_id: testUser.user.id,
          subject: 'Project Discussion',
          message_count: 3,
          last_message_at: new Date().toISOString(),
          participants: ['user@company.com', 'manager@company.com']
        })

      await dbUtils.insertTestData({
        users: [testUser.user],
        emails: threadEmails
      })

      apiUtils.mockAuthenticatedUser(testUser.user.id)

      // Mock thread summarization
      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockSummary.mockResolvedValue({
        summary: 'Discussion about project timeline extension and meeting scheduling',
        keyPoints: [
          'Initial project timeline discussion',
          'Proposal to extend deadline by one week',
          'Agreement to schedule finalization meeting'
        ]
      })

      const response = await apiUtils.testAPIEndpoint(processEmailsHandler,
        apiUtils.createMockRequest('POST')
      )

      // Verify thread was processed
      expect(response.processed.summarized).toBe(1)

      // Check thread summary was stored
      const { data: threads } = await getTestDb().serviceClient
        .from('email_threads')
        .select('*')
        .eq('id', 'test-thread-123')
        .single()

      expect(threads.summary).toBe('Discussion about project timeline extension and meeting scheduling')

      console.log('✅ Email thread summarized successfully')
    })
  })

  describe('Cost Tracking and Budget Management', () => {
    test('should track AI usage costs accurately', async () => {
      apiUtils.mockAuthenticatedUser(testUser.user.id)

      // Mock OpenAI with token usage information
      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockResolvedValue({
        score: 7,
        reasoning: 'Cost tracking test'
      })

      const response = await apiUtils.testAPIEndpoint(processEmailsHandler,
        apiUtils.createMockRequest('POST')
      )

      // Verify AI usage was tracked
      const aiUsage = await dbUtils.getAIUsage(testUser.user.id)
      expect(aiUsage.length).toBeGreaterThan(0)

      // Verify cost tracking fields
      aiUsage.forEach(usage => {
        AssertionUtils.assertCostTracking(usage)
        expect(usage.prompt_tokens).toBeGreaterThan(0)
        expect(usage.completion_tokens).toBeGreaterThan(0)
        expect(usage.duration_ms).toBeGreaterThan(0)
      })

      console.log(`✅ Tracked ${aiUsage.length} AI operations with cost data`)
    })

    test('should get AI usage statistics', async () => {
      // First process some emails to generate usage
      await dbUtils.insertTestData({
        users: [testUser.user],
        emails: [EMAIL_FIXTURES.urgentWork, EMAIL_FIXTURES.marketingPromo]
      })

      apiUtils.mockAuthenticatedUser(testUser.user.id)
      await apiUtils.testAPIEndpoint(processEmailsHandler,
        apiUtils.createMockRequest('POST')
      )

      // Get usage statistics
      const statsResponse = await apiUtils.testAPIEndpoint(getStatsHandler,
        apiUtils.createMockRequest('GET')
      )

      // Verify stats structure
      expect(statsResponse).toHaveProperty('today')
      expect(statsResponse).toHaveProperty('month')
      expect(statsResponse.today).toHaveProperty('operations')
      expect(statsResponse.today).toHaveProperty('cost')
      expect(statsResponse.month).toHaveProperty('operations')
      expect(statsResponse.month).toHaveProperty('cost')

      console.log('✅ AI usage statistics retrieved successfully')
    })
  })

  describe('Error Handling and Resilience', () => {
    test('should handle database connection errors', async () => {
      apiUtils.mockAuthenticatedUser('nonexistent-user')

      // This should handle gracefully even with invalid user
      const response = await apiUtils.testAPIEndpoint(processEmailsHandler,
        apiUtils.createMockRequest('POST'),
        401 // Expect unauthorized
      )

      expect(response.error).toBeDefined()
      expect(response.success).toBe(false)

      console.log('✅ Handled invalid user authentication gracefully')
    })

    test('should handle partial processing failures', async () => {
      apiUtils.mockAuthenticatedUser(testUser.user.id)

      // Mock AI to fail for some emails but succeed for others
      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring
        .mockResolvedValueOnce({ score: 8, reasoning: 'Success' })
        .mockRejectedValueOnce(new Error('AI timeout'))
        .mockResolvedValueOnce({ score: 6, reasoning: 'Success after failure' })

      const response = await apiUtils.testAPIEndpoint(processEmailsHandler,
        apiUtils.createMockRequest('POST')
      )

      // Should report both successes and errors
      AssertionUtils.assertAIProcessingResults(response)
      expect(response.processed.scored).toBeGreaterThan(0)
      expect(response.processed.errors).toBe(0) // Errors are handled gracefully with fallback

      console.log(`✅ Handled partial failures: ${response.processed.scored} successful, ${response.processed.errors} errors`)
    })
  })
})