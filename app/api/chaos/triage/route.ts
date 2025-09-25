import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchUserEmails } from '@/lib/gmail/service'
import { POST as processEmails } from '@/app/api/ai/process-emails/route'
import { POST as calendarSync } from '@/app/api/calendar/sync/route'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Limits from user-integrations
    let gmailLimit = 25
    let aiLimit = 25
    try {
      const { data: integ } = await supabase
        .from('user_integrations')
        .select('additional_data')
        .eq('user_id', user.id)
        .eq('service', 'gmail')
        .maybeSingle()
      const add = (integ as any)?.additional_data || {}
      if (typeof add.gmail_sync_limit === 'number') gmailLimit = add.gmail_sync_limit
      if (typeof add.ai_process_limit === 'number') aiLimit = add.ai_process_limit
    } catch {}

    // 1) Gmail sync recent
    const syncRes = await fetchUserEmails(user.id, gmailLimit)

    // 2) Run AI processing (uses its own limit internally)
    const aiResponse = await processEmails()
    const aiJson = await aiResponse.json()

    // 3) Calendar sync (optional, does not block)
    try { await calendarSync() } catch {}

    return NextResponse.json({
      synced: syncRes.count,
      processed: aiJson?.processed || { scored: 0, summarized: 0, errors: 0 },
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'Triage failed', details: error.message }, { status: 500 })
  }
}

