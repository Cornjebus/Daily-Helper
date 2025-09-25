import { deploymentConfig } from '@/config/deployment'

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

// Error categories for better classification
export type ErrorCategory =
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'network'
  | 'database'
  | 'external_api'
  | 'business_logic'
  | 'system'
  | 'unknown'

// Enhanced error interface
export interface AppError extends Error {
  code?: string
  statusCode?: number
  category?: ErrorCategory
  severity?: ErrorSeverity
  context?: Record<string, any>
  userMessage?: string
  retryable?: boolean
  timestamp?: string
  userId?: string
  requestId?: string
}

// Error context for logging
export interface ErrorContext {
  userId?: string
  requestId?: string
  userAgent?: string
  url?: string
  method?: string
  ip?: string
  sessionId?: string
  errorBoundary?: boolean
  level?: string
  componentStack?: string
  retryCount?: number
  [key: string]: any
}

// Custom error classes
export class ValidationError extends Error implements AppError {
  code = 'VALIDATION_ERROR'
  statusCode = 400
  category: ErrorCategory = 'validation'
  severity: ErrorSeverity = 'medium'
  retryable = false

  constructor(message: string, public field?: string, public value?: any) {
    super(message)
    this.name = 'ValidationError'
    this.userMessage = message
  }
}

export class AuthenticationError extends Error implements AppError {
  code = 'AUTHENTICATION_ERROR'
  statusCode = 401
  category: ErrorCategory = 'authentication'
  severity: ErrorSeverity = 'high'
  retryable = false

  constructor(message: string = 'Authentication required') {
    super(message)
    this.name = 'AuthenticationError'
    this.userMessage = 'Please log in to continue'
  }
}

export class AuthorizationError extends Error implements AppError {
  code = 'AUTHORIZATION_ERROR'
  statusCode = 403
  category: ErrorCategory = 'authorization'
  severity: ErrorSeverity = 'high'
  retryable = false

  constructor(message: string = 'Access denied', public resource?: string) {
    super(message)
    this.name = 'AuthorizationError'
    this.userMessage = 'You do not have permission to perform this action'
  }
}

export class NetworkError extends Error implements AppError {
  code = 'NETWORK_ERROR'
  statusCode = 503
  category: ErrorCategory = 'network'
  severity: ErrorSeverity = 'medium'
  retryable = true

  constructor(message: string, public originalError?: Error) {
    super(message)
    this.name = 'NetworkError'
    this.userMessage = 'Network connection failed. Please try again.'
  }
}

export class DatabaseError extends Error implements AppError {
  code = 'DATABASE_ERROR'
  statusCode = 500
  category: ErrorCategory = 'database'
  severity: ErrorSeverity = 'high'
  retryable = false

  constructor(message: string, public query?: string, public originalError?: Error) {
    super(message)
    this.name = 'DatabaseError'
    this.userMessage = 'A database error occurred. Please try again later.'
  }
}

export class ExternalAPIError extends Error implements AppError {
  code = 'EXTERNAL_API_ERROR'
  statusCode = 502
  category: ErrorCategory = 'external_api'
  severity: ErrorSeverity = 'medium'
  retryable = true

  constructor(
    message: string,
    public service: string,
    public responseCode?: number,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'ExternalAPIError'
    this.userMessage = `${service} service is temporarily unavailable. Please try again later.`
  }
}

export class BusinessLogicError extends Error implements AppError {
  code = 'BUSINESS_LOGIC_ERROR'
  statusCode = 422
  category: ErrorCategory = 'business_logic'
  severity: ErrorSeverity = 'medium'
  retryable = false

  constructor(message: string, public rule?: string) {
    super(message)
    this.name = 'BusinessLogicError'
    this.userMessage = message
  }
}

export class SystemError extends Error implements AppError {
  code = 'SYSTEM_ERROR'
  statusCode = 500
  category: ErrorCategory = 'system'
  severity: ErrorSeverity = 'critical'
  retryable = false

  constructor(message: string, public systemComponent?: string) {
    super(message)
    this.name = 'SystemError'
    this.userMessage = 'A system error occurred. Our team has been notified.'
  }
}

// Rate limiting error
export class RateLimitError extends Error implements AppError {
  code = 'RATE_LIMIT_EXCEEDED'
  statusCode = 429
  category: ErrorCategory = 'system'
  severity: ErrorSeverity = 'medium'
  retryable = true

  constructor(message: string = 'Rate limit exceeded', public retryAfter?: number) {
    super(message)
    this.name = 'RateLimitError'
    this.userMessage = `Too many requests. Please wait ${retryAfter ? `${retryAfter} seconds` : 'a moment'} before trying again.`
  }
}

