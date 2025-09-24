/**
 * Test script for the AI processing API endpoint
 * This script will make a direct request to test if the endpoint is working
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');
const http = require('http');

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function testAPIEndpoint() {
  console.log('🧪 Testing AI Processing API Endpoint');
  console.log('📍 Base URL:', BASE_URL);
  console.log('='.repeat(50));

  try {
    // Test POST request to /api/ai/process-emails
    console.log('📡 Making POST request to /api/ai/process-emails...');

    const response = await fetch(`${BASE_URL}/api/ai/process-emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response statusText:', response.statusText);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('📊 Raw response:', responseText);

    try {
      const responseJson = JSON.parse(responseText);
      console.log('📊 Parsed response:', JSON.stringify(responseJson, null, 2));

      if (response.ok) {
        console.log('✅ API endpoint is responding successfully!');
        if (responseJson.processed) {
          console.log(`📧 Processed ${responseJson.processed.scored} emails`);
          console.log(`💰 Budget used: ${responseJson.budget?.dailyUsed || 'N/A'}`);
        }
      } else {
        console.log('❌ API endpoint returned an error');
        console.log('🔍 Error details:', responseJson);
      }
    } catch (parseError) {
      console.log('❌ Failed to parse JSON response');
      console.log('🔍 Raw response text:', responseText);
    }

    // Also test GET request for stats
    console.log('\n📡 Making GET request to /api/ai/process-emails...');
    const getResponse = await fetch(`${BASE_URL}/api/ai/process-emails`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('📊 GET Response status:', getResponse.status);
    const getResponseText = await getResponse.text();

    try {
      const getResponseJson = JSON.parse(getResponseText);
      console.log('📊 GET Response:', JSON.stringify(getResponseJson, null, 2));
    } catch (parseError) {
      console.log('❌ Failed to parse GET JSON response');
      console.log('🔍 Raw GET response text:', getResponseText);
    }

  } catch (error) {
    console.error('❌ Network or request error:', error.message);
    console.error('🔍 Full error:', error);
  }
}

// Check if Next.js server is running
async function checkServerStatus() {
  try {
    const response = await fetch(`${BASE_URL}`, {
      method: 'GET',
      timeout: 5000,
    });

    if (response.ok) {
      console.log('✅ Next.js server is running');
      return true;
    } else {
      console.log('⚠️  Server responded with status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Server is not running or not accessible');
    console.log('💡 Make sure to run: npm run dev');
    return false;
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting API endpoint test');

  // First check if server is running
  const serverRunning = await checkServerStatus();

  if (!serverRunning) {
    console.log('\n❌ Cannot run tests - server is not accessible');
    console.log('💡 Please start the development server with: npm run dev');
    return;
  }

  console.log(''); // Add spacing

  // Run the API test
  await testAPIEndpoint();

  console.log('\n' + '='.repeat(50));
  console.log('🏁 Test completed');
  console.log('💡 Check the server console logs for detailed debugging info');
}

// Run the test
main().catch(console.error);