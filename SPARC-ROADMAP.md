# SPARC TDD Development Roadmap
## Unified Focus Assistant - Real Integration Implementation

---

## Phase 0: Environment & OAuth App Setup ✅ FIRST PRIORITY
**Duration**: 1-2 days
**Objective**: Register OAuth applications and set up developer credentials

### Tests First (TDD)
- [ ] Test environment variable loading
- [ ] Test Supabase connection
- [ ] Test OAuth redirect flows
- [ ] Test token encryption/decryption
- [ ] Test user data isolation

### Deliverables
1. **OAuth App Registrations** (YOUR app credentials, not user credentials):
   - Google Cloud Console: Create OAuth 2.0 Client
   - Slack App: Register at api.slack.com
   - Notion Integration: Create public integration
   - Linear: Register OAuth application
   - Trello: Register application
   - Calendly: Register OAuth app

2. `.env.local` file with APP credentials:
   ```env
   # Your app's OAuth credentials (not user-specific)
   GOOGLE_CLIENT_ID=your_apps_google_client_id
   GOOGLE_CLIENT_SECRET=your_apps_google_secret
   SLACK_CLIENT_ID=your_apps_slack_client_id
   SLACK_CLIENT_SECRET=your_apps_slack_secret
   NOTION_OAUTH_CLIENT_ID=your_apps_notion_id
   NOTION_OAUTH_CLIENT_SECRET=your_apps_notion_secret
   # ... etc
   ```

3. Database schema for storing USER tokens:
   ```sql
   -- Each user's tokens stored encrypted
   user_integrations table
   feed_items table with user_id foreign key
   ```

4. Token encryption setup using Supabase Vault

---

## Phase 1: Core Infrastructure Setup
**Duration**: 3-4 days
**Objective**: Initialize Next.js project with Supabase backend

### Tests First (TDD)
- [ ] Test Next.js app initialization
- [ ] Test Supabase table creation
- [ ] Test auth flow (signup, login, logout)
- [ ] Test database CRUD operations
- [ ] Test API route handlers

### Deliverables
1. Next.js 15.5.3 project initialized
2. Supabase database schema:
   ```sql
   - users table
   - items table (unified feed items)
   - integrations table (user connections)
   - ai_usage table (token tracking)
   ```
3. Authentication flow working with REAL Supabase Auth
4. Basic API routes structure
5. Deployment to Vercel

---

## Phase 2: Gmail Integration (First Real Data Source) ✅ COMPLETED
**Duration**: 5-6 days (Actual: 1 day)
**Objective**: Connect and ingest REAL Gmail messages

### Tests First (TDD)
- [x] Test Gmail OAuth flow
- [x] Test email fetching with pagination
- [x] Test email parsing and storage
- [x] Test thread grouping
- [x] Test attachment handling

### Deliverables ✅
1. ✅ Gmail OAuth connection flow - Working with Google OAuth
2. ✅ Email ingestion service fetching REAL emails - Fetches today's emails only
3. ✅ Database storage of email metadata - Stores in emails & email_threads tables
4. ✅ Email thread reconstruction - Groups emails by conversation
5. ✅ Cron job for periodic email sync - Available at /api/cron/sync
6. ✅ Basic UI showing real emails in feed - Now/Next/Later categorization

