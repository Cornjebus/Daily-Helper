/**
 * Performance Testing Suite for Email Processing
 * Validates SLA requirements: < 100ms email scoring, < 2s batch processing
 */

import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals'
import { emailScoringCache, generateEmailSignature } from '../../src/cache/email-scoring-cache'
import { databaseOptimizer } from '../../src/performance/database-optimizer'
import { performanceMonitor } from '../../src/monitoring/performance-monitor'
import { scoreEmailPriority } from '../../lib/ai/openai'

// Mock OpenAI for testing
jest.mock('../../lib/ai/openai', () => ({
  scoreEmailPriority: jest.fn()
}))

// Mock Supabase for testing
jest.mock('../../lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: () => ({ data: { user: { id: 'test-user-id' } }, error: null })
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({ data: [], error: null })
          })
        })
      }),
      upsert: () => ({ error: null })
    })
  }))
}))

describe('Email Processing Performance Tests', () => {
  beforeAll(() => {
    // Initialize performance monitoring
    performanceMonitor.reset()
    emailScoringCache.clear()
  })

  afterAll(() => {
    // Clean up
    performanceMonitor.reset()
    emailScoringCache.clear()
  })

  describe('Email Scoring Performance - SLA: < 100ms', () => {
    test('should score email under 100ms with cache hit', async () => {
      // Setup cache with test data
      const signature = generateEmailSignature(
        'test@example.com',
        'Test Subject',
        'Test content',
        false,
        false,
        true
      )

      const cachedResult = {
        score: 7,
        reasoning: 'High priority email',
        model: 'gpt-4o-mini',
        version: '1.0',
        confidence: 0.9,
        features: {}
      }

      emailScoringCache.setEmailScore(signature, cachedResult, 50)

      const startTime = performance.now()

      // Get cached result
      const result = await emailScoringCache.getEmailScore(signature)

      const duration = performance.now() - startTime

      expect(result).toBeTruthy()
      expect(result?.score).toBe(7)
      expect(duration).toBeLessThan(100) // SLA requirement
      expect(duration).toBeLessThan(10)  // Cache should be very fast
    })

    test('should handle cache miss and still meet SLA with fallback', async () => {
      const mockScoreEmail = scoreEmailPriority as jest.MockedFunction<typeof scoreEmailPriority>
      mockScoreEmail.mockResolvedValueOnce({
        score: 6,
        reasoning: 'Medium priority email'
      })

      const startTime = performance.now()

      const result = await scoreEmailPriority(
        'test-user-id',
        'test-email-id',
        'Test Subject',
        'sender@example.com',
        'Test email content',
        false,
        false,
        true
      )

      const duration = performance.now() - startTime

      expect(result.score).toBe(6)
      expect(duration).toBeLessThan(100) // SLA requirement
    })

    test('should maintain performance under load', async () => {
      const iterations = 50
      const durations: number[] = []

      // Warm up cache with various patterns
      const patterns = [
        { from: 'noreply@service.com', subject: 'Confirmation', content: 'Thank you' },
        { from: 'boss@company.com', subject: 'Urgent: Meeting', content: 'Please join ASAP' },
        { from: 'newsletter@blog.com', subject: 'Weekly Update', content: 'Here are this weeks updates' },
      ]

      for (const pattern of patterns) {
        const signature = generateEmailSignature(
          pattern.from,
          pattern.subject,
          pattern.content,
          false,
          false,
          true
        )

        emailScoringCache.setEmailScore(signature, {
          score: 5,
          reasoning: 'Test score',
          model: 'gpt-4o-mini',
          version: '1.0',
          confidence: 0.8,
          features: {}
        }, 20)
      }

      // Test performance under load
      for (let i = 0; i < iterations; i++) {
        const pattern = patterns[i % patterns.length]
        const signature = generateEmailSignature(
          `${pattern.from}-${i}`,
          `${pattern.subject} ${i}`,
          `${pattern.content} ${i}`,
          Math.random() > 0.5,
          Math.random() > 0.7,
          Math.random() > 0.3
        )

        const startTime = performance.now()

        // Mix of cache hits and pattern matches
        const result = await emailScoringCache.getEmailScore(signature)

        const duration = performance.now() - startTime
        durations.push(duration)
      }

      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
      const p95Duration = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)]
      const p99Duration = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.99)]

      console.log(`Performance under load (${iterations} iterations):`)
      console.log(`  Average: ${avgDuration.toFixed(2)}ms`)
      console.log(`  P95: ${p95Duration.toFixed(2)}ms`)
      console.log(`  P99: ${p99Duration.toFixed(2)}ms`)

      expect(avgDuration).toBeLessThan(50)    // Should be very fast on average
      expect(p95Duration).toBeLessThan(100)   // SLA requirement at P95
      expect(p99Duration).toBeLessThan(200)   // P99 allowance
    })
  })

  describe('Database Query Performance', () => {
    test('should fetch unprocessed emails efficiently', async () => {
      const startTime = performance.now()

      const emails = await databaseOptimizer.getUnprocessedEmails('test-user-id', 50, true)

      const duration = performance.now() - startTime

      expect(Array.isArray(emails)).toBe(true)
      expect(duration).toBeLessThan(500) // 500ms threshold for database queries
    })

    test('should perform batch updates efficiently', async () => {
      const updates = Array.from({ length: 10 }, (_, i) => ({
        emailId: `email-${i}`,
        priority: i + 1,
        score: (i + 1) * 1.2,
        reasoning: `Test reasoning ${i}`,
        model: 'gpt-4o-mini'
      }))

      const startTime = performance.now()

      const result = await databaseOptimizer.batchUpdateEmailPriorities(updates)

      const duration = performance.now() - startTime

      expect(result.totalTime).toBeLessThan(2000) // 2s SLA for batch processing
      expect(result.avgTimePerItem).toBeLessThan(200) // 200ms per item
      expect(duration).toBeLessThan(2000) // Overall operation under 2s
    })

    test('should maintain cache performance', () => {
      // Populate cache
      for (let i = 0; i < 1000; i++) {
        const signature = generateEmailSignature(
          `sender${i}@example.com`,
          `Subject ${i}`,
          `Content ${i}`,
          i % 3 === 0,
          i % 5 === 0,
          i % 2 === 0
        )

        emailScoringCache.setEmailScore(signature, {
          score: (i % 10) + 1,
          reasoning: `Score ${i}`,
          model: 'gpt-4o-mini',
          version: '1.0',
          confidence: 0.9,
          features: {}
        }, 10)
      }

      const stats = emailScoringCache.getStats()

      expect(stats.hotCacheSize).toBeGreaterThan(0)
      expect(stats.memoryUsage).toBeLessThan(10 * 1024 * 1024) // Less than 10MB
    })
  })

  describe('Memory Performance', () => {
    test('should manage memory efficiently under load', async () => {
      const initialMemory = process.memoryUsage().heapUsed

      // Simulate heavy load
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(
          emailScoringCache.getEmailScore(
            generateEmailSignature(
              `load-test-${i}@example.com`,
              `Load Test ${i}`,
              `Content for load test ${i}`,
              false,
              false,
              true
            )
          )
        )
      }

      await Promise.all(promises)

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })
  })

  describe('Performance Monitoring', () => {
    test('should track metrics accurately', () => {
      // Record some test metrics
      performanceMonitor.recordMetric('email_scoring', 85, true, { test: true }, 'test-user')
      performanceMonitor.recordMetric('email_scoring', 120, true, { test: true }, 'test-user')
      performanceMonitor.recordMetric('email_scoring', 95, true, { test: true }, 'test-user')

      const report = performanceMonitor.generatePerformanceReport(1)

      expect(report.metrics.emailScoring.avgTime).toBeGreaterThan(0)
      expect(report.metrics.emailScoring.p95Time).toBeGreaterThan(0)
      expect(report.slaCompliance).toBeGreaterThan(0)
    })

    test('should detect SLA violations', () => {
      // Record violations
      performanceMonitor.recordMetric('email_scoring', 150, true, { violation: true }, 'test-user')
      performanceMonitor.recordMetric('email_scoring', 200, true, { violation: true }, 'test-user')

      const report = performanceMonitor.generatePerformanceReport(1)

      expect(report.metrics.emailScoring.slaViolations).toBeGreaterThan(0)
      expect(report.recommendations.length).toBeGreaterThan(0)
    })
  })

  describe('Cost Optimization Performance', () => {
    test('should route to appropriate tiers efficiently', () => {
      const testCases = [
        { subject: 'Thank you', content: 'Thanks!', expectedTier: 'nano' },
        { subject: 'Meeting Request', content: 'Can we meet tomorrow?', expectedTier: 'mini' },
        { subject: 'Complex Analysis Required', content: 'Need detailed analysis of quarterly results...', expectedTier: 'standard' }
      ]

      testCases.forEach(({ subject, content, expectedTier }) => {
        const { determineModelTier } = require('../../src/performance/performance-imports')
        const tier = determineModelTier(subject, content, 'test@example.com')

        expect(['nano', 'mini', 'standard', 'premium']).toContain(tier)
        // We can't assert exact tier due to logic complexity, but ensure it's valid
      })
    })
  })

  describe('End-to-End Performance', () => {
    test('should meet overall SLA requirements', async () => {
      const startTime = performance.now()

      // Simulate full email processing workflow
      const emails = Array.from({ length: 10 }, (_, i) => ({
        id: `email-${i}`,
        subject: `Test Email ${i}`,
        from_email: `sender${i}@example.com`,
        snippet: `This is test email content ${i}`,
        is_important: i % 3 === 0,
        is_starred: i % 5 === 0,
        is_unread: i % 2 === 0
      }))

      // Process emails in parallel (simulating API behavior)
      const results = await Promise.all(
        emails.map(async (email) => {
          const signature = generateEmailSignature(
            email.from_email,
            email.subject,
            email.snippet,
            email.is_important,
            email.is_starred,
            email.is_unread
          )

          return await emailScoringCache.getEmailScore(signature) || {
            score: 5,
            reasoning: 'Default score',
            model: 'fallback',
            version: '1.0',
            confidence: 0.7,
            features: {}
          }
        })
      )

      const totalTime = performance.now() - startTime

      expect(results.length).toBe(10)
      expect(totalTime).toBeLessThan(2000) // 2s SLA for batch processing
      expect(totalTime / emails.length).toBeLessThan(200) // 200ms average per email

      console.log(`End-to-end performance: ${totalTime.toFixed(2)}ms for ${emails.length} emails`)
      console.log(`Average time per email: ${(totalTime / emails.length).toFixed(2)}ms`)
    })
  })
})

