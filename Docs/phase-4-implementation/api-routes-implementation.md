# 🔌 Phase 4: API Routes Implementation
## Next.js API Routes for Email Intelligence Platform

### **Implementation Overview**

This section implements all API routes using Next.js App Router with TypeScript, providing robust error handling, validation, and performance optimization.

---

## **API Route Structure**

```
app/api/v1/
├── emails/
│   ├── process/route.ts          # POST - Process single email
│   ├── batch/route.ts            # POST - Batch email processing
│   └── [emailId]/
│       ├── score/route.ts        # GET - Get email score
│       └── feedback/route.ts     # PUT - Submit score feedback
├── vip-senders/
│   ├── route.ts                  # GET/POST - List/Create VIP senders
│   └── [senderId]/route.ts       # GET/PUT/DELETE - Manage VIP sender
├── digests/
│   ├── current/route.ts          # GET - Current week's digest
│   ├── generate/route.ts         # POST - Generate digest
│   └── [digestId]/
│       └── actions/route.ts      # POST - Execute digest actions
├── patterns/
│   └── user/route.ts             # GET - User's learned patterns
├── analytics/
│   ├── dashboard/route.ts        # GET - Dashboard analytics
│   └── cost-tracking/route.ts    # GET - Cost analytics
├── preferences/route.ts          # GET/PUT - User preferences
├── realtime/
│   └── subscribe/route.ts        # GET - SSE subscription
└── webhooks/
    └── gmail/route.ts            # POST - Gmail webhook
```

---

## **Core API Implementation**

### **1. Email Processing API**

```typescript
// app/api/v1/emails/process/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { EmailScoringService } from '@/lib/services/email-scoring.service'
import { AIProcessingPipelineService } from '@/lib/services/ai-processing.service'
import { validateEmailData } from '@/lib/validation'
import { rateLimit } from '@/lib/middleware/rate-limit'
import { authMiddleware } from '@/lib/middleware/auth'

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting (100 requests/minute per user)
    const rateLimitResult = await rateLimit(request, { limit: 100, window: 60000 })
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many requests' }
        },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Authenticate user
    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        },
        { status: 401 }
      )
    }

    const { user } = authResult
    const requestStartTime = performance.now()

    // Parse and validate request body
    const body = await request.json()
    const emailValidation = validateEmailData(body)
    if (!emailValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email data',
            details: emailValidation.errors
          }
        },
        { status: 422 }
      )
    }

    const emailData = emailValidation.data

    // Initialize services
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const scoringService = new EmailScoringService(supabase)
    const aiService = new AIProcessingPipelineService(supabase)

    // Process email through the pipeline
    const scoringStartTime = performance.now()
    const score = await scoringService.calculateScore(emailData, user.id)
    const scoringTime = performance.now() - scoringStartTime

    // Store email score
    const { error: scoreError } = await supabase
      .from('email_scores')
      .insert({
        user_id: user.id,
        email_id: emailData.gmail_id,
        gmail_id: emailData.gmail_id,
        raw_score: score.raw_score,
        final_score: score.final_score,
        processing_tier: score.processing_tier,
        score_factors: score.score_factors,
        ai_processed: false
      })

    if (scoreError) {
      console.error('Failed to store email score:', scoreError)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'STORAGE_ERROR', message: 'Failed to store email score' }
        },
        { status: 500 }
      )
    }

    // Process through AI pipeline based on tier
    let aiResult = null
    if (score.processing_tier !== 'low') {
      try {
        const aiStartTime = performance.now()
        aiResult = await aiService.processByTier(emailData, score.processing_tier, user.id)
        const aiTime = performance.now() - aiStartTime

        // Update email score with AI results
        await supabase
          .from('email_scores')
          .update({
            ai_processed: aiResult.ai_processed,
            ai_analysis: aiResult.ai_processed ? {
              category: aiResult.category,
              priority: aiResult.priority,
              summary: aiResult.summary,
              action_items: aiResult.action_items,
              confidence: aiResult.confidence
            } : null,
            ai_cost: aiResult.ai_cost || 0
          })
          .eq('user_id', user.id)
          .eq('email_id', emailData.gmail_id)

      } catch (aiError) {
        console.error('AI processing failed:', aiError)
        // Continue without AI results - don't fail the entire request
      }
    }

    // Update feed_items if exists
    const { error: feedError } = await supabase
      .from('feed_items')
      .update({
        raw_score: score.raw_score,
        final_score: score.final_score,
        processing_tier: score.processing_tier,
        ai_processed: aiResult?.ai_processed || false
      })
      .eq('user_id', user.id)
      .eq('external_id', emailData.gmail_id)

    if (feedError && feedError.code !== 'PGRST116') { // Ignore "not found" errors
      console.error('Failed to update feed_items:', feedError)
    }

    const totalProcessingTime = performance.now() - requestStartTime

    // Return successful response
    return NextResponse.json({
      success: true,
      data: {
        email_id: emailData.gmail_id,
        score: {
          raw_score: score.raw_score,
          final_score: score.final_score,
          processing_tier: score.processing_tier,
          score_factors: score.score_factors,
          confidence: score.confidence
        },
        ai_result: aiResult ? {
          category: aiResult.category,
          priority: aiResult.priority,
          summary: aiResult.summary,
          action_items: aiResult.action_items,
          sentiment: aiResult.sentiment,
          confidence: aiResult.confidence,
          ai_cost: aiResult.ai_cost,
          processing_time: aiResult.processing_time,
          ai_processed: aiResult.ai_processed
        } : null,
        processing_time: totalProcessingTime,
        performance_metrics: {
          scoring_time: scoringTime,
          total_time: totalProcessingTime
        }
      }
    })

  } catch (error) {
    console.error('Email processing error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    )
  }
}
```

