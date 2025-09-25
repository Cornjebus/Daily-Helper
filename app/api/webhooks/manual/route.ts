import { NextRequest, NextResponse } from 'next/server'
import { routeWebhook } from '@/lib/automation/webhook-handler'

/**
 * Manual webhook handler for testing and forced processing
 * Allows manual triggering of email processing for specific users or emails
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Manual webhook endpoint hit')

    // Parse the request body
    const body = await request.json()

    // Validate required fields
    if (!body.userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Optional: Add authentication/authorization check here
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    // For now, accept any bearer token (implement proper auth as needed)
    const token = authHeader.replace('Bearer ', '')
    if (token.length < 10) { // Basic token validation
      return NextResponse.json(
        { error: 'Invalid authorization token' },
        { status: 401 }
      )
    }

    // Process the webhook through the handler
    const result = await routeWebhook('manual', {
      userId: body.userId,
      emailIds: body.emailIds,
      forceAI: body.forceAI || false
    })

    console.log(`✅ Manual webhook processed: ${result.processed} emails, success: ${result.success}`)

    if (result.errors.length > 0) {
      console.error('⚠️ Manual processing errors:', result.errors)
    }

    return NextResponse.json({
      success: result.success,
      processed: result.processed,
      errors: result.errors.length > 0 ? result.errors : undefined,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Manual webhook error:', error)

    return NextResponse.json(
      {
        error: 'Manual processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * GET handler for manual processing status and documentation
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')

  if (userId) {
    try {
      // Get processing statistics for the user
      const { getProcessingStats } = await import('@/lib/automation/auto-processor')
      const stats = await getProcessingStats(userId, 7) // Last 7 days

      return NextResponse.json({
        userId,
        stats,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      console.error('❌ Error getting processing stats:', error)

      return NextResponse.json(
        {
          error: 'Failed to get processing stats',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      )
    }
  }

  // Return API documentation
  return NextResponse.json({
    endpoint: '/api/webhooks/manual',
    description: 'Manual email processing webhook',
    methods: {
      POST: {
        description: 'Trigger manual email processing',
        headers: {
          'Authorization': 'Bearer <token>',
          'Content-Type': 'application/json'
        },
        body: {
          userId: 'string (required) - User ID to process emails for',
          emailIds: 'string[] (optional) - Specific email IDs to process',
          forceAI: 'boolean (optional) - Force AI processing regardless of rules'
        },
        responses: {
          200: 'Processing completed successfully',
          400: 'Invalid request parameters',
          401: 'Authentication required',
          500: 'Processing failed'
        }
      },
      GET: {
        description: 'Get processing statistics',
        parameters: {
          userId: 'string (optional) - Get stats for specific user'
        }
      }
    },
    examples: {
      processAllRecent: {
        method: 'POST',
        body: {
          userId: 'user-123',
          forceAI: false
        }
      },
      processSpecificEmails: {
        method: 'POST',
        body: {
          userId: 'user-123',
          emailIds: ['email-1', 'email-2'],
          forceAI: true
        }
      }
    }
  })
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