'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LogOut, CheckCircle2, XCircle, Mail, MessageSquare, Calendar, CheckSquare, Brain, FileText, RefreshCw, Sparkles, Settings } from 'lucide-react'
import Link from 'next/link'
import { AICostDashboard } from '@/components/ai-cost-dashboard'
import { EmailItem } from '@/components/email-item'

interface Integration {
  service: string
  is_connected: boolean
  connected_at: string | null
}

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

interface EmailThread {
  id: string
  subject: string
  participants: string[]
  message_count: number
  is_unread: boolean
  last_message_at: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [emailThreads, setEmailThreads] = useState<EmailThread[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkUser()
    loadIntegrations()
    loadFeedItems()
    loadEmailThreads()
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

  const loadIntegrations = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('user_integrations')
        .select('*')
        .eq('user_id', user.id)

      if (data) {
        setIntegrations(data)
      }
    }
  }

  const loadFeedItems = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('feed_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (data) {
        setFeedItems(data)
      }
    }
  }

  const loadEmailThreads = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('email_threads')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false })
        .limit(20)

      if (data) {
        setEmailThreads(data)
      }
    }
  }

  const connectGmail = async () => {
    window.location.href = '/api/auth/google'
  }

  const syncEmails = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/gmail/sync', {
        method: 'POST',
      })
      const data = await response.json()

      if (response.ok) {
        // Show sync result to user
        console.log('Sync result:', data)
        if (data.emailsCount === 0) {
          alert('No emails from today to sync. Send yourself a test email and try again!')
        } else {
          alert(`Successfully synced ${data.emailsCount} emails from today!`)
        }

        await loadFeedItems()
        await loadEmailThreads()
        await loadIntegrations()
      } else {
        alert('Failed to sync emails. Please try again.')
      }
    } catch (error) {
      console.error('Sync error:', error)
      alert('Error syncing emails. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const availableIntegrations = [
    { id: 'gmail', name: 'Gmail', icon: Mail },
    { id: 'slack', name: 'Slack', icon: MessageSquare },
    { id: 'calendar', name: 'Calendar', icon: Calendar },
    { id: 'todoist', name: 'Todoist', icon: CheckSquare },
    { id: 'notion', name: 'Notion', icon: FileText },
    { id: 'linear', name: 'Linear', icon: Brain },
  ]

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
        <Card>
          <CardHeader>
            <CardTitle>Your Integrations</CardTitle>
            <CardDescription>
              Connect your favorite services to unify your digital workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableIntegrations.map((service) => {
                const integration = integrations.find(i => i.service === service.id)
                const isConnected = integration?.is_connected || false

                return (
                  <Card key={service.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <service.icon className="w-5 h-5" />
                        {service.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <Badge variant={isConnected ? 'default' : 'secondary'}>
                          {isConnected ? (
                            <><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</>
                          ) : (
                            <><XCircle className="w-3 h-3 mr-1" /> Not Connected</>
                          )}
                        </Badge>
                        {!isConnected && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={service.id === 'gmail' ? connectGmail : undefined}
                          >
                            Connect
                          </Button>
                        )}
                        {isConnected && service.id === 'gmail' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={syncEmails}
                            disabled={syncing}
                          >
                            {syncing ? (
                              <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Syncing...</>
                            ) : (
                              <><RefreshCw className="w-3 h-3 mr-1" /> Sync</>
                            )}
                          </Button>
                        )}
                      </div>
                      {isConnected && integration?.connected_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Connected {new Date(integration.connected_at).toLocaleDateString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Today's Focus</CardTitle>
              <CardDescription>
                Your emails from today, organized by priority
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="now" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="now">Now</TabsTrigger>
                  <TabsTrigger value="next">Next</TabsTrigger>
                  <TabsTrigger value="later">Later</TabsTrigger>
                </TabsList>
                <TabsContent value="now" className="space-y-4">
                  {feedItems.filter(item => item.category === 'now').length > 0 ? (
                    feedItems.filter(item => item.category === 'now').map(item => (
                      <EmailItem key={item.id} item={item} />
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No urgent emails today. Items marked as important or starred appear here.
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="next" className="space-y-4">
                  {feedItems.filter(item => item.category === 'next').length > 0 ? (
                    feedItems.filter(item => item.category === 'next').map(item => (
                      <EmailItem key={item.id} item={item} />
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No unread emails today. New emails you haven't read yet appear here.
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="later" className="space-y-4">
                  {feedItems.filter(item => item.category === 'later').length > 0 ? (
                    feedItems.filter(item => item.category === 'later').map(item => (
                      <EmailItem key={item.id} item={item} />
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No other emails today. Already-read emails from today appear here.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Threads</CardTitle>
              <CardDescription>
                Recent email conversations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {emailThreads.length > 0 ? (
                  emailThreads.map(thread => (
                    <div key={thread.id} className="p-3 border rounded-lg space-y-2 hover:bg-muted/50 cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium line-clamp-1">
                            {thread.subject || 'No Subject'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {thread.participants.slice(0, 2).join(', ')}
                            {thread.participants.length > 2 && ` +${thread.participants.length - 2} more`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {thread.is_unread && (
                            <Badge variant="default" className="text-xs">New</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {thread.message_count} {thread.message_count === 1 ? 'msg' : 'msgs'}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(thread.last_message_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No email threads yet. Sync your Gmail to see conversations here.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              AI Processing & Cost Tracking
            </CardTitle>
            <CardDescription>
              Monitor your AI usage and costs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AICostDashboard />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Daily Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Your AI-powered summary will appear here once you connect your services.
              Junie will analyze your emails, messages, and calendar to help you focus on what matters most.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}