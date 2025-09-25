import { createClient } from '@/lib/supabase/server'
import { calculateEmailScore } from '@/lib/scoring/email-scorer'
import { scoreEmailPriority } from '@/lib/ai/openai'
import { rulesEngine } from '@/lib/automation/rules-engine'
import { sseEventManager } from '@/app/api/realtime/route'

// Types
interface EmailForProcessing {
  id: string
  user_id: string
  subject?: string | null
  from_email?: string | null
  snippet?: string | null
  is_important?: boolean | null
  is_starred?: boolean | null
  is_unread?: boolean | null
  received_at?: string | null
  thread_id?: string | null
}

interface ProcessingResult {
  emailId: string
  ruleScore: number
  aiScore?: number
  finalScore: number
  tier: 'high' | 'medium' | 'low'
  processedAt: Date
  processingCost?: number
  error?: string
}

interface BatchConfig {
  maxBatchSize: number
  maxWaitTimeMs: number
  aiThreshold: number  // Only emails above this rule score get AI processing
  costBudgetCents: number
  priorityThresholds: {
    high: number
    medium: number
  }
}

// Default configuration
const DEFAULT_CONFIG: BatchConfig = {
  maxBatchSize: 10,
  maxWaitTimeMs: 30000, // 30 seconds
  aiThreshold: 60, // Only emails scoring 60+ get AI processing
  costBudgetCents: 100, // $1 daily budget
  priorityThresholds: {
    high: 80,
    medium: 40
  }
}

// In-memory batch queue for smart batching
class ProcessingQueue {
  private queue: EmailForProcessing[] = []
  private batchTimeout: NodeJS.Timeout | null = null
  private processing = false
  private config: BatchConfig

  constructor(config: BatchConfig = DEFAULT_CONFIG) {
    this.config = config
  }

  async addEmail(email: EmailForProcessing): Promise<void> {
    this.queue.push(email)
    console.log(`📧 Added email ${email.id} to processing queue. Queue size: ${this.queue.length}`)

    // Process immediately if batch is full
    if (this.queue.length >= this.config.maxBatchSize) {
      await this.processBatch()
      return
    }

    // Set timeout for batch processing if not already set
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.processBatch()
      }, this.config.maxWaitTimeMs)
    }
  }

  private async processBatch(): Promise<void> {
    if (this.processing || this.queue.length === 0) return

    this.processing = true

    // Clear timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
      this.batchTimeout = null
    }

    // Take current queue and reset
    const emailsToProcess = [...this.queue]
    this.queue = []

    console.log(`🚀 Processing batch of ${emailsToProcess.length} emails`)

    try {
      await processEmailBatch(emailsToProcess, this.config)
    } catch (error) {
      console.error('❌ Batch processing failed:', error)
    } finally {
      this.processing = false
    }
  }
}

// Singleton queue instance
let processingQueue: ProcessingQueue | null = null

function getProcessingQueue(): ProcessingQueue {
  if (!processingQueue) {
    processingQueue = new ProcessingQueue()
  }
  return processingQueue
}

/**
 * Main entry point for automatic email processing
 * Called by webhook handlers when new emails arrive
 */
export async function processEmailAutomatic(email: EmailForProcessing): Promise<void> {
  try {
    console.log(`📨 Auto-processing email: ${email.id} from ${email.from_email}`)

    // Add to smart batching queue
    const queue = getProcessingQueue()
    await queue.addEmail(email)

  } catch (error) {
    console.error(`❌ Error queuing email ${email.id} for processing:`, error)

    // Fallback: process immediately without batching
    try {
      await processEmailBatch([email], DEFAULT_CONFIG)
    } catch (fallbackError) {
      console.error(`❌ Fallback processing failed for email ${email.id}:`, fallbackError)
    }
  }
}

/**
 * Process a batch of emails with smart AI cost optimization
 */
