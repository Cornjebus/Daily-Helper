import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data, error } = await supabase
    .from('vip_senders')
    .select('id, sender_email, sender_name, score_boost, auto_category, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data || [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { sender_email, sender_name, score_boost, auto_category } = body
  if (!sender_email) return NextResponse.json({ error: 'sender_email is required' }, { status: 400 })
  const { error } = await supabase
    .from('vip_senders')
    .upsert({
      user_id: user.id,
      sender_email,
      sender_name,
      score_boost: typeof score_boost === 'number' ? score_boost : 30,
      auto_category,
      created_at: new Date().toISOString(),
    }, { onConflict: 'user_id,sender_email' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const sender_email = searchParams.get('sender_email')
  if (!sender_email) return NextResponse.json({ error: 'sender_email query is required' }, { status: 400 })
  const { error } = await supabase
    .from('vip_senders')
    .delete()
    .eq('user_id', user.id)
    .eq('sender_email', sender_email)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

