'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { integrationService } from '@/src/lib/services/integration-service'
import type { ThreadSummaryResult } from '@/src/lib/services/integration-service'

export interface WeeklyDigestOptions {
  autoGenerate?: boolean
  includeThreads?: boolean
  includePriorities?: boolean
  includeAnalytics?: boolean
  maxThreads?: number
  minThreadMessages?: number
}

export interface DigestAnalytics {
  totalEmails: number
  processedEmails: number
  averagePriority: number
  highPriorityCount: number
  threadsCount: number
  summarizedThreads: number
  topSenders: Array<{
    email: string
    count: number
  }>
  categoryBreakdown: {
    now: number
    next: number
    later: number
  }
}

export interface WeeklyDigestContent {
  id: string
  generatedAt: string
  period: {
    start: string
    end: string
    week: number
    year: number
  }
  summary: {
    totalEmails: number
    importantEmails: number
    threadsProcessed: number
    aiOperations: number
  }
  analytics: DigestAnalytics
  threads: ThreadSummaryResult[]
  topPriorities: Array<{
    emailId: string
    subject: string
    from: string
    priority: number
    reasoning: string
  }>
  insights: string[]
  recommendations: string[]
}

export interface UseWeeklyDigestReturn {
  // Current digest
  currentDigest: WeeklyDigestContent | null

  // Historical digests
  previousDigests: WeeklyDigestContent[]

  // State
  isGenerating: boolean
  isLoading: boolean
  lastGenerated: string | null

  // Error handling
  error: string | null
  hasError: boolean

  // Actions
  generateDigest: (weekOffset?: number) => Promise<void>
  loadDigest: (digestId: string) => Promise<void>
  loadPreviousDigests: (limit?: number) => Promise<void>
  clearError: () => void
  retryGeneration: () => Promise<void>

  // Computed values
  canGenerate: boolean
  needsUpdate: boolean
  weekProgress: number

  // Utilities
  getDigestForWeek: (weekOffset: number) => WeeklyDigestContent | null
  exportDigest: (format: 'json' | 'markdown') => string
  shareDigest: () => Promise<string>
}