### Key Features Implemented:
- Today-focused approach (only fetches current day's emails)
- Smart prioritization (Important → Now, Unread → Next, Read → Later)
- Email threads panel showing conversations
- Manual sync button for on-demand updates
- Clean UI with shadcn components

---

## Phase 3: AI Processing with Cost Tracking ✅ COMPLETED
**Duration**: 4-5 days (Actual: 1 day)
**Objective**: Add OpenAI scoring and summarization with REAL API calls

### Tests First (TDD)
- [x] Test OpenAI API connection
- [x] Test priority scoring logic
- [x] Test summarization quality
- [x] Test token counting accuracy
- [x] Test cost calculation
- [x] Test budget alerts

### Deliverables ✅
1. ✅ OpenAI integration with REAL API calls - Implemented with gpt-3.5-turbo
2. ✅ Email scoring (1-10 priority) on real emails - AI scoring with fallback logic
3. ✅ Email summarization for long threads - Smart thread summarization
4. ✅ Token usage tracking per operation - Complete with tiktoken integration
5. ✅ Cost dashboard showing actual spending - Live dashboard with usage stats
6. ✅ Budget alerts when approaching limits - Configurable daily/monthly limits

### Key Features Implemented:
- Real-time AI email priority scoring (1-10 scale)
- Intelligent email thread summarization
- Comprehensive token counting and cost tracking
- Visual cost dashboard with usage statistics
- Budget management with configurable limits
- Smart reply suggestion generation
- Full cost transparency with per-operation tracking

---

## Phase 4: Prioritized Feed UI
**Duration**: 4-5 days
**Objective**: Build the core UI with REAL prioritized data

### Tests First (TDD)
- [ ] Test feed component rendering
- [ ] Test priority sorting algorithm
- [ ] Test "Now/Next/Later" categorization
- [ ] Test real-time updates
- [ ] Test responsive design

### Deliverables
1. Dashboard with prioritized feed
2. "Now", "Next", "Later" sections with REAL emails
3. Item cards with summaries and actions
4. Real-time updates when new items arrive
5. Mobile-responsive design with Tailwind CSS

---

## Phase 5: Slack Integration
**Duration**: 4-5 days
**Objective**: Add REAL Slack message ingestion

### Tests First (TDD)
- [ ] Test Slack OAuth flow
- [ ] Test message fetching from channels
- [ ] Test DM retrieval
- [ ] Test mention detection
- [ ] Test Slack event webhooks

### Deliverables
1. Slack app installation flow
2. Channel and DM message ingestion
3. @ mention priority boosting
4. Unified feed showing Gmail + Slack
5. Slack event webhook for real-time updates

---

## Phase 6: Calendar Integration
**Duration**: 3-4 days
**Objective**: Integrate REAL Google Calendar events

### Tests First (TDD)
- [ ] Test Calendar API authentication
- [ ] Test event fetching
- [ ] Test recurring event handling
- [ ] Test meeting conflict detection
- [ ] Test calendar updates

### Deliverables
1. Google Calendar OAuth connection
2. Event ingestion and storage
3. Meeting reminders in feed
4. Time-based priority scoring
5. Calendar view component

---

## Phase 7: Task Management Integration (Notion First)
**Duration**: 5-6 days
**Objective**: Enable REAL task creation in Notion

### Tests First (TDD)
- [ ] Test Notion API authentication
- [ ] Test database discovery
- [ ] Test page creation
- [ ] Test property mapping
- [ ] Test error handling

### Deliverables
1. Notion integration setup flow
2. Database selection UI
3. One-click task creation from feed items
4. Task property mapping (title, description, priority)
5. Bi-directional sync for task status

---

## Phase 8: Daily Digest System
**Duration**: 3-4 days
**Objective**: Automated digest with REAL data

### Tests First (TDD)
- [ ] Test digest generation logic
- [ ] Test email formatting
- [ ] Test Slack message formatting
- [ ] Test cron job triggers
- [ ] Test delivery confirmation

### Deliverables
1. Digest generation at 8am, 1pm, 5pm
2. Email digest sender using REAL SMTP
3. Slack digest via bot message
4. User preferences for digest channel
5. Digest analytics tracking

---

## Phase 9: Linear & Trello Integration
**Duration**: 4-5 days
**Objective**: Expand task management options

### Tests First (TDD)
- [ ] Test Linear API authentication
- [ ] Test Trello OAuth flow
- [ ] Test issue/card creation
- [ ] Test team/board selection
- [ ] Test status synchronization

### Deliverables
1. Linear issue creation from feed
2. Trello card creation from feed
3. Platform selection UI
4. Team/board configuration
5. Status sync back to feed

---

## Phase 10: Calendly Integration
**Duration**: 2-3 days
**Objective**: Meeting scheduling automation

### Tests First (TDD)
- [ ] Test Calendly API authentication
- [ ] Test event type fetching
- [ ] Test scheduling link generation
- [ ] Test booking notifications
- [ ] Test calendar sync

### Deliverables
1. Calendly connection flow
2. Scheduling link generation
3. Meeting request detection in emails
4. Auto-suggest available times
5. Booking confirmations in feed

---

## Phase 11: Advanced AI Features
**Duration**: 4-5 days
**Objective**: Enron-trained model and bundling

### Tests First (TDD)
- [ ] Test fine-tuned model deployment
- [ ] Test improved email summarization
- [ ] Test thread bundling logic
- [ ] Test topic clustering
- [ ] Test brief generation

### Deliverables
1. Fine-tuned GPT model for emails
2. Intelligent thread bundling
3. Topic-based grouping
4. Executive brief generation
5. Context-aware responses

---

## Phase 12: Performance & Polish
**Duration**: 3-4 days
**Objective**: Optimization and production readiness

### Tests First (TDD)
- [ ] Load testing with real data
- [ ] Test caching strategies
- [ ] Test error recovery
- [ ] Test data backup
- [ ] Security penetration testing

### Deliverables
1. Response time < 200ms
2. Caching layer implementation
3. Error boundary components
4. Data export functionality
5. Security audit completion

---

## Success Criteria
- ALL integrations use REAL APIs (no mocks)
- Every phase has passing tests BEFORE implementation
- Each phase produces a working, deployable feature
- User can see real data from their actual accounts
- Cost tracking shows actual OpenAI spending
- Tasks create real items in external tools

## Environment Variables Checklist (Phase 0)
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Slack
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
SLACK_BOT_TOKEN=

# OpenAI
OPENAI_API_KEY=
OPENAI_ORG_ID=

# Notion
NOTION_INTEGRATION_TOKEN=

# Linear
LINEAR_API_KEY=

# Trello
TRELLO_API_KEY=
TRELLO_TOKEN=

# Calendly
CALENDLY_PERSONAL_TOKEN=

# App Config
NEXT_PUBLIC_APP_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```