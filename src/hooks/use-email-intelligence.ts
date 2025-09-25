'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { integrationService } from '@/src/lib/services/integration-service'
import type {
  EmailProcessingResult,
  BudgetStatus
} from '@/src/lib/services/integration-service'

export interface EmailIntelligenceOptions {
  autoRefresh?: boolean
  refreshInterval?: number // in milliseconds
  maxEmails?: number
  includeReplies?: boolean
  priorityThreshold?: number
}

export interface EmailIntelligenceState {
  // Processing state
  isProcessing: boolean
  lastProcessed: string | null
  processedCount: number

  // Results
  results: EmailProcessingResult[]

  // Statistics
  stats: {
    totalEmails: number
    averageScore: number
    highPriorityCount: number
    lowPriorityCount: number
    successRate: number
  }

  // Budget information
  budget: BudgetStatus | null

  // Error handling
  error: string | null
  hasError: boolean
}

export interface UseEmailIntelligenceReturn extends EmailIntelligenceState {
  // Actions
  processEmails: (emailIds?: string[]) => Promise<void>
  refreshData: () => Promise<void>
  clearError: () => void
  retryLastOperation: () => Promise<void>

  // Computed values
  canProcess: boolean
  isOverBudget: boolean
  processingProgress: number

  // Utilities
  getEmailPriority: (emailId: string) => number | null
  getEmailReasoning: (emailId: string) => string | null
  getSmartReplies: (emailId: string) => string[] | null
}

export function useEmailIntelligence(
  userId: string | null,
  options: EmailIntelligenceOptions = {}
): UseEmailIntelligenceReturn {
  const {
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
    maxEmails = 10,
    includeReplies = true,
    priorityThreshold = 7
  } = options

  // State management
  const [state, setState] = useState<EmailIntelligenceState>({
    isProcessing: false,
    lastProcessed: null,
    processedCount: 0,
    results: [],
    stats: {
      totalEmails: 0,
      averageScore: 0,
      highPriorityCount: 0,
      lowPriorityCount: 0,
      successRate: 0
    },
    budget: null,
    error: null,
    hasError: false
  })

  // Track last operation for retry capability
  const [lastOperation, setLastOperation] = useState<{
    type: 'process' | 'refresh'
    params?: any
  } | null>(null)

  // Process emails function
  const processEmails = useCallback(async (emailIds?: string[]) => {
    if (!userId) {
      setState(prev => ({
        ...prev,
        error: 'User ID is required for email processing',
        hasError: true
      }))
      return
    }

    setState(prev => ({
      ...prev,
      isProcessing: true,
      error: null,
      hasError: false
    }))

    setLastOperation({ type: 'process', params: { emailIds } })

    try {
      console.log('🤖 Processing emails with AI intelligence...')

      const result = await integrationService.processEmailsBatch(
        userId,
        emailIds,
        {
          maxEmails,
          includeReplies,
          priorityThreshold
        }
      )

      // Calculate statistics
      const scores = result.results
        .filter(r => r.priorityScore)
        .map(r => r.priorityScore!)

      const averageScore = scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : 0

      const highPriorityCount = scores.filter(score => score >= 7).length
      const lowPriorityCount = scores.filter(score => score <= 4).length

      setState(prev => ({
        ...prev,
        isProcessing: false,
        lastProcessed: new Date().toISOString(),
        processedCount: prev.processedCount + result.summary.processed,
        results: result.results,
        stats: {
          totalEmails: result.summary.processed,
          averageScore,
          highPriorityCount,
          lowPriorityCount,
          successRate: result.summary.processed > 0
            ? (result.summary.succeeded / result.summary.processed) * 100
            : 0
        },
        budget: result.budget
      }))

      console.log('✅ Email processing completed successfully')

    } catch (error: any) {
      console.error('❌ Email processing failed:', error)

      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error.message || 'Email processing failed',
        hasError: true
      }))
    }
  }, [userId, maxEmails, includeReplies, priorityThreshold])

  // Refresh data function
  const refreshData = useCallback(async () => {
    if (!userId) return

    setState(prev => ({
      ...prev,
      isProcessing: true,
      error: null,
      hasError: false
    }))

    setLastOperation({ type: 'refresh' })

    try {
      // Get latest analytics
      const analytics = await integrationService.getAnalytics(userId, '24h')

      setState(prev => ({
        ...prev,
        isProcessing: false,
        stats: {
          totalEmails: analytics.emails.total,
          averageScore: 11 - analytics.emails.averagePriority, // Convert back to 1-10 scale
          highPriorityCount: Math.round(analytics.emails.total * 0.3), // Estimate
          lowPriorityCount: Math.round(analytics.emails.total * 0.3), // Estimate
          successRate: analytics.performance.successRate
        }
      }))

    } catch (error: any) {
      console.error('❌ Data refresh failed:', error)

      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error.message || 'Data refresh failed',
        hasError: true
      }))
    }
  }, [userId])

  // Retry last operation
  const retryLastOperation = useCallback(async () => {
    if (!lastOperation) return

    switch (lastOperation.type) {
      case 'process':
        await processEmails(lastOperation.params?.emailIds)
        break
      case 'refresh':
        await refreshData()
        break
    }
  }, [lastOperation, processEmails, refreshData])

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
      hasError: false
    }))
  }, [])

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || !userId) return

    const interval = setInterval(() => {
      refreshData()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, userId, refreshData])

  // Initial data load
  useEffect(() => {
    if (userId) {
      refreshData()
    }
  }, [userId, refreshData])

  // Computed values
  const computed = useMemo(() => ({
    canProcess: !!userId && !state.isProcessing,

    isOverBudget: state.budget
      ? state.budget.shouldAlert &&
        (state.budget.dailyUsage >= state.budget.dailyLimit ||
         state.budget.monthlyUsage >= state.budget.monthlyLimit)
      : false,

    processingProgress: state.isProcessing ?
      Math.min((state.processedCount / maxEmails) * 100, 90) : 0,

    // Utility functions
    getEmailPriority: (emailId: string): number | null => {
      const result = state.results.find(r => r.emailId === emailId)
      return result?.priorityScore || null
    },

    getEmailReasoning: (emailId: string): string | null => {
      const result = state.results.find(r => r.emailId === emailId)
      return result?.reasoning || null
    },

    getSmartReplies: (emailId: string): string[] | null => {
      const result = state.results.find(r => r.emailId === emailId)
      return result?.smartReplies || null
    }
  }), [state, userId, maxEmails])

  return {
    // State
    ...state,

    // Actions
    processEmails,
    refreshData,
    clearError,
    retryLastOperation,

    // Computed values
    ...computed
  }
}

