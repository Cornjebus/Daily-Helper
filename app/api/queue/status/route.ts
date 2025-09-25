import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkerPool } from '@/lib/queue/worker-pool'

/**
 * Queue status and monitoring endpoint
 * GET /api/queue/status
 */
export async function GET() {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get worker pool status
    const workerPool = getWorkerPool()
    const status = workerPool.getStatus()

    // Add system health information
    const healthInfo = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
    }

    return NextResponse.json({
      success: true,
      queue: status,
      system: healthInfo,
    })

  } catch (error: any) {
    console.error('❌ Error getting queue status:', error.message)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get queue status',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * Queue control endpoint
 * POST /api/queue/status
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action } = body

    const workerPool = getWorkerPool()

    switch (action) {
      case 'initialize':
        await workerPool.initialize()
        return NextResponse.json({
          success: true,
          message: 'Worker pool initialized'
        })

      case 'shutdown':
        await workerPool.shutdown()
        return NextResponse.json({
          success: true,
          message: 'Worker pool shutdown'
        })

      case 'retry_failed':
        const limit = body.limit || 10
        const retriedCount = await workerPool.retryFailedJobs(limit)
        return NextResponse.json({
          success: true,
          message: `Retried ${retriedCount} failed jobs`,
          retriedCount
        })

      case 'process_immediate':
        const { emailIds, type } = body
        if (!emailIds || !Array.isArray(emailIds) || !type) {
          return NextResponse.json(
            { error: 'Missing required fields: emailIds, type' },
            { status: 400 }
          )
        }

        const jobIds = await workerPool.processImmediate({
          type,
          userId: user.id,
          emailIds
        })

        return NextResponse.json({
          success: true,
          message: `Enqueued ${jobIds.length} immediate processing jobs`,
          jobIds
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error: any) {
    console.error('❌ Error controlling queue:', error.message)
    return NextResponse.json(
      {
        success: false,
        error: 'Queue control failed',
        details: error.message,
      },
      { status: 500 }
    )
  }
}