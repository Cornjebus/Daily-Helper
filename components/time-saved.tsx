"use client"

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Clock, TrendingDown } from 'lucide-react'

export function TimeSavedWidget() {
  const [saved, setSaved] = useState<{ minutesToday: number; weekHours: number }>({ minutesToday: 0, weekHours: 0 })

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/ai/tiers/summary')
      const data = await res.json()
      const processed = (data?.processed?.high || 0) + (data?.processed?.medium || 0) + (data?.processed?.low || 0)
      // Naive estimate: 2 minutes saved per processed item today (placeholder)
      const minutesToday = processed * 2
      // Placeholder weekly: 2.1 hours
      setSaved({ minutesToday, weekHours: 2.1 })
    }
    load()
  }, [])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          Time Saved Today
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Without Smart Triage:</span>
            <span className="font-mono">32 minutes</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">With Smart Triage:</span>
            <span className="font-mono">{Math.max(5, 32 - saved.minutesToday)} minutes</span>
          </div>
          <Separator />
          <div className="flex justify-between items-center pt-2">
            <div className="flex items-center gap-2 text-green-600">
              <TrendingDown className="h-4 w-4" />
              <span className="font-medium">Saved</span>
            </div>
            <span className="font-mono font-semibold text-green-600">{saved.minutesToday} minutes</span>
          </div>
          <div className="text-xs text-muted-foreground">This week: {saved.weekHours} hours saved</div>
        </div>
      </CardContent>
    </Card>
  )
}

