import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

// Initialize OpenAI client with lazy loading to avoid build-time errors
let openai: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('❌ Failed to initialize OpenAI client: OPENAI_API_KEY environment variable is not set')
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    openai = new OpenAI({ apiKey })
  }
  return openai
}

// Token pricing (in cents per 1K tokens) - Updated with approximate pricing
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

// Single active model, toggle via env
const ACTIVE_MODEL = ((process.env.OPENAI_ACTIVE_MODEL || process.env.OPENAI_PREFERRED_MODEL) as ModelName) || 'gpt-4o-mini'

function buildModelFallbackChain(_: ModelName): { name: ModelName; params: Record<string, any> }[] {
  return [{ name: ACTIVE_MODEL, params: { max_tokens: 100 } }]
}

// Improved token counting with model-specific adjustments
export function countTokens(text: string, model: ModelName = 'gpt-4o-mini'): number {
  if (!text) return 0

  // More accurate estimation based on OpenAI's guidelines
  const baseTokens = Math.ceil(text.length / 4)

  // Adjust for different models (GPT-4 models tend to use fewer tokens)
  const modelMultiplier = model.startsWith('gpt-4') ? 0.9 : 1.0

  // Account for special characters, punctuation, and formatting
  const specialCharBonus = (text.match(/[\n\r\t"'{}[\]]/g)?.length || 0) * 0.2

  return Math.ceil((baseTokens * modelMultiplier) + specialCharBonus)
}

// Enhanced cost calculation with validation
export function calculateCost(
  promptTokens: number,
  completionTokens: number,
  model: ModelName = 'gpt-4o-mini'
): number {
  if (promptTokens < 0 || completionTokens < 0) {
    console.warn('Invalid token counts:', { promptTokens, completionTokens })
    return 0
  }

  const pricing = PRICING[model]
  if (!pricing) {
    console.warn(`No pricing found for model: ${model}, using gpt-4o-mini`)
    const fallbackPricing = PRICING['gpt-4o-mini']
    const promptCost = (promptTokens / 1000) * fallbackPricing.prompt
    const completionCost = (completionTokens / 1000) * fallbackPricing.completion
    return Math.round((promptCost + completionCost) * 100)
  }

  const promptCost = (promptTokens / 1000) * pricing.prompt
  const completionCost = (completionTokens / 1000) * pricing.completion
  const totalCostCents = Math.round((promptCost + completionCost) * 100)

  // Log expensive operations
  if (totalCostCents > 10) { // More than 10 cents
    console.log(`💰 High cost operation: ${totalCostCents} cents for ${model} (${promptTokens + completionTokens} tokens)`)
  }

  return totalCostCents
}

// Enhanced usage tracking with error handling (DISABLED: no-op by request)
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
  // Skipping usage tracking entirely
  const totalTokens = promptTokens + completionTokens
  const costCents = calculateCost(promptTokens, completionTokens, model)
  return { totalTokens, costCents }
}

// Retry function for API calls with exponential backoff
async function retryApiCall<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      console.log(`API call attempt ${i + 1} failed:`, error.message)

      if (i === maxRetries - 1) throw error

      // Exponential backoff with jitter
      const delay = error.status === 429 ?
        delayMs * Math.pow(2, i) + Math.random() * 1000 :
        delayMs * (i + 1)

      console.log(`Retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('All retries exhausted')
}

// Enhanced email priority scoring with retry logic and model fallback
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

  // Use only one active model
  const models = buildModelFallbackChain(ACTIVE_MODEL)

  let lastError: any = null
  let modelUsed: ModelName = models[0]?.name || ACTIVE_MODEL

  for (const modelConfig of models) {
    try {
      console.log(`🤖 Making OpenAI API call for email ${emailId} with model ${modelConfig.name}`)

      const result = await retryApiCall(async () => {
        // GPT-5 family: use Responses API
        if (modelConfig.name.startsWith('gpt-5')) {
          const resp = await (openai as any).responses.create({
            model: modelConfig.name,
            input: `You are an AI assistant that helps prioritize emails. Be concise and accurate. Always respond with valid JSON.\n\n${prompt}`,
            response_format: { type: 'json_object' },
            ...(modelConfig.params || {})
          })

          const content = (resp as any).output_text || (resp as any).output?.[0]?.content?.[0]?.text?.value || ''
          const parsedResult = JSON.parse(content || '{}')

          if (typeof parsedResult.score !== 'number' || parsedResult.score < 1 || parsedResult.score > 10) {
            throw new Error(`Invalid score returned: ${parsedResult.score}`)
          }

          const usage = (resp as any).usage
            ? { prompt_tokens: (resp as any).usage.input_tokens || 0, completion_tokens: (resp as any).usage.output_tokens || 0 }
            : undefined

          return { parsedResult, usage }
        }

        // Other models: use Chat Completions
        const response = await getOpenAIClient().chat.completions.create({
          model: modelConfig.name,
          messages: [
            { role: 'system', content: 'You are an AI assistant that helps prioritize emails. Be concise and accurate. Always respond with valid JSON.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          ...modelConfig.params
        })

        const parsedResult = JSON.parse(response.choices[0].message.content || '{}')
        if (typeof parsedResult.score !== 'number' || parsedResult.score < 1 || parsedResult.score > 10) {
          throw new Error(`Invalid score returned: ${parsedResult.score}`)
        }

        return { parsedResult, usage: response.usage }
      })

      console.log(`✅ OpenAI response from ${modelConfig.name}:`, result.parsedResult)
      const promptTokens = result.usage?.prompt_tokens || countTokens(prompt, modelConfig.name)
      const completionTokens = result.usage?.completion_tokens || countTokens(JSON.stringify(result.parsedResult), modelConfig.name)
      modelUsed = modelConfig.name

      // Track usage
      await trackUsage(
        userId,
        'email_scoring',
        modelConfig.name,
        promptTokens,
        completionTokens,
        result.parsedResult,
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
          priority_score: result.parsedResult.score,
          processing_version: modelConfig.name,
          confidence_score: modelConfig.name === 'gpt-4o-mini' ? 0.9 : 0.85,
          updated_at: new Date().toISOString(),
        })

      return {
        score: Math.min(10, Math.max(1, Math.round(result.parsedResult.score))),
        reasoning: result.parsedResult.reasoning || 'AI prioritization completed',
      }
    } catch (error: any) {
      console.error(`❌ Error with model ${modelConfig.name} for email ${emailId}:`, error.message)
      lastError = error
      continue
    }
  }

  // All models failed, use intelligent fallback scoring
  console.error(`❌ All AI models failed for email ${emailId}, using intelligent fallback scoring`)
  console.error('Last error:', lastError?.message || 'Unknown error')

  let score = 5 // Default medium priority
  let reasoning = 'AI processing failed, using rule-based scoring'

  // Enhanced fallback logic based on email characteristics
  if (isImportant && isUnread) {
    score = 9
    reasoning = 'Important and unread email - high priority'
  } else if (isImportant || isStarred) {
    score = 7
    reasoning = 'Important or starred email - medium-high priority'
  } else if (isUnread) {
    score = 6
    reasoning = 'Unread email - medium priority'
  } else {
    score = 4
    reasoning = 'Read email without special flags - lower priority'
  }

  // Subject-based priority scoring
  const urgentKeywords = ['urgent', 'asap', 'immediately', 'deadline', 'overdue', 'critical', 'emergency']
  const importantKeywords = ['meeting', 'call', 'interview', 'contract', 'proposal', 'approval', 'review']
  const timeKeywords = ['today', 'tomorrow', 'eod', 'end of day']

  const subjectLower = subject.toLowerCase()
  const fromLower = from.toLowerCase()

  // Check for urgent keywords
  if (urgentKeywords.some(keyword => subjectLower.includes(keyword))) {
    score = Math.min(10, score + 2)
    reasoning += ' + urgent keywords detected'
  }

  // Check for important keywords
  if (importantKeywords.some(keyword => subjectLower.includes(keyword))) {
    score = Math.min(10, score + 1)
    reasoning += ' + important keywords detected'
  }

  // Check for time-sensitive keywords
  if (timeKeywords.some(keyword => subjectLower.includes(keyword))) {
    score = Math.min(10, score + 1)
    reasoning += ' + time-sensitive content'
  }

  // Check sender patterns (boss, manager, CEO, etc.)
  const seniorKeywords = ['ceo', 'cto', 'manager', 'director', 'lead', 'boss', 'president']
  if (seniorKeywords.some(keyword => fromLower.includes(keyword))) {
    score = Math.min(10, score + 1)
    reasoning += ' + senior sender detected'
  }

  return {
    score: Math.min(10, Math.max(1, Math.round(score))),
    reasoning: reasoning,
  }
}

// Enhanced email thread summarization with retry logic
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

    const preferred = buildModelFallbackChain(ACTIVE_MODEL)
    const result = await retryApiCall(async () => {
      const modelName = preferred[0]?.name || 'gpt-4o-mini'
      if (modelName.startsWith('gpt-5')) {
        const resp = await (openai as any).responses.create({
          model: modelName,
          input: `You are an AI assistant that creates concise email summaries. Focus on key information and action items. Always return valid JSON.\n\n${prompt}`,
          response_format: { type: 'json_object' },
          max_output_tokens: 300
        })
        const content = (resp as any).output_text || (resp as any).output?.[0]?.content?.[0]?.text?.value || ''
        const parsedResult = JSON.parse(content || '{}')
        if (!parsedResult.summary || !Array.isArray(parsedResult.keyPoints)) {
          throw new Error('Invalid summary response structure')
        }
        const usage = (resp as any).usage
          ? { prompt_tokens: (resp as any).usage.input_tokens || 0, completion_tokens: (resp as any).usage.output_tokens || 0 }
          : undefined
        return { parsedResult, usage }
      }

      const response = await getOpenAIClient().chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: 'You are an AI assistant that creates concise email summaries. Focus on key information and action items. Always return valid JSON.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        response_format: { type: 'json_object' },
      })

      const parsedResult = JSON.parse(response.choices[0].message.content || '{}')
      if (!parsedResult.summary || !Array.isArray(parsedResult.keyPoints)) {
        throw new Error('Invalid summary response structure')
      }
      return { parsedResult, usage: response.usage }
    })

    console.log('✅ Thread summary generated:', result.parsedResult)
    const activeModel = preferred[0]?.name || ACTIVE_MODEL
    const promptTokens = result.usage?.prompt_tokens || countTokens(prompt, activeModel as ModelName)
    const completionTokens = result.usage?.completion_tokens || countTokens(JSON.stringify(result.parsedResult), activeModel as ModelName)

    // Track usage
    await trackUsage(
      userId,
      'email_summary',
      activeModel as ModelName,
      promptTokens,
      completionTokens,
      result.parsedResult,
      threadId,
      'thread',
      Date.now() - startTime
    )

    return {
      summary: result.parsedResult.summary || 'Summary generation completed',
      keyPoints: result.parsedResult.keyPoints || [],
    }
  } catch (error: any) {
    console.error('❌ Error summarizing thread:', threadId, error.message)

    // Intelligent fallback summary
    const mainSubject = emails[0]?.subject || 'Unknown'
    const senders = [...new Set(emails.map(e => e.from).filter(Boolean))]

    return {
      summary: `Thread of ${emails.length} emails about "${mainSubject}" involving ${senders.length} participants. Most recent messages discuss ongoing conversation.`,
      keyPoints: [
        `${emails.length} total messages in thread`,
        `${senders.length} participants involved`,
        `Latest activity: ${emails[0]?.date || 'Recent'}`,
        `Primary topic: ${mainSubject}`
      ],
    }
  }
}

// Enhanced smart reply generation with retry logic
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

    const result = await retryApiCall(async () => {
      const replyModel = buildModelFallbackChain(ACTIVE_MODEL)[0]?.name || ACTIVE_MODEL
      if (replyModel.startsWith('gpt-5')) {
        const resp = await (openai as any).responses.create({
          model: replyModel,
          input: `You are an AI assistant that generates professional, concise email reply suggestions. Always return valid JSON with exactly 3 reply options.\n\n${prompt}`,
          response_format: { type: 'json_object' },
          max_output_tokens: 200
        })
        const content = (resp as any).output_text || (resp as any).output?.[0]?.content?.[0]?.text?.value || ''
        const parsedResult = JSON.parse(content || '{}')
        if (!Array.isArray(parsedResult.replies) || parsedResult.replies.length === 0) {
          throw new Error('Invalid reply suggestions structure')
        }
        const usage = (resp as any).usage
          ? { prompt_tokens: (resp as any).usage.input_tokens || 0, completion_tokens: (resp as any).usage.output_tokens || 0 }
          : undefined
        return { parsedResult, usage }
      }

      const response = await getOpenAIClient().chat.completions.create({
        model: replyModel,
        messages: [
          { role: 'system', content: 'You are an AI assistant that generates professional, concise email reply suggestions. Always return valid JSON with exactly 3 reply options.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        response_format: { type: 'json_object' },
      })

      const parsedResult = JSON.parse(response.choices[0].message.content || '{}')
      if (!Array.isArray(parsedResult.replies) || parsedResult.replies.length === 0) {
        throw new Error('Invalid reply suggestions structure')
      }
      return { parsedResult, usage: response.usage }
    })

    console.log('✅ Smart replies generated:', result.parsedResult.replies.length, 'options')
    const activeReplyModel = buildModelFallbackChain(ACTIVE_MODEL)[0]?.name || ACTIVE_MODEL
    const promptTokens = result.usage?.prompt_tokens || countTokens(prompt, activeReplyModel as ModelName)
    const completionTokens = result.usage?.completion_tokens || countTokens(JSON.stringify(result.parsedResult), activeReplyModel as ModelName)

    // Track usage
    await trackUsage(
      userId,
      'smart_reply',
      activeReplyModel as ModelName,
      promptTokens,
      completionTokens,
      result.parsedResult,
      emailId,
      'email',
      Date.now() - startTime
    )

    // Save to email_ai_metadata
    const supabase = await createClient()
    await supabase
      .from('email_ai_metadata')
      .update({
        reply_suggestions: result.parsedResult.replies,
        updated_at: new Date().toISOString(),
      })
      .eq('email_id', emailId)

    return result.parsedResult.replies || []
  } catch (error: any) {
    console.error('❌ Error generating replies for email:', emailId, error.message)

    // Context-aware fallback replies
    const subjectLower = subject.toLowerCase()
    const isQuestion = subject.includes('?') || content.includes('?')
    const isMeeting = subjectLower.includes('meeting') || subjectLower.includes('call')
    const isUrgent = subjectLower.includes('urgent') || subjectLower.includes('asap')

    let fallbackReplies = [
      'Thank you for your message. I will review and respond shortly.',
      'I appreciate you reaching out. Let me look into this and get back to you.',
      'Got it, thanks for letting me know.',
    ]

    if (isUrgent) {
      fallbackReplies = [
        'I understand this is urgent. I will prioritize this and respond as soon as possible.',
        'Thank you for flagging this as urgent. I will address this immediately.',
        'Acknowledged. I will handle this with high priority and update you shortly.',
      ]
    } else if (isMeeting) {
      fallbackReplies = [
        'Thank you for the meeting invitation. I will check my calendar and confirm shortly.',
        'I received your meeting request. Let me verify my availability and get back to you.',
        'Thanks for reaching out about the meeting. I will review the details and respond soon.',
      ]
    } else if (isQuestion) {
      fallbackReplies = [
        'Thank you for your question. I will look into this and provide an answer shortly.',
        'I received your inquiry. Let me research this and get back to you with details.',
        'Good question! I will investigate and provide you with a comprehensive response.',
      ]
    }

    return fallbackReplies
  }
}

// Enhanced budget alerts with better error handling
export async function checkBudgetAlerts(userId: string): Promise<{
  dailyUsage: number
  monthlyUsage: number
  dailyLimit: number
  monthlyLimit: number
  shouldAlert: boolean
  alertMessage?: string
}> {
  try {
    const supabase = await createClient()

    // Get or create budget
    const { data: budget, error: budgetError } = await supabase
      .from('ai_budgets')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (budgetError || !budget) {
      console.log('Creating default budget for user:', userId)
      // Create default budget
      const { error: insertError } = await supabase.from('ai_budgets').insert({
        user_id: userId,
        daily_limit_cents: 100,  // $1.00 daily limit
        monthly_limit_cents: 2000, // $20.00 monthly limit
        alert_at_percent: 80, // Alert at 80% usage
        daily_usage_cents: 0,
        monthly_usage_cents: 0,
      })

      if (insertError) {
        console.error('❌ Error creating budget:', insertError)
      }

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
  } catch (error) {
    console.error('❌ Error checking budget alerts:', error)
    // Return safe defaults
    return {
      dailyUsage: 0,
      monthlyUsage: 0,
      dailyLimit: 100,
      monthlyLimit: 2000,
      shouldAlert: false,
      alertMessage: 'Unable to check budget status',
    }
  }
}

// Health check function for OpenAI integration
export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  message: string
  details: {
    apiKey: boolean
    modelAccess: boolean
    responseTime: number | null
  }
}> {
  const startTime = Date.now()

  try {
    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      return {
        status: 'unhealthy',
        message: 'OpenAI API key not configured',
        details: { apiKey: false, modelAccess: false, responseTime: null }
      }
    }

    // Test API call
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Test' }],
      max_tokens: 5
    })

    const responseTime = Date.now() - startTime

    return {
      status: responseTime > 5000 ? 'degraded' : 'healthy',
      message: `OpenAI integration operational (${responseTime}ms)`,
      details: {
        apiKey: true,
        modelAccess: true,
        responseTime
      }
    }
  } catch (error: any) {
    return {
      status: 'unhealthy',
      message: `OpenAI integration failed: ${error.message}`,
      details: {
        apiKey: !!process.env.OPENAI_API_KEY,
        modelAccess: false,
        responseTime: Date.now() - startTime
      }
    }
  }
}
