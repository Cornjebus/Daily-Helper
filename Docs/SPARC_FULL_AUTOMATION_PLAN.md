# SPARC Full Email Automation Plan

## 🎯 Project: Complete Email Intelligence Automation System

**Goal:** Transform manual email processing into fully automated, real-time intelligent email management system.

---

## Phase 1: SPECIFICATION (Requirements Analysis)

### Functional Requirements

#### 1. Real-Time Email Ingestion
- **FR-1.1:** System SHALL receive Gmail push notifications within 1 second of email arrival
- **FR-1.2:** System SHALL support OAuth2 Gmail Watch API for push notifications
- **FR-1.3:** System SHALL handle webhook retry logic with exponential backoff
- **FR-1.4:** System SHALL validate webhook signatures for security

#### 2. Automated Processing Pipeline
- **FR-2.1:** System SHALL automatically score emails within 5 seconds of receipt
- **FR-2.2:** System SHALL apply rule-based pre-filtering before AI scoring
- **FR-2.3:** System SHALL batch process emails for cost optimization
- **FR-2.4:** System SHALL handle processing failures gracefully with queues

#### 3. Intelligent Scoring System
- **FR-3.1:** System SHALL score emails 0-100 with three tiers (High/Medium/Low)
- **FR-3.2:** System SHALL learn from user interactions (stars, archives, replies)
- **FR-3.3:** System SHALL maintain VIP sender lists with boost scores
- **FR-3.4:** System SHALL detect and penalize marketing/spam patterns

#### 4. Real-Time UI Updates
- **FR-4.1:** UI SHALL update within 500ms of email processing completion
- **FR-4.2:** UI SHALL show processing status indicators
- **FR-4.3:** UI SHALL support live filtering and sorting
- **FR-4.4:** UI SHALL maintain state during updates (no flicker)

#### 5. Automated Actions
- **FR-5.1:** System SHALL auto-archive emails scored below threshold
- **FR-5.2:** System SHALL auto-flag high priority emails
- **FR-5.3:** System SHALL generate daily/weekly digests
- **FR-5.4:** System SHALL support user-defined automation rules

### Non-Functional Requirements

- **Performance:** Process 100 emails/minute per user
- **Scalability:** Support 10,000+ concurrent users
- **Cost:** < $0.01 per 100 emails processed
- **Reliability:** 99.9% uptime for critical path
- **Security:** OAuth2, webhook validation, RLS

### Success Metrics
- Email processing latency < 5 seconds
- AI scoring accuracy > 85%
- User engagement increase > 40%
- Manual email management time reduction > 70%

---

## Phase 2: PSEUDOCODE (Algorithm Design)

### Core Processing Algorithm

