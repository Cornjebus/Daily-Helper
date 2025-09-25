"use client"

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'

export function ProductivityMetrics() {
  const [metrics, setMetrics] = useState<{ autoSorted: number; unsubscribes: number }>({ autoSorted: 0, unsubscribes: 0 })

  useEffect(() => {
    const load = async () => {
      const triage = await fetch('/api/ai/tiers/summary').then(r => r.json()).catch(() => null)
      const digest = await fetch('/api/digest/weekly/current').then(r => r.json()).catch(() => null)
      const autoSorted = (triage?.totals?.high || 0) + (triage?.totals?.medium || 0) + (triage?.totals?.low || 0)
      const unsubscribes = 0 // Placeholder until unsubscribe flow is implemented
      setMetrics({ autoSorted, unsubscribes })
    }
    load()
  }, [])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5" />
          This Week's Impact
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold font-mono">{metrics.autoSorted}</div>
            <div className="text-xs text-muted-foreground">Auto-sorted emails</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-mono">{metrics.unsubscribes}</div>
            <div className="text-xs text-muted-foreground">Bulk unsubscribes</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

