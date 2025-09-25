"use client"

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Archive, Mail, Newspaper, Users, CheckCircle, AlertCircle } from 'lucide-react'

type Digest = {
  week_start_date: string
  low_priority_emails?: { marketing?: any[]; newsletters?: any[]; social?: any[]; automated?: any[] }
}

export function WeeklyDigest() {
  const [digest, setDigest] = useState<Digest | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      await fetch('/api/digest/weekly/build', { method: 'POST' })
      const res = await fetch('/api/digest/weekly/current')
      const data = await res.json()
      if (!data.empty) setDigest(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const applyAction = async (category: string, action: string) => {
    await fetch('/api/digest/weekly/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, action }) })
    await load()
  }

  if (!digest) return null

  const counts = {
    marketing: digest.low_priority_emails?.marketing?.length || 0,
    newsletters: digest.low_priority_emails?.newsletters?.length || 0,
    social: digest.low_priority_emails?.social?.length || 0,
    automated: digest.low_priority_emails?.automated?.length || 0,
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          Weekly Email Cleanup
          <Badge variant="outline">Week of {digest.week_start_date}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Marketing */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="font-medium">Marketing</span>
              <Badge variant="secondary">{counts.marketing} emails</Badge>
            </div>
            <Badge variant="outline" className="text-green-600">
              <CheckCircle className="h-3 w-3 mr-1" /> Safe to ignore
            </Badge>
          </div>
          <div className="flex gap-2 justify-end text-sm">
            <Button size="sm" variant="outline" onClick={() => applyAction('marketing', 'unsubscribe')}>Unsubscribe All</Button>
            <Button size="sm" variant="outline" onClick={() => applyAction('marketing', 'archive')}>Archive All</Button>
          </div>
        </div>

        {/* Newsletters */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Newspaper className="h-4 w-4" />
              <span className="font-medium">Newsletters</span>
              <Badge variant="secondary">{counts.newsletters} emails</Badge>
            </div>
            <Badge variant="outline" className="text-yellow-600">
              <AlertCircle className="h-3 w-3 mr-1" /> Mixed value
            </Badge>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => applyAction('newsletters', 'keep')}>Keep</Button>
            <Button size="sm" variant="outline" onClick={() => applyAction('newsletters', 'unsubscribe')}>Unsubscribe</Button>
            <Button size="sm" variant="outline" onClick={() => applyAction('newsletters', 'archive')}>Archive</Button>
          </div>
        </div>

        {/* Automated */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="font-medium">Automated</span>
              <Badge variant="secondary">{counts.automated} emails</Badge>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => applyAction('automated', 'mark_read')}>Mark Read</Button>
            <Button size="sm" variant="outline" onClick={() => applyAction('automated', 'archive')}>Archive</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
