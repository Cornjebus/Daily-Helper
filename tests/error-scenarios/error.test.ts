/**
 * Error Scenarios and Edge Cases Tests
 * Tests various failure modes and recovery mechanisms
 */

import { POST } from '@/app/api/ai/process-emails/route'
import { scoreEmailPriority, checkBudgetAlerts } from '@/lib/ai/openai'
import { mockSupabaseClient, mockEmail, mockBudget } from '../mocks/supabase.mock'

// Mock dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}))

jest.mock('@/lib/ai/openai', () => ({
  scoreEmailPriority: jest.fn(),
  summarizeEmailThread: jest.fn(),
  checkBudgetAlerts: jest.fn()
}))

const mockScoreEmailPriority = scoreEmailPriority as jest.MockedFunction<typeof scoreEmailPriority>
const mockCheckBudgetAlerts = checkBudgetAlerts as jest.MockedFunction<typeof checkBudgetAlerts>

describe('Error Scenarios and Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Default successful auth
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null
    })
  })

  describe('OpenAI API Errors', () => {
    test('should handle OpenAI rate limiting gracefully', async () => {
      mockCheckBudgetAlerts.mockResolvedValue({
        dailyUsage: 50,
        monthlyUsage: 500,
        dailyLimit: 100,
        monthlyLimit: 2000,
        shouldAlert: false
      })

      mockScoreEmailPriority.mockRejectedValue(new Error('Rate limit exceeded'))

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'emails') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [{ ...mockEmail, email_ai_metadata: [] }],
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
                  gt: jest.fn().mockResolvedValue({ data: [], error: null })
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
      expect(responseData.processed.errors).toBe(1)
      expect(responseData.processed.scored).toBe(0)
    })

    test('should handle malformed OpenAI responses', async () => {
      mockCheckBudgetAlerts.mockResolvedValue({
        dailyUsage: 50,
        monthlyUsage: 500,
        dailyLimit: 100,
        monthlyLimit: 2000,
        shouldAlert: false
      })

      // Mock scoreEmailPriority to return invalid score
      mockScoreEmailPriority.mockResolvedValue({
        score: 15, // Invalid score (should be 1-10)
        reasoning: 'Invalid score test'
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'emails') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [{ ...mockEmail, email_ai_metadata: [] }],
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
                  gt: jest.fn().mockResolvedValue({ data: [], error: null })
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
      // Should still process the email with clamped score
      expect(responseData.processed.scored).toBe(1)
    })

    test('should handle OpenAI timeout errors', async () => {
      mockCheckBudgetAlerts.mockResolvedValue({
        dailyUsage: 50,
        monthlyUsage: 500,
        dailyLimit: 100,
        monthlyLimit: 2000,
        shouldAlert: false
      })

      const timeoutError = new Error('Request timeout')
      timeoutError.name = 'TimeoutError'
      mockScoreEmailPriority.mockRejectedValue(timeoutError)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'emails') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [{ ...mockEmail, email_ai_metadata: [] }],
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
                gte: jest.fn().mkReturnValue({
                  gt: jest.fn().mockResolvedValue({ data: [], error: null })
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
      expect(responseData.processed.errors).toBe(1)
    })
  })

  describe('Database Connection Errors', () => {
    test('should handle database connection failures', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Database connection failed'))

      const response = await POST()

      expect(response.status).toBe(500)
      const responseData = await response.json()
      expect(responseData.error).toBe('AI processing failed')
      expect(responseData.details).toBe('Database connection failed')
    })

    test('should handle email fetch errors', async () => {
      mockCheckBudgetAlerts.mockResolvedValue({
        dailyUsage: 50,
        monthlyUsage: 500,
        dailyLimit: 100,
        monthlyLimit: 2000,
        shouldAlert: false
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'emails') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Permission denied', code: 'PGRST301' }
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

    test('should handle feed_items creation errors gracefully', async () => {
      mockCheckBudgetAlerts.mockResolvedValue({
        dailyUsage: 50,
        monthlyUsage: 500,
        dailyLimit: 100,
        monthlyLimit: 2000,
        shouldAlert: false
      })

      mockScoreEmailPriority.mockResolvedValue({
        score: 8,
        reasoning: 'High priority test'
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'emails') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [{ ...mockEmail, email_ai_metadata: [] }],
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
        if (table === 'feed_items') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ count: 0, error: null }) // No existing item
              })
            }),
            insert: jest.fn().mockRejectedValue(new Error('Foreign key constraint violation'))
          }
        }
        if (table === 'email_threads') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  gt: jest.fn().mockResolvedValue({ data: [], error: null })
                })
              })
            })
          }
        }
        return mockSupabaseClient
      })

      const response = await POST()
      const responseData = await response.json()

      // Should still succeed overall even if feed_items creation fails
      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.processed.scored).toBe(1)
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty email list', async () => {
      mockCheckBudgetAlerts.mockResolvedValue({
        dailyUsage: 50,
        monthlyUsage: 500,
        dailyLimit: 100,
        monthlyLimit: 2000,
        shouldAlert: false
      })

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
                  gt: jest.fn().mockResolvedValue({ data: [], error: null })
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
      expect(responseData.processed.scored).toBe(0)
      expect(responseData.processed.errors).toBe(0)
    })

    test('should handle emails with missing/null fields', async () => {
      const incompleteEmail = {
        ...mockEmail,
        subject: null,
        from_email: null,
        snippet: null,
        email_ai_metadata: []
      }

      mockCheckBudgetAlerts.mockResolvedValue({
        dailyUsage: 50,
        monthlyUsage: 500,
        dailyLimit: 100,
        monthlyLimit: 2000,
        shouldAlert: false
      })

      mockScoreEmailPriority.mockResolvedValue({
        score: 5,
        reasoning: 'Default priority for incomplete email'
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'emails') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [incompleteEmail],
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
                  gt: jest.fn().mockResolvedValue({ data: [], error: null })
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

      // Verify that scoreEmailPriority was called with empty string defaults
      expect(mockScoreEmailPriority).toHaveBeenCalledWith(
        'test-user-id',
        incompleteEmail.id,
        '', // null subject becomes empty string
        '', // null from_email becomes empty string
        '', // null snippet becomes empty string
        incompleteEmail.is_important,
        incompleteEmail.is_starred,
        incompleteEmail.is_unread
      )
    })

    test('should handle extremely long email content', async () => {
      const longEmail = {
        ...mockEmail,
        subject: 'A'.repeat(1000), // Very long subject
        snippet: 'B'.repeat(5000), // Very long snippet
        email_ai_metadata: []
      }

      mockCheckBudgetAlerts.mockResolvedValue({
        dailyUsage: 50,
        monthlyUsage: 500,
        dailyLimit: 100,
        monthlyLimit: 2000,
        shouldAlert: false
      })

      mockScoreEmailPriority.mockResolvedValue({
        score: 6,
        reasoning: 'Processed long email'
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'emails') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [longEmail],
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
                  gt: jest.fn().mockResolvedValue({ data: [], error: null })
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
    })

    test('should handle concurrent requests gracefully', async () => {
      mockCheckBudgetAlerts.mockResolvedValue({
        dailyUsage: 50,
        monthlyUsage: 500,
        dailyLimit: 100,
        monthlyLimit: 2000,
        shouldAlert: false
      })

      mockScoreEmailPriority.mockResolvedValue({
        score: 7,
        reasoning: 'Concurrent test'
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'emails') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [{ ...mockEmail, email_ai_metadata: [] }],
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
                  gt: jest.fn().mockResolvedValue({ data: [], error: null })
                })
              })
            })
          }
        }
        return mockSupabaseClient
      })

      // Make multiple concurrent requests
      const promises = Array(5).fill(null).map(() => POST())
      const responses = await Promise.all(promises)

      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })

  describe('Budget Edge Cases', () => {
    test('should handle budget check failures', async () => {
      mockCheckBudgetAlerts.mockRejectedValue(new Error('Budget service unavailable'))

      const response = await POST()

      expect(response.status).toBe(500)
      const responseData = await response.json()
      expect(responseData.error).toBe('AI processing failed')
    })

    test('should handle zero budget limits', async () => {
      mockCheckBudgetAlerts.mockResolvedValue({
        dailyUsage: 0,
        monthlyUsage: 0,
        dailyLimit: 0,
        monthlyLimit: 0,
        shouldAlert: true
      })

      const response = await POST()

      expect(response.status).toBe(429)
      const responseData = await response.json()
      expect(responseData.error).toBe('Daily AI budget exceeded')
    })
  })
})