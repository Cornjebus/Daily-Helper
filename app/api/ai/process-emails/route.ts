import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  scoreEmailPriority,
  summarizeEmailThread,
  checkBudgetAlerts
} from '@/lib/ai/openai'

export async function POST() {
  console.log('🚀 AI Processing API called at:', new Date().toISOString())
  try {
    console.log('📡 Creating Supabase client...')
    const supabase = await createClient()

    console.log('🔐 Getting user authentication...')
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('❌ Authentication error:', authError)
      return NextResponse.json({ error: 'Authentication failed', details: authError.message }, { status: 401 })
    }

    if (!user) {
      console.error('❌ No authenticated user found')
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log('✅ User authenticated:', user.id)

    // Budget checks disabled per request

    // Get recent emails (remove date restriction); we'll process last 10 unprocessed
    console.log('📧 Fetching recent emails...')

    const { data: emails, error: emailError } = await supabase
      .from('emails')
      .select(`
        *,
        email_ai_metadata(priority_score)
      `)
      .eq('user_id', user.id)
      .order('received_at', { ascending: false })
      .limit(50)

    if (emailError) {
      console.error('❌ Error fetching emails:', emailError)
      throw emailError
    }

    console.log(`📧 Found ${emails?.length || 0} emails from today`)

    // Filter out already processed emails
    const unprocessedEmails = emails?.filter(
      email => !email.email_ai_metadata?.length
    ) || []

    const processedCount = {
      scored: 0,
      summarized: 0,
      errors: 0,
    }

    console.log(`Found ${unprocessedEmails.length} unprocessed emails (will process up to 10)`) 

    // Process last 10 unprocessed emails
    for (const email of unprocessedEmails.slice(0, 10)) {
      try {
        // Score email priority
        const { score, reasoning } = await scoreEmailPriority(
          user.id,
          email.id,
          email.subject || '',
          email.from_email || '',
          email.snippet || '',
          email.is_important || false,
          email.is_starred || false,
          email.is_unread || false
        )

        // Update the email with AI score
        await supabase
          .from('emails')
          .update({
            priority: Math.round(11 - score), // Convert to 1-10 where 1 is highest
            updated_at: new Date().toISOString(),
          })
          .eq('id', email.id)

        // Update feed_items with AI processing status
        console.log(`🔄 Updating feed_items for email ${email.id} with score ${score}`)
        const feedUpdateResult = await supabase
          .from('feed_items')
          .update({
            priority: Math.round(11 - score),
            metadata: {
              ...(email.metadata || {}),
              from: email.from_email,
              ai_score: score,
              ai_processed: true,
              ai_model: process.env.OPENAI_ACTIVE_MODEL || process.env.OPENAI_PREFERRED_MODEL || 'gpt-4o-mini',
              ai_reasoning: reasoning
            },
            updated_at: new Date().toISOString(),
          })
          .eq('external_id', email.id)
          .eq('source', 'gmail')
          .select('id')

        const updatedCount = Array.isArray(feedUpdateResult.data) ? feedUpdateResult.data.length : 0
        console.log(`🔄 Feed items update result:`, { status: feedUpdateResult.status, error: feedUpdateResult.error })
        console.log(`🔄 Updated ${updatedCount} feed items`)

        // If no feed_items were updated, create one
        if (updatedCount === 0) {
          console.log(`📝 No feed_items found for email ${email.id}, creating one`)
          try {
            const createResult = await supabase
              .from('feed_items')
              .insert({
                user_id: user.id, // This is already a valid UUID from auth
                source: 'gmail',
                external_id: email.id,
                title: email.subject || 'No Subject',
                content: email.snippet || '',
                category: email.is_important || email.is_starred ? 'now' :
                          email.is_unread ? 'next' :
                          'later',
                priority: Math.round(11 - score),
                metadata: {
                  from: email.from_email,
                  ai_score: score,
                  ai_processed: true,
                  ai_model: process.env.OPENAI_ACTIVE_MODEL || process.env.OPENAI_PREFERRED_MODEL || 'gpt-4o-mini',
                  ai_reasoning: reasoning
                },
                created_at: new Date().toISOString(),
              })
            console.log(`📝 Feed item creation result:`, createResult)
          } catch (insertError) {
            console.error(`❌ Error creating feed_item for email ${email.id}:`, insertError)
            // Don't fail the entire process for this error
          }
        }

        processedCount.scored++

        // Budget checks disabled
      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error)
        processedCount.errors++
      }
    }

    // Process email threads (summarize long threads)
    const { data: threads } = await supabase
      .from('email_threads')
      .select(`
        *,
        emails(
          subject,
          from_email,
          snippet,
          received_at
        )
      `)
      .eq('user_id', user.id)
      .gte('last_message_at', new Date().toISOString().split('T')[0])
      .gt('message_count', 3) // Only summarize threads with more than 3 messages

    for (const thread of threads || []) {
      if (thread.emails && thread.emails.length > 3) {
        try {
          const { summary, keyPoints } = await summarizeEmailThread(
            user.id,
            thread.id,
            thread.emails.map((e: any) => ({
              subject: e.subject,
              from: e.from_email,
              snippet: e.snippet,
              date: new Date(e.received_at).toLocaleDateString(),
            }))
          )

          // Store summary in thread
          await supabase
            .from('email_threads')
            .update({
              summary,
              updated_at: new Date().toISOString(),
            })
            .eq('id', thread.id)

          processedCount.summarized++

          // Budget checks disabled
        } catch (error) {
          console.error(`Error summarizing thread ${thread.id}:`, error)
          processedCount.errors++
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      budget: {
        dailyUsed: '$0.00',
        dailyLimit: '$0.00',
        monthlyUsed: '$0.00',
        monthlyLimit: '$0.00',
        alert: false,
        alertMessage: undefined,
      },
    })
  } catch (error: any) {
    console.error('❌ AI processing error:', error)
    console.error('❌ Error stack:', error.stack)

    // Determine the type of error and provide appropriate response
    let errorMessage = 'AI processing failed'
    let statusCode = 500

    if (error.message?.includes('Authentication')) {
      errorMessage = 'Authentication error'
      statusCode = 401
    } else if (error.message?.includes('network') || error.message?.includes('ECONNREFUSED')) {
      errorMessage = 'Database connection failed'
      statusCode = 503
    } else if (error.message?.includes('OpenAI') || error.message?.includes('API')) {
      errorMessage = 'AI service temporarily unavailable'
      statusCode = 503
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: error.message,
      timestamp: new Date().toISOString(),
      // Include additional debugging info in development
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
        fullError: error.toString()
      })
    }, { status: statusCode })
  }
}

