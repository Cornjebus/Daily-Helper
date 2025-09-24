import { createClient } from '@/lib/supabase/server'
import { fetchUserEmails, reconstructThreads } from '@/lib/gmail/service'

export async function syncAllUserEmails() {
  const supabase = await createClient()

  const { data: users } = await supabase
    .from('user_integrations')
    .select('user_id')
    .eq('service', 'gmail')
    .eq('is_connected', true)

  if (!users || users.length === 0) {
    console.log('No users with Gmail connected')
    return
  }

  const results = []

  for (const user of users) {
    try {
      const { data: syncStatus } = await supabase
        .from('sync_status')
        .select('*')
        .eq('user_id', user.user_id)
        .eq('service', 'gmail')
        .single()

      const shouldSync = !syncStatus?.last_sync_at ||
        new Date(syncStatus.last_sync_at) < new Date(Date.now() - 5 * 60 * 1000)

      if (shouldSync) {
        console.log(`Syncing emails for user ${user.user_id}`)

        const result = await fetchUserEmails(user.user_id)
        await reconstructThreads(user.user_id)

        results.push({
          userId: user.user_id,
          emailsCount: result.count,
          success: true,
        })

        await supabase
          .from('feed_items')
          .upsert(
            result.emails.slice(0, 10).map(email => ({
              user_id: user.user_id,
              source: 'gmail',
              source_id: email.gmail_id,
              title: email.subject || 'No Subject',
              content: email.snippet || '',
              metadata: {
                from: email.sender_email,
                labels: email.labels,
                thread_id: email.thread_id,
              },
              priority: email.is_important ? 'now' : email.is_unread ? 'next' : 'later',
              created_at: email.received_at,
            }))
          )
      }
    } catch (error) {
      console.error(`Error syncing emails for user ${user.user_id}:`, error)
      results.push({
        userId: user.user_id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return results
}

export function setupPeriodicSync() {
  if (typeof window === 'undefined') {
    setInterval(async () => {
      console.log('Running periodic email sync...')
      const results = await syncAllUserEmails()
      console.log('Sync complete:', results)
    }, 5 * 60 * 1000)
  }
}