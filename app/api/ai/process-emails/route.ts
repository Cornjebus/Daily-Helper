import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  scoreEmailPriority,
  summarizeEmailThread,
  checkBudgetAlerts
} from '@/lib/ai/openai'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check budget before processing
    const budgetCheck = await checkBudgetAlerts(user.id)
    if (budgetCheck.dailyUsage >= budgetCheck.dailyLimit) {
      return NextResponse.json({
        error: 'Daily AI budget exceeded',
        budget: budgetCheck
      }, { status: 429 })
    }

    // Get unprocessed emails from today
    const { data: emails, error: emailError } = await supabase
      .from('emails')
      .select(`
        *,
        email_ai_metadata(priority_score)
      `)
      .eq('user_id', user.id)
      .gte('received_at', new Date().toISOString().split('T')[0])
      .order('received_at', { ascending: false })

    if (emailError) {
      throw emailError
    }

    // Filter out already processed emails
    const unprocessedEmails = emails?.filter(
      email => !email.email_ai_metadata?.length
    ) || []

    const processedCount = {
      scored: 0,
      summarized: 0,
      errors: 0,
    }

    console.log(`Found ${unprocessedEmails.length} unprocessed emails`)

    // Process each email (increased from 10 to 50)
    for (const email of unprocessedEmails.slice(0, 50)) {
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
        console.log(`Updating feed_items for email ${email.id} with score ${score}`)
        const feedUpdateResult = await supabase
          .from('feed_items')
          .update({
            priority: Math.round(11 - score),
            metadata: {
              ...email.metadata,
              from: email.from_email,
              ai_score: score,
              ai_processed: true,
              ai_model: 'gpt-4o-mini',
              ai_reasoning: reasoning
            },
            updated_at: new Date().toISOString(),
          })
          .eq('external_id', email.id)
          .eq('source', 'gmail')

        console.log(`Feed items update result:`, feedUpdateResult)

        // If no feed_items were updated, create one
        if (feedUpdateResult.count === 0) {
          console.log(`No feed_items found for email ${email.id}, creating one`)
          const createResult = await supabase
            .from('feed_items')
            .insert({
              user_id: user.id,
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
                ai_model: 'gpt-4o-mini',
                ai_reasoning: reasoning
              },
              created_at: new Date().toISOString(),
            })
          console.log(`Feed item creation result:`, createResult)
        }

        processedCount.scored++

        // Check budget again after each operation
        const midCheck = await checkBudgetAlerts(user.id)
        if (midCheck.dailyUsage >= midCheck.dailyLimit) {
          break
        }
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

          // Check budget
          const midCheck = await checkBudgetAlerts(user.id)
          if (midCheck.dailyUsage >= midCheck.dailyLimit) {
            break
          }
        } catch (error) {
          console.error(`Error summarizing thread ${thread.id}:`, error)
          processedCount.errors++
        }
      }
    }

    // Final budget check
    const finalBudget = await checkBudgetAlerts(user.id)

    return NextResponse.json({
      success: true,
      processed: processedCount,
      budget: {
        dailyUsed: `$${(finalBudget.dailyUsage / 100).toFixed(2)}`,
        dailyLimit: `$${(finalBudget.dailyLimit / 100).toFixed(2)}`,
        monthlyUsed: `$${(finalBudget.monthlyUsage / 100).toFixed(2)}`,
        monthlyLimit: `$${(finalBudget.monthlyLimit / 100).toFixed(2)}`,
        alert: finalBudget.shouldAlert,
        alertMessage: finalBudget.alertMessage,
      },
    })
  } catch (error: any) {
    console.error('AI processing error:', error)
    return NextResponse.json({
      error: 'AI processing failed',
      details: error.message,
    }, { status: 500 })
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
    return NextResponse.json({
      error: 'Failed to get AI stats',
      details: error.message,
    }, { status: 500 })
  }
}