import { deploymentConfig } from './deployment'

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  duration: number
  checks: Record<string, {
    status: 'healthy' | 'degraded' | 'unhealthy'
    message: string
    duration: number
    details?: any
  }>
}

export interface MetricPoint {
  name: string
  value: number
  timestamp: string
  tags?: Record<string, string>
}

export interface AlertRule {
  id: string
  name: string
  condition: string
  threshold: number
  duration: number // in milliseconds
  enabled: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  notifications: string[] // webhook URLs or email addresses
}

export class MonitoringService {
  private static instance: MonitoringService
  private healthCheckResults: HealthCheckResult[] = []
  private metrics: Map<string, MetricPoint[]> = new Map()
  private alerts: Map<string, AlertRule> = new Map()
  private alertStates: Map<string, { triggered: boolean; since: string }> = new Map()

  private constructor() {
    // Initialize default alert rules
    this.initializeDefaultAlerts()

    // Start background monitoring if enabled
    if (deploymentConfig.monitoring.metrics.enabled) {
      this.startMetricsCollection()
    }
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService()
    }
    return MonitoringService.instance
  }

  // Health check implementation
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    const checks: HealthCheckResult['checks'] = {}
    const config = deploymentConfig.monitoring.healthCheck

    console.log('🏥 Starting health check...')

    // Database health check
    if (config.checks.database) {
      checks.database = await this.checkDatabase()
    }

    // OpenAI API health check
    if (config.checks.openai) {
      checks.openai = await this.checkOpenAI()
    }

    // Redis health check
    if (config.checks.redis && deploymentConfig.cache.redis.url) {
      checks.redis = await this.checkRedis()
    }

    // System resource checks
    if (config.checks.memory) {
      checks.memory = await this.checkMemoryUsage()
    }

    if (config.checks.diskSpace) {
      checks.diskSpace = await this.checkDiskSpace()
    }

    // Determine overall status
    const statuses = Object.values(checks).map(check => check.status)
    let overallStatus: HealthCheckResult['status'] = 'healthy'

    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy'
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded'
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      checks
    }

    // Store result for history
    this.healthCheckResults.push(result)

    // Keep only last 100 results
    if (this.healthCheckResults.length > 100) {
      this.healthCheckResults = this.healthCheckResults.slice(-100)
    }

    console.log(`✅ Health check completed: ${overallStatus} (${result.duration}ms)`)

    return result
  }

  private async checkDatabase(): Promise<HealthCheckResult['checks'][string]> {
    const startTime = Date.now()

    try {
      // Import and test Supabase connection
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()

      const { error } = await supabase.from('emails').select('id').limit(1)

      if (error) {
        throw error
      }

      const duration = Date.now() - startTime

      return {
        status: duration > 2000 ? 'degraded' : 'healthy',
        message: `Database responsive (${duration}ms)`,
        duration,
        details: { responseTime: duration }
      }
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: `Database connection failed: ${error.message}`,
        duration: Date.now() - startTime,
        details: { error: error.message }
      }
    }
  }

  private async checkOpenAI(): Promise<HealthCheckResult['checks'][string]> {
    const startTime = Date.now()

    try {
      if (!deploymentConfig.apis.openai.apiKey) {
        return {
          status: 'degraded',
          message: 'OpenAI API key not configured',
          duration: Date.now() - startTime,
          details: { configured: false }
        }
      }

      // Test OpenAI health check from our AI module
      const { healthCheck } = await import('@/lib/ai/openai')
      const result = await healthCheck()

      return {
        status: result.status,
        message: result.message,
        duration: Date.now() - startTime,
        details: result.details
      }
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: `OpenAI health check failed: ${error.message}`,
        duration: Date.now() - startTime,
        details: { error: error.message }
      }
    }
  }

  private async checkRedis(): Promise<HealthCheckResult['checks'][string]> {
    const startTime = Date.now()

    try {
      // Mock Redis check - in real implementation, would test actual Redis connection
      const duration = Date.now() - startTime

      return {
        status: 'degraded',
        message: 'Redis check not implemented',
        duration,
        details: { implemented: false }
      }
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: `Redis check failed: ${error.message}`,
        duration: Date.now() - startTime,
        details: { error: error.message }
      }
    }
  }

  private async checkMemoryUsage(): Promise<HealthCheckResult['checks'][string]> {
    const startTime = Date.now()

    try {
      const usage = process.memoryUsage()
      const totalMemory = usage.heapUsed + usage.external
      const memoryUsageMB = Math.round(totalMemory / 1024 / 1024)

      // Rough estimate for memory health
      const memoryThreshold = 512 // 512MB
      const isHigh = memoryUsageMB > memoryThreshold

      return {
        status: isHigh ? 'degraded' : 'healthy',
        message: `Memory usage: ${memoryUsageMB}MB`,
        duration: Date.now() - startTime,
        details: {
          heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
          external: Math.round(usage.external / 1024 / 1024),
          rss: Math.round(usage.rss / 1024 / 1024)
        }
      }
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: `Memory check failed: ${error.message}`,
        duration: Date.now() - startTime,
        details: { error: error.message }
      }
    }
  }

  private async checkDiskSpace(): Promise<HealthCheckResult['checks'][string]> {
    const startTime = Date.now()

    try {
      // Mock disk space check - in real implementation, would check actual disk usage
      return {
        status: 'healthy',
        message: 'Disk space check not implemented',
        duration: Date.now() - startTime,
        details: { implemented: false }
      }
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: `Disk space check failed: ${error.message}`,
        duration: Date.now() - startTime,
        details: { error: error.message }
      }
    }
  }

  // Metrics collection
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    if (!deploymentConfig.monitoring.metrics.enabled) return

    const metric: MetricPoint = {
      name,
      value,
      timestamp: new Date().toISOString(),
      tags
    }

    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }

    const metrics = this.metrics.get(name)!
    metrics.push(metric)

    // Keep only recent metrics based on retention period
    const retentionPeriod = deploymentConfig.monitoring.metrics.retentionPeriod
    const cutoff = Date.now() - retentionPeriod

    this.metrics.set(name, metrics.filter(m =>
      new Date(m.timestamp).getTime() > cutoff
    ))

    // Check alerts
    this.checkAlerts(name, value)
  }

  getMetrics(name?: string, since?: string): MetricPoint[] {
    if (name) {
      const metrics = this.metrics.get(name) || []
      if (since) {
        const sinceTime = new Date(since).getTime()
        return metrics.filter(m => new Date(m.timestamp).getTime() >= sinceTime)
      }
      return metrics
    }

    // Return all metrics
    const allMetrics: MetricPoint[] = []
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics)
    }

    if (since) {
      const sinceTime = new Date(since).getTime()
      return allMetrics.filter(m => new Date(m.timestamp).getTime() >= sinceTime)
    }

    return allMetrics.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }

  // Alert management
  addAlert(alert: AlertRule): void {
    this.alerts.set(alert.id, alert)
    this.alertStates.set(alert.id, { triggered: false, since: '' })
  }

  removeAlert(alertId: string): void {
    this.alerts.delete(alertId)
    this.alertStates.delete(alertId)
  }

  getAlerts(): AlertRule[] {
    return Array.from(this.alerts.values())
  }

  getActiveAlerts(): Array<AlertRule & { since: string }> {
    const active: Array<AlertRule & { since: string }> = []

    for (const [id, state] of this.alertStates.entries()) {
      if (state.triggered) {
        const alert = this.alerts.get(id)
        if (alert) {
          active.push({ ...alert, since: state.since })
        }
      }
    }

    return active
  }

  private initializeDefaultAlerts(): void {
    // High error rate alert
    this.addAlert({
      id: 'high_error_rate',
      name: 'High Error Rate',
      condition: 'error_rate > threshold',
      threshold: deploymentConfig.monitoring.alerts.thresholds.errorRate,
      duration: 300000, // 5 minutes
      enabled: true,
      severity: 'high',
      notifications: []
    })

    // High response time alert
    this.addAlert({
      id: 'high_response_time',
      name: 'High Response Time',
      condition: 'avg_response_time > threshold',
      threshold: deploymentConfig.monitoring.alerts.thresholds.responseTime,
      duration: 300000, // 5 minutes
      enabled: true,
      severity: 'medium',
      notifications: []
    })

    // High memory usage alert
    this.addAlert({
      id: 'high_memory_usage',
      name: 'High Memory Usage',
      condition: 'memory_usage > threshold',
      threshold: deploymentConfig.monitoring.alerts.thresholds.memoryUsage,
      duration: 600000, // 10 minutes
      enabled: true,
      severity: 'medium',
      notifications: []
    })
  }

  private checkAlerts(metricName: string, value: number): void {
    for (const [alertId, alert] of this.alerts.entries()) {
      if (!alert.enabled) continue

      const state = this.alertStates.get(alertId)!
      let shouldTrigger = false

      // Simple threshold checking (in real implementation, would be more sophisticated)
      switch (metricName) {
        case 'error_rate':
          if (alertId === 'high_error_rate') {
            shouldTrigger = value > alert.threshold
          }
          break
        case 'response_time':
          if (alertId === 'high_response_time') {
            shouldTrigger = value > alert.threshold
          }
          break
        case 'memory_usage':
          if (alertId === 'high_memory_usage') {
            shouldTrigger = value > alert.threshold
          }
          break
      }

      // Update alert state
      if (shouldTrigger && !state.triggered) {
        state.triggered = true
        state.since = new Date().toISOString()
        this.triggerAlert(alert, value)
      } else if (!shouldTrigger && state.triggered) {
        state.triggered = false
        state.since = ''
        this.resolveAlert(alert)
      }
    }
  }

  private async triggerAlert(alert: AlertRule, value: number): Promise<void> {
    console.warn(`🚨 Alert triggered: ${alert.name} (${value} > ${alert.threshold})`)

    if (deploymentConfig.monitoring.alerts.enabled && deploymentConfig.monitoring.alerts.webhook) {
      try {
        await fetch(deploymentConfig.monitoring.alerts.webhook, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            alert: alert.name,
            severity: alert.severity,
            condition: alert.condition,
            value,
            threshold: alert.threshold,
            timestamp: new Date().toISOString(),
            environment: deploymentConfig.environment.nodeEnv
          })
        })
      } catch (error) {
        console.error('Failed to send alert webhook:', error)
      }
    }
  }

  private resolveAlert(alert: AlertRule): void {
    console.log(`✅ Alert resolved: ${alert.name}`)
  }

  private startMetricsCollection(): void {
    const interval = deploymentConfig.monitoring.metrics.collectInterval

    setInterval(() => {
      // Collect system metrics
      this.collectSystemMetrics()
    }, interval)

    console.log(`📊 Metrics collection started (interval: ${interval}ms)`)
  }

  private collectSystemMetrics(): void {
    try {
      // Memory metrics
      const memoryUsage = process.memoryUsage()
      this.recordMetric('memory.heap_used', memoryUsage.heapUsed)
      this.recordMetric('memory.heap_total', memoryUsage.heapTotal)
      this.recordMetric('memory.external', memoryUsage.external)
      this.recordMetric('memory.rss', memoryUsage.rss)

      // CPU metrics (simplified)
      const usage = process.cpuUsage()
      this.recordMetric('cpu.user', usage.user)
      this.recordMetric('cpu.system', usage.system)

      // Uptime
      this.recordMetric('process.uptime', process.uptime())

    } catch (error) {
      console.error('Error collecting system metrics:', error)
    }
  }

  // Request metrics tracking
  trackRequest(method: string, path: string, statusCode: number, duration: number): void {
    this.recordMetric('http.requests', 1, {
      method,
      path: this.normalizePath(path),
      status_code: statusCode.toString(),
      status_class: `${Math.floor(statusCode / 100)}xx`
    })

    this.recordMetric('http.response_time', duration, {
      method,
      path: this.normalizePath(path)
    })

    // Track error rate
    if (statusCode >= 400) {
      this.recordMetric('http.errors', 1, {
        method,
        path: this.normalizePath(path),
        status_code: statusCode.toString()
      })
    }
  }

  // Business metrics tracking
  trackBusinessMetric(event: string, value: number = 1, metadata?: Record<string, any>): void {
    this.recordMetric(`business.${event}`, value, {
      ...metadata,
      timestamp: new Date().toISOString()
    })
  }

  private normalizePath(path: string): string {
    // Replace dynamic segments with placeholders
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
      .replace(/\?.*$/, '') // Remove query parameters
  }

  // Export metrics for external monitoring systems
  exportMetrics(): {
    health: HealthCheckResult | null
    metrics: Record<string, MetricPoint[]>
    alerts: {
      rules: AlertRule[]
      active: Array<AlertRule & { since: string }>
    }
    system: {
      uptime: number
      environment: string
      version: string
      timestamp: string
    }
  } {
    return {
      health: this.healthCheckResults[this.healthCheckResults.length - 1] || null,
      metrics: Object.fromEntries(this.metrics.entries()),
      alerts: {
        rules: this.getAlerts(),
        active: this.getActiveAlerts()
      },
      system: {
        uptime: process.uptime(),
        environment: deploymentConfig.environment.nodeEnv,
        version: deploymentConfig.environment.appVersion,
        timestamp: new Date().toISOString()
      }
    }
  }
}

