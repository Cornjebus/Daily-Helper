import { NextRequest, NextResponse } from 'next/server'
import { routeWebhook } from '@/lib/automation/webhook-handler'

/**
 * Gmail Pub/Sub webhook handler
 * Handles push notifications from Gmail when new emails arrive
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📧 Gmail webhook endpoint hit')

    // Parse the pub/sub message
    const body = await request.json()

    // Validate the webhook payload structure
    if (!body.message || !body.message.data) {
      console.error('❌ Invalid webhook payload structure')
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      )
    }

    // Verify this is a Gmail pub/sub message
    if (!body.subscription || !body.subscription.includes('gmail')) {
      console.error('❌ Not a Gmail subscription:', body.subscription)
      return NextResponse.json(
        { error: 'Invalid subscription source' },
        { status: 400 }
      )
    }

    // Process the webhook through the handler
    const result = await routeWebhook('gmail', body)

    // Log results
    console.log(`✅ Gmail webhook processed: ${result.processed} emails, success: ${result.success}`)

    if (result.errors.length > 0) {
      console.error('⚠️ Webhook processing errors:', result.errors)
    }

    // Return success response (Gmail expects 200 OK to acknowledge receipt)
    return NextResponse.json({
      success: result.success,
      processed: result.processed,
      errors: result.errors.length > 0 ? result.errors : undefined
    })

  } catch (error) {
    console.error('❌ Gmail webhook error:', error)

    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET handler for webhook verification and health checks
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Gmail webhook health check')

    const { webhookHealthCheck } = await import('@/lib/automation/webhook-handler')
    const health = await webhookHealthCheck()

    return NextResponse.json({
      status: health.status,
      services: health.services,
      timestamp: new Date().toISOString(),
      endpoint: 'gmail-webhook'
    })

  } catch (error) {
    console.error('❌ Gmail webhook health check failed:', error)

    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        endpoint: 'gmail-webhook'
      },
      { status: 500 }
    )
  }
}

// Handle OPTIONS for CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}