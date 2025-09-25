import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
      .from('hourly_summaries')
      .select('*')
      .eq('user_id', user.id)
      .order('hour_timestamp', { ascending: false })
      .limit(1)

    const latest = data?.[0] ? {
      hour: data[0].hour_timestamp,
      total: data[0].total_emails,
      important: data[0].important_count,
      chaos: data[0].chaos_count,
    } : null

    return NextResponse.json({ latest })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to load summary', details: error.message }, { status: 500 })
  }
}

