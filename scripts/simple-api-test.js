/**
 * Simple API test using curl command
 * This will test if the AI processing endpoint is working
 */

require('dotenv').config({ path: '.env.local' });
const { exec } = require('child_process');

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function runCurlTest() {
  console.log('🧪 Testing AI Processing API Endpoint with curl');
  console.log('📍 Base URL:', BASE_URL);
  console.log('='.repeat(50));

  // Test POST request
  const postCommand = `curl -X POST "${BASE_URL}/api/ai/process-emails" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -w "\\n\\nHTTP Status: %{http_code}\\nTotal Time: %{time_total}s\\n" \
    -s --connect-timeout 10`;

  console.log('📡 Making POST request to /api/ai/process-emails...');
  console.log('🔧 Command:', postCommand);
  console.log('');

  exec(postCommand, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Error executing curl:', error.message);
      console.error('💡 Make sure Next.js server is running: npm run dev');
      return;
    }

    if (stderr) {
      console.error('⚠️  Curl stderr:', stderr);
    }

    console.log('📊 Response:');
    console.log(stdout);

    // Test GET request for stats
    console.log('\n' + '='.repeat(30));
    console.log('📡 Making GET request to /api/ai/process-emails...');

    const getCommand = `curl -X GET "${BASE_URL}/api/ai/process-emails" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json" \
      -w "\\n\\nHTTP Status: %{http_code}\\nTotal Time: %{time_total}s\\n" \
      -s --connect-timeout 10`;

    exec(getCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Error executing GET curl:', error.message);
        return;
      }

      if (stderr) {
        console.error('⚠️  GET Curl stderr:', stderr);
      }

      console.log('📊 GET Response:');
      console.log(stdout);

      console.log('\n' + '='.repeat(50));
      console.log('🏁 Test completed');
      console.log('💡 Check the Next.js server console for detailed logs');
    });
  });
}

// Test server availability first
function checkServer() {
  const testUrl = BASE_URL.replace('http://', '').replace('https://', '');
  const checkCommand = `curl -s --connect-timeout 5 "${BASE_URL}" -o /dev/null -w "%{http_code}"`;

  exec(checkCommand, (error, stdout, stderr) => {
    if (error) {
      console.log('❌ Server is not running or not accessible');
      console.log('💡 Make sure to run: npm run dev');
      return;
    }

    const httpCode = stdout.trim();
    if (httpCode === '200' || httpCode === '404') { // 404 is fine, means server is running
      console.log('✅ Server is accessible');
      runCurlTest();
    } else {
      console.log('⚠️  Server responded with status:', httpCode);
      console.log('💡 Continuing with test anyway...');
      runCurlTest();
    }
  });
}

// Main execution
console.log('🚀 Starting Simple API Test');
checkServer();