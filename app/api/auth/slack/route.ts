import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET() {
  const clientId = process.env.SLACK_CLIENT_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/slack`
  const scopes = [
    'channels:history',
    'groups:history',
    'im:history',
    'mpim:history',
    'conversations:read',
    'users:read',
    'users:read.email',
    'channels:read',
    'groups:read',
    'im:read',
    'mpim:read',
    'chat:write',
    'app_mentions:read'
  ]

  if (!clientId) {
    return NextResponse.json({ error: 'Missing SLACK_CLIENT_ID' }, { status: 500 })
  }

  const state = crypto.randomBytes(16).toString('hex')
  const url = new URL('https://slack.com/oauth/v2/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('scope', scopes.join(' '))
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)

  const res = NextResponse.redirect(url.toString())
  res.cookies.set('slack_oauth_state', state, { httpOnly: true, sameSite: 'lax', path: '/' })
  return res
}
