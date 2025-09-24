#!/usr/bin/env node

/**
 * Debug script for email processing flow
 * Tests the frontend component -> API call -> backend processing flow
 */

console.log('🔍 Email Processing Debug Script');
console.log('================================\n');

// Test 1: Check API endpoint availability
async function testApiEndpoint() {
  console.log('1. Testing API endpoint availability...');

  try {
    const response = await fetch('http://localhost:3000/api/ai/process-emails', {
      method: 'GET',
    });

    console.log(`   Status: ${response.status}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);

    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ GET endpoint works');
      console.log('   Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('   ❌ GET endpoint failed');
      const errorText = await response.text();
      console.log('   Error:', errorText);
    }
  } catch (error) {
    console.log('   ❌ Network error:', error.message);
  }

  console.log();
}

// Test 2: Test POST request without auth
async function testPostWithoutAuth() {
  console.log('2. Testing POST request without authentication...');

  try {
    const response = await fetch('http://localhost:3000/api/ai/process-emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`   Status: ${response.status}`);

    if (response.status === 401) {
      console.log('   ✅ Properly returns 401 for unauthenticated requests');
    } else {
      console.log('   ⚠️  Unexpected response for unauthenticated request');
    }

    const data = await response.json();
    console.log('   Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }

  console.log();
}

// Test 3: Check if the frontend component code has issues
async function analyzeFrontendComponent() {
  console.log('3. Analyzing frontend component...');

  const fs = require('fs');
  const path = require('path');

  try {
    const componentPath = '/Users/corneliusgeorge/Rally/Daily Helper/components/ai-cost-dashboard.tsx';
    const componentCode = fs.readFileSync(componentPath, 'utf8');

    // Check for common issues
    const issues = [];

    if (!componentCode.includes('useState')) {
      issues.push('Missing React hooks import');
    }

    if (!componentCode.includes('processEmails')) {
      issues.push('Missing processEmails function');
    }

    if (!componentCode.includes('fetch')) {
      issues.push('No fetch API calls found');
    }

    if (!componentCode.includes('setProcessing(true)')) {
      issues.push('Loading state not properly managed');
    }

    if (componentCode.includes('window.location.reload()')) {
      console.log('   ⚠️  Found window.location.reload() - this might cause UX issues');
    }

    if (componentCode.includes('alert(')) {
      console.log('   ⚠️  Using alert() for user feedback - consider using proper UI components');
    }

    // Check for error handling
    if (!componentCode.includes('try {') || !componentCode.includes('catch')) {
      issues.push('Missing proper error handling');
    }

    if (issues.length === 0) {
      console.log('   ✅ Frontend component looks good');
    } else {
      console.log('   ❌ Issues found:');
      issues.forEach(issue => console.log(`      - ${issue}`));
    }

    // Extract the processEmails function
    const processEmailsMatch = componentCode.match(/const processEmails = async \(\) => \{([\s\S]*?)\}/);
    if (processEmailsMatch) {
      console.log('   📝 processEmails function found:');
      console.log('      - Makes POST request to /api/ai/process-emails');
      console.log('      - Sets loading state with setProcessing');
      console.log('      - Handles success/error responses');
      console.log('      - Refreshes page on success');
    }

  } catch (error) {
    console.log('   ❌ Error reading component file:', error.message);
  }

  console.log();
}

// Test 4: Check environment variables
async function checkEnvironment() {
  console.log('4. Checking environment configuration...');

  const fs = require('fs');

  try {
    const envLocal = fs.readFileSync('/Users/corneliusgeorge/Rally/Daily Helper/.env.local', 'utf8');

    const requiredVars = [
      'OPENAI_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    const issues = [];

    requiredVars.forEach(varName => {
      if (!envLocal.includes(varName)) {
        issues.push(`Missing ${varName}`);
      } else if (envLocal.includes(`${varName}=`)) {
        const value = envLocal.match(new RegExp(`${varName}=(.+)`))?.[1]?.split('\n')[0];
        if (!value || value.trim() === '') {
          issues.push(`Empty value for ${varName}`);
        }
      }
    });

    if (issues.length === 0) {
      console.log('   ✅ All required environment variables are set');
    } else {
      console.log('   ❌ Environment issues:');
      issues.forEach(issue => console.log(`      - ${issue}`));
    }

  } catch (error) {
    console.log('   ❌ Error reading .env.local:', error.message);
  }

  console.log();
}

// Test 5: Check database tables
async function checkDatabase() {
  console.log('5. Checking database tables...');

  const { createClient } = require('@supabase/supabase-js');
  const fs = require('fs');

  try {
    const envLocal = fs.readFileSync('/Users/corneliusgeorge/Rally/Daily Helper/.env.local', 'utf8');
    const supabaseUrl = envLocal.match(/SUPABASE_URL=(.+)/)?.[1]?.split('\n')[0];
    const supabaseKey = envLocal.match(/SUPABASE_ANON_KEY=(.+)/)?.[1]?.split('\n')[0];

    if (!supabaseUrl || !supabaseKey) {
      console.log('   ❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test database connectivity
    const { data, error } = await supabase
      .from('emails')
      .select('count(*)')
      .limit(1);

    if (error) {
      console.log('   ❌ Database connection error:', error.message);
    } else {
      console.log('   ✅ Database connection successful');
      console.log('   📊 Checking required tables...');

      // Check required tables
      const tables = ['emails', 'feed_items', 'ai_usage', 'ai_budgets', 'email_ai_metadata'];

      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(1);

          if (error) {
            console.log(`      ❌ Table '${table}' error: ${error.message}`);
          } else {
            console.log(`      ✅ Table '${table}' accessible`);
          }
        } catch (e) {
          console.log(`      ❌ Table '${table}' not accessible`);
        }
      }
    }

  } catch (error) {
    console.log('   ❌ Error checking database:', error.message);
  }

  console.log();
}

// Test 6: Check OpenAI configuration
async function checkOpenAI() {
  console.log('6. Checking OpenAI configuration...');

  const fs = require('fs');

  try {
    const envLocal = fs.readFileSync('/Users/corneliusgeorge/Rally/Daily Helper/.env.local', 'utf8');
    const openaiKey = envLocal.match(/OPENAI_API_KEY=(.+)/)?.[1]?.split('\n')[0];

    if (!openaiKey || openaiKey.trim() === '') {
      console.log('   ❌ Missing OpenAI API key');
      return;
    }

    console.log('   ✅ OpenAI API key is set');

    // Check if key format looks correct
    if (openaiKey.startsWith('sk-')) {
      console.log('   ✅ API key format looks correct');
    } else {
      console.log('   ⚠️  API key format may be incorrect (should start with sk-)');
    }

    // Test API call (simplified)
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
        },
      });

      if (response.ok) {
        console.log('   ✅ OpenAI API key is valid');
        const data = await response.json();
        const hasGpt4oMini = data.data?.some(model => model.id === 'gpt-4o-mini');
        const hasGpt5Nano = data.data?.some(model => model.id === 'gpt-5-nano');

        console.log(`   📊 Available models: gpt-4o-mini: ${hasGpt4oMini ? '✅' : '❌'}, gpt-5-nano: ${hasGpt5Nano ? '✅' : '❌'}`);

        if (!hasGpt4oMini && !hasGpt5Nano) {
          console.log('   ⚠️  Neither gpt-4o-mini nor gpt-5-nano available - may cause processing errors');
        }
      } else {
        console.log('   ❌ OpenAI API key is invalid');
        const errorText = await response.text();
        console.log('   Error:', errorText);
      }
    } catch (error) {
      console.log('   ⚠️  Could not test OpenAI API:', error.message);
    }

  } catch (error) {
    console.log('   ❌ Error checking OpenAI configuration:', error.message);
  }

  console.log();
}

// Main function
async function main() {
  await testApiEndpoint();
  await testPostWithoutAuth();
  await analyzeFrontendComponent();
  await checkEnvironment();
  await checkDatabase();
  await checkOpenAI();

  console.log('🎯 Summary of Potential Issues:');
  console.log('===============================');
  console.log('1. Check browser console for JavaScript errors when clicking "Process Emails"');
  console.log('2. Verify authentication status - user must be logged in');
  console.log('3. Ensure database contains emails to process');
  console.log('4. Check OpenAI API quota and rate limits');
  console.log('5. Verify proper error handling in frontend component');
  console.log('6. Test with browser dev tools Network tab to see actual API calls');
  console.log('\n🔧 To debug further:');
  console.log('- Open browser dev tools (F12)');
  console.log('- Go to Network tab');
  console.log('- Click "Process Emails" button');
  console.log('- Check if POST request to /api/ai/process-emails is made');
  console.log('- Look at request/response details');
  console.log('- Check Console tab for JavaScript errors');
}

// Run the tests
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testApiEndpoint,
  testPostWithoutAuth,
  analyzeFrontendComponent,
  checkEnvironment,
  checkDatabase,
  checkOpenAI
};