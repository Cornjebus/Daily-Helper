/**
 * Comprehensive Performance Monitoring System
 * Tracks metrics, SLA compliance, and provides real-time performance insights
 */

interface PerformanceMetric {
  id: string
  timestamp: number
  operation: string
  duration: number
  success: boolean
  metadata: Record<string, any>
  userId?: string
  tier?: 'nano' | 'mini' | 'standard' | 'premium'
}

interface SLATarget {
  operation: string
  targetMs: number
  percentile: number
  enabled: boolean
}

interface AlertRule {
  id: string
  metric: string
  threshold: number
  comparison: 'gt' | 'lt' | 'eq'
  window: number  // minutes
  enabled: boolean
  lastTriggered?: number
}

interface PerformanceReport {
  timestamp: number
  overallHealth: 'healthy' | 'degraded' | 'unhealthy'
  slaCompliance: number
  metrics: {
    emailScoring: {
      avgTime: number
      p95Time: number
      p99Time: number
      slaViolations: number
      throughput: number
    }
    batchProcessing: {
      avgTime: number
      p95Time: number
      throughput: number
      errorRate: number
    }
    database: {
      avgQueryTime: number
      slowQueries: number
      cacheHitRate: number
      connectionPoolUtilization: number
    }
    memory: {
      heapUsed: number
      heapTotal: number
      external: number
      gcDuration: number
    }
    costOptimization: {
      tierUtilization: Record<string, number>
      costSavings: number
      routingEfficiency: number
    }
  }
  alerts: Array<{
    level: 'warning' | 'critical'
    message: string
    timestamp: number
  }>
  recommendations: string[]
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private slaTargets: SLATarget[] = []
  private alertRules: AlertRule[] = []
  private alerts: Array<any> = []

  private readonly config = {
    maxMetricsHistory: 10000,
    reportingInterval: 60000,      // 1 minute
    alertCooldown: 300000,         // 5 minutes
    slowQueryThreshold: 1000,      // 1 second
    memoryThreshold: 512 * 1024 * 1024,  // 512MB
    costTrackingEnabled: true
  }

  constructor() {
    this.initializeSLATargets()
    this.initializeAlertRules()
    this.startPerformanceReporting()
  }

  /**
   * Record performance metrics for various operations
   */
  recordMetric(
    operation: string,
    duration: number,
    success: boolean = true,
    metadata: Record<string, any> = {},
    userId?: string,
    tier?: 'nano' | 'mini' | 'standard' | 'premium'
  ): void {
    const metric: PerformanceMetric = {
      id: this.generateMetricId(),
      timestamp: Date.now(),
      operation,
      duration,
      success,
      metadata,
      userId,
      tier
    }

    this.metrics.push(metric)

    // Trim old metrics to prevent memory leaks
    if (this.metrics.length > this.config.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.config.maxMetricsHistory / 2)
    }

