import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { fetchUserEmails } from '@/lib/gmail/service'
import crypto from 'crypto'

interface GmailWebhookPayload {
  message: {
    data: string // Base64 encoded JSON
    messageId: string
    publishTime: string
  }
  subscription: string
}

interface GmailNotificationData {
  emailAddress: string
  historyId: string
}

// Queue for processing webhook notifications
const webhookQueue: Array<{
  userId: string
  historyId: string
  timestamp: Date
  retryCount: number
}> = []

// Configuration
const WEBHOOK_SECRET = process.env.GMAIL_WEBHOOK_SECRET || ''
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 5000
const BATCH_PROCESSING_INTERVAL = 30000 // 30 seconds

/**
 * Gmail Push Notifications Webhook Handler
 * Receives notifications when new emails arrive and triggers automatic processing
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('📧 Gmail webhook received at:', new Date().toISOString())

    // Validate webhook signature for security
    const isValidSignature = await validateWebhookSignature(request)
    if (!isValidSignature) {
      console.error('❌ Invalid webhook signature')
      return NextResponse.json(
        { error: 'Unauthorized: Invalid signature' },
        { status: 401 }
      )
    }

    // Parse the webhook payload
    const payload: GmailWebhookPayload = await request.json()

    if (!payload.message?.data) {
      console.error('❌ Invalid webhook payload structure')
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      )
    }

    // Decode the notification data
    const notificationData = parseNotificationData(payload.message.data)
    if (!notificationData) {
      console.error('❌ Failed to parse notification data')
      return NextResponse.json(
        { error: 'Invalid notification data' },
        { status: 400 }
      )
    }

    console.log('✅ Webhook notification parsed:', {
      emailAddress: notificationData.emailAddress,
      historyId: notificationData.historyId,
      messageId: payload.message.messageId
    })

    // Find the user associated with this email address
    const userId = await findUserByEmail(notificationData.emailAddress)
    if (!userId) {
      console.warn('⚠️ No user found for email address:', notificationData.emailAddress)
      // Return 200 to acknowledge receipt but don't process
      return NextResponse.json({
        success: true,
        message: 'No user found for email address'
      })
    }

    // Queue the notification for processing
    await queueEmailProcessing(userId, notificationData.historyId)

    // Trigger immediate processing if queue is small
    if (webhookQueue.length <= 10) {
      setImmediate(() => processWebhookQueue())
    }

    const processingTime = Date.now() - startTime
    console.log(`✅ Webhook processed successfully in ${processingTime}ms`)

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      processingTime,
      queueSize: webhookQueue.length
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error('❌ Webhook processing error:', error)

    // Log detailed error information
    if (error instanceof Error) {
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        processingTime
      })
    }

    // Return 500 to trigger Gmail retry
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      },
      { status: 500 }
    )
  }
}

/**
 * Health check endpoint for the webhook
 */
export async function GET() {
  try {
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      queueSize: webhookQueue.length,
      service: 'Gmail Push Notifications Webhook'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    )
  }
}

/**
 * Validates the webhook signature using the shared secret
 */
async function validateWebhookSignature(request: NextRequest): Promise<boolean> {
  if (!WEBHOOK_SECRET) {
    console.warn('⚠️ No webhook secret configured, skipping signature validation')
    return true // Allow in development if no secret is set
  }

  try {
    const signature = request.headers.get('x-goog-signature') ||
                     request.headers.get('authorization')

    if (!signature) {
      return false
    }

    const body = await request.text()
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(body)
      .digest('base64')

    // Compare signatures using constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch (error) {
    console.error('❌ Signature validation error:', error)
    return false
  }
}

/**
 * Parses the base64 encoded notification data
 */
function parseNotificationData(encodedData: string): GmailNotificationData | null {
  try {
    const decodedData = Buffer.from(encodedData, 'base64').toString('utf-8')
    const data = JSON.parse(decodedData)

    if (!data.emailAddress || !data.historyId) {
      throw new Error('Missing required fields in notification data')
    }

    return {
      emailAddress: data.emailAddress,
      historyId: data.historyId
    }
  } catch (error) {
    console.error('❌ Failed to parse notification data:', error)
    return null
  }
}

/**
 * Finds the user ID associated with an email address
 */
async function findUserByEmail(emailAddress: string): Promise<string | null> {
  try {
    const supabase = await createClient()

    // Look up user by email in gmail_tokens table
    const { data: gmailToken } = await supabase
      .from('gmail_tokens')
      .select('user_id, email')
      .eq('email', emailAddress)
      .single()

    if (gmailToken) {
      return gmailToken.user_id
    }

    // Fallback: look up in users table
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', emailAddress)
      .single()

    return user?.id || null
  } catch (error) {
    console.error('❌ Error finding user by email:', error)
    return null
  }
}

