# 🔗 Quick Setup Links - Open These Now!

## Priority 1: Complete These First

### 1. Google OAuth Setup
**Your Project Console:**
```bash
open "https://console.cloud.google.com/apis/credentials?project=unified-focus-assistant-24"
```

**Steps:**
1. Click "Configure Consent Screen"
2. Choose "External" user type
3. Fill in app info
4. Add scopes: gmail.readonly, calendar.readonly
5. Create OAuth 2.0 Client ID
6. Add redirect URI: `http://localhost:3000/api/auth/callback/google`
7. Copy Client ID and Secret to `.env.local`

### 2. OpenAI API Key
```bash
open "https://platform.openai.com/api-keys"
```
- Create new secret key
- Copy immediately to `.env.local`

### 3. Slack App
```bash
open "https://api.slack.com/apps"
```
- Create New App > From scratch
- Name: Unified Focus Assistant
- Get credentials from Basic Information

---

## Your Project Links

### Supabase Dashboard
```bash
open "https://supabase.com/dashboard/project/bfvmawxtremndtlqhdpv"
```

### GitHub Repository
```bash
open "https://github.com/Cornjebus/Daily-Helper"
```

---

## Test Your Setup
```bash
cd "/Users/corneliusgeorge/Rally/Daily Helper"
node test-connections.js
```

---

## Start Development (After OAuth Setup)
```bash
# When you're ready to start Phase 1
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir
```