### **2. Batch Processing API**

```typescript
// app/api/v1/emails/batch/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { EmailScoringService } from '@/lib/services/email-scoring.service'
import { AIProcessingPipelineService } from '@/lib/services/ai-processing.service'
import { validateBatchEmailData } from '@/lib/validation'
import { rateLimit } from '@/lib/middleware/rate-limit'
import { authMiddleware } from '@/lib/middleware/auth'

export async function POST(request: NextRequest) {
  try {
    // Apply stricter rate limiting for batch processing (10 requests/minute, max 50 emails)
    const rateLimitResult = await rateLimit(request, { limit: 10, window: 60000 })
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many batch requests' }
        },
        { status: 429 }
      )
    }

    // Authenticate user
    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' }},
        { status: 401 }
      )
    }

    const { user } = authResult
    const requestStartTime = performance.now()

    // Parse and validate batch request
    const body = await request.json()
    const validation = validateBatchEmailData(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid batch data', details: validation.errors }
        },
        { status: 422 }
      )
    }

    const { emails, options = {} } = validation.data

    // Enforce batch size limit
    if (emails.length > 50) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BATCH_TOO_LARGE', message: 'Maximum 50 emails per batch' }
        },
        { status: 422 }
      )
    }

    // Initialize services
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const scoringService = new EmailScoringService(supabase)
    const aiService = new AIProcessingPipelineService(supabase)

    // Process emails in parallel batches for performance
    const batchSize = 10
    const results = []
    const errors = []
    let totalAiCost = 0

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize)

      // Process scoring for batch
      const batchScores = await scoringService.calculateBatchScores(batch, user.id)

      // Store all scores in batch
      const scoreInserts = batchScores.map((score, index) => ({
        user_id: user.id,
        email_id: batch[index].gmail_id,
        gmail_id: batch[index].gmail_id,
        raw_score: score.raw_score,
        final_score: score.final_score,
        processing_tier: score.processing_tier,
        score_factors: score.score_factors,
        ai_processed: false
      }))

      const { error: batchInsertError } = await supabase
        .from('email_scores')
        .insert(scoreInserts)

      if (batchInsertError) {
        console.error('Batch insert error:', batchInsertError)
        // Log error but continue with other batches
        errors.push({
          batch_start: i,
          batch_size: batch.length,
          error: 'Failed to store batch scores'
        })
        continue
      }

      // Process AI analysis for non-low tier emails
      for (let j = 0; j < batch.length; j++) {
        const email = batch[j]
        const score = batchScores[j]
        let aiResult = null

        try {
          if (score.processing_tier !== 'low') {
            aiResult = await aiService.processByTier(email, score.processing_tier, user.id)
            totalAiCost += aiResult.ai_cost || 0

            // Update with AI results
            await supabase
              .from('email_scores')
              .update({
                ai_processed: aiResult.ai_processed,
                ai_analysis: aiResult.ai_processed ? {
                  category: aiResult.category,
                  priority: aiResult.priority,
                  summary: aiResult.summary,
                  action_items: aiResult.action_items,
                  confidence: aiResult.confidence
                } : null,
                ai_cost: aiResult.ai_cost || 0
              })
              .eq('user_id', user.id)
              .eq('email_id', email.gmail_id)
          }

          results.push({
            email_id: email.gmail_id,
            score: {
              raw_score: score.raw_score,
              final_score: score.final_score,
              processing_tier: score.processing_tier,
              score_factors: score.score_factors,
              confidence: score.confidence
            },
            ai_result: aiResult
          })

        } catch (emailError) {
          console.error(`Error processing email ${email.gmail_id}:`, emailError)
          errors.push({
            email_index: i + j,
            email_id: email.gmail_id,
            error: 'Processing failed'
          })
        }
      }
    }

    const totalProcessingTime = performance.now() - requestStartTime

    // Calculate tier distribution
    const tierCounts = results.reduce((acc, result) => {
      const tier = result.score.processing_tier
      acc[tier] = (acc[tier] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      success: true,
      data: {
        processed_count: results.length,
        results,
        batch_id: `batch_${Date.now()}_${user.id}`,
        total_processing_time: totalProcessingTime,
        cost_breakdown: {
          high_tier_count: tierCounts.high || 0,
          medium_tier_count: tierCounts.medium || 0,
          low_tier_count: tierCounts.low || 0,
          total_ai_cost: totalAiCost
        }
      },
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Batch processing error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Batch processing failed' }
      },
      { status: 500 }
    )
  }
}
```

