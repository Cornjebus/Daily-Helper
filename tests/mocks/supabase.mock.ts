// Mock Supabase client and responses
export const mockSupabaseResponse = {
  data: null,
  error: null,
  status: 200,
  statusText: 'OK'
}

export const mockSupabaseClient = {
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null
    })
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  then: jest.fn().mockResolvedValue(mockSupabaseResponse)
}

// Mock test data
export const mockEmail = {
  id: 'email-123',
  user_id: 'test-user-id',
  gmail_id: 'gmail-123',
  thread_id: 'thread-123',
  subject: 'Test Email Subject',
  from_name: 'John Doe',
  from_email: 'john@example.com',
  to_emails: ['user@example.com'],
  snippet: 'This is a test email snippet for priority scoring',
  is_important: true,
  is_starred: false,
  is_unread: true,
  received_at: new Date().toISOString(),
  priority: null
}

export const mockBudget = {
  user_id: 'test-user-id',
  daily_usage_cents: 50,
  monthly_usage_cents: 500,
  daily_limit_cents: 100,
  monthly_limit_cents: 2000,
  alert_at_percent: 80
}

export const mockAIUsage = {
  user_id: 'test-user-id',
  model: 'gpt-5-nano',
  operation: 'email_scoring',
  prompt_tokens: 50,
  completion_tokens: 25,
  total_tokens: 75,
  cost_cents: 2,
  response: { score: 8, reasoning: 'Test reasoning' },
  context_id: 'email-123',
  context_type: 'email'
}