// Central error logging function
export function logError(error: Error | AppError, context: ErrorContext = {}): string {
  const timestamp = new Date().toISOString()
  const errorId = generateErrorId()

  // Enhance error with additional information
  const enhancedError = error as AppError
  enhancedError.timestamp = enhancedError.timestamp || timestamp
  enhancedError.requestId = context.requestId || errorId

  // Determine severity if not set
  if (!enhancedError.severity) {
    enhancedError.severity = inferErrorSeverity(error)
  }

  // Determine category if not set
  if (!enhancedError.category) {
    enhancedError.category = inferErrorCategory(error)
  }

  // Create log entry
  const logEntry = {
    errorId,
    timestamp,
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: enhancedError.code,
    statusCode: enhancedError.statusCode,
    category: enhancedError.category,
    severity: enhancedError.severity,
    retryable: enhancedError.retryable,
    userMessage: enhancedError.userMessage,
    context: {
      ...context,
      nodeEnv: deploymentConfig.environment.nodeEnv,
      appVersion: deploymentConfig.environment.appVersion,
      platform: deploymentConfig.environment.platform
    }
  }

  // Mask sensitive data if enabled
  if (deploymentConfig.logging.maskSensitiveData) {
    maskSensitiveData(logEntry)
  }

  // Log based on severity and environment
  const logLevel = deploymentConfig.logging.level
  const shouldLog = shouldLogError(enhancedError.severity || 'medium', logLevel)

  if (shouldLog) {
    if (enhancedError.severity === 'critical' || enhancedError.severity === 'high') {
      console.error('🚨 ERROR:', JSON.stringify(logEntry, null, 2))
    } else if (enhancedError.severity === 'medium') {
      console.warn('⚠️ WARNING:', JSON.stringify(logEntry, null, 2))
    } else {
      console.log('ℹ️ INFO:', JSON.stringify(logEntry, null, 2))
    }
  }

  // Send to external logging service if configured
  if (deploymentConfig.logging.transports.external.enabled) {
    sendToExternalLogging(logEntry).catch(err =>
      console.error('Failed to send error to external logging:', err)
    )
  }

  // Track error metrics
  if (deploymentConfig.monitoring.metrics.enabled) {
    try {
      const { monitoring } = require('@/config/monitoring')
      monitoring.recordMetric('errors.total', 1, {
        category: enhancedError.category || 'unknown',
        severity: enhancedError.severity || 'medium',
        code: enhancedError.code || 'UNKNOWN'
      })
    } catch (err) {
      // Ignore monitoring errors to prevent cascading failures
    }
  }

  return errorId
}

// Error handling middleware for API routes
export function handleApiError(
  error: Error,
  fallbackMessage: string = 'An unexpected error occurred',
  context: ErrorContext = {}
): AppError {
  // Convert known error types
  if (error.message?.includes('Authentication')) {
    return new AuthenticationError(error.message)
  }

  if (error.message?.includes('authorization') || error.message?.includes('permission')) {
    return new AuthorizationError(error.message)
  }

  if (error.message?.includes('network') || error.message?.includes('ECONNREFUSED')) {
    return new NetworkError(error.message, error)
  }

  if (error.message?.includes('database') || error.message?.includes('SQL')) {
    return new DatabaseError(error.message, undefined, error)
  }

  if (error.message?.includes('validation') || error.message?.includes('invalid')) {
    return new ValidationError(error.message)
  }

  // For OpenAI/external API errors
  if (error.message?.includes('OpenAI') || error.message?.includes('API')) {
    return new ExternalAPIError(error.message, 'OpenAI', undefined, error)
  }

  // Log the original error
  const errorId = logError(error, context)

  // Return a generic system error
  const systemError = new SystemError(fallbackMessage)
  systemError.context = { originalError: error.message, errorId }

  return systemError
}

// Format error for API responses
export function formatErrorResponse(error: AppError): {
  error: string
  message: string
  code?: string
  details?: any
  userMessage?: string
  retryable?: boolean
  timestamp: string
} {
  return {
    error: error.name,
    message: error.message,
    ...(error.code && { code: error.code }),
    ...(error.context && { details: error.context }),
    ...(error.userMessage && { userMessage: error.userMessage }),
    ...(error.retryable !== undefined && { retryable: error.retryable }),
    timestamp: error.timestamp || new Date().toISOString()
  }
}

