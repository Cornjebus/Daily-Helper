'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmailItem } from '@/components/email-item'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface FeedItem {
  id: string
  source: string
  external_id?: string
  title: string
  content: string
  category: 'now' | 'next' | 'later'
  priority: number
  created_at: string
  metadata?: any
}

export default function LowPriorityPage() {
  const supabase = createClient()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('feed_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('category', 'later')
        .order('created_at', { ascending: false })
        .limit(200)
      setItems(data || [])
      setLoading(false)
    })()
  }, [])

  const selectedIds = Object.keys(selected).filter(id => selected[id])

  const toggle = (id: string, checked: boolean) => {
    setSelected(prev => ({ ...prev, [id]: checked }))
  }

  const bulkAction = async (action: 'mark-read' | 'archive' | 'delete') => {
    if (selectedIds.length === 0) return
    setBusy(true)
    try {
      const res = await fetch('/api/gmail/bulk-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, emailIds: items.filter(i => selected[i.id] && i.external_id).map(i => i.external_id) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Bulk action failed')
      // Refresh list
      const { data: user } = await supabase.auth.getUser()
      const { data: fresh } = await supabase
        .from('feed_items')
        .select('*')
        .eq('user_id', user.user?.id)
        .eq('category', 'later')
        .order('created_at', { ascending: false })
        .limit(200)
      setItems(fresh || [])
      setSelected({})
    } catch (e) {
      alert((e as any)?.message || 'Bulk action failed')
    } finally {
      setBusy(false)
    }
  }

  const unsubscribeSelected = async () => {
    if (selectedIds.length === 0) return
    const emailIds = items
      .filter(i => selected[i.id] && i.external_id)
      .map(i => i.external_id as string)
    if (emailIds.length === 0) return
    try {
      const res = await fetch('/api/gmail/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailIds })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to find unsubscribe links')
      const linksByEmail: Record<string, string[]> = data.links || {}
      let opened = 0
      for (const links of Object.values(linksByEmail)) {
        if (Array.isArray(links)) {
          for (const url of links.slice(0, 1)) { // open the first link per email
            try {
              window.open(url, '_blank', 'noopener,noreferrer')
              opened++
            } catch {}
          }
        }
      }
      if (opened === 0) alert('No unsubscribe links found for selection.')
    } catch (e) {
      alert((e as any)?.message || 'Failed to find unsubscribe links')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Low Priority</h1>
        <Link href="/dashboard"><Button variant="outline">Back to Dashboard</Button></Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Low-Priority Emails</CardTitle>
          <CardDescription>Items classified as low importance are kept out of your main dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-muted-foreground">No low-priority items right now.</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={busy || selectedIds.length === 0} onClick={() => bulkAction('mark-read')}>Mark Read</Button>
                  <Button size="sm" variant="outline" disabled={busy || selectedIds.length === 0} onClick={() => bulkAction('archive')}>Archive</Button>
                  <Button size="sm" variant="destructive" disabled={busy || selectedIds.length === 0} onClick={() => bulkAction('delete')}>Delete</Button>
                  <Button size="sm" variant="outline" disabled={selectedIds.length === 0} onClick={unsubscribeSelected}>Unsubscribe</Button>
                </div>
                <div className="text-xs text-muted-foreground">Selected: {selectedIds.length}</div>
              </div>
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.id} className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-3 h-4 w-4"
                      checked={!!selected[item.id]}
                      onChange={(e) => toggle(item.id, e.currentTarget.checked)}
                    />
                    <div className="flex-1"><EmailItem item={item} /></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
