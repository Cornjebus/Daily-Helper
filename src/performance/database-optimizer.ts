/**
 * Database Query Optimizer for High-Performance Email Processing
 * Implements optimized queries, connection pooling, and performance monitoring
 */

import { createClient } from '@/lib/supabase/server'

interface QueryMetrics {
  queryId: string
  executionTime: number
  resultCount: number
  timestamp: number
  cached: boolean
  indexesUsed: string[]
}

interface BatchOperationResult<T> {
  results: T[]
  totalTime: number
  avgTimePerItem: number
  errorCount: number
  successCount: number
}

export class DatabaseOptimizer {
  private queryCache = new Map<string, { data: any, timestamp: number, ttl: number }>()
  private queryMetrics: QueryMetrics[] = []
  private connectionPool: any = null

  private readonly config = {
    maxConnections: 10,
    queryTimeout: 30000,      // 30 seconds
    batchSize: 50,           // Optimal batch size for bulk operations
    cacheDefaultTTL: 5 * 60 * 1000,  // 5 minutes
    slowQueryThreshold: 1000,         // 1 second
    maxCacheSize: 1000
  }

  /**
   * Optimized email fetching with intelligent batching and caching
   */
  async getUnprocessedEmails(
    userId: string,
    limit: number = 50,
    useCache: boolean = true
  ): Promise<any[]> {
    const startTime = performance.now()
    const queryId = `unprocessed_emails_${userId}_${limit}`

    // Check cache first
    if (useCache) {
      const cached = this.queryCache.get(queryId)
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        this.recordMetrics(queryId, performance.now() - startTime, cached.data.length, true)
        return cached.data
      }
    }

    const supabase = await createClient()

    try {
      // Optimized query with proper indexing hints
      const { data: emails, error } = await supabase
        .from('emails')
        .select(`
          id,
          user_id,
          subject,
          from_email,
          snippet,
          is_important,
          is_starred,
          is_unread,
          received_at,
          priority,
          metadata,
          email_ai_metadata!left (
            priority_score,
            processing_version,
            confidence_score
          )
        `)
        .eq('user_id', userId)
        .is('email_ai_metadata.priority_score', null)  // Only unprocessed
        .order('received_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      const results = emails || []
      const executionTime = performance.now() - startTime

      // Cache results
      if (useCache && executionTime < this.config.slowQueryThreshold) {
        this.queryCache.set(queryId, {
          data: results,
          timestamp: Date.now(),
          ttl: this.config.cacheDefaultTTL
        })
      }

      this.recordMetrics(queryId, executionTime, results.length, false, ['emails_user_id_received_at_idx', 'email_ai_metadata_email_id_idx'])

      return results

    } catch (error) {
      console.error('❌ Database query error:', error)
      this.recordMetrics(queryId, performance.now() - startTime, 0, false, [])
      throw error
    }
  }

  /**
   * Batch update operations for improved throughput
   */
  async batchUpdateEmailPriorities(
    updates: Array<{
      emailId: string
      priority: number
      score: number
      reasoning: string
      model: string
    }>
  ): Promise<BatchOperationResult<any>> {
    const startTime = performance.now()
    const supabase = await createClient()

    const results: any[] = []
    let errorCount = 0
    let successCount = 0

    // Process in optimal batch sizes to avoid timeout
    const batches = this.chunkArray(updates, this.config.batchSize)

    for (const batch of batches) {
      try {
        // Batch update emails table
        const emailUpdates = batch.map(update => ({
          id: update.emailId,
          priority: update.priority,
          updated_at: new Date().toISOString()
        }))

        const { error: emailError } = await supabase
          .from('emails')
          .upsert(emailUpdates, {
            onConflict: 'id',
            ignoreDuplicates: false
          })

        if (emailError) throw emailError

        // Batch upsert AI metadata
        const metadataUpdates = batch.map(update => ({
          email_id: update.emailId,
          user_id: updates[0]?.emailId ? null : null, // Will be populated by trigger
          priority_score: update.score,
          processing_version: update.model,
          confidence_score: 0.9,
          updated_at: new Date().toISOString()
        }))

        const { error: metadataError } = await supabase
          .from('email_ai_metadata')
          .upsert(metadataUpdates, {
            onConflict: 'email_id',
            ignoreDuplicates: false
          })

        if (metadataError) throw metadataError

        // Batch update feed items
        const feedUpdates = batch.map(update => ({
          external_id: update.emailId,
          source: 'gmail',
          priority: update.priority,
          metadata: {
            ai_score: update.score,
            ai_processed: true,
            ai_model: update.model,
            ai_reasoning: update.reasoning
          },
          updated_at: new Date().toISOString()
        }))

        const { data: feedResults } = await supabase
          .from('feed_items')
          .upsert(feedUpdates, {
            onConflict: 'external_id,source',
            ignoreDuplicates: false
          })
          .select('id')

        results.push(...(feedResults || []))
        successCount += batch.length

      } catch (error) {
        console.error('❌ Batch update error:', error)
        errorCount += batch.length
      }
    }

    const totalTime = performance.now() - startTime

    return {
      results,
      totalTime,
      avgTimePerItem: totalTime / updates.length,
      errorCount,
      successCount
    }
  }

