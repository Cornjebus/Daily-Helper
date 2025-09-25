import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractUnsubscribeLinks } from '@/lib/gmail/unsubscribe'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const emailIds: string[] = Array.isArray(body?.emailIds) ? body.emailIds : []
    if (emailIds.length === 0) {
      return NextResponse.json({ error: 'emailIds required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Accept either internal UUIDs or Gmail IDs
    let { data: emails, error } = await supabase
      .from('emails')
      .select('id, gmail_id, body_html, body_text')
      .eq('user_id', user.id)
      .in('id', emailIds)

    if (!emails || emails.length === 0) {
      const alt = await supabase
        .from('emails')
        .select('id, gmail_id, body_html, body_text')
        .eq('user_id', user.id)
        .in('gmail_id', emailIds)
      emails = alt.data || []
      error = alt.error as any
    }

    if (error) throw error

    const results: Record<string, string[]> = {}
    for (const e of emails || []) {
      const links = await extractUnsubscribeLinks(e.body_html || '')
      results[e.id] = links
    }

    return NextResponse.json({ success: true, links: results })
  } catch (error: any) {
    console.error('Unsubscribe discovery error:', error)
    return NextResponse.json({ error: 'Failed to extract unsubscribe links', details: error.message }, { status: 500 })
  }
}
