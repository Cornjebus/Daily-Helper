import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getWeekStart(d = new Date()) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  const start = new Date(date.setDate(diff))
  start.setHours(0,0,0,0)
  return start
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const weekStart = getWeekStart().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('weekly_digests')
      .select('week_start_date, low_priority_emails, unsubscribe_suggestions, user_actions, generated_at')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStart)
      .maybeSingle()

    if (error) return NextResponse.json({ empty: true, weekStart })
    if (!data) return NextResponse.json({ empty: true, weekStart })

    return NextResponse.json({ weekStart, ...data })
  } catch (error: any) {
    return NextResponse.json({ empty: true, weekStart: getWeekStart().toISOString().split('T')[0] })
  }
}