### **3. VIP Senders Management API**

```typescript
// app/api/v1/vip-senders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateVIPSenderData } from '@/lib/validation'
import { rateLimit } from '@/lib/middleware/rate-limit'
import { authMiddleware } from '@/lib/middleware/auth'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, { limit: 50, window: 60000 })
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' }},
        { status: 429 }
      )
    }

    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' }},
        { status: 401 }
      )
    }

    const { user } = authResult

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const { data: vipSenders, error } = await supabase
      .from('vip_senders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch VIP senders:', error)
      return NextResponse.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch VIP senders' }},
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        vip_senders: vipSenders.map(sender => ({
          id: sender.id,
          sender_email: sender.sender_email,
          sender_name: sender.sender_name,
          sender_domain: sender.sender_domain,
          score_boost: sender.score_boost,
          auto_category: sender.auto_category,
          usage_count: sender.usage_count,
          confidence_score: sender.confidence_score,
          created_at: sender.created_at,
          last_used: sender.updated_at
        })),
        total_count: vipSenders.length
      }
    })

  } catch (error) {
    console.error('VIP senders GET error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }},
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, { limit: 100, window: 60000 })
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' }},
        { status: 429 }
      )
    }

    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' }},
        { status: 401 }
      )
    }

    const { user } = authResult

    const body = await request.json()
    const validation = validateVIPSenderData(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid VIP sender data', details: validation.errors }
        },
        { status: 422 }
      )
    }

    const vipData = validation.data

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Check if VIP sender already exists
    const { data: existing } = await supabase
      .from('vip_senders')
      .select('id')
      .eq('user_id', user.id)
      .eq('sender_email', vipData.sender_email)
      .single()

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'VIP sender already exists' }},
        { status: 409 }
      )
    }

    // Extract domain from email
    const domain = vipData.sender_email.split('@')[1]

    const { data: newVipSender, error } = await supabase
      .from('vip_senders')
      .insert({
        user_id: user.id,
        sender_email: vipData.sender_email,
        sender_name: vipData.sender_name,
        sender_domain: domain,
        score_boost: vipData.score_boost,
        auto_category: vipData.auto_category,
        learned_from_user_action: false,
        confidence_score: 1.0,
        usage_count: 0
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create VIP sender:', error)
      return NextResponse.json(
        { success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create VIP sender' }},
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: newVipSender.id,
        sender_email: newVipSender.sender_email,
        sender_name: newVipSender.sender_name,
        score_boost: newVipSender.score_boost,
        auto_category: newVipSender.auto_category,
        created_at: newVipSender.created_at
      }
    }, { status: 201 })

  } catch (error) {
    console.error('VIP senders POST error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }},
      { status: 500 }
    )
  }
}
```

