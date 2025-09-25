#!/usr/bin/env node

/**
 * Comprehensive System Integration and Performance Validation
 * Production Readiness Testing Suite
 */

const { createClient } = require('@supabase/supabase-js')
const { OpenAI } = require('openai')
const { google } = require('googleapis')
const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

console.log('\n🚀 COMPREHENSIVE SYSTEM VALIDATION - SPARC COMPLETION TEST')
console.log('=========================================================\n')

let testResults = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  warnings: 0,
  criticalErrors: [],
  recommendations: []
}

function logTest(name, passed, details = '', warning = false) {
  testResults.totalTests++
  if (passed) {
    testResults.passedTests++
    console.log(`✅ ${name}${details ? ': ' + details : ''}`)
  } else {
    if (warning) {
      testResults.warnings++
      console.log(`⚠️  ${name}${details ? ': ' + details : ''}`)
    } else {
      testResults.failedTests++
      testResults.criticalErrors.push(name)
      console.log(`❌ ${name}${details ? ': ' + details : ''}`)
    }
  }
}

function addRecommendation(rec) {
  testResults.recommendations.push(rec)
}

async function testDatabaseConnectivity() {
  console.log('\n📊 DATABASE CONNECTIVITY & SCHEMA VALIDATION')
  console.log('============================================')

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // Test basic connectivity
    const startTime = Date.now()
    const { data, error } = await supabase.from('emails').select('count').limit(1)
    const responseTime = Date.now() - startTime

    logTest('Database connectivity', !error, `Response time: ${responseTime}ms`)

    if (responseTime > 1000) {
      addRecommendation('Database response time is slow. Consider connection pooling optimization.')
    }

    // Test schema integrity
    const tables = ['emails', 'feed_items', 'email_scores', 'email_patterns', 'user_scoring_preferences']
    for (const table of tables) {
      try {
        const { error: schemaError } = await supabase.from(table).select('*').limit(1)
        logTest(`Schema validation: ${table}`, !schemaError)
      } catch (e) {
        logTest(`Schema validation: ${table}`, false, e.message)
      }
    }

    // Test write operations
    const testId = `system-test-${Date.now()}`
    const { error: writeError } = await supabase.from('feed_items').insert({
      user_id: testId,
      source: 'system-test',
      external_id: testId,
      title: 'System Test',
      content: 'Testing write operations',
      category: 'test',
      priority: 1
    })

    logTest('Database write operations', !writeError)

    if (!writeError) {
      // Cleanup
      await supabase.from('feed_items').delete().eq('external_id', testId)
    }

  } catch (error) {
    logTest('Database setup', false, error.message)
  }
}

async function testAIProcessingPipeline() {
  console.log('\n🤖 AI PROCESSING PIPELINE VALIDATION')
  console.log('===================================')

  try {
    // Test OpenAI API connectivity
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    const startTime = Date.now()
    const testCompletion = await openai.chat.completions.create({
      model: process.env.OPENAI_ACTIVE_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are testing AI connectivity. Respond with just "OK".' },
        { role: 'user', content: 'Test connection' }
      ],
      max_tokens: 10,
      temperature: 0
    })
    const responseTime = Date.now() - startTime

    const isWorking = testCompletion?.choices?.[0]?.message?.content?.includes('OK')
    logTest('OpenAI API connectivity', isWorking, `Response time: ${responseTime}ms`)

    if (responseTime > 5000) {
      addRecommendation('OpenAI API response time is slow. Monitor for rate limiting.')
    }

    // Test email scoring function
    try {
      const response = await fetch('http://localhost:3000/api/ai/process-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.CRON_SECRET
        },
        body: JSON.stringify({
          test: true,
          emails: [{
            id: 'test-email-1',
            sender: 'test@example.com',
            subject: 'Important meeting tomorrow',
            content: 'We need to discuss the quarterly reports.',
            date: new Date().toISOString(),
            hasAttachments: false,
            isNewsletter: false
          }]
        })
      })

      const result = await response.json()
      logTest('AI email scoring API', response.ok && result.success, `Processed ${result.processed || 0} emails`)

    } catch (apiError) {
      logTest('AI email scoring API', false, 'Server not running - test manually after deployment')
    }

  } catch (error) {
    logTest('AI processing setup', false, error.message)
  }
}

