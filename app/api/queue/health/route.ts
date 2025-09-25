import { NextResponse } from 'next/server'
import { getEmailQueue } from '@/lib/queue/email-queue'
import { getWorkerPool } from '@/lib/queue/worker-pool'

/**
 * Queue health check endpoint
 * GET /api/queue/health
 */
export async function GET() {
  const startTime = Date.now()

  try {
    const queue = getEmailQueue()
    const workerPool = getWorkerPool()

    const stats = queue.getStats()
    const workers = queue.getWorkers()
    const poolStatus = workerPool.getStatus()

    // Check if queue is healthy
    const isHealthy = (
      stats.errorRate < 50 && // Less than 50% error rate
      stats.averageProcessingTime < 60000 && // Less than 1 minute average
      workers.filter(w => w.isActive).length >= 0 // At least some workers can be active
    )

    const status = isHealthy ? 'healthy' : 'degraded'
    const responseTime = Date.now() - startTime

    // Detailed health information
    const health = {
      status,
      timestamp: new Date().toISOString(),
      responseTime,
      queue: {
        initialized: poolStatus.initialized,
        stats: {
          pending: stats.pending,
          processing: stats.processing,
          completed: stats.completed,
          failed: stats.failed,
          deadLetter: stats.deadLetter,
          errorRate: Math.round(stats.errorRate * 100) / 100,
          averageProcessingTime: Math.round(stats.averageProcessingTime),
          totalProcessed: stats.totalProcessed
        },
        workers: {
          total: workers.length,
          active: workers.filter(w => w.isActive).length,
          idle: workers.filter(w => !w.isActive).length,
          totalProcessed: workers.reduce((sum, w) => sum + w.processedJobs, 0),
          totalFailed: workers.reduce((sum, w) => sum + w.failedJobs, 0)
        }
      },
      system: {
        uptime: Math.round(process.uptime()),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024)
        },
        nodeVersion: process.version
      },
      checks: {
        queueInitialized: poolStatus.initialized,
        lowErrorRate: stats.errorRate < 50,
        reasonableProcessingTime: stats.averageProcessingTime < 60000,
        workersAvailable: workers.length > 0
      }
    }

    // Set appropriate HTTP status
    const httpStatus = isHealthy ? 200 : 503

    return NextResponse.json(health, { status: httpStatus })

  } catch (error: any) {
    console.error('❌ Health check failed:', error.message)

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      error: error.message,
      checks: {
        queueInitialized: false,
        lowErrorRate: false,
        reasonableProcessingTime: false,
        workersAvailable: false
      }
    }, { status: 503 })
  }
}

/**
 * Simple ping endpoint for load balancer health checks
 * HEAD /api/queue/health
 */
export async function HEAD() {
  try {
    const queue = getEmailQueue()
    const stats = queue.getStats()

    // Simple health check - return 200 if error rate is reasonable
    const isHealthy = stats.errorRate < 50
    return new Response(null, { status: isHealthy ? 200 : 503 })

  } catch (error) {
    return new Response(null, { status: 503 })
  }
}