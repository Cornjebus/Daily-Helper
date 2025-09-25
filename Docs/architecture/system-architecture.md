# 🏗️ System Architecture
## Scalable Email Intelligence Platform Design

### **Architecture Overview**

The Email Intelligence Platform is built as a modular, event-driven system that processes thousands of emails efficiently while maintaining cost optimization and real-time responsiveness.

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  Next.js Frontend  │  API Routes  │  Real-time Updates (SSE)    │
│  - Dashboard       │  - Email API │  - Score Updates            │
│  - Digest View     │  - VIP API   │  - Processing Status        │
│  - Settings        │  - Bulk API  │  - Weekly Digests           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│           Email Processing Pipeline (Core Engine)               │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ Gmail Ingestion│  │ Scoring      │  │ AI Processing        │ │
│  │ - OAuth Flow  │  │ Engine       │  │ Pipeline             │ │
│  │ - Batch Fetch │  │ - Multi-tier │  │ - Tier Routing       │ │
│  │ - Incremental │  │ - Real-time  │  │ - Batch Processing   │ │
│  └───────────────┘  └──────────────┘  └──────────────────────┘ │
│                                │                                │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ Pattern       │  │ Learning     │  │ Weekly Digest        │ │
│  │ Recognition   │  │ Engine       │  │ Generator            │ │
│  │ - ML Detection│  │ - Feedback   │  │ - Bulk Actions       │ │
│  │ - Confidence  │  │ - Adaptation │  │ - Unsubscribe AI     │ │
│  └───────────────┘  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│  Supabase PostgreSQL  │  Redis Cache  │  External Services      │
│  - Email Scores       │  - Hot Data   │  - OpenAI API           │
│  - User Patterns      │  - Sessions   │  - Gmail API            │
│  - VIP Senders        │  - Temp State │  - Unsubscribe Services │
│  - Weekly Digests     │               │                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## **Core Service Architecture**

### **1. Email Processing Service**

```typescript
interface EmailProcessingService {
  // Main processing pipeline
  processNewEmail(email: GmailEmail, userId: string): Promise<ProcessingResult>

  // Batch processing for efficiency
  processBatchEmails(emails: GmailEmail[], userId: string): Promise<BatchResult>

  // Real-time scoring
  calculateEmailScore(email: EmailData, userId: string): Promise<EmailScore>

  // Pattern recognition
  detectEmailPatterns(email: EmailData): Promise<PatternResult>
}

class EmailProcessingServiceImpl implements EmailProcessingService {
  constructor(
    private scoringEngine: ScoringEngine,
    private patternEngine: PatternRecognitionEngine,
    private aiPipeline: AIProcessingPipeline,
    private learningEngine: LearningEngine,
    private database: Database,
    private cache: CacheService
  ) {}

  async processNewEmail(email: GmailEmail, userId: string): Promise<ProcessingResult> {
    // 1. Score the email (< 100ms)
    const score = await this.scoringEngine.calculateScore(email, userId)

    // 2. Determine processing tier
    const tier = this.determineTier(score.final_score, userId)

    // 3. Store score immediately
    await this.database.storeEmailScore(userId, email.id, score)

    // 4. Route to appropriate processing tier
    const aiResult = await this.aiPipeline.processByTier(email, tier, userId)

    // 5. Update feed item
    await this.updateFeedItem(email.id, score, tier, aiResult)

    // 6. Trigger learning if user feedback exists
    if (aiResult.user_feedback) {
      await this.learningEngine.processFeedback(userId, aiResult.user_feedback)
    }

    return {
      score,
      tier,
      ai_result: aiResult,
      processing_time: performance.now() - startTime
    }
  }
}
```

### **2. Scoring Engine Service**

