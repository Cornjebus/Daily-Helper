import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { gmailWebhookManager } from '@/lib/gmail/webhook-utils'

/**
 * Gmail Webhook Management API
 * Handles subscription creation, renewal, and monitoring
 */

/**
 * GET - Get webhook status and statistics
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get active subscriptions
    const subscriptions = await gmailWebhookManager.getActiveSubscriptions(user.id)

    // Get webhook statistics
    const stats = await gmailWebhookManager.getWebhookStats(user.id, 7)

    // Validate webhook setup
    const validation = await gmailWebhookManager.validateWebhookSetup(user.id)

    return NextResponse.json({
      success: true,
      subscriptions,
      stats,
      validation,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to get webhook status:', error)
    return NextResponse.json(
      {
        error: 'Failed to get webhook status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST - Create or renew webhook subscription
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { action, subscriptionName } = body

    switch (action) {
      case 'create':
        return await handleCreateSubscription(user.id, subscriptionName, request)

      case 'renew':
        return await handleRenewSubscriptions(user.id)

      case 'stop':
        return await handleStopSubscription(user.id, subscriptionName)

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: create, renew, or stop' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Webhook management error:', error)
    return NextResponse.json(
      {
        error: 'Webhook management failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Stop webhook subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { subscriptionName } = await request.json()

    const success = await gmailWebhookManager.stopPushSubscription(user.id, subscriptionName)

    return NextResponse.json({
      success,
      message: success
        ? 'Webhook subscription stopped successfully'
        : 'Failed to stop webhook subscription'
    })

  } catch (error) {
    console.error('❌ Failed to stop webhook subscription:', error)
    return NextResponse.json(
      {
        error: 'Failed to stop webhook subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Handles creating a new webhook subscription
 */
async function handleCreateSubscription(
  userId: string,
  subscriptionName?: string,
  request?: NextRequest
): Promise<NextResponse> {
  try {
    // Generate subscription details
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'
    const pushEndpoint = `${baseUrl}/api/gmail/webhook`
    const topicName = process.env.GMAIL_PUBSUB_TOPIC || 'projects/your-project/topics/gmail-webhook'
    const subName = subscriptionName || `gmail-webhook-${userId}-${Date.now()}`

    // Validate Gmail connection first
    const supabase = await createClient()
    const { data: gmailToken } = await supabase
      .from('gmail_tokens')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!gmailToken) {
      return NextResponse.json(
        {
          error: 'Gmail not connected',
          message: 'Please connect your Gmail account before setting up webhooks'
        },
        { status: 400 }
      )
    }

    // Create the subscription
    const success = await gmailWebhookManager.createPushSubscription({
      userId,
      topicName,
      pushEndpoint,
      subscriptionName: subName
    })

    if (!success) {
      return NextResponse.json(
        {
          error: 'Failed to create webhook subscription',
          message: 'Check Gmail API configuration and permissions'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook subscription created successfully',
      subscription: {
        name: subName,
        endpoint: pushEndpoint,
        topicName
      }
    })

  } catch (error) {
    console.error('❌ Failed to create subscription:', error)
    return NextResponse.json(
      {
        error: 'Failed to create webhook subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Handles renewing expiring subscriptions
 */
async function handleRenewSubscriptions(userId: string): Promise<NextResponse> {
  try {
    const renewedCount = await gmailWebhookManager.renewExpiringSubscriptions()

    return NextResponse.json({
      success: true,
      message: `Renewed ${renewedCount} expiring subscriptions`,
      renewedCount
    })

  } catch (error) {
    console.error('❌ Failed to renew subscriptions:', error)
    return NextResponse.json(
      {
        error: 'Failed to renew subscriptions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Handles stopping a webhook subscription
 */
async function handleStopSubscription(
  userId: string,
  subscriptionName?: string
): Promise<NextResponse> {
  try {
    const success = await gmailWebhookManager.stopPushSubscription(userId, subscriptionName)

    return NextResponse.json({
      success,
      message: success
        ? 'Webhook subscription stopped successfully'
        : 'Failed to stop webhook subscription'
    })

  } catch (error) {
    console.error('❌ Failed to stop subscription:', error)
    return NextResponse.json(
      {
        error: 'Failed to stop webhook subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}