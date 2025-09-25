import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Get counts by tier from email_scores
    const { data: scores, error: scoreErr } = await supabase
      .from('email_scores')
      .select('email_id, processing_tier')
      .eq('user_id', user.id)

    if (scoreErr) return NextResponse.json({ totals: { high: 0, medium: 0, low: 0 }, processed: { high: 0, medium: 0, low: 0 } })

    const totals = { high: 0, medium: 0, low: 0 }
    for (const s of scores || []) {
      if (s.processing_tier === 'high') totals.high++
      else if (s.processing_tier === 'medium') totals.medium++
      else if (s.processing_tier === 'low') totals.low++
    }

    // Determine processed counts using email_ai_metadata presence
    const { data: processedRows } = await supabase
      .from('email_ai_metadata')
      .select('email_id')
      .eq('user_id', user.id)

    const processedIds = new Set((processedRows || []).map(r => r.email_id))

    const processed = { high: 0, medium: 0, low: 0 }
    for (const s of scores || []) {
      // @ts-ignore
      if (processedIds.has(s.email_id)) {
        if (s.processing_tier === 'high') processed.high++
        else if (s.processing_tier === 'medium') processed.medium++
        else if (s.processing_tier === 'low') processed.low++
      }
    }

    return NextResponse.json({ totals, processed })
  } catch (error: any) {
    return NextResponse.json({ totals: { high: 0, medium: 0, low: 0 }, processed: { high: 0, medium: 0, low: 0 } })
  }
}