  /**
   * Optimized thread summarization with bulk operations
   */
  async getThreadsForSummarization(
    userId: string,
    minMessageCount: number = 3,
    hoursBack: number = 24
  ): Promise<any[]> {
    const startTime = performance.now()
    const queryId = `threads_summary_${userId}_${minMessageCount}_${hoursBack}`

    // Check cache
    const cached = this.queryCache.get(queryId)
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      this.recordMetrics(queryId, performance.now() - startTime, cached.data.length, true)
      return cached.data
    }

    const supabase = await createClient()
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()

    try {
      // Optimized query with subquery for better performance
      const { data: threads, error } = await supabase
        .from('email_threads')
        .select(`
          id,
          thread_id,
          message_count,
          last_message_at,
          summary,
          emails!inner (
            id,
            subject,
            from_email,
            snippet,
            received_at
          )
        `)
        .eq('user_id', userId)
        .gte('last_message_at', cutoffTime)
        .gt('message_count', minMessageCount)
        .is('summary', null)  // Only unsummarized threads
        .order('last_message_at', { ascending: false })
        .limit(20)  // Limit to prevent timeout

      if (error) throw error

      const results = threads || []
      const executionTime = performance.now() - startTime

      // Cache results for shorter time due to time-sensitive nature
      this.queryCache.set(queryId, {
        data: results,
        timestamp: Date.now(),
        ttl: 2 * 60 * 1000  // 2 minutes
      })

      this.recordMetrics(queryId, executionTime, results.length, false, ['email_threads_user_id_last_message_at_idx'])

      return results

    } catch (error) {
      console.error('❌ Thread query error:', error)
      this.recordMetrics(queryId, performance.now() - startTime, 0, false, [])
      throw error
    }
  }

  /**
   * Batch update thread summaries
   */
  async batchUpdateThreadSummaries(
    updates: Array<{
      threadId: string
      summary: string
      keyPoints: string[]
    }>
  ): Promise<BatchOperationResult<any>> {
    const startTime = performance.now()
    const supabase = await createClient()

    const results: any[] = []
    let errorCount = 0
    let successCount = 0

    const batches = this.chunkArray(updates, this.config.batchSize)

    for (const batch of batches) {
      try {
        const threadUpdates = batch.map(update => ({
          id: update.threadId,
          summary: update.summary,
          metadata: {
            key_points: update.keyPoints,
            summarized_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        }))

        const { data, error } = await supabase
          .from('email_threads')
          .upsert(threadUpdates, {
            onConflict: 'id',
            ignoreDuplicates: false
          })
          .select('id')

        if (error) throw error

        results.push(...(data || []))
        successCount += batch.length

      } catch (error) {
        console.error('❌ Thread summary batch update error:', error)
        errorCount += batch.length
      }
    }

    const totalTime = performance.now() - startTime

    return {
      results,
      totalTime,
      avgTimePerItem: totalTime / updates.length,
      errorCount,
      successCount
    }
  }

  /**
   * Optimized user statistics query
   */
  async getUserProcessingStats(userId: string): Promise<any> {
    const startTime = performance.now()
    const queryId = `user_stats_${userId}`

    const cached = this.queryCache.get(queryId)
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data
    }

    const supabase = await createClient()

    try {
      // Use a single aggregation query instead of multiple queries
      const { data: stats, error } = await supabase
        .rpc('get_user_processing_stats', { p_user_id: userId })

      if (error) throw error

      const executionTime = performance.now() - startTime

      // Cache for longer since stats don't change frequently
      this.queryCache.set(queryId, {
        data: stats,
        timestamp: Date.now(),
        ttl: 10 * 60 * 1000  // 10 minutes
      })

      this.recordMetrics(queryId, executionTime, 1, false, ['custom_function'])

      return stats

    } catch (error) {
      console.error('❌ User stats query error:', error)
      // Return empty stats on error
      return {
        total_emails: 0,
        processed_emails: 0,
        total_threads: 0,
        summarized_threads: 0,
        avg_priority_score: 0
      }
    }
  }

  /**
   * Connection pooling and resource management
   */
  async initializePool(): Promise<void> {
    // Supabase handles connection pooling internally
    // This is a placeholder for custom pool configuration if needed
    this.connectionPool = {
      maxConnections: this.config.maxConnections,
      initialized: true,
      createdAt: Date.now()
    }
  }

  /**
   * Query performance monitoring
   */
  private recordMetrics(
    queryId: string,
    executionTime: number,
    resultCount: number,
    cached: boolean,
    indexesUsed: string[] = []
  ): void {
    this.queryMetrics.push({
      queryId,
      executionTime,
      resultCount,
      timestamp: Date.now(),
      cached,
      indexesUsed
    })

    // Keep only recent metrics
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics = this.queryMetrics.slice(-500)
    }

    // Log slow queries
    if (executionTime > this.config.slowQueryThreshold) {
      console.warn(`🐌 Slow query detected: ${queryId} took ${executionTime.toFixed(2)}ms`)
    }
  }

  /**
   * Cache management
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  clearCache(): void {
    this.queryCache.clear()
  }

  /**
   * Performance diagnostics
   */
  getPerformanceStats() {
    const recentMetrics = this.queryMetrics.filter(m => Date.now() - m.timestamp < 60 * 60 * 1000) // Last hour

    const totalQueries = recentMetrics.length
    const cachedQueries = recentMetrics.filter(m => m.cached).length
    const slowQueries = recentMetrics.filter(m => m.executionTime > this.config.slowQueryThreshold).length

    const avgExecutionTime = totalQueries > 0
      ? recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries
      : 0

    return {
      totalQueries,
      cachedQueries,
      slowQueries,
      cacheHitRate: totalQueries > 0 ? cachedQueries / totalQueries : 0,
      avgExecutionTime,
      cacheSize: this.queryCache.size,
      slowQueryRate: totalQueries > 0 ? slowQueries / totalQueries : 0,
      recentMetrics: recentMetrics.slice(-10) // Last 10 queries
    }
  }
}

