import { createClient } from '@/lib/supabase/server'
import { processEmailAutomatic, processEmailImmediate } from './auto-processor'

/**
 * Webhook handler for Gmail push notifications
 * Processes incoming email notifications and triggers automatic scoring
 */
export async function handleGmailWebhook(payload: {
  message: {
    data: string
    messageId: string
    publishTime: string
  }
  subscription: string
}): Promise<{ success: boolean; processed: number; errors: string[] }> {
  const errors: string[] = []
  let processed = 0

  try {
    console.log('📧 Gmail webhook received:', {
      messageId: payload.message.messageId,
      publishTime: payload.message.publishTime,
      subscription: payload.subscription
    })

    // Decode the pub/sub message
    const decodedData = Buffer.from(payload.message.data, 'base64').toString('utf-8')
    const webhookData = JSON.parse(decodedData)

    console.log('📨 Decoded webhook data:', webhookData)

    // Extract user information from the subscription or webhook data
    // This assumes the subscription name includes the user ID
    const userIdMatch = payload.subscription.match(/user-([^-]+)/)
    if (!userIdMatch) {
      throw new Error('Could not extract user ID from subscription')
    }

    const userId = userIdMatch[1]
    const historyId = webhookData.historyId

    if (!historyId) {
      console.log('⚠️ No historyId in webhook data, skipping processing')
      return { success: true, processed: 0, errors: [] }
    }

    // Fetch new emails since the last history ID
    const newEmails = await fetchNewEmailsSinceHistory(userId, historyId)

    if (newEmails.length === 0) {
      console.log('📭 No new emails to process')
      return { success: true, processed: 0, errors: [] }
    }

    console.log(`🚀 Processing ${newEmails.length} new emails for user ${userId}`)

    // Process emails through the automatic processor
    await Promise.all(
      newEmails.map(async (email) => {
        try {
          await processEmailAutomatic(email)
          processed++
        } catch (error) {
          const errorMsg = `Failed to process email ${email.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error('❌', errorMsg)
          errors.push(errorMsg)
        }
      })
    )

    // Update the last processed history ID
    await updateLastHistoryId(userId, historyId)

    console.log(`✅ Webhook processing complete. Processed: ${processed}, Errors: ${errors.length}`)

    return {
      success: errors.length === 0,
      processed,
      errors
    }

  } catch (error) {
    const errorMsg = `Webhook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.error('❌', errorMsg)
    errors.push(errorMsg)

    return {
      success: false,
      processed,
      errors
    }
  }
}

/**
 * Fetch new emails since the last history ID using Gmail API
 */
async function fetchNewEmailsSinceHistory(userId: string, historyId: string): Promise<Array<{
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
}>> {
  const supabase = await createClient()

  try {
    // Get user's Gmail access token
    const { data: user } = await supabase
      .from('user_accounts')
      .select('gmail_access_token, gmail_refresh_token, last_history_id')
      .eq('id', userId)
      .single()

    if (!user?.gmail_access_token) {
      throw new Error('No Gmail access token found for user')
    }

    const lastHistoryId = user.last_history_id || '0'

    // If the incoming historyId is not greater than our last processed one, skip
    if (parseInt(historyId) <= parseInt(lastHistoryId)) {
      console.log(`📅 HistoryId ${historyId} not newer than last processed ${lastHistoryId}, skipping`)
      return []
    }

    // Use Gmail API to get history changes
    const gmailService = await import('@/lib/gmail/service')
    const emails = await gmailService.fetchEmailsSinceHistory(user.gmail_access_token, lastHistoryId)

    // Transform Gmail API response to our email format
    const transformedEmails = emails.map(email => ({
      id: email.id,
      user_id: userId,
      subject: email.payload?.headers?.find(h => h.name === 'Subject')?.value || null,
      from_email: email.payload?.headers?.find(h => h.name === 'From')?.value?.match(/<(.+)>/)?.[1] ||
                  email.payload?.headers?.find(h => h.name === 'From')?.value || null,
      snippet: email.snippet || null,
      is_important: email.labelIds?.includes('IMPORTANT') || false,
      is_starred: email.labelIds?.includes('STARRED') || false,
      is_unread: email.labelIds?.includes('UNREAD') || false,
      received_at: new Date(parseInt(email.internalDate || '0')).toISOString(),
      thread_id: email.threadId || null
    }))

    // Store emails in database if not already exists
    if (transformedEmails.length > 0) {
      const { error: insertError } = await supabase
        .from('emails')
        .upsert(transformedEmails, {
          onConflict: 'id',
          ignoreDuplicates: true
        })

      if (insertError) {
        console.error('❌ Error storing emails:', insertError)
      } else {
        console.log(`📧 Stored ${transformedEmails.length} emails in database`)
      }
    }

    return transformedEmails

  } catch (error) {
    console.error('❌ Error fetching new emails:', error)
    throw error
  }
}

/**
 * Update the last processed history ID for a user
 */
async function updateLastHistoryId(userId: string, historyId: string): Promise<void> {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('user_accounts')
      .update({
        last_history_id: historyId,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (error) {
      console.error('❌ Error updating last history ID:', error)
      throw error
    }

    console.log(`✅ Updated last history ID to ${historyId} for user ${userId}`)

  } catch (error) {
    console.error('❌ Failed to update history ID:', error)
    throw error
  }
}

/**
 * Manual webhook handler for testing or forced processing
 */
export async function handleManualWebhook(payload: {
  userId: string
  emailIds?: string[]
  forceAI?: boolean
}): Promise<{ success: boolean; processed: number; errors: string[] }> {
  const errors: string[] = []
  let processed = 0

  try {
    console.log('🔧 Manual webhook processing:', payload)

    const supabase = await createClient()

    // Get emails to process
    let query = supabase
      .from('emails')
      .select('id, user_id, subject, from_email, snippet, is_important, is_starred, is_unread, received_at, thread_id')
      .eq('user_id', payload.userId)

    if (payload.emailIds?.length) {
      query = query.in('id', payload.emailIds)
    } else {
      // Process unprocessed emails from last 24 hours
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      query = query
        .gte('received_at', yesterday.toISOString())
        .is('processed_at', null)
    }

    const { data: emails, error } = await query

    if (error) {
      throw error
    }

    if (!emails?.length) {
      console.log('📭 No emails found for manual processing')
      return { success: true, processed: 0, errors: [] }
    }

    console.log(`🚀 Manual processing ${emails.length} emails`)

    // Process emails
    if (payload.forceAI) {
      // Use immediate processing with AI for high-priority manual requests
      await Promise.all(
        emails.map(async (email) => {
          try {
            await processEmailImmediate(email)
            processed++
          } catch (error) {
            const errorMsg = `Failed to process email ${email.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
            console.error('❌', errorMsg)
            errors.push(errorMsg)
          }
        })
      )
    } else {
      // Use automatic processing with batching
      await Promise.all(
        emails.map(async (email) => {
          try {
            await processEmailAutomatic(email)
            processed++
          } catch (error) {
            const errorMsg = `Failed to process email ${email.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
            console.error('❌', errorMsg)
            errors.push(errorMsg)
          }
        })
      )
    }

    console.log(`✅ Manual processing complete. Processed: ${processed}, Errors: ${errors.length}`)

    return {
      success: errors.length === 0,
      processed,
      errors
    }

  } catch (error) {
    const errorMsg = `Manual webhook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.error('❌', errorMsg)
    errors.push(errorMsg)

    return {
      success: false,
      processed,
      errors
    }
  }
}

/**
 * Webhook handler for Outlook/Exchange push notifications
 * (Future implementation for multi-provider support)
 */
export async function handleOutlookWebhook(payload: any): Promise<{ success: boolean; processed: number; errors: string[] }> {
  console.log('📧 Outlook webhook received (not implemented yet):', payload)

  return {
    success: true,
    processed: 0,
    errors: ['Outlook webhook processing not implemented yet']
  }
}

/**
 * Generic webhook router based on provider
 */
export async function routeWebhook(provider: string, payload: any): Promise<{ success: boolean; processed: number; errors: string[] }> {
  switch (provider.toLowerCase()) {
    case 'gmail':
    case 'google':
      return await handleGmailWebhook(payload)

    case 'outlook':
    case 'microsoft':
      return await handleOutlookWebhook(payload)

    case 'manual':
      return await handleManualWebhook(payload)

    default:
      console.error(`❌ Unknown webhook provider: ${provider}`)
      return {
        success: false,
        processed: 0,
        errors: [`Unknown webhook provider: ${provider}`]
      }
  }
}

/**
 * Webhook health check and diagnostics
 */
export async function webhookHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  services: {
    database: boolean
    gmail: boolean
    processing: boolean
  }
  lastProcessed?: Date
  queueSize: number
}> {
  const services = {
    database: false,
    gmail: false,
    processing: false
  }

  try {
    // Test database connection
    const supabase = await createClient()
    const { error: dbError } = await supabase
      .from('emails')
      .select('id')
      .limit(1)

    services.database = !dbError

    // Test Gmail service (basic health check)
    try {
      const gmailService = await import('@/lib/gmail/service')
      services.gmail = true // If module loads successfully
    } catch (gmailError) {
      console.error('Gmail service check failed:', gmailError)
    }

    // Test processing system
    try {
      const { healthCheck } = await import('./auto-processor')
      const processingHealth = await healthCheck()
      services.processing = processingHealth.status !== 'unhealthy'
    } catch (processingError) {
      console.error('Processing system check failed:', processingError)
    }

    const healthyServices = Object.values(services).filter(Boolean).length
    const totalServices = Object.keys(services).length

    const status = healthyServices === totalServices ? 'healthy' :
                  healthyServices > totalServices / 2 ? 'degraded' : 'unhealthy'

    return {
      status,
      services,
      lastProcessed: new Date(),
      queueSize: 0 // Would get from processing queue if available
    }

  } catch (error) {
    console.error('❌ Webhook health check failed:', error)

    return {
      status: 'unhealthy',
      services,
      queueSize: -1
    }
  }
}