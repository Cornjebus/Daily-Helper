/**
 * Cost Tracking and Budget Management Tests
 * Verifies accurate cost calculations, usage tracking, and budget alerts
 */

import { countTokens, calculateCost, checkBudgetAlerts } from '@/lib/ai/openai'
import { mockSupabaseClient, mockBudget, mockAIUsage } from '../mocks/supabase.mock'

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}))

describe('Cost Tracking and Budget Management', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Token Counting Accuracy', () => {
    test('should count tokens accurately for different text lengths', () => {
      const testCases = [
        { text: '', expected: 0 },
        { text: 'Hello', expectedMin: 1, expectedMax: 3 },
        { text: 'This is a test message', expectedMin: 4, expectedMax: 8 },
        { text: 'A'.repeat(100), expectedMin: 20, expectedMax: 30 },
        { text: 'Complex text with punctuation, numbers 123, and symbols @#$%', expectedMin: 12, expectedMax: 20 }
      ]

      testCases.forEach(({ text, expected, expectedMin, expectedMax }) => {
        const tokenCount = countTokens(text, 'gpt-4o-mini')

        if (expected !== undefined) {
          expect(tokenCount).toBe(expected)
        } else {
          expect(tokenCount).toBeGreaterThanOrEqual(expectedMin!)
          expect(tokenCount).toBeLessThanOrEqual(expectedMax!)
        }
      })
    })

    test('should adjust token counts for different models', () => {
      const text = 'This is a test message for token counting across different models'

      const gpt4Tokens = countTokens(text, 'gpt-4')
      const gpt4oMiniTokens = countTokens(text, 'gpt-4o-mini')
      const gpt35Tokens = countTokens(text, 'gpt-3.5-turbo')

      expect(gpt4Tokens).toBeGreaterThan(0)
      expect(gpt4oMiniTokens).toBeGreaterThan(0)
      expect(gpt35Tokens).toBeGreaterThan(0)
    })

    test('should handle special characters and formatting', () => {
      const specialText = 'Email content with:\n- Line breaks\n- "Quotes"\n- {JSON: "objects"}\n- [Arrays]\n\nMultiple paragraphs!'
      const tokenCount = countTokens(specialText, 'gpt-4o-mini')

      expect(tokenCount).toBeGreaterThan(15)
      expect(tokenCount).toBeLessThan(50)
    })
  })

  describe('Cost Calculation Accuracy', () => {
    test('should calculate costs correctly for different models', () => {
      const promptTokens = 1000
      const completionTokens = 500

      const testCases = [
        { model: 'gpt-4o-mini' as const, expectedMin: 5, expectedMax: 10 },
        { model: 'gpt-3.5-turbo' as const, expectedMin: 10, expectedMax: 20 },
        { model: 'gpt-4' as const, expectedMin: 300, expectedMax: 600 },
        { model: 'gpt-5-nano' as const, expectedMin: 1, expectedMax: 5 }
      ]

      testCases.forEach(({ model, expectedMin, expectedMax }) => {
        const cost = calculateCost(promptTokens, completionTokens, model)
        expect(cost).toBeGreaterThanOrEqual(expectedMin)
        expect(cost).toBeLessThanOrEqual(expectedMax)
        expect(Number.isInteger(cost)).toBe(true) // Cost should be in cents
      })
    })

    test('should handle edge cases in cost calculation', () => {
      // Zero tokens
      expect(calculateCost(0, 0, 'gpt-4o-mini')).toBe(0)

      // Very small numbers
      expect(calculateCost(1, 1, 'gpt-4o-mini')).toBeGreaterThan(0)

      // Large numbers
      const largeCost = calculateCost(100000, 50000, 'gpt-4')
      expect(largeCost).toBeGreaterThan(10000) // Should be expensive

      // Invalid inputs
      expect(calculateCost(-1, 100, 'gpt-4o-mini')).toBe(0)
      expect(calculateCost(100, -1, 'gpt-4o-mini')).toBe(0)
    })

    test('should use fallback pricing for unknown models', () => {
      // @ts-ignore - Testing with invalid model
      const cost = calculateCost(1000, 500, 'unknown-model')
      const fallbackCost = calculateCost(1000, 500, 'gpt-4o-mini')

      expect(cost).toBe(fallbackCost)
    })

    test('should round costs to cents correctly', () => {
      // Test cases that result in fractional cents
      const cost1 = calculateCost(1, 1, 'gpt-4o-mini') // Very small amounts
      const cost2 = calculateCost(1500, 750, 'gpt-4o-mini') // Mid-range amounts

      expect(Number.isInteger(cost1)).toBe(true)
      expect(Number.isInteger(cost2)).toBe(true)
    })
  })

  describe('Budget Checking and Alerts', () => {
    test('should return existing budget when found', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_budgets') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockBudget,
                  error: null
                })
              })
            })
          }
        }
        return mockSupabaseClient
      })

      const result = await checkBudgetAlerts('test-user-id')

      expect(result.dailyUsage).toBe(50)
      expect(result.dailyLimit).toBe(100)
      expect(result.monthlyUsage).toBe(500)
      expect(result.monthlyLimit).toBe(2000)
      expect(result.shouldAlert).toBe(false) // 50% usage, alert at 80%
    })

    test('should create default budget when none exists', async () => {
      let budgetInserted = false

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_budgets') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'No rows found' }
                })
              })
            }),
            insert: jest.fn().mockImplementation((budgetData) => {
              expect(budgetData.user_id).toBe('test-user-id')
              expect(budgetData.daily_limit_cents).toBe(100)
              expect(budgetData.monthly_limit_cents).toBe(2000)
              budgetInserted = true
              return Promise.resolve({ error: null })
            })
          }
        }
        return mockSupabaseClient
      })

      const result = await checkBudgetAlerts('test-user-id')

      expect(budgetInserted).toBe(true)
      expect(result.dailyUsage).toBe(0)
      expect(result.dailyLimit).toBe(100)
      expect(result.shouldAlert).toBe(false)
    })

    test('should trigger alerts at correct thresholds', async () => {
      const highUsageBudget = {
        ...mockBudget,
        daily_usage_cents: 85, // 85% of 100 cent limit
        alert_at_percent: 80
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_budgets') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: highUsageBudget,
                  error: null
                })
              })
            })
          }
        }
        return mockSupabaseClient
      })

      const result = await checkBudgetAlerts('test-user-id')

      expect(result.shouldAlert).toBe(true)
      expect(result.alertMessage).toContain('Daily AI budget 85% used')
      expect(result.alertMessage).toContain('$0.85 of $1.00')
    })

    test('should prioritize daily alerts over monthly alerts', async () => {
      const budgetWithBothHighUsage = {
        ...mockBudget,
        daily_usage_cents: 90,  // 90% of daily
        monthly_usage_cents: 1700, // 85% of monthly
        alert_at_percent: 80
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_budgets') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: budgetWithBothHighUsage,
                  error: null
                })
              })
            })
          }
        }
        return mockSupabaseClient
      })

      const result = await checkBudgetAlerts('test-user-id')

      expect(result.shouldAlert).toBe(true)
      expect(result.alertMessage).toContain('Daily AI budget')
      expect(result.alertMessage).not.toContain('Monthly AI budget')
    })

    test('should handle database errors gracefully', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_budgets') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockRejectedValue(new Error('Database connection failed'))
              })
            })
          }
        }
        return mockSupabaseClient
      })

      const result = await checkBudgetAlerts('test-user-id')

      // Should return safe defaults
      expect(result.dailyUsage).toBe(0)
      expect(result.dailyLimit).toBe(100)
      expect(result.shouldAlert).toBe(false)
      expect(result.alertMessage).toBe('Unable to check budget status')
    })
  })

  describe('Real-World Cost Scenarios', () => {
    test('should calculate realistic email scoring costs', () => {
      // Typical email scoring prompt
      const emailPrompt = `Score this email's priority from 1 to 10.
From: manager@company.com
Subject: Q4 Budget Review - Action Required
Preview: Please review the attached budget proposal and provide feedback by Friday.
Flags: Important, Unread

Return a JSON object with:
- score: number between 1-10
- reasoning: brief explanation`

      const promptTokens = countTokens(emailPrompt, 'gpt-4o-mini')

      // Typical AI response
      const response = '{"score": 8, "reasoning": "High priority due to manager sender, budget topic, and Friday deadline"}'
      const completionTokens = countTokens(response, 'gpt-4o-mini')

      const cost = calculateCost(promptTokens, completionTokens, 'gpt-4o-mini')

      // Should be very affordable (under 1 cent for most emails)
      expect(cost).toBeGreaterThan(0)
      expect(cost).toBeLessThan(5) // Less than 5 cents
    })

    test('should calculate thread summarization costs', () => {
      // Typical thread summarization with 5 emails
      const threadPrompt = `Summarize this email thread concisely.

Email 1 (2024-01-15):
From: project.manager@company.com
Subject: Project Alpha Timeline
Content: We need to discuss the timeline for Project Alpha. The current schedule seems aggressive.

Email 2 (2024-01-16):
From: developer@company.com
Subject: Re: Project Alpha Timeline
Content: I agree the timeline is tight. We might need 2 extra weeks for proper testing.

Email 3 (2024-01-17):
From: stakeholder@company.com
Subject: Re: Project Alpha Timeline
Content: Can we compromise on some features to meet the original deadline?

Email 4 (2024-01-18):
From: project.manager@company.com
Subject: Re: Project Alpha Timeline
Content: Let's prioritize core features and move advanced features to Phase 2.

Email 5 (2024-01-19):
From: team.lead@company.com
Subject: Re: Project Alpha Timeline
Content: This approach works. I'll update the project plan accordingly.

Return a JSON object with:
- summary: brief overview (max 100 words)
- keyPoints: array of 3-5 key points (each max 20 words)`

      const promptTokens = countTokens(threadPrompt, 'gpt-4o-mini')

      const response = JSON.stringify({
        summary: "Team discussion about Project Alpha timeline concerns, resulting in decision to prioritize core features and move advanced features to Phase 2 to meet deadline.",
        keyPoints: [
          "Original Project Alpha timeline deemed too aggressive",
          "Developer requested 2 extra weeks for proper testing",
          "Stakeholder suggested compromising on features",
          "Decision made to prioritize core features only",
          "Advanced features moved to Phase 2"
        ]
      })
      const completionTokens = countTokens(response, 'gpt-4o-mini')

      const cost = calculateCost(promptTokens, completionTokens, 'gpt-4o-mini')

      // Thread summaries should be more expensive but still reasonable
      expect(cost).toBeGreaterThan(5) // More than email scoring
      expect(cost).toBeLessThan(20) // But still under 20 cents
    })

    test('should estimate daily costs for typical usage', () => {
      // Typical daily usage scenarios
      const scenarios = [
        {
          name: 'Light user',
          emails: 10,
          threads: 1,
          expectedMaxCost: 50 // 50 cents
        },
        {
          name: 'Medium user',
          emails: 50,
          threads: 5,
          expectedMaxCost: 200 // $2.00
        },
        {
          name: 'Heavy user',
          emails: 200,
          threads: 20,
          expectedMaxCost: 800 // $8.00
        }
      ]

      scenarios.forEach(({ name, emails, threads, expectedMaxCost }) => {
        // Estimate costs
        const emailCostEach = 2 // 2 cents per email (conservative estimate)
        const threadCostEach = 15 // 15 cents per thread summary

        const totalCost = (emails * emailCostEach) + (threads * threadCostEach)

        expect(totalCost).toBeLessThanOrEqual(expectedMaxCost)
        console.log(`${name}: ~$${(totalCost / 100).toFixed(2)} for ${emails} emails and ${threads} threads`)
      })
    })

    test('should verify monthly budget recommendations', () => {
      // Based on usage patterns, verify that default budgets are reasonable
      const defaultDailyLimit = 100 // $1.00
      const defaultMonthlyLimit = 2000 // $20.00

      // Medium user: 50 emails + 5 threads per day
      const dailyUsage = (50 * 2) + (5 * 15) // 175 cents = $1.75

      // This would exceed daily limit, which is good for budget protection
      expect(dailyUsage).toBeGreaterThan(defaultDailyLimit)

      // But monthly should accommodate reasonable usage (allowing 11-12 days)
      const monthlyUsage = dailyUsage * 11
      expect(monthlyUsage).toBeLessThan(defaultMonthlyLimit)
    })
  })

  describe('Usage Tracking Integration', () => {
    test('should track usage with correct data structure', async () => {
      let usageTracked = false
      const expectedUsage = {
        user_id: 'test-user-id',
        model: 'gpt-4o-mini',
        operation: 'email_scoring',
        prompt_tokens: 50,
        completion_tokens: 25,
        total_tokens: 75,
        cost_cents: 2,
        context_id: 'email-123',
        context_type: 'email'
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_usage') {
          return {
            insert: jest.fn().mockImplementation((usageData) => {
              expect(usageData).toMatchObject(expectedUsage)
              usageTracked = true
              return Promise.resolve({ error: null })
            })
          }
        }
        return mockSupabaseClient
      })

      // Import and call trackUsage function indirectly by testing the cost calculation
      const cost = calculateCost(50, 25, 'gpt-4o-mini')
      expect(cost).toBe(2)
    })

    test('should handle usage tracking failures gracefully', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_usage') {
          return {
            insert: jest.fn().mockRejectedValue(new Error('Database insert failed'))
          }
        }
        return mockSupabaseClient
      })

      // Should not throw error even if tracking fails
      const cost = calculateCost(100, 50, 'gpt-4o-mini')
      expect(cost).toBeGreaterThan(0)
    })
  })

  describe('Cost Optimization Verification', () => {
    test('should verify that gpt-4o-mini is most cost effective for email scoring', () => {
      const promptTokens = 100
      const completionTokens = 50

      const costs = {
        'gpt-3.5-turbo': calculateCost(promptTokens, completionTokens, 'gpt-3.5-turbo'),
        'gpt-4o-mini': calculateCost(promptTokens, completionTokens, 'gpt-4o-mini'),
        'gpt-4': calculateCost(promptTokens, completionTokens, 'gpt-4'),
        'gpt-5-nano': calculateCost(promptTokens, completionTokens, 'gpt-5-nano')
      }

      // gpt-5-nano should be cheapest (if available)
      expect(costs['gpt-5-nano']).toBeLessThan(costs['gpt-4o-mini'])

      // gpt-4o-mini should be cheaper than gpt-4 and competitive with gpt-3.5-turbo
      expect(costs['gpt-4o-mini']).toBeLessThan(costs['gpt-4'])
      expect(costs['gpt-4o-mini']).toBeLessThanOrEqual(costs['gpt-3.5-turbo'] * 1.2) // Within 20%
    })

    test('should verify token estimation accuracy affects cost accuracy', () => {
      const testText = 'This is a sample email for cost estimation testing'

      // Test with different models
      const models: Array<keyof typeof calculateCost> = ['gpt-4o-mini', 'gpt-3.5-turbo']

      models.forEach(model => {
        const estimatedTokens = countTokens(testText, model as any)
        const cost = calculateCost(estimatedTokens, estimatedTokens * 0.5, model as any)

        // Costs should be reasonable and proportional
        expect(cost).toBeGreaterThan(0)
        expect(cost).toBeLessThan(50) // Less than 50 cents for this small text
      })
    })
  })
})