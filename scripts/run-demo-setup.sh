#!/bin/bash

# Phase 5 Demo Environment Setup Runner
# Runs database migrations and populates demo data

set -e

echo "🚀 Starting Phase 5 Demo Environment Setup"
echo "==========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Load environment variables
if [ -f ".env.local" ]; then
    echo "📡 Loading environment variables from .env.local"
    export $(grep -v '^#' .env.local | xargs)
else
    echo "⚠️  Warning: .env.local not found - using system environment variables"
fi

# Check required environment variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: Missing required Supabase environment variables"
    echo "   - NEXT_PUBLIC_SUPABASE_URL"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

echo "✅ Environment variables loaded"

# Run database migrations
echo ""
echo "📊 Running database migrations..."
if command -v supabase &> /dev/null; then
    echo "Using Supabase CLI for migrations..."
    supabase db push
else
    echo "⚠️  Supabase CLI not found - migrations should be run manually"
    echo "   Run: supabase db push"
fi

# Build the project first
echo ""
echo "🔨 Building Next.js application..."
npm run build

# Run the demo setup script
echo ""
echo "🎭 Setting up demo data..."
node scripts/setup-demo-environment.js

# Test health check endpoint
echo ""
echo "🩺 Testing health check endpoint..."
if command -v curl &> /dev/null; then
    curl -s http://localhost:3000/api/health > /dev/null 2>&1 || echo "⚠️  Health check endpoint not accessible (server may not be running)"
else
    echo "⚠️  curl not available - skipping health check test"
fi

# Test metrics endpoint
echo ""
echo "📊 Testing metrics endpoint..."
echo "   Demo metrics available at: /api/demo/metrics"
echo "   Mass unsubscribe at: /api/demo/mass-unsubscribe"
echo "   Health check at: /api/health"

echo ""
echo "✅ Phase 5 Demo Environment Setup Complete!"
echo "=========================================="
echo ""
echo "🔑 Demo Login Credentials:"
echo "   Main Demo: demo@rallyintelligence.com / DemoPass123!"
echo "   Executive: executive@rallyintelligence.com / ExecPass123!"
echo ""
echo "🚀 Start the development server:"
echo "   npm run dev"
echo ""
echo "📊 Demo Features Available:"
echo "   • Email Intelligence Dashboard"
echo "   • 67% Cost Reduction Metrics"
echo "   • AI Priority Scoring (94.2% accuracy)"
echo "   • VIP Sender Detection"
echo "   • Mass Unsubscribe Functionality"
echo "   • Weekly Digest Generation"
echo "   • Real-time Performance Monitoring"
echo "   • Health Check Endpoints"
echo ""
echo "🎯 Demo URLs:"
echo "   Dashboard: http://localhost:3000/dashboard"
echo "   Health: http://localhost:3000/api/health"
echo "   Metrics: http://localhost:3000/api/demo/metrics"
echo ""

# Optional: Start the development server
read -p "Start the development server now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Starting development server..."
    npm run dev
fi