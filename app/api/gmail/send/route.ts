import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserGmailClient } from '@/lib/gmail/auth'

function base64UrlEncode(input: string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function buildRawMessage({ to, subject, body, inReplyTo, references }: {
  to: string
  subject: string
  body: string
  inReplyTo?: string
  references?: string
}) {
  const headers: string[] = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
  ]
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`)
  if (references) headers.push(`References: ${references}`)
  const message = headers.join('\r\n') + `\r\n\r\n${body}`
  return base64UrlEncode(message)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    let { to, subject, content, threadId, inReplyTo, references, feedItemId } = body || {}

    // Ensure Gmail connected
    const { data: gmailToken } = await supabase
      .from('gmail_tokens')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!gmailToken) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })
    }

    // If some fields are missing, try to resolve from feed item / email
    if ((!to || !threadId) && feedItemId) {
      const supabaseFetch = await createClient()
      const { data: feedItem } = await supabaseFetch
        .from('feed_items')
        .select('external_id, source, metadata')
        .eq('id', feedItemId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (feedItem?.external_id && (feedItem.source === 'gmail')) {
        const { data: email } = await supabaseFetch
          .from('emails')
          .select('*')
          .eq('id', feedItem.external_id)
          .eq('user_id', user.id)
          .maybeSingle()
        if (email) {
          // Prefer explicit to, else use email.from_email
          if (!to) to = email.from_email
          if (!threadId && email.thread_id) threadId = email.thread_id
        }
      }
      if (!to) {
        // Fallback to metadata.from if available
        to = feedItem?.metadata?.from || to
      }
    }

    // Extract plain email if "Name <email>" format
    if (typeof to === 'string') {
      const m = to.match(/<([^>]+)>/) // capture email within angle brackets
      if (m && m[1]) to = m[1]
    }

    if (!to || !subject || !content) {
      return NextResponse.json({ error: 'Missing to, subject, or content' }, { status: 400 })
    }

    const gmail = await getUserGmailClient(user.id)

    const raw = buildRawMessage({ to, subject, body: content, inReplyTo, references })

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        ...(threadId ? { threadId } : {}),
      }
    })

    return NextResponse.json({ success: true, id: res.data.id, threadId: res.data.threadId })
  } catch (error: any) {
    console.error('Send email error:', error)
    return NextResponse.json({ error: 'Failed to send email', details: error.message }, { status: 500 })
  }
}
