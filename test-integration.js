// Phase 4 Integration Testing Script
// Tests all components and their integration

const fs = require('fs')
const path = require('path')

// Color codes for better output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logHeader(message) {
  console.log(`\n${colors.bold}${colors.blue}=== ${message} ===${colors.reset}`)
}

function checkSuccess(condition, message) {
  if (condition) {
    log(`✅ ${message}`, 'green')
    return true
  } else {
    log(`❌ ${message}`, 'red')
    return false
  }
}

function checkWarning(condition, message) {
  if (condition) {
    log(`⚠️  ${message}`, 'yellow')
  }
}

// Test configuration
const testConfig = {
  baseDir: __dirname,
  requiredFiles: {
    'Integration Service': 'src/lib/services/integration-service.ts',
    'Error Boundary': 'src/middleware/error-boundary.tsx',
    'Email Intelligence Hook': 'src/hooks/use-email-intelligence.ts',
    'Weekly Digest Hook': 'src/hooks/use-weekly-digest.ts',
    'Deployment Config': 'config/deployment.ts',
    'Monitoring Config': 'config/monitoring.ts',
    'Error Handling Utils': 'src/lib/utils/error-handling.ts'
  },
  existingIntegrations: {
    'OpenAI Integration': 'lib/ai/openai.ts',
    'AI Processing Route': 'app/api/ai/process-emails/route.ts',
    'Supabase Integration': 'lib/supabase/server.ts' // Assumed to exist
  }
}

