import { createClient } from '@/lib/supabase/server'
import { getUserGmailClient } from '@/lib/gmail/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Test 1: Check if user has Gmail tokens
    const { data: tokens } = await supabase
      .from('gmail_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!tokens) {
      return NextResponse.json({
        error: 'Gmail not connected',
        step: 'Check tokens'
      })
    }

    // Test 2: Try to get Gmail client
    try {
      const gmail = await getUserGmailClient(user.id)

      // Test 3: Try to list messages
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 1,
        q: 'newer_than:1d'
      })

      return NextResponse.json({
        success: true,
        hasTokens: true,
        canConnect: true,
        messagesFound: response.data.messages?.length || 0,
        totalMessages: response.data.resultSizeEstimate || 0
      })
    } catch (gmailError: any) {
      return NextResponse.json({
        error: 'Gmail API error',
        details: gmailError.message,
        step: 'Gmail API call'
      })
    }
  } catch (error: any) {
    return NextResponse.json({
      error: 'Test failed',
      details: error.message
    })
  }
}