/**
 * Queues email processing with deduplication
 */
async function queueEmailProcessing(userId: string, historyId: string): Promise<void> {
  // Check if this notification is already queued
  const existingItem = webhookQueue.find(
    item => item.userId === userId && item.historyId === historyId
  )

  if (existingItem) {
    console.log('📝 Notification already queued, skipping duplicate')
    return
  }

  // Add to queue
  webhookQueue.push({
    userId,
    historyId,
    timestamp: new Date(),
    retryCount: 0
  })

  console.log(`📥 Queued email processing for user ${userId}, queue size: ${webhookQueue.length}`)
}

/**
 * Processes queued webhook notifications with retry logic
 */
async function processWebhookQueue(): Promise<void> {
  if (webhookQueue.length === 0) {
    return
  }

  console.log(`🔄 Processing webhook queue with ${webhookQueue.length} items`)

  const itemsToProcess = webhookQueue.splice(0, 10) // Process up to 10 at a time
  const processingPromises = itemsToProcess.map(processQueueItem)

  const results = await Promise.allSettled(processingPromises)

  // Handle failed items
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const item = itemsToProcess[index]
      handleProcessingFailure(item, result.reason)
    }
  })
}

/**
 * Processes a single queue item
 */
async function processQueueItem(item: {
  userId: string
  historyId: string
  timestamp: Date
  retryCount: number
}): Promise<void> {
  const { userId, historyId, timestamp } = item

  try {
    console.log(`📧 Processing email notification for user ${userId}`)

    // Fetch new emails for the user
    const result = await fetchUserEmails(userId, 25)

    if (result.count > 0) {
      console.log(`✅ Fetched ${result.count} new emails for user ${userId}`)

      // Trigger AI processing for the new emails
      await triggerAIProcessing(userId)

      // Log successful processing
      await logWebhookProcessing(userId, historyId, 'success', result.count)
    } else {
      console.log(`📧 No new emails found for user ${userId}`)
      await logWebhookProcessing(userId, historyId, 'no_new_emails', 0)
    }

  } catch (error) {
    console.error(`❌ Failed to process notification for user ${userId}:`, error)
    throw error // Will be caught by Promise.allSettled
  }
}

/**
 * Handles processing failures with retry logic
 */
function handleProcessingFailure(
  item: { userId: string; historyId: string; timestamp: Date; retryCount: number },
  error: any
): void {
  console.error(`❌ Processing failed for user ${item.userId}:`, error)

  item.retryCount++

  if (item.retryCount < MAX_RETRIES) {
    // Add back to queue for retry with delay
    setTimeout(() => {
      webhookQueue.push(item)
      console.log(`🔄 Retrying processing for user ${item.userId} (attempt ${item.retryCount + 1})`)
    }, RETRY_DELAY_MS * item.retryCount) // Exponential backoff
  } else {
    console.error(`❌ Max retries reached for user ${item.userId}, giving up`)
    // Log the failure
    logWebhookProcessing(item.userId, item.historyId, 'failed', 0, error?.message)
  }
}

/**
 * Triggers AI processing for newly received emails
 */
async function triggerAIProcessing(userId: string): Promise<void> {
  try {
    console.log(`🤖 Triggering AI processing for user ${userId}`)

    // Call the existing AI processing endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/process-emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.API_SECRET_KEY || 'internal-webhook-call'}`
      },
      body: JSON.stringify({ userId, source: 'webhook' })
    })

    if (!response.ok) {
      throw new Error(`AI processing failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    console.log('✅ AI processing triggered successfully:', result)

  } catch (error) {
    console.error('❌ Failed to trigger AI processing:', error)
    // Don't throw here - webhook processing should succeed even if AI processing fails
  }
}

/**
 * Logs webhook processing results
 */
async function logWebhookProcessing(
  userId: string,
  historyId: string,
  status: 'success' | 'failed' | 'no_new_emails',
  emailCount: number,
  errorMessage?: string
): Promise<void> {
  try {
    const supabase = await createClient()

    await supabase
      .from('webhook_logs')
      .insert({
        user_id: userId,
        service: 'gmail',
        history_id: historyId,
        status,
        email_count: emailCount,
        error_message: errorMessage,
        processed_at: new Date().toISOString()
      })
  } catch (error) {
    console.error('❌ Failed to log webhook processing:', error)
    // Don't throw - logging failure shouldn't break webhook processing
  }
}

// Set up batch processing interval
if (typeof global !== 'undefined') {
  setInterval(processWebhookQueue, BATCH_PROCESSING_INTERVAL)
}

// Export webhook queue for testing
export { webhookQueue }