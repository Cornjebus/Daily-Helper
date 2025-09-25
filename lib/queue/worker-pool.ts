import { getEmailQueue } from './email-queue'
import {
  processEmailScoring,
  processEmailSummarization,
  processWebhookProcessing
} from './processors'

/**
 * Worker pool manager for the email queue system
 * Handles initialization and management of background processing workers
 */
export class WorkerPool {
  private isInitialized = false
  private cleanupInterval: NodeJS.Timeout | null = null
  private monitoringInterval: NodeJS.Timeout | null = null

  /**
   * Initialize the worker pool with processors
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('📝 Worker pool already initialized')
      return
    }

    console.log('🚀 Initializing email queue worker pool...')

    const queue = getEmailQueue()

    // Register processors
    queue.registerProcessor('email_scoring', processEmailScoring)
    queue.registerProcessor('email_summarization', processEmailSummarization)
    queue.registerProcessor('webhook_processing', processWebhookProcessing)

    // Start queue processing
    queue.start()

    // Setup periodic cleanup (every 30 minutes)
    this.cleanupInterval = setInterval(() => {
      this.performMaintenance()
    }, 30 * 60 * 1000)

    // Setup monitoring (every 5 minutes)
    this.monitoringInterval = setInterval(() => {
      this.logQueueStats()
    }, 5 * 60 * 1000)

    this.isInitialized = true
    console.log('✅ Email queue worker pool initialized successfully')
  }

  /**
   * Shutdown the worker pool
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return

    console.log('⏹️ Shutting down email queue worker pool...')

    const queue = getEmailQueue()
    queue.stop()

    // Clear intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    this.isInitialized = false
    console.log('✅ Worker pool shutdown complete')
  }

  /**
   * Get current queue status
   */
  getStatus() {
    if (!this.isInitialized) {
      return {
        initialized: false,
        stats: null,
        workers: []
      }
    }

    const queue = getEmailQueue()
    return {
      initialized: true,
      stats: queue.getStats(),
      workers: queue.getWorkers()
    }
  }

  /**
   * Perform maintenance tasks
   */
  private performMaintenance(): void {
    try {
      const queue = getEmailQueue()

      // Cleanup old jobs (older than 24 hours)
      queue.cleanup(24 * 60 * 60 * 1000)

      // Log maintenance activity
      const stats = queue.getStats()
      console.log('🧹 Queue maintenance completed', {
        pending: stats.pending,
        processing: stats.processing,
        completed: stats.completed,
        failed: stats.failed,
        deadLetter: stats.deadLetter
      })
    } catch (error: any) {
      console.error('❌ Error during queue maintenance:', error.message)
    }
  }

  /**
   * Log queue statistics
   */
  private logQueueStats(): void {
    try {
      const queue = getEmailQueue()
      const stats = queue.getStats()
      const workers = queue.getWorkers()

      console.log('📊 Queue Status:', {
        stats: {
          pending: stats.pending,
          processing: stats.processing,
          completed: stats.completed,
          failed: stats.failed,
          errorRate: `${stats.errorRate.toFixed(1)}%`,
          avgProcessingTime: `${stats.averageProcessingTime.toFixed(0)}ms`
        },
        workers: {
          active: workers.filter(w => w.isActive).length,
          total: workers.length,
          totalProcessed: workers.reduce((sum, w) => sum + w.processedJobs, 0),
          totalFailed: workers.reduce((sum, w) => sum + w.failedJobs, 0)
        }
      })
    } catch (error: any) {
      console.error('❌ Error logging queue stats:', error.message)
    }
  }

  /**
   * Force retry of failed jobs
   */
  async retryFailedJobs(limit = 10): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('Worker pool not initialized')
    }

    const queue = getEmailQueue()
    const stats = queue.getStats()

    if (stats.failed === 0) {
      console.log('No failed jobs to retry')
      return 0
    }

    console.log(`🔄 Attempting to retry up to ${limit} failed jobs...`)

    // This is a simplified retry mechanism
    // In a real implementation, you'd want to track failed job IDs
    let retriedCount = 0
    // Implementation would depend on access to failed jobs list

    return retriedCount
  }

  /**
   * Add jobs for immediate processing (bypass normal queue delay)
   */
  async processImmediate(jobData: {
    type: 'email_scoring' | 'webhook_processing'
    userId: string
    emailIds: string[]
  }): Promise<string[]> {
    if (!this.isInitialized) {
      throw new Error('Worker pool not initialized')
    }

    const queue = getEmailQueue()
    const jobIds: string[] = []

    if (jobData.type === 'webhook_processing') {
      // Process as single webhook job
      const jobId = await queue.enqueueWebhookProcessing({
        userId: jobData.userId,
        emailIds: jobData.emailIds,
        source: 'gmail'
      }, 9) // High priority for immediate processing

      jobIds.push(jobId)
    } else if (jobData.type === 'email_scoring') {
      // Process individual emails with high priority
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()

      const { data: emails } = await supabase
        .from('emails')
        .select('*')
        .eq('user_id', jobData.userId)
        .in('id', jobData.emailIds)

      if (emails) {
        for (const email of emails) {
          const jobId = await queue.enqueueEmailScoring({
            userId: jobData.userId,
            emailId: email.id,
            subject: email.subject || '',
            from: email.from_email || '',
            snippet: email.snippet || '',
            isImportant: email.is_important || false,
            isStarred: email.is_starred || false,
            isUnread: email.is_unread || false,
          }, 9) // High priority

          jobIds.push(jobId)
        }
      }
    }

    console.log(`⚡ Enqueued ${jobIds.length} immediate processing jobs`)
    return jobIds
  }
}

// Singleton instance
let workerPoolInstance: WorkerPool | null = null

export function getWorkerPool(): WorkerPool {
  if (!workerPoolInstance) {
    workerPoolInstance = new WorkerPool()
  }
  return workerPoolInstance
}

// Auto-initialize worker pool in production environments
if (process.env.NODE_ENV === 'production' || process.env.AUTO_INIT_QUEUE === 'true') {
  // Initialize after a short delay to allow other services to start
  setTimeout(async () => {
    try {
      const workerPool = getWorkerPool()
      await workerPool.initialize()
    } catch (error: any) {
      console.error('❌ Failed to auto-initialize worker pool:', error.message)
    }
  }, 2000)
}

// Graceful shutdown handling
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    console.log('📡 Received SIGTERM, shutting down worker pool...')
    if (workerPoolInstance) {
      await workerPoolInstance.shutdown()
    }
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    console.log('📡 Received SIGINT, shutting down worker pool...')
    if (workerPoolInstance) {
      await workerPoolInstance.shutdown()
    }
    process.exit(0)
  })
}