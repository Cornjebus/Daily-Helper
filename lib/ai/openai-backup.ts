import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Token pricing (in cents per 1K tokens)
const PRICING = {
  'gpt-5-nano': { prompt: 0.005, completion: 0.04 }, // $0.05/1M = $0.005/1K
  'gpt-5-mini': { prompt: 0.025, completion: 0.2 },   // $0.25/1M = $0.025/1K
  'gpt-5': { prompt: 0.125, completion: 1.0 },        // $1.25/1M = $0.125/1K
  'gpt-4o-mini': { prompt: 0.015, completion: 0.06 },
  'gpt-4': { prompt: 3, completion: 6 },
  'gpt-4-turbo': { prompt: 1, completion: 3 },
  'gpt-3.5-turbo': { prompt: 0.05, completion: 0.15 },
} as const

type ModelName = keyof typeof PRICING

// Count tokens for a given text (rough estimation)
export function countTokens(text: string, model: ModelName = 'gpt-5-nano'): number {
  // Rough estimation: 1 token ≈ 4 characters for English text
  // This is a simplified approach to avoid tiktoken WASM issues in Next.js
  return Math.ceil(text.length / 4)
}

// Calculate cost in cents
export function calculateCost(
  promptTokens: number,
  completionTokens: number,
  model: ModelName = 'gpt-5-nano'
): number {
  const pricing = PRICING[model]
  const promptCost = (promptTokens / 1000) * pricing.prompt
  const completionCost = (completionTokens / 1000) * pricing.completion
  return Math.round((promptCost + completionCost) * 100) // Convert to cents
}

// Track AI usage in database
async function trackUsage(
  userId: string,
  operation: string,
  model: ModelName,
  promptTokens: number,
  completionTokens: number,
  response: any,
  contextId?: string,
  contextType?: string,
  durationMs?: number
) {
  const supabase = await createClient()
  const totalTokens = promptTokens + completionTokens
  const costCents = calculateCost(promptTokens, completionTokens, model)

  await supabase.from('ai_usage').insert({
    user_id: userId,
    model,
    operation,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    cost_cents: costCents,
    response,
    context_id: contextId,
    context_type: contextType,
    duration_ms: durationMs,
  })

  return { totalTokens, costCents }
}

// Score email priority (1-10)
export async function scoreEmailPriority(
  userId: string,
  emailId: string,
  subject: string,
  from: string,
  snippet: string,
  isImportant: boolean,
  isStarred: boolean,
  isUnread: boolean
): Promise<{ score: number; reasoning: string }> {
  const startTime = Date.now()

  const prompt = `Score this email's priority from 1 to 10 (1=lowest, 10=highest).
Consider urgency, importance, and required action.

From: ${from}
Subject: ${subject}
Preview: ${snippet}
Flags: ${[isImportant && 'Important', isStarred && 'Starred', isUnread && 'Unread'].filter(Boolean).join(', ') || 'None'}

Return a JSON object with:
- score: number between 1-10
- reasoning: brief explanation (max 50 words)`

  try {
    console.log('🤖 Making OpenAI API call for email:', emailId)
    console.log('📝 Using model: gpt-4o-mini (reliable model)')
    // Use gpt-4o-mini instead of gpt-5-nano for reliability
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant that helps prioritize emails. Be concise and accurate. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 100, // Use max_tokens instead of max_completion_tokens
      response_format: { type: 'json_object' },
      // Remove gpt-5 specific parameters that don't work with gpt-4o-mini
    })

    console.log('OpenAI response:', response.choices[0].message.content)
    const result = JSON.parse(response.choices[0].message.content || '{}')
    console.log('Parsed result:', result)
    const promptTokens = response.usage?.prompt_tokens || 0
    const completionTokens = response.usage?.completion_tokens || 0

    // Track usage
    await trackUsage(
      userId,
      'email_scoring',
      'gpt-4o-mini', // Update model name for tracking
      promptTokens,
      completionTokens,
      result,
      emailId,
      'email',
      Date.now() - startTime
    )

    // Save to email_ai_metadata
    const supabase = await createClient()
    await supabase
      .from('email_ai_metadata')
      .upsert({
        email_id: emailId,
        user_id: userId,
        priority_score: result.score,
        processing_version: 'gpt-4o-mini', // Update model name
        confidence_score: 0.8,
        updated_at: new Date().toISOString(),
      })

    return {
      score: Math.min(10, Math.max(1, result.score)),
      reasoning: result.reasoning || '',
    }
  } catch (error) {
    console.error('Error scoring email:', emailId, error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    // Fallback scoring based on flags
    let score = 5
    if (isImportant) score += 3
    if (isStarred) score += 2
    if (isUnread) score += 1
    return {
      score: Math.min(10, score),
      reasoning: 'Scored based on email flags (AI unavailable)',
    }
  }
}

