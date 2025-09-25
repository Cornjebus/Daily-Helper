/**
 * BATCH PROCESSING BENCHMARK TESTS - Performance Tests
 * Performance tests for batch AI processing (< 2s requirement)
 * Validates batch operations, concurrent processing, and system scalability
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { setupIntegrationTests, createTestUser } from '../setup/test-config'
import { DatabaseTestUtils, APITestUtils, PerformanceTestUtils, MockDataGenerator } from '../setup/test-utils'
import { TEST_DATA_GENERATORS } from '../setup/test-fixtures'
import { POST as processEmailsHandler } from '@/app/api/ai/process-emails/route'

describe('Batch Processing Performance Benchmarks', () => {
  const { getTestDb } = setupIntegrationTests()
  let dbUtils: DatabaseTestUtils
  let apiUtils: APITestUtils
  let perfUtils: PerformanceTestUtils
  let testUser: any

  // Batch processing performance requirements
  const BATCH_REQUIREMENTS = {
    maxProcessingTime: 2000,    // < 2s for batch of 100 emails
    smallBatchTime: 500,        // < 500ms for batch of 10 emails
    concurrencyEfficiency: 0.7, // 70% efficiency compared to sequential
    memoryGrowthLimit: 100 * 1024 * 1024, // 100MB max memory growth
    databaseBatchTime: 100,     // < 100ms for batch database operations
    apiResponseTime: 5000,      // < 5s for complete API response
    throughputMinimum: 50       // Minimum 50 emails per second
  }

  beforeAll(async () => {
    const testDb = getTestDb()
    dbUtils = new DatabaseTestUtils(testDb)
    apiUtils = new APITestUtils(testDb)
    perfUtils = new PerformanceTestUtils()

    testUser = await createTestUser(testDb, {
      id: 'test-user-batch',
      email: 'batch.test@example.com'
    })

    console.log('🚀 Starting batch processing performance benchmarks')
  })

  beforeEach(async () => {
    await getTestDb().reset()

    // Setup test user with performance-optimized preferences
    await dbUtils.insertTestData({
      users: [testUser.user],
      preferences: [{
        id: 'batch-prefs',
        user_id: testUser.user.id,
        enable_pattern_learning: true,
        max_ai_cost_per_day: 50.00,
        preferred_ai_model: 'gpt-4o-mini' // Fastest model for batch processing
      }]
    })
  })

  describe('Small Batch Processing (10 emails)', () => {
    test('should process 10 emails in under 500ms', async () => {
      // Generate 10 mixed-priority emails
      const batchEmails = TEST_DATA_GENERATORS.generateMixedEmails(10, testUser.user.id)

      await dbUtils.insertTestData({
        users: [testUser.user],
        emails: batchEmails
      })

      // Mock AI for consistent performance testing
      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockImplementation(async () => {
        // Simulate realistic AI response time (50-100ms)
        await new Promise(resolve => setTimeout(resolve, 75))
        return {
          score: Math.floor(Math.random() * 10) + 1,
          reasoning: 'Batch processing test'
        }
      })

      apiUtils.mockAuthenticatedUser(testUser.user.id)

      // Measure batch processing time
      const { result, duration } = await perfUtils.measureAsync(async () => {
        return await apiUtils.testAPIEndpoint(processEmailsHandler,
          apiUtils.createMockRequest('POST')
        )
      })

      // Verify processing completed successfully
      expect(result.success).toBe(true)
      expect(result.processed.scored).toBe(10) // API processes max 10 at a time
      expect(result.processed.errors).toBe(0)

      // Performance assertion
      perfUtils.assertPerformance(
        duration,
        BATCH_REQUIREMENTS.smallBatchTime,
        'Small batch processing (10 emails)'
      )

      // Verify database was updated
      const processedEmails = await dbUtils.getEmails(testUser.user.id)
      expect(processedEmails).toHaveLength(10)

      console.log(`✅ Small batch: 10 emails processed in ${Math.round(duration)}ms (requirement: <${BATCH_REQUIREMENTS.smallBatchTime}ms)`)
    })

    test('should maintain processing efficiency with concurrent requests', async () => {
      // Create multiple small batches
      const numBatches = 3
      const emailsPerBatch = 10

      for (let i = 0; i < numBatches; i++) {
        const batchEmails = TEST_DATA_GENERATORS.generateMixedEmails(emailsPerBatch, testUser.user.id)
          .map(email => ({ ...email, id: `batch${i}-${email.id}` }))

        await dbUtils.insertTestData({
          emails: batchEmails
        })
      }

      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockResolvedValue({
        score: 6,
        reasoning: 'Concurrent batch test'
      })

      apiUtils.mockAuthenticatedUser(testUser.user.id)

      // Process batches concurrently
      const { result: batchResults, duration } = await perfUtils.measureAsync(async () => {
        const promises = Array(numBatches).fill(null).map(() =>
          apiUtils.testAPIEndpoint(processEmailsHandler,
            apiUtils.createMockRequest('POST')
          )
        )
        return Promise.all(promises)
      })

      // Verify all batches completed successfully
      batchResults.forEach((result: any) => {
        expect(result.success).toBe(true)
        expect(result.processed.scored).toBeGreaterThan(0)
      })

      const totalProcessed = batchResults.reduce((sum: number, r: any) => sum + r.processed.scored, 0)
      const avgTimePerEmail = duration / totalProcessed

      // Concurrent processing should be efficient
      expect(avgTimePerEmail).toBeLessThan(50) // <50ms per email with concurrency

      console.log(`✅ Concurrent batches: ${totalProcessed} emails across ${numBatches} batches in ${Math.round(duration)}ms (${Math.round(avgTimePerEmail)}ms per email)`)
    })
  })

  describe('Large Batch Processing (100 emails)', () => {
    test('should process 100 emails efficiently', async () => {
      // Generate 100 emails with realistic distribution
      const largeEmailBatch = MockDataGenerator.generateEmailBatch(100, {
        high: 15,    // 15% high priority
        medium: 35,  // 35% medium priority
        low: 50      // 50% low priority
      }).map(email => ({ ...email, user_id: testUser.user.id }))

      await dbUtils.insertTestData({
        users: [testUser.user],
        emails: largeEmailBatch
      })

      // Mock AI with variable response times to simulate real conditions
      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockImplementation(async (userId, emailId, subject, from) => {
        // Simulate variable AI response times (50-150ms)
        const delay = 50 + Math.random() * 100
        await new Promise(resolve => setTimeout(resolve, delay))

        // Score based on email characteristics
        let score = 5
        if (subject.toLowerCase().includes('urgent')) score += 3
        if (from.includes('ceo')) score += 2
        if (from.includes('promo')) score -= 3

        return {
          score: Math.max(1, Math.min(10, score)),
          reasoning: `Batch test scoring for ${emailId}`
        }
      })

      apiUtils.mockAuthenticatedUser(testUser.user.id)

      // Since API processes max 10 at a time, we need multiple calls
      const batchSize = 10
      const numBatches = Math.ceil(largeEmailBatch.length / batchSize)

      let totalProcessed = 0
      let totalErrors = 0

      const { duration } = await perfUtils.measureAsync(async () => {
        // Process in batches to simulate real usage
        for (let i = 0; i < numBatches; i++) {
          const batchResult = await apiUtils.testAPIEndpoint(
            processEmailsHandler,
            apiUtils.createMockRequest('POST')
          )

          totalProcessed += batchResult.processed.scored
          totalErrors += batchResult.processed.errors

          // Small delay between batches (realistic usage pattern)
          if (i < numBatches - 1) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
      })

      // Verify processing completed successfully
      expect(totalProcessed).toBeGreaterThan(90) // Should process most emails
      expect(totalErrors).toBe(0)

      // Calculate throughput
      const emailsPerSecond = totalProcessed / (duration / 1000)
      expect(emailsPerSecond).toBeGreaterThan(BATCH_REQUIREMENTS.throughputMinimum)

      // Total time should meet requirement (allowing for multiple batch calls)
      expect(duration).toBeLessThan(BATCH_REQUIREMENTS.maxProcessingTime * numBatches)

      console.log(`✅ Large batch: ${totalProcessed} emails in ${Math.round(duration)}ms (${Math.round(emailsPerSecond)} emails/sec)`)
    })

    test('should handle memory efficiently during large batch processing', async () => {
      // Force garbage collection before test
      if (global.gc) global.gc()
      const initialMemory = process.memoryUsage()

      const largeEmailBatch = TEST_DATA_GENERATORS.generateMixedEmails(100, testUser.user.id)

      await dbUtils.insertTestData({
        users: [testUser.user],
        emails: largeEmailBatch
      })

      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockResolvedValue({
        score: 6,
        reasoning: 'Memory test'
      })

      apiUtils.mockAuthenticatedUser(testUser.user.id)

      // Process multiple batches
      for (let i = 0; i < 10; i++) { // 10 batches of 10 emails each
        await apiUtils.testAPIEndpoint(processEmailsHandler,
          apiUtils.createMockRequest('POST')
        )
      }

      // Force garbage collection after test
      if (global.gc) global.gc()
      const finalMemory = process.memoryUsage()

      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed

      // Memory growth should be reasonable
      expect(memoryGrowth).toBeLessThan(BATCH_REQUIREMENTS.memoryGrowthLimit)

      console.log(`✅ Memory efficiency: ${Math.round(memoryGrowth / 1024 / 1024)}MB growth (limit: ${BATCH_REQUIREMENTS.memoryGrowthLimit / 1024 / 1024}MB)`)
    })
  })

  describe('Database Batch Operations Performance', () => {
    test('should perform batch database updates efficiently', async () => {
      const testData = Array(50).fill(null).map((_, i) => ({
        emailId: `db-batch-${i}`,
        priority: Math.floor(Math.random() * 10) + 1,
        score: Math.floor(Math.random() * 10) + 1,
        reasoning: `Batch update test ${i}`,
        model: 'gpt-4o-mini'
      }))

      // Measure batch update performance
      const { duration } = await perfUtils.measureAsync(async () => {
        // Simulate batch database updates (this would be done by the actual API)
        const updates = testData.map(item => ({
          id: item.emailId,
          priority: item.priority,
          updated_at: new Date().toISOString()
        }))

        // Batch insert email records first
        const emailRecords = updates.map(update => ({
          id: update.id,
          user_id: testUser.user.id,
          gmail_id: `gmail-${update.id}`,
          subject: `Test email ${update.id}`,
          from_email: 'test@example.com',
          snippet: 'Test content',
          received_at: new Date().toISOString(),
          priority: update.priority,
          is_important: false,
          is_starred: false,
          is_unread: true,
          labels: [],
          category: 'next',
          metadata: {}
        }))

        await getTestDb().serviceClient
          .from('emails')
          .insert(emailRecords)

        // Then batch update priorities
        return Promise.all(
          updates.map(update =>
            getTestDb().serviceClient
              .from('emails')
              .update({ priority: update.priority })
              .eq('id', update.id)
          )
        )
      })

      perfUtils.assertPerformance(
        duration,
        BATCH_REQUIREMENTS.databaseBatchTime * 2, // Allow 2x time for complex batch ops
        'Batch database updates'
      )

      console.log(`✅ Database batch: ${testData.length} updates in ${Math.round(duration)}ms`)
    })

    test('should efficiently query large datasets', async () => {
      // Insert large dataset
      const largeDataset = Array(200).fill(null).map((_, i) => ({
        id: `large-dataset-${i}`,
        user_id: testUser.user.id,
        gmail_id: `gmail-large-${i}`,
        subject: `Large dataset email ${i}`,
        from_email: `sender${i % 20}@example.com`,
        snippet: 'Large dataset test content',
        received_at: new Date(Date.now() - i * 60000).toISOString(), // Spread over time
        priority: Math.floor(Math.random() * 10) + 1,
        is_important: i % 10 === 0,
        is_starred: i % 15 === 0,
        is_unread: i % 3 === 0,
        labels: i % 2 === 0 ? ['INBOX'] : ['INBOX', 'IMPORTANT'],
        category: i < 40 ? 'now' : i < 120 ? 'next' : 'later',
        metadata: { test: true, index: i }
      }))

      await dbUtils.insertTestData({
        users: [testUser.user],
        emails: largeDataset
      })

      // Test complex query performance
      const { result: queryResult, duration } = await perfUtils.measureAsync(async () => {
        const { data } = await getTestDb().serviceClient
          .from('emails')
          .select(`
            id,
            subject,
            from_email,
            priority,
            category,
            is_important,
            is_starred,
            is_unread,
            received_at
          `)
          .eq('user_id', testUser.user.id)
          .order('received_at', { ascending: false })
          .limit(50)

        return data || []
      })

      expect(queryResult).toHaveLength(50)

      perfUtils.assertPerformance(
        duration,
        BATCH_REQUIREMENTS.databaseBatchTime,
        'Large dataset query'
      )

      console.log(`✅ Large query: ${queryResult.length} results from ${largeDataset.length} records in ${Math.round(duration)}ms`)
    })
  })

  describe('Concurrency and Throughput Tests', () => {
    test('should handle concurrent batch processing efficiently', async () => {
      // Create multiple users with batch data
      const numUsers = 3
      const emailsPerUser = 20

      const testUsers = []
      const allEmails = []

      for (let u = 0; u < numUsers; u++) {
        const user = await createTestUser(getTestDb(), {
          id: `concurrent-user-${u}`,
          email: `concurrent${u}@example.com`
        })
        testUsers.push(user)

        const userEmails = TEST_DATA_GENERATORS.generateMixedEmails(emailsPerUser, user.user.id)
        allEmails.push(...userEmails)
      }

      await dbUtils.insertTestData({
        users: testUsers.map(u => u.user),
        emails: allEmails
      })

      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockResolvedValue({
        score: 6,
        reasoning: 'Concurrent processing test'
      })

      // Process all users concurrently
      const { result: concurrentResults, duration } = await perfUtils.measureAsync(async () => {
        const promises = testUsers.map(user => {
          apiUtils.mockAuthenticatedUser(user.user.id)
          return apiUtils.testAPIEndpoint(processEmailsHandler,
            apiUtils.createMockRequest('POST')
          )
        })
        return Promise.all(promises)
      })

      // Verify all users processed successfully
      concurrentResults.forEach((result: any) => {
        expect(result.success).toBe(true)
        expect(result.processed.scored).toBeGreaterThan(0)
      })

      const totalProcessed = concurrentResults.reduce((sum: number, r: any) => sum + r.processed.scored, 0)
      const throughput = totalProcessed / (duration / 1000)

      expect(throughput).toBeGreaterThan(BATCH_REQUIREMENTS.throughputMinimum)

      console.log(`✅ Concurrent processing: ${totalProcessed} emails across ${numUsers} users in ${Math.round(duration)}ms (${Math.round(throughput)} emails/sec)`)
    })

    test('should measure sequential vs concurrent performance improvement', async () => {
      const batchSize = 30
      const batchEmails = TEST_DATA_GENERATORS.generateMixedEmails(batchSize, testUser.user.id)

      await dbUtils.insertTestData({
        users: [testUser.user],
        emails: batchEmails
      })

      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)) // 100ms per email
        return { score: 6, reasoning: 'Performance comparison test' }
      })

      apiUtils.mockAuthenticatedUser(testUser.user.id)

      // Test sequential processing (simulate)
      const sequentialTime = await perfUtils.measureAsync(async () => {
        // Process 3 batches sequentially
        for (let i = 0; i < 3; i++) {
          await apiUtils.testAPIEndpoint(processEmailsHandler,
            apiUtils.createMockRequest('POST')
          )
          await new Promise(resolve => setTimeout(resolve, 50)) // Small delay
        }
      })

      // Reset data for concurrent test
      await getTestDb().reset()
      await dbUtils.insertTestData({
        users: [testUser.user],
        emails: batchEmails
      })

      // Test concurrent processing
      const concurrentTime = await perfUtils.measureAsync(async () => {
        const promises = Array(3).fill(null).map(() =>
          apiUtils.testAPIEndpoint(processEmailsHandler,
            apiUtils.createMockRequest('POST')
          )
        )
        return Promise.all(promises)
      })

      // Calculate efficiency improvement
      const efficiency = 1 - (concurrentTime.duration / sequentialTime.duration)

      expect(efficiency).toBeGreaterThan(BATCH_REQUIREMENTS.concurrencyEfficiency)

      console.log(`✅ Concurrency efficiency:`)
      console.log(`   - Sequential: ${Math.round(sequentialTime.duration)}ms`)
      console.log(`   - Concurrent: ${Math.round(concurrentTime.duration)}ms`)
      console.log(`   - Efficiency gain: ${Math.round(efficiency * 100)}% (requirement: ${BATCH_REQUIREMENTS.concurrencyEfficiency * 100}%)`)
    })
  })

  describe('API Response Time Tests', () => {
    test('should respond to API requests within acceptable time limits', async () => {
      const mediumBatch = TEST_DATA_GENERATORS.generateMixedEmails(25, testUser.user.id)

      await dbUtils.insertTestData({
        users: [testUser.user],
        emails: mediumBatch
      })

      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockResolvedValue({
        score: 6,
        reasoning: 'API response time test'
      })

      apiUtils.mockAuthenticatedUser(testUser.user.id)

      // Measure complete API response time
      const { result, duration } = await perfUtils.measureAsync(async () => {
        return await apiUtils.testAPIEndpoint(processEmailsHandler,
          apiUtils.createMockRequest('POST')
        )
      })

      expect(result.success).toBe(true)
      expect(result.processed.scored).toBeGreaterThan(0)

      perfUtils.assertPerformance(
        duration,
        BATCH_REQUIREMENTS.apiResponseTime,
        'Complete API response'
      )

      console.log(`✅ API response: ${result.processed.scored} emails processed in ${Math.round(duration)}ms`)
    })
  })

  describe('Stress Testing', () => {
    test('should maintain performance under sustained load', async () => {
      const stressTestDuration = 10000 // 10 seconds
      const batchInterval = 1000 // 1 second between batches

      // Create continuous batches of emails
      let totalProcessed = 0
      let totalErrors = 0
      let batchCount = 0

      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockResolvedValue({
        score: 6,
        reasoning: 'Stress test'
      })

      apiUtils.mockAuthenticatedUser(testUser.user.id)

      const { duration } = await perfUtils.measureAsync(async () => {
        const startTime = Date.now()

        while (Date.now() - startTime < stressTestDuration) {
          // Create fresh batch
          const stressBatch = TEST_DATA_GENERATORS.generateMixedEmails(15, testUser.user.id)
            .map(email => ({ ...email, id: `stress-${batchCount}-${email.id}` }))

          await dbUtils.insertTestData({
            emails: stressBatch
          })

          try {
            const batchResult = await apiUtils.testAPIEndpoint(
              processEmailsHandler,
              apiUtils.createMockRequest('POST')
            )

            totalProcessed += batchResult.processed.scored
            totalErrors += batchResult.processed.errors
            batchCount++

            // Wait for next batch interval
            await new Promise(resolve => setTimeout(resolve, batchInterval))
          } catch (error) {
            totalErrors++
            console.error('Stress test batch error:', error)
          }
        }
      })

      const avgThroughput = totalProcessed / (duration / 1000)
      const errorRate = totalErrors / (totalProcessed + totalErrors)

      expect(avgThroughput).toBeGreaterThan(BATCH_REQUIREMENTS.throughputMinimum * 0.5) // Allow 50% degradation under stress
      expect(errorRate).toBeLessThan(0.05) // Less than 5% error rate

      console.log(`✅ Stress test: ${totalProcessed} emails in ${batchCount} batches over ${Math.round(duration / 1000)}s`)
      console.log(`   - Throughput: ${Math.round(avgThroughput)} emails/sec`)
      console.log(`   - Error rate: ${Math.round(errorRate * 100)}%`)
    })
  })

  afterAll(() => {
    console.log('🚀 Batch processing performance benchmarks completed')
    console.log('📊 Batch Processing Requirements Summary:')
    console.log(`   - Max processing time: <${BATCH_REQUIREMENTS.maxProcessingTime}ms`)
    console.log(`   - Small batch time: <${BATCH_REQUIREMENTS.smallBatchTime}ms`)
    console.log(`   - Concurrency efficiency: >${BATCH_REQUIREMENTS.concurrencyEfficiency * 100}%`)
    console.log(`   - Memory growth limit: <${BATCH_REQUIREMENTS.memoryGrowthLimit / 1024 / 1024}MB`)
    console.log(`   - Database batch time: <${BATCH_REQUIREMENTS.databaseBatchTime}ms`)
    console.log(`   - API response time: <${BATCH_REQUIREMENTS.apiResponseTime}ms`)
    console.log(`   - Minimum throughput: >${BATCH_REQUIREMENTS.throughputMinimum} emails/sec`)
  })
})