"use client"

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LogOut, Mail, RefreshCw, Settings, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { EmailItem } from '@/components/email-item'
import { SessionTimer } from '@/components/dashboard/SessionTimer'

interface Integration { service: string; is_connected: boolean; connected_at: string | null }
interface FeedItem {
  id: string
  source: string
  title: string
  content: string
  category: 'now' | 'next' | 'later'
  priority: number
  created_at: string
  metadata?: any
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    (async () => {
      await checkUser()
      await checkGmail()
      await loadFeedItems()
    })()
  }, [])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
    } else {
      setUser(session.user)
      setLoading(false)
    }
  }

  const checkGmail = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('user_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('service', 'gmail')
        .maybeSingle()
      setGmailConnected(!!data?.is_connected)
    }
  }

  const loadFeedItems = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('feed_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('category', 'now')
        .lte('priority', 3)
        .order('created_at', { ascending: false })
        .limit(10)
      setFeedItems(data || [])
    }
  }

  const connectGmail = async () => {
    window.location.href = '/api/auth/google'
  }

  const syncEmails = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/gmail/sync', { method: 'POST' })
      const data = await response.json()
      if (response.ok) {
        const aiRes = await fetch('/api/ai/process-emails', { method: 'POST' })
        const aiJson = await aiRes.json().catch(() => ({}))
        const processed = aiRes.ok ? (aiJson?.processed?.scored || 0) : 0
        alert(`Synced ${data.emailsCount} recent emails. AI processed ${processed}.`)
        await loadFeedItems()
      } else {
        alert('Failed to sync emails. Please try again.')
      }
    } catch (e) {
      console.error('Sync error:', e)
      alert('Error syncing emails. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Junie</h1>
            <span className="text-sm text-muted-foreground">Welcome back, {user?.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
            <Button onClick={handleLogout} variant="ghost" size="icon">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {!gmailConnected ? (
          <Card className="max-w-2xl mx-auto text-center">
            <CardHeader>
              <CardTitle>Connect Gmail</CardTitle>
              <CardDescription>Let Junie fetch and prioritize your emails hourly.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="lg" onClick={connectGmail}>
                <Mail className="w-4 h-4 mr-2" /> Connect Google Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-end">
              <div className="p-2"><SessionTimer minutes={5} /></div>
            </div>

            <Card className="max-w-2xl mx-auto text-center">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 justify-center">
                  <Sparkles className="w-5 h-5" /> Run Triage Now
                </CardTitle>
                <CardDescription>Pull the last hour and score immediately.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={syncEmails} disabled={syncing}>
                  {syncing ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
                  ) : (
                    <><RefreshCw className="w-4 h-4 mr-2" /> Sync & Score</>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Immediate Attention</CardTitle>
                <CardDescription>Only high-priority emails appear here</CardDescription>
              </CardHeader>
              <CardContent>
                {feedItems.length > 0 ? (
                  <div className="space-y-3">
                    {feedItems.map(item => (
                      <EmailItem key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No urgent emails right now.</div>
                )}
                <div className="mt-4 text-right">
                  <Link href="/low-priority" className="text-sm underline">Browse low‑priority inbox</Link>
                  <span className="mx-2">•</span>
                  <Link href="/compose" className="text-sm underline">Compose</Link>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