async function testGmailIntegration() {
  console.log('\n📧 GMAIL OAUTH INTEGRATION VALIDATION')
  console.log('====================================')

  try {
    // Validate Google OAuth configuration
    const hasClientId = !!process.env.GOOGLE_CLIENT_ID
    const hasClientSecret = !!process.env.GOOGLE_CLIENT_SECRET
    const hasRedirectUri = !!process.env.GOOGLE_REDIRECT_URI

    logTest('Google OAuth configuration', hasClientId && hasClientSecret && hasRedirectUri)

    if (!hasClientId || !hasClientSecret) {
      addRecommendation('Complete Google OAuth setup for Gmail integration.')
    }

    // Test Gmail API scope configuration
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email'
    ]

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes
    })

    logTest('Gmail OAuth URL generation', !!authUrl, 'Auth flow ready')

  } catch (error) {
    logTest('Gmail OAuth setup', false, error.message)
  }
}

async function testApplicationRoutes() {
  console.log('\n🌐 APPLICATION ROUTES VALIDATION')
  console.log('==============================')

  const routes = [
    { path: '/', name: 'Home page' },
    { path: '/login', name: 'Login page' },
    { path: '/dashboard', name: 'Dashboard page' },
    { path: '/api/health', name: 'Health check API' },
    { path: '/api/auth/google', name: 'Google OAuth API' },
    { path: '/api/digest/generate', name: 'Digest generation API' }
  ]

  // Note: These would need the server running for full validation
  for (const route of routes) {
    try {
      // For now, just check if route files exist
      let exists = false
      if (route.path === '/') {
        exists = fs.existsSync(path.join(__dirname, '../app/page.tsx'))
      } else if (route.path.startsWith('/api/')) {
        const apiPath = route.path.replace('/api/', '').split('/').join('/')
        exists = fs.existsSync(path.join(__dirname, `../app/api/${apiPath}/route.ts`))
      } else {
        exists = fs.existsSync(path.join(__dirname, `../app${route.path}/page.tsx`))
      }

      logTest(`Route exists: ${route.name}`, exists, route.path)

    } catch (error) {
      logTest(`Route validation: ${route.name}`, false, error.message)
    }
  }
}

async function testPerformanceBenchmarks() {
  console.log('\n⚡ PERFORMANCE BENCHMARKS')
  console.log('=======================')

  // Test build performance
  const buildStart = Date.now()
  try {
    const { execSync } = require('child_process')
    execSync('npm run build', { cwd: __dirname, timeout: 120000 })
    const buildTime = Date.now() - buildStart

    logTest('Build performance', buildTime < 60000, `${buildTime}ms (target: <60s)`)

    if (buildTime > 30000) {
      addRecommendation('Build time is slow. Consider build optimization strategies.')
    }

  } catch (error) {
    logTest('Build test', false, 'Build failed or timed out')
  }

  // Memory usage check
  const memUsage = process.memoryUsage()
  const memInMB = Math.round(memUsage.heapUsed / 1024 / 1024)
  logTest('Memory usage', memInMB < 512, `${memInMB}MB heap used`)

  if (memInMB > 256) {
    addRecommendation('Memory usage is high. Monitor for memory leaks in production.')
  }
}

async function testSecurityConfiguration() {
  console.log('\n🔒 SECURITY CONFIGURATION VALIDATION')
  console.log('===================================')

  // Environment variables security
  const hasNextAuthSecret = !!process.env.NEXTAUTH_SECRET
  const hasCronSecret = !!process.env.CRON_SECRET
  const hasApiKeys = !!process.env.OPENAI_API_KEY && !!process.env.SUPABASE_SERVICE_KEY

  logTest('NextAuth secret configured', hasNextAuthSecret)
  logTest('Cron secret configured', hasCronSecret)
  logTest('API keys configured', hasApiKeys)

  // Check for production readiness
  const isProduction = process.env.NODE_ENV === 'production'
  const hasHttpsRedirect = process.env.FORCE_HTTPS === 'true' || !isProduction

  logTest('HTTPS enforcement', hasHttpsRedirect, isProduction ? 'Required in production' : 'OK for development')

  if (isProduction && !hasHttpsRedirect) {
    addRecommendation('Enable HTTPS enforcement for production deployment.')
  }
}

