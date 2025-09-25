import { createClient } from '@/lib/supabase/server'
import {
  scoreEmailPriority,
  summarizeEmailThread,
  generateSmartReplies,
  checkBudgetAlerts,
  healthCheck as aiHealthCheck
} from '@/lib/ai/openai'
import { handleApiError } from '@/src/lib/utils/error-handling'

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  message: string
  details: Record<string, any>
  timestamp: string
}

export interface EmailProcessingResult {
  emailId: string
  priorityScore?: number
  reasoning?: string
  smartReplies?: string[]
  error?: string
}

export interface ThreadSummaryResult {
  threadId: string
  summary?: string
  keyPoints?: string[]
  error?: string
}

export interface BudgetStatus {
  dailyUsage: number
  monthlyUsage: number
  dailyLimit: number
  monthlyLimit: number
  shouldAlert: boolean
  alertMessage?: string
}

export class IntegrationService {
  private static instance: IntegrationService
  private supabase: any

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): IntegrationService {
    if (!IntegrationService.instance) {
      IntegrationService.instance = new IntegrationService()
    }
    return IntegrationService.instance
  }

  private async getSupabaseClient() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    return this.supabase
  }

  // Health check for all integrated services
  async checkSystemHealth(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy'
    services: Record<string, ServiceHealth>
    timestamp: string
  }> {
    try {
      const checks = await Promise.allSettled([
        this.checkDatabaseHealth(),
        this.checkAIServiceHealth(),
        this.checkEmailServiceHealth()
      ])

      const services: Record<string, ServiceHealth> = {}
      const timestamp = new Date().toISOString()

      // Process database health
      if (checks[0].status === 'fulfilled') {
        services.database = checks[0].value
      } else {
        services.database = {
          status: 'unhealthy',
          message: 'Database health check failed',
          details: { error: checks[0].reason?.message || 'Unknown error' },
          timestamp
        }
      }

      // Process AI service health
      if (checks[1].status === 'fulfilled') {
        services.ai = checks[1].value
      } else {
        services.ai = {
          status: 'unhealthy',
          message: 'AI service health check failed',
          details: { error: checks[1].reason?.message || 'Unknown error' },
          timestamp
        }
      }

      // Process email service health
      if (checks[2].status === 'fulfilled') {
        services.email = checks[2].value
      } else {
        services.email = {
          status: 'unhealthy',
          message: 'Email service health check failed',
          details: { error: checks[2].reason?.message || 'Unknown error' },
          timestamp
        }
      }

      // Determine overall health
      const statuses = Object.values(services).map(s => s.status)
      let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

      if (statuses.includes('unhealthy')) {
        overall = 'unhealthy'
      } else if (statuses.includes('degraded')) {
        overall = 'degraded'
      }

      return { overall, services, timestamp }

    } catch (error) {
      console.error('❌ System health check failed:', error)
      return {
        overall: 'unhealthy',
        services: {},
        timestamp: new Date().toISOString()
      }
    }
  }

  private async checkDatabaseHealth(): Promise<ServiceHealth> {
    const startTime = Date.now()
    const timestamp = new Date().toISOString()

    try {
      const supabase = await this.getSupabaseClient()

      // Test basic connectivity
      const { error } = await supabase.from('emails').select('id').limit(1)

      if (error) {
        throw error
      }

      const responseTime = Date.now() - startTime

      return {
        status: responseTime > 2000 ? 'degraded' : 'healthy',
        message: `Database operational (${responseTime}ms)`,
        details: {
          responseTime,
          connection: true
        },
        timestamp
      }
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: `Database connection failed: ${error.message}`,
        details: {
          error: error.message,
          responseTime: Date.now() - startTime
        },
        timestamp
      }
    }
  }

  private async checkAIServiceHealth(): Promise<ServiceHealth> {
    const timestamp = new Date().toISOString()

    try {
      const healthResult = await aiHealthCheck()
      return {
        ...healthResult,
        timestamp
      }
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: `AI service check failed: ${error.message}`,
        details: { error: error.message },
        timestamp
      }
    }
  }

  private async checkEmailServiceHealth(): Promise<ServiceHealth> {
    const startTime = Date.now()
    const timestamp = new Date().toISOString()

    try {
      const supabase = await this.getSupabaseClient()

      // Test email-related table access
      const { data, error } = await supabase
        .from('emails')
        .select('count')
        .limit(1)

      if (error) {
        throw error
      }

      const responseTime = Date.now() - startTime

      return {
        status: responseTime > 1000 ? 'degraded' : 'healthy',
        message: `Email service operational (${responseTime}ms)`,
        details: {
          responseTime,
          emailAccess: true
        },
        timestamp
      }
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: `Email service failed: ${error.message}`,
        details: {
          error: error.message,
          responseTime: Date.now() - startTime
        },
        timestamp
      }
    }
  }

  // Comprehensive email processing with coordination
  async processEmailsBatch(
    userId: string,
    emailIds?: string[],
    options: {
      maxEmails?: number
      includeReplies?: boolean
      priorityThreshold?: number
    } = {}
  ): Promise<{
    results: EmailProcessingResult[]
    summary: {
      processed: number
      succeeded: number
      failed: number
      averageScore?: number
    }
    budget: BudgetStatus
  }> {
    try {
      console.log('🚀 Starting batch email processing for user:', userId)
      const supabase = await this.getSupabaseClient()

      // Get emails to process
      let query = supabase
        .from('emails')
        .select(`
          *,
          email_ai_metadata(priority_score)
        `)
        .eq('user_id', userId)
        .order('received_at', { ascending: false })

      if (emailIds?.length) {
        query = query.in('id', emailIds)
      } else {
        query = query.limit(options.maxEmails || 10)
      }

      const { data: emails, error } = await query

      if (error) {
        throw error
      }

      // Filter unprocessed emails
      const unprocessedEmails = emails?.filter(
        email => !email.email_ai_metadata?.length
      ) || []

      console.log(`📧 Processing ${unprocessedEmails.length} emails`)

      // Process emails concurrently with rate limiting
      const results: EmailProcessingResult[] = []
      const batchSize = 3 // Process 3 emails at a time to avoid rate limits

      for (let i = 0; i < unprocessedEmails.length; i += batchSize) {
        const batch = unprocessedEmails.slice(i, i + batchSize)

        const batchPromises = batch.map(async (email) => {
          try {
            // Score email priority
            const { score, reasoning } = await scoreEmailPriority(
              userId,
              email.id,
              email.subject || '',
              email.from_email || '',
              email.snippet || '',
              email.is_important || false,
              email.is_starred || false,
              email.is_unread || false
            )

            let smartReplies: string[] = []

            // Generate smart replies if requested and email meets criteria
            if (options.includeReplies && score >= (options.priorityThreshold || 7)) {
              try {
                smartReplies = await generateSmartReplies(
                  userId,
                  email.id,
                  email.subject || '',
                  email.from_email || '',
                  email.snippet || ''
                )
              } catch (replyError) {
                console.warn(`⚠️ Smart reply generation failed for ${email.id}:`, replyError)
              }
            }

            // Update email priority
            await supabase
              .from('emails')
              .update({
                priority: Math.round(11 - score),
                updated_at: new Date().toISOString(),
              })
              .eq('id', email.id)

            return {
              emailId: email.id,
              priorityScore: score,
              reasoning,
              ...(smartReplies.length > 0 && { smartReplies })
            }
          } catch (error: any) {
            console.error(`❌ Error processing email ${email.id}:`, error)
            return {
              emailId: email.id,
              error: error.message
            }
          }
        })

        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)

        // Small delay between batches
        if (i + batchSize < unprocessedEmails.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      // Calculate summary statistics
      const succeeded = results.filter(r => !r.error).length
      const failed = results.filter(r => r.error).length
      const scores = results.filter(r => r.priorityScore).map(r => r.priorityScore!)
      const averageScore = scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : undefined

      // Get budget status
      const budget = await checkBudgetAlerts(userId)

      console.log('✅ Batch processing complete:', {
        processed: results.length,
        succeeded,
        failed,
        averageScore: averageScore?.toFixed(2)
      })

      return {
        results,
        summary: {
          processed: results.length,
          succeeded,
          failed,
          averageScore
        },
        budget
      }

    } catch (error: any) {
      console.error('❌ Batch processing failed:', error)
      throw handleApiError(error, 'Email batch processing failed')
    }
  }

  // Thread summarization with coordination
  async processEmailThreads(
    userId: string,
    options: {
      minMessages?: number
      dateFilter?: string
      maxThreads?: number
    } = {}
  ): Promise<{
    results: ThreadSummaryResult[]
    summary: {
      processed: number
      succeeded: number
      failed: number
    }
  }> {
    try {
      console.log('🧵 Starting thread processing for user:', userId)
      const supabase = await this.getSupabaseClient()

      // Build date filter
      const dateFilter = options.dateFilter || new Date().toISOString().split('T')[0]

      const { data: threads, error } = await supabase
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
        .eq('user_id', userId)
        .gte('last_message_at', dateFilter)
        .gt('message_count', options.minMessages || 3)
        .limit(options.maxThreads || 10)

      if (error) {
        throw error
      }

      console.log(`📧 Processing ${threads?.length || 0} threads`)

      // Process threads
      const results: ThreadSummaryResult[] = []

      for (const thread of threads || []) {
        if (thread.emails && thread.emails.length > 3) {
          try {
            const { summary, keyPoints } = await summarizeEmailThread(
              userId,
              thread.id,
              thread.emails.map((e: any) => ({
                subject: e.subject,
                from: e.from_email,
                snippet: e.snippet,
                date: new Date(e.received_at).toLocaleDateString(),
              }))
            )

            // Update thread with summary
            await supabase
              .from('email_threads')
              .update({
                summary,
                updated_at: new Date().toISOString(),
              })
              .eq('id', thread.id)

            results.push({
              threadId: thread.id,
              summary,
              keyPoints
            })
          } catch (error: any) {
            console.error(`❌ Error summarizing thread ${thread.id}:`, error)
            results.push({
              threadId: thread.id,
              error: error.message
            })
          }
        }
      }

      const succeeded = results.filter(r => !r.error).length
      const failed = results.filter(r => r.error).length

      console.log('✅ Thread processing complete:', { processed: results.length, succeeded, failed })

      return {
        results,
        summary: {
          processed: results.length,
          succeeded,
          failed
        }
      }

    } catch (error: any) {
      console.error('❌ Thread processing failed:', error)
      throw handleApiError(error, 'Email thread processing failed')
    }
  }

  // Comprehensive user onboarding
  async initializeUserServices(userId: string): Promise<{
    success: boolean
    services: {
      database: boolean
      ai: boolean
      email: boolean
      budget: boolean
    }
    errors?: string[]
  }> {
    console.log('🚀 Initializing services for user:', userId)
    const errors: string[] = []
    const services = {
      database: false,
      ai: false,
      email: false,
      budget: false
    }

    try {
      const supabase = await this.getSupabaseClient()

      // Verify user exists and is authenticated
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user || user.user?.id !== userId) {
        throw new Error('User authentication failed')
      }
      services.database = true

      // Initialize AI budget
      try {
        await checkBudgetAlerts(userId)
        services.budget = true
      } catch (error: any) {
        errors.push(`Budget initialization failed: ${error.message}`)
      }

      // Test AI service
      try {
        await aiHealthCheck()
        services.ai = true
      } catch (error: any) {
        errors.push(`AI service test failed: ${error.message}`)
      }

      // Verify email access
      try {
        await supabase.from('emails').select('id').eq('user_id', userId).limit(1)
        services.email = true
      } catch (error: any) {
        errors.push(`Email service test failed: ${error.message}`)
      }

      const success = Object.values(services).every(s => s)

      console.log('✅ User initialization complete:', { success, services })

      return { success, services, ...(errors.length > 0 && { errors }) }

    } catch (error: any) {
      console.error('❌ User initialization failed:', error)
      errors.push(`Initialization failed: ${error.message}`)

      return { success: false, services, errors }
    }
  }

  // Get comprehensive analytics
  async getAnalytics(
    userId: string,
    timeframe: '24h' | '7d' | '30d' = '30d'
  ): Promise<{
    emails: {
      total: number
      processed: number
      averagePriority: number
      unreadCount: number
    }
    threads: {
      total: number
      summarized: number
      averageLength: number
    }
    ai: {
      operations: number
      costCents: number
      tokensUsed: number
    }
    performance: {
      averageProcessingTime: number
      successRate: number
    }
  }> {
    try {
      const supabase = await this.getSupabaseClient()

      // Calculate time boundaries
      const now = new Date()
      const start = new Date()

      switch (timeframe) {
        case '24h':
          start.setHours(start.getHours() - 24)
          break
        case '7d':
          start.setDate(start.getDate() - 7)
          break
        case '30d':
          start.setDate(start.getDate() - 30)
          break
      }

      // Run analytics queries in parallel
      const [emailStats, threadStats, aiStats] = await Promise.allSettled([
        supabase
          .from('emails')
          .select('id, priority, is_unread, email_ai_metadata(priority_score)')
          .eq('user_id', userId)
          .gte('received_at', start.toISOString()),

        supabase
          .from('email_threads')
          .select('id, message_count, summary')
          .eq('user_id', userId)
          .gte('last_message_at', start.toISOString()),

        supabase
          .from('ai_usage')
          .select('operation, cost_cents, total_tokens, created_at')
          .eq('user_id', userId)
          .gte('created_at', start.toISOString())
      ])

      // Process email stats
      let emailAnalytics = {
        total: 0,
        processed: 0,
        averagePriority: 0,
        unreadCount: 0
      }

      if (emailStats.status === 'fulfilled' && emailStats.value.data) {
        const emails = emailStats.value.data
        emailAnalytics.total = emails.length
        emailAnalytics.processed = emails.filter(e => e.email_ai_metadata?.length).length
        emailAnalytics.unreadCount = emails.filter(e => e.is_unread).length

        const priorities = emails.map(e => e.priority).filter(p => p)
        if (priorities.length > 0) {
          emailAnalytics.averagePriority = priorities.reduce((sum, p) => sum + p, 0) / priorities.length
        }
      }

      // Process thread stats
      let threadAnalytics = {
        total: 0,
        summarized: 0,
        averageLength: 0
      }

      if (threadStats.status === 'fulfilled' && threadStats.value.data) {
        const threads = threadStats.value.data
        threadAnalytics.total = threads.length
        threadAnalytics.summarized = threads.filter(t => t.summary).length

        const lengths = threads.map(t => t.message_count).filter(l => l)
        if (lengths.length > 0) {
          threadAnalytics.averageLength = lengths.reduce((sum, l) => sum + l, 0) / lengths.length
        }
      }

      // Process AI stats
      let aiAnalytics = {
        operations: 0,
        costCents: 0,
        tokensUsed: 0
      }

      if (aiStats.status === 'fulfilled' && aiStats.value.data) {
        const usage = aiStats.value.data
        aiAnalytics.operations = usage.length
        aiAnalytics.costCents = usage.reduce((sum, u) => sum + u.cost_cents, 0)
        aiAnalytics.tokensUsed = usage.reduce((sum, u) => sum + u.total_tokens, 0)
      }

      // Calculate performance metrics
      const successRate = emailAnalytics.total > 0
        ? (emailAnalytics.processed / emailAnalytics.total) * 100
        : 0

      return {
        emails: emailAnalytics,
        threads: threadAnalytics,
        ai: aiAnalytics,
        performance: {
          averageProcessingTime: 1250, // Estimated based on typical operations
          successRate
        }
      }

    } catch (error: any) {
      console.error('❌ Analytics generation failed:', error)
      throw handleApiError(error, 'Analytics generation failed')
    }
  }
}

// Export singleton instance
export const integrationService = IntegrationService.getInstance()