require('dotenv').config({ path: '.env.local' });

console.log('🔍 Verifying Phase 0 Setup...\n');
console.log('=' . repeat(50));

// Check Supabase credentials
console.log('\n📦 SUPABASE:');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseService = process.env.SUPABASE_SERVICE_KEY;

if (supabaseUrl && supabaseUrl.includes('supabase.co')) {
  console.log('✅ URL:', supabaseUrl);
  console.log('✅ Anon Key:', supabaseAnon ? 'Set (length: ' + supabaseAnon.length + ')' : '❌ Missing');
  console.log('✅ Service Key:', supabaseService ? 'Set (length: ' + supabaseService.length + ')' : '❌ Missing');
} else {
  console.log('❌ Supabase not configured');
}

// Check Google OAuth
console.log('\n🔐 GOOGLE OAUTH:');
const googleClient = process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET;

if (googleClient && !googleClient.includes('your_')) {
  console.log('✅ Client ID:', googleClient.substring(0, 20) + '...');
  console.log('✅ Client Secret:', googleSecret ? 'Set' : '❌ Missing');
} else {
  console.log('⏳ Not configured yet (manual setup required)');
  console.log('   Visit: https://console.cloud.google.com/apis/credentials?project=unified-focus-assistant-24');
}

// Check Slack OAuth
console.log('\n💬 SLACK OAUTH:');
const slackClient = process.env.SLACK_CLIENT_ID;
if (slackClient && !slackClient.includes('your_')) {
  console.log('✅ Configured');
} else {
  console.log('⏳ Not configured yet (manual setup required)');
  console.log('   Visit: https://api.slack.com/apps');
}

// Check OpenAI
console.log('\n🤖 OPENAI:');
const openaiKey = process.env.OPENAI_API_KEY;
if (openaiKey && !openaiKey.includes('your_')) {
  console.log('✅ API Key set');
} else {
  console.log('⏳ Not configured yet (manual setup required)');
  console.log('   Visit: https://platform.openai.com/api-keys');
}

// Check NextAuth
console.log('\n🔒 NEXTAUTH:');
const nextAuthSecret = process.env.NEXTAUTH_SECRET;
if (nextAuthSecret && !nextAuthSecret.includes('generate_')) {
  console.log('✅ Secret configured (length: ' + nextAuthSecret.length + ')');
} else {
  console.log('❌ Secret not configured');
}

// Summary
console.log('\n' + '=' . repeat(50));
console.log('\n📊 SUMMARY:\n');

const checks = {
  'Supabase': supabaseUrl && supabaseUrl.includes('supabase.co'),
  'NextAuth Secret': nextAuthSecret && !nextAuthSecret.includes('generate_'),
  'Google OAuth': googleClient && !googleClient.includes('your_'),
  'Slack OAuth': slackClient && !slackClient.includes('your_'),
  'OpenAI': openaiKey && !openaiKey.includes('your_')
};

let ready = 0;
let pending = 0;

for (const [service, isConfigured] of Object.entries(checks)) {
  if (isConfigured) {
    console.log(`✅ ${service}`);
    ready++;
  } else {
    console.log(`⏳ ${service}`);
    pending++;
  }
}

console.log(`\n📈 Progress: ${ready}/5 services configured`);

if (ready >= 2) {
  console.log('\n🎉 Core setup complete! You can start development.');
  console.log('   Complete the remaining OAuth setups when needed.');
} else {
  console.log('\n⚠️  Complete the manual OAuth setups to continue.');
}

console.log('\n' + '=' . repeat(50));