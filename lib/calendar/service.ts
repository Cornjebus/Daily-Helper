import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { createOAuth2Client } from '@/lib/gmail/auth'

export async function getUserCalendarClient(userId: string) {
  const supabase = await createClient()
  const { data: tokenData, error } = await supabase
    .from('gmail_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !tokenData) {
    throw new Error('Google not connected')
  }

  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_type: tokenData.token_type,
    expiry_date: tokenData.expiry_date,
    scope: tokenData.scope,
  })

  return google.calendar({ version: 'v3', auth: oauth2Client })
}

export async function fetchUpcomingEvents(userId: string, daysAhead = 7) {
  const calendar = await getUserCalendarClient(userId)

  const now = new Date()
  const max = new Date()
  max.setDate(now.getDate() + daysAhead)

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: max.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  })

  const events = response.data.items || []
  return events
}

export function categorizeEvent(startISO?: string | null) {
  if (!startISO) return { category: 'later' as const, priority: 8 }

  const start = new Date(startISO)
  const now = new Date()

  // Check if event is today
  const isToday = start.toDateString() === now.toDateString()

  if (isToday) {
    const diffMs = start.getTime() - now.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    // If event is within the next hour or currently happening
    if (diffHours <= 1) {
      return { category: 'now' as const, priority: 1 }
    }
    // If event is later today
    return { category: 'next' as const, priority: 3 }
  }

  // Event is on a future day
  return { category: 'later' as const, priority: 6 }
}