async function processEmailBatch(emails: EmailForProcessing[], config: BatchConfig): Promise<ProcessingResult[]> {
  const results: ProcessingResult[] = []
  const supabase = await createClient()
  let totalCostCents = 0

  console.log(`⚡ Processing batch of ${emails.length} emails`)

  try {
    // Phase 1: Apply rule-based scoring to all emails
    console.log('📊 Phase 1: Rule-based scoring')
    const ruleResults = await Promise.all(
      emails.map(async (email) => {
        try {
          const ruleResult = await calculateEmailScore(email.user_id, email)
          return {
            email,
            ruleScore: ruleResult.finalScore,
            ruleTier: ruleResult.tier,
            ruleFactors: ruleResult.factors
          }
        } catch (error) {
          console.error(`❌ Rule scoring failed for email ${email.id}:`, error)
          return {
            email,
            ruleScore: 30, // Default medium-low score
            ruleTier: 'medium' as const,
            ruleFactors: null
          }
        }
      })
    )

    // Phase 2: Identify emails that need AI processing
    const aiCandidates = ruleResults.filter(result => result.ruleScore >= config.aiThreshold)
    const nonAiEmails = ruleResults.filter(result => result.ruleScore < config.aiThreshold)

    console.log(`🤖 Phase 2: AI scoring for ${aiCandidates.length} high-priority emails`)

    // Phase 3: Apply AI scoring to high-priority emails within budget
    const aiResults = await Promise.all(
      aiCandidates.slice(0, Math.floor(config.costBudgetCents / 5)) // Estimate ~5 cents per AI call
        .map(async (result) => {
          try {
            const aiResult = await scoreEmailPriority(
              result.email.user_id,
              result.email.id,
              result.email.subject || '',
              result.email.from_email || '',
              result.email.snippet || '',
              result.email.is_important || false,
              result.email.is_starred || false,
              result.email.is_unread || false
            )

            totalCostCents += 5 // Estimate cost tracking

            return {
              ...result,
              aiScore: aiResult.score * 10, // Convert 1-10 to 0-100 scale
              aiReasoning: aiResult.reasoning
            }
          } catch (error) {
            console.error(`❌ AI scoring failed for email ${result.email.id}:`, error)
            return {
              ...result,
              aiScore: undefined,
              aiReasoning: 'AI processing failed'
            }
          }
        })
    )

    // Phase 4: Calculate final scores and tiers
    console.log('🎯 Phase 4: Final score calculation')

    // Process AI-scored emails
    for (const result of aiResults) {
      const finalScore = result.aiScore ?
        Math.round((result.ruleScore * 0.6) + (result.aiScore * 0.4)) : // 60% rule, 40% AI
        result.ruleScore // Fallback to rule score only

      const tier: 'high' | 'medium' | 'low' =
        finalScore >= config.priorityThresholds.high ? 'high' :
        finalScore >= config.priorityThresholds.medium ? 'medium' : 'low'

      results.push({
        emailId: result.email.id,
        ruleScore: result.ruleScore,
        aiScore: result.aiScore,
        finalScore,
        tier,
        processedAt: new Date(),
        processingCost: result.aiScore ? 5 : 0
      })
    }

    // Process non-AI emails
    for (const result of nonAiEmails) {
      const tier: 'high' | 'medium' | 'low' =
        result.ruleScore >= config.priorityThresholds.high ? 'high' :
        result.ruleScore >= config.priorityThresholds.medium ? 'medium' : 'low'

      results.push({
        emailId: result.email.id,
        ruleScore: result.ruleScore,
        finalScore: result.ruleScore,
        tier,
        processedAt: new Date(),
        processingCost: 0
      })
    }

    // Phase 5: Save results to database
    console.log('💾 Phase 5: Saving results to database')
    await saveProcessingResults(results, supabase)

    // Phase 6: Apply automation rules to processed emails
    console.log('🤖 Phase 6: Applying automation rules')
    for (const result of results) {
      const email = emails.find(e => e.id === result.emailId)
      if (email) {
        try {
          const { applied, results: ruleResults } = await rulesEngine.applyRules(
            email.user_id,
            {
              id: email.id,
              from_email: email.from_email,
              subject: email.subject,
              snippet: email.snippet,
              has_attachments: false, // We'd need to get this from email data
              is_unread: email.is_unread,
              score: result.finalScore,
              tier: result.tier
            }
          )

          if (applied.length > 0) {
            console.log(`✅ Applied ${applied.length} rules to email ${email.id}:`, applied)

            // Broadcast rule execution to UI
            sseEventManager.broadcast({
              type: 'rules_applied',
              data: {
                userId: email.user_id,
                emailId: email.id,
                rulesApplied: applied,
                timestamp: new Date().toISOString()
              }
            })
          }
        } catch (error) {
          console.error(`❌ Error applying rules to email ${email.id}:`, error)
        }
      }
    }

    console.log(`✅ Batch processing complete. Processed ${results.length} emails, cost: ${totalCostCents} cents`)
    return results

  } catch (error) {
    console.error('❌ Batch processing error:', error)

    // Create error results for all emails
    const errorResults = emails.map(email => ({
      emailId: email.id,
      ruleScore: 30,
      finalScore: 30,
      tier: 'medium' as const,
      processedAt: new Date(),
      error: error instanceof Error ? error.message : 'Unknown processing error'
    }))

    // Still try to save error results
    try {
      await saveProcessingResults(errorResults, supabase)
    } catch (saveError) {
      console.error('❌ Failed to save error results:', saveError)
    }

    return errorResults
  }
}

/**
 * Save processing results to email_scores and update feed_items
 */
async function saveProcessingResults(results: ProcessingResult[], supabase: any): Promise<void> {
  try {
    // Prepare data for email_scores table
    const scoresData = results.map(result => ({
      email_id: result.emailId,
      rule_score: result.ruleScore,
      ai_score: result.aiScore || null,
      final_score: result.finalScore,
      tier: result.tier,
      processed_at: result.processedAt.toISOString(),
      processing_cost_cents: result.processingCost || 0,
      error_message: result.error || null,
      version: '1.0'
    }))

    // Insert/update email scores
    const { error: scoresError } = await supabase
      .from('email_scores')
      .upsert(scoresData, {
        onConflict: 'email_id',
        ignoreDuplicates: false
      })

    if (scoresError) {
      console.error('❌ Error saving email scores:', scoresError)
      throw scoresError
    }

    // Update feed_items with new scores and tiers
    const feedUpdates = results.map(result => ({
      email_id: result.emailId,
      priority_score: result.finalScore,
      tier: result.tier,
      updated_at: result.processedAt.toISOString()
    }))

    for (const update of feedUpdates) {
      const { error: feedError } = await supabase
        .from('feed_items')
        .update({
          priority_score: update.priority_score,
          tier: update.tier,
          updated_at: update.updated_at
        })
        .eq('email_id', update.email_id)

      if (feedError) {
        console.error(`❌ Error updating feed_item for email ${update.email_id}:`, feedError)
        // Continue processing other updates even if one fails
      }
    }

    console.log(`✅ Saved ${results.length} email scores and updated feed items`)

  } catch (error) {
    console.error('❌ Error saving processing results:', error)
    throw error
  }
}

/**
 * Process emails immediately without batching (for high-priority or manual triggers)
 */
export async function processEmailImmediate(email: EmailForProcessing): Promise<ProcessingResult> {
  console.log(`⚡ Immediate processing for email: ${email.id}`)

  const results = await processEmailBatch([email], {
    ...DEFAULT_CONFIG,
    aiThreshold: 0, // Process with AI regardless of rule score for immediate processing
    maxBatchSize: 1
  })

  return results[0]
}

/**
 * Reprocess existing emails (for backfill or score updates)
 */
export async function reprocessEmails(userId: string, emailIds?: string[]): Promise<ProcessingResult[]> {
  const supabase = await createClient()

  try {
    // Get emails to reprocess
    let query = supabase
      .from('emails')
      .select('id, user_id, subject, from_email, snippet, is_important, is_starred, is_unread, received_at, thread_id')
      .eq('user_id', userId)

    if (emailIds?.length) {
      query = query.in('id', emailIds)
    } else {
      // Default: reprocess emails from last 7 days
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      query = query.gte('received_at', weekAgo.toISOString())
    }

    const { data: emails, error } = await query

    if (error) {
      console.error('❌ Error fetching emails for reprocessing:', error)
      throw error
    }

    if (!emails?.length) {
      console.log('📭 No emails found for reprocessing')
      return []
    }

    console.log(`🔄 Reprocessing ${emails.length} emails for user ${userId}`)

    // Process in batches to avoid overwhelming the system
    const batchSize = DEFAULT_CONFIG.maxBatchSize
    const allResults: ProcessingResult[] = []

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize)
      const batchResults = await processEmailBatch(batch, {
        ...DEFAULT_CONFIG,
        aiThreshold: 50 // Slightly lower threshold for reprocessing
      })
      allResults.push(...batchResults)
    }

    return allResults

  } catch (error) {
    console.error('❌ Error in reprocessEmails:', error)
    throw error
  }
}

/**
 * Get processing statistics and metrics
 */
export async function getProcessingStats(userId: string, days: number = 7): Promise<{
  totalProcessed: number
  aiProcessed: number
  averageScore: number
  tierDistribution: Record<string, number>
  totalCostCents: number
  processingErrors: number
}> {
  const supabase = await createClient()

  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data: scores, error } = await supabase
      .from('email_scores')
      .select('*')
      .gte('processed_at', startDate.toISOString())
      .eq('user_id', userId)

    if (error) {
      throw error
    }

    if (!scores?.length) {
      return {
        totalProcessed: 0,
        aiProcessed: 0,
        averageScore: 0,
        tierDistribution: { high: 0, medium: 0, low: 0 },
        totalCostCents: 0,
        processingErrors: 0
      }
    }

    const stats = {
      totalProcessed: scores.length,
      aiProcessed: scores.filter(s => s.ai_score !== null).length,
      averageScore: Math.round(scores.reduce((sum, s) => sum + s.final_score, 0) / scores.length),
      tierDistribution: scores.reduce((dist, s) => {
        dist[s.tier] = (dist[s.tier] || 0) + 1
        return dist
      }, {} as Record<string, number>),
      totalCostCents: scores.reduce((sum, s) => sum + (s.processing_cost_cents || 0), 0),
      processingErrors: scores.filter(s => s.error_message !== null).length
    }

    return stats

  } catch (error) {
    console.error('❌ Error getting processing stats:', error)
    throw error
  }
}

/**
 * Update processing configuration
 */
export function updateProcessingConfig(newConfig: Partial<BatchConfig>): void {
  if (processingQueue) {
    processingQueue = new ProcessingQueue({ ...DEFAULT_CONFIG, ...newConfig })
    console.log('🔧 Updated processing configuration:', newConfig)
  }
}

/**
 * Health check for the processing system
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  queueSize: number
  processing: boolean
  lastProcessed?: Date
}> {
  try {
    const queue = getProcessingQueue()

    // Check if system is responsive
    const testEmail: EmailForProcessing = {
      id: 'health-check-test',
      user_id: 'test',
      subject: 'Health Check',
      from_email: 'test@example.com',
      snippet: 'System health check',
      is_important: false,
      is_starred: false,
      is_unread: true,
      received_at: new Date().toISOString()
    }

    // This should complete quickly for health check
    const startTime = Date.now()
    await calculateEmailScore('test', testEmail)
    const responseTime = Date.now() - startTime

    return {
      status: responseTime < 1000 ? 'healthy' : responseTime < 3000 ? 'degraded' : 'unhealthy',
      queueSize: (queue as any).queue?.length || 0,
      processing: (queue as any).processing || false,
      lastProcessed: new Date()
    }

  } catch (error) {
    console.error('❌ Health check failed:', error)
    return {
      status: 'unhealthy',
      queueSize: -1,
      processing: false
    }
  }
}