### **4. Weekly Digest API**

```typescript
// app/api/v1/digests/current/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { WeeklyDigestService } from '@/lib/services/weekly-digest.service'
import { rateLimit } from '@/lib/middleware/rate-limit'
import { authMiddleware } from '@/lib/middleware/auth'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, { limit: 20, window: 60000 })
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' }},
        { status: 429 }
      )
    }

    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' }},
        { status: 401 }
      )
    }

    const { user } = authResult

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Get current week's digest
    const currentWeekStart = getStartOfWeek(new Date())
    const currentWeekEnd = getEndOfWeek(new Date())

    const { data: digest, error } = await supabase
      .from('weekly_digests')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start_date', currentWeekStart.toISOString().split('T')[0])
      .single()

    if (error && error.code !== 'PGRST116') { // Not found is ok
      console.error('Failed to fetch digest:', error)
      return NextResponse.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch digest' }},
        { status: 500 }
      )
    }

    // If no digest exists, generate one
    if (!digest) {
      const digestService = new WeeklyDigestService(supabase)
      const generatedDigest = await digestService.generateWeeklyDigest(user.id)

      return NextResponse.json({
        success: true,
        data: {
          digest: generatedDigest,
          generated_now: true
        }
      })
    }

    // Return existing digest with user actions
    return NextResponse.json({
      success: true,
      data: {
        digest: {
          id: digest.id,
          week_start_date: digest.week_start_date,
          week_end_date: digest.week_end_date,
          generated_at: digest.generated_at,

          summary: {
            total_emails: digest.total_low_priority_emails,
            safe_unsubscribe_count: digest.unsubscribe_suggestions?.safeToUnsubscribe?.length || 0,
            bulk_action_opportunities: digest.unsubscribe_suggestions?.bulkActions?.length || 0,
            estimated_monthly_reduction: calculateMonthlyReduction(digest.unsubscribe_suggestions),
            key_insights: generateKeyInsights(digest)
          },

          categories: groupEmailsByCategory(digest.low_priority_emails),

          unsubscribe_opportunities: {
            safe_to_unsubscribe: digest.unsubscribe_suggestions?.safeToUnsubscribe || [],
            needs_review: digest.unsubscribe_suggestions?.needsReview || [],
            bulk_actions: digest.unsubscribe_suggestions?.bulkActions || []
          },

          metrics: {
            potential_cost_savings: digest.cost_savings || 0,
            time_savings: calculateTimeSavings(digest.total_low_priority_emails),
            inbox_cleanliness_improvement: calculateCleanlinessScore(digest.unsubscribe_suggestions)
          }
        },
        user_actions: digest.user_actions || null,
        generated_now: false
      }
    })

  } catch (error) {
    console.error('Current digest GET error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }},
      { status: 500 }
    )
  }
}

function getStartOfWeek(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  const diff = result.getDate() - day + (day === 0 ? -6 : 1) // Monday start
  result.setDate(diff)
  result.setHours(0, 0, 0, 0)
  return result
}

function getEndOfWeek(date: Date): Date {
  const result = getStartOfWeek(date)
  result.setDate(result.getDate() + 6)
  result.setHours(23, 59, 59, 999)
  return result
}
```

### **5. Real-time Subscribe API (Server-Sent Events)**