```typescript
interface ScoringEngine {
  calculateScore(email: EmailData, userId: string): Promise<EmailScore>
  calculateBatchScores(emails: EmailData[], userId: string): Promise<EmailScore[]>
  updateUserWeights(userId: string, weights: ScoringWeights): Promise<void>
}

class ScoringEngineImpl implements ScoringEngine {
  // Pre-load user data for performance
  private userDataCache = new Map<string, UserScoringData>()

  async calculateScore(email: EmailData, userId: string): Promise<EmailScore> {
    const userData = await this.getUserScoringData(userId)

    // Run all scoring factors in parallel
    const [
      vipBoost,
      urgencyBoost,
      marketingPenalty,
      gmailSignals,
      timeDecay,
      contentAnalysis,
      senderReputation,
      userPatterns
    ] = await Promise.all([
      this.calculateVIPBoost(email.sender, userData.vipSenders),
      this.calculateUrgencyBoost(email.subject, email.body),
      this.calculateMarketingPenalty(email),
      this.calculateGmailSignals(email),
      this.calculateTimeDecayFactor(email.receivedAt),
      this.calculateContentAnalysis(email.snippet),
      this.calculateSenderReputation(email.sender),
      this.applyUserPatterns(email, userData.patterns)
    ])

    const rawScore = 30 + vipBoost + urgencyBoost + marketingPenalty +
                    gmailSignals + timeDecay + contentAnalysis +
                    senderReputation + userPatterns

    const finalScore = this.clamp(rawScore, 0, 100)

    return {
      raw_score: rawScore,
      final_score: finalScore,
      score_factors: {
        baseScore: 30,
        vipBoost,
        urgencyBoost,
        marketingPenalty,
        gmailSignals,
        timeDecay,
        contentAnalysis,
        senderReputation,
        userPatterns
      }
    }
  }
}
```

### **3. AI Processing Pipeline Service**

```typescript
interface AIProcessingPipeline {
  processByTier(email: EmailData, tier: ProcessingTier, userId: string): Promise<AIResult>
  processBatch(emails: EmailData[], userId: string): Promise<AIResult[]>
  checkBudgetLimits(userId: string): Promise<BudgetStatus>
}

class AIProcessingPipelineImpl implements AIProcessingPipeline {
  constructor(
    private openaiClient: OpenAI,
    private budgetTracker: BudgetTracker,
    private cache: CacheService
  ) {}

  async processByTier(email: EmailData, tier: ProcessingTier, userId: string): Promise<AIResult> {
    // Check budget first
    const budgetStatus = await this.budgetTracker.checkDailyBudget(userId)
    if (budgetStatus.exceeded && tier !== 'high') {
      return this.processLowPriorityEmail(email)
    }

    switch (tier) {
      case 'high':
        return this.processHighPriorityEmail(email, userId)
      case 'medium':
        return this.queueForBatchProcessing(email, userId)
      case 'low':
        return this.processLowPriorityEmail(email)
    }
  }

  private async processHighPriorityEmail(email: EmailData, userId: string): Promise<AIResult> {
    const prompt = this.buildComprehensivePrompt(email)
    const model = await this.selectOptimalModel(email, userId)

    try {
      const response = await this.openaiClient.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500
      })

      const analysis = this.parseAIResponse(response.choices[0].message.content)
      const cost = this.calculateCost(model, prompt.length, response.usage.total_tokens)

      await this.budgetTracker.recordCost(userId, cost)

      return {
        ...analysis,
        ai_cost: cost,
        ai_model_used: model,
        processing_time: Date.now() - startTime,
        ai_processed: true
      }
    } catch (error) {
      // Fallback to medium tier processing
      return this.processMediumPriorityEmail(email, userId)
    }
  }
}
```

---

## **Data Architecture & Storage Strategy**

### **Database Schema Design**

