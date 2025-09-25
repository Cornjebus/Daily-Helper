// Queue system types and interfaces

export interface QueueJob<T = any> {
  id: string
  type: 'email_scoring' | 'email_summarization' | 'smart_replies' | 'webhook_processing'
  data: T
  priority: number
  retries: number
  maxRetries: number
  createdAt: Date
  updatedAt: Date
  scheduledAt?: Date
  startedAt?: Date
  completedAt?: Date
  failedAt?: Date
  error?: string
  userId?: string
  metadata?: Record<string, any>
}

export interface EmailScoringJobData {
  userId: string
  emailId: string
  subject: string
  from: string
  snippet: string
  isImportant: boolean
  isStarred: boolean
  isUnread: boolean
}

export interface EmailSummarizationJobData {
  userId: string
  threadId: string
  emails: Array<{
    subject: string
    from: string
    snippet: string
    date: string
  }>
}

export interface WebhookProcessingJobData {
  userId: string
  emailIds: string[]
  source: 'gmail' | 'outlook'
}

export interface QueueStats {
  pending: number
  processing: number
  completed: number
  failed: number
  deadLetter: number
  totalProcessed: number
  averageProcessingTime: number
  errorRate: number
}

export interface QueueWorker {
  id: string
  type: string
  isActive: boolean
  currentJob?: QueueJob
  processedJobs: number
  failedJobs: number
  startedAt: Date
  lastProcessedAt?: Date
}

export interface QueueOptions {
  maxConcurrency: number
  retryDelay: number
  maxRetries: number
  deadLetterQueue: boolean
  rateLimitPerMinute: number
  processingTimeout: number
}

export interface ProcessingResult {
  success: boolean
  data?: any
  error?: string
  processingTime: number
}

export type JobProcessor<T = any> = (job: QueueJob<T>) => Promise<ProcessingResult>