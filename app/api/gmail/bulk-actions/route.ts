import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { action, emailIds, filters } = body || {}
    if (!action || (!Array.isArray(emailIds) && !filters)) {
      return NextResponse.json({ error: 'action and emailIds or filters required' }, { status: 400 })
    }

    // Build base query
    let query = supabase.from('emails').select('id, gmail_id').eq('user_id', user.id)

    if (Array.isArray(emailIds)) {
      // Accept either internal UUIDs or Gmail IDs
      query = query.or(`id.in.(${emailIds.join(',')}),gmail_id.in.(${emailIds.join(',')})`)
    } else if (filters) {
      if (filters.sender) query = query.eq('sender_email', filters.sender)
      if (filters.dateRange?.from) query = query.gte('received_at', new Date(filters.dateRange.from).toISOString())
      if (filters.dateRange?.to) query = query.lte('received_at', new Date(filters.dateRange.to).toISOString())
    }

    const { data: targets } = await query
    const ids = (targets || []).map((t: any) => t.id)
    if (ids.length === 0) return NextResponse.json({ success: true, affected: 0 })

    if (action === 'mark-read') {
      await supabase.from('emails').update({ is_unread: false }).in('id', ids)
    } else if (action === 'archive') {
      // Archive = move to low category in feed_items for now
      await supabase.from('feed_items').update({ category: 'later' }).in('external_id', ids).eq('user_id', user.id)
    } else if (action === 'delete') {
      await supabase.from('emails').delete().in('id', ids)
      await supabase.from('feed_items').delete().in('external_id', ids).eq('user_id', user.id)
    } else {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
    }

    return NextResponse.json({ success: true, affected: ids.length })
  } catch (error: any) {
    console.error('Bulk actions error:', error)
    return NextResponse.json({ error: 'Bulk action failed', details: error.message }, { status: 500 })
  }
}
