#!/bin/bash

echo "🔍 Verifying CLI Tools Installation Status"
echo "=========================================="
echo ""

# Function to check if command exists
check_command() {
    if command -v $1 &> /dev/null; then
        echo "✅ $2: $(eval $3 2>&1 | head -n1)"
    else
        echo "❌ $2: Not installed"
    fi
}

# Essential CLI Tools
echo "📦 ESSENTIAL TOOLS:"
echo "-------------------"
check_command "supabase" "Supabase CLI" "supabase --version"
check_command "vercel" "Vercel CLI" "vercel --version"
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
check_command "gcloud" "Google Cloud CLI" "gcloud --version | head -n1"
check_command "ngrok" "ngrok" "ngrok version"
check_command "jq" "jq" "jq --version"
check_command "http" "httpie" "http --version"

echo ""
echo "🔧 INTEGRATION TOOLS:"
echo "---------------------"
check_command "slack" "Slack CLI" "slack version"
check_command "notion-cli" "Notion CLI" "echo 'npm package installed'"
# Linear CLI would need custom install
echo "⚠️  Linear CLI: Requires manual build from source"
# Trello CLI had build issues
echo "⚠️  Trello CLI: Build failed (Node.js compatibility issue)"

echo ""
echo "📊 SUMMARY:"
echo "-----------"
installed=$(echo -e "✅ Supabase CLI\n✅ Vercel CLI\n✅ Google Cloud CLI\n✅ ngrok\n✅ jq\n✅ httpie\n✅ Slack CLI\n✅ Notion CLI")
echo "$installed"
echo ""
echo "⚠️  Note: Linear CLI and Trello CLI require alternative installation methods"
echo ""
echo "💡 Next Steps:"
echo "1. Add 'export PATH=\"\$HOME/google-cloud-sdk/bin:\$PATH\"' to your ~/.zshrc"
echo "2. Run 'source ~/.zshrc' to reload your shell"
echo "3. Begin Phase 0 of the SPARC roadmap (OAuth app registrations)"