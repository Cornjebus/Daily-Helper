/**
 * TEST CONFIGURATION - Phase 4 Testing Infrastructure
 * Jest configuration for integration tests with database setup/teardown
 * Includes Supabase test database management and isolation
 */

import { createClient } from '@supabase/supabase-js'
import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import dotenv from 'dotenv'

// Load test environment variables
dotenv.config({ path: '.env.test' })
dotenv.config({ path: '.env.local' })

// Test database configuration
const TEST_DB_CONFIG = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key',
}

export interface TestDatabase {
  client: any
  serviceClient: any
  cleanup: () => Promise<void>
  reset: () => Promise<void>
  seed: (data?: any) => Promise<void>
}

/**
 * Create test database instance with proper isolation
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  // Create service role client for admin operations
  const serviceClient = createClient(TEST_DB_CONFIG.url, TEST_DB_CONFIG.serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Create anon client for regular operations
  const client = createClient(TEST_DB_CONFIG.url, TEST_DB_CONFIG.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const testDb: TestDatabase = {
    client,
    serviceClient,

    // Clean up all test data
    cleanup: async () => {
      const tables = [
        'ai_usage',
        'email_ai_metadata',
        'email_scores',
        'vip_senders',
        'weekly_digests',
        'email_patterns',
        'user_scoring_preferences',
        'ai_budgets',
        'feed_items',
        'emails',
        'email_threads',
        'gmail_tokens',
        'user_preferences',
      ]

      for (const table of tables) {
        try {
          await serviceClient.from(table).delete().neq('id', 'never-matches')
        } catch (error) {
          // Ignore errors for non-existent tables in some test environments
          console.warn(`Failed to clean table ${table}:`, error)
        }
      }
    },

    // Reset database to clean state
    reset: async () => {
      await testDb.cleanup()

      // Reset any sequences or auto-increment values if needed
      try {
        // Reset materialized view
        await serviceClient.rpc('refresh_user_scoring_patterns')
      } catch (error) {
        // Ignore if function doesn't exist
      }
    },

    // Seed database with test data
    seed: async (seedData = {}) => {
      const {
        users = [],
        emails = [],
        vipSenders = [],
        patterns = [],
        preferences = [],
      } = seedData

      // Seed users (handled by auth system in real tests)
      // Seed emails
      if (emails.length > 0) {
        await serviceClient.from('emails').insert(emails)
      }

      // Seed VIP senders
      if (vipSenders.length > 0) {
        await serviceClient.from('vip_senders').insert(vipSenders)
      }

      // Seed patterns
      if (patterns.length > 0) {
        await serviceClient.from('email_patterns').insert(patterns)
      }

      // Seed preferences
      if (preferences.length > 0) {
        await serviceClient.from('user_scoring_preferences').insert(preferences)
      }
    }
  }

  return testDb
}

/**
 * Test user factory for creating authenticated test users
 */