// Export singleton instance
export const monitoring = MonitoringService.getInstance()

// Middleware for automatic request tracking
export function createMonitoringMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now()

    // Track request start
    monitoring.trackBusinessMetric('request.started')

    // Override res.end to capture response metrics
    const originalEnd = res.end
    res.end = function(...args: any[]) {
      const duration = Date.now() - startTime

      monitoring.trackRequest(
        req.method,
        req.url,
        res.statusCode,
        duration
      )

      monitoring.trackBusinessMetric('request.completed')

      return originalEnd.apply(this, args)
    }

    next()
  }
}

// Utility functions for common monitoring patterns
export function trackEmailProcessing(userId: string, emailId: string, success: boolean, duration: number) {
  monitoring.trackBusinessMetric('email.processed', 1, {
    user_id: userId,
    email_id: emailId,
    success: success.toString(),
    duration
  })

  monitoring.recordMetric('email.processing_time', duration, {
    success: success.toString()
  })
}

export function trackAIOperation(operation: string, model: string, tokens: number, cost: number, duration: number) {
  monitoring.trackBusinessMetric(`ai.${operation}`, 1, {
    model,
    tokens: tokens.toString(),
    cost: cost.toString(),
    duration
  })

  monitoring.recordMetric('ai.tokens_used', tokens, { model, operation })
  monitoring.recordMetric('ai.cost', cost, { model, operation })
  monitoring.recordMetric('ai.processing_time', duration, { model, operation })
}

export function trackUserActivity(userId: string, action: string, metadata?: Record<string, any>) {
  monitoring.trackBusinessMetric(`user.${action}`, 1, {
    user_id: userId,
    ...metadata
  })
}