// Retry logic with exponential backoff
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    baseDelay?: number
    maxDelay?: number
    backoffFactor?: number
    retryCondition?: (error: Error) => boolean
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    retryCondition = (error) => (error as AppError).retryable !== false
  } = options

  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break
      }

      // Check if error is retryable
      if (!retryCondition(error)) {
        throw error
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * Math.pow(backoffFactor, attempt) + Math.random() * 1000,
        maxDelay
      )

      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

// Circuit breaker implementation
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN'
      } else {
        throw new SystemError('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await fn()

      if (this.state === 'HALF_OPEN') {
        this.reset()
      }

      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  private recordFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.threshold) {
      this.state = 'OPEN'
    }
  }

  private reset(): void {
    this.failures = 0
    this.state = 'CLOSED'
    this.lastFailureTime = 0
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    }
  }
}

// Utility functions
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function inferErrorSeverity(error: Error): ErrorSeverity {
  const message = error.message.toLowerCase()

  if (message.includes('critical') || message.includes('fatal') || message.includes('system')) {
    return 'critical'
  }

  if (message.includes('auth') || message.includes('permission') || message.includes('database')) {
    return 'high'
  }

  if (message.includes('validation') || message.includes('api') || message.includes('network')) {
    return 'medium'
  }

  return 'low'
}

function inferErrorCategory(error: Error): ErrorCategory {
  const message = error.message.toLowerCase()
  const name = error.name.toLowerCase()

  if (message.includes('auth') || name.includes('auth')) {
    return 'authentication'
  }

  if (message.includes('permission') || message.includes('forbidden')) {
    return 'authorization'
  }

  if (message.includes('validation') || message.includes('invalid')) {
    return 'validation'
  }

  if (message.includes('network') || message.includes('connection')) {
    return 'network'
  }

  if (message.includes('database') || message.includes('sql')) {
    return 'database'
  }

  if (message.includes('api') || message.includes('openai')) {
    return 'external_api'
  }

  if (message.includes('business') || message.includes('rule')) {
    return 'business_logic'
  }

  if (message.includes('system') || message.includes('internal')) {
    return 'system'
  }

  return 'unknown'
}

function shouldLogError(severity: ErrorSeverity, logLevel: string): boolean {
  const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 }
  const configLevels = { debug: 1, info: 1, warn: 2, error: 3 }

  const errorLevel = severityLevels[severity] || 2
  const configLevel = configLevels[logLevel as keyof typeof configLevels] || 2

  return errorLevel >= configLevel
}

function maskSensitiveData(obj: any): void {
  const sensitiveFields = [
    'password', 'token', 'apiKey', 'secret', 'key', 'auth',
    'authorization', 'cookie', 'session', 'credit', 'ssn'
  ]

  function maskObject(object: any, path: string = ''): void {
    if (!object || typeof object !== 'object') return

    for (const [key, value] of Object.entries(object)) {
      const fullPath = path ? `${path}.${key}` : key
      const keyLower = key.toLowerCase()

      if (sensitiveFields.some(field => keyLower.includes(field))) {
        object[key] = '***MASKED***'
      } else if (typeof value === 'object' && value !== null) {
        maskObject(value, fullPath)
      } else if (typeof value === 'string' && value.length > 20) {
        // Mask long strings that might contain sensitive data
        if (keyLower.includes('stack') || keyLower.includes('trace')) {
          // Don't mask stack traces, they're needed for debugging
          continue
        }

        // Check if it looks like a token or key
        if (/^[a-zA-Z0-9+/]{40,}={0,2}$/.test(value) || // Base64
            /^[a-zA-Z0-9]{32,}$/.test(value) || // Hex
            /^sk-[a-zA-Z0-9]{48}$/.test(value)) { // OpenAI key pattern
          object[key] = '***MASKED***'
        }
      }
    }
  }

  maskObject(obj)
}

async function sendToExternalLogging(logEntry: any): Promise<void> {
  const config = deploymentConfig.logging.transports.external

  if (!config.url) return

  try {
    await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
      },
      body: JSON.stringify(logEntry)
    })
  } catch (error) {
    // Don't throw here to prevent cascading errors
    console.error('Failed to send to external logging service:', error)
  }
}

// Export commonly used circuit breakers
export const openaiCircuitBreaker = new CircuitBreaker(3, 30000) // 3 failures, 30s timeout
export const databaseCircuitBreaker = new CircuitBreaker(5, 60000) // 5 failures, 60s timeout
export const emailCircuitBreaker = new CircuitBreaker(3, 45000) // 3 failures, 45s timeout