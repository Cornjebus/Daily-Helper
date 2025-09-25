import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSmartReplies } from '@/lib/ai/openai'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const feedItemId = body.feed_item_id as string | undefined
    if (!feedItemId) return NextResponse.json({ error: 'feed_item_id is required' }, { status: 400 })

    // Find the feed item for this user
    const { data: feedItem, error: feedErr } = await supabase
      .from('feed_items')
      .select('*')
      .eq('id', feedItemId)
      .eq('user_id', user.id)
      .single()

    if (feedErr || !feedItem) {
      return NextResponse.json({ error: 'Feed item not found' }, { status: 404 })
    }

    if (feedItem.source !== 'gmail' || !feedItem.external_id) {
      return NextResponse.json({ error: 'Smart replies supported for Gmail emails only' }, { status: 400 })
    }

    // Load the email referenced by this feed item (external_id may be internal UUID or gmail_id)
    let { data: email } = await supabase
      .from('emails')
      .select('*')
      .eq('id', feedItem.external_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!email) {
      const alt = await supabase
        .from('emails')
        .select('*')
        .eq('gmail_id', feedItem.external_id)
        .eq('user_id', user.id)
        .maybeSingle()
      email = alt.data || null
    }

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    const replies = await generateSmartReplies(
      user.id,
      email.id,
      email.subject || 'No subject',
      email.from_email || 'Unknown',
      email.snippet || ''
    )

    return NextResponse.json({ replies })
  } catch (error: any) {
    console.error('Smart replies API error:', error)
    return NextResponse.json({ error: 'Failed to generate replies', details: error.message }, { status: 500 })
  }
}
