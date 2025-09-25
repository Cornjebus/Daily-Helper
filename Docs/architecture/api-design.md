# 🔌 API Design
## RESTful Email Intelligence API Specification

### **API Architecture Overview**

The Email Intelligence API follows REST principles with real-time extensions, providing comprehensive endpoints for email processing, scoring, and bulk management.

```
Base URL: https://daily-helper.vercel.app/api/v1
Authentication: Bearer JWT tokens (Supabase Auth)
Content-Type: application/json
Rate Limiting: Varies by endpoint (see individual specs)
```

---

## **Core Email Processing APIs**

### **POST /api/v1/emails/process**
Process a single email through the intelligence pipeline.

```typescript
interface ProcessEmailRequest {
  gmail_id: string
  sender: string
  subject: string
  snippet: string
  received_at: string // ISO timestamp
  labels: string[]
  is_important?: boolean
  is_starred?: boolean
  is_unread?: boolean
  has_attachments?: boolean
}

interface ProcessEmailResponse {
  success: boolean
  data: {
    email_id: string
    score: {
      raw_score: number         // 0-100
      final_score: number       // 0-100
      processing_tier: 'high' | 'medium' | 'low'
      score_factors: {
        baseScore: number
        vipBoost: number
        urgencyBoost: number
        marketingPenalty: number
        gmailSignals: number
        timeDecay: number
        contentAnalysis: number
        senderReputation: number
        userPatterns: number
      }
    }
    ai_result?: {
      category: 'now' | 'next' | 'later' | 'archive'
      priority: number          // 1-10
      summary?: string
      action_items?: string[]
      confidence: number        // 0.0-1.0
      ai_cost: number
      processing_time: number
    }
    processing_time: number
  }
  error?: string
}

// Rate Limit: 100 requests/minute per user
// SLA: < 3 seconds for high tier, < 1 second for medium/low tier
```

**Example Usage:**
```bash
curl -X POST https://daily-helper.vercel.app/api/v1/emails/process \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "gmail_id": "thread_123",
    "sender": "boss@company.com",
    "subject": "URGENT: Client meeting moved to 2pm",
    "snippet": "Hi team, due to a scheduling conflict...",
    "received_at": "2024-01-15T14:30:00Z",
    "labels": ["IMPORTANT", "INBOX"],
    "is_important": true,
    "is_unread": true
  }'
```

### **POST /api/v1/emails/batch**
Process multiple emails efficiently in batch.

```typescript
interface BatchProcessRequest {
  emails: ProcessEmailRequest[]
  options?: {
    priority: 'high' | 'normal' | 'low'
    max_processing_time?: number  // seconds
    skip_ai_if_over_budget?: boolean
  }
}

interface BatchProcessResponse {
  success: boolean
  data: {
    processed_count: number
    results: ProcessEmailResponse['data'][]
    batch_id: string
    total_processing_time: number
    cost_breakdown: {
      high_tier_count: number
      medium_tier_count: number
      low_tier_count: number
      total_ai_cost: number
    }
  }
  errors?: Array<{
    email_index: number
    error: string
  }>
}

// Rate Limit: 10 requests/minute, max 50 emails per batch
// SLA: < 30 seconds for 50 emails
```

---

## **Scoring & Pattern APIs**

### **GET /api/v1/emails/{emailId}/score**
Retrieve detailed scoring information for a specific email.

```typescript
interface EmailScoreResponse {
  success: boolean
  data: {
    email_id: string
    raw_score: number
    final_score: number
    processing_tier: string
    score_factors: ScoreFactors
    created_at: string
    updated_at: string
    confidence: number
  }
}

// Rate Limit: 200 requests/minute
// SLA: < 100ms
```

### **PUT /api/v1/emails/{emailId}/score/feedback**
Provide user feedback to improve scoring accuracy.

```typescript
interface ScoreFeedbackRequest {
  user_action: 'marked_important' | 'marked_low' | 'categorized' | 'ignored'
  expected_category?: 'now' | 'next' | 'later' | 'archive'
  expected_priority?: number  // 1-10
  feedback_reason?: string
}

interface ScoreFeedbackResponse {
  success: boolean
  data: {
    pattern_updates: number
    scoring_adjustment: number
    confidence_improvement: number
    learning_applied: boolean
  }
}

// Rate Limit: 500 requests/minute
// SLA: < 200ms
```

