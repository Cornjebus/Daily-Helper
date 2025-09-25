import { NextResponse } from 'next/server'
import { gmailWebhookManager } from '@/lib/gmail/webhook-utils'

/**
 * Webhook Maintenance Cron Job
 * Handles automatic renewal of expiring subscriptions and cleanup of old logs
 *
 * Configure in Vercel Cron Jobs:
 * - Path: /api/cron/webhook-maintenance
 * - Schedule: 0 6 * * * (daily at 6 AM UTC)
 */

export async function GET() {
  const startTime = Date.now()

  try {
    console.log('🔧 Starting webhook maintenance at:', new Date().toISOString())

    // Validate cron job authentication
    const authHeader = process.env.CRON_SECRET
    const providedSecret = process.env.VERCEL_ENV === 'production'
      ? process.env.VERCEL_CRON_SECRET
      : authHeader

    if (!providedSecret) {
      console.warn('⚠️ No cron secret configured, allowing maintenance in development')
    }

    const results = {
      renewedSubscriptions: 0,
      cleanedLogs: 0,
      errors: [] as string[]
    }

    // Step 1: Renew expiring subscriptions
    try {
      console.log('🔄 Checking for expiring webhook subscriptions...')
      const renewedCount = await gmailWebhookManager.renewExpiringSubscriptions()
      results.renewedSubscriptions = renewedCount

      if (renewedCount > 0) {
        console.log(`✅ Renewed ${renewedCount} expiring subscriptions`)
      } else {
        console.log('📄 No subscriptions needed renewal')
      }

    } catch (error) {
      const errorMsg = `Failed to renew subscriptions: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.error('❌', errorMsg)
      results.errors.push(errorMsg)
    }

    // Step 2: Clean up old webhook logs
    try {
      console.log('🧹 Cleaning up old webhook logs...')
      const cleanedCount = await gmailWebhookManager.cleanupOldLogs()
      results.cleanedLogs = cleanedCount

      if (cleanedCount > 0) {
        console.log(`✅ Cleaned up ${cleanedCount} old log entries`)
      } else {
        console.log('📄 No old logs to clean up')
      }

    } catch (error) {
      const errorMsg = `Failed to cleanup logs: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.error('❌', errorMsg)
      results.errors.push(errorMsg)
    }

    const duration = Date.now() - startTime
    const success = results.errors.length === 0

    console.log(`${success ? '✅' : '⚠️'} Webhook maintenance completed in ${duration}ms`)

    return NextResponse.json({
      success,
      duration,
      timestamp: new Date().toISOString(),
      results: {
        renewedSubscriptions: results.renewedSubscriptions,
        cleanedLogs: results.cleanedLogs,
        totalErrors: results.errors.length,
        errors: results.errors
      },
      message: success
        ? 'Webhook maintenance completed successfully'
        : 'Webhook maintenance completed with some errors'
    })

  } catch (error) {
    const duration = Date.now() - startTime

    console.error('❌ Webhook maintenance failed:', error)

    return NextResponse.json(
      {
        success: false,
        duration,
        timestamp: new Date().toISOString(),
        error: 'Webhook maintenance failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function POST() {
  return NextResponse.json({
    service: 'webhook-maintenance',
    status: 'ready',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'development'
  })
}