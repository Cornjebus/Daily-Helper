/**
 * SCORING BENCHMARK TESTS - Performance Tests
 * Performance tests for email scoring (< 100ms requirement)
 * Validates scoring speed, cache efficiency, and batch processing performance
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { setupIntegrationTests, createTestUser, PerformanceTimer } from '../setup/test-config'
import { DatabaseTestUtils, PerformanceTestUtils, MockDataGenerator } from '../setup/test-utils'
import { TEST_DATA_GENERATORS, EMAIL_FIXTURES } from '../setup/test-fixtures'
import { scoreEmailPriority } from '@/lib/ai/openai'

describe('Email Scoring Performance Benchmarks', () => {
  const { getTestDb } = setupIntegrationTests()
  let dbUtils: DatabaseTestUtils
  let perfUtils: PerformanceTestUtils
  let testUser: any

  // Performance requirements
  const PERFORMANCE_REQUIREMENTS = {
    singleEmailScoring: 100, // < 100ms per email
    batchEmailScoring: 2000, // < 2s for batch of 20
    cachedEmailScoring: 10,  // < 10ms for cached results
    databaseQuery: 50,       // < 50ms for scoring data queries
    memoryUsageLimit: 50 * 1024 * 1024 // 50MB max memory increase
  }

  beforeAll(async () => {
    const testDb = getTestDb()
    dbUtils = new DatabaseTestUtils(testDb)
    perfUtils = new PerformanceTestUtils()

    testUser = await createTestUser(testDb, {
      id: 'test-user-perf',
      email: 'perf.test@example.com'
    })

    console.log('🏁 Starting email scoring performance benchmarks')
  })

  beforeEach(async () => {
    await getTestDb().reset()

    // Insert minimal test data for performance tests
    await dbUtils.insertTestData({
      users: [testUser.user],
      preferences: [{
        id: 'perf-prefs',
        user_id: testUser.user.id,
        enable_pattern_learning: true,
        max_ai_cost_per_day: 10.00,
        preferred_ai_model: 'gpt-4o-mini'
      }]
    })
  })

  describe('Single Email Scoring Performance', () => {
    test('should score single email in under 100ms', async () => {
      // Mock OpenAI for consistent performance testing
      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockResolvedValue({
        score: 7,
        reasoning: 'Performance test scoring'
      })

      const email = EMAIL_FIXTURES.urgentWork

      const { result, duration } = await perfUtils.measureAsync(async () => {
        return await scoreEmailPriority(
          testUser.user.id,
          email.id,
          email.subject || '',
          email.from_email || '',
          email.snippet || '',
          email.is_important || false,
          email.is_starred || false,
          email.is_unread || false
        )
      })

      // Validate result
      expect(result.score).toBeValidEmailScore()
      expect(result.reasoning).toBeDefined()

      // Performance assertion
      perfUtils.assertPerformance(
        duration,
        PERFORMANCE_REQUIREMENTS.singleEmailScoring,
        'Single email scoring'
      )

      console.log(`✅ Single email scored in ${Math.round(duration)}ms (requirement: <${PERFORMANCE_REQUIREMENTS.singleEmailScoring}ms)`)
    })

    test('should maintain performance across different email types', async () => {
      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockResolvedValue({
        score: 6,
        reasoning: 'Consistent performance test'
      })

      const emailTypes = [
        EMAIL_FIXTURES.urgentWork,    // High priority
        EMAIL_FIXTURES.workUpdate,   // Medium priority
        EMAIL_FIXTURES.marketingPromo, // Low priority
        EMAIL_FIXTURES.newsletter,    // Very low priority
      ]

      const results = []

      for (const email of emailTypes) {
        const { result, duration } = await perfUtils.measureAsync(async () => {
          return await scoreEmailPriority(
            testUser.user.id,
            email.id,
            email.subject || '',
            email.from_email || '',
            email.snippet || '',
            email.is_important || false,
            email.is_starred || false,
            email.is_unread || false
          )
        })

        results.push({ email: email.id, duration, score: result.score })

        // Each email should meet performance requirement
        expect(duration).toBeLessThan(PERFORMANCE_REQUIREMENTS.singleEmailScoring)
      }

      // Calculate average performance
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length
      expect(avgDuration).toBeLessThan(PERFORMANCE_REQUIREMENTS.singleEmailScoring)

      console.log(`✅ Average scoring time across email types: ${Math.round(avgDuration)}ms`)
      results.forEach(r => console.log(`   - ${r.email}: ${Math.round(r.duration)}ms`))
    })

    test('should handle concurrent scoring efficiently', async () => {
      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockResolvedValue({
        score: 5,
        reasoning: 'Concurrent test scoring'
      })

      const concurrentEmails = TEST_DATA_GENERATORS.generateMixedEmails(5, testUser.user.id)

      const { result: scoringPromises, duration } = await perfUtils.measureAsync(async () => {
        // Score all emails concurrently
        return Promise.all(concurrentEmails.map(email =>
          scoreEmailPriority(
            testUser.user.id,
            email.id,
            email.subject || '',
            email.from_email || '',
            email.snippet || '',
            email.is_important || false,
            email.is_starred || false,
            email.is_unread || false
          )
        ))
      })

      // Verify all emails were scored
      expect(scoringPromises).toHaveLength(5)
      scoringPromises.forEach(result => {
        expect(result.score).toBeValidEmailScore()
      })

      // Concurrent processing should be more efficient than sequential
      const avgTimePerEmail = duration / concurrentEmails.length
      expect(avgTimePerEmail).toBeLessThan(PERFORMANCE_REQUIREMENTS.singleEmailScoring)

      console.log(`✅ Concurrent scoring: ${concurrentEmails.length} emails in ${Math.round(duration)}ms (${Math.round(avgTimePerEmail)}ms per email)`)
    })
  })

  describe('Cache Performance', () => {
    test('should achieve sub-10ms response for cached scoring results', async () => {
      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockResolvedValue({
        score: 8,
        reasoning: 'Initial cache test scoring'
      })

      const email = EMAIL_FIXTURES.vipSender

      // First call - populate cache
      const firstCall = await perfUtils.measureAsync(async () => {
        return await scoreEmailPriority(
          testUser.user.id,
          email.id,
          email.subject || '',
          email.from_email || '',
          email.snippet || '',
          email.is_important || false,
          email.is_starred || false,
          email.is_unread || false
        )
      })

      console.log(`First call (cache miss): ${Math.round(firstCall.duration)}ms`)

      // Second call - should hit cache (with slightly different email ID to test signature matching)
      const cachedEmail = {
        ...email,
        id: 'cached-test-email',
        // Same content should result in cache hit
      }

      const secondCall = await perfUtils.measureAsync(async () => {
        return await scoreEmailPriority(
          testUser.user.id,
          cachedEmail.id,
          cachedEmail.subject || '',
          cachedEmail.from_email || '',
          cachedEmail.snippet || '',
          cachedEmail.is_important || false,
          cachedEmail.is_starred || false,
          cachedEmail.is_unread || false
        )
      })

      console.log(`Second call (cache hit): ${Math.round(secondCall.duration)}ms`)

      // Cache hit should be significantly faster
      expect(secondCall.duration).toBeLessThan(PERFORMANCE_REQUIREMENTS.cachedEmailScoring)
      expect(secondCall.duration).toBeLessThan(firstCall.duration / 2) // At least 50% faster

      // Results should be consistent
      expect(secondCall.result.score).toBe(firstCall.result.score)

      console.log(`✅ Cache performance: ${Math.round(secondCall.duration)}ms (requirement: <${PERFORMANCE_REQUIREMENTS.cachedEmailScoring}ms)`)
    })

    test('should maintain cache efficiency under load', async () => {
      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockResolvedValue({
        score: 6,
        reasoning: 'Load test scoring'
      })

      // Create 20 similar emails that should hit cache
      const similarEmails = Array(20).fill(null).map((_, i) => ({
        ...EMAIL_FIXTURES.workUpdate,
        id: `cache-load-${i}`,
        // Vary slightly but should still hit cache due to content similarity
        subject: `Work Update ${i}`,
      }))

      // First, populate cache with one email
      await scoreEmailPriority(
        testUser.user.id,
        similarEmails[0].id,
        similarEmails[0].subject || '',
        similarEmails[0].from_email || '',
        similarEmails[0].snippet || '',
        similarEmails[0].is_important || false,
        similarEmails[0].is_starred || false,
        similarEmails[0].is_unread || false
      )

      // Now score remaining emails - should mostly hit cache
      const { duration } = await perfUtils.measureAsync(async () => {
        return Promise.all(similarEmails.slice(1).map(email =>
          scoreEmailPriority(
            testUser.user.id,
            email.id,
            email.subject || '',
            email.from_email || '',
            email.snippet || '',
            email.is_important || false,
            email.is_starred || false,
            email.is_unread || false
          )
        ))
      })

      const avgTimePerEmail = duration / (similarEmails.length - 1)

      // With cache hits, average time should be very low
      expect(avgTimePerEmail).toBeLessThan(PERFORMANCE_REQUIREMENTS.cachedEmailScoring * 2)

      console.log(`✅ Cache under load: ${similarEmails.length - 1} emails in ${Math.round(duration)}ms (${Math.round(avgTimePerEmail)}ms per email)`)
    })
  })

  describe('Database Query Performance', () => {
    test('should retrieve scoring patterns efficiently', async () => {
      // Insert test patterns
      const testPatterns = [
        {
          id: 'perf-pattern-1',
          user_id: testUser.user.id,
          pattern_type: 'sender',
          pattern_value: 'urgent@company.com',
          score_impact: 30,
          confidence_score: 0.9,
          sample_count: 15,
          success_rate: 0.87
        },
        {
          id: 'perf-pattern-2',
          user_id: testUser.user.id,
          pattern_type: 'subject',
          pattern_value: 'urgent',
          score_impact: 25,
          confidence_score: 0.85,
          sample_count: 20,
          success_rate: 0.80
        }
      ]

      await dbUtils.insertTestData({
        patterns: testPatterns
      })

      // Measure pattern retrieval performance
      const { result: patterns, duration } = await perfUtils.measureAsync(async () => {
        const { data } = await getTestDb().serviceClient
          .from('email_patterns')
          .select('*')
          .eq('user_id', testUser.user.id)
          .gte('confidence_score', 0.5)

        return data || []
      })

      // Verify results
      expect(patterns).toHaveLength(2)

      // Performance assertion
      perfUtils.assertPerformance(
        duration,
        PERFORMANCE_REQUIREMENTS.databaseQuery,
        'Pattern retrieval query'
      )

      console.log(`✅ Pattern query: ${patterns.length} results in ${Math.round(duration)}ms`)
    })

    test('should efficiently query VIP senders', async () => {
      // Insert test VIP senders
      const vipSenders = Array(10).fill(null).map((_, i) => ({
        id: `vip-perf-${i}`,
        user_id: testUser.user.id,
        sender_email: `vip${i}@company.com`,
        sender_name: `VIP Sender ${i}`,
        sender_domain: 'company.com',
        score_boost: 30 + i * 2,
        usage_count: i * 5,
        confidence_score: 0.8 + (i * 0.02)
      }))

      await dbUtils.insertTestData({
        vipSenders
      })

      // Test domain-based VIP lookup (common use case)
      const { result: domainVips, duration } = await perfUtils.measureAsync(async () => {
        const { data } = await getTestDb().serviceClient
          .from('vip_senders')
          .select('*')
          .eq('user_id', testUser.user.id)
          .eq('sender_domain', 'company.com')

        return data || []
      })

      expect(domainVips).toHaveLength(10)

      perfUtils.assertPerformance(
        duration,
        PERFORMANCE_REQUIREMENTS.databaseQuery,
        'VIP sender domain query'
      )

      console.log(`✅ VIP query: ${domainVips.length} results in ${Math.round(duration)}ms`)
    })

    test('should handle complex scoring queries efficiently', async () => {
      // Insert test email scores
      const testScores = Array(50).fill(null).map((_, i) => ({
        id: `score-perf-${i}`,
        user_id: testUser.user.id,
        email_id: `email-perf-${i}`,
        raw_score: 50 + (i % 50),
        final_score: 50 + (i % 50),
        processing_tier: i < 10 ? 'high' : i < 30 ? 'medium' : 'low',
        score_factors: {
          baseScore: 50,
          patternBoosts: i % 10,
          vipBoost: i % 20
        },
        ai_processed: i % 2 === 0,
        created_at: new Date().toISOString()
      }))

      await getTestDb().serviceClient
        .from('email_scores')
        .insert(testScores)

      // Complex query with filtering and aggregation
      const { result, duration } = await perfUtils.measureAsync(async () => {
        const { data } = await getTestDb().serviceClient
          .from('email_scores')
          .select('processing_tier, final_score, ai_processed')
          .eq('user_id', testUser.user.id)
          .gte('final_score', 60)
          .order('final_score', { ascending: false })
          .limit(20)

        return data || []
      })

      expect(result.length).toBeGreaterThan(0)

      perfUtils.assertPerformance(
        duration,
        PERFORMANCE_REQUIREMENTS.databaseQuery,
        'Complex scoring query'
      )

      console.log(`✅ Complex query: ${result.length} results in ${Math.round(duration)}ms`)
    })
  })

  describe('Memory Usage Performance', () => {
    test('should maintain reasonable memory usage during scoring', async () => {
      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockResolvedValue({
        score: 6,
        reasoning: 'Memory test scoring'
      })

      // Force garbage collection before test
      if (global.gc) {
        global.gc()
      }

      const initialMemory = process.memoryUsage().heapUsed

      // Score many emails to test memory usage
      const manyEmails = TEST_DATA_GENERATORS.generateMixedEmails(50, testUser.user.id)

      await Promise.all(manyEmails.map(email =>
        scoreEmailPriority(
          testUser.user.id,
          email.id,
          email.subject || '',
          email.from_email || '',
          email.snippet || '',
          email.is_important || false,
          email.is_starred || false,
          email.is_unread || false
        )
      ))

      // Force garbage collection after test
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_REQUIREMENTS.memoryUsageLimit)

      console.log(`✅ Memory usage: ${Math.round(memoryIncrease / 1024 / 1024)}MB increase for ${manyEmails.length} emails (limit: ${PERFORMANCE_REQUIREMENTS.memoryUsageLimit / 1024 / 1024}MB)`)
    })
  })

  describe('Scoring Algorithm Performance', () => {
    test('should handle pattern matching efficiently', async () => {
      // Create many patterns to test pattern matching performance
      const manyPatterns = Array(100).fill(null).map((_, i) => ({
        id: `pattern-perf-${i}`,
        user_id: testUser.user.id,
        pattern_type: i % 3 === 0 ? 'sender' : i % 3 === 1 ? 'subject' : 'content',
        pattern_value: `pattern${i}`,
        score_impact: (i % 40) - 20, // -20 to +19
        confidence_score: 0.5 + (i % 50) / 100,
        sample_count: i % 20 + 1,
        success_rate: 0.5 + (i % 50) / 100
      }))

      await dbUtils.insertTestData({
        patterns: manyPatterns
      })

      const email = {
        ...EMAIL_FIXTURES.workUpdate,
        subject: 'pattern50 urgent pattern25 meeting', // Contains multiple patterns
        from_email: 'pattern10@example.com',
        snippet: 'This contains pattern75 in the content'
      }

      // Mock AI scoring but measure pattern processing
      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockResolvedValue({
        score: 7,
        reasoning: 'Pattern matching test'
      })

      const { result, duration } = await perfUtils.measureAsync(async () => {
        return await scoreEmailPriority(
          testUser.user.id,
          email.id,
          email.subject,
          email.from_email,
          email.snippet,
          email.is_important || false,
          email.is_starred || false,
          email.is_unread || false
        )
      })

      expect(result.score).toBeValidEmailScore()

      // Even with many patterns, scoring should be fast
      perfUtils.assertPerformance(
        duration,
        PERFORMANCE_REQUIREMENTS.singleEmailScoring * 2, // Allow 2x time for pattern processing
        'Pattern matching performance'
      )

      console.log(`✅ Pattern matching: ${manyPatterns.length} patterns processed in ${Math.round(duration)}ms`)
    })

    test('should scale efficiently with user learning data', async () => {
      // Simulate a user with extensive learning data
      const extensiveLearningData = {
        vipSenders: Array(50).fill(null).map((_, i) => ({
          id: `extensive-vip-${i}`,
          user_id: testUser.user.id,
          sender_email: `learned${i}@example.com`,
          sender_name: `Learned Sender ${i}`,
          score_boost: 10 + (i % 20),
          learned_from_user_action: true,
          confidence_score: 0.7 + (i % 30) / 100,
          usage_count: i + 1
        })),
        patterns: Array(200).fill(null).map((_, i) => ({
          id: `extensive-pattern-${i}`,
          user_id: testUser.user.id,
          pattern_type: ['sender', 'subject', 'content'][i % 3],
          pattern_value: `learned_pattern_${i}`,
          score_impact: (i % 60) - 30,
          learned_from_user_action: true,
          confidence_score: 0.6 + (i % 40) / 100,
          sample_count: Math.max(1, i % 25),
          success_rate: 0.6 + (i % 40) / 100
        }))
      }

      await dbUtils.insertTestData(extensiveLearningData)

      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockResolvedValue({
        score: 8,
        reasoning: 'Extensive learning test'
      })

      const email = EMAIL_FIXTURES.vipSender

      // Benchmark with extensive user data
      const benchmark = await perfUtils.benchmark(async () => {
        return await scoreEmailPriority(
          testUser.user.id,
          `benchmark-${Date.now()}-${Math.random()}`,
          email.subject || '',
          email.from_email || '',
          email.snippet || '',
          email.is_important || false,
          email.is_starred || false,
          email.is_unread || false
        )
      }, 10, 'extensive-learning')

      console.log(`✅ Extensive learning performance:`)
      console.log(`   - Average: ${Math.round(benchmark.averageDuration)}ms`)
      console.log(`   - Min: ${Math.round(benchmark.minDuration)}ms`)
      console.log(`   - Max: ${Math.round(benchmark.maxDuration)}ms`)

      // Performance should remain good even with lots of learning data
      expect(benchmark.averageDuration).toBeLessThan(PERFORMANCE_REQUIREMENTS.singleEmailScoring * 1.5)
    })
  })

  describe('Performance Regression Tests', () => {
    test('should maintain performance consistency across multiple runs', async () => {
      const mockOpenAI = require('../setup/test-config').mockOpenAI()
      mockOpenAI.mockScoring.mockResolvedValue({
        score: 6,
        reasoning: 'Consistency test'
      })

      const email = EMAIL_FIXTURES.workUpdate

      // Run benchmark multiple times
      const benchmark = await perfUtils.benchmark(async () => {
        return await scoreEmailPriority(
          testUser.user.id,
          `consistency-${Date.now()}-${Math.random()}`,
          email.subject || '',
          email.from_email || '',
          email.snippet || '',
          email.is_important || false,
          email.is_starred || false,
          email.is_unread || false
        )
      }, 20, 'consistency-test')

      // Verify consistency
      expect(benchmark.averageDuration).toBeLessThan(PERFORMANCE_REQUIREMENTS.singleEmailScoring)

      // Standard deviation should be reasonable (less than 50% of average)
      const variance = benchmark.maxDuration - benchmark.minDuration
      expect(variance).toBeLessThan(benchmark.averageDuration * 0.5)

      console.log(`✅ Performance consistency over ${benchmark.iterations} runs:`)
      console.log(`   - Average: ${Math.round(benchmark.averageDuration)}ms`)
      console.log(`   - Variance: ${Math.round(variance)}ms`)
      console.log(`   - Consistency: ${Math.round(((benchmark.averageDuration - variance) / benchmark.averageDuration) * 100)}%`)
    })
  })

  afterAll(() => {
    console.log('🏁 Email scoring performance benchmarks completed')
    console.log('📊 Performance Requirements Summary:')
    console.log(`   - Single email scoring: <${PERFORMANCE_REQUIREMENTS.singleEmailScoring}ms`)
    console.log(`   - Batch processing: <${PERFORMANCE_REQUIREMENTS.batchEmailScoring}ms`)
    console.log(`   - Cached results: <${PERFORMANCE_REQUIREMENTS.cachedEmailScoring}ms`)
    console.log(`   - Database queries: <${PERFORMANCE_REQUIREMENTS.databaseQuery}ms`)
    console.log(`   - Memory usage: <${PERFORMANCE_REQUIREMENTS.memoryUsageLimit / 1024 / 1024}MB`)
  })
})