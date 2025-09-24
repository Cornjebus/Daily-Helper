import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'

function verifySlackSignature(reqBody: string, timestamp: string, signature: string) {
  const secret = process.env.SLACK_SIGNING_SECRET || ''
  const base = `v0:${timestamp}:${reqBody}`
  const hmac = crypto.createHmac('sha256', secret).update(base).digest('hex')
  const computed = `v0=${hmac}`
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature || ''))
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const timestamp = (req.headers.get('x-slack-request-timestamp') || '').toString()
    const signature = (req.headers.get('x-slack-signature') || '').toString()

    // URL verification
    try {
      const parsed = JSON.parse(rawBody)
      if (parsed.type === 'url_verification') {
        return new NextResponse(parsed.challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }
    } catch {}

    // Verify signature
    if (!process.env.SLACK_SIGNING_SECRET) {
      return NextResponse.json({ error: 'Missing SLACK_SIGNING_SECRET' }, { status: 500 })
    }
    if (!timestamp || !signature || !verifySlackSignature(rawBody, timestamp, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody)
    if (payload.type !== 'event_callback') return NextResponse.json({ ok: true })

    const event = payload.event || {}
    const teamId = payload.team_id || payload.authorizations?.[0]?.team_id

    // We associate events to the user who installed Slack for this team
    const supabase = await createClient()
    const { data: integration } = await supabase
      .from('user_integrations')
      .select('user_id, workspace_id')
      .eq('service', 'slack')
      .eq('workspace_id', teamId)
      .limit(1)
      .maybeSingle()

    if (!integration) return NextResponse.json({ ok: true })

    // Handle message and app_mention events
    if (event.type === 'message' || event.type === 'app_mention') {
      const channel = event.channel
      const ts = event.ts
      const text = event.text || ''
      const user = event.user || event.username || 'unknown'

      const category = event.type === 'app_mention' ? 'now' : text.includes('<@') ? 'now' : 'next'

      // Upsert into feed_items
      const externalId = `${channel}:${ts}`
      await supabase
        .from('feed_items')
        .upsert({
          user_id: integration.user_id,
          source: 'slack',
          external_id: externalId,
          title: text.slice(0, 80) || 'Slack Message',
          content: text,
          category,
          priority: category === 'now' ? 3 : 6,
          metadata: {
            channel,
            ts,
            from: user,
          },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'external_id,source' })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Slack events error:', error)
    return NextResponse.json({ error: 'Slack events handler failed', details: error.message }, { status: 500 })
  }
}

