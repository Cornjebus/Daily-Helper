import { createClient } from '@/lib/supabase/server'

export async function generateHourlySummary(userId: string) {
  const supabase = await createClient()

  const now = new Date()
  const hourStart = new Date(now)
  hourStart.setMinutes(0, 0, 0)

  // Emails in the last hour
  const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

  const { data: emails } = await supabase
    .from('emails')
    .select('id, subject, sender_email, received_at')
    .eq('user_id', userId)
    .gte('received_at', since)

  const total = emails?.length || 0

  // Use email_scores (high tier) as important
  const { data: important } = await supabase
    .from('email_scores')
    .select('email_id, final_score')
    .eq('user_id', userId)
    .gte('processed_at', since)
    .gte('final_score', 60)

  const importantIds = new Set((important || []).map((i: any) => i.email_id))
  const importantCount = importantIds.size
  const chaosCount = Math.max(0, total - importantCount)

  const importantEmails = (emails || [])
    .filter(e => importantIds.has(e.id))
    .slice(0, 10)
    .map(e => ({ id: e.id, subject: e.subject, from: e.sender_email, received_at: e.received_at }))

  const summaryText = `Processed ${total} emails. Important: ${importantCount}. Chaos: ${chaosCount}.`

  const { error } = await supabase
    .from('hourly_summaries')
    .upsert({
      user_id: userId,
      hour_timestamp: hourStart.toISOString(),
      total_emails: total,
      important_count: importantCount,
      chaos_count: chaosCount,
      summary_text: summaryText,
      important_emails: importantEmails,
      created_at: new Date().toISOString(),
      expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'user_id,hour_timestamp' })

  if (error) {
    console.error('Failed to upsert hourly summary', error)
  }

  return {
    hour: hourStart.toISOString(),
    total,
    important: importantCount,
    chaos: chaosCount,
  }
}