### **GET /api/v1/patterns/user**
Get user's learned email patterns.

```typescript
interface UserPatternsResponse {
  success: boolean
  data: {
    patterns: Array<{
      id: string
      pattern_type: 'sender' | 'subject' | 'content' | 'domain'
      pattern_value: string
      score_impact: number      // -50 to +50
      confidence_score: number  // 0.0-1.0
      sample_count: number
      success_rate: number
      last_seen_at: string
      learned_from_user_action: boolean
    }>
    total_count: number
    effectiveness_score: number  // 0.0-1.0
  }
}

// Rate Limit: 50 requests/minute
// SLA: < 200ms
```

---

## **VIP Sender Management APIs**

### **GET /api/v1/vip-senders**
List user's VIP senders.

```typescript
interface VIPSendersResponse {
  success: boolean
  data: {
    vip_senders: Array<{
      id: string
      sender_email: string
      sender_name?: string
      sender_domain: string
      score_boost: number       // 0-50
      auto_category?: 'now' | 'next' | 'later'
      usage_count: number
      confidence_score: number
      created_at: string
      last_used: string
    }>
    total_count: number
  }
}
```

### **POST /api/v1/vip-senders**
Add a new VIP sender.

```typescript
interface AddVIPSenderRequest {
  sender_email: string
  sender_name?: string
  score_boost: number         // 1-50
  auto_category?: 'now' | 'next' | 'later'
  notes?: string
}

interface VIPSenderResponse {
  success: boolean
  data: {
    id: string
    sender_email: string
    score_boost: number
    created_at: string
  }
}

// Rate Limit: 100 requests/minute
// SLA: < 200ms
```

### **PUT /api/v1/vip-senders/{senderId}**
Update VIP sender configuration.

```typescript
interface UpdateVIPSenderRequest {
  score_boost?: number        // 1-50
  auto_category?: 'now' | 'next' | 'later'
  sender_name?: string
  notes?: string
}

// Rate Limit: 100 requests/minute
// SLA: < 200ms
```

### **DELETE /api/v1/vip-senders/{senderId}**
Remove VIP sender.

```typescript
interface DeleteVIPSenderResponse {
  success: boolean
  data: {
    deleted: boolean
    pattern_updates: number  // Related patterns affected
  }
}

// Rate Limit: 50 requests/minute
// SLA: < 200ms
```

---

## **Weekly Digest APIs**

### **GET /api/v1/digests/current**
Get the current week's digest.

```typescript
interface CurrentDigestResponse {
  success: boolean
  data: {
    digest: {
      id: string
      week_start_date: string
      week_end_date: string
      generated_at: string

      summary: {
        total_emails: number
        safe_unsubscribe_count: number
        bulk_action_opportunities: number
        estimated_monthly_reduction: number
        key_insights: string[]
      }

      categories: Record<string, Array<{
        sender: string
        email_count: number
        avg_score: number
        sample_subjects: string[]
      }>>

      unsubscribe_opportunities: {
        safe_to_unsubscribe: Array<{
          sender: string
          domain: string
          confidence: number
          email_count: number
          reasons: string[]
          unsubscribe_links: string[]
          estimated_monthly_savings: number
        }>

        needs_review: Array<{
          sender: string
          confidence: number
          email_count: number
          reasons: string[]
        }>

        bulk_actions: Array<{
          action_type: 'bulk_unsubscribe_domain' | 'bulk_unsubscribe_category'
          domain?: string
          category?: string
          senders: string[]
          total_senders: number
          total_emails_weekly: number
          recommended: boolean
        }>
      }

      metrics: {
        potential_cost_savings: number
        time_savings: number
        inbox_cleanliness_improvement: number
      }
    }
    user_actions?: {
      unsubscribed: string[]
      marked_keep: string[]
      bulk_actions_executed: Array<{
        action_id: string
        completed_at: string
        success_count: number
        failure_count: number
      }>
      completed_at?: string
    }
  }
}

// Rate Limit: 20 requests/minute
// SLA: < 1 second
```

