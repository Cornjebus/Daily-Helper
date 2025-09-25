import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { id: emailId } = await ctx.params
    const { data, error } = await supabase
      .from('email_scores')
      .select('raw_score, final_score, processing_tier, score_factors')
      .eq('user_id', user.id)
      .eq('email_id', emailId)
      .maybeSingle()

    if (error) return NextResponse.json({ error: 'Failed to load score', details: error.message }, { status: 200 })
    if (!data) return NextResponse.json({ error: 'Score not found' }, { status: 404 })

    return NextResponse.json({
      finalScore: data.final_score,
      tier: data.processing_tier,
      factors: data.score_factors || {},
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to load score', details: error.message }, { status: 200 })
  }
}