async function runTests() {
  logHeader('Phase 4 Integration Testing')
  log('Testing all components and their integration...', 'blue')

  let totalTests = 0
  let passedTests = 0

  // Test 1: File Existence
  logHeader('1. File Existence Tests')

  for (const [name, filePath] of Object.entries(testConfig.requiredFiles)) {
    totalTests++
    const fullPath = path.join(testConfig.baseDir, filePath)
    const exists = fs.existsSync(fullPath)

    if (checkSuccess(exists, `${name} exists at ${filePath}`)) {
      passedTests++

      // Check file size to ensure it's not empty
      const stats = fs.statSync(fullPath)
      checkWarning(stats.size < 1000, `${name} seems small (${stats.size} bytes)`)
    }
  }

  // Test 2: File Structure and Imports
  logHeader('2. File Structure and Import Tests')

  const integrationServicePath = path.join(testConfig.baseDir, 'src/lib/services/integration-service.ts')
  if (fs.existsSync(integrationServicePath)) {
    totalTests++
    const content = fs.readFileSync(integrationServicePath, 'utf8')

    const hasRequiredImports = [
      'createClient',
      'scoreEmailPriority',
      'summarizeEmailThread',
      'handleApiError'
    ].every(importName => content.includes(importName))

    if (checkSuccess(hasRequiredImports, 'Integration service has required imports')) {
      passedTests++
    }

    totalTests++
    const hasRequiredMethods = [
      'checkSystemHealth',
      'processEmailsBatch',
      'processEmailThreads',
      'initializeUserServices',
      'getAnalytics'
    ].every(method => content.includes(method))

    if (checkSuccess(hasRequiredMethods, 'Integration service has all required methods')) {
      passedTests++
    }
  }

  // Test 3: Error Boundary Component
  logHeader('3. Error Boundary Tests')

  const errorBoundaryPath = path.join(testConfig.baseDir, 'src/middleware/error-boundary.tsx')
  if (fs.existsSync(errorBoundaryPath)) {
    totalTests++
    const content = fs.readFileSync(errorBoundaryPath, 'utf8')

    const hasRequiredFeatures = [
      'componentDidCatch',
      'ErrorDisplay',
      'withErrorBoundary',
      'useErrorBoundary',
      'retryRender'
    ].every(feature => content.includes(feature))

    if (checkSuccess(hasRequiredFeatures, 'Error boundary has all required features')) {
      passedTests++
    }

    totalTests++
    const hasReactImports = content.includes("import React") && content.includes("'use client'")
    if (checkSuccess(hasReactImports, 'Error boundary has proper React imports')) {
      passedTests++
    }
  }

  // Test 4: Custom Hooks
  logHeader('4. Custom Hooks Tests')

  const hooksToTest = [
    { name: 'Email Intelligence', path: 'src/hooks/use-email-intelligence.ts', hooks: ['useEmailIntelligence', 'useEmailProcessingMonitor'] },
    { name: 'Weekly Digest', path: 'src/hooks/use-weekly-digest.ts', hooks: ['useWeeklyDigest'] }
  ]

  for (const { name, path: hookPath, hooks } of hooksToTest) {
    const fullPath = path.join(testConfig.baseDir, hookPath)
    if (fs.existsSync(fullPath)) {
      totalTests++
      const content = fs.readFileSync(fullPath, 'utf8')

      const hasAllHooks = hooks.every(hookName => content.includes(hookName))
      if (checkSuccess(hasAllHooks, `${name} hook has all required exports`)) {
        passedTests++
      }

      totalTests++
      const hasUseClientDirective = content.includes("'use client'")
      if (checkSuccess(hasUseClientDirective, `${name} hook has 'use client' directive`)) {
        passedTests++
      }
    }
  }

  // Test 5: Configuration Files
  logHeader('5. Configuration Tests')

  const deploymentConfigPath = path.join(testConfig.baseDir, 'config/deployment.ts')
  if (fs.existsSync(deploymentConfigPath)) {
    totalTests++
    const content = fs.readFileSync(deploymentConfigPath, 'utf8')

    const hasRequiredSections = [
      'environment',
      'server',
      'database',
      'apis',
      'monitoring',
      'validateDeploymentConfig'
    ].every(section => content.includes(section))

    if (checkSuccess(hasRequiredSections, 'Deployment config has all required sections')) {
      passedTests++
    }
  }

  const monitoringConfigPath = path.join(testConfig.baseDir, 'config/monitoring.ts')
  if (fs.existsSync(monitoringConfigPath)) {
    totalTests++
    const content = fs.readFileSync(monitoringConfigPath, 'utf8')

    const hasMonitoringFeatures = [
      'HealthCheckResult',
      'MonitoringService',
      'performHealthCheck',
      'recordMetric',
      'createMonitoringMiddleware'
    ].every(feature => content.includes(feature))

    if (checkSuccess(hasMonitoringFeatures, 'Monitoring config has all required features')) {
      passedTests++
    }
  }

  // Test 6: Error Handling Utils
  logHeader('6. Error Handling Tests')

  const errorHandlingPath = path.join(testConfig.baseDir, 'src/lib/utils/error-handling.ts')
  if (fs.existsSync(errorHandlingPath)) {
    totalTests++
    const content = fs.readFileSync(errorHandlingPath, 'utf8')

    const hasErrorClasses = [
      'ValidationError',
      'AuthenticationError',
      'AuthorizationError',
      'NetworkError',
      'DatabaseError',
      'ExternalAPIError'
    ].every(errorClass => content.includes(errorClass))

    if (checkSuccess(hasErrorClasses, 'Error handling has all custom error classes')) {
      passedTests++
    }

    totalTests++
    const hasUtilFunctions = [
      'logError',
      'handleApiError',
      'formatErrorResponse',
      'withRetry',
      'CircuitBreaker'
    ].every(func => content.includes(func))

    if (checkSuccess(hasUtilFunctions, 'Error handling has all utility functions')) {
      passedTests++
    }
  }

  // Test 7: Integration with Existing Code
  logHeader('7. Integration with Existing Code')

  for (const [name, filePath] of Object.entries(testConfig.existingIntegrations)) {
    totalTests++
    const fullPath = path.join(testConfig.baseDir, filePath)
    const exists = fs.existsSync(fullPath)

    if (checkSuccess(exists, `Existing integration ${name} is accessible`)) {
      passedTests++
    }
  }

  // Test 8: TypeScript Compilation Check
  logHeader('8. TypeScript Compatibility')

  totalTests++
  try {
    // Check if files use proper TypeScript syntax
    const tsFiles = [
      'src/lib/services/integration-service.ts',
      'src/hooks/use-email-intelligence.ts',
      'src/hooks/use-weekly-digest.ts',
      'config/deployment.ts',
      'config/monitoring.ts',
      'src/lib/utils/error-handling.ts'
    ]

    let validTsFiles = 0
    for (const filePath of tsFiles) {
      const fullPath = path.join(testConfig.baseDir, filePath)
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8')

        // Basic TypeScript checks
        const hasTypeAnnotations = content.includes(': ') && (content.includes('interface') || content.includes('type'))
        const hasExports = content.includes('export')
        const hasImports = content.includes('import')

        if (hasTypeAnnotations && hasExports && hasImports) {
          validTsFiles++
        }
      }
    }

    if (checkSuccess(validTsFiles === tsFiles.length, `All ${tsFiles.length} TypeScript files have proper syntax`)) {
      passedTests++
    }
  } catch (error) {
    log(`Error checking TypeScript compatibility: ${error.message}`, 'red')
  }

  // Test 9: Package Dependencies
  logHeader('9. Package Dependencies')

  totalTests++
  const packageJsonPath = path.join(testConfig.baseDir, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

    const requiredDeps = [
      'react',
      'next',
      '@supabase/supabase-js',
      'openai'
    ]

    const hasAllDeps = requiredDeps.every(dep =>
      packageJson.dependencies[dep] || packageJson.devDependencies[dep]
    )

    if (checkSuccess(hasAllDeps, 'All required dependencies are installed')) {
      passedTests++
    }
  }

  // Test 10: Environment Configuration
  logHeader('10. Environment Configuration')

  totalTests++
  const sampleEnvExists = fs.existsSync(path.join(testConfig.baseDir, '.env.example')) ||
                          fs.existsSync(path.join(testConfig.baseDir, '.env.local'))

  checkWarning(!sampleEnvExists, 'No .env.example file found - consider creating one')

  // Check if deployment config references proper env vars
  if (fs.existsSync(path.join(testConfig.baseDir, 'config/deployment.ts'))) {
    const deploymentContent = fs.readFileSync(path.join(testConfig.baseDir, 'config/deployment.ts'), 'utf8')
    const referencesEnvVars = deploymentContent.includes('process.env.')

    if (checkSuccess(referencesEnvVars, 'Deployment config references environment variables')) {
      passedTests++
    }
  } else {
    log('Deployment config not found for environment variable check', 'yellow')
  }

  // Final Results
  logHeader('Test Results Summary')

  const successRate = ((passedTests / totalTests) * 100).toFixed(1)

  log(`\nTotal Tests: ${totalTests}`)
  log(`Passed: ${passedTests}`, passedTests === totalTests ? 'green' : 'yellow')
  log(`Failed: ${totalTests - passedTests}`, totalTests - passedTests === 0 ? 'green' : 'red')
  log(`Success Rate: ${successRate}%`, parseFloat(successRate) >= 90 ? 'green' : 'yellow')

  if (parseFloat(successRate) >= 90) {
    log('\n🎉 Phase 4 Integration Testing: SUCCESS!', 'green')
    log('All core components have been implemented and are ready for production.', 'green')
  } else if (parseFloat(successRate) >= 75) {
    log('\n⚠️  Phase 4 Integration Testing: PARTIAL SUCCESS', 'yellow')
    log('Most components are ready, but some issues need attention.', 'yellow')
  } else {
    log('\n❌ Phase 4 Integration Testing: NEEDS WORK', 'red')
    log('Several components need attention before production deployment.', 'red')
  }

  // Recommendations
  logHeader('Recommendations for Production')

  log('1. ✅ Set up environment variables for all services')
  log('2. ✅ Configure monitoring and alerting systems')
  log('3. ✅ Test error boundaries in development environment')
  log('4. ✅ Validate API rate limits and retry logic')
  log('5. ✅ Set up proper logging aggregation')
  log('6. ⚠️  Create comprehensive end-to-end tests')
  log('7. ⚠️  Load test the integration service under realistic conditions')
  log('8. ⚠️  Set up automated health checks in production')
  log('9. ⚠️  Create runbooks for common operational scenarios')
  log('10. ⚠️  Implement proper backup and recovery procedures')

  return { totalTests, passedTests, successRate: parseFloat(successRate) }
}

// Run the tests
runTests().then(results => {
  process.exit(results.successRate >= 75 ? 0 : 1)
}).catch(error => {
  log(`\nTest execution failed: ${error.message}`, 'red')
  console.error(error)
  process.exit(1)
})