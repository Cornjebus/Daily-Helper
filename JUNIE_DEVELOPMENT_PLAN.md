# 🚀 Junie Development Plan
## The 5-Minute Email Superpower

### 📋 Executive Summary
Transform the current Daily Helper app into **Junie** - a revolutionary email management tool that replaces Gmail's cluttered interface with a focused, AI-powered experience. Users spend just 5 minutes every hour to stay on top of their inbox instead of hours lost in email chaos.

---

## 🎯 Core Product Vision

### Mission Statement
> "Instead of spending hours in your email, spend 5 minutes every hour and go about your day."

### Key Features
1. **Hourly Email Intelligence** - Automatic email fetching and AI-powered importance scoring
2. **Important Emails** - High-priority emails with in-app reply capability
3. **The Chaos Section** - Low-priority emails for bulk management
4. **5-Minute Dashboard** - Hourly summaries archived for 24 hours
5. **Zero Distractions** - No notifications, no interruptions, just focused email time

---

## 🏗️ Development Phases

### Phase 1: Foundation Cleanup (Day 1)
**Goal:** Strip down to Gmail-only functionality

#### Tasks:
- [ ] Remove all non-Gmail integrations
  - Delete Slack API routes (`/app/api/auth/slack/*`, `/app/api/slack/*`)
  - Remove Notion endpoints
  - Remove Linear endpoints
  - Clean up navigation components
- [ ] Update environment variables
  - Keep only: Supabase, Google OAuth, OpenAI
  - Remove: Slack, Notion, Linear, etc.
- [ ] Simplify database schema
  - Keep: users, emails, email_scores, email_ai_metadata
  - Add: hourly_summaries, reply_drafts
  - Remove: integration-specific tables

#### Code Cleanup Locations:
```
/app/api/auth/slack/         → DELETE
/app/api/slack/              → DELETE
/app/api/auth/notion/        → DELETE
/app/api/linear/             → DELETE
/lib/slack/                  → DELETE
/lib/notion/                 → DELETE
/components/*slack*          → DELETE
/components/*notion*         → DELETE
```

---

### Phase 2: Core Email Engine (Day 1-2)
**Goal:** Build robust email processing with AI scoring

#### 2.1 Hourly Sync System
```typescript
// /app/api/gmail/hourly-sync/route.ts
- Fetch emails from last hour
- Process with AI for importance scoring
- Store in database with scores
- Trigger summary generation
```

#### 2.2 AI Scoring Algorithm
```typescript
// /lib/ai/email-scorer.ts
interface EmailScore {
  overall: number;      // 0-100
  factors: {
    senderImportance: number;  // VIP, domain reputation
    contentUrgency: number;     // Keywords, deadlines
    userBehavior: number;       // Reply patterns
    contextual: number;         // Thread importance
  };
  category: 'important' | 'chaos';
  suggestedAction: string;
}
```

#### 2.3 Database Schema Updates
```sql
-- hourly_summaries table
CREATE TABLE hourly_summaries (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  hour_timestamp TIMESTAMP,
  total_emails INTEGER,
  important_count INTEGER,
  chaos_count INTEGER,
  summary_text TEXT,
  important_emails JSONB,  -- Array of email IDs with brief summaries
  created_at TIMESTAMP,
  expires_at TIMESTAMP      -- 24 hours from creation
);

-- reply_drafts table
CREATE TABLE reply_drafts (
  id UUID PRIMARY KEY,
  email_id UUID REFERENCES emails(id),
  user_id UUID REFERENCES users(id),
  draft_content TEXT,
  ai_suggestions JSONB,     -- Array of AI-generated replies
  sent_at TIMESTAMP,
  created_at TIMESTAMP
);
```

---

### Phase 3: UI Transformation (Day 2-3)
**Goal:** Create the 5-minute focused interface

