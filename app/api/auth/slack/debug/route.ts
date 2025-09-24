import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.SLACK_CLIENT_ID || null
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/auth/callback/slack`
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
  const authUrl = new URL('https://slack.com/oauth/v2/authorize')
  if (clientId) authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('scope', scopes.join(' '))
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', 'debug')

  return NextResponse.json({
    client_id: clientId,
    redirect_uri: redirectUri,
    authorize_url: authUrl.toString(),
  })
}

