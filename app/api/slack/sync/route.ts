import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function slackApi(path: string, token: string, method: string = 'GET', body?: any) {
  const url = `https://slack.com/api/${path}`
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error || 'Slack API error')
  return json
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Get Slack integration for this user
    const { data: integ, error: integErr } = await supabase
      .from('user_integrations')
      .select('access_token, workspace_id')
      .eq('user_id', user.id)
      .eq('service', 'slack')
      .single()

    if (integErr || !integ?.access_token) {
      return NextResponse.json({ error: 'Slack not connected' }, { status: 400 })
    }

    const token = integ.access_token as string

    // Get conversations (channels + ims)
    const conversations = await slackApi('conversations.list?types=public_channel,private_channel,im,mpim&limit=20', token)
    const chans = conversations.channels || []

    let itemsCreated = 0
    let skippedChannels = 0
    const errorsByType: Record<string, number> = {}

    // Helper to resolve IM user -> display name
    const userCache = new Map<string, string>()
    const getUserDisplay = async (userId: string): Promise<string> => {
      if (userCache.has(userId)) return userCache.get(userId) as string
      try {
        const info = await slackApi(`users.info?user=${encodeURIComponent(userId)}`, token)
        const profile = info.user?.profile || {}
        const disp = `@${profile.display_name || profile.real_name || info.user?.name || userId}`
        userCache.set(userId, disp)
        return disp
      } catch (e) {
        return `@${userId}`
      }
    }

    // Fetch recent messages for a limited number of conversations
    for (const ch of chans.slice(0, 5)) {
      try {
        const hist = await slackApi(`conversations.history?channel=${encodeURIComponent(ch.id)}&limit=20`, token)
        const messages = hist.messages || []
        const channelLabel = ch.is_im && ch.user ? await getUserDisplay(ch.user) : (ch.name || ch.id)

        for (const m of messages) {
          if (!m.ts || !m.text) continue
          const externalId = `${ch.id}:${m.ts}`
          const category = (m.text.includes(`<@`) ? 'now' : 'next') as 'now' | 'next'
          const priority = category === 'now' ? 3 : 6
          const title = (m.text as string).slice(0, 80) || 'Slack Message'

          const { error: upErr } = await supabase
            .from('feed_items')
            .upsert({
              user_id: user.id,
              source: 'slack',
              external_id: externalId,
              title,
              content: m.text,
              category,
              priority,
              metadata: {
                channel: channelLabel,
                ts: m.ts,
                from: m.user || m.username || 'unknown'
              },
              updated_at: new Date().toISOString(),
            }, { onConflict: 'external_id,source' })

          if (!upErr) itemsCreated++
        }
      } catch (e: any) {
        skippedChannels++
        const key = (e?.message || 'unknown_error')
        errorsByType[key] = (errorsByType[key] || 0) + 1
        continue
      }
    }

    return NextResponse.json({ itemsCreated, skippedChannels, errorsByType })
  } catch (error: any) {
    console.error('Slack sync error:', error)
    return NextResponse.json({ error: 'Failed to sync Slack', details: error.message }, { status: 500 })
  }
}
