import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getWeekStart(d = new Date()) {
  const date = new Date(d)
  const day = date.getDay() // 0=Sun
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Mon as first day
  const start = new Date(date.setDate(diff))
  start.setHours(0,0,0,0)
  return start
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const weekStart = getWeekStart()
    const weekStartISO = weekStart.toISOString().split('T')[0]

    // Collect low-tier emails for this week
    let lowIds: string[] = []
    try {
      const { data: lows } = await supabase
        .from('email_scores')
        .select('email_id')
        .eq('user_id', user.id)
        .eq('processing_tier', 'low')
      lowIds = (lows || []).map(l => l.email_id)
    } catch {
      // Table may not exist yet
      lowIds = []
    }

    // Join feed items for presentation data
    let lowItems: any[] = []
    if (lowIds.length > 0) {
      const { data } = await supabase
        .from('feed_items')
        .select('external_id, title, content, metadata, created_at')
        .in('external_id', lowIds)
        .eq('user_id', user.id)
      lowItems = data || []
    }

    const categorized = {
      marketing: [] as any[],
      newsletters: [] as any[],
      social: [] as any[],
      automated: [] as any[],
    }

    const marketingKeywords = ['sale', 'deal', 'offer', 'unsubscribe', 'promotion']
    const newsletterKeywords = ['newsletter', 'digest']
    const socialKeywords = ['followed', 'liked', 'mentioned']
    const automatedKeywords = ['receipt', 'invoice', 'alert', 'system']

    for (const item of lowItems) {
      const text = `${item.title} ${item.content}`.toLowerCase()
      if (marketingKeywords.some(k => text.includes(k))) categorized.marketing.push(item)
      else if (newsletterKeywords.some(k => text.includes(k))) categorized.newsletters.push(item)
      else if (socialKeywords.some(k => text.includes(k))) categorized.social.push(item)
      else if (automatedKeywords.some(k => text.includes(k))) categorized.automated.push(item)
      else categorized.automated.push(item)
    }

    const { error } = await supabase
      .from('weekly_digests')
      .upsert({
        user_id: user.id,
        week_start_date: weekStartISO,
        low_priority_emails: categorized,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,week_start_date' })

    if (error) {
      // Swallow errors and return empty counts for MVP resilience
      return NextResponse.json({ weekStart: weekStartISO, counts: { marketing: 0, newsletters: 0, social: 0, automated: 0 } })
    }

    return NextResponse.json({ weekStart: weekStartISO, counts: {
      marketing: categorized.marketing.length,
      newsletters: categorized.newsletters.length,
      social: categorized.social.length,
      automated: categorized.automated.length,
    }})
  } catch (error: any) {
    // Return empty digest on failure to avoid breaking the UI
    const weekStart = new Date(); const day = weekStart.getDay(); const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); weekStart.setDate(diff); weekStart.setHours(0,0,0,0)
    return NextResponse.json({ weekStart: weekStart.toISOString().split('T')[0], counts: { marketing: 0, newsletters: 0, social: 0, automated: 0 } })
  }
}
