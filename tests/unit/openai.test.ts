import {
  countTokens,
  calculateCost,
  scoreEmailPriority,
  summarizeEmailThread,
  generateSmartReplies,
  checkBudgetAlerts
} from '@/lib/ai/openai'
import { mockOpenAI, mockOpenAIResponse, mockThreadSummaryResponse, mockSmartRepliesResponse } from '../mocks/openai.mock'
import { mockSupabaseClient, mockEmail, mockBudget } from '../mocks/supabase.mock'

// Mock dependencies
jest.mock('openai')
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}))

const mockCreateClient = require('@/lib/supabase/server').createClient as jest.MockedFunction<any>

describe('OpenAI Integration Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateClient.mockResolvedValue(mockSupabaseClient)
  })

  describe('Token Counting and Cost Calculation', () => {
    test('countTokens should estimate tokens correctly', () => {
      const text = 'This is a test message with about twenty words in it for token counting'
      const tokenCount = countTokens(text, 'gpt-5-nano')
      expect(tokenCount).toBeGreaterThan(0)
      expect(tokenCount).toBeLessThan(100) // Should be reasonable estimate
    })

    test('calculateCost should calculate cost correctly for different models', () => {
      const promptTokens = 100
      const completionTokens = 50

      const nanoCost = calculateCost(promptTokens, completionTokens, 'gpt-5-nano')
      const miniCost = calculateCost(promptTokens, completionTokens, 'gpt-5-mini')
      const gpt5Cost = calculateCost(promptTokens, completionTokens, 'gpt-5')

      expect(nanoCost).toBeLessThan(miniCost)
      expect(miniCost).toBeLessThan(gpt5Cost)
      expect(nanoCost).toBeGreaterThan(0)
    })

    test('calculateCost should return cost in cents', () => {
      const cost = calculateCost(1000, 500, 'gpt-5-nano')
      expect(Number.isInteger(cost)).toBe(true)
      expect(cost).toBeGreaterThan(0)
    })
  })

  describe('Email Priority Scoring', () => {
    beforeEach(() => {
      // Mock OpenAI client
      const OpenAI = require('openai')
      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue(mockOpenAIResponse)
          }
        }
      }))
    })

    test('scoreEmailPriority should return valid score and reasoning', async () => {
      // Mock database operations
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_usage') {
          return {
            ...mockSupabaseClient,
            insert: jest.fn().mockResolvedValue({ data: null, error: null })
          }
        }
        if (table === 'email_ai_metadata') {
          return {
            ...mockSupabaseClient,
            upsert: jest.fn().mockResolvedValue({ data: null, error: null })
          }
        }
        return mockSupabaseClient
      })

      const result = await scoreEmailPriority(
        'test-user-id',
        'email-123',
        'URGENT: Budget approval needed',
        'boss@company.com',
        'Please review and approve the Q4 budget by EOD today.',
        true,
        false,
        true
      )

      expect(result.score).toBeGreaterThanOrEqual(1)
      expect(result.score).toBeLessThanOrEqual(10)
      expect(typeof result.reasoning).toBe('string')
      expect(result.reasoning.length).toBeGreaterThan(0)
    })

    test('scoreEmailPriority should handle OpenAI API errors gracefully', async () => {
      const OpenAI = require('openai')
      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('API Error'))
          }
        }
      }))

      const result = await scoreEmailPriority(
        'test-user-id',
        'email-123',
        'Test Subject',
        'test@example.com',
        'Test content',
        true,
        true,
        true
      )

      // Should fall back to flag-based scoring
      expect(result.score).toBeGreaterThanOrEqual(1)
      expect(result.score).toBeLessThanOrEqual(10)
      expect(result.reasoning).toContain('AI unavailable')
    })

    test('scoreEmailPriority should use flag-based fallback correctly', async () => {
      const OpenAI = require('openai')
      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('API Error'))
          }
        }
      }))

      // Test with all flags true
      const highPriorityResult = await scoreEmailPriority(
        'test-user-id',
        'email-123',
        'Test',
        'test@example.com',
        'Test',
        true, // important
        true, // starred
        true  // unread
      )

      // Test with no flags
      const lowPriorityResult = await scoreEmailPriority(
        'test-user-id',
        'email-456',
        'Test',
        'test@example.com',
        'Test',
        false, // important
        false, // starred
        false  // unread
      )

      expect(highPriorityResult.score).toBeGreaterThan(lowPriorityResult.score)
    })
  })

  describe('Email Thread Summarization', () => {
    beforeEach(() => {
      const OpenAI = require('openai')
      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue(mockThreadSummaryResponse)
          }
        }
      }))
    })

    test('summarizeEmailThread should return summary and key points', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_usage') {
          return {
            ...mockSupabaseClient,
            insert: jest.fn().mockResolvedValue({ data: null, error: null })
          }
        }
        return mockSupabaseClient
      })

      const emails = [
        {
          subject: 'Budget Discussion',
          from: 'manager@company.com',
          snippet: 'We need to discuss the Q4 budget',
          date: '2024-01-15'
        },
        {
          subject: 'Re: Budget Discussion',
          from: 'finance@company.com',
          snippet: 'Here are the numbers for review',
          date: '2024-01-16'
        }
      ]

      const result = await summarizeEmailThread(
        'test-user-id',
        'thread-123',
        emails
      )

      expect(typeof result.summary).toBe('string')
      expect(result.summary.length).toBeGreaterThan(0)
      expect(Array.isArray(result.keyPoints)).toBe(true)
      expect(result.keyPoints.length).toBeGreaterThan(0)
    })

    test('summarizeEmailThread should handle API errors gracefully', async () => {
      const OpenAI = require('openai')
      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('API Error'))
          }
        }
      }))

      const emails = [
        {
          subject: 'Test Subject',
          from: 'test@example.com',
          snippet: 'Test content',
          date: '2024-01-15'
        }
      ]

      const result = await summarizeEmailThread(
        'test-user-id',
        'thread-123',
        emails
      )

      expect(result.summary).toContain('Thread with')
      expect(result.keyPoints).toHaveLength(1)
      expect(result.keyPoints[0]).toContain('messages')
    })
  })

  describe('Smart Reply Generation', () => {
    beforeEach(() => {
      const OpenAI = require('openai')
      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue(mockSmartRepliesResponse)
          }
        }
      }))
    })

    test('generateSmartReplies should return reply suggestions', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_usage') {
          return {
            ...mockSupabaseClient,
            insert: jest.fn().mockResolvedValue({ data: null, error: null })
          }
        }
        if (table === 'email_ai_metadata') {
          return {
            ...mockSupabaseClient,
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          }
        }
        return mockSupabaseClient
      })

      const result = await generateSmartReplies(
        'test-user-id',
        'email-123',
        'Meeting Request',
        'colleague@company.com',
        'Can we schedule a meeting for next week?'
      )

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(3)
      result.forEach(reply => {
        expect(typeof reply).toBe('string')
        expect(reply.length).toBeGreaterThan(0)
      })
    })

    test('generateSmartReplies should provide fallback replies on API error', async () => {
      const OpenAI = require('openai')
      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('API Error'))
          }
        }
      }))

      const result = await generateSmartReplies(
        'test-user-id',
        'email-123',
        'Test Subject',
        'test@example.com',
        'Test content'
      )

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(3)
      expect(result[0]).toContain('Thank you')
    })
  })

  describe('Budget Checking', () => {
    test('checkBudgetAlerts should return budget status', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_budgets') {
          return {
            ...mockSupabaseClient,
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

      expect(typeof result.dailyUsage).toBe('number')
      expect(typeof result.monthlyUsage).toBe('number')
      expect(typeof result.dailyLimit).toBe('number')
      expect(typeof result.monthlyLimit).toBe('number')
      expect(typeof result.shouldAlert).toBe('boolean')
    })

    test('checkBudgetAlerts should create default budget if none exists', async () => {
      let insertCalled = false
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_budgets') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: null
                })
              })
            }),
            insert: jest.fn().mockImplementation(() => {
              insertCalled = true
              return Promise.resolve({ data: null, error: null })
            })
          }
        }
        return mockSupabaseClient
      })

      const result = await checkBudgetAlerts('test-user-id')

      expect(insertCalled).toBe(true)
      expect(result.dailyUsage).toBe(0)
      expect(result.monthlyUsage).toBe(0)
      expect(result.shouldAlert).toBe(false)
    })

    test('checkBudgetAlerts should detect when budget limits are exceeded', async () => {
      const overBudget = {
        ...mockBudget,
        daily_usage_cents: 90,
        daily_limit_cents: 100,
        alert_at_percent: 80
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_budgets') {
          return {
            ...mockSupabaseClient,
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: overBudget,
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
      expect(result.alertMessage).toContain('90%')
    })
  })
})