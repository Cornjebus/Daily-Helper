import { gmail_v1 } from 'googleapis'
import { getUserGmailClient } from './auth'
import { createClient } from '@/lib/supabase/server'

interface EmailData {
  gmail_id: string
  thread_id: string
  subject: string | null
  sender_email: string | null
  sender_name: string | null
  recipient_email: string | null
  snippet: string | null
  body_text: string | null
  body_html: string | null
  labels: string[]
  has_attachments: boolean
  attachments: any[]
  is_unread: boolean
  is_important: boolean
  is_starred: boolean
  received_at: string
}

export async function fetchUserEmails(userId: string, maxResults: number = 50) {
  const gmail = await getUserGmailClient(userId)
  const supabase = await createClient()

  try {
    // Get today's date in Gmail query format (YYYY/MM/DD)
    const today = new Date()
    const todayStr = `${today.getFullYear()}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}`

    // Fetch only today's emails
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: `after:${todayStr}`,
    })

    const messages = response.data.messages || []
    const emailsToStore: EmailData[] = []

    for (const message of messages) {
      if (!message.id) continue

      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
      })

      const emailData = parseEmailMessage(fullMessage.data)
      if (emailData) {
        emailsToStore.push({
          ...emailData,
          gmail_id: message.id,
          thread_id: message.threadId || message.id,
        })
      }
    }

    if (emailsToStore.length > 0) {
      const { error } = await supabase
        .from('emails')
        .upsert(
          emailsToStore.map(email => ({
            ...email,
            user_id: userId,
          })),
          { onConflict: 'user_id,gmail_id' }
        )

      if (error) {
        console.error('Error storing emails:', error)
        throw error
      }
    }

    await updateSyncStatus(userId, 'gmail')

    return { count: emailsToStore.length, emails: emailsToStore }
  } catch (error) {
    console.error('Error fetching emails:', error)
    throw error
  }
}

function parseEmailMessage(message: gmail_v1.Schema$Message): Omit<EmailData, 'gmail_id' | 'thread_id'> | null {
  const headers = message.payload?.headers || []
  const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || null

  const subject = getHeader('subject')
  const from = getHeader('from')
  const to = getHeader('to')
  const date = getHeader('date')

  const { sender_email, sender_name } = parseEmailAddress(from)

  const labels = message.labelIds || []
  const is_unread = labels.includes('UNREAD')
  const is_important = labels.includes('IMPORTANT')
  const is_starred = labels.includes('STARRED')

  const { text, html, attachments } = extractBody(message.payload)

  return {
    subject,
    sender_email,
    sender_name,
    recipient_email: to,
    snippet: message.snippet || null,
    body_text: text,
    body_html: html,
    labels,
    has_attachments: attachments.length > 0,
    attachments,
    is_unread,
    is_important,
    is_starred,
    received_at: date ? new Date(date).toISOString() : new Date().toISOString(),
  }
}

function parseEmailAddress(address: string | null): { sender_email: string | null; sender_name: string | null } {
  if (!address) return { sender_email: null, sender_name: null }

  const match = address.match(/^"?([^"<]*)"?\s*<?([^>]+)>?$/)
  if (match) {
    return {
      sender_name: match[1].trim() || null,
      sender_email: match[2].trim(),
    }
  }

  return { sender_email: address.trim(), sender_name: null }
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): {
  text: string | null
  html: string | null
  attachments: any[]
} {
  if (!payload) return { text: null, html: null, attachments: [] }

  let text: string | null = null
  let html: string | null = null
  const attachments: any[] = []

  const processPayloadPart = (part: gmail_v1.Schema$MessagePart) => {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size,
        attachmentId: part.body.attachmentId,
      })
    }

    if (part.mimeType === 'text/plain' && part.body?.data) {
      text = Buffer.from(part.body.data, 'base64').toString('utf-8')
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      html = Buffer.from(part.body.data, 'base64').toString('utf-8')
    }

    if (part.parts) {
      part.parts.forEach(processPayloadPart)
    }
  }

  processPayloadPart(payload)

  return { text, html, attachments }
}

async function updateSyncStatus(userId: string, service: string) {
  const supabase = await createClient()

  await supabase
    .from('sync_status')
    .upsert({
      user_id: userId,
      service,
      last_sync_at: new Date().toISOString(),
      next_sync_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      status: 'success',
    })
}

export async function reconstructThreads(userId: string) {
  const supabase = await createClient()

  const { data: emails } = await supabase
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .order('received_at', { ascending: false })

  if (!emails) return

  const threadsMap = new Map<string, any>()

  emails.forEach(email => {
    if (!threadsMap.has(email.thread_id)) {
      threadsMap.set(email.thread_id, {
        thread_id: email.thread_id,
        user_id: userId,
        subject: email.subject,
        participants: [],
        message_count: 0,
        last_message_at: email.received_at,
        is_unread: false,
      })
    }

    const thread = threadsMap.get(email.thread_id)
    thread.message_count++
    thread.is_unread = thread.is_unread || email.is_unread

    if (email.sender_email && !thread.participants.includes(email.sender_email)) {
      thread.participants.push(email.sender_email)
    }

    if (new Date(email.received_at) > new Date(thread.last_message_at)) {
      thread.last_message_at = email.received_at
    }
  })

  const threads = Array.from(threadsMap.values())

  if (threads.length > 0) {
    await supabase
      .from('email_threads')
      .upsert(threads)
  }

  return threads
}