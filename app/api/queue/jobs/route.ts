import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmailQueue } from '@/lib/queue/email-queue'

/**
 * Queue jobs management endpoint
 * GET /api/queue/jobs - Get job details
 * POST /api/queue/jobs - Create new jobs
 * DELETE /api/queue/jobs - Remove jobs
 */

export async function GET(request: Request) {
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

    const url = new URL(request.url)
    const jobId = url.searchParams.get('jobId')

    const queue = getEmailQueue()

    if (jobId) {
      // Get specific job
      const job = queue.getJob(jobId)

      if (!job) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        )
      }

      // Only return jobs for the authenticated user
      if (job.userId !== user.id) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }

      return NextResponse.json({
        success: true,
        job: {
          id: job.id,
          type: job.type,
          priority: job.priority,
          retries: job.retries,
          maxRetries: job.maxRetries,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          scheduledAt: job.scheduledAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          failedAt: job.failedAt,
          error: job.error,
          metadata: job.metadata,
        }
      })
    } else {
      // Get stats only (no access to all jobs for privacy)
      const stats = queue.getStats()
      return NextResponse.json({
        success: true,
        stats
      })
    }

  } catch (error: any) {
    console.error('❌ Error getting jobs:', error.message)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get jobs',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

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
    const { type, data, priority = 5, delay = 0 } = body

    if (!type || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: type, data' },
        { status: 400 }
      )
    }

    const queue = getEmailQueue()
    let jobId: string

    // Validate and create job based on type
    switch (type) {
      case 'email_scoring':
        if (!data.emailId || !data.userId) {
          return NextResponse.json(
            { error: 'Email scoring jobs require emailId and userId' },
            { status: 400 }
          )
        }

        // Ensure user can only create jobs for themselves
        if (data.userId !== user.id) {
          return NextResponse.json(
            { error: 'Can only create jobs for your own account' },
            { status: 403 }
          )
        }

        jobId = await queue.enqueueEmailScoring(data, priority)
        break

      case 'email_summarization':
        if (!data.threadId || !data.userId) {
          return NextResponse.json(
            { error: 'Email summarization jobs require threadId and userId' },
            { status: 400 }
          )
        }

        // Ensure user can only create jobs for themselves
        if (data.userId !== user.id) {
          return NextResponse.json(
            { error: 'Can only create jobs for your own account' },
            { status: 403 }
          )
        }

        jobId = await queue.enqueueEmailSummarization(data, priority)
        break

      case 'webhook_processing':
        if (!data.emailIds || !data.userId) {
          return NextResponse.json(
            { error: 'Webhook processing jobs require emailIds and userId' },
            { status: 400 }
          )
        }

        // Ensure user can only create jobs for themselves
        if (data.userId !== user.id) {
          return NextResponse.json(
            { error: 'Can only create jobs for your own account' },
            { status: 403 }
          )
        }

        jobId = await queue.enqueueWebhookProcessing(data, priority)
        break

      default:
        return NextResponse.json(
          { error: 'Invalid job type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      message: 'Job created successfully',
      jobId,
      type,
      priority
    })

  } catch (error: any) {
    console.error('❌ Error creating job:', error.message)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create job',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
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

    const url = new URL(request.url)
    const jobId = url.searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId parameter' },
        { status: 400 }
      )
    }

    const queue = getEmailQueue()
    const job = queue.getJob(jobId)

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Only allow users to remove their own jobs
    if (job.userId !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const removed = queue.removeJob(jobId)

    if (removed) {
      return NextResponse.json({
        success: true,
        message: 'Job removed successfully',
        jobId
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to remove job' },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('❌ Error removing job:', error.message)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove job',
        details: error.message,
      },
      { status: 500 }
    )
  }
}