// Hook for monitoring processing status across multiple operations
export function useEmailProcessingMonitor(userId: string | null) {
  const [operations, setOperations] = useState<Array<{
    id: string
    type: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    startTime: string
    endTime?: string
    progress: number
    error?: string
  }>>([])

  const addOperation = useCallback((type: string) => {
    const id = `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    setOperations(prev => [...prev, {
      id,
      type,
      status: 'pending',
      startTime: new Date().toISOString(),
      progress: 0
    }])

    return {
      id,
      updateProgress: (progress: number) => {
        setOperations(prev => prev.map(op =>
          op.id === id ? { ...op, status: 'processing', progress } : op
        ))
      },
      complete: () => {
        setOperations(prev => prev.map(op =>
          op.id === id ? {
            ...op,
            status: 'completed',
            progress: 100,
            endTime: new Date().toISOString()
          } : op
        ))
      },
      fail: (error: string) => {
        setOperations(prev => prev.map(op =>
          op.id === id ? {
            ...op,
            status: 'failed',
            error,
            endTime: new Date().toISOString()
          } : op
        ))
      }
    }
  }, [])

  const clearCompleted = useCallback(() => {
    setOperations(prev =>
      prev.filter(op => op.status !== 'completed')
    )
  }, [])

  const isAnyProcessing = useMemo(() =>
    operations.some(op => op.status === 'processing')
  , [operations])

  return {
    operations,
    addOperation,
    clearCompleted,
    isAnyProcessing,
    activeCount: operations.filter(op =>
      op.status === 'processing' || op.status === 'pending'
    ).length
  }
}