### **POST /api/v1/digests/generate**
Generate weekly digest manually.

```typescript
interface GenerateDigestRequest {
  week_start_date?: string    // ISO date, defaults to current week
  force_regenerate?: boolean  // Regenerate if already exists
}

interface GenerateDigestResponse {
  success: boolean
  data: {
    digest_id: string
    generation_time: number
    emails_analyzed: number
    categories_found: number
    unsubscribe_opportunities: number
  }
}

// Rate Limit: 1 request/hour per user
// SLA: < 30 seconds
```

### **POST /api/v1/digests/{digestId}/actions**
Execute bulk actions from digest.

```typescript
interface DigestActionsRequest {
  actions: {
    unsubscribe?: string[]              // Sender emails to unsubscribe
    keep?: string[]                     // Senders to mark as keep
    bulk_actions?: Array<{
      action_id: string
      action_type: 'bulk_unsubscribe_domain' | 'bulk_unsubscribe_category'
      target_value: string              // Domain or category
      confirm: boolean
    }>
  }
}

interface DigestActionsResponse {
  success: boolean
  data: {
    successful_unsubscribes: string[]
    failed_unsubscribes: Array<{
      sender: string
      error: string
      manual_action_required: boolean
      manual_instructions?: string
    }>
    bulk_actions_completed: Array<{
      action_id: string
      success_count: number
      failure_count: number
      completed_senders: string[]
      failed_senders: string[]
    }>
    patterns_learned: number
    estimated_future_reduction: number
  }
}

// Rate Limit: 10 requests/hour per user
// SLA: < 60 seconds for bulk actions
```

---

## **Analytics & Insights APIs**

### **GET /api/v1/analytics/dashboard**
Get dashboard analytics data.

```typescript
interface DashboardAnalyticsResponse {
  success: boolean
  data: {
    period: '7d' | '30d' | '90d'

    email_stats: {
      total_processed: number
      tier_distribution: {
        high: number
        medium: number
        low: number
      }
      avg_processing_time: number
      accuracy_score: number
    }

    cost_analytics: {
      total_ai_cost: number
      cost_per_email: number
      budget_utilization: number  // 0.0-1.0
      projected_monthly_cost: number
      cost_savings_vs_traditional: number
    }

    learning_progress: {
      patterns_learned: number
      accuracy_improvement: number    // % improvement
      learning_velocity: number       // patterns/week
      top_performing_patterns: Array<{
        pattern_type: string
        pattern_value: string
        impact: number
        confidence: number
      }>
    }

    productivity_metrics: {
      emails_auto_categorized: number
      time_saved_minutes: number
      inbox_cleanliness_score: number  // 0.0-1.0
      unsubscribe_actions_taken: number
    }
  }
}

// Rate Limit: 50 requests/minute
// SLA: < 500ms
```

### **GET /api/v1/analytics/cost-tracking**
Detailed AI cost tracking and projections.

```typescript
interface CostTrackingResponse {
  success: boolean
  data: {
    current_period: {
      daily_costs: Array<{
        date: string
        cost: number
        email_count: number
        tier_breakdown: {
          high: { count: number, cost: number }
          medium: { count: number, cost: number }
          low: { count: number, cost: number }
        }
      }>
      total_cost: number
      budget_limit: number
      budget_remaining: number
    }

    projections: {
      estimated_monthly_cost: number
      cost_trend: 'increasing' | 'stable' | 'decreasing'
      optimization_suggestions: Array<{
        type: 'adjust_thresholds' | 'update_patterns' | 'review_vips'
        potential_savings: number
        description: string
      }>
    }
  }
}

// Rate Limit: 20 requests/minute
// SLA: < 300ms
```

---

## **Real-time & Webhook APIs**

### **GET /api/v1/realtime/subscribe**
Subscribe to real-time email processing updates.

```typescript
// Server-Sent Events endpoint
interface RealtimeSubscription {
  events: Array<
    | { type: 'email-processed', data: { emailId: string, score: number, tier: string } }
    | { type: 'digest-ready', data: { digestId: string, unsubscribe_count: number } }
    | { type: 'pattern-learned', data: { pattern_type: string, confidence: number } }
    | { type: 'budget-warning', data: { current_cost: number, limit: number } }
    | { type: 'bulk-action-complete', data: { action_id: string, success_count: number } }
  >
}

// Connection maintained via Server-Sent Events
// Rate Limit: 1 connection per user
// SLA: < 500ms latency for events
```

