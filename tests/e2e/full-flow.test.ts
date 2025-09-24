/**
 * End-to-End Tests for Complete AI Email Processing Flow
 * Tests the full integration from API call through database updates
 */

import { POST } from '@/app/api/ai/process-emails/route'
import { mockSupabaseClient, mockEmail, mockBudget } from '../mocks/supabase.mock'
import { mockOpenAIResponse } from '../mocks/openai.mock'

// Mock all dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}))

jest.mock('openai')

describe('End-to-End AI Email Processing Flow', () => {
  let mockOpenAICreate: jest.MockedFunction<any>

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup OpenAI mock
    const OpenAI = require('openai')
    mockOpenAICreate = jest.fn().mockResolvedValue(mockOpenAIResponse)
    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockOpenAICreate
        }
      }
    }))

    // Setup auth mock
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null
    })
  })

  describe('Complete Processing Flow', () => {
    test('should process email from start to finish successfully', async () => {
      // Track all database operations
      const dbOperations: string[] = []
      let emailUpdated = false
      let feedItemUpdated = false
      let aiUsageTracked = false
      let aiMetadataUpserted = false

      // Mock budget check - within limits
      mockSupabaseClient.from.mockImplementation((table: string) => {
        dbOperations.push(`from(${table})`)

        if (table === 'emails') {
          // First call: fetch emails
          if (dbOperations.filter(op => op === 'from(emails)').length === 1) {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  gte: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: [{ ...mockEmail, email_ai_metadata: [] }], // Unprocessed
                      error: null
                    })
                  })
                })
              })
            }
          }
          // Second call: update email priority
          else {
            return {
              update: jest.fn().mockImplementation((updateData) => {
                expect(updateData.priority).toBe(3) // 11 - 8 = 3
                emailUpdated = true
                return {
                  eq: jest.fn().mockResolvedValue({ data: null, error: null })
                }
              })
            }
          }
        }

        if (table === 'feed_items') {
          return {
            update: jest.fn().mockImplementation((updateData) => {
              expect(updateData.priority).toBe(3)
              expect(updateData.metadata.ai_score).toBe(8)
              expect(updateData.metadata.ai_processed).toBe(true)
              feedItemUpdated = true
              return {
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({ count: 1, error: null })
                })
              }
            })
          }
        }

        if (table === 'ai_usage') {
          return {
            insert: jest.fn().mockImplementation((usageData) => {
              expect(usageData.user_id).toBe('test-user-id')
              expect(usageData.model).toBe(process.env.OPENAI_PREFERRED_MODEL || 'gpt-4o-mini')
              expect(usageData.operation).toBe('email_scoring')
              expect(usageData.context_id).toBe(mockEmail.id)
              aiUsageTracked = true
              return Promise.resolve({ data: null, error: null })
            })
          }
        }

        if (table === 'email_ai_metadata') {
          return {
            upsert: jest.fn().mockImplementation((metadata) => {
              expect(metadata.email_id).toBe(mockEmail.id)
              expect(metadata.priority_score).toBe(8)
              expect(metadata.processing_version).toBe(process.env.OPENAI_PREFERRED_MODEL || 'gpt-4o-mini')
              aiMetadataUpserted = true
              return Promise.resolve({ data: null, error: null })
            })
          }
        }

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

        if (table === 'email_threads') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  gt: jest.fn().mockResolvedValue({
                    data: [], // No threads to process
                    error: null
                  })
                })
              })
            })
          }
        }

        return mockSupabaseClient
      })

      // Execute the full flow
      const response = await POST()
      const responseData = await response.json()

      // Verify response
      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.processed.scored).toBe(1)
      expect(responseData.processed.errors).toBe(0)

      // Verify OpenAI was called correctly
      expect(mockOpenAICreate).toHaveBeenCalledWith({
        model: process.env.OPENAI_PREFERRED_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that helps prioritize emails. Be concise and accurate. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: expect.stringContaining('Score this email\'s priority from 1 to 10')
          }
        ],
        max_tokens: 100,
        response_format: { type: 'json_object' }
      })

      // Verify all database operations completed
      expect(emailUpdated).toBe(true)
      expect(feedItemUpdated).toBe(true)
      expect(aiUsageTracked).toBe(true)
      expect(aiMetadataUpserted).toBe(true)

      // Verify budget information in response
      expect(responseData.budget).toBeDefined()
      expect(responseData.budget.dailyUsed).toBe('$0.50')
      expect(responseData.budget.dailyLimit).toBe('$1.00')
    })

    test('should handle multiple emails in batch processing', async () => {
      const mockEmails = [
        { ...mockEmail, id: 'email-1', subject: 'High Priority Email', email_ai_metadata: [] },
        { ...mockEmail, id: 'email-2', subject: 'Medium Priority Email', email_ai_metadata: [] },
        { ...mockEmail, id: 'email-3', subject: 'Low Priority Email', email_ai_metadata: [] }
      ]

      let processedCount = 0
      let budgetCheckCount = 0

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'emails' && !table.includes('update')) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: mockEmails,
                    error: null
                  })
                })
              })
            }),
            update: jest.fn().mockImplementation(() => {
              processedCount++
              return {
                eq: jest.fn().mockResolvedValue({ data: null, error: null })
              }
            })
          }
        }

        if (table === 'ai_budgets') {
          budgetCheckCount++
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

        if (table === 'feed_items') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ count: 1, error: null })
              })
            })
          }
        }

        if (table === 'ai_usage') {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null })
          }
        }

        if (table === 'email_ai_metadata') {
          return {
            upsert: jest.fn().mockResolvedValue({ data: null, error: null })
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
      expect(responseData.processed.scored).toBe(3)

      // Should check budget initially and after each email
      expect(budgetCheckCount).toBeGreaterThanOrEqual(4) // Initial + 3 emails + final
    })

    test('should stop processing when budget is exceeded mid-flow', async () => {
      const mockEmails = [
        { ...mockEmail, id: 'email-1', email_ai_metadata: [] },
        { ...mockEmail, id: 'email-2', email_ai_metadata: [] },
        { ...mockEmail, id: 'email-3', email_ai_metadata: [] }
      ]

      let processedCount = 0
      let budgetCheckCount = 0

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'emails') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: mockEmails,
                    error: null
                  })
                })
              })
            }),
            update: jest.fn().mockImplementation(() => {
              processedCount++
              return {
                eq: jest.fn().mockResolvedValue({ data: null, error: null })
              }
            })
          }
        }

        if (table === 'ai_budgets') {
          budgetCheckCount++
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: budgetCheckCount === 1 ? mockBudget : {
                    ...mockBudget,
                    daily_usage_cents: 150, // Exceed budget after first email
                    daily_limit_cents: 100
                  },
                  error: null
                })
              })
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

        if (table === 'ai_usage') {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null })
          }
        }

        if (table === 'email_ai_metadata') {
          return {
            upsert: jest.fn().mockResolvedValue({ data: null, error: null })
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
      // Should process first email then stop
      expect(responseData.processed.scored).toBe(1)
    })

    test('should create feed_items when none exist for email', async () => {
      let feedItemCreated = false

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
            insert: jest.fn().mockImplementation((insertData) => {
              expect(insertData.user_id).toBe('test-user-id')
              expect(insertData.external_id).toBe(mockEmail.id)
              expect(insertData.source).toBe('gmail')
              expect(insertData.priority).toBe(3)
              feedItemCreated = true
              return Promise.resolve({ data: null, error: null })
            })
          }
        }

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

        if (table === 'ai_usage') {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null })
          }
        }

        if (table === 'email_ai_metadata') {
          return {
            upsert: jest.fn().mockResolvedValue({ data: null, error: null })
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
      expect(feedItemCreated).toBe(true)
    })

    test('should process email threads when available', async () => {
      const mockThread = {
        id: 'thread-123',
        emails: [
          { subject: 'Budget Discussion', from_email: 'manager@test.com', snippet: 'Initial message', received_at: new Date().toISOString() },
          { subject: 'Re: Budget Discussion', from_email: 'finance@test.com', snippet: 'Follow up', received_at: new Date().toISOString() },
          { subject: 'Re: Budget Discussion', from_email: 'ceo@test.com', snippet: 'Final approval', received_at: new Date().toISOString() },
          { subject: 'Re: Budget Discussion', from_email: 'hr@test.com', snippet: 'Implementation', received_at: new Date().toISOString() }
        ]
      }

      let threadSummarized = false

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'emails') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [], // No emails to process
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
            update: jest.fn().mockImplementation((updateData) => {
              expect(updateData.summary).toContain('Discussion about budget approval')
              threadSummarized = true
              return {
                eq: jest.fn().mockResolvedValue({ data: null, error: null })
              }
            })
          }
        }

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

        if (table === 'ai_usage') {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null })
          }
        }

        return mockSupabaseClient
      })

      // Mock thread summarization
      jest.doMock('@/lib/ai/openai', () => ({
        checkBudgetAlerts: jest.fn().mockResolvedValue({
          dailyUsage: 50,
          monthlyUsage: 500,
          dailyLimit: 100,
          monthlyLimit: 2000,
          shouldAlert: false
        }),
        summarizeEmailThread: jest.fn().mockResolvedValue({
          summary: 'Discussion about budget approval with multiple stakeholders',
          keyPoints: ['Budget approval needed', 'Multiple departments involved']
        })
      }))

      const response = await POST()
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.processed.summarized).toBe(1)
    })
  })
})
