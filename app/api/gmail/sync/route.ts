import { createClient } from '@/lib/supabase/server'
import { fetchUserEmails, reconstructThreads } from '@/lib/gmail/service'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: gmailToken } = await supabase
      .from('gmail_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!gmailToken) {
      return NextResponse.json(
        { error: 'Gmail not connected' },
        { status: 400 }
      )
    }

    const result = await fetchUserEmails(user.id)

    await reconstructThreads(user.id)

    // Clear existing feed items from today to avoid duplicates
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    await supabase
      .from('feed_items')
      .delete()
      .eq('user_id', user.id)
      .eq('source', 'gmail')
      .gte('created_at', todayStart.toISOString())

    // Add today's emails with smart prioritization
    await supabase
      .from('feed_items')
      .upsert(
        result.emails.map(email => ({
          user_id: user.id,
          source: 'gmail',
          external_id: email.gmail_id,
          title: email.subject || 'No Subject',
          content: email.snippet || '',
          metadata: {
            from: email.sender_email,
            sender_name: email.sender_name,
            labels: email.labels,
            thread_id: email.thread_id,
            is_unread: email.is_unread,
            has_attachments: email.has_attachments,
          },
          // Smart categorization for today's emails
          category: email.is_important || email.is_starred ? 'now' :
                    email.is_unread ? 'next' :
                    'later',
          priority: email.is_important ? 1 : email.is_unread ? 5 : 10,
          created_at: email.received_at,
        }))
      )

    return NextResponse.json({
      success: true,
      emailsCount: result.count,
      message: result.count > 0
        ? `Synced ${result.count} emails from today`
        : 'No emails from today to sync',
      details: {
        today: new Date().toLocaleDateString(),
        emailsFetched: result.count,
      }
    })
  } catch (error) {
    console.error('Sync error details:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Failed to sync emails',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: syncStatus } = await supabase
      .from('sync_status')
      .select('*')
      .eq('user_id', user.id)
      .eq('service', 'gmail')
      .single()

    return NextResponse.json({
      lastSync: syncStatus?.last_sync_at || null,
      nextSync: syncStatus?.next_sync_at || null,
      status: syncStatus?.status || 'never_synced',
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}