**Example Client Code:**
```javascript
const eventSource = new EventSource('/api/v1/realtime/subscribe', {
  headers: { 'Authorization': `Bearer ${token}` }
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'email-processed':
      updateEmailInUI(data.emailId, data.score, data.tier);
      break;
    case 'digest-ready':
      showDigestNotification(data.digestId, data.unsubscribe_count);
      break;
  }
};
```

### **POST /api/v1/webhooks/gmail**
Webhook endpoint for Gmail push notifications.

```typescript
interface GmailWebhookRequest {
  message: {
    data: string          // Base64 encoded Gmail push message
    messageId: string
    publishTime: string
  }
  subscription: string
}

interface WebhookResponse {
  success: boolean
  data: {
    processed: boolean
    email_count: number
    processing_queued: boolean
  }
}

// Rate Limit: 1000 requests/minute (Gmail push notifications)
// SLA: < 200ms acknowledgment
```

---

## **User Preferences APIs**

### **GET /api/v1/preferences**
Get user's email intelligence preferences.

```typescript
interface UserPreferencesResponse {
  success: boolean
  data: {
    scoring_weights: {
      vip_sender_weight: number         // 0.0-2.0
      urgent_keywords_weight: number    // 0.0-2.0
      marketing_penalty_weight: number  // 0.0-2.0
      time_decay_weight: number         // 0.0-2.0
      gmail_signals_weight: number      // 0.0-2.0
    }

    processing_preferences: {
      high_priority_threshold: number   // 50-100
      medium_priority_threshold: number // 10-80
      max_ai_cost_per_day: number      // dollars
      preferred_ai_model: string
    }

    feature_toggles: {
      enable_pattern_learning: boolean
      enable_weekly_digest: boolean
      enable_bulk_unsubscribe: boolean
      enable_real_time_notifications: boolean
    }

    notification_settings: {
      digest_ready: boolean
      budget_warnings: boolean
      pattern_learning_updates: boolean
      bulk_action_confirmations: boolean
    }
  }
}
```

### **PUT /api/v1/preferences**
Update user preferences.

```typescript
interface UpdatePreferencesRequest {
  scoring_weights?: Partial<ScoringWeights>
  processing_preferences?: Partial<ProcessingPreferences>
  feature_toggles?: Partial<FeatureToggles>
  notification_settings?: Partial<NotificationSettings>
}

// Rate Limit: 10 requests/minute
// SLA: < 200ms
```

---

## **Error Handling & Status Codes**

### **Standard Error Response Format**

```typescript
interface APIErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, any>
    timestamp: string
    request_id: string
  }
  status: number
}
```

### **Common Error Codes**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | Malformed request body or parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource already exists |
| 422 | `VALIDATION_ERROR` | Request validation failed |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `SERVICE_UNAVAILABLE` | External service unavailable |

### **Rate Limiting Headers**

All API responses include rate limiting headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1642684800
X-RateLimit-Retry-After: 3600  (only when rate limited)
```

---

## **API Testing & Documentation**

### **OpenAPI Specification**
The complete API is documented using OpenAPI 3.0 specification available at:
```
GET /api/v1/openapi.json
```

### **Interactive Documentation**
Swagger UI available at:
```
GET /api/v1/docs
```

### **Health Check Endpoint**
```typescript
GET /api/v1/health

interface HealthCheckResponse {
  success: boolean
  data: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    timestamp: string
    version: string
    services: {
      database: 'up' | 'down'
      cache: 'up' | 'down'
      ai_service: 'up' | 'down'
      gmail_api: 'up' | 'down'
    }
    metrics: {
      response_time_ms: number
      active_connections: number
      memory_usage_mb: number
    }
  }
}

// Rate Limit: 60 requests/minute
// SLA: < 100ms
```

The API design provides comprehensive functionality for the email intelligence platform while maintaining performance, security, and usability standards.