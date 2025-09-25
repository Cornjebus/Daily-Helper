'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

type Summary = { hour: string; total: number; important: number; chaos: number }

export function HourlySummary() {
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/summary/hourly')
        if (res.ok) {
          const data = await res.json()
          setSummary(data?.latest || null)
        }
      } catch {}
    })()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Last Hour</CardTitle>
        <CardDescription>Quick snapshot of your inbox</CardDescription>
      </CardHeader>
      <CardContent>
        {summary ? (
          <div className="flex gap-6 text-sm">
            <div><span className="font-semibold">Total:</span> {summary.total}</div>
            <div><span className="font-semibold">Important:</span> {summary.important}</div>
            <div><span className="font-semibold">Chaos:</span> {summary.chaos}</div>
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">No summary yet. Run triage to generate one.</div>
        )}
      </CardContent>
    </Card>
  )
}

