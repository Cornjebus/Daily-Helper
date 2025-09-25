'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'

type Processed = { scored: number; summarized: number; errors: number }

export function AICostDashboard() {
  const [processing, setProcessing] = useState(false)
  const [lastRun, setLastRun] = useState<Processed | null>(null)
  const [error, setError] = useState<string | null>(null)

  const processEmails = async () => {
    setProcessing(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/process-emails', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to process emails')
      setLastRun(data.processed)
    } catch (e: any) {
      console.error('Process emails error:', e)
      setError(e?.message || 'Failed to process emails')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Processes the last 10 unprocessed emails and updates your feed.
      </p>
      <div className="flex items-center gap-2">
        <Button onClick={processEmails} disabled={processing}>
          <Zap className="h-4 w-4 mr-2" />
          {processing ? 'Processing…' : 'Process Emails'}
        </Button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
      {lastRun && (
        <div className="text-sm">
          <div className="font-medium">Last Run</div>
          <div className="text-muted-foreground mt-1">
            Scored: <span className="font-medium">{lastRun.scored}</span>, Summarized: <span className="font-medium">{lastRun.summarized}</span>, Errors: <span className="font-medium">{lastRun.errors}</span>
          </div>
        </div>
      )}
    </div>
  )
}
