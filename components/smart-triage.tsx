"use client"

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle, Zap, Mail, Clock, Archive, Loader2 } from 'lucide-react'
import { useRealtime } from '@/lib/hooks/use-realtime'

type TierSummary = {
  totals: { high: number; medium: number; low: number }
  processed: { high: number; medium: number; low: number }
}

export function SmartTriage() {
  const [data, setData] = useState<TierSummary | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Function to load triage data
  const loadTriageData = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch('/api/ai/tiers/summary')
      if (!response.ok) {
        setData({ totals: { high: 0, medium: 0, low: 0 }, processed: { high: 0, medium: 0, low: 0 } })
        return
      }

      const result = await response.json()
      if (!result || !result.totals || !result.processed) {
        setData({ totals: { high: 0, medium: 0, low: 0 }, processed: { high: 0, medium: 0, low: 0 } })
        return
      }

      setData(result)
    } catch (error) {
      console.error('Error loading triage data:', error)
      setData({ totals: { high: 0, medium: 0, low: 0 }, processed: { high: 0, medium: 0, low: 0 } })
    } finally {
      setIsRefreshing(false)
    }
  }

  // Set up real-time updates
  useRealtime({
    onEmailProcessingCompleted: (eventData) => {
      console.log('Email processing completed, refreshing triage data...')
      // Refresh triage data when processing completes
      loadTriageData()
    },
    onEmailUpdated: (eventData) => {
      console.log('Email updated, refreshing triage data...')
      // Refresh triage data when emails are updated
      loadTriageData()
    }
  })

  // Initial load
  useEffect(() => {
    loadTriageData()
  }, [])

  const renderCard = (label: string, icon: any, variant: 'destructive' | 'default' | 'secondary' | 'outline', total: number, processed: number, color: string) => {
    const Icon = icon
    const percent = total > 0 ? Math.round((processed / total) * 100) : 0
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${color}`} />
            <h3 className="font-semibold">{label}</h3>
            <Badge variant={variant}>{total} emails</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            AI Processing: {processed}/{total}
            <Progress value={percent} className="w-20" />
            {isRefreshing && (
              <span className="text-xs text-blue-600">Refreshing...</span>
            )}
          </div>
        </CardHeader>
        <CardContent>{/* list preview could go here */}</CardContent>
      </Card>
    )
  }

  if (!data) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {renderCard('High Priority', AlertTriangle, 'destructive', data?.totals?.high || 0, data?.processed?.high || 0, 'text-red-500')}
      {renderCard('Medium Priority', Mail, 'default', data?.totals?.medium || 0, data?.processed?.medium || 0, 'text-orange-500')}
      {renderCard('Low Priority', Archive, 'secondary', data?.totals?.low || 0, data?.processed?.low || 0, 'text-gray-400')}
    </div>
  )
}
