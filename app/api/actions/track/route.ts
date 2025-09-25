import { NextRequest, NextResponse } from 'next/server'
import { learningEngine, UserAction } from '@/lib/learning/user-actions'
import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      emailId,
      action,
      userId,
      emailScore,
      senderEmail,
      subject,
      patterns
    } = body

    // Validate required fields
    if (!emailId || !action || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: emailId, action, userId' },
        { status: 400 }
      )
    }

    // Validate action type
    const validActions: UserAction[] = ['star', 'archive', 'reply', 'delete', 'read', 'unread']
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      )
    }

    // Get email details if not provided
    let emailData = { emailScore, senderEmail, subject, patterns }

    if (!emailData.emailScore || !emailData.senderEmail) {
      const { data: email } = await supabase
        .from('emails')
        .select(`
          priority_score,
          sender_email,
          subject,
          email_intelligence (patterns)
        `)
        .eq('id', emailId)
        .single()

      if (email) {
        emailData.emailScore = emailData.emailScore || email.priority_score
        emailData.senderEmail = emailData.senderEmail || email.sender_email
        emailData.subject = emailData.subject || email.subject
        emailData.patterns = emailData.patterns || email.email_intelligence?.patterns
      }
    }

    // Track the action through learning engine
    await learningEngine.trackAction({
      emailId,
      action: action as UserAction,
      userId,
      timestamp: new Date(),
      emailScore: emailData.emailScore,
      senderEmail: emailData.senderEmail,
      subject: emailData.subject,
      patterns: emailData.patterns
    })

    return NextResponse.json({
      success: true,
      message: 'Action tracked successfully',
      learningEnabled: true
    })

  } catch (error) {
    logError('Failed to track user action', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const emailId = searchParams.get('emailId')
    const action = searchParams.get('action')

    let query = supabase.from('user_actions').select('*')

    // Apply filters
    if (userId) {
      query = query.eq('user_id', userId)
    }
    if (emailId) {
      query = query.eq('email_id', emailId)
    }
    if (action) {
      query = query.eq('action', action)
    }

    // Order by most recent
    query = query.order('timestamp', { ascending: false }).limit(100)

    const { data: actions, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      actions: actions || [],
      count: actions?.length || 0
    })

  } catch (error) {
    logError('Failed to fetch user actions', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get learning statistics
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const operation = searchParams.get('operation')

    if (operation === 'statistics') {
      const stats = await learningEngine.getLearningStatistics()

      return NextResponse.json({
        success: true,
        statistics: stats
      })
    }

    if (operation === 'process-historical') {
      const body = await request.json()
      const { userId, limit = 1000 } = body

      if (!userId) {
        return NextResponse.json(
          { error: 'userId required for historical processing' },
          { status: 400 }
        )
      }

      await learningEngine.processHistoricalActions(userId, limit)

      return NextResponse.json({
        success: true,
        message: `Processed up to ${limit} historical actions for user ${userId}`
      })
    }

    return NextResponse.json(
      { error: 'Invalid operation' },
      { status: 400 }
    )

  } catch (error) {
    logError('Failed to process learning operation', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}