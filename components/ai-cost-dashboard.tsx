'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Brain, DollarSign, TrendingUp, Zap } from 'lucide-react'

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

export function AICostDashboard() {
  const [stats, setStats] = useState<AIStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/ai/process-emails')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch AI stats:', error)
    }
  }

  const processEmails = async () => {
    setProcessing(true)
    try {
      const response = await fetch('/api/ai/process-emails', {
        method: 'POST',
      })
      const data = await response.json()

      if (response.ok) {
        alert(`Processed ${data.processed.scored} emails and ${data.processed.summarized} threads`)
        await fetchStats()
        // Refresh the page to show updated email statuses
        window.location.reload()
      } else {
        alert(data.error || 'Failed to process emails')
      }
    } catch (error) {
      console.error('Failed to process emails:', error)
      alert('Failed to process emails')
    } finally {
      setProcessing(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Loading AI usage stats...
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
      {/* Alert Banner */}
      {stats.alert && stats.alertMessage && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <span className="text-yellow-800">{stats.alertMessage}</span>
        </div>
      )}

      {/* Main Stats Cards */}
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

      {/* Operations Breakdown */}
      {stats.byOperation && Object.keys(stats.byOperation).length > 0 && (
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
            <Button
              onClick={processEmails}
              disabled={processing || stats.today.percentUsed >= 100}
            >
              {processing ? 'Processing...' : 'Process Emails'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}