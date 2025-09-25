'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function ComposePage() {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const sendEmail = async () => {
    setSending(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, content })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to send email')
      setSuccess('Email sent successfully')
      setTo('')
      setSubject('')
      setContent('')
    } catch (e: any) {
      setError(e?.message || 'Failed to send email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-4">
        <Link className="text-sm underline" href="/dashboard">← Back to Dashboard</Link>
      </div>
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle>Compose Email</CardTitle>
          <CardDescription>Send an email directly from within the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="to">To</Label>
            <Input id="to" placeholder="name@example.com" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="content">Message</Label>
            <Textarea id="content" rows={10} placeholder="Write your message..." value={content} onChange={e => setContent(e.target.value)} />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          {success && <div className="text-sm text-green-600">{success}</div>}
          <div className="flex justify-end">
            <Button onClick={sendEmail} disabled={sending || !to || !subject || !content}>
              {sending ? 'Sending…' : 'Send Email'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