    // Check for SLA violations and alerts
    this.checkSLACompliance(metric)
    this.checkAlertRules(metric)
  }

  /**
   * Start a performance timer for an operation
   */
  startTimer(operation: string, metadata: Record<string, any> = {}): () => void {
    const startTime = performance.now()

    return (success: boolean = true, userId?: string, tier?: any) => {
      const duration = performance.now() - startTime
      this.recordMetric(operation, duration, success, metadata, userId, tier)
    }
  }

  /**
   * Decorator for automatic performance monitoring
   */
  monitor<T extends (...args: any[]) => Promise<any>>(
    operation: string,
    fn: T,
    extractUserId?: (args: Parameters<T>) => string
  ): T {
    return (async (...args: Parameters<T>) => {
      const timer = this.startTimer(operation, { args: args.length })
      const userId = extractUserId ? extractUserId(args) : undefined

      try {
        const result = await fn(...args)
        timer(true, userId)
        return result
      } catch (error) {
        timer(false, userId)
        throw error
      }
    }) as T
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport(timeWindow: number = 60): PerformanceReport {
    const cutoff = Date.now() - timeWindow * 60 * 1000
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff)

    const emailScoringMetrics = recentMetrics.filter(m => m.operation === 'email_scoring')
    const batchProcessingMetrics = recentMetrics.filter(m => m.operation === 'batch_processing')
    const databaseMetrics = recentMetrics.filter(m => m.operation.startsWith('db_'))

    // Calculate email scoring performance
    const emailScoringTimes = emailScoringMetrics.map(m => m.duration)
    const emailScoring = {
      avgTime: this.calculateAverage(emailScoringTimes),
      p95Time: this.calculatePercentile(emailScoringTimes, 95),
      p99Time: this.calculatePercentile(emailScoringTimes, 99),
      slaViolations: emailScoringTimes.filter(t => t > 100).length,
      throughput: emailScoringMetrics.length / (timeWindow / 60)
    }

    // Calculate batch processing performance
    const batchProcessingTimes = batchProcessingMetrics.map(m => m.duration)
    const batchProcessing = {
      avgTime: this.calculateAverage(batchProcessingTimes),
      p95Time: this.calculatePercentile(batchProcessingTimes, 95),
      throughput: batchProcessingMetrics.reduce((sum, m) => sum + (m.metadata.batchSize || 1), 0) / (timeWindow / 60),
      errorRate: batchProcessingMetrics.filter(m => !m.success).length / Math.max(1, batchProcessingMetrics.length)
    }

    // Calculate database performance
    const databaseTimes = databaseMetrics.map(m => m.duration)
    const database = {
      avgQueryTime: this.calculateAverage(databaseTimes),
      slowQueries: databaseTimes.filter(t => t > this.config.slowQueryThreshold).length,
      cacheHitRate: this.calculateCacheHitRate(databaseMetrics),
      connectionPoolUtilization: this.calculatePoolUtilization(databaseMetrics)
    }

    // Memory statistics
    const memory = {
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal,
      external: process.memoryUsage().external,
      gcDuration: this.getGCDuration()
    }

    // Cost optimization metrics
    const costOptimization = {
      tierUtilization: this.calculateTierUtilization(recentMetrics),
      costSavings: this.calculateCostSavings(recentMetrics),
      routingEfficiency: this.calculateRoutingEfficiency(recentMetrics)
    }

    // Overall health assessment
    const slaCompliance = this.calculateOverallSLA(recentMetrics)
    const overallHealth = this.assessOverallHealth(slaCompliance, memory.heapUsed, database.slowQueries)

    const report: PerformanceReport = {
      timestamp: Date.now(),
      overallHealth,
      slaCompliance,
      metrics: {
        emailScoring,
        batchProcessing,
        database,
        memory,
        costOptimization
      },
      alerts: this.alerts.filter(a => a.timestamp > cutoff),
      recommendations: this.generateRecommendations(recentMetrics, memory)
    }

    return report
  }

  /**
   * SLA and alerting configuration
   */
  private initializeSLATargets(): void {
    this.slaTargets = [
      { operation: 'email_scoring', targetMs: 100, percentile: 95, enabled: true },
      { operation: 'batch_processing', targetMs: 2000, percentile: 95, enabled: true },
      { operation: 'db_query', targetMs: 500, percentile: 90, enabled: true },
      { operation: 'cache_lookup', targetMs: 10, percentile: 99, enabled: true }
    ]
  }

  private initializeAlertRules(): void {
    this.alertRules = [
      {
        id: 'high_email_scoring_latency',
        metric: 'email_scoring_p95',
        threshold: 150,
        comparison: 'gt',
        window: 5,
        enabled: true
      },
      {
        id: 'high_error_rate',
        metric: 'error_rate',
        threshold: 0.05,
        comparison: 'gt',
        window: 10,
        enabled: true
      },
      {
        id: 'memory_pressure',
        metric: 'heap_used',
        threshold: this.config.memoryThreshold,
        comparison: 'gt',
        window: 2,
        enabled: true
      },
      {
        id: 'slow_database_queries',
        metric: 'slow_query_rate',
        threshold: 0.1,
        comparison: 'gt',
        window: 15,
        enabled: true
      }
    ]
  }

  private checkSLACompliance(metric: PerformanceMetric): void {
    const target = this.slaTargets.find(t => t.operation === metric.operation && t.enabled)
    if (target && metric.duration > target.targetMs) {
      console.warn(`⚠️ SLA violation: ${metric.operation} took ${metric.duration}ms (target: ${target.targetMs}ms)`)
    }
  }

  private checkAlertRules(metric: PerformanceMetric): void {
    for (const rule of this.alertRules.filter(r => r.enabled)) {
      if (this.shouldTriggerAlert(rule, metric)) {
        this.triggerAlert(rule, metric)
      }
    }
  }

  private shouldTriggerAlert(rule: AlertRule, metric: PerformanceMetric): boolean {
    // Cooldown check
    if (rule.lastTriggered && Date.now() - rule.lastTriggered < this.config.alertCooldown) {
      return false
    }

    // Get metrics for the specified window
    const windowStart = Date.now() - rule.window * 60 * 1000
    const windowMetrics = this.metrics.filter(m => m.timestamp > windowStart)

    let value = 0

    switch (rule.metric) {
      case 'email_scoring_p95':
        value = this.calculatePercentile(
          windowMetrics.filter(m => m.operation === 'email_scoring').map(m => m.duration),
          95
        )
        break
      case 'error_rate':
        const total = windowMetrics.length
        const errors = windowMetrics.filter(m => !m.success).length
        value = total > 0 ? errors / total : 0
        break
      case 'heap_used':
        value = process.memoryUsage().heapUsed
        break
      case 'slow_query_rate':
        const dbQueries = windowMetrics.filter(m => m.operation.startsWith('db_'))
        const slowQueries = dbQueries.filter(m => m.duration > this.config.slowQueryThreshold)
        value = dbQueries.length > 0 ? slowQueries.length / dbQueries.length : 0
        break
    }

    switch (rule.comparison) {
      case 'gt': return value > rule.threshold
      case 'lt': return value < rule.threshold
      case 'eq': return Math.abs(value - rule.threshold) < 0.001
      default: return false
    }
  }

  private triggerAlert(rule: AlertRule, metric: PerformanceMetric): void {
    const alert = {
      id: this.generateMetricId(),
      ruleId: rule.id,
      level: rule.threshold > 1000 ? 'critical' : 'warning',
      message: `Alert: ${rule.metric} exceeded threshold (${rule.threshold})`,
      timestamp: Date.now(),
      metric: metric.operation,
      actualValue: metric.duration
    }

    this.alerts.push(alert)
    rule.lastTriggered = Date.now()

    console.warn(`🚨 Alert triggered: ${alert.message}`)

    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-50)
    }
  }

  /**
   * Statistical calculations
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0
    const sorted = values.sort((a, b) => a - b)
    const index = Math.ceil(sorted.length * percentile / 100) - 1
    return sorted[Math.max(0, index)] || 0
  }

  private calculateCacheHitRate(metrics: PerformanceMetric[]): number {
    const cacheMetrics = metrics.filter(m => m.metadata.cached !== undefined)
    if (cacheMetrics.length === 0) return 0
    const hits = cacheMetrics.filter(m => m.metadata.cached).length
    return hits / cacheMetrics.length
  }

  private calculatePoolUtilization(metrics: PerformanceMetric[]): number {
    // Mock calculation - would integrate with actual connection pool
    return Math.min(1, metrics.length / 100)
  }

  private calculateTierUtilization(metrics: PerformanceMetric[]): Record<string, number> {
    const tierCounts = { nano: 0, mini: 0, standard: 0, premium: 0 }

    for (const metric of metrics.filter(m => m.tier)) {
      tierCounts[metric.tier as keyof typeof tierCounts]++
    }

    const total = Object.values(tierCounts).reduce((sum, count) => sum + count, 0)

    return Object.fromEntries(
      Object.entries(tierCounts).map(([tier, count]) => [tier, total > 0 ? count / total : 0])
    )
  }

  private calculateCostSavings(metrics: PerformanceMetric[]): number {
    // Mock calculation based on tier routing efficiency
    const tieredMetrics = metrics.filter(m => m.tier)
    const nanoUsage = tieredMetrics.filter(m => m.tier === 'nano').length
    const totalUsage = tieredMetrics.length

    if (totalUsage === 0) return 0

    // Assume 67% cost reduction target
    const actualSavings = (nanoUsage / totalUsage) * 0.67
    return actualSavings
  }

  private calculateRoutingEfficiency(metrics: PerformanceMetric[]): number {
    // Calculate how efficiently requests are routed to appropriate tiers
    const tieredMetrics = metrics.filter(m => m.tier && m.operation === 'email_scoring')

    if (tieredMetrics.length === 0) return 1

    // Simple scoring: nano tier for fast processing, premium for complex
    let correctRouting = 0

    for (const metric of tieredMetrics) {
      if (metric.duration < 50 && metric.tier === 'nano') correctRouting++
      else if (metric.duration > 200 && (metric.tier === 'standard' || metric.tier === 'premium')) correctRouting++
      else if (metric.duration >= 50 && metric.duration <= 200 && metric.tier === 'mini') correctRouting++
    }

    return correctRouting / tieredMetrics.length
  }

  private calculateOverallSLA(metrics: PerformanceMetric[]): number {
    let violations = 0
    let totalChecked = 0

    for (const target of this.slaTargets.filter(t => t.enabled)) {
      const operationMetrics = metrics.filter(m => m.operation === target.operation)
      if (operationMetrics.length === 0) continue

      const times = operationMetrics.map(m => m.duration)
      const percentileValue = this.calculatePercentile(times, target.percentile)

      totalChecked++
      if (percentileValue > target.targetMs) violations++
    }

    return totalChecked > 0 ? (totalChecked - violations) / totalChecked : 1
  }

  private assessOverallHealth(
    slaCompliance: number,
    heapUsed: number,
    slowQueries: number
  ): 'healthy' | 'degraded' | 'unhealthy' {
    if (slaCompliance < 0.8 || heapUsed > this.config.memoryThreshold * 1.5 || slowQueries > 10) {
      return 'unhealthy'
    }

    if (slaCompliance < 0.95 || heapUsed > this.config.memoryThreshold || slowQueries > 5) {
      return 'degraded'
    }

    return 'healthy'
  }

  private generateRecommendations(metrics: PerformanceMetric[], memory: any): string[] {
    const recommendations: string[] = []

    // Email scoring performance
    const scoringMetrics = metrics.filter(m => m.operation === 'email_scoring')
    const avgScoringTime = this.calculateAverage(scoringMetrics.map(m => m.duration))

    if (avgScoringTime > 100) {
      recommendations.push('Consider increasing cache hit rate for email scoring operations')
      recommendations.push('Evaluate model tier routing to use faster models for simple emails')
    }

    // Memory pressure
    if (memory.heapUsed > this.config.memoryThreshold) {
      recommendations.push('Memory usage is high - consider implementing garbage collection optimization')
      recommendations.push('Review cache sizes and implement LRU eviction policies')
    }

    // Database performance
    const dbMetrics = metrics.filter(m => m.operation.startsWith('db_'))
    const slowDbQueries = dbMetrics.filter(m => m.duration > this.config.slowQueryThreshold)

    if (slowDbQueries.length > dbMetrics.length * 0.1) {
      recommendations.push('High number of slow database queries - review indexes and query optimization')
      recommendations.push('Consider implementing database connection pooling')
    }

    // Cost optimization
    const tierUtilization = this.calculateTierUtilization(metrics)
    if (tierUtilization.premium > 0.3) {
      recommendations.push('High premium tier usage detected - review tier routing logic')
    }

    return recommendations
  }

  private getGCDuration(): number {
    // Mock GC duration - would use actual GC metrics in production
    return Math.random() * 10
  }

  private startPerformanceReporting(): void {
    setInterval(() => {
      const report = this.generatePerformanceReport()

      if (report.overallHealth !== 'healthy') {
        console.warn(`⚠️ System health: ${report.overallHealth} (SLA: ${(report.slaCompliance * 100).toFixed(1)}%)`)
      }

      // Could send to external monitoring system here
    }, this.config.reportingInterval)
  }

  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Public API for monitoring
   */
  getRecentMetrics(operation?: string, limit: number = 100): PerformanceMetric[] {
    let filtered = this.metrics.slice(-limit * 2) // Get more to filter

    if (operation) {
      filtered = filtered.filter(m => m.operation === operation)
    }

    return filtered.slice(-limit)
  }

  getAlerts(level?: 'warning' | 'critical'): any[] {
    let alerts = this.alerts.slice(-50) // Recent alerts

    if (level) {
      alerts = alerts.filter(a => a.level === level)
    }

    return alerts
  }

  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'operation', 'duration', 'success', 'userId', 'tier']
      const rows = this.metrics.map(m => [
        new Date(m.timestamp).toISOString(),
        m.operation,
        m.duration.toString(),
        m.success.toString(),
        m.userId || '',
        m.tier || ''
      ])

      return [headers, ...rows].map(row => row.join(',')).join('\n')
    }

    return JSON.stringify(this.metrics, null, 2)
  }

  reset(): void {
    this.metrics = []
    this.alerts = []
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

// Utility decorators
export function MonitorPerformance(operation: string) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!

    descriptor.value = performanceMonitor.monitor(operation, method) as T

    return descriptor
  }
}

export function TimedOperation(operation: string) {
  return function <T extends (...args: any[]) => any>(fn: T): T {
    return performanceMonitor.monitor(operation,
      (...args: Parameters<T>) => Promise.resolve(fn(...args))
    ) as T
  }
}