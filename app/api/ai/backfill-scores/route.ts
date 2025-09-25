import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateEmailScore } from '@/lib/scoring/email-scorer'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Fetch recent emails to backfill (limit to 500 for safety)
    const { data: emails, error } = await supabase
      .from('emails')
      .select('id, subject, from_email, snippet, is_important, is_starred, is_unread, received_at')
      .eq('user_id', user.id)
      .order('received_at', { ascending: false })
      .limit(500)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let scored = 0
    let updated = 0

    for (const email of emails || []) {
      try {
        const scoring = await calculateEmailScore(user.id, email as any)
        const mappedPriority = Math.max(1, 10 - Math.floor(scoring.finalScore / 10))

        // Upsert score row
        const up = await supabase
          .from('email_scores')
          .upsert({
            user_id: user.id,
            email_id: email.id,
            raw_score: scoring.rawScore,
            final_score: scoring.finalScore,
            processing_tier: scoring.tier,
            score_factors: scoring.factors,
            created_at: new Date().toISOString(),
          }, { onConflict: 'email_id' })
        if (up.error) throw up.error
        scored++

        // Upsert feed item category/priority based on tier
        const category = scoring.tier === 'high' ? 'now' : scoring.tier === 'medium' ? 'next' : 'later'
        const fi = await supabase
          .from('feed_items')
          .upsert({
            user_id: user.id,
            source: 'gmail',
            external_id: email.id,
            title: (email as any).subject || 'No Subject',
            content: (email as any).snippet || '',
            category,
            priority: mappedPriority,
            metadata: { from: (email as any).from_email },
            updated_at: new Date().toISOString(),
          }, { onConflict: 'external_id,source' })
        if (fi.error) throw fi.error
        updated++
      } catch (e) {
        // continue
      }
    }

    return NextResponse.json({ scored, updated })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to backfill scores', details: error.message }, { status: 500 })
  }
}

