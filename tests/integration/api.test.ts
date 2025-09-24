import { NextRequest } from 'next/server'
import { POST, GET } from '@/app/api/ai/process-emails/route'
import { mockSupabaseClient, mockEmail, mockBudget } from '../mocks/supabase.mock'
import { mockOpenAIResponse } from '../mocks/openai.mock'

// Mock dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}))

jest.mock('@/lib/ai/openai', () => ({
  scoreEmailPriority: jest.fn(),
  summarizeEmailThread: jest.fn(),
  checkBudgetAlerts: jest.fn()
}))

const mockScoreEmailPriority = require('@/lib/ai/openai').scoreEmailPriority as jest.MockedFunction<any>
const mockSummarizeEmailThread = require('@/lib/ai/openai').summarizeEmailThread as jest.MockedFunction<any>
const mockCheckBudgetAlerts = require('@/lib/ai/openai').checkBudgetAlerts as jest.MockedFunction<any>

describe('AI Process Emails API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Default mock responses
    mockCheckBudgetAlerts.mockResolvedValue({
      dailyUsage: 50,
      monthlyUsage: 500,
      dailyLimit: 100,
      monthlyLimit: 2000,
      shouldAlert: false
    })

    mockScoreEmailPriority.mockResolvedValue({
      score: 8,
      reasoning: 'High priority email with urgent deadline'
    })

    mockSummarizeEmailThread.mockResolvedValue({
      summary: 'Thread about budget approval process',
      keyPoints: ['Budget approval needed', 'EOD deadline', 'Multiple stakeholders']
    })
  })

  describe('POST /api/ai/process-emails', () => {
    test('should authenticate user successfully', async () => {
      // Mock successful authentication
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })

      // Mock empty emails list to avoid processing
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'emails') {
          return {
            ...mockSupabaseClient,
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null
                  })
                })
              })
            })
          }
        }
        return mockSupabaseClient
      })

      const response = await POST()
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
    })

    test('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      const response = await POST()

      expect(response.status).toBe(401)
      const responseData = await response.json()
      expect(responseData.error).toBe('Not authenticated')
    })

    test('should return 401 when authentication fails', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      })

      const response = await POST()

      expect(response.status).toBe(401)
      const responseData = await response.json()
      expect(responseData.error).toBe('Authentication failed')
    })

    test('should return 429 when daily budget is exceeded', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })

      mockCheckBudgetAlerts.mockResolvedValue({
        dailyUsage: 150, // Over budget
        monthlyUsage: 500,
        dailyLimit: 100,
        monthlyLimit: 2000,
        shouldAlert: true
      })

      const response = await POST()

      expect(response.status).toBe(429)
      const responseData = await response.json()
      expect(responseData.error).toBe('Daily AI budget exceeded')
    })

    test('should process emails successfully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })

      // Mock emails to process
      const testEmails = [{
        ...mockEmail,
        email_ai_metadata: [] // Unprocessed
      }]

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'emails') {
          if (mockSupabaseClient.from.mock.calls[mockSupabaseClient.from.mock.calls.length - 1]?.[0] === 'emails') {
            // First call - fetch emails
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  gte: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: testEmails,
                      error: null
                    })
                  })
                })
              }),
              // Second call - update email
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: null, error: null })
              })
            }
          }
        }
        if (table === 'feed_items') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ count: 1, error: null })
              })
            })
          }
        }
        if (table === 'email_threads') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  gt: jest.fn().mockResolvedValue({
                    data: [],
                    error: null
                  })
                })
              })
            })
          }
        }
        return mockSupabaseClient
      })

      const response = await POST()
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.processed.scored).toBe(1)
      expect(mockScoreEmailPriority).toHaveBeenCalledWith(
        'test-user-id',
        mockEmail.id,
        mockEmail.subject,
        mockEmail.from_email,
        mockEmail.snippet,
        mockEmail.is_important,
        mockEmail.is_starred,
        mockEmail.is_unread
      )
    })

    test('should handle database errors gracefully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'emails') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Database connection failed' }
                  })
                })
              })
            })
          }
        }
        return mockSupabaseClient
      })

      const response = await POST()

      expect(response.status).toBe(500)
      const responseData = await response.json()
      expect(responseData.error).toBe('AI processing failed')
    })

    test('should process email threads when available', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })

      // Mock thread data
      const mockThread = {
        id: 'thread-123',
        emails: [
          { subject: 'Test 1', from_email: 'test@example.com', snippet: 'Content 1', received_at: new Date().toISOString() },
          { subject: 'Re: Test 1', from_email: 'test2@example.com', snippet: 'Content 2', received_at: new Date().toISOString() },
          { subject: 'Re: Test 1', from_email: 'test3@example.com', snippet: 'Content 3', received_at: new Date().toISOString() },
          { subject: 'Re: Test 1', from_email: 'test4@example.com', snippet: 'Content 4', received_at: new Date().toISOString() }
        ]
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'emails') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null
                  })
                })
              })
            })
          }
        }
        if (table === 'email_threads') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  gt: jest.fn().mockResolvedValue({
                    data: [mockThread],
                    error: null
                  })
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          }
        }
        return mockSupabaseClient
      })

      const response = await POST()
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.processed.summarized).toBe(1)
      expect(mockSummarizeEmailThread).toHaveBeenCalledWith(
        'test-user-id',
        mockThread.id,
        expect.any(Array)
      )
    })
  })

  describe('GET /api/ai/process-emails', () => {
    test('should return AI usage statistics', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })

      mockCheckBudgetAlerts.mockResolvedValue({
        dailyUsage: 50,
        monthlyUsage: 500,
        dailyLimit: 100,
        monthlyLimit: 2000,
        shouldAlert: false
      })

      // Mock usage data
      const todayUsage = [
        { operation: 'email_scoring', cost_cents: 2, total_tokens: 75 },
        { operation: 'email_summary', cost_cents: 3, total_tokens: 150 }
      ]

      const monthUsage = [
        { operation: 'email_scoring', cost_cents: 20, total_tokens: 750 },
        { operation: 'email_summary', cost_cents: 30, total_tokens: 1500 }
      ]

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_usage') {
          // Check if this is the today query or month query based on select fields
          const selectCall = mockSupabaseClient.select.mock.calls.find(call =>
            call[0] && call[0].includes('operation, cost_cents, total_tokens')
          )

          if (selectCall) {
            // Month query
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  gte: jest.fn().mockResolvedValue({
                    data: monthUsage,
                    error: null
                  })
                })
              })
            }
          } else {
            // Today query
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  gte: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: todayUsage,
                      error: null
                    })
                  })
                })
              })
            }
          }
        }
        return mockSupabaseClient
      })

      const response = await GET()
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.today.operations).toBe(2)
      expect(responseData.month.operations).toBe(2)
      expect(responseData.today.cost).toBe('$0.50')
      expect(responseData.month.cost).toBe('$5.00')
      expect(responseData.month.tokens).toBe(2250)
    })

    test('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      const response = await GET()

      expect(response.status).toBe(401)
      const responseData = await response.json()
      expect(responseData.error).toBe('Not authenticated')
    })

    test('should handle database errors in GET request', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })

      mockCheckBudgetAlerts.mockRejectedValue(new Error('Database error'))

      const response = await GET()

      expect(response.status).toBe(500)
      const responseData = await response.json()
      expect(responseData.error).toBe('Failed to get AI stats')
    })
  })
})