// Summarize long email thread
export async function summarizeEmailThread(
  userId: string,
  threadId: string,
  emails: Array<{
    subject: string
    from: string
    snippet: string
    date: string
  }>
): Promise<{ summary: string; keyPoints: string[] }> {
  const startTime = Date.now()

  const emailTexts = emails
    .map((email, i) => `Email ${i + 1} (${email.date}):
From: ${email.from}
Subject: ${email.subject}
Content: ${email.snippet}`)
    .join('\n\n')

  const prompt = `Summarize this email thread concisely.

${emailTexts}

Return a JSON object with:
- summary: brief overview (max 100 words)
- keyPoints: array of 3-5 key points (each max 20 words)`

  try {
    console.log('🧵 Summarizing email thread:', threadId)
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant that creates concise email summaries. Focus on key information and action items.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 300, // Use max_tokens instead of max_completion_tokens
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    const promptTokens = response.usage?.prompt_tokens || 0
    const completionTokens = response.usage?.completion_tokens || 0

    // Track usage
    await trackUsage(
      userId,
      'email_summary',
      'gpt-4o-mini', // Update model name
      promptTokens,
      completionTokens,
      result,
      threadId,
      'thread',
      Date.now() - startTime
    )

    return {
      summary: result.summary || 'Unable to generate summary',
      keyPoints: result.keyPoints || [],
    }
  } catch (error) {
    console.error('Error summarizing thread:', error)
    return {
      summary: `Thread with ${emails.length} emails about "${emails[0]?.subject || 'Unknown'}"`,
      keyPoints: [`Contains ${emails.length} messages`],
    }
  }
}

// Generate smart reply suggestions
export async function generateSmartReplies(
  userId: string,
  emailId: string,
  subject: string,
  from: string,
  content: string
): Promise<string[]> {
  const startTime = Date.now()

  const prompt = `Generate 3 brief, professional reply options for this email.

From: ${from}
Subject: ${subject}
Content: ${content}

Return a JSON object with:
- replies: array of 3 reply suggestions (each max 50 words)`

  try {
    console.log('💬 Generating smart replies for email:', emailId)
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant that generates professional, concise email reply suggestions.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 200, // Use max_tokens instead of max_completion_tokens
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    const promptTokens = response.usage?.prompt_tokens || 0
    const completionTokens = response.usage?.completion_tokens || 0

    // Track usage
    await trackUsage(
      userId,
      'smart_reply',
      'gpt-4o-mini', // Update model name
      promptTokens,
      completionTokens,
      result,
      emailId,
      'email',
      Date.now() - startTime
    )

    // Save to email_ai_metadata
    const supabase = await createClient()
    await supabase
      .from('email_ai_metadata')
      .update({
        reply_suggestions: result.replies,
        updated_at: new Date().toISOString(),
      })
      .eq('email_id', emailId)

    return result.replies || []
  } catch (error) {
    console.error('Error generating replies:', error)
    return [
      'Thank you for your message. I will review and respond shortly.',
      'I appreciate you reaching out. Let me look into this and get back to you.',
      'Got it, thanks for letting me know.',
    ]
  }
}

// Check and alert on budget usage
export async function checkBudgetAlerts(userId: string): Promise<{
  dailyUsage: number
  monthlyUsage: number
  dailyLimit: number
  monthlyLimit: number
  shouldAlert: boolean
  alertMessage?: string
}> {
  const supabase = await createClient()

  // Get or create budget
  const { data: budget } = await supabase
    .from('ai_budgets')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!budget) {
    // Create default budget
    await supabase.from('ai_budgets').insert({
      user_id: userId,
    })
    return {
      dailyUsage: 0,
      monthlyUsage: 0,
      dailyLimit: 100,
      monthlyLimit: 2000,
      shouldAlert: false,
    }
  }

  const dailyPercent = (budget.daily_usage_cents / budget.daily_limit_cents) * 100
  const monthlyPercent = (budget.monthly_usage_cents / budget.monthly_limit_cents) * 100

  let shouldAlert = false
  let alertMessage = ''

  if (dailyPercent >= budget.alert_at_percent) {
    shouldAlert = true
    alertMessage = `Daily AI budget ${dailyPercent.toFixed(0)}% used ($${(budget.daily_usage_cents / 100).toFixed(2)} of $${(budget.daily_limit_cents / 100).toFixed(2)})`
  } else if (monthlyPercent >= budget.alert_at_percent) {
    shouldAlert = true
    alertMessage = `Monthly AI budget ${monthlyPercent.toFixed(0)}% used ($${(budget.monthly_usage_cents / 100).toFixed(2)} of $${(budget.monthly_limit_cents / 100).toFixed(2)})`
  }

  return {
    dailyUsage: budget.daily_usage_cents,
    monthlyUsage: budget.monthly_usage_cents,
    dailyLimit: budget.daily_limit_cents,
    monthlyLimit: budget.monthly_limit_cents,
    shouldAlert,
    alertMessage,
  }
}