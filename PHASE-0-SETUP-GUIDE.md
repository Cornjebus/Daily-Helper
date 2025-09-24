# Phase 0: OAuth Applications Setup Guide
## Step-by-Step Instructions for Each Service

---

## 🚀 Quick Start Checklist

- [ ] 1. Supabase project created
- [ ] 2. Google Cloud project & OAuth configured
- [ ] 3. Slack app created
- [ ] 4. Notion public integration registered
- [ ] 5. Linear OAuth app created
- [ ] 6. Trello app registered
- [ ] 7. Calendly OAuth configured
- [ ] 8. OpenAI API key obtained
- [ ] 9. All credentials added to .env.local
- [ ] 10. Database schema created

---

## 1️⃣ Supabase Setup

### Steps:
1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create a new organization if needed
4. Click "New project"
5. Fill in:
   - Project name: `unified-focus-assistant`
   - Database password: (save this securely!)
   - Region: Choose closest to you
   - Pricing plan: Free tier is fine to start

### Get your credentials:
1. Go to Settings > API
2. Copy these values to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_PROJECT_REF].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon public key]
   SUPABASE_SERVICE_KEY=[service_role secret key]
   ```

---

## 2️⃣ Google OAuth Setup (Gmail & Calendar)

### Steps:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable APIs:
   ```bash
   # Using gcloud CLI:
   export PATH="$HOME/google-cloud-sdk/bin:$PATH"
   gcloud services enable gmail.googleapis.com
   gcloud services enable calendar-json.googleapis.com
   ```
   Or manually: APIs & Services > Enable APIs > Search for "Gmail API" and "Google Calendar API"

4. Create OAuth credentials:
   - Go to APIs & Services > Credentials
   - Click "Create Credentials" > OAuth client ID
   - Configure consent screen first:
     - User type: External
     - App name: Unified Focus Assistant
     - User support email: your email
     - Scopes: Add these:
       - `https://www.googleapis.com/auth/gmail.readonly`
       - `https://www.googleapis.com/auth/calendar.readonly`
       - `https://www.googleapis.com/auth/userinfo.email`

5. Create OAuth client:
   - Application type: Web application
   - Name: Unified Focus Assistant Web
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://your-app.vercel.app/api/auth/callback/google` (for production)

6. Copy credentials to `.env.local`

---

## 3️⃣ Slack App Setup