async function testDataIntegrity() {
  console.log('\n🗄️  DATA INTEGRITY & MIGRATION VALIDATION')
  console.log('=======================================')

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // Check if recent migration was applied
    const { data: migrationCheck, error } = await supabase
      .from('emails')
      .select('priority')
      .limit(1)

    logTest('Latest migration applied', !error, 'Priority column exists')

    // Test constraint validations
    const { error: constraintError } = await supabase
      .from('feed_items')
      .insert({
        user_id: 'test',
        source: 'test',
        external_id: 'duplicate-test',
        title: 'Test',
        content: 'Test',
        category: 'test',
        priority: 1
      })

    // Try to insert duplicate
    const { error: duplicateError } = await supabase
      .from('feed_items')
      .insert({
        user_id: 'test',
        source: 'test',
        external_id: 'duplicate-test',
        title: 'Test 2',
        content: 'Test 2',
        category: 'test',
        priority: 1
      })

    logTest('Unique constraint enforcement', !!duplicateError, 'Prevents duplicates')

    // Cleanup
    await supabase.from('feed_items').delete().eq('external_id', 'duplicate-test')

  } catch (error) {
    logTest('Data integrity check', false, error.message)
  }
}

async function generateSystemHealthReport() {
  console.log('\n📋 SYSTEM HEALTH REPORT')
  console.log('======================')

  const report = {
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    testResults,
    systemInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    },
    configuration: {
      database: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      ai: !!process.env.OPENAI_API_KEY,
      auth: !!process.env.NEXTAUTH_SECRET,
      gmail: !!process.env.GOOGLE_CLIENT_ID,
      email: !!process.env.RESEND_API_KEY
    }
  }

  // Write comprehensive health report
  fs.writeFileSync(
    path.join(__dirname, '../Docs/SYSTEM_HEALTH_REPORT.json'),
    JSON.stringify(report, null, 2)
  )

  console.log('✅ System health report generated: Docs/SYSTEM_HEALTH_REPORT.json')

  return report
}

async function main() {
  try {
    await testDatabaseConnectivity()
    await testAIProcessingPipeline()
    await testGmailIntegration()
    await testApplicationRoutes()
    await testPerformanceBenchmarks()
    await testSecurityConfiguration()
    await testDataIntegrity()

    const healthReport = await generateSystemHealthReport()

    console.log('\n' + '='.repeat(60))
    console.log('🎯 SPARC COMPLETION - SYSTEM VALIDATION RESULTS')
    console.log('='.repeat(60))

    console.log(`\n📊 Test Summary:`)
    console.log(`   Total Tests: ${testResults.totalTests}`)
    console.log(`   ✅ Passed: ${testResults.passedTests}`)
    console.log(`   ❌ Failed: ${testResults.failedTests}`)
    console.log(`   ⚠️  Warnings: ${testResults.warnings}`)

    const successRate = Math.round((testResults.passedTests / testResults.totalTests) * 100)
    console.log(`   🎯 Success Rate: ${successRate}%`)

    if (testResults.criticalErrors.length > 0) {
      console.log(`\n❌ Critical Issues:`)
      testResults.criticalErrors.forEach(error => console.log(`   - ${error}`))
    }

    if (testResults.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`)
      testResults.recommendations.forEach(rec => console.log(`   - ${rec}`))
    }

    console.log('\n🚀 Production Readiness Status:')
    if (successRate >= 90 && testResults.failedTests === 0) {
      console.log('   ✅ READY FOR PRODUCTION DEPLOYMENT')
    } else if (successRate >= 80) {
      console.log('   ⚠️  READY WITH MINOR ISSUES - Address recommendations')
    } else {
      console.log('   ❌ NOT READY - Critical issues must be resolved')
    }

    console.log(`\n📋 Detailed report: Docs/SYSTEM_HEALTH_REPORT.json`)
    console.log('\n🎉 SPARC Implementation - System Validation Complete!')

  } catch (error) {
    console.error('\n💥 System validation failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { main, testResults }