import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { action, category } = body as { action?: string; category?: string }
    if (!action || !category) return NextResponse.json({ error: 'action and category required' }, { status: 400 })

    // Load current digest to get targeted items
    const weekStart = new Date()
    const day = weekStart.getDay()
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1)
    weekStart.setDate(diff); weekStart.setHours(0,0,0,0)
    const weekStartISO = weekStart.toISOString().split('T')[0]

    const { data: digest } = await supabase
      .from('weekly_digests')
      .select('low_priority_emails')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStartISO)
      .maybeSingle()

    const items = digest?.low_priority_emails?.[category] || []
    const externalIds: string[] = items.map((i: any) => i.external_id).filter(Boolean)

    if (externalIds.length === 0) return NextResponse.json({ updated: 0 })

    let updated = 0
    if (action === 'archive') {
      const { error } = await supabase
        .from('feed_items')
        .update({ metadata: { archived: true } })
        .in('external_id', externalIds)
        .eq('user_id', user.id)
      if (!error) updated = externalIds.length
    } else if (action === 'mark_read') {
      const { error } = await supabase
        .from('feed_items')
        .update({ metadata: { ...(digest?.metadata || {}), read: true } as any })
        .in('external_id', externalIds)
        .eq('user_id', user.id)
      if (!error) updated = externalIds.length
    } else if (action === 'unsubscribe') {
      // Mark items with unsubscribe intent; actual unsubscribe can be handled by a worker later
      const { error } = await supabase
        .from('feed_items')
        .update({ metadata: { unsubscribe_requested: true } as any })
        .in('external_id', externalIds)
        .eq('user_id', user.id)
      if (!error) updated = externalIds.length
    } else if (action === 'keep') {
      // No-op: could set a flag to suppress future digest suggestions
      updated = externalIds.length
    } else {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
    }

    return NextResponse.json({ updated })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to apply actions', details: error.message }, { status: 500 })
  }
}
