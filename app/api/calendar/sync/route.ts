import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchUpcomingEvents, categorizeEvent } from '@/lib/calendar/service'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Verify Google connected (gmail_tokens as a proxy)
    const { data: googleToken } = await supabase
      .from('gmail_tokens')
      .select('user_id')
      .eq('user_id', user.id)
      .single()

    if (!googleToken) {
      return NextResponse.json({ error: 'Google not connected. Please connect Google first.' }, { status: 400 })
    }

    const events = await fetchUpcomingEvents(user.id, 7)
    let created = 0
    for (const ev of events) {
      const startISO = ev.start?.dateTime || (ev.start?.date ? `${ev.start.date}T00:00:00Z` : undefined)
      const when = startISO ? new Date(startISO) : null
      const { category, priority } = categorizeEvent(startISO)
      const title = ev.summary || 'Calendar Event'
      const location = ev.location ? ` @ ${ev.location}` : ''

      // Format time based on category
      let whenStr = 'TBD'
      if (when) {
        const today = new Date()
        const isToday = when.toDateString() === today.toDateString()

        if (isToday) {
          // For today's events, show just the time
          whenStr = when.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })
        } else {
          // For future events, show day and time
          whenStr = when.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })
        }
      }

      const content = `${whenStr}${location}`

      const externalId = `primary:${ev.id}`

      const { error } = await supabase
        .from('feed_items')
        .upsert({
          user_id: user.id,
          source: 'calendar',
          external_id: externalId,
          title,
          content,
          category,
          priority,
          metadata: {
            calendar: 'primary',
            start: startISO,
            end: ev.end?.dateTime || ev.end?.date,
            attendees: ev.attendees?.length || 0,
          },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'external_id,source' })

      if (!error) created++
    }

    return NextResponse.json({ events: events.length, itemsCreated: created })
  } catch (error: any) {
    console.error('Calendar sync error:', error)
    return NextResponse.json({ error: 'Failed to sync Calendar', details: error.message }, { status: 500 })
  }
}