#### 3.1 Homepage Redesign
```tsx
// /app/page.tsx
<Hero>
  <h1>Junie: Your 5-Minute Email Superpower</h1>
  <p>Instead of spending hours in your email,
     spend 5 minutes every hour and go about your day.</p>
  <SignInButton />
  <Stats>
    - Average time saved: 2.5 hours/day
    - Emails processed: 100+ per session
    - Important emails never missed: 100%
  </Stats>
</Hero>
```

#### 3.2 Dashboard Layout
```tsx
// /app/dashboard/page.tsx
<Dashboard>
  <Header>
    <TimeRemaining /> // "4:32 remaining in your 5-minute session"
    <LastSync />      // "Last sync: 12 minutes ago"
  </Header>

  <HourlySummary>
    // Brief AI summary of the last hour's emails
  </HourlySummary>

  <TwoColumnLayout>
    <ImportantEmails>
      // 3-5 most important emails with reply buttons
    </ImportantEmails>

    <ChaosSection>
      // Bulk management for low-priority emails
    </ChaosSection>
  </TwoColumnLayout>
</Dashboard>
```

#### 3.3 Component Structure
```
/components/
  ├── email/
  │   ├── ImportantEmailCard.tsx
  │   ├── ChaosEmailList.tsx
  │   ├── QuickReply.tsx
  │   └── AIReplysuggestions.tsx
  ├── dashboard/
  │   ├── HourlySummary.tsx
  │   ├── SessionTimer.tsx
  │   └── EmailStats.tsx
  └── chaos/
      ├── BulkActions.tsx
      ├── UnsubscribeButton.tsx
      └── FilterBar.tsx
```

---

### Phase 4: Important Emails Feature (Day 3-4)
**Goal:** Enable efficient handling of high-priority emails

#### 4.1 Email Card Component
```tsx
interface ImportantEmailProps {
  subject: string;
  sender: string;
  preview: string;
  aiSummary: string;
  receivedAt: Date;
  score: number;
  onReply: () => void;
}
```

#### 4.2 Quick Reply System
```typescript
// /app/api/gmail/reply/route.ts
- Accept reply text
- Send via Gmail API
- Sync to Gmail sent folder
- Mark original as replied
```

#### 4.3 AI Reply Suggestions
```typescript
// /lib/ai/reply-generator.ts
interface ReplyOptions {
  tone: 'professional' | 'friendly' | 'brief';
  suggestions: [
    { text: string; intent: 'accept' },
    { text: string; intent: 'decline' },
    { text: string; intent: 'needMoreInfo' }
  ];
}
```

---

### Phase 5: Chaos Management (Day 4-5)
**Goal:** Efficient bulk handling of low-priority emails

#### 5.1 Chaos Features
- **One-Click Unsubscribe**: Detect and unsubscribe from newsletters
- **Bulk Delete**: Select all from sender, date range
- **Mark All Read**: Clear the unread count
- **Smart Filters**: Group by sender, category

#### 5.2 Unsubscribe Detection
```typescript
// /lib/gmail/unsubscribe.ts
- Parse email headers for List-Unsubscribe
- Extract unsubscribe links from content
- One-click unsubscribe with confirmation
```

#### 5.3 Bulk Actions API
```typescript
// /app/api/gmail/bulk-actions/route.ts
POST /api/gmail/bulk-actions
{
  action: 'delete' | 'mark-read' | 'archive',
  emailIds: string[],
  filters?: {
    sender?: string;
    dateRange?: { from: Date; to: Date };
    keywords?: string[];
  }
}
```

---

### Phase 6: Automation & Polish (Day 5-6)
**Goal:** Set up automatic hourly processing

#### 6.1 Cron Job Setup
```typescript
// /app/api/cron/hourly-email-sync/route.ts
- Vercel cron: "0 * * * *" (every hour)
- For each active user:
  - Fetch new emails
  - Run AI scoring
  - Generate summary
  - Store for 24 hours
```

