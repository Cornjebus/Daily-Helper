import {
  QueueJob,
  QueueStats,
  QueueWorker,
  QueueOptions,
  ProcessingResult,
  JobProcessor,
  EmailScoringJobData,
  EmailSummarizationJobData,
  WebhookProcessingJobData
} from './types'
import { v4 as uuidv4 } from 'uuid'

/**
 * In-memory queue system for background email processing
 * Handles concurrent processing with rate limiting and retry logic
 */
export class EmailQueue {
  private jobs: Map<string, QueueJob> = new Map()
  private pendingQueue: QueueJob[] = []
  private processingQueue: Map<string, QueueJob> = new Map()
  private completedQueue: QueueJob[] = []
  private failedQueue: QueueJob[] = []
  private deadLetterQueue: QueueJob[] = []

  private workers: Map<string, QueueWorker> = new Map()
  private processors: Map<string, JobProcessor> = new Map()

  private isRunning = false
  private processingInterval: NodeJS.Timeout | null = null
  private rateLimitTracker: Map<string, { count: number; resetTime: number }> = new Map()

  private readonly options: QueueOptions = {
    maxConcurrency: 5,
    retryDelay: 1000,
    maxRetries: 3,
    deadLetterQueue: true,
    rateLimitPerMinute: 60,
    processingTimeout: 30000, // 30 seconds
  }

  constructor(options?: Partial<QueueOptions>) {
    this.options = { ...this.options, ...options }
    console.log('📬 Email Queue initialized with options:', this.options)
  }

  /**
   * Register a job processor for a specific job type
   */
  registerProcessor(type: string, processor: JobProcessor): void {
    this.processors.set(type, processor)
    console.log(`📋 Registered processor for job type: ${type}`)
  }

  /**
   * Add a job to the queue
   */
  async enqueue<T>(
    type: QueueJob['type'],
    data: T,
    options?: {
      priority?: number
      delay?: number
      maxRetries?: number
      userId?: string
      metadata?: Record<string, any>
    }
  ): Promise<string> {
    const jobId = uuidv4()
    const now = new Date()

    const job: QueueJob<T> = {
      id: jobId,
      type,
      data,
      priority: options?.priority || 5,
      retries: 0,
      maxRetries: options?.maxRetries || this.options.maxRetries,
      createdAt: now,
      updatedAt: now,
      scheduledAt: options?.delay ? new Date(now.getTime() + options.delay) : now,
      userId: options?.userId,
      metadata: options?.metadata,
    }

    this.jobs.set(jobId, job)
    this.addToPendingQueue(job)

    console.log(`➕ Enqueued job ${jobId} (type: ${type}, priority: ${job.priority})`)

    // Start processing if not already running
    if (!this.isRunning) {
      this.start()
    }

    return jobId
  }

  /**
   * Add email scoring job to queue
   */
  async enqueueEmailScoring(data: EmailScoringJobData, priority = 5): Promise<string> {
    return this.enqueue('email_scoring', data, {
      priority,
      userId: data.userId,
      metadata: { emailId: data.emailId }
    })
  }

  /**
   * Add email summarization job to queue
   */
  async enqueueEmailSummarization(data: EmailSummarizationJobData, priority = 3): Promise<string> {
    return this.enqueue('email_summarization', data, {
      priority,
      userId: data.userId,
      metadata: { threadId: data.threadId }
    })
  }

  /**
   * Add webhook processing job to queue
   */
  async enqueueWebhookProcessing(data: WebhookProcessingJobData, priority = 8): Promise<string> {
    return this.enqueue('webhook_processing', data, {
      priority,
      userId: data.userId,
      metadata: { emailCount: data.emailIds.length }
    })
  }

  /**
   * Start the queue processing
   */
  start(): void {
    if (this.isRunning) {
      console.log('📬 Queue is already running')
      return
    }

    this.isRunning = true
    console.log('🚀 Starting email queue processing...')

    // Process jobs every 100ms
    this.processingInterval = setInterval(() => {
      this.processJobs()
    }, 100)
  }

