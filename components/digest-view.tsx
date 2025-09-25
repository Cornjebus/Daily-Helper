'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Clock, AlertCircle, ChevronRight, Calendar, Mail, Hash } from 'lucide-react'
import { format } from 'date-fns'

interface DigestItem {
  id: string
  source: string
  title: string
  content: string
  priority: number
  category: 'now' | 'next' | 'later'
  created_at: string
  metadata?: any
}

interface DigestData {
  id: string
  digest_type: string
  sent_at: string
  item_count: number
  high_priority_count: number
  content: {
    items: {
      now: DigestItem[]
      next: DigestItem[]
      later: DigestItem[]
    }
    summary: {
      total: number
      highPriority: number
      bySource: Record<string, number>
    }
    upcomingEvents?: any[]
  }
}

export function DigestView() {
  const [digest, setDigest] = useState<DigestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDigest = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/digest/generate')
      if (!response.ok) throw new Error('Failed to fetch digest')
      const data = await response.json()
      setDigest(data.digest)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const generateDigest = async () => {
    try {
      setGenerating(true)
      setError(null)
      const response = await fetch('/api/digest/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'manual' })
      })
      if (!response.ok) throw new Error('Failed to generate digest')
      const data = await response.json()
      setDigest(data.digest)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    fetchDigest()
  }, [])

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'gmail': return <Mail className="h-4 w-4" />
      case 'calendar': return <Calendar className="h-4 w-4" />
      default: return <ChevronRight className="h-4 w-4" />
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority <= 2) return 'text-red-600 bg-red-50 border-red-200'
    if (priority <= 4) return 'text-orange-600 bg-orange-50 border-orange-200'
    if (priority <= 6) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-gray-600 bg-gray-50 border-gray-200'
  }

  const renderItems = (items: DigestItem[], title: string, icon: React.ReactNode) => {
    if (items.length === 0) return null

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h3 className="font-semibold text-lg">{title}</h3>
          <span className="text-sm text-muted-foreground">({items.length})</span>
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-lg border ${getPriorityColor(item.priority)}`}
            >
              <div className="flex items-start gap-2">
                {getSourceIcon(item.source)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.title}</p>
                  <p className="text-sm mt-1 line-clamp-2">{item.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs opacity-70">
                    <span className="capitalize">{item.source}</span>
                    <span>Priority {item.priority}</span>
                    <span>{format(new Date(item.created_at), 'h:mm a')}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading digest...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="py-8">
          <div className="flex items-center justify-center text-red-600">
            <AlertCircle className="h-6 w-6 mr-2" />
            <span>Error: {error}</span>
          </div>
          <div className="flex justify-center mt-4">
            <Button onClick={fetchDigest} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!digest || !digest.content) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">No digest available yet</p>
          <Button onClick={generateDigest} disabled={generating}>
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Digest'
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { items, summary } = digest.content

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Daily Digest</CardTitle>
              <CardDescription>
                {format(new Date(digest.sent_at), 'EEEE, MMMM d, yyyy')} • {digest.digest_type}
              </CardDescription>
            </div>
            <Button onClick={generateDigest} size="sm" variant="outline" disabled={generating}>
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{summary.total}</p>
              <p className="text-sm text-muted-foreground">Total Items</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{summary.highPriority}</p>
              <p className="text-sm text-muted-foreground">High Priority</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {Object.keys(summary.bySource).length}
              </p>
              <p className="text-sm text-muted-foreground">Sources</p>
            </div>
          </div>

          {/* Source breakdown */}
          {Object.keys(summary.bySource).length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {Object.entries(summary.bySource).map(([source, count]) => (
                <span
                  key={source}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-muted/50 rounded-full text-xs"
                >
                  {getSourceIcon(source)}
                  <span className="capitalize">{source}</span>
                  <span className="font-medium">({count})</span>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items by Priority */}
      <Card>
        <CardHeader>
          <CardTitle>Your Tasks & Events</CardTitle>
          <CardDescription>Organized by priority and timing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderItems(
            items.now,
            'Now - Immediate Action',
            <Clock className="h-5 w-5 text-red-600" />
          )}
          {renderItems(
            items.next,
            'Next - Today',
            <Clock className="h-5 w-5 text-orange-600" />
          )}
          {renderItems(
            items.later,
            'Later - Upcoming',
            <Clock className="h-5 w-5 text-blue-600" />
          )}

          {items.now.length === 0 && items.next.length === 0 && items.later.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No items to display. Your inbox is clear! 🎉</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}