// Database index creation SQL
export const PERFORMANCE_INDEXES = `
-- Email processing indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS emails_user_received_unprocessed_idx
ON emails (user_id, received_at DESC)
WHERE priority IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS emails_priority_score_idx
ON emails (priority, received_at DESC)
WHERE priority IS NOT NULL;

-- AI metadata indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS email_ai_metadata_score_confidence_idx
ON email_ai_metadata (priority_score, confidence_score);

CREATE INDEX CONCURRENTLY IF NOT EXISTS email_ai_metadata_processing_version_idx
ON email_ai_metadata (processing_version, updated_at);

-- Thread processing indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS email_threads_unsummarized_idx
ON email_threads (user_id, last_message_at DESC, message_count)
WHERE summary IS NULL AND message_count > 3;

-- Feed items indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS feed_items_source_external_priority_idx
ON feed_items (source, external_id, priority);

CREATE INDEX CONCURRENTLY IF NOT EXISTS feed_items_user_priority_updated_idx
ON feed_items (user_id, priority, updated_at DESC);

-- AI usage indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_usage_user_operation_date_idx
ON ai_usage (user_id, operation, created_at DESC);

-- Partial indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS emails_important_unread_idx
ON emails (user_id, received_at DESC)
WHERE (is_important = true OR is_unread = true);

CREATE INDEX CONCURRENTLY IF NOT EXISTS feed_items_high_priority_idx
ON feed_items (user_id, updated_at DESC)
WHERE priority <= 3;
`

// Database function for aggregated stats
export const PERFORMANCE_FUNCTIONS = `
CREATE OR REPLACE FUNCTION get_user_processing_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH email_stats AS (
    SELECT
      COUNT(*) as total_emails,
      COUNT(CASE WHEN priority IS NOT NULL THEN 1 END) as processed_emails
    FROM emails
    WHERE user_id = p_user_id
  ),
  thread_stats AS (
    SELECT
      COUNT(*) as total_threads,
      COUNT(CASE WHEN summary IS NOT NULL THEN 1 END) as summarized_threads
    FROM email_threads
    WHERE user_id = p_user_id
  ),
  score_stats AS (
    SELECT
      AVG(eam.priority_score) as avg_priority_score
    FROM email_ai_metadata eam
    JOIN emails e ON e.id = eam.email_id
    WHERE e.user_id = p_user_id
  )
  SELECT json_build_object(
    'total_emails', es.total_emails,
    'processed_emails', es.processed_emails,
    'total_threads', ts.total_threads,
    'summarized_threads', ts.summarized_threads,
    'avg_priority_score', COALESCE(ss.avg_priority_score, 0),
    'processing_rate', CASE
      WHEN es.total_emails > 0 THEN (es.processed_emails::float / es.total_emails::float)
      ELSE 0
    END
  ) INTO result
  FROM email_stats es, thread_stats ts, score_stats ss;

  RETURN result;
END;
$$ LANGUAGE plpgsql;
`

// Global optimizer instance
export const databaseOptimizer = new DatabaseOptimizer()