// Get AI usage stats
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get budget info
    const budget = await checkBudgetAlerts(user.id)

    // Get today's usage details
    const today = new Date().toISOString().split('T')[0]
    const { data: todayUsage } = await supabase
      .from('ai_usage')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', today)
      .order('created_at', { ascending: false })

    // Get this month's usage
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const { data: monthUsage } = await supabase
      .from('ai_usage')
      .select('operation, cost_cents, total_tokens')
      .eq('user_id', user.id)
      .gte('created_at', monthStart.toISOString())

    // Aggregate stats
    const stats = {
      today: {
        operations: todayUsage?.length || 0,
        cost: `$${(budget.dailyUsage / 100).toFixed(2)}`,
        limit: `$${(budget.dailyLimit / 100).toFixed(2)}`,
        percentUsed: Math.round((budget.dailyUsage / budget.dailyLimit) * 100),
      },
      month: {
        operations: monthUsage?.length || 0,
        cost: `$${(budget.monthlyUsage / 100).toFixed(2)}`,
        limit: `$${(budget.monthlyLimit / 100).toFixed(2)}`,
        percentUsed: Math.round((budget.monthlyUsage / budget.monthlyLimit) * 100),
        tokens: monthUsage?.reduce((sum, u) => sum + u.total_tokens, 0) || 0,
      },
      byOperation: monthUsage?.reduce((acc: any, usage) => {
        acc[usage.operation] = (acc[usage.operation] || 0) + 1
        return acc
      }, {}),
      alert: budget.shouldAlert,
      alertMessage: budget.alertMessage,
    }

    return NextResponse.json(stats)
  } catch (error: any) {
    console.error('❌ GET AI stats error:', error)
    return NextResponse.json({
      error: 'Failed to get AI stats',
      details: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
