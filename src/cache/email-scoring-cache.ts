/**
 * High-Performance Email Scoring Cache System
 * Implements multi-tier caching with LRU eviction for < 100ms email scoring SLA
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  lastAccessed: number
  hitCount: number
  computeTimeMs: number
  tier: 'hot' | 'warm' | 'cold'
}

interface ScoringCacheEntry {
  score: number
  reasoning: string
  model: string
  version: string
  confidence: number
  features: Record<string, any>
}

interface EmailSignature {
  fromEmail: string
  subjectHash: string
  contentHash: string
  flags: string
  timestamp: number
}

export class EmailScoringCache {
  private hotCache = new Map<string, CacheEntry<ScoringCacheEntry>>()
  private warmCache = new Map<string, CacheEntry<ScoringCacheEntry>>()
  private patternCache = new Map<string, CacheEntry<any>>()

  // Cache configuration for SLA compliance
  private readonly config = {
    hotCacheSize: 1000,      // Most recent/frequent emails
    warmCacheSize: 5000,     // Pattern-matched emails
    patternCacheSize: 500,   // Common patterns
    hotCacheTTL: 5 * 60 * 1000,      // 5 minutes
    warmCacheTTL: 30 * 60 * 1000,    // 30 minutes
    patternCacheTTL: 2 * 60 * 60 * 1000, // 2 hours
    similarityThreshold: 0.85,        // Pattern matching threshold
    performanceTarget: 100            // < 100ms target
  }

  private stats = {
    hotHits: 0,
    warmHits: 0,
    patternHits: 0,
    misses: 0,
    avgResponseTime: 0,
    slaViolations: 0
  }

  /**
   * Get cached email score with performance tracking
   */
  async getEmailScore(signature: EmailSignature): Promise<ScoringCacheEntry | null> {
    const startTime = performance.now()

    try {
      // Try hot cache first (most recent/frequent)
      const hotKey = this.generateHotKey(signature)
      const hotEntry = this.hotCache.get(hotKey)

      if (hotEntry && this.isValid(hotEntry)) {
        this.updateAccessStats(hotEntry, 'hot')
        this.stats.hotHits++
        return hotEntry.data
      }

      // Try warm cache (similar emails)
      const warmKey = this.generateWarmKey(signature)
      const warmEntry = this.warmCache.get(warmKey)

      if (warmEntry && this.isValid(warmEntry)) {
        // Promote to hot cache if frequently accessed
        if (warmEntry.hitCount > 3) {
          this.promoteToHotCache(hotKey, warmEntry)
        }

        this.updateAccessStats(warmEntry, 'warm')
        this.stats.warmHits++
        return warmEntry.data
      }

      // Try pattern-based matching for similar email types
      const patternMatch = await this.findPatternMatch(signature)
      if (patternMatch) {
        this.stats.patternHits++

        // Create warm cache entry for pattern-matched result
        const estimatedScore = this.adjustScoreForContext(patternMatch, signature)
        this.setWarmCache(warmKey, estimatedScore)

        return estimatedScore
      }

      this.stats.misses++
      return null

    } finally {
      const duration = performance.now() - startTime
      this.updatePerformanceStats(duration)
    }
  }

  /**
   * Cache new email score with intelligent tier placement
   */
  setEmailScore(signature: EmailSignature, result: ScoringCacheEntry, computeTime: number): void {
    const hotKey = this.generateHotKey(signature)
    const warmKey = this.generateWarmKey(signature)

    // Always cache in hot for immediate access
    this.setHotCache(hotKey, result, computeTime)

    // Cache pattern for future similar emails
    this.cacheEmailPattern(signature, result)

    // Evict oldest entries if cache is full
    this.evictIfNecessary()
  }

  /**
   * Find similar emails using pattern matching
   */
  private async findPatternMatch(signature: EmailSignature): Promise<ScoringCacheEntry | null> {
    // Check sender-based patterns
    const senderPattern = this.extractSenderPattern(signature.fromEmail)
    const senderCache = this.patternCache.get(`sender:${senderPattern}`)

    if (senderCache && this.isValid(senderCache)) {
      return senderCache.data
    }

    // Check subject-based patterns
    const subjectPattern = this.extractSubjectPattern(signature.subjectHash)
    const subjectCache = this.patternCache.get(`subject:${subjectPattern}`)

    if (subjectCache && this.isValid(subjectCache)) {
      return subjectCache.data
    }

    // Check content-based patterns
    const contentPattern = this.extractContentPattern(signature.contentHash)
    const contentCache = this.patternCache.get(`content:${contentPattern}`)

    if (contentCache && this.isValid(contentCache)) {
      return contentCache.data
    }

    return null
  }

  /**
   * Generate cache keys optimized for different access patterns
   */
  private generateHotKey(signature: EmailSignature): string {
    // Exact match for recent emails
    return `hot:${signature.fromEmail}:${signature.subjectHash}:${signature.contentHash}:${signature.flags}`
  }

  private generateWarmKey(signature: EmailSignature): string {
    // Pattern-based key for similar emails
    const senderDomain = signature.fromEmail.split('@')[1] || signature.fromEmail
    const subjectType = this.classifySubject(signature.subjectHash)
    return `warm:${senderDomain}:${subjectType}:${signature.flags}`
  }

  /**
   * Extract patterns for intelligent matching
   */
  private extractSenderPattern(email: string): string {
    const domain = email.split('@')[1] || email
    const user = email.split('@')[0] || email

    // Pattern based on domain and user type
    if (user.includes('noreply') || user.includes('no-reply')) return `${domain}:automated`
    if (user.includes('support') || user.includes('help')) return `${domain}:support`
    if (user.includes('admin') || user.includes('system')) return `${domain}:system`

    return `${domain}:personal`
  }

  private extractSubjectPattern(subjectHash: string): string {
    // Use first few characters as pattern indicator
    return subjectHash.substring(0, 8)
  }

  private extractContentPattern(contentHash: string): string {
    // Use content fingerprint for similar message types
    return contentHash.substring(0, 8)
  }

  private classifySubject(subjectHash: string): string {
    // Would normally analyze actual subject, using hash suffix for demo
    const suffix = subjectHash.slice(-2)
    if (suffix < '33') return 'meeting'
    if (suffix < '66') return 'notification'
    if (suffix < '99') return 'request'
    return 'general'
  }

  /**
   * Cache management operations
   */
  private setHotCache(key: string, data: ScoringCacheEntry, computeTime: number): void {
    const entry: CacheEntry<ScoringCacheEntry> = {
      data,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      hitCount: 0,
      computeTimeMs: computeTime,
      tier: 'hot'
    }

    this.hotCache.set(key, entry)
  }

  private setWarmCache(key: string, data: ScoringCacheEntry): void {
    const entry: CacheEntry<ScoringCacheEntry> = {
      data,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      hitCount: 0,
      computeTimeMs: 0,
      tier: 'warm'
    }

    this.warmCache.set(key, entry)
  }

  private promoteToHotCache(key: string, entry: CacheEntry<ScoringCacheEntry>): void {
    entry.tier = 'hot'
    this.hotCache.set(key, entry)
  }

  private cacheEmailPattern(signature: EmailSignature, result: ScoringCacheEntry): void {
    const senderPattern = this.extractSenderPattern(signature.fromEmail)
    const subjectPattern = this.extractSubjectPattern(signature.subjectHash)

    // Cache sender pattern
    this.patternCache.set(`sender:${senderPattern}`, {
      data: result,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      hitCount: 0,
      computeTimeMs: 0,
      tier: 'warm'
    })

    // Cache subject pattern
    this.patternCache.set(`subject:${subjectPattern}`, {
      data: result,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      hitCount: 0,
      computeTimeMs: 0,
      tier: 'warm'
    })
  }

  private adjustScoreForContext(baseResult: ScoringCacheEntry, signature: EmailSignature): ScoringCacheEntry {
    // Adjust cached score based on current context
    let adjustedScore = baseResult.score

    // Time-based adjustments
    const hourOfDay = new Date().getHours()
    if (hourOfDay < 9 || hourOfDay > 17) {
      adjustedScore = Math.max(1, adjustedScore - 1) // Lower priority outside work hours
    }

    // Flag-based adjustments
    if (signature.flags.includes('important')) {
      adjustedScore = Math.min(10, adjustedScore + 1)
    }

    return {
      ...baseResult,
      score: adjustedScore,
      reasoning: `${baseResult.reasoning} (pattern-matched, context-adjusted)`,
      confidence: Math.max(0.5, baseResult.confidence - 0.2) // Lower confidence for pattern matches
    }
  }

  /**
   * Cache validation and cleanup
   */
  private isValid(entry: CacheEntry<any>): boolean {
    const now = Date.now()
    const age = now - entry.timestamp

    switch (entry.tier) {
      case 'hot':
        return age < this.config.hotCacheTTL
      case 'warm':
        return age < this.config.warmCacheTTL
      default:
        return age < this.config.patternCacheTTL
    }
  }

  private evictIfNecessary(): void {
    // Evict hot cache entries
    if (this.hotCache.size > this.config.hotCacheSize) {
      const entriesToEvict = this.hotCache.size - this.config.hotCacheSize
      const sortedEntries = Array.from(this.hotCache.entries())
        .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed)

      for (let i = 0; i < entriesToEvict; i++) {
        const [key] = sortedEntries[i]
        this.hotCache.delete(key)
      }
    }

    // Evict warm cache entries
    if (this.warmCache.size > this.config.warmCacheSize) {
      const entriesToEvict = this.warmCache.size - this.config.warmCacheSize
      const sortedEntries = Array.from(this.warmCache.entries())
        .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed)

      for (let i = 0; i < entriesToEvict; i++) {
        const [key] = sortedEntries[i]
        this.warmCache.delete(key)
      }
    }

    // Evict pattern cache entries
    if (this.patternCache.size > this.config.patternCacheSize) {
      const entriesToEvict = this.patternCache.size - this.config.patternCacheSize
      const sortedEntries = Array.from(this.patternCache.entries())
        .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed)

      for (let i = 0; i < entriesToEvict; i++) {
        const [key] = sortedEntries[i]
        this.patternCache.delete(key)
      }
    }
  }

  private updateAccessStats(entry: CacheEntry<any>, tier: 'hot' | 'warm'): void {
    entry.lastAccessed = Date.now()
    entry.hitCount++
  }

  private updatePerformanceStats(duration: number): void {
    // Update rolling average
    this.stats.avgResponseTime = (this.stats.avgResponseTime * 0.9) + (duration * 0.1)

    // Track SLA violations
    if (duration > this.config.performanceTarget) {
      this.stats.slaViolations++
    }
  }

  /**
   * Performance monitoring and diagnostics
   */
  getStats() {
    const totalRequests = this.stats.hotHits + this.stats.warmHits + this.stats.patternHits + this.stats.misses

    return {
      ...this.stats,
      totalRequests,
      hitRate: totalRequests > 0 ? ((this.stats.hotHits + this.stats.warmHits + this.stats.patternHits) / totalRequests) : 0,
      hotCacheSize: this.hotCache.size,
      warmCacheSize: this.warmCache.size,
      patternCacheSize: this.patternCache.size,
      slaCompliance: totalRequests > 0 ? (1 - (this.stats.slaViolations / totalRequests)) : 1,
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of cache memory usage in bytes
    const entrySize = 500 // Average size per cache entry
    return (this.hotCache.size + this.warmCache.size + this.patternCache.size) * entrySize
  }

  /**
   * Cache warming for predictable performance
   */
  async warmCache(commonPatterns: Array<{pattern: string, result: ScoringCacheEntry}>): Promise<void> {
    for (const {pattern, result} of commonPatterns) {
      this.patternCache.set(pattern, {
        data: result,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
        hitCount: 0,
        computeTimeMs: 0,
        tier: 'warm'
      })
    }
  }

  /**
   * Clear cache (for testing/debugging)
   */
  clear(): void {
    this.hotCache.clear()
    this.warmCache.clear()
    this.patternCache.clear()

    // Reset stats
    this.stats = {
      hotHits: 0,
      warmHits: 0,
      patternHits: 0,
      misses: 0,
      avgResponseTime: 0,
      slaViolations: 0
    }
  }
}

// Global cache instance
export const emailScoringCache = new EmailScoringCache()

// Utility functions for cache key generation
export function generateEmailSignature(
  fromEmail: string,
  subject: string,
  content: string,
  isImportant: boolean,
  isStarred: boolean,
  isUnread: boolean
): EmailSignature {
  // Simple hash function for demo purposes
  const hash = (str: string) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16)
  }

  const flags = [
    isImportant && 'important',
    isStarred && 'starred',
    isUnread && 'unread'
  ].filter(Boolean).join(',')

  return {
    fromEmail: fromEmail.toLowerCase(),
    subjectHash: hash(subject.toLowerCase()),
    contentHash: hash(content.toLowerCase()),
    flags,
    timestamp: Date.now()
  }
}