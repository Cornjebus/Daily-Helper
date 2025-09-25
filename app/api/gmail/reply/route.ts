import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserGmailClient } from '@/lib/gmail/auth'

function b64url(input: string) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function POST(request: NextRequest) {
  try {
    const { emailId, content } = await request.json()
    if (!emailId || !content) return NextResponse.json({ error: 'emailId and content required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: email } = await supabase
      .from('emails')
      .select('*')
      .eq('id', emailId)
      .eq('user_id', user.id)
      .single()
    if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })

    const gmail = await getUserGmailClient(user.id)
    const raw = [
      `To: ${email.sender_email}`,
      `Subject: Re: ${email.subject || ''}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      content,
    ].join('\r\n')

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: b64url(raw),
        threadId: email.thread_id || undefined,
      }
    })

    // Mark original as replied (soft flag)
    await supabase
      .from('emails')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', emailId)

    // Store reply record
    await supabase
      .from('reply_drafts')
      .insert({ email_id: emailId, user_id: user.id, draft_content: content, sent_at: new Date().toISOString() })

    return NextResponse.json({ success: true, id: res.data.id, threadId: res.data.threadId })
  } catch (error: any) {
    console.error('Reply send error:', error)
    return NextResponse.json({ error: 'Reply failed', details: error.message }, { status: 500 })
  }
}