export function useWeeklyDigest(
  userId: string | null,
  options: WeeklyDigestOptions = {}
): UseWeeklyDigestReturn {
  const {
    autoGenerate = true,
    includeThreads = true,
    includePriorities = true,
    includeAnalytics = true,
    maxThreads = 10,
    minThreadMessages = 3
  } = options

  const [state, setState] = useState({
    currentDigest: null as WeeklyDigestContent | null,
    previousDigests: [] as WeeklyDigestContent[],
    isGenerating: false,
    isLoading: false,
    lastGenerated: null as string | null,
    error: null as string | null,
    hasError: false
  })

  const [lastOperation, setLastOperation] = useState<{
    type: 'generate' | 'load'
    params?: any
  } | null>(null)

  // Generate digest function
  const generateDigest = useCallback(async (weekOffset: number = 0) => {
    if (!userId) {
      setState(prev => ({
        ...prev,
        error: 'User ID is required for digest generation',
        hasError: true
      }))
      return
    }

    setState(prev => ({
      ...prev,
      isGenerating: true,
      error: null,
      hasError: false
    }))

    setLastOperation({ type: 'generate', params: { weekOffset } })

    try {
      console.log('📊 Generating weekly digest...')

      // Calculate week period
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() - (weekOffset * 7))
      startOfWeek.setHours(0, 0, 0, 0)

      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(endOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)

      // Get week number
      const startOfYear = new Date(startOfWeek.getFullYear(), 0, 1)
      const weekNumber = Math.ceil(
        ((startOfWeek.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
      )

      // Generate analytics for the week
      const analytics = await integrationService.getAnalytics(userId, '7d')

      // Process threads if requested
      let threads: ThreadSummaryResult[] = []
      if (includeThreads) {
        const threadResult = await integrationService.processEmailThreads(
          userId,
          {
            minMessages: minThreadMessages,
            dateFilter: startOfWeek.toISOString().split('T')[0],
            maxThreads
          }
        )
        threads = threadResult.results
      }

      // Generate insights and recommendations
      const insights = generateInsights(analytics)
      const recommendations = generateRecommendations(analytics, threads)

      // Create digest content
      const digest: WeeklyDigestContent = {
        id: `digest_${startOfWeek.getFullYear()}_w${weekNumber}`,
        generatedAt: new Date().toISOString(),
        period: {
          start: startOfWeek.toISOString(),
          end: endOfWeek.toISOString(),
          week: weekNumber,
          year: startOfWeek.getFullYear()
        },
        summary: {
          totalEmails: analytics.emails.total,
          importantEmails: analytics.emails.total - analytics.emails.unreadCount,
          threadsProcessed: analytics.threads.summarized,
          aiOperations: analytics.ai.operations
        },
        analytics: {
          totalEmails: analytics.emails.total,
          processedEmails: analytics.emails.processed,
          averagePriority: analytics.emails.averagePriority,
          highPriorityCount: Math.round(analytics.emails.total * 0.3),
          threadsCount: analytics.threads.total,
          summarizedThreads: analytics.threads.summarized,
          topSenders: [], // Would need additional query
          categoryBreakdown: {
            now: Math.round(analytics.emails.total * 0.3),
            next: Math.round(analytics.emails.total * 0.4),
            later: Math.round(analytics.emails.total * 0.3)
          }
        },
        threads,
        topPriorities: [], // Would need additional processing
        insights,
        recommendations
      }

      setState(prev => ({
        ...prev,
        currentDigest: digest,
        isGenerating: false,
        lastGenerated: new Date().toISOString()
      }))

      console.log('✅ Weekly digest generated successfully')

    } catch (error: any) {
      console.error('❌ Digest generation failed:', error)

      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: error.message || 'Digest generation failed',
        hasError: true
      }))
    }
  }, [userId, includeThreads, maxThreads, minThreadMessages])

  // Load previous digests
  const loadPreviousDigests = useCallback(async (limit: number = 5) => {
    if (!userId) return

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      hasError: false
    }))

    try {
      // In a real implementation, this would load from a database
      // For now, generate mock previous digests
      const mockDigests: WeeklyDigestContent[] = []

      for (let i = 1; i <= limit; i++) {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - (i * 7))

        const startOfWeek = new Date(weekAgo)
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
        startOfWeek.setHours(0, 0, 0, 0)

        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(endOfWeek.getDate() + 6)
        endOfWeek.setHours(23, 59, 59, 999)

        const weekNumber = Math.ceil(
          ((startOfWeek.getTime() - new Date(startOfWeek.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
        )

        mockDigests.push({
          id: `digest_${startOfWeek.getFullYear()}_w${weekNumber}`,
          generatedAt: endOfWeek.toISOString(),
          period: {
            start: startOfWeek.toISOString(),
            end: endOfWeek.toISOString(),
            week: weekNumber,
            year: startOfWeek.getFullYear()
          },
          summary: {
            totalEmails: Math.floor(Math.random() * 50) + 20,
            importantEmails: Math.floor(Math.random() * 15) + 5,
            threadsProcessed: Math.floor(Math.random() * 8) + 2,
            aiOperations: Math.floor(Math.random() * 100) + 30
          },
          analytics: {
            totalEmails: Math.floor(Math.random() * 50) + 20,
            processedEmails: Math.floor(Math.random() * 45) + 15,
            averagePriority: Math.random() * 4 + 3,
            highPriorityCount: Math.floor(Math.random() * 10) + 2,
            threadsCount: Math.floor(Math.random() * 10) + 3,
            summarizedThreads: Math.floor(Math.random() * 8) + 2,
            topSenders: [],
            categoryBreakdown: {
              now: Math.floor(Math.random() * 10) + 5,
              next: Math.floor(Math.random() * 15) + 8,
              later: Math.floor(Math.random() * 12) + 7
            }
          },
          threads: [],
          topPriorities: [],
          insights: [`Week ${weekNumber} showed ${Math.random() > 0.5 ? 'increased' : 'decreased'} email activity`],
          recommendations: [`Consider ${Math.random() > 0.5 ? 'processing' : 'organizing'} more efficiently`]
        })
      }

      setState(prev => ({
        ...prev,
        previousDigests: mockDigests,
        isLoading: false
      }))

    } catch (error: any) {
      console.error('❌ Loading previous digests failed:', error)

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to load previous digests',
        hasError: true
      }))
    }
  }, [userId])

  // Load specific digest
  const loadDigest = useCallback(async (digestId: string) => {
    const digest = state.previousDigests.find(d => d.id === digestId)
    if (digest) {
      setState(prev => ({
        ...prev,
        currentDigest: digest
      }))
    }
  }, [state.previousDigests])

  // Retry last operation
  const retryGeneration = useCallback(async () => {
    if (!lastOperation) return

    switch (lastOperation.type) {
      case 'generate':
        await generateDigest(lastOperation.params?.weekOffset || 0)
        break
    }
  }, [lastOperation, generateDigest])

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
      hasError: false
    }))
  }, [])

  // Auto-generate current week digest on mount
  useEffect(() => {
    if (autoGenerate && userId && !state.currentDigest && !state.isGenerating) {
      generateDigest(0)
    }
  }, [autoGenerate, userId, state.currentDigest, state.isGenerating, generateDigest])

  // Load previous digests on mount
  useEffect(() => {
    if (userId && state.previousDigests.length === 0 && !state.isLoading) {
      loadPreviousDigests()
    }
  }, [userId, state.previousDigests.length, state.isLoading, loadPreviousDigests])

  // Computed values
  const computed = useMemo(() => ({
    canGenerate: !!userId && !state.isGenerating,

    needsUpdate: state.currentDigest ?
      new Date(state.currentDigest.generatedAt).getTime() < Date.now() - (24 * 60 * 60 * 1000)
      : true,

    weekProgress: (() => {
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
      startOfWeek.setHours(0, 0, 0, 0)

      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(endOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)

      const weekDuration = endOfWeek.getTime() - startOfWeek.getTime()
      const elapsed = now.getTime() - startOfWeek.getTime()

      return Math.min((elapsed / weekDuration) * 100, 100)
    })(),

    getDigestForWeek: (weekOffset: number): WeeklyDigestContent | null => {
      if (weekOffset === 0) return state.currentDigest
      return state.previousDigests.find(d => {
        const weeksDiff = Math.floor(
          (Date.now() - new Date(d.period.start).getTime()) / (7 * 24 * 60 * 60 * 1000)
        )
        return weeksDiff === weekOffset
      }) || null
    },

    exportDigest: (format: 'json' | 'markdown'): string => {
      if (!state.currentDigest) return ''

      if (format === 'json') {
        return JSON.stringify(state.currentDigest, null, 2)
      }

      // Markdown format
      const digest = state.currentDigest
      return `
# Weekly Email Digest
**Week ${digest.period.week}, ${digest.period.year}**
*Generated: ${new Date(digest.generatedAt).toLocaleDateString()}*

## Summary
- **Total Emails**: ${digest.summary.totalEmails}
- **Important Emails**: ${digest.summary.importantEmails}
- **Threads Processed**: ${digest.summary.threadsProcessed}
- **AI Operations**: ${digest.summary.aiOperations}

## Key Insights
${digest.insights.map(insight => `- ${insight}`).join('\n')}

## Recommendations
${digest.recommendations.map(rec => `- ${rec}`).join('\n')}

## Thread Summaries
${digest.threads.map(thread => `
### Thread: ${thread.threadId}
${thread.summary}

**Key Points:**
${thread.keyPoints?.map(point => `- ${point}`).join('\n') || 'None'}
`).join('\n')}
      `.trim()
    },

    shareDigest: async (): Promise<string> => {
      if (!state.currentDigest) throw new Error('No digest to share')

      const url = `${window.location.origin}/digest/${state.currentDigest.id}`

      if (navigator.share) {
        await navigator.share({
          title: `Weekly Email Digest - Week ${state.currentDigest.period.week}`,
          text: `Check out my email productivity digest for week ${state.currentDigest.period.week}`,
          url
        })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      }

      return url
    }
  }), [state])

  return {
    // State
    ...state,

    // Actions
    generateDigest,
    loadDigest,
    loadPreviousDigests,
    clearError,
    retryGeneration,

    // Computed values
    ...computed
  }
}