```typescript
// app/api/v1/realtime/subscribe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { RealtimeService } from '@/lib/services/realtime.service'
import { authMiddleware } from '@/lib/middleware/auth'

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' }},
        { status: 401 }
      )
    }

    const { user } = authResult

    // Check if user already has an active connection
    const realtimeService = new RealtimeService()
    const hasActiveConnection = realtimeService.hasActiveConnection(user.id)

    if (hasActiveConnection) {
      return NextResponse.json(
        { success: false, error: { code: 'CONNECTION_EXISTS', message: 'Active connection already exists' }},
        { status: 409 }
      )
    }

    // Create Server-Sent Events stream
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection event
        const initialEvent = {
          type: 'connected',
          data: {
            user_id: user.id,
            timestamp: Date.now(),
            server_time: new Date().toISOString()
          }
        }

        controller.enqueue(`data: ${JSON.stringify(initialEvent)}\n\n`)

        // Set up connection management
        const connection = {
          userId: user.id,
          controller,
          lastHeartbeat: Date.now(),
          isActive: true
        }

        realtimeService.addConnection(user.id, connection)

        // Send heartbeat every 30 seconds
        const heartbeatInterval = setInterval(() => {
          if (!connection.isActive) {
            clearInterval(heartbeatInterval)
            return
          }

          try {
            const heartbeatEvent = {
              type: 'heartbeat',
              data: {
                timestamp: Date.now(),
                server_time: new Date().toISOString()
              }
            }

            controller.enqueue(`data: ${JSON.stringify(heartbeatEvent)}\n\n`)
            connection.lastHeartbeat = Date.now()
          } catch (error) {
            console.error('Heartbeat error:', error)
            clearInterval(heartbeatInterval)
            realtimeService.removeConnection(user.id)
          }
        }, 30000)

        // Handle connection close
        request.signal.addEventListener('abort', () => {
          connection.isActive = false
          clearInterval(heartbeatInterval)
          realtimeService.removeConnection(user.id)
          try {
            controller.close()
          } catch (error) {
            // Connection already closed
          }
        })
      }
    })

    // Return SSE response with proper headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type'
      }
    })

  } catch (error) {
    console.error('Real-time subscribe error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to establish connection' }},
      { status: 500 }
    )
  }
}
```

### **6. Analytics Dashboard API**

```typescript
// app/api/v1/analytics/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { AnalyticsService } from '@/lib/services/analytics.service'
import { rateLimit } from '@/lib/middleware/rate-limit'
import { authMiddleware } from '@/lib/middleware/auth'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, { limit: 50, window: 60000 })
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' }},
        { status: 429 }
      )
    }

    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' }},
        { status: 401 }
      )
    }

    const { user } = authResult

    // Parse query parameters
    const url = new URL(request.url)
    const period = url.searchParams.get('period') || '30d'

    if (!['7d', '30d', '90d'].includes(period)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PERIOD', message: 'Period must be 7d, 30d, or 90d' }},
        { status: 422 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const analyticsService = new AnalyticsService(supabase)
    const startTime = performance.now()

    // Get analytics data for the specified period
    const [
      emailStats,
      costAnalytics,
      learningProgress,
      productivityMetrics
    ] = await Promise.all([
      analyticsService.getEmailStats(user.id, period),
      analyticsService.getCostAnalytics(user.id, period),
      analyticsService.getLearningProgress(user.id, period),
      analyticsService.getProductivityMetrics(user.id, period)
    ])

    const queryTime = performance.now() - startTime

    return NextResponse.json({
      success: true,
      data: {
        period,
        email_stats: {
          total_processed: emailStats.totalProcessed,
          tier_distribution: emailStats.tierDistribution,
          avg_processing_time: emailStats.avgProcessingTime,
          accuracy_score: emailStats.accuracyScore,
          change_from_previous: emailStats.changeFromPrevious
        },
        cost_analytics: {
          total_ai_cost: costAnalytics.totalAiCost,
          cost_per_email: costAnalytics.costPerEmail,
          budget_utilization: costAnalytics.budgetUtilization,
          projected_monthly_cost: costAnalytics.projectedMonthlyCost,
          cost_savings_vs_traditional: costAnalytics.costSavingsVsTraditional,
          daily_costs: costAnalytics.dailyCosts
        },
        learning_progress: {
          patterns_learned: learningProgress.patternsLearned,
          accuracy_improvement: learningProgress.accuracyImprovement,
          learning_velocity: learningProgress.learningVelocity,
          top_performing_patterns: learningProgress.topPerformingPatterns
        },
        productivity_metrics: {
          emails_auto_categorized: productivityMetrics.emailsAutoCategorized,
          time_saved_minutes: productivityMetrics.timeSavedMinutes,
          inbox_cleanliness_score: productivityMetrics.inboxCleanlinessScore,
          unsubscribe_actions_taken: productivityMetrics.unsubscribeActionsTaken
        },
        query_performance: {
          query_time_ms: queryTime,
          cached_results: analyticsService.getCacheHitRate()
        }
      }
    })

  } catch (error) {
    console.error('Dashboard analytics error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch analytics' }},
      { status: 500 }
    )
  }
}
```

