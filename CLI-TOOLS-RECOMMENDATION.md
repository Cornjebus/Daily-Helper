# CLI Tools Recommendation for Unified Focus Assistant
## Essential Command-Line Tools for Development & Integration

---

## 🚀 MUST-HAVE CLI Tools (Priority 1)

### 1. **Supabase CLI** ✅ ESSENTIAL
```bash
npm install -g supabase
```
- **Why**: Core backend infrastructure
- **Use for**: Database migrations, local development, auth setup, RLS policies
- **Key Commands**:
  - `supabase init` - Initialize project
  - `supabase start` - Start local development
  - `supabase db push` - Push migrations
  - `supabase gen types` - Generate TypeScript types from schema

### 2. **Vercel CLI** ✅ ESSENTIAL
```bash
npm install -g vercel
```
- **Why**: Deployment and serverless functions
- **Use for**: Deploy, preview deployments, environment variables, logs
- **Key Commands**:
  - `vercel dev` - Local development with serverless functions
  - `vercel env pull` - Sync environment variables
  - `vercel deploy --prod` - Deploy to production

### 3. **Google Cloud CLI (gcloud)** ✅ ESSENTIAL
```bash
# Install from cloud.google.com/sdk
```
- **Why**: Required for Gmail & Calendar OAuth setup
- **Use for**: Creating OAuth credentials, enabling APIs
- **Key Commands**:
  - `gcloud auth login`
  - `gcloud projects create`
  - `gcloud services enable gmail.googleapis.com`

---

## 🛠️ RECOMMENDED Integration CLIs (Priority 2)

### 4. **Slack CLI** 📦 RECOMMENDED
```bash
# Download from api.slack.com/automation/cli/install
curl -fsSL https://downloads.slack-edge.com/slack-cli/install.sh | bash
```
- **Why**: Easier Slack app development and testing
- **Use for**: Creating Slack apps, testing bot functionality
- **Key Commands**:
  - `slack create` - Create new Slack app
  - `slack run` - Test locally
  - `slack deploy` - Deploy to Slack platform

### 5. **Notion CLI (Community)** 📦 OPTIONAL
```bash
pip install notion-cli
# OR
npm install -g @litencatt/notion-cli
```
- **Why**: Testing Notion API integration
- **Use for**: Quick testing of Notion API calls
- **Note**: Not official, but helpful for development

### 6. **Linear CLI** 📦 OPTIONAL
```bash
go install github.com/evangodon/linear-cli@latest
```
- **Why**: Testing Linear integration
- **Use for**: Quick issue creation and testing

### 7. **Trello CLI** 📦 OPTIONAL
```bash
npm install -g trello-cli
```
- **Why**: Testing Trello API
- **Use for**: Card creation testing, board management

---

## 🔧 Development Workflow CLIs (Priority 1)

### 8. **ngrok** ✅ ESSENTIAL
```bash
brew install ngrok # macOS
# OR download from ngrok.com
```
- **Why**: Testing webhooks locally (Slack, Calendly events)
- **Use for**: Exposing local server for OAuth callbacks
- **Key Commands**:
  - `ngrok http 3000` - Expose localhost:3000

### 9. **httpie** ✅ RECOMMENDED
```bash
brew install httpie # macOS
pip install httpie # Python
```
- **Why**: Testing API endpoints
- **Use for**: Quick API testing with better syntax than curl
- **Example**: `http GET api.notion.com/v1/databases Authorization:"Bearer $TOKEN"`

### 10. **jq** ✅ ESSENTIAL
```bash
brew install jq # macOS
```
- **Why**: Parse JSON responses from APIs
- **Use for**: Processing API responses in scripts
- **Example**: `curl api.openai.com | jq '.usage.total_tokens'`

---

## 📋 Implementation Order

### Phase 0 Setup:
1. ✅ Install **Supabase CLI** first
2. ✅ Install **Vercel CLI**
3. ✅ Install **gcloud CLI**
4. ✅ Install **ngrok** for webhook testing
5. ✅ Install **jq** for JSON parsing

### During Development:
6. Install **Slack CLI** when implementing Slack (Phase 5)
7. Install service-specific CLIs as needed

---

## 🎯 Quick Setup Script

Create a `setup-cli-tools.sh`:

```bash
#!/bin/bash

echo "🚀 Installing Essential CLI Tools for Unified Focus Assistant"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required. Please install Node.js first."
    exit 1
fi

# Install npm-based tools
echo "📦 Installing Supabase CLI..."
npm install -g supabase

echo "📦 Installing Vercel CLI..."
npm install -g vercel

echo "📦 Installing Trello CLI..."
npm install -g trello-cli

# Check if homebrew is installed (macOS)
if command -v brew &> /dev/null; then
    echo "📦 Installing ngrok..."
    brew install ngrok

    echo "📦 Installing httpie..."
    brew install httpie

    echo "📦 Installing jq..."
    brew install jq
else
    echo "⚠️  Homebrew not found. Please install ngrok, httpie, and jq manually."
fi

echo "✅ Essential tools installed!"
echo ""
echo "📌 Manual installations required:"
echo "1. Google Cloud CLI: https://cloud.google.com/sdk/docs/install"
echo "2. Slack CLI: https://api.slack.com/automation/cli/install"
echo ""
echo "Run 'supabase --version' and 'vercel --version' to verify installation."
```

---

## 💡 Pro Tips

1. **Use Supabase CLI for all database work** - Don't modify production DB directly
2. **Vercel CLI for environment variables** - Use `vercel env pull` to sync
3. **ngrok for all webhook testing** - Essential for Slack/Calendly webhooks
4. **Create aliases** for common commands:
   ```bash
   alias sp="supabase"
   alias v="vercel"
   alias sdb="supabase db"
   ```

5. **Use VS Code extensions** alongside CLIs:
   - Supabase extension
   - Vercel extension
   - Thunder Client (API testing)

---

## ⚠️ Avoid These

- **Don't use unofficial OpenAI CLIs** - Use the SDK directly
- **Don't rely on web-based tools** for local development
- **Don't skip ngrok** - You'll need it for OAuth callbacks

---

## Summary

**Absolute Minimum**:
- Supabase CLI
- Vercel CLI
- gcloud CLI
- ngrok
- jq

**Nice to Have**:
- Slack CLI (when building Slack features)
- Service-specific CLIs as needed

These tools will dramatically speed up your development workflow and make testing integrations much easier!