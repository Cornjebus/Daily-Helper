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

    const gmail = await getUserGmailClient(user.id)

    // Get today's date in Gmail query format
    const today = new Date()
    const todayStr = `${today.getFullYear()}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}`

    // Fetch today's emails
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
      q: `after:${todayStr}`,
    })

    const messages = response.data.messages || []

    // Get details for first few messages
    const emailDetails = []
    for (const message of messages.slice(0, 3)) {
      if (!message.id) continue

      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
      })

      const headers = fullMessage.data.payload?.headers || []
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject'
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown'

      emailDetails.push({
        id: message.id,
        threadId: message.threadId,
        subject,
        from,
        snippet: fullMessage.data.snippet,
        labels: fullMessage.data.labelIds
      })
    }

    return NextResponse.json({
      success: true,
      todayDate: todayStr,
      totalFound: messages.length,
      emails: emailDetails
    })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Test sync failed',
      details: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}