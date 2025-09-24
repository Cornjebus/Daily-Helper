/**
 * TDD Test Suite for Phase 3: AI Processing
 * Tests OpenAI integration, email scoring, and database updates
 */

require('dotenv').config({ path: '.env.local' });
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const PREFERRED_MODEL = process.env.OPENAI_PREFERRED_MODEL || 'gpt-4o-mini';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Test utilities
const log = (test, result, details = '') => {
  const status = result ? '✅' : '❌';
  console.log(`${status} ${test}${details ? ': ' + details : ''}`);
  return result;
};

const tests = {
  // Test 1: Check environment variables
  async testEnvironment() {
    console.log('\n=== Testing Environment Variables ===');

    const hasOpenAIKey = log(
      'OpenAI API Key exists',
      !!process.env.OPENAI_API_KEY,
      process.env.OPENAI_API_KEY ? 'Key found' : 'Missing OPENAI_API_KEY'
    );

    const hasSupabaseUrl = log(
      'Supabase URL exists',
      !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'Missing'
    );

    const hasSupabaseKey = log(
      'Supabase Service Key exists',
      !!process.env.SUPABASE_SERVICE_KEY,
      process.env.SUPABASE_SERVICE_KEY ? 'Key found' : 'Missing'
    );

    return hasOpenAIKey && hasSupabaseUrl && hasSupabaseKey;
  },

  // Test 2: Test OpenAI connectivity with different models
  async testOpenAIModels() {
    console.log('\n=== Testing OpenAI Models ===');

    const models = [];
    // Try preferred first
    if (PREFERRED_MODEL.startsWith('gpt-5')) {
      models.push({ name: PREFERRED_MODEL, params: { max_completion_tokens: 100 } });
    } else {
      models.push({ name: PREFERRED_MODEL, params: { max_tokens: 100 } });
    }
    // Then fallbacks (per request): gpt-5-mini, then gpt-4o-mini
    if (PREFERRED_MODEL !== 'gpt-5-mini') models.push({ name: 'gpt-5-mini', params: { max_completion_tokens: 100 } });
    if (PREFERRED_MODEL !== 'gpt-4o-mini') models.push({ name: 'gpt-4o-mini', params: { max_tokens: 100 } });

    for (const model of models) {
      try {
        const response = await openai.chat.completions.create({
          model: model.name,
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Say "test" in one word' }
          ],
          ...model.params
        });

        log(
          `Model ${model.name}`,
          true,
          `Response: "${response.choices[0].message.content}"`
        );
      } catch (error) {
        log(
          `Model ${model.name}`,
          false,
          error.message
        );
      }
    }
  },

  // Test 3: Test email scoring with JSON response
  async testEmailScoring() {
    console.log('\n=== Testing Email Scoring ===');

    const testEmail = {
      subject: 'URGENT: Budget approval needed',
      from: 'boss@company.com',
      snippet: 'Please review and approve the Q4 budget by EOD today.',
      isImportant: true,
      isStarred: false,
      isUnread: true
    };

    const prompt = `Score this email's priority from 1 to 10.
From: ${testEmail.from}
Subject: ${testEmail.subject}
Preview: ${testEmail.snippet}
Flags: Important, Unread

Return a JSON object with:
- score: number between 1-10
- reasoning: brief explanation`;

    try {
      const isGpt5 = PREFERRED_MODEL.startsWith('gpt-5');
      const response = await openai.chat.completions.create({
        model: PREFERRED_MODEL,
        messages: [
          { role: 'system', content: 'You are an email prioritization assistant. Return JSON only.' },
          { role: 'user', content: prompt }
        ],
        ...(isGpt5 ? { max_completion_tokens: 100 } : { max_tokens: 100 }),
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      log(
        `Email scoring with ${PREFERRED_MODEL}`,
        result.score >= 1 && result.score <= 10,
        `Score: ${result.score}, Reasoning: ${result.reasoning}`
      );

      return result;
    } catch (error) {
      log('Email scoring', false, error.message);
      return null;
    }
  },

  // Test 4: Test Supabase connection and tables
  async testSupabaseConnection() {
    console.log('\n=== Testing Supabase Connection ===');

    try {
      // Test connection
      const { data: tables, error } = await supabase
        .from('emails')
        .select('id')
        .limit(1);

      log(
        'Supabase connection',
        !error,
        error ? error.message : 'Connected successfully'
      );

      // Check required tables
      const requiredTables = ['emails', 'feed_items', 'ai_usage', 'ai_budgets', 'email_ai_metadata'];

      for (const table of requiredTables) {
        const { error: tableError } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        log(
          `Table '${table}' exists`,
          !tableError,
          tableError ? tableError.message : 'Accessible'
        );
      }

      return !error;
    } catch (error) {
      log('Supabase connection', false, error.message);
      return false;
    }
  },

  // Test 5: Test feed_items column structure
  async testFeedItemsSchema() {
    console.log('\n=== Testing feed_items Schema ===');

    try {
      // Try to query with the column we're using
      const { data, error } = await supabase
        .from('feed_items')
        .select('id, external_id, source, priority, metadata')
        .limit(1);

      log(
        'feed_items has external_id column',
        !error,
        error ? error.message : 'Column exists'
      );

      // Try to insert a test item
      const testItem = {
        user_id: 'test-user-id',
        source: 'gmail',
        external_id: 'test-email-id',
        title: 'Test Email',
        content: 'Test content',
        priority: 5,
        category: 'next',
        metadata: { ai_processed: true }
      };

      const { error: insertError } = await supabase
        .from('feed_items')
        .insert(testItem);

      log(
        'Can insert into feed_items',
        !insertError,
        insertError ? insertError.message : 'Insert successful'
      );

      // Clean up test data
      if (!insertError) {
        await supabase
          .from('feed_items')
          .delete()
          .eq('external_id', 'test-email-id');
      }

      return !error && !insertError;
    } catch (error) {
      log('feed_items schema test', false, error.message);
      return false;
    }
  },

  // Test 6: Test complete AI processing flow
  async testCompleteFlow() {
    console.log('\n=== Testing Complete AI Processing Flow ===');

    try {
      // 1. Get a real email from database
      const { data: emails, error: emailError } = await supabase
        .from('emails')
        .select('*')
        .limit(1);

      if (emailError || !emails?.length) {
        log('Fetch test email', false, emailError?.message || 'No emails found');
        return false;
      }

      const email = emails[0];
      log('Fetch test email', true, `Testing with email: ${email.subject}`);

      // 2. Score the email
      const prompt = `Score this email's priority from 1 to 10.
Subject: ${email.subject || 'No subject'}
From: ${email.from_email || 'Unknown'}
Preview: ${email.snippet || 'No preview'}

Return JSON with score (1-10) and reasoning.`;

      const isGpt5 = PREFERRED_MODEL.startsWith('gpt-5');
      const { data: response } = await openai.chat.completions.create({
        model: PREFERRED_MODEL,
        messages: [
          { role: 'system', content: 'Return JSON only with score and reasoning fields.' },
          { role: 'user', content: prompt }
        ],
        ...(isGpt5 ? { max_completion_tokens: 100 } : { max_tokens: 100 }),
        response_format: { type: 'json_object' }
      }).then(r => ({ data: r })).catch(e => ({ error: e }));

      if (!response) {
        log('Score email with AI', false, 'API call failed');
        return false;
      }

      const result = JSON.parse(response.choices[0].message.content || '{}');
      log('Score email with AI', !!result.score, `Score: ${result.score}`);

      // 3. Update database
      const { error: updateError } = await supabase
        .from('emails')
        .update({ priority: result.score })
        .eq('id', email.id);

      log('Update email priority', !updateError, updateError?.message || 'Updated');

      // 4. Update/create feed_item
      const { error: feedError } = await supabase
        .from('feed_items')
        .upsert({
          user_id: email.user_id,
          source: 'gmail',
          external_id: email.id,
          title: email.subject || 'No Subject',
          content: email.snippet || '',
          priority: result.score,
          category: result.score >= 8 ? 'now' : result.score >= 5 ? 'next' : 'later',
          metadata: {
            ai_score: result.score,
            ai_processed: true,
            ai_model: PREFERRED_MODEL
          }
        }, {
          onConflict: 'external_id,source'
        });

      log('Update feed_items', !feedError, feedError?.message || 'Updated');

      return !updateError && !feedError;
    } catch (error) {
      log('Complete flow test', false, error.message);
      return false;
    }
  }
};

// Run all tests
async function runTests() {
  console.log('🧪 Starting TDD Tests for Phase 3: AI Processing\n');
  console.log('=' .repeat(50));

  const results = [];

  // Run tests in sequence
  results.push(await tests.testEnvironment());
  results.push(await tests.testOpenAIModels());
  results.push(await tests.testEmailScoring());
  results.push(await tests.testSupabaseConnection());
  results.push(await tests.testFeedItemsSchema());
  results.push(await tests.testCompleteFlow());

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary:');
  const passed = results.filter(r => r).length;
  const failed = results.length - passed;
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
    console.log('Common issues:');
    console.log('1. Missing OPENAI_API_KEY in .env.local');
    console.log('2. Invalid model name (gpt-5-nano may not exist)');
    console.log('3. Database schema mismatch');
    console.log('4. API parameter incompatibility');
  } else {
    console.log('\n🎉 All tests passed! AI processing should work correctly.');
  }
}

// Run the tests
runTests().catch(console.error);
