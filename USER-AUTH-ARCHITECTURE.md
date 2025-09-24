# User Authentication Architecture
## How Users Connect Their Own Accounts

---

## Overview
Each user of the Unified Focus Assistant will connect their OWN personal accounts. The app acts as a hub that the user authorizes to access their various services.

---

## Authentication Flow Per Service

### 1. Google (Gmail & Calendar)
- **Method**: OAuth 2.0
- **User Experience**:
  1. User clicks "Connect Gmail/Calendar"
  2. Redirected to Google's OAuth consent screen
  3. User logs in with THEIR Google account
  4. User grants permissions (read emails, manage calendar)
  5. App receives access token specific to that user
  6. Token stored encrypted in Supabase for that user

### 2. Slack
- **Method**: OAuth 2.0 with Slack App
- **User Experience**:
  1. User clicks "Add to Slack"
  2. Redirected to Slack OAuth page
  3. User selects THEIR workspace
  4. User authorizes app permissions
  5. App receives workspace-specific token
  6. Token stored per user/workspace combination

### 3. Notion
- **Method**: OAuth 2.0 Public Integration
- **User Experience**:
  1. User clicks "Connect Notion"
  2. Redirected to Notion's integration page
  3. User selects which Notion pages/databases to share
  4. App receives access token for those specific resources
  5. User can modify permissions anytime in Notion settings

### 4. Linear
- **Method**: OAuth 2.0 or Personal API Key
- **User Experience**:
  1. User clicks "Connect Linear"
  2. Either OAuth flow OR user provides their Linear API key
  3. User selects team/workspace
  4. Token stored encrypted for that user

### 5. Trello
- **Method**: OAuth 1.0a
- **User Experience**:
  1. User clicks "Connect Trello"
  2. Redirected to Trello authorization
  3. User approves access to THEIR boards
  4. Token stored for that user

### 6. Calendly
- **Method**: Personal Access Token or OAuth
- **User Experience**:
  1. User connects their Calendly account
  2. Authorizes access to their scheduling data
  3. Token stored encrypted

### 7. OpenAI
- **Method**: User provides their own API key (optional)
- **User Experience**:
  1. User can optionally provide their own OpenAI key
  2. Otherwise, app uses shared key with usage tracking/billing

---

## Data Isolation & Security

### Per-User Data Storage
```sql
-- Each user has completely isolated data
CREATE TABLE user_integrations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  service TEXT, -- 'gmail', 'slack', 'notion', etc.
  access_token TEXT, -- Encrypted
  refresh_token TEXT, -- Encrypted
  workspace_id TEXT, -- For Slack/Notion/Linear
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE feed_items (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id), -- Items belong to specific user
  source TEXT,
  content JSONB,
  priority INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Security Measures
1. **Token Encryption**: All OAuth tokens encrypted at rest using Supabase Vault
2. **Row Level Security (RLS)**: Users can only access their own data
3. **Token Refresh**: Automatic token refresh before expiration
4. **Revocation**: Users can disconnect any service anytime
5. **No Shared Access**: Each user's data is completely isolated

---

## User Onboarding Flow

### Step 1: Sign Up
1. User creates account with email/password
2. Email verification
3. Account created in Supabase Auth

### Step 2: Connect Services (User Choice)
```
Dashboard shows connection cards:

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│     Gmail       │  │      Slack      │  │     Notion      │
│  [Connect →]    │  │  [Connect →]    │  │  [Connect →]    │
│   Not Connected │  │   Not Connected │  │   Not Connected │
└─────────────────┘  └─────────────────┘  └─────────────────┘

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    Calendar     │  │     Linear      │  │     Trello      │
│  [Connect →]    │  │  [Connect →]    │  │  [Connect →]    │
│   Not Connected │  │   Not Connected │  │   Not Connected │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Step 3: Authorize Each Service
- User clicks "Connect" for each service they want
- Goes through OAuth flow for that service
- Returns to dashboard showing "Connected ✓"

### Step 4: Configure Preferences
- Select primary task management tool (Notion/Linear/Trello)
- Set digest delivery preferences
- Configure AI budget limits

---

## Environment Variables Structure

### Application-Level (Phase 0 Setup)
```env
# These are YOUR developer credentials for the app itself
GOOGLE_CLIENT_ID=your_app_google_client_id
GOOGLE_CLIENT_SECRET=your_app_google_client_secret
SLACK_CLIENT_ID=your_app_slack_client_id
SLACK_CLIENT_SECRET=your_app_slack_client_secret
NOTION_OAUTH_CLIENT_ID=your_app_notion_client_id
NOTION_OAUTH_CLIENT_SECRET=your_app_notion_client_secret
# ... etc
```

### User-Level (Stored in Database)
```javascript
// Each user's tokens stored encrypted in database
{
  user_id: "user-123",
  integrations: {
    gmail: {
      access_token: "encrypted_user_specific_token",
      refresh_token: "encrypted_refresh_token",
      email: "user@gmail.com"
    },
    notion: {
      access_token: "encrypted_notion_token",
      workspace_id: "users_notion_workspace"
    },
    slack: {
      access_token: "encrypted_slack_token",
      team_id: "users_slack_team"
    }
  }
}
```

---

## Key Points

1. **Users own their data**: Each user connects their own accounts
2. **No shared credentials**: Every user has their own tokens
3. **Privacy first**: We never see user passwords, only OAuth tokens
4. **User control**: Users can revoke access anytime
5. **Selective connection**: Users choose which services to connect
6. **Secure storage**: All tokens encrypted in database

---

## Example User Journey

**Sarah (Product Manager):**
1. Signs up for Unified Focus Assistant
2. Connects HER Gmail account (@company.com)
3. Connects HER Slack workspace (company.slack.com)
4. Connects HER Notion workspace (where she manages tasks)
5. Skips Linear/Trello (doesn't use them)
6. Provides her own OpenAI key (company pays for it)

**Result**: Sarah sees HER emails, HER Slack messages, creates tasks in HER Notion - completely isolated from other users.

**Mike (Developer):**
1. Signs up separately
2. Connects HIS Gmail (@startup.io)
3. Connects HIS Linear workspace (for issue tracking)
4. Doesn't connect Notion (doesn't use it)
5. Uses app's OpenAI key with usage tracking

**Result**: Mike's data is completely separate from Sarah's. Different accounts, different integrations, different preferences.