#### 6.2 Session Management
```typescript
// /lib/session/tracker.ts
- Track 5-minute sessions
- Show countdown timer
- Auto-save progress
- Gentle session end reminder
```

#### 6.3 Performance Optimizations
- Email caching strategy
- AI response caching
- Batch processing for bulk actions
- Optimistic UI updates

---

## 🎨 Design System

### Color Palette
```css
:root {
  --primary: #000000;      /* Focus black */
  --important: #FF4444;    /* Important red */
  --chaos: #888888;        /* Chaos gray */
  --success: #00C851;      /* Action green */
  --background: #FFFFFF;   /* Clean white */
}
```

### Typography
- **Headlines**: Inter, bold, minimal
- **Body**: System font, readable
- **Emphasis**: Color and weight, no italics

### UI Principles
1. **Minimal**: No unnecessary elements
2. **Focused**: Clear visual hierarchy
3. **Fast**: Instant interactions
4. **Calm**: No aggressive notifications

---

## 📊 Success Metrics

### User Engagement
- Average session time: 5 minutes ✓
- Emails processed per session: 50+
- Important email response rate: >90%
- Chaos cleared per week: 500+ emails

### Technical Performance
- Email sync time: <2 seconds
- AI scoring time: <100ms per email
- Page load time: <1 second
- Zero downtime during peak hours

---

## 🚀 Launch Checklist

### Pre-Launch
- [ ] Remove all non-Gmail code
- [ ] Implement core email engine
- [ ] Build new UI components
- [ ] Test AI scoring accuracy
- [ ] Set up hourly cron jobs
- [ ] Optimize performance

### Launch Day
- [ ] Deploy to production
- [ ] Monitor first hourly syncs
- [ ] Track user sessions
- [ ] Gather initial feedback

### Post-Launch
- [ ] Analyze 5-minute session patterns
- [ ] Refine AI scoring based on user behavior
- [ ] Add requested features
- [ ] Scale infrastructure as needed

---

## 🛠️ Technical Stack

### Current Stack (Keep)
- **Frontend**: Next.js 15, React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with Google OAuth
- **AI**: OpenAI GPT-4o-mini
- **Email**: Gmail API

### Remove
- Slack SDK
- Notion API
- Linear API
- All other third-party integrations

---

## 📅 Timeline

### Week 1
- **Day 1-2**: Foundation cleanup & core engine
- **Day 3-4**: UI transformation & important emails
- **Day 5-6**: Chaos management & automation

### Week 2
- **Day 7-8**: Testing & bug fixes
- **Day 9-10**: Performance optimization
- **Day 11-12**: Beta testing with users
- **Day 13-14**: Launch preparation

---

## 🎯 Next Steps

1. **Immediate Actions**:
   - Start code cleanup (remove integrations)
   - Design database schema changes
   - Create UI mockups

2. **Development Priority**:
   - Core email fetching and scoring
   - Important emails display
   - Basic reply functionality
   - Chaos section with bulk delete

3. **Testing Focus**:
   - 5-minute session flow
   - AI scoring accuracy
   - Gmail sync reliability
   - Bulk action performance

---

## 💡 Future Enhancements (Post-Launch)

- **Smart Scheduling**: Suggest optimal email checking times
- **Team Features**: Shared important emails for teams
- **Mobile App**: iOS/Android for on-the-go 5-minute sessions
- **AI Learning**: Personalized importance scoring based on behavior
- **Email Templates**: Quick responses for common scenarios
- **Analytics Dashboard**: Track email productivity improvements

---

## 📝 Notes

- Focus on the "5-minute superpower" messaging throughout
- Every feature should support the goal of quick, focused email sessions
- Avoid feature creep - keep it simple and fast
- The app should feel like a productivity tool, not another inbox

---

*This plan focuses on delivering a minimal, powerful email client that respects users' time and attention. The 5-minute constraint is a feature, not a limitation.*