```sql
-- Optimized for high-performance email processing
-- Indexes designed for common query patterns

-- Primary email scoring table
CREATE TABLE email_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email_id VARCHAR NOT NULL,
    gmail_id VARCHAR,

    -- Scoring data (indexed for fast retrieval)
    raw_score INTEGER CHECK (raw_score >= 0 AND raw_score <= 100),
    final_score INTEGER CHECK (final_score >= 0 AND final_score <= 100),
    processing_tier VARCHAR CHECK (processing_tier IN ('high', 'medium', 'low')),

    -- JSON for flexibility, indexed with GIN
    score_factors JSONB NOT NULL DEFAULT '{}',

    -- AI processing tracking
    ai_processed BOOLEAN DEFAULT false,
    ai_analysis JSONB,
    ai_cost DECIMAL(10, 6),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, email_id)
);

-- Performance indexes
CREATE INDEX idx_email_scores_user_tier ON email_scores(user_id, processing_tier);
CREATE INDEX idx_email_scores_created ON email_scores(created_at DESC);
CREATE INDEX idx_email_scores_score ON email_scores(user_id, final_score DESC);
CREATE INDEX idx_email_scores_factors ON email_scores USING GIN (score_factors);
```

### **Caching Strategy**

```typescript
interface CacheService {
  // Hot data - frequently accessed
  getUserScoringData(userId: string): Promise<UserScoringData>
  getVIPSenders(userId: string): Promise<VIPSender[]>
  getUserPatterns(userId: string): Promise<EmailPattern[]>

  // Computation cache - expensive operations
  getSenderReputation(domain: string): Promise<ReputationScore>
  getPatternResults(email: EmailData): Promise<PatternResult>

  // AI results cache - avoid reprocessing
  getCachedAIResult(emailHash: string): Promise<AIResult | null>
  cacheAIResult(emailHash: string, result: AIResult): Promise<void>
}

class RedisCacheService implements CacheService {
  constructor(private redis: Redis) {}

  async getUserScoringData(userId: string): Promise<UserScoringData> {
    const cacheKey = `user_scoring_data:${userId}`
    const cached = await this.redis.get(cacheKey)

    if (cached) {
      return JSON.parse(cached)
    }

    // Load from database and cache for 1 hour
    const data = await this.loadUserScoringData(userId)
    await this.redis.setex(cacheKey, 3600, JSON.stringify(data))

    return data
  }
}
```

---

## **Performance & Scalability Architecture**

### **Horizontal Scaling Strategy**

```typescript
// Queue-based processing for scalability
interface ProcessingQueue {
  enqueueEmailProcessing(email: EmailData, userId: string, priority: 'high' | 'medium' | 'low'): Promise<void>
  enqueueBatchProcessing(emails: EmailData[], userId: string): Promise<void>
  enqueueDigestGeneration(userId: string, weekStart: Date): Promise<void>
}

class BullQueueService implements ProcessingQueue {
  private highPriorityQueue: Queue
  private mediumPriorityQueue: Queue
  private lowPriorityQueue: Queue
  private digestQueue: Queue

  constructor() {
    // High priority: Immediate processing
    this.highPriorityQueue = new Queue('high-priority-emails', {
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        }
      }
    })

    // Medium priority: Batch processing every 30 seconds
    this.mediumPriorityQueue = new Queue('medium-priority-emails', {
      defaultJobOptions: {
        delay: 30000, // 30 second delay for batching
        removeOnComplete: 200,
        removeOnFail: 100
      }
    })

    // Low priority: Process during off-peak hours
    this.lowPriorityQueue = new Queue('low-priority-emails', {
      defaultJobOptions: {
        delay: 300000, // 5 minute delay
        removeOnComplete: 500,
        removeOnFail: 100
      }
    })
  }
}
```

### **Database Performance Optimization**