// Helper functions for generating insights and recommendations
function generateInsights(analytics: any): string[] {
  const insights: string[] = []

  if (analytics.emails.total > 0) {
    insights.push(
      `Processed ${analytics.emails.total} emails with an average priority of ${analytics.emails.averagePriority.toFixed(1)}/10`
    )

    if (analytics.performance.successRate > 90) {
      insights.push('Excellent AI processing success rate achieved this week')
    } else if (analytics.performance.successRate < 70) {
      insights.push('AI processing success rate was below average - consider checking system health')
    }

    if (analytics.threads.summarized > 5) {
      insights.push(`Successfully summarized ${analytics.threads.summarized} long email threads`)
    }

    if (analytics.ai.operations > 100) {
      insights.push('High AI usage detected - monitor budget alerts')
    }
  }

  return insights.length > 0 ? insights : ['Insufficient data for insights this week']
}

function generateRecommendations(analytics: any, threads: ThreadSummaryResult[]): string[] {
  const recommendations: string[] = []

  if (analytics.emails.unreadCount > analytics.emails.total * 0.5) {
    recommendations.push('Consider processing unread emails more frequently to stay on top of your inbox')
  }

  if (analytics.threads.total > analytics.threads.summarized) {
    recommendations.push('Enable thread summarization for better email organization')
  }

  if (analytics.performance.successRate < 85) {
    recommendations.push('Review AI processing settings to improve success rate')
  }

  if (analytics.ai.costCents > 500) { // $5.00
    recommendations.push('Monitor AI budget usage - consider adjusting processing frequency')
  }

  return recommendations.length > 0 ? recommendations : ['Keep up the good email management practices!']
}