"use client"

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Archive } from 'lucide-react'

export function ChaosCleanup() {
  const [counts, setCounts] = useState<{ total: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      // Build digest (safe if empty)
      await fetch('/api/digest/weekly/build', { method: 'POST' })
      const res = await fetch('/api/digest/weekly/current')
      const data = await res.json()
      const total = (data?.low_priority_emails?.marketing?.length || 0)
        + (data?.low_priority_emails?.newsletters?.length || 0)
        + (data?.low_priority_emails?.social?.length || 0)
        + (data?.low_priority_emails?.automated?.length || 0)
      setCounts({ total })
    } catch { setCounts({ total: 0 }) }
  }

  useEffect(() => { load() }, [])

  const deleteAllChaos = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/chaos/delete-low', { method: 'POST' })
      const data = await res.json()
      alert(`Archived ${data?.archived || 0} chaos emails`)
      await load()
    } finally { setBusy(false) }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          Chaos Cleanup
          <Badge variant="outline">{counts?.total || 0} emails</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Review and clear all low-priority emails in one click. Important items remain visible above.</p>
        <Button variant="outline" onClick={deleteAllChaos} disabled={busy || (counts?.total || 0) === 0}>
          {busy ? 'Cleaning…' : 'Delete All Chaos Emails'}
        </Button>
      </CardContent>
    </Card>
  )
}

