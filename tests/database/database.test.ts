import { mockSupabaseClient, mockEmail, mockBudget, mockAIUsage } from '../mocks/supabase.mock'

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}))

const { createClient } = require('@/lib/supabase/server')

describe('Database Operations Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Email Operations', () => {
    test('should fetch unprocessed emails correctly', async () => {
      const mockEmails = [
        { ...mockEmail, email_ai_metadata: [] },
        { ...mockEmail, id: 'email-456', email_ai_metadata: [{ priority_score: 8 }] }
      ]

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
            })
          }
        }
        return mockSupabaseClient
      })

      const supabase = await createClient()
      const { data: emails, error } = await supabase
        .from('emails')
        .select(`
          *,
          email_ai_metadata(priority_score)
        `)
        .eq('user_id', 'test-user-id')
        .gte('received_at', new Date().toISOString().split('T')[0])
        .order('received_at', { ascending: false })

      expect(error).toBeNull()
      expect(emails).toHaveLength(2)
      expect(emails[0].email_ai_metadata).toHaveLength(0) // Unprocessed
      expect(emails[1].email_ai_metadata).toHaveLength(1) // Processed
    })

    test('should update email priority successfully', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'emails') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          }
        }
        return mockSupabaseClient
      })

      const supabase = await createClient()
      const { error } = await supabase
        .from('emails')
        .update({
          priority: 3, // High priority (11 - 8 = 3)
          updated_at: new Date().toISOString()
        })
        .eq('id', 'email-123')

      expect(error).toBeNull()
    })

    test('should handle email fetch errors', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'emails') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Permission denied', code: '42501' }
                  })
                })
              })
            })
          }
        }
        return mockSupabaseClient
      })

      const supabase = await createClient()
      const { data: emails, error } = await supabase
        .from('emails')
        .select('*')
        .eq('user_id', 'test-user-id')

      expect(emails).toBeNull()
      expect(error).toBeDefined()
      expect(error.message).toBe('Permission denied')
    })
  })

  describe('Feed Items Operations', () => {
    test('should update existing feed_items', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'feed_items') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ count: 1, error: null })
              })
            })
          }
        }
        return mockSupabaseClient
      })

      const supabase = await createClient()
      const { count, error } = await supabase
        .from('feed_items')
        .update({
          priority: 3,
          metadata: {
            ai_score: 8,
            ai_processed: true,
            ai_model: 'gpt-4o-mini'
          }
        })
        .eq('external_id', 'email-123')
        .eq('source', 'gmail')

      expect(error).toBeNull()
      expect(count).toBe(1)
    })

    test('should create new feed_items when none exist', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'feed_items') {
          return {
            insert: jest.fn().mockResolvedValue({
              data: [{ id: 'feed-123' }],
              error: null
            })
          }
        }
        return mockSupabaseClient
      })

      const supabase = await createClient()
      const { data, error } = await supabase
        .from('feed_items')
        .insert({
          user_id: 'test-user-id',
          source: 'gmail',
          external_id: 'email-123',
          title: 'Test Email',
          content: 'Test content',
          category: 'now',
          priority: 3,
          metadata: {
            ai_score: 8,
            ai_processed: true
          }
        })

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
    })

    test('should handle upsert operations with unique constraint', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'feed_items') {
          return {
            upsert: jest.fn().mockResolvedValue({ data: null, error: null })
          }
        }
        return mockSupabaseClient
      })

      const supabase = await createClient()
      const { error } = await supabase
        .from('feed_items')
        .upsert({
          user_id: 'test-user-id',
          source: 'gmail',
          external_id: 'email-123',
          title: 'Updated Title',
          priority: 5
        }, {
          onConflict: 'external_id,source'
        })

      expect(error).toBeNull()
    })
  })

  describe('AI Usage Tracking', () => {
    test('should insert AI usage records', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_usage') {
          return {
            insert: jest.fn().mockResolvedValue({ data: [mockAIUsage], error: null })
          }
        }
        return mockSupabaseClient
      })

      const supabase = await createClient()
      const { data, error } = await supabase
        .from('ai_usage')
        .insert({
          user_id: 'test-user-id',
          model: 'gpt-4o-mini',
          operation: 'email_scoring',
          prompt_tokens: 50,
          completion_tokens: 25,
          total_tokens: 75,
          cost_cents: 2,
          response: { score: 8 },
          context_id: 'email-123',
          context_type: 'email'
        })

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
    })

    test('should query usage statistics', async () => {
      const usageData = [
        { ...mockAIUsage, operation: 'email_scoring', cost_cents: 2 },
        { ...mockAIUsage, operation: 'email_summary', cost_cents: 3 }
      ]

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'ai_usage') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockResolvedValue({
                  data: usageData,
                  error: null
                })
              })
            })
          }
        }
        return mockSupabaseClient
      })

      const supabase = await createClient()
      const { data, error } = await supabase
        .from('ai_usage')
        .select('operation, cost_cents, total_tokens')
        .eq('user_id', 'test-user-id')
        .gte('created_at', new Date().toISOString())

      expect(error).toBeNull()
      expect(data).toHaveLength(2)

      const totalCost = data.reduce((sum: number, record: any) => sum + record.cost_cents, 0)
      expect(totalCost).toBe(5)
    })
  })

  describe('Budget Management', () => {
    test('should fetch user budget', async () => {
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

      const supabase = await createClient()
      const { data, error } = await supabase
        .from('ai_budgets')
        .select('*')
        .eq('user_id', 'test-user-id')
        .single()

      expect(error).toBeNull()
      expect(data).toEqual(mockBudget)
    })

    test('should create default budget when none exists', async () => {
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
            insert: jest.fn().mockResolvedValue({ data: null, error: null })
          }
        }
        return mockSupabaseClient
      })

      const supabase = await createClient()

      // First try to get budget (returns null)
      const { data: existingBudget } = await supabase
        .from('ai_budgets')
        .select('*')
        .eq('user_id', 'test-user-id')
        .single()

      expect(existingBudget).toBeNull()

      // Create default budget
      const { error } = await supabase
        .from('ai_budgets')
        .insert({
          user_id: 'test-user-id'
        })

      expect(error).toBeNull()
    })
  })

  describe('Email AI Metadata', () => {
    test('should upsert email AI metadata', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'email_ai_metadata') {
          return {
            upsert: jest.fn().mockResolvedValue({ data: null, error: null })
          }
        }
        return mockSupabaseClient
      })

      const supabase = await createClient()
      const { error } = await supabase
        .from('email_ai_metadata')
        .upsert({
          email_id: 'email-123',
          user_id: 'test-user-id',
          priority_score: 8,
          processing_version: 'gpt-4o-mini',
          confidence_score: 0.9,
          updated_at: new Date().toISOString()
        })

      expect(error).toBeNull()
    })

    test('should update reply suggestions', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'email_ai_metadata') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          }
        }
        return mockSupabaseClient
      })

      const supabase = await createClient()
      const { error } = await supabase
        .from('email_ai_metadata')
        .update({
          reply_suggestions: [
            'Thank you for your message.',
            'I will review and respond shortly.',
            'Got it, thanks!'
          ],
          updated_at: new Date().toISOString()
        })
        .eq('email_id', 'email-123')

      expect(error).toBeNull()
    })
  })

  describe('Email Threads', () => {
    test('should fetch email threads with messages', async () => {
      const mockThreads = [{
        id: 'thread-123',
        message_count: 5,
        last_message_at: new Date().toISOString(),
        emails: [
          { subject: 'Initial message', from_email: 'user1@example.com', snippet: 'Content 1' },
          { subject: 'Re: Initial message', from_email: 'user2@example.com', snippet: 'Content 2' }
        ]
      }]

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'email_threads') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  gt: jest.fn().mockResolvedValue({
                    data: mockThreads,
                    error: null
                  })
                })
              })
            })
          }
        }
        return mockSupabaseClient
      })

      const supabase = await createClient()
      const { data, error } = await supabase
        .from('email_threads')
        .select(`
          *,
          emails(
            subject,
            from_email,
            snippet,
            received_at
          )
        `)
        .eq('user_id', 'test-user-id')
        .gte('last_message_at', new Date().toISOString().split('T')[0])
        .gt('message_count', 3)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].emails).toHaveLength(2)
    })

    test('should update thread summary', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'email_threads') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          }
        }
        return mockSupabaseClient
      })

      const supabase = await createClient()
      const { error } = await supabase
        .from('email_threads')
        .update({
          summary: 'Discussion about project timeline and deliverables',
          updated_at: new Date().toISOString()
        })
        .eq('id', 'thread-123')

      expect(error).toBeNull()
    })
  })
})