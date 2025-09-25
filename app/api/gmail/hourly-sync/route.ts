import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchUserEmails } from '@/lib/gmail/service'
import { generateHourlySummary } from '@/lib/summary/hourly'
import { POST as processEmails } from '@/app/api/ai/process-emails/route'

export async function POST(request: NextRequest) {
  try {
    // Accept either CRON (Bearer) or user session
    const auth = request.headers.get('authorization') || ''
    const isCron = auth === `Bearer ${process.env.CRON_SECRET}`
    const supabase = await createClient()

    let targetUserId: string | null = null
    if (!isCron) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      targetUserId = user.id
    } else {
      try {
        const body = await request.json()
        targetUserId = body?.userId || null
      } catch {}
    }

    if (targetUserId) {
      // Process a single user
      const result = await runForUser(targetUserId)
      return NextResponse.json({ success: true, users: 1, result })
    }

    // Cron for all connected users
    const { data: users } = await supabase
      .from('user_integrations')
      .select('user_id')
      .eq('service', 'gmail')
      .eq('is_connected', true)

    let processed = 0
    if (users) {
      for (const u of users) {
        await runForUser(u.user_id)
        processed++
      }
    }

    return NextResponse.json({ success: true, users: processed })
  } catch (error: any) {
    console.error('Hourly sync error:', error)
    return NextResponse.json({ error: 'Hourly sync failed', details: error.message }, { status: 500 })
  }
}

async function runForUser(userId: string) {
  const supabase = await createClient()
  // 1) Fetch last hour emails
  const sync = await fetchUserEmails(userId, 100, 60)
  // 2) AI processing
  await processEmails(new Request('http://internal', { method: 'POST', body: JSON.stringify({ userId, source: 'cron' }) }))
  // 3) Generate and store summary
  const summary = await generateHourlySummary(userId)
  return { synced: sync.count, summary }
}

