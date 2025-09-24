import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { error } = await supabase
    .from('user_integrations')
    .upsert({
      user_id: user.id,
      service: 'gmail',
      is_connected: true,
      connected_at: new Date().toISOString(),
      settings: {
        email: user.email,
      }
    }, {
      onConflict: 'user_id,service'
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Gmail integration fixed' })
}