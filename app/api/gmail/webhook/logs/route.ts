import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { gmailWebhookManager } from '@/lib/gmail/webhook-utils'

/**
 * Webhook Logs API
 * Provides webhook processing logs and analytics
 */

/**
 * GET - Retrieve webhook logs and analytics
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')
    const days = parseInt(searchParams.get('days') || '7')

    // Get webhook logs
    let query = supabase
      .from('webhook_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('processed_at', { ascending: false })
      .limit(Math.min(limit, 200)) // Cap at 200

    if (status && ['success', 'failed', 'no_new_emails'].includes(status)) {
      query = query.eq('status', status)
    }

    // Filter by date range
    if (days > 0) {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      query = query.gte('processed_at', startDate.toISOString())
    }

    const { data: logs, error: logsError } = await query

    if (logsError) {
      throw logsError
    }

    // Get webhook statistics
    const stats = await gmailWebhookManager.getWebhookStats(user.id, days)

    // Get recent error logs for debugging
    const { data: recentErrors } = await supabase
      .from('webhook_logs')
      .select('processed_at, error_message, retry_count')
      .eq('user_id', user.id)
      .eq('status', 'failed')
      .order('processed_at', { ascending: false })
      .limit(10)

    // Calculate hourly breakdown for the last 24 hours
    const hourlyStats = await calculateHourlyStats(supabase, user.id)

    return NextResponse.json({
      success: true,
      logs: logs || [],
      stats,
      recentErrors: recentErrors || [],
      hourlyStats,
      pagination: {
        limit,
        total: logs?.length || 0,
        hasMore: (logs?.length || 0) === limit
      }
    })

  } catch (error) {
    console.error('❌ Failed to get webhook logs:', error)
    return NextResponse.json(
      {
        error: 'Failed to get webhook logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Clean up old webhook logs
 */
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const deletedCount = await gmailWebhookManager.cleanupOldLogs()

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} old webhook logs`,
      deletedCount
    })

  } catch (error) {
    console.error('❌ Failed to cleanup webhook logs:', error)
    return NextResponse.json(
      {
        error: 'Failed to cleanup webhook logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Calculates hourly webhook statistics for the last 24 hours
 */
async function calculateHourlyStats(supabase: any, userId: string) {
  try {
    const { data } = await supabase
      .from('webhook_logs')
      .select('processed_at, status, email_count')
      .eq('user_id', userId)
      .gte('processed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (!data) return []

    // Group by hour
    const hourlyData: { [key: string]: {
      hour: string
      total: number
      successful: number
      failed: number
      emailsProcessed: number
    }} = {}

    data.forEach(log => {
      const hour = new Date(log.processed_at).toISOString().slice(0, 13) + ':00:00.000Z'

      if (!hourlyData[hour]) {
        hourlyData[hour] = {
          hour,
          total: 0,
          successful: 0,
          failed: 0,
          emailsProcessed: 0
        }
      }

      hourlyData[hour].total++
      if (log.status === 'success') {
        hourlyData[hour].successful++
      } else if (log.status === 'failed') {
        hourlyData[hour].failed++
      }
      hourlyData[hour].emailsProcessed += log.email_count || 0
    })

    // Convert to array and sort by hour
    return Object.values(hourlyData).sort((a, b) => a.hour.localeCompare(b.hour))

  } catch (error) {
    console.error('❌ Failed to calculate hourly stats:', error)
    return []
  }
}