```sql
-- Materialized views for fast pattern lookups
CREATE MATERIALIZED VIEW user_scoring_patterns_optimized AS
SELECT
    user_id,
    pattern_type,
    pattern_value,
    AVG(score_impact) as avg_impact,
    COUNT(*) as pattern_frequency,
    MAX(confidence_score) as max_confidence,
    MAX(last_seen_at) as last_used,
    -- Pre-compute common calculations
    CASE
        WHEN AVG(score_impact) > 15 THEN 'positive'
        WHEN AVG(score_impact) < -15 THEN 'negative'
        ELSE 'neutral'
    END as impact_category
FROM email_patterns
WHERE confidence_score > 0.5
  AND last_seen_at > NOW() - INTERVAL '90 days'  -- Only recent patterns
GROUP BY user_id, pattern_type, pattern_value
HAVING COUNT(*) >= 2;

-- Partial indexes for common queries
CREATE INDEX idx_email_scores_recent_high
ON email_scores(user_id, created_at DESC)
WHERE processing_tier = 'high' AND created_at > NOW() - INTERVAL '7 days';

-- Function-based index for JSON queries
CREATE INDEX idx_score_factors_vip
ON email_scores((score_factors->>'vipBoost')::integer)
WHERE (score_factors->>'vipBoost')::integer > 0;
```

---

## **Real-time Updates Architecture**

### **Server-Sent Events for Live Updates**

```typescript
interface RealtimeService {
  subscribeToEmailUpdates(userId: string): EventStream
  publishScoreUpdate(userId: string, emailId: string, score: EmailScore): void
  publishDigestReady(userId: string, digestId: string): void
}

class SSERealtimeService implements RealtimeService {
  private connections = new Map<string, Response>()

  subscribeToEmailUpdates(userId: string): EventStream {
    const stream = new ReadableStream({
      start(controller) {
        const connection = {
          controller,
          userId,
          lastHeartbeat: Date.now()
        }

        this.connections.set(userId, connection)

        // Send initial connection confirmation
        this.sendEvent(controller, 'connected', { timestamp: Date.now() })

        // Set up heartbeat
        const heartbeat = setInterval(() => {
          this.sendEvent(controller, 'heartbeat', { timestamp: Date.now() })
        }, 30000)

        // Cleanup on disconnect
        controller.close = () => {
          clearInterval(heartbeat)
          this.connections.delete(userId)
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  }

  publishScoreUpdate(userId: string, emailId: string, score: EmailScore): void {
    const connection = this.connections.get(userId)
    if (connection) {
      this.sendEvent(connection.controller, 'score-update', {
        emailId,
        score: score.final_score,
        tier: score.processing_tier,
        timestamp: Date.now()
      })
    }
  }
}
```

---

## **Security & Privacy Architecture**

### **Data Protection Strategy**

```typescript
// Row Level Security policies
const RLS_POLICIES = `
-- Ensure users only access their own data
CREATE POLICY "Users access own email scores" ON email_scores
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own VIP senders" ON vip_senders
  FOR ALL USING (auth.uid() = user_id);

-- Prevent data leakage in materialized views
CREATE POLICY "Users access own patterns" ON user_scoring_patterns_optimized
  FOR ALL USING (auth.uid() = user_id);
`;

// Email content encryption at rest
interface EncryptionService {
  encryptEmailContent(content: string): Promise<string>
  decryptEmailContent(encryptedContent: string): Promise<string>
  hashEmailForDeduplication(email: EmailData): string
}

class AESEncryptionService implements EncryptionService {
  private readonly algorithm = 'aes-256-gcm'
  private readonly keySize = 32

  async encryptEmailContent(content: string): Promise<string> {
    const key = await this.getEncryptionKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipher(this.algorithm, key, iv)

    let encrypted = cipher.update(content, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag()

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  }
}
```

### **API Rate Limiting & Security**

```typescript
// Rate limiting for different endpoints
const RATE_LIMITS = {
  '/api/emails/process': { windowMs: 60000, max: 100 }, // 100 emails/minute
  '/api/ai/analyze': { windowMs: 60000, max: 50 },      // 50 AI calls/minute
  '/api/digest/generate': { windowMs: 3600000, max: 1 }, // 1 digest/hour
  '/api/patterns/update': { windowMs: 60000, max: 200 }  // 200 pattern updates/minute
}

// API authentication middleware
async function authMiddleware(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  try {
    const { data: user } = await supabase.auth.getUser(token)
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' })
  }
}
```

---

