import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get feed_items to see their structure
    const { data: feedItems, error: feedError } = await supabase
      .from('feed_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    // Get emails to see their structure
    const { data: emails, error: emailError } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', user.id)
      .order('received_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      feedItems: feedItems || [],
      emails: emails || [],
      feedItemsCount: feedItems?.length || 0,
      emailsCount: emails?.length || 0,
    })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Debug failed',
      details: error.message,
    }, { status: 500 })
  }
}