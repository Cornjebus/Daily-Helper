#!/usr/bin/env node

// Simple demo validation without complex dependencies
console.log('🚀 Phase 5 Demo Environment Validation')
console.log('=====================================')

const fs = require('fs')
const path = require('path')

let passed = 0
let failed = 0

function test(name, condition, message) {
  if (condition) {
    console.log(`✅ ${name}`)
    passed++
  } else {
    console.log(`❌ ${name}: ${message}`)
    failed++
  }
}

// Test file existence
test('Build Directory', fs.existsSync('.next'), 'Run npm run build first')
test('Migration Files', fs.existsSync('supabase/migrations') &&
     fs.readdirSync('supabase/migrations').some(f => f.endsWith('.sql')),
     'Migration files missing')
test('Demo Scripts', fs.existsSync('scripts/setup-demo-environment.js'),
     'Demo setup script missing')
test('Health API', fs.existsSync('app/api/health/route.ts'),
     'Health check API missing')
test('Demo Metrics API', fs.existsSync('app/api/demo/metrics/route.ts'),
     'Demo metrics API missing')
test('Mass Unsubscribe API', fs.existsSync('app/api/demo/mass-unsubscribe/route.ts'),
     'Mass unsubscribe API missing')

// Test package.json scripts
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
test('Build Script', packageJson.scripts && packageJson.scripts.build,
     'Build script missing in package.json')
test('Dev Script', packageJson.scripts && packageJson.scripts.dev,
     'Dev script missing in package.json')

console.log('')
console.log(`📊 Results: ${passed} passed, ${failed} failed`)

if (failed === 0) {
  console.log('🎉 Demo Environment Files Ready!')
  console.log('')
  console.log('🚀 Next Steps:')
  console.log('1. Ensure .env.local has valid credentials')
  console.log('2. Run: npm run dev')
  console.log('3. Test: http://localhost:3000/api/health')
  console.log('4. Demo: http://localhost:3000/dashboard')
} else {
  console.log('❌ Please fix the failed tests above')
  process.exit(1)
}