### Steps:
1. Go to [Slack API](https://api.slack.com/apps)
2. Click "Create New App" > From scratch
3. App name: `Unified Focus Assistant`
4. Pick a workspace for development

### Configure OAuth:
1. Go to OAuth & Permissions
2. Add Redirect URLs:
   - `http://localhost:3000/api/auth/callback/slack`
3. Add Bot Token Scopes:
   - `channels:history`
   - `channels:read`
   - `chat:write`
   - `im:history`
   - `im:read`
   - `users:read`
   - `users:read.email`

### Get credentials:
1. Basic Information > App Credentials
2. Copy to `.env.local`:
   ```
   SLACK_CLIENT_ID=[Client ID]
   SLACK_CLIENT_SECRET=[Client Secret]
   SLACK_SIGNING_SECRET=[Signing Secret]
   ```

---

## 4️⃣ Notion Integration Setup

### Steps:
1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Fill in:
   - Name: Unified Focus Assistant
   - Type: Public integration
   - Associated workspace: Your workspace

### Configure OAuth:
1. Go to "Capabilities" tab
2. Enable the capabilities you need:
   - Read content
   - Update content
   - Insert content
3. Add Redirect URI:
   - `http://localhost:3000/api/auth/callback/notion`

### Get credentials:
1. Go to "Secrets" tab
2. Copy to `.env.local`:
   ```
   NOTION_OAUTH_CLIENT_ID=[OAuth client ID]
   NOTION_OAUTH_CLIENT_SECRET=[OAuth client secret]
   ```

---

## 5️⃣ Linear OAuth Setup

### Steps:
1. Go to [Linear Settings](https://linear.app/settings/api/applications)
2. Click "Create new"
3. Fill in:
   - Application name: Unified Focus Assistant
   - Description: AI-powered productivity assistant
   - Callback URLs:
     - `http://localhost:3000/api/auth/callback/linear`

### Get credentials:
Copy to `.env.local`:
```
LINEAR_OAUTH_CLIENT_ID=[Client ID]
LINEAR_OAUTH_CLIENT_SECRET=[Client Secret]
```

---

## 6️⃣ Trello App Setup

### Steps:
1. Go to [Trello Power-Ups Admin](https://trello.com/power-ups/admin)
2. Click "Create New Power-Up"
3. Fill in:
   - Name: Unified Focus Assistant
   - Workspace: Your workspace
   - Iframe connector URL: `http://localhost:3000`

### Get API Key:
1. Go to [Trello App Key](https://trello.com/app-key)
2. Copy to `.env.local`:
   ```
   TRELLO_API_KEY=[Key]
   TRELLO_API_SECRET=[Secret]
   ```

---

## 7️⃣ Calendly OAuth Setup

### Steps:
1. Go to [Calendly Developers](https://developer.calendly.com/)
2. Register your application
3. Add redirect URI:
   - `http://localhost:3000/api/auth/callback/calendly`

### Get credentials:
Copy to `.env.local`:
```
CALENDLY_CLIENT_ID=[Client ID]
CALENDLY_CLIENT_SECRET=[Client Secret]
```

---

## 8️⃣ OpenAI API Key

### Steps:
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Name: `unified-focus-assistant`
4. Copy immediately (won't show again!)

Add to `.env.local`:
```
OPENAI_API_KEY=[Your API key]
```

---

## 9️⃣ Generate NextAuth Secret

Run this command to generate a secure secret:
```bash
openssl rand -base64 32
```

Add to `.env.local`:
```
NEXTAUTH_SECRET=[Generated secret]
```

---

## 🗄️ Database Schema Setup

After setting up Supabase, create the schema:

```sql
-- Run this in Supabase SQL Editor

-- User integrations table
CREATE TABLE user_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  workspace_id TEXT,
  additional_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, service)
);

-- Feed items table
CREATE TABLE feed_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  external_id TEXT,
  title TEXT,
  content TEXT,
  summary TEXT,
  priority INTEGER DEFAULT 5,
  category TEXT, -- 'now', 'next', 'later'
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- AI usage tracking
CREATE TABLE ai_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost DECIMAL(10, 6),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own integrations" ON user_integrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations" ON user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations" ON user_integrations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations" ON user_integrations
  FOR DELETE USING (auth.uid() = user_id);

-- Similar policies for other tables
CREATE POLICY "Users can manage own feed items" ON feed_items
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own AI usage" ON ai_usage
  FOR SELECT USING (auth.uid() = user_id);
```

---

## ✅ Verification Script

Create `test-connections.js`:

```javascript
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Checking environment variables...\n');

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'GOOGLE_CLIENT_ID',
  'SLACK_CLIENT_ID',
  'OPENAI_API_KEY'
];

const missing = [];
required.forEach(key => {
  if (process.env[key]) {
    console.log(`✅ ${key}: Set`);
  } else {
    console.log(`❌ ${key}: Missing`);
    missing.push(key);
  }
});

if (missing.length > 0) {
  console.log('\n⚠️  Missing required variables:', missing.join(', '));
} else {
  console.log('\n🎉 All required variables are set!');
}
```

---

## 🎯 Next Steps

Once all credentials are set up:

1. Commit your `.env.example` (but NEVER `.env.local`!)
2. Test Supabase connection: `supabase status`
3. Move to Phase 1: Initialize Next.js project
4. Start building OAuth flows

---

## 🔒 Security Reminders

- **NEVER** commit `.env.local` to Git
- Add `.env.local` to `.gitignore`
- Use different credentials for production
- Rotate keys regularly
- Use Vercel's environment variables for production