## **Monitoring & Observability Architecture**

### **Performance Monitoring**

```typescript
interface MetricsCollector {
  recordEmailProcessingTime(userId: string, processingTime: number, tier: string): void
  recordAICost(userId: string, cost: number, model: string): void
  recordScoreAccuracy(userId: string, predicted: number, actual: string): void
  recordSystemHealth(): Promise<HealthMetrics>
}

class PrometheusMetricsCollector implements MetricsCollector {
  private processingTimeHistogram = new client.Histogram({
    name: 'email_processing_time_seconds',
    help: 'Time taken to process emails',
    labelNames: ['tier', 'user_id']
  })

  private aiCostGauge = new client.Gauge({
    name: 'ai_cost_daily_total',
    help: 'Daily AI processing cost per user',
    labelNames: ['user_id', 'model']
  })

  recordEmailProcessingTime(userId: string, processingTime: number, tier: string): void {
    this.processingTimeHistogram
      .labels(tier, userId)
      .observe(processingTime / 1000) // Convert to seconds
  }
}
```

### **Error Tracking & Alerting**

```typescript
// Error boundaries and circuit breakers
class EmailProcessingCircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private threshold = 5,
    private timeout = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
}
```

---

## **Deployment Architecture**

### **Vercel Deployment Strategy**

```typescript
// vercel.json configuration
{
  "functions": {
    "app/api/emails/process.ts": {
      "maxDuration": 30
    },
    "app/api/ai/analyze.ts": {
      "maxDuration": 60,
      "memory": 512
    },
    "app/api/digest/generate.ts": {
      "maxDuration": 300,
      "memory": 1024
    }
  },
  "env": {
    "OPENAI_API_KEY": "@openai-api-key",
    "SUPABASE_SERVICE_KEY": "@supabase-service-key",
    "REDIS_URL": "@redis-url"
  },
  "regions": ["iad1"], // Close to Supabase US East
  "rewrites": [
    {
      "source": "/api/realtime/:path*",
      "destination": "/api/realtime/:path*"
    }
  ]
}
```

### **Environment Configuration**

```typescript
// Environment-specific configs
const CONFIG = {
  production: {
    ai: {
      defaultModel: 'gpt-4o-mini',
      maxDailyCost: 2.00,
      batchSize: 10,
      timeout: 30000
    },
    cache: {
      userDataTTL: 3600,      // 1 hour
      aiResultTTL: 86400,     // 24 hours
      patternTTL: 7200        // 2 hours
    },
    processing: {
      highPriorityTimeout: 5000,    // 5 seconds
      mediumPriorityDelay: 30000,   // 30 seconds
      batchProcessingSize: 50
    }
  },
  development: {
    ai: {
      defaultModel: 'gpt-4o-mini',
      maxDailyCost: 0.50,
      batchSize: 5,
      timeout: 60000
    },
    // Reduced caching in development
    cache: {
      userDataTTL: 300,
      aiResultTTL: 3600,
      patternTTL: 600
    }
  }
}
```

---

## **Success Metrics & SLAs**

### **Performance Targets**

```typescript
const SLA_TARGETS = {
  emailProcessing: {
    scoreCalculation: 100,      // < 100ms per email
    highTierAI: 3000,          // < 3s for high priority
    mediumTierBatch: 1000,     // < 1s per email in batch
    lowTierRules: 50           // < 50ms for rule-based
  },

  availability: {
    uptime: 99.9,              // 99.9% uptime
    apiResponseTime: 200,      // < 200ms API response
    realtimeLatency: 500       // < 500ms real-time updates
  },

  accuracy: {
    scoringAccuracy: 90,       // 90%+ correct tier assignment
    patternDetection: 85,      // 85%+ marketing detection
    costOptimization: 67       // 67% cost reduction target
  }
}
```

The system architecture provides a robust, scalable foundation for the intelligent email processing platform, capable of handling thousands of users and millions of emails while maintaining sub-second response times and cost-effective AI usage.