```
MAIN EMAIL PROCESSING PIPELINE:

ON email_received(webhook_data):
    // Step 1: Validate and Parse
    IF NOT validate_webhook_signature(webhook_data):
        RETURN error(401, "Invalid signature")

    email = parse_gmail_notification(webhook_data)

    // Step 2: Store Raw Email
    email_id = database.insert_email(email)

    // Step 3: Queue for Processing
    queue.publish("email.process", {
        email_id: email_id,
        user_id: email.user_id,
        priority: calculate_queue_priority(email)
    })

    RETURN success(200)

BACKGROUND WORKER - EMAIL PROCESSOR:

ON queue_message("email.process", data):
    email = database.get_email(data.email_id)

    // Step 1: Rule-based Pre-scoring
    rule_score = apply_rules(email):
        score = 30  // base score

        // Check patterns
        IF matches_marketing_patterns(email):
            score -= 30
        IF matches_urgent_keywords(email):
            score += 25
        IF is_from_vip_sender(email):
            score += get_vip_boost(email.from)
        IF has_gmail_importance_flag(email):
            score += 20

        RETURN clamp(score, 0, 100)

    // Step 2: AI Enhancement (if needed)
    IF should_use_ai(rule_score, email):
        ai_score = openai.score_email(email)
        final_score = weighted_average(rule_score * 0.4, ai_score * 0.6)
    ELSE:
        final_score = rule_score

    // Step 3: Determine Tier
    tier = categorize_tier(final_score):
        IF score >= 80: RETURN "high"
        IF score >= 40: RETURN "medium"
        RETURN "low"

    // Step 4: Store Results
    database.update_email_score(email_id, {
        raw_score: rule_score,
        final_score: final_score,
        tier: tier,
        ai_processed: used_ai
    })

    // Step 5: Trigger Actions
    IF tier == "high":
        notifications.send_high_priority_alert(email)
    IF tier == "low" AND user.auto_archive_enabled:
        gmail.archive_email(email_id)

    // Step 6: Update UI in Real-time
    websocket.broadcast(email.user_id, {
        type: "email.scored",
        email_id: email_id,
        score: final_score,
        tier: tier
    })

    // Step 7: Learn from Result
    patterns.record_scoring_result(email, final_score)

LEARNING ENGINE:

ON user_action(action_type, email_id):
    email = database.get_email_with_score(email_id)

    SWITCH action_type:
        CASE "starred":
            increase_sender_vip_score(email.from, +10)
            record_positive_pattern(email.subject_keywords)

        CASE "archived":
            IF email.score > 50:  // User disagreed with high score
                decrease_pattern_confidence(email.patterns)

        CASE "replied":
            increase_sender_vip_score(email.from, +15)
            mark_thread_important(email.thread_id)

        CASE "marked_spam":
            add_spam_pattern(email.content_patterns)
            decrease_sender_score(email.from, -20)

    update_user_preferences(action_type, email.characteristics)
```

---

## Phase 3: ARCHITECTURE (System Design)

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                         │
├─────────────────────────────────────────────────────────┤
│  Next.js App                                             │
│  ├── Dashboard (WebSocket)                               │
│  ├── Email List Component                                │
│  ├── Smart Triage View                                   │
│  └── Settings & Rules                                    │
└─────────────────────────────────────────────────────────┘
                            │
                     WebSocket/HTTP
                            │
