import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Get low-tier email ids
    const { data: lows } = await supabase
      .from('email_scores')
      .select('email_id')
      .eq('user_id', user.id)
      .eq('processing_tier', 'low')

    const ids = (lows || []).map(l => l.email_id)
    if (ids.length === 0) return NextResponse.json({ archived: 0 })

    // Archive related feed items
    const { error } = await supabase
      .from('feed_items')
      .update({ metadata: { archived: true } as any })
      .in('external_id', ids)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ archived: ids.length })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to delete chaos emails', details: error.message }, { status: 500 })
  }
}

