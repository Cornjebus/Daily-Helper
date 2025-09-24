'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Brain, DollarSign, TrendingUp, Zap, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface AIStats {
  today: {
    operations: number
    cost: string
    limit: string
    percentUsed: number
  }
  month: {
    operations: number
    cost: string
    limit: string
    percentUsed: number
    tokens: number
  }
  byOperation: {
    [key: string]: number
  }
  alert: boolean
  alertMessage?: string
}

interface ProcessingResult {
  success: boolean
  processed: {
    scored: number
    summarized: number
    errors: number
  }
  error?: string
  budget?: any
}

export function AICostDashboardImproved() {
  const [stats, setStats] = useState<AIStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const supabase = createClient()

  // Check authentication status
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session?.user)
    } catch (error) {
      console.error('Auth check failed:', error)
      setIsAuthenticated(false)
    }
  }

  const fetchStats = async () => {
    if (!isAuthenticated) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/process-emails', {
        method: 'GET',
        credentials: 'include', // Important: Include auth cookies
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.status === 401) {
        setIsAuthenticated(false)
        setError('Please log in to view AI statistics')
        return
      }

      if (response.ok) {
        const data = await response.json()
        setStats(data)
        setError(null)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
    } catch (error: any) {
      console.error('Failed to fetch AI stats:', error)
      setError(error.message || 'Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }

  const processEmails = async () => {
    if (!isAuthenticated) {
      setError('Please log in to process emails')
      return
    }

    setProcessing(true)
    setError(null)
    setSuccessMessage(null)

    try {
      console.log('🚀 Starting email processing...')

      const response = await fetch('/api/ai/process-emails', {
        method: 'POST',
        credentials: 'include', // Important: Include auth cookies
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('📡 API response status:', response.status)

      if (response.status === 401) {
        setIsAuthenticated(false)
        throw new Error('Authentication required. Please log in again.')
      }

      if (response.status === 429) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Daily AI budget exceeded')
      }

      const data: ProcessingResult = await response.json()
      console.log('📋 Processing result:', data)

      if (data.success) {
        const { scored, summarized, errors } = data.processed
        let message = `Successfully processed ${scored} email${scored !== 1 ? 's' : ''}`

        if (summarized > 0) {
          message += ` and summarized ${summarized} thread${summarized !== 1 ? 's' : ''}`
        }

        if (errors > 0) {
          message += ` (${errors} error${errors !== 1 ? 's' : ''})`
        }

        setSuccessMessage(message)

        // Refresh stats and feed items without full page reload
        await Promise.all([
          fetchStats(),
          refreshFeedItems()
        ])

      } else {
        throw new Error(data.error || 'Processing failed')
      }

    } catch (error: any) {
      console.error('❌ Email processing failed:', error)

      // Handle specific error types
      if (error.message.includes('Authentication')) {
        setIsAuthenticated(false)
        setError('Please log in to process emails')
      } else if (error.message.includes('budget')) {
        setError('Daily AI budget exceeded. Try again tomorrow or upgrade your plan.')
      } else if (error.message.includes('network') || error.name === 'TypeError') {
        setError('Network error. Please check your connection and try again.')
      } else {
        setError(error.message || 'Failed to process emails. Please try again.')
      }
    } finally {
      setProcessing(false)
    }
  }

  const refreshFeedItems = async () => {
    // Trigger a custom event to refresh feed items in the parent component
    window.dispatchEvent(new CustomEvent('refreshFeedItems'))
  }

  const clearMessages = () => {
    setError(null)
    setSuccessMessage(null)
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats()
    }
  }, [isAuthenticated])

  // Auto-clear messages after 10 seconds
  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(clearMessages, 10000)
      return () => clearTimeout(timer)
    }
  }, [error, successMessage])

  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">
            Please log in to view AI processing statistics and process emails.
          </p>
          <Button onClick={() => window.location.href = '/login'} variant="outline">
            Log In
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (loading && !stats) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3" />
            Loading AI usage statistics...
          </div>
        </CardContent>
      </Card>
    )
  }

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'text-red-500'
    if (percent >= 70) return 'text-yellow-500'
    return 'text-green-500'
  }

  return (
    <div className="space-y-4">
      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
          <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-red-800">{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearMessages}
              className="ml-2 h-6 px-2 text-red-600 hover:text-red-700"
            >
              ×
            </Button>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-2">
          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-green-800">{successMessage}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearMessages}
              className="ml-2 h-6 px-2 text-green-600 hover:text-green-700"
            >
              ×
            </Button>
          </div>
        </div>
      )}

      {/* Alert Banner */}
      {stats?.alert && stats.alertMessage && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <span className="text-yellow-800">{stats.alertMessage}</span>
        </div>
      )}

      {/* Main Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Today's Usage */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Today's Usage
                </span>
                <Badge variant="outline" className={getUsageColor(stats.today.percentUsed)}>
                  {stats.today.percentUsed}%
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cost</span>
                  <span className="font-semibold">
                    {stats.today.cost} / {stats.today.limit}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Operations</span>
                  <span className="font-semibold">{stats.today.operations}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full ${
                      stats.today.percentUsed >= 90
                        ? 'bg-red-500'
                        : stats.today.percentUsed >= 70
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, stats.today.percentUsed)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Usage */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Monthly Usage
                </span>
                <Badge variant="outline" className={getUsageColor(stats.month.percentUsed)}>
                  {stats.month.percentUsed}%
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cost</span>
                  <span className="font-semibold">
                    {stats.month.cost} / {stats.month.limit}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Operations</span>
                  <span className="font-semibold">{stats.month.operations}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tokens</span>
                  <span className="font-semibold">{stats.month.tokens.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full ${
                      stats.month.percentUsed >= 90
                        ? 'bg-red-500'
                        : stats.month.percentUsed >= 70
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, stats.month.percentUsed)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Operations Breakdown */}
      {stats?.byOperation && Object.keys(stats.byOperation).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Operations Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.byOperation).map(([operation, count]) => (
                <div key={operation} className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {operation.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Process Emails Button */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">AI Email Processing</p>
                <p className="text-sm text-muted-foreground">
                  Score priorities and generate summaries
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStats}
                disabled={processing || loading}
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={processEmails}
                disabled={processing || (stats?.today.percentUsed >= 100)}
                size="sm"
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Process Emails'
                )}
              </Button>
            </div>
          </div>

          {stats?.today.percentUsed >= 100 && (
            <p className="text-xs text-red-600 mt-2">
              Daily budget exceeded. Processing disabled until tomorrow.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}