---

## **Middleware Implementation**

### **Authentication Middleware**
```typescript
// lib/middleware/auth.ts
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface AuthResult {
  success: boolean
  user?: any
  error?: string
}

export async function authMiddleware(request: NextRequest): Promise<AuthResult> {
  try {
    const authHeader = request.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { success: false, error: 'Missing or invalid authorization header' }
    }

    const token = authHeader.slice(7) // Remove 'Bearer '

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return { success: false, error: 'Invalid or expired token' }
    }

    return { success: true, user }

  } catch (error) {
    console.error('Auth middleware error:', error)
    return { success: false, error: 'Authentication failed' }
  }
}
```

### **Rate Limiting Middleware**
```typescript
// lib/middleware/rate-limit.ts
import { NextRequest } from 'next/server'

interface RateLimitConfig {
  limit: number
  window: number // milliseconds
}

interface RateLimitResult {
  success: boolean
  headers: HeadersInit
  remaining?: number
  resetTime?: number
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  try {
    // Use IP + User-Agent as identifier
    const identifier = getIdentifier(request)
    const now = Date.now()
    const windowStart = now - config.window

    // Clean up old entries
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key)
      }
    }

    // Get current rate limit data
    let rateLimitData = rateLimitStore.get(identifier)

    if (!rateLimitData || rateLimitData.resetTime < now) {
      rateLimitData = {
        count: 1,
        resetTime: now + config.window
      }
    } else {
      rateLimitData.count += 1
    }

    rateLimitStore.set(identifier, rateLimitData)

    const remaining = Math.max(0, config.limit - rateLimitData.count)
    const headers: HeadersInit = {
      'X-RateLimit-Limit': config.limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(rateLimitData.resetTime / 1000).toString()
    }

    if (rateLimitData.count > config.limit) {
      headers['X-RateLimit-Retry-After'] = Math.ceil((rateLimitData.resetTime - now) / 1000).toString()
      return { success: false, headers }
    }

    return { success: true, headers, remaining, resetTime: rateLimitData.resetTime }

  } catch (error) {
    console.error('Rate limit error:', error)
    return { success: true, headers: {} } // Fail open
  }
}

function getIdentifier(request: NextRequest): string {
  const ip = request.ip ||
             request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  return `${ip}:${userAgent.slice(0, 100)}` // Limit UA length
}
```

---

## **Validation Schemas**

### **Email Data Validation**
```typescript
// lib/validation/email.ts
import { z } from 'zod'

export const emailDataSchema = z.object({
  gmail_id: z.string().min(1),
  sender: z.string().email(),
  subject: z.string().max(500),
  body: z.string().optional(),
  snippet: z.string().max(1000),
  received_at: z.string().datetime(),
  labels: z.array(z.string()).optional().default([]),
  is_important: z.boolean().optional().default(false),
  is_starred: z.boolean().optional().default(false),
  is_unread: z.boolean().optional().default(true),
  has_attachments: z.boolean().optional().default(false)
})

export const batchEmailDataSchema = z.object({
  emails: z.array(emailDataSchema).min(1).max(50),
  options: z.object({
    priority: z.enum(['high', 'normal', 'low']).optional(),
    max_processing_time: z.number().optional(),
    skip_ai_if_over_budget: z.boolean().optional()
  }).optional()
})

export const vipSenderDataSchema = z.object({
  sender_email: z.string().email(),
  sender_name: z.string().optional(),
  score_boost: z.number().min(1).max(50),
  auto_category: z.enum(['now', 'next', 'later']).optional(),
  notes: z.string().optional()
})

export function validateEmailData(data: unknown) {
  return emailDataSchema.safeParse(data)
}

export function validateBatchEmailData(data: unknown) {
  return batchEmailDataSchema.safeParse(data)
}

export function validateVIPSenderData(data: unknown) {
  return vipSenderDataSchema.safeParse(data)
}
```

The comprehensive API implementation provides robust, performant, and secure endpoints for all email intelligence functionality, with proper validation, error handling, and monitoring capabilities.