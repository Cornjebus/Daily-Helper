import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const cookieState = (await (async () => {
      // @ts-ignore: next/headers not imported in edge; fallback to manual cookie parse
      const cookiesHeader = (req as any).headers?.get?.('cookie') || ''
      const m = cookiesHeader.match(/slack_oauth_state=([^;]+)/)
      return m ? decodeURIComponent(m[1]) : undefined
    })())

    if (!code) return NextResponse.json({ error: 'No code provided' }, { status: 400 })
    if (!state || !cookieState || state !== cookieState) {
      return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
    }

    const clientId = process.env.SLACK_CLIENT_ID!
    const clientSecret = process.env.SLACK_CLIENT_SECRET!
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/slack`

    // Exchange code for token
    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      })
    })
    const tokenJson = await tokenRes.json()
    if (!tokenJson.ok) {
      return NextResponse.json({ error: 'Slack OAuth failed', details: tokenJson.error }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect('/login')

    const teamId = tokenJson.team?.id || tokenJson.enterprise?.id || null
    const additional = {
      team: tokenJson.team,
      enterprise: tokenJson.enterprise,
      authed_user: tokenJson.authed_user,
      scope: tokenJson.scope,
      bot_user_id: tokenJson.bot_user_id,
      token_type: tokenJson.token_type,
    }

    // Store/Upsert integration
    await supabase
      .from('user_integrations')
      .upsert({
        user_id: user.id,
        service: 'slack',
        access_token: tokenJson.access_token,
        workspace_id: teamId,
        additional_data: additional,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,service' })

    return NextResponse.redirect('/dashboard')
  } catch (error: any) {
    return NextResponse.json({ error: 'Slack OAuth error', details: error.message }, { status: 500 })
  }
}

