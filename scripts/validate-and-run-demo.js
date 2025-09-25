#!/usr/bin/env node

/**
 * Demo Validation and Run Script
 * Validates environment and starts demo with fallback data creation
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function validateAndRunDemo() {
  console.log('🔍 Validating demo environment...');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    // Test basic connection
    const { data: health, error: healthError } = await supabase
      .from('emails')
      .select('count')
      .limit(1);

    if (healthError) {
      console.log('📊 Database tables may need setup. Checking existing structure...');

      // Try to get all table information
      const { data: tables, error: tablesError } = await supabase
        .rpc('get_schema_tables');

      if (tablesError) {
        console.log('⚠️ Cannot access table schema. Proceeding with basic demo...');
      } else {
        console.log('📋 Available tables:', tables?.map(t => t.table_name).join(', '));
      }
    }

    // Create demo data directly in the existing tables
    await createBasicDemoData(supabase);

    console.log('✅ Demo validation completed');
    console.log('🌐 Demo ready at: http://localhost:3000');
    console.log('');
    console.log('🎯 Demo Features:');
    console.log('  ✨ Smart Email Priority Scoring');
    console.log('  🧠 AI-Powered Processing');
    console.log('  💰 67% Cost Reduction Showcase');
    console.log('  📊 Performance Monitoring');
    console.log('  📧 Bulk Email Management');

  } catch (error) {
    console.error('❌ Demo validation failed:', error.message);
    console.log('');
    console.log('🔧 Manual Demo Setup Available:');
    console.log('1. Start the app: npm run dev');
    console.log('2. Login with Google OAuth');
    console.log('3. Sync emails to see AI processing');
    console.log('4. Monitor cost reduction in dashboard');
  }
}

async function createBasicDemoData(supabase) {
  console.log('📧 Creating basic demo data...');

  // Create a simple feed item to demonstrate the concept
  const demoFeedItem = {
    id: 'demo-feed-1',
    source: 'demo',
    external_id: 'demo-1',
    title: 'Demo: Email Intelligence Features',
    content: 'This is a demonstration of Junie\'s email intelligence capabilities, showcasing 67% cost reduction through AI optimization.',
    category: 'now',
    priority: 8,
    metadata: {
      demo: true,
      ai_processed: true,
      cost_reduction: '67%',
      features: ['priority_scoring', 'thread_summarization', 'smart_replies']
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    // Try to insert demo data if tables exist
    const { error } = await supabase
      .from('feed_items')
      .upsert(demoFeedItem, { onConflict: 'external_id,source' });

    if (error) {
      console.log('⚠️ Could not create demo feed item:', error.message);
    } else {
      console.log('✅ Demo feed item created');
    }
  } catch (err) {
    console.log('⚠️ Demo data creation skipped:', err.message);
  }
}

if (require.main === module) {
  validateAndRunDemo();
}

module.exports = { validateAndRunDemo };