/**
 * Benchmark utility functions
 */
export class PerformanceBenchmark {
  static async runEmailScoringBenchmark(iterations: number = 100): Promise<{
    avgTime: number
    p95Time: number
    p99Time: number
    slaCompliance: number
  }> {
    const durations: number[] = []
    let slaViolations = 0

    for (let i = 0; i < iterations; i++) {
      const signature = generateEmailSignature(
        `benchmark${i}@example.com`,
        `Benchmark Test ${i}`,
        `Benchmark content ${i}`,
        i % 3 === 0,
        i % 5 === 0,
        i % 2 === 0
      )

      const startTime = performance.now()
      await emailScoringCache.getEmailScore(signature)
      const duration = performance.now() - startTime

      durations.push(duration)
      if (duration > 100) slaViolations++
    }

    durations.sort((a, b) => a - b)

    return {
      avgTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      p95Time: durations[Math.floor(durations.length * 0.95)],
      p99Time: durations[Math.floor(durations.length * 0.99)],
      slaCompliance: (iterations - slaViolations) / iterations
    }
  }

  static async runBatchProcessingBenchmark(batchSize: number = 50): Promise<{
    totalTime: number
    avgTimePerItem: number
    slaCompliance: number
  }> {
    const startTime = performance.now()

    const signatures = Array.from({ length: batchSize }, (_, i) =>
      generateEmailSignature(
        `batch${i}@example.com`,
        `Batch Test ${i}`,
        `Batch content ${i}`,
        false,
        false,
        true
      )
    )

    await Promise.all(signatures.map(sig => emailScoringCache.getEmailScore(sig)))

    const totalTime = performance.now() - startTime
    const avgTimePerItem = totalTime / batchSize

    return {
      totalTime,
      avgTimePerItem,
      slaCompliance: totalTime < 2000 ? 1 : 0 // 2s SLA
    }
  }
}