export async function createTestUser(testDb: TestDatabase, userData: any = {}) {
  const user = {
    id: userData.id || `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    email: userData.email || `test${Date.now()}@example.com`,
    user_metadata: userData.user_metadata || {},
    app_metadata: userData.app_metadata || {},
    ...userData,
  }

  // In a real test environment, you'd create the user via auth
  // For unit tests, we simulate the user existing
  return {
    user,
    session: {
      access_token: 'test-token',
      user,
    },
  }
}

/**
 * Database transaction wrapper for test isolation
 */
export async function withTransaction<T>(
  testDb: TestDatabase,
  fn: (client: any) => Promise<T>
): Promise<T> {
  // Start transaction
  const { data: transaction } = await testDb.serviceClient.rpc('begin_transaction')

  try {
    const result = await fn(testDb.serviceClient)

    // Commit transaction
    await testDb.serviceClient.rpc('commit_transaction')

    return result
  } catch (error) {
    // Rollback transaction
    await testDb.serviceClient.rpc('rollback_transaction')
    throw error
  }
}

/**
 * Wait for async operations to complete
 */
export async function waitForAsyncOps(ms: number = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Performance timer for benchmarking
 */
export class PerformanceTimer {
  private startTime: number = 0
  private endTime: number = 0

  start(): void {
    this.startTime = performance.now()
  }

  stop(): number {
    this.endTime = performance.now()
    return this.endTime - this.startTime
  }

  get duration(): number {
    return this.endTime - this.startTime
  }
}

/**
 * Mock OpenAI API for testing
 */
export function mockOpenAI() {
  const mockScoring = jest.fn().mockResolvedValue({
    score: 7,
    reasoning: 'Mock AI scoring response'
  })

  const mockSummary = jest.fn().mockResolvedValue({
    summary: 'Mock email thread summary',
    keyPoints: ['Point 1', 'Point 2', 'Point 3']
  })

  const mockReplies = jest.fn().mockResolvedValue([
    'Thank you for your message.',
    'I will look into this shortly.',
    'Let me get back to you on this.'
  ])

  // Mock the OpenAI functions
  jest.mock('@/lib/ai/openai', () => ({
    scoreEmailPriority: mockScoring,
    summarizeEmailThread: mockSummary,
    generateSmartReplies: mockReplies,
    checkBudgetAlerts: jest.fn().mockResolvedValue({
      dailyUsage: 0,
      monthlyUsage: 0,
      dailyLimit: 100,
      monthlyLimit: 2000,
      shouldAlert: false,
    }),
    healthCheck: jest.fn().mockResolvedValue({
      status: 'healthy',
      message: 'OpenAI mock is operational',
      details: { apiKey: true, modelAccess: true, responseTime: 50 }
    })
  }))

  return {
    mockScoring,
    mockSummary,
    mockReplies,
  }
}

/**
 * Global test setup for integration tests
 */
export function setupIntegrationTests() {
  let testDb: TestDatabase

  beforeAll(async () => {
    testDb = await createTestDatabase()

    // Verify database connection
    const { data, error } = await testDb.serviceClient.from('emails').select('count(*)').limit(1)
    if (error) {
      console.error('Database connection failed:', error)
      throw new Error('Cannot connect to test database')
    }

    console.log('✅ Test database connected successfully')
  }, 30000)

  afterAll(async () => {
    if (testDb) {
      await testDb.cleanup()
      console.log('✅ Test database cleaned up')
    }
  }, 30000)

  beforeEach(async () => {
    if (testDb) {
      await testDb.reset()
    }
  }, 10000)

  return {
    getTestDb: () => testDb,
  }
}

/**
 * Custom Jest matchers for email testing
 */
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidEmailScore(): R
      toBeValidProcessingTier(): R
      toHaveEmailStructure(): R
      toHaveAIMetadata(): R
      toBeFasterThan(ms: number): R
    }
  }
}

// Add custom matchers
expect.extend({
  toBeValidEmailScore(received: number) {
    const pass = Number.isInteger(received) && received >= 1 && received <= 10
    return {
      message: () => `Expected ${received} to be a valid email score (1-10)`,
      pass,
    }
  },

  toBeValidProcessingTier(received: string) {
    const validTiers = ['high', 'medium', 'low']
    const pass = validTiers.includes(received)
    return {
      message: () => `Expected ${received} to be a valid processing tier (${validTiers.join(', ')})`,
      pass,
    }
  },

  toHaveEmailStructure(received: any) {
    const requiredFields = ['id', 'subject', 'sender', 'received_at']
    const hasAllFields = requiredFields.every(field => field in received)
    return {
      message: () => `Expected email to have required fields: ${requiredFields.join(', ')}`,
      pass: hasAllFields,
    }
  },

  toHaveAIMetadata(received: any) {
    const aiFields = ['priority_score', 'processing_version']
    const hasAIFields = aiFields.some(field => field in received)
    return {
      message: () => `Expected email to have AI metadata fields: ${aiFields.join(', ')}`,
      pass: hasAIFields,
    }
  },

  toBeFasterThan(received: number, expectedMs: number) {
    const pass = received < expectedMs
    return {
      message: () => `Expected operation to complete in less than ${expectedMs}ms, but took ${received}ms`,
      pass,
    }
  },
})

export default {
  createTestDatabase,
  createTestUser,
  withTransaction,
  waitForAsyncOps,
  PerformanceTimer,
  mockOpenAI,
  setupIntegrationTests,
}