  /**
   * Stop the queue processing
   */
  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }

    console.log('⏹️ Email queue processing stopped')
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): QueueJob | undefined {
    return this.jobs.get(jobId)
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const totalJobs = this.jobs.size
    const completedJobs = this.completedQueue.length
    const failedJobs = this.failedQueue.length
    const totalProcessed = completedJobs + failedJobs

    // Calculate average processing time from completed jobs
    const avgProcessingTime = completedJobs > 0
      ? this.completedQueue
          .filter(job => job.startedAt && job.completedAt)
          .reduce((sum, job) => {
            const processingTime = job.completedAt!.getTime() - job.startedAt!.getTime()
            return sum + processingTime
          }, 0) / completedJobs
      : 0

    const errorRate = totalProcessed > 0 ? (failedJobs / totalProcessed) * 100 : 0

    return {
      pending: this.pendingQueue.length,
      processing: this.processingQueue.size,
      completed: completedJobs,
      failed: failedJobs,
      deadLetter: this.deadLetterQueue.length,
      totalProcessed,
      averageProcessingTime: avgProcessingTime,
      errorRate,
    }
  }

  /**
   * Get active workers
   */
  getWorkers(): QueueWorker[] {
    return Array.from(this.workers.values())
  }

  /**
   * Clear completed jobs older than specified time
   */
  cleanup(olderThan: number = 24 * 60 * 60 * 1000): void {
    const cutoffTime = new Date(Date.now() - olderThan)

    // Clean completed jobs
    const beforeCompleted = this.completedQueue.length
    this.completedQueue = this.completedQueue.filter(job => job.completedAt! > cutoffTime)

    // Clean failed jobs
    const beforeFailed = this.failedQueue.length
    this.failedQueue = this.failedQueue.filter(job => job.failedAt! > cutoffTime)

    // Remove from main jobs map
    for (const [id, job] of this.jobs.entries()) {
      if ((job.completedAt && job.completedAt < cutoffTime) ||
          (job.failedAt && job.failedAt < cutoffTime)) {
        this.jobs.delete(id)
      }
    }

    const cleanedCompleted = beforeCompleted - this.completedQueue.length
    const cleanedFailed = beforeFailed - this.failedQueue.length

    if (cleanedCompleted > 0 || cleanedFailed > 0) {
      console.log(`🧹 Cleaned up ${cleanedCompleted} completed and ${cleanedFailed} failed jobs`)
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId)
    if (!job) return false

    // Reset job state
    job.retries = 0
    job.error = undefined
    job.failedAt = undefined
    job.startedAt = undefined
    job.completedAt = undefined
    job.updatedAt = new Date()

    // Remove from failed queue and add back to pending
    this.failedQueue = this.failedQueue.filter(j => j.id !== jobId)
    this.addToPendingQueue(job)

    console.log(`🔄 Retrying job ${jobId}`)
    return true
  }

  /**
   * Remove job from queue
   */
  removeJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false

    // Remove from all queues
    this.pendingQueue = this.pendingQueue.filter(j => j.id !== jobId)
    this.processingQueue.delete(jobId)
    this.completedQueue = this.completedQueue.filter(j => j.id !== jobId)
    this.failedQueue = this.failedQueue.filter(j => j.id !== jobId)
    this.deadLetterQueue = this.deadLetterQueue.filter(j => j.id !== jobId)

    // Remove from main jobs map
    this.jobs.delete(jobId)

    console.log(`🗑️ Removed job ${jobId}`)
    return true
  }

  private addToPendingQueue(job: QueueJob): void {
    // Insert job in priority order (higher priority first)
    let insertIndex = 0
    while (insertIndex < this.pendingQueue.length &&
           this.pendingQueue[insertIndex].priority >= job.priority) {
      insertIndex++
    }
    this.pendingQueue.splice(insertIndex, 0, job)
  }

  private async processJobs(): Promise<void> {
    // Check if we can process more jobs
    if (this.processingQueue.size >= this.options.maxConcurrency) {
      return
    }

    // Get next available job
    const job = this.getNextJob()
    if (!job) return

    // Check rate limit
    if (!this.checkRateLimit(job.userId)) {
      // Put job back in queue with delay
      setTimeout(() => {
        if (this.jobs.has(job.id) && !this.processingQueue.has(job.id)) {
          this.addToPendingQueue(job)
        }
      }, 1000)
      return
    }

    // Move to processing queue
    this.pendingQueue = this.pendingQueue.filter(j => j.id !== job.id)
    this.processingQueue.set(job.id, job)

    // Create worker
    const workerId = uuidv4()
    const worker: QueueWorker = {
      id: workerId,
      type: job.type,
      isActive: true,
      currentJob: job,
      processedJobs: 0,
      failedJobs: 0,
      startedAt: new Date(),
    }
    this.workers.set(workerId, worker)

    // Update job
    job.startedAt = new Date()
    job.updatedAt = new Date()

    console.log(`⚡ Processing job ${job.id} with worker ${workerId}`)

    // Process job asynchronously
    this.executeJob(job, worker).finally(() => {
      // Cleanup worker
      this.workers.delete(workerId)
      this.processingQueue.delete(job.id)
    })
  }

  private getNextJob(): QueueJob | null {
    const now = new Date()

    // Find the first job that is ready to be processed
    for (let i = 0; i < this.pendingQueue.length; i++) {
      const job = this.pendingQueue[i]
      if (!job.scheduledAt || job.scheduledAt <= now) {
        return job
      }
    }

    return null
  }

  private checkRateLimit(userId?: string): boolean {
    if (!userId) return true

    const now = Date.now()
    const tracker = this.rateLimitTracker.get(userId)

    if (!tracker || now > tracker.resetTime) {
      // Reset or create new tracker
      this.rateLimitTracker.set(userId, {
        count: 1,
        resetTime: now + 60000 // 1 minute
      })
      return true
    }

    if (tracker.count >= this.options.rateLimitPerMinute) {
      return false
    }

    tracker.count++
    return true
  }

  private async executeJob(job: QueueJob, worker: QueueWorker): Promise<void> {
    const processor = this.processors.get(job.type)
    if (!processor) {
      const error = `No processor registered for job type: ${job.type}`
      console.error(`❌ ${error}`)
      this.handleJobFailure(job, worker, error)
      return
    }

    try {
      // Set processing timeout
      const timeoutPromise = new Promise<ProcessingResult>((_, reject) => {
        setTimeout(() => reject(new Error('Job processing timeout')), this.options.processingTimeout)
      })

      // Race between processing and timeout
      const result = await Promise.race([
        processor(job),
        timeoutPromise
      ])

      if (result.success) {
        this.handleJobSuccess(job, worker, result)
      } else {
        this.handleJobFailure(job, worker, result.error || 'Processing failed')
      }
    } catch (error: any) {
      console.error(`❌ Error processing job ${job.id}:`, error.message)
      this.handleJobFailure(job, worker, error.message)
    }
  }

  private handleJobSuccess(job: QueueJob, worker: QueueWorker, result: ProcessingResult): void {
    job.completedAt = new Date()
    job.updatedAt = new Date()

    this.completedQueue.push(job)
    worker.processedJobs++
    worker.lastProcessedAt = new Date()
    worker.isActive = false

    console.log(`✅ Job ${job.id} completed successfully (${result.processingTime}ms)`)
  }

  private handleJobFailure(job: QueueJob, worker: QueueWorker, error: string): void {
    job.retries++
    job.error = error
    job.updatedAt = new Date()

    worker.failedJobs++
    worker.lastProcessedAt = new Date()
    worker.isActive = false

    if (job.retries >= job.maxRetries) {
      // Max retries reached
      job.failedAt = new Date()

      if (this.options.deadLetterQueue) {
        this.deadLetterQueue.push(job)
        console.log(`💀 Job ${job.id} moved to dead letter queue after ${job.retries} retries`)
      } else {
        this.failedQueue.push(job)
        console.log(`❌ Job ${job.id} failed permanently after ${job.retries} retries`)
      }
    } else {
      // Retry with exponential backoff
      const delay = this.options.retryDelay * Math.pow(2, job.retries - 1)
      job.scheduledAt = new Date(Date.now() + delay)
      this.addToPendingQueue(job)

      console.log(`🔄 Job ${job.id} will retry in ${delay}ms (attempt ${job.retries}/${job.maxRetries})`)
    }
  }
}

// Singleton instance
let queueInstance: EmailQueue | null = null

export function getEmailQueue(): EmailQueue {
  if (!queueInstance) {
    queueInstance = new EmailQueue({
      maxConcurrency: parseInt(process.env.QUEUE_MAX_CONCURRENCY || '5'),
      rateLimitPerMinute: parseInt(process.env.QUEUE_RATE_LIMIT || '60'),
      maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3'),
      retryDelay: parseInt(process.env.QUEUE_RETRY_DELAY || '1000'),
      processingTimeout: parseInt(process.env.QUEUE_TIMEOUT || '30000'),
    })
  }
  return queueInstance
}