┌─────────────────────────────────────────────────────────┐
│                      API LAYER                           │
├─────────────────────────────────────────────────────────┤
│  API Routes                                              │
│  ├── /api/gmail/webhook     [Gmail Push Notifications]   │
│  ├── /api/emails/score      [Manual Scoring]             │
│  ├── /api/realtime/connect  [WebSocket]                  │
│  └── /api/rules/manage      [Automation Rules]           │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                   PROCESSING LAYER                       │
├─────────────────────────────────────────────────────────┤
│  Background Workers                                      │
│  ├── Email Processor        [Scoring & Categorization]   │
│  ├── Pattern Learner        [ML Training]                │
│  ├── Action Executor        [Automation]                 │
│  └── Digest Generator       [Daily/Weekly Reports]       │
│                                                          │
│  Message Queue (Redis/BullMQ)                           │
│  ├── email.process          [Priority Queue]             │
│  ├── email.learn            [Learning Queue]             │
│  └── email.action           [Action Queue]               │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                     DATA LAYER                           │
├─────────────────────────────────────────────────────────┤
│  Supabase (PostgreSQL)                                   │
│  ├── emails                 [Raw email data]             │
│  ├── email_scores           [Scoring results]            │
│  ├── vip_senders            [VIP boost lists]            │
│  ├── email_patterns         [Learned patterns]           │
│  ├── automation_rules       [User rules]                 │
│  └── processing_queue       [Backup queue]               │
│                                                          │
│  Redis Cache                                             │
│  ├── Scoring cache          [Recent scores]              │
│  ├── Pattern cache          [Active patterns]            │
│  └── Session state          [WebSocket connections]      │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                      │
├─────────────────────────────────────────────────────────┤
│  ├── Gmail API              [Watch/Push/Actions]         │
│  ├── OpenAI API             [GPT-4 Scoring]              │
│  └── Monitoring             [Logs/Metrics/Alerts]        │
└─────────────────────────────────────────────────────────┘
```

### Data Flow Sequence

```
1. Gmail → Push Notification → Webhook Endpoint
2. Webhook → Validate → Queue Message
3. Worker → Dequeue → Process Email
4. Process → Score → Categorize → Store
5. Store → Broadcast WebSocket → Update UI
6. UI → User Action → Learn → Improve
```

### Technology Stack

- **Frontend:** Next.js 14, React, WebSockets
- **Backend:** Next.js API Routes, Node.js Workers
- **Queue:** BullMQ (Redis) or Supabase Queue
- **Database:** Supabase (PostgreSQL)
- **Cache:** Redis or In-Memory
- **AI:** OpenAI GPT-4
- **Monitoring:** Vercel Analytics

---

## Phase 4: REFINEMENT (TDD Implementation)

### Test-Driven Development Plan

#### 1. Unit Tests

```typescript
// tests/scoring/rule-engine.test.ts
describe('RuleEngine', () => {
  it('should score marketing emails low', () => {
    const email = mockEmail({
      subject: '50% OFF Sale - Limited Time!',
      snippet: 'Unsubscribe at bottom...'
    })
    expect(ruleEngine.score(email)).toBeLessThan(30)
  })

  it('should boost VIP sender emails', () => {
    const email = mockEmail({ from: 'ceo@company.com' })
    mockVipSender('ceo@company.com', 25)
    expect(ruleEngine.score(email)).toBeGreaterThan(55)
  })

  it('should detect urgent keywords', () => {
    const email = mockEmail({ subject: 'URGENT: Server is down!' })
    expect(ruleEngine.score(email)).toBeGreaterThan(55)
  })
})

// tests/webhook/gmail-push.test.ts
describe('Gmail Webhook', () => {
  it('should validate genuine Gmail signatures', async () => {
    const webhook = mockGmailWebhook()
    const response = await request(app)
      .post('/api/gmail/webhook')
      .send(webhook)
    expect(response.status).toBe(200)
  })

  it('should reject invalid signatures', async () => {
    const webhook = mockGmailWebhook({ invalidSignature: true })
    const response = await request(app)
      .post('/api/gmail/webhook')
      .send(webhook)
    expect(response.status).toBe(401)
  })

  it('should queue email for processing', async () => {
    const webhook = mockGmailWebhook()
    await request(app).post('/api/gmail/webhook').send(webhook)
    expect(queue.getJobs()).toHaveLength(1)
  })
})
```

#### 2. Integration Tests

```typescript
// tests/integration/email-flow.test.ts
describe('End-to-End Email Flow', () => {
  it('should process email from webhook to UI update', async () => {
    // 1. Receive webhook
    const webhook = mockGmailWebhook({ emailId: 'test123' })
    await request(app).post('/api/gmail/webhook').send(webhook)

    // 2. Process queue
    await processQueue()

    // 3. Check database
    const score = await db.getEmailScore('test123')
    expect(score).toBeDefined()
    expect(score.tier).toBeOneOf(['high', 'medium', 'low'])

    // 4. Verify WebSocket broadcast
    expect(mockWebSocket.broadcasts).toContainEqual({
      type: 'email.scored',
      email_id: 'test123',
      score: expect.any(Number),
      tier: expect.any(String)
    })
  })
})
```

#### 3. Performance Tests

```typescript
// tests/performance/scoring.test.ts
describe('Scoring Performance', () => {
  it('should process 100 emails in under 10 seconds', async () => {
    const emails = Array(100).fill(null).map(() => mockEmail())
    const start = Date.now()

    await Promise.all(emails.map(e => scoreEmail(e)))

    const duration = Date.now() - start
    expect(duration).toBeLessThan(10000)
  })

  it('should use cache for duplicate emails', async () => {
    const email = mockEmail()
    await scoreEmail(email) // First call

    const start = Date.now()
    await scoreEmail(email) // Cached call
    const duration = Date.now() - start

    expect(duration).toBeLessThan(10) // Should be instant
  })
})
```

### Implementation Modules

#### Module 1: Gmail Push Webhook
```typescript
// app/api/gmail/webhook/route.ts
export async function POST(request: Request) {
  // Validate signature
  const signature = request.headers.get('x-goog-signature')
  if (!validateGmailSignature(signature, await request.text())) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Parse notification
  const data = JSON.parse(await request.text())
  const { emailAddress, historyId } = data.message.data

  // Queue for processing
  await queue.add('email.process', {
    emailAddress,
    historyId,
    timestamp: Date.now()
  })

  return NextResponse.json({ success: true })
}
```

#### Module 2: Background Worker
```typescript
// workers/email-processor.ts
import Bull from 'bull'

const emailQueue = new Bull('email.process', REDIS_URL)

emailQueue.process(async (job) => {
  const { emailAddress, historyId } = job.data

  // Fetch new emails
  const emails = await gmail.getNewEmails(emailAddress, historyId)

  for (const email of emails) {
    // Score email
    const score = await scoreEmail(email)

    // Store result
    await db.saveEmailScore(email.id, score)

    // Broadcast update
    await broadcast(emailAddress, {
      type: 'email.scored',
      email_id: email.id,
      ...score
    })

    // Execute automations
    await executeAutomations(email, score)
  }
})
```

#### Module 3: WebSocket Server
```typescript
// app/api/realtime/connect/route.ts
import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 3001 })

wss.on('connection', (ws, req) => {
  const userId = authenticate(req)

  // Store connection
  connections.set(userId, ws)

  ws.on('close', () => {
    connections.delete(userId)
  })
})

export function broadcast(userId: string, data: any) {
  const ws = connections.get(userId)
  if (ws) {
    ws.send(JSON.stringify(data))
  }
}
```

#### Module 4: Learning Engine
```typescript
// lib/learning/pattern-engine.ts
export class PatternLearningEngine {
  async recordUserAction(action: UserAction, email: Email) {
    const patterns = this.extractPatterns(email)

    switch (action.type) {
      case 'starred':
        await this.reinforcePositive(patterns)
        await this.boostSenderScore(email.from, 10)
        break

      case 'archived':
        if (email.score > 50) {
          await this.reinforceNegative(patterns)
        }
        break

      case 'replied':
        await this.reinforcePositive(patterns)
        await this.boostSenderScore(email.from, 15)
        break
    }

    await this.updateUserPreferences(action, patterns)
  }

  private async reinforcePositive(patterns: Pattern[]) {
    for (const pattern of patterns) {
      await db.updatePattern(pattern.id, {
        confidence: Math.min(1, pattern.confidence + 0.1),
        score_impact: Math.min(50, pattern.score_impact + 5)
      })
    }
  }
}
```

---

## Phase 5: COMPLETION (Integration & Deployment)

### Integration Steps

1. **Database Migration**
   ```sql
   -- Add automation tables
   CREATE TABLE automation_rules (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES users,
     trigger_type VARCHAR, -- 'score_threshold', 'sender', 'keyword'
     trigger_value JSONB,
     action_type VARCHAR, -- 'archive', 'flag', 'forward', 'label'
     action_value JSONB,
     enabled BOOLEAN DEFAULT true
   );

   CREATE TABLE processing_stats (
     user_id UUID PRIMARY KEY,
     total_processed INTEGER DEFAULT 0,
     avg_processing_time_ms INTEGER,
     last_processed_at TIMESTAMP
   );
   ```

2. **Environment Variables**
   ```env
   # Gmail Push
   GMAIL_WEBHOOK_SECRET=your-webhook-secret
   GMAIL_PUBSUB_TOPIC=projects/your-project/topics/gmail

   # Queue System
   REDIS_URL=redis://localhost:6379
   QUEUE_CONCURRENCY=5

   # WebSocket
   WEBSOCKET_PORT=3001
   WEBSOCKET_PATH=/realtime

   # Processing
   BATCH_SIZE=10
   AI_SCORE_THRESHOLD=50
   AUTO_ARCHIVE_THRESHOLD=20
   ```

3. **Gmail Watch Setup Script**
   ```typescript
   // scripts/setup-gmail-watch.ts
   async function setupGmailWatch(userId: string) {
     const auth = await getGmailAuth(userId)

     const response = await gmail.users.watch({
       userId: 'me',
       auth,
       requestBody: {
         topicName: process.env.GMAIL_PUBSUB_TOPIC,
         labelIds: ['INBOX'],
         labelFilterAction: 'include'
       }
     })

     await db.saveWatchExpiration(userId, response.data.expiration)
   }
   ```

### Deployment Checklist

- [ ] Set up Redis for queue management
- [ ] Configure Gmail Push Notifications
- [ ] Deploy WebSocket server
- [ ] Set up background workers
- [ ] Configure monitoring/logging
- [ ] Set up error tracking (Sentry)
- [ ] Performance monitoring
- [ ] Cost monitoring for AI calls
- [ ] Database backup strategy
- [ ] Rate limiting for API calls

### Monitoring & Metrics

```typescript
// Key metrics to track
const metrics = {
  // Performance
  emailProcessingTime: histogram('email_processing_time_ms'),
  queueDepth: gauge('queue_depth'),
  websocketConnections: gauge('websocket_connections'),

  // Business
  emailsProcessed: counter('emails_processed_total'),
  aiCallsMade: counter('ai_calls_total'),
  userActions: counter('user_actions_total'),

  // Accuracy
  scoringAccuracy: histogram('scoring_accuracy_percent'),
  falsePositives: counter('false_positives_total'),
  falseNegatives: counter('false_negatives_total'),

  // Cost
  aiCostPerUser: histogram('ai_cost_per_user_cents'),
  totalMonthlyCost: gauge('total_monthly_cost_dollars')
}
```

---

## Implementation Timeline

### Week 1: Core Infrastructure
- Day 1-2: Gmail webhook endpoint + signature validation
- Day 3-4: Queue system setup (BullMQ/Redis)
- Day 5: Background worker for processing

### Week 2: Real-time Features
- Day 1-2: WebSocket server setup
- Day 3-4: Real-time UI updates
- Day 5: Testing & debugging

### Week 3: Intelligence & Learning
- Day 1-2: Pattern learning engine
- Day 3-4: User preference learning
- Day 5: Automation rules engine

### Week 4: Polish & Deploy
- Day 1-2: Performance optimization
- Day 3: Monitoring setup
- Day 4: Production deployment
- Day 5: User documentation

---

## Success Criteria

1. **Automation Rate:** 90% of emails processed without user intervention
2. **Processing Speed:** < 5 seconds from receipt to UI update
3. **Accuracy:** > 85% user satisfaction with categorization
4. **Cost:** < $10/month per active user
5. **Uptime:** 99.9% availability

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Gmail API rate limits | Implement exponential backoff, use batch operations |
| High OpenAI costs | Cache results, use rule-based pre-filtering |
| WebSocket scalability | Use Socket.io with Redis adapter |
| Data privacy concerns | Implement end-to-end encryption, clear data retention policy |
| Processing delays | Priority queue, parallel processing |

---

## Next Steps

1. **Review & Approve** this SPARC plan
2. **Set up development environment** with Redis and workers
3. **Implement Gmail webhook** endpoint
4. **Begin TDD** with webhook tests
5. **Deploy MVP** to staging environment

This plan provides a complete roadmap from manual email processing to fully automated, intelligent email management with real-time updates and learning capabilities.