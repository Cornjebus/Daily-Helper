import {
  QueueJob,
  ProcessingResult,
  EmailScoringJobData,
  EmailSummarizationJobData,
  WebhookProcessingJobData
} from './types'
import { scoreEmailPriority, summarizeEmailThread } from '@/lib/ai/openai'
import { calculateEmailScore } from '@/lib/scoring/email-scorer'
import { createClient } from '@/lib/supabase/server'

/**
 * Email scoring processor
 * Handles AI-powered email priority scoring with rule-based fallback
 */
export async function processEmailScoring(
  job: QueueJob<EmailScoringJobData>
): Promise<ProcessingResult> {
  const startTime = Date.now()
  const { userId, emailId, subject, from, snippet, isImportant, isStarred, isUnread } = job.data

  try {
    console.log(`🤖 Processing email scoring for email ${emailId}`)

    // Get rule-based score first
    const supabase = await createClient()
    const { data: emailData } = await supabase
      .from('emails')
      .select('*')
      .eq('id', emailId)
      .single()

    if (!emailData) {
      return {
        success: false,
        error: 'Email not found',
        processingTime: Date.now() - startTime
      }
    }

    // Calculate rule-based score
    const scoring = await calculateEmailScore(userId, emailData)

    // Get AI score with fallback
    let aiScore: number
    let reasoning: string
    try {
      const aiResult = await scoreEmailPriority(
        userId,
        emailId,
        subject,
        from,
        snippet,
        isImportant,
        isStarred,
        isUnread
      )
      aiScore = aiResult.score
      reasoning = aiResult.reasoning
    } catch (error: any) {
      console.warn(`AI scoring failed for ${emailId}, using rule-based score:`, error.message)
      // Use rule-based score as fallback
      aiScore = Math.max(1, Math.min(10, 10 - Math.floor(scoring.finalScore / 10)))
      reasoning = 'Rule-based scoring (AI unavailable)'
    }

    // Map AI score (1-10) to priority (1 is highest)
    const mappedPriority = Math.max(1, Math.min(10, Math.round(aiScore)))

    // Update email with scores
    const { error: updateError } = await supabase
      .from('emails')
      .update({
        priority: mappedPriority,
        updated_at: new Date().toISOString()
      })
      .eq('id', emailId)

    if (updateError) {
      console.error('Failed to update email priority:', updateError)
      return {
        success: false,
        error: `Database update failed: ${updateError.message}`,
        processingTime: Date.now() - startTime
      }
    }

    // Store scoring details
    const { error: scoreError } = await supabase
      .from('email_scores')
      .upsert({
        user_id: userId,
        email_id: emailId,
        raw_score: scoring.rawScore,
        final_score: scoring.finalScore,
        processing_tier: scoring.tier,
        score_factors: scoring.factors,
        ai_priority: aiScore,
        ai_reasoning: reasoning,
        created_at: new Date().toISOString(),
      }, { onConflict: 'email_id' })

    if (scoreError) {
      console.warn('Failed to store email scores:', scoreError)
    }

    // Create/update feed item
    const { error: feedError } = await supabase
      .from('feed_items')
      .upsert({
        user_id: userId,
        source: 'gmail',
        external_id: emailId,
        title: subject || 'No Subject',
        content: snippet || '',
        category: scoring.tier === 'high' ? 'now' : scoring.tier === 'medium' ? 'next' : 'later',
        priority: mappedPriority,
        metadata: {
          from,
          ai_score: aiScore,
          ai_processed: true,
          ai_reasoning: reasoning,
          rule_score: scoring.finalScore,
          processing_tier: scoring.tier
        },
        created_at: new Date().toISOString()
      }, {
        onConflict: 'external_id,source',
        ignoreDuplicates: false
      })

    if (feedError) {
      console.warn('Failed to create/update feed item:', feedError)
    }

    console.log(`✅ Email ${emailId} scored successfully (priority: ${mappedPriority})`)

    return {
      success: true,
      data: {
        emailId,
        priority: mappedPriority,
        aiScore,
        ruleScore: scoring.finalScore,
        tier: scoring.tier,
        reasoning
      },
      processingTime: Date.now() - startTime
    }

  } catch (error: any) {
    console.error(`❌ Error processing email scoring for ${emailId}:`, error.message)
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime
    }
  }
}

/**
 * Email thread summarization processor
 * Creates AI-powered summaries of email threads
 */
export async function processEmailSummarization(
  job: QueueJob<EmailSummarizationJobData>
): Promise<ProcessingResult> {
  const startTime = Date.now()
  const { userId, threadId, emails } = job.data

  try {
    console.log(`🧵 Processing thread summarization for thread ${threadId}`)

    // Generate AI summary
    const { summary, keyPoints } = await summarizeEmailThread(userId, threadId, emails)

    // Update thread with summary
    const supabase = await createClient()
    const { error: updateError } = await supabase
      .from('email_threads')
      .update({
        summary,
        key_points: keyPoints,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId)

    if (updateError) {
      console.error('Failed to update thread summary:', updateError)
      return {
        success: false,
        error: `Database update failed: ${updateError.message}`,
        processingTime: Date.now() - startTime
      }
    }

    console.log(`✅ Thread ${threadId} summarized successfully`)

    return {
      success: true,
      data: {
        threadId,
        summary,
        keyPoints,
        emailCount: emails.length
      },
      processingTime: Date.now() - startTime
    }

  } catch (error: any) {
    console.error(`❌ Error processing thread summarization for ${threadId}:`, error.message)
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime
    }
  }
}

/**
 * Webhook processing processor
 * Handles batch processing of emails from webhook notifications
 */
export async function processWebhookProcessing(
  job: QueueJob<WebhookProcessingJobData>
): Promise<ProcessingResult> {
  const startTime = Date.now()
  const { userId, emailIds, source } = job.data

  try {
    console.log(`📬 Processing webhook notification for ${emailIds.length} emails`)

    const supabase = await createClient()
    const { getEmailQueue } = await import('./email-queue')
    const queue = getEmailQueue()

    // Fetch email details
    const { data: emails, error: fetchError } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .in('id', emailIds)

    if (fetchError || !emails) {
      return {
        success: false,
        error: `Failed to fetch emails: ${fetchError?.message}`,
        processingTime: Date.now() - startTime
      }
    }

    // Enqueue individual scoring jobs for each email
    const scoringJobs: Promise<string>[] = []
    for (const email of emails) {
      const jobPromise = queue.enqueueEmailScoring({
        userId,
        emailId: email.id,
        subject: email.subject || '',
        from: email.from_email || '',
        snippet: email.snippet || '',
        isImportant: email.is_important || false,
        isStarred: email.is_starred || false,
        isUnread: email.is_unread || false,
      }, 6) // Medium-high priority for webhook processing

      scoringJobs.push(jobPromise)
    }

    // Wait for all jobs to be enqueued
    const enqueuedJobIds = await Promise.all(scoringJobs)

    console.log(`✅ Webhook processing completed: enqueued ${enqueuedJobIds.length} scoring jobs`)

    return {
      success: true,
      data: {
        emailsProcessed: emails.length,
        enqueuedJobs: enqueuedJobIds.length,
        source
      },
      processingTime: Date.now() - startTime
    }

  } catch (error: any) {
    console.error(`❌ Error processing webhook for ${emailIds.length} emails:`, error.message)
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime
    }
  }
}