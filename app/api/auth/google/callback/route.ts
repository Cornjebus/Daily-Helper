import { createClient } from '@/lib/supabase/server'
import { getTokensFromCode } from '@/lib/gmail/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const origin = request.nextUrl.origin

  if (error) {
    return NextResponse.redirect(`${origin}/dashboard?error=gmail_auth_declined`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/dashboard?error=invalid_auth_response`)
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.id !== state) {
      return NextResponse.redirect(`${origin}/dashboard?error=auth_mismatch`)
    }

    const tokens = await getTokensFromCode(code)

    const { error: dbError } = await supabase
      .from('gmail_tokens')
      .upsert({
        user_id: user.id,
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token || null,
        token_type: tokens.token_type || 'Bearer',
        expiry_date: tokens.expiry_date || null,
        scope: tokens.scope || null,
        updated_at: new Date().toISOString(),
      })

    if (dbError) {
      console.error('Error saving tokens:', dbError)
      return NextResponse.redirect(`${origin}/dashboard?error=failed_to_save_tokens`)
    }

    const { error: integrationError } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: user.id,
        service: 'gmail',
        is_connected: true,
        connected_at: new Date().toISOString(),
        settings: {
          email: user.email,
          scopes: tokens.scope?.split(' ') || []
        },
      }, {
        onConflict: 'user_id,service'
      })

    if (integrationError) {
      console.error('Error saving integration:', integrationError)
    }

    return NextResponse.redirect(`${origin}/dashboard?success=gmail_connected`)
  } catch (error) {
    console.error('Gmail auth error:', error)
    return NextResponse.redirect(`${origin}/dashboard?error=gmail_auth_failed`)
  }
}