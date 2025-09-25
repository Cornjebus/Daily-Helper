// Production deployment configuration
export const deploymentConfig = {
  // Environment settings
  environment: {
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
    isTest: process.env.NODE_ENV === 'test',

    // App metadata
    appName: process.env.NEXT_PUBLIC_APP_NAME || 'Rally Daily Helper',
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
    buildTime: process.env.BUILD_TIME || new Date().toISOString(),
    commitHash: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',

    // Deployment platform
    platform: process.env.VERCEL ? 'vercel' : 'custom',
    region: process.env.VERCEL_REGION || process.env.AWS_REGION || 'us-east-1',
  },

  // Server configuration
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',

    // Request handling
    maxRequestSize: '10mb',
    requestTimeout: 30000, // 30 seconds
    keepAliveTimeout: 65000, // 65 seconds (must be higher than load balancer)
    headersTimeout: 66000, // 66 seconds

    // Security headers
    securityHeaders: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      ...(process.env.NODE_ENV === 'production' && {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self'",
          "connect-src 'self' https://api.openai.com https://*.supabase.co",
          "frame-ancestors 'none'"
        ].join('; ')
      })
    }
  },

  // Database configuration
  database: {
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

      // Connection pool settings
      poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
      poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),

      // Query settings
      queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
      statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '60000', 10),
    }
  },

  // External API configuration
  apis: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORG_ID,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',

      // Model settings
      defaultModel: process.env.OPENAI_ACTIVE_MODEL || 'gpt-4o-mini',
      fallbackModel: process.env.OPENAI_FALLBACK_MODEL || 'gpt-3.5-turbo',

      // Rate limiting
      rateLimit: {
        requests: parseInt(process.env.OPENAI_RATE_LIMIT_REQUESTS || '60', 10),
        window: parseInt(process.env.OPENAI_RATE_LIMIT_WINDOW || '60000', 10), // 1 minute
        tokensPerMinute: parseInt(process.env.OPENAI_RATE_LIMIT_TOKENS || '150000', 10)
      },

      // Timeout settings
      timeout: parseInt(process.env.OPENAI_TIMEOUT || '60000', 10), // 60 seconds
      retries: parseInt(process.env.OPENAI_RETRIES || '3', 10)
    },

    gmail: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,

      // OAuth settings
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
      ],

      // API limits
      batchSize: parseInt(process.env.GMAIL_BATCH_SIZE || '100', 10),
      rateLimit: {
        requests: parseInt(process.env.GMAIL_RATE_LIMIT_REQUESTS || '250', 10),
        window: parseInt(process.env.GMAIL_RATE_LIMIT_WINDOW || '1000', 10) // 1 second
      }
    }
  },

  // Caching configuration
  cache: {
    redis: {
      url: process.env.REDIS_URL,
      tls: process.env.REDIS_TLS === 'true',

      // Connection settings
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000', 10),
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100', 10),
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10)
    },

    // In-memory cache for development
    memory: {
      max: parseInt(process.env.MEMORY_CACHE_MAX || '1000', 10),
      ttl: parseInt(process.env.MEMORY_CACHE_TTL || '300000', 10) // 5 minutes
    },

    // Cache strategies
    strategies: {
      emailProcessing: {
        ttl: parseInt(process.env.CACHE_EMAIL_TTL || '3600000', 10), // 1 hour
        maxSize: parseInt(process.env.CACHE_EMAIL_MAX_SIZE || '500', 10)
      },
      aiResponses: {
        ttl: parseInt(process.env.CACHE_AI_TTL || '1800000', 10), // 30 minutes
        maxSize: parseInt(process.env.CACHE_AI_MAX_SIZE || '200', 10)
      },
      userSessions: {
        ttl: parseInt(process.env.CACHE_SESSION_TTL || '86400000', 10), // 24 hours
        maxSize: parseInt(process.env.CACHE_SESSION_MAX_SIZE || '1000', 10)
      }
    }
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug'),
    format: process.env.LOG_FORMAT || 'json',

    // Transport settings
    transports: {
      console: {
        enabled: process.env.LOG_CONSOLE !== 'false',
        colorize: process.env.NODE_ENV !== 'production'
      },
      file: {
        enabled: process.env.LOG_FILE === 'true',
        filename: process.env.LOG_FILE_PATH || './logs/application.log',
        maxSize: process.env.LOG_FILE_MAX_SIZE || '10m',
        maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES || '5', 10)
      },
      external: {
        enabled: !!process.env.LOG_EXTERNAL_URL,
        url: process.env.LOG_EXTERNAL_URL,
        apiKey: process.env.LOG_EXTERNAL_API_KEY
      }
    },

    // What to log
    includeUserAgent: process.env.LOG_USER_AGENT === 'true',
    includeRequestId: process.env.LOG_REQUEST_ID !== 'false',
    includePerformance: process.env.LOG_PERFORMANCE !== 'false',
    maskSensitiveData: process.env.LOG_MASK_SENSITIVE !== 'false'
  },

  // Monitoring and health checks
  monitoring: {
    healthCheck: {
      enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
      endpoint: process.env.HEALTH_CHECK_ENDPOINT || '/api/health',
      timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10),

      // What to check
      checks: {
        database: process.env.HEALTH_CHECK_DATABASE !== 'false',
        openai: process.env.HEALTH_CHECK_OPENAI !== 'false',
        redis: process.env.HEALTH_CHECK_REDIS !== 'false',
        diskSpace: process.env.HEALTH_CHECK_DISK_SPACE === 'true',
        memory: process.env.HEALTH_CHECK_MEMORY === 'true'
      }
    },

    metrics: {
      enabled: process.env.METRICS_ENABLED !== 'false',
      endpoint: process.env.METRICS_ENDPOINT || '/api/metrics',

      // Collection intervals
      collectInterval: parseInt(process.env.METRICS_COLLECT_INTERVAL || '60000', 10), // 1 minute
      retentionPeriod: parseInt(process.env.METRICS_RETENTION || '86400000', 10), // 24 hours

      // What to collect
      collect: {
        requests: process.env.METRICS_REQUESTS !== 'false',
        errors: process.env.METRICS_ERRORS !== 'false',
        performance: process.env.METRICS_PERFORMANCE !== 'false',
        business: process.env.METRICS_BUSINESS !== 'false'
      }
    },

    alerts: {
      enabled: process.env.ALERTS_ENABLED === 'true',
      webhook: process.env.ALERTS_WEBHOOK_URL,

      // Alert thresholds
      thresholds: {
        errorRate: parseFloat(process.env.ALERT_ERROR_RATE || '0.1'), // 10%
        responseTime: parseInt(process.env.ALERT_RESPONSE_TIME || '5000', 10), // 5 seconds
        memoryUsage: parseFloat(process.env.ALERT_MEMORY_USAGE || '0.85'), // 85%
        diskUsage: parseFloat(process.env.ALERT_DISK_USAGE || '0.90') // 90%
      }
    }
  },

  // Performance optimization
  performance: {
    // Compression
    compression: {
      enabled: process.env.COMPRESSION_ENABLED !== 'false',
      level: parseInt(process.env.COMPRESSION_LEVEL || '6', 10),
      threshold: process.env.COMPRESSION_THRESHOLD || '1kb'
    },

    // Static file caching
    staticCache: {
      enabled: process.env.STATIC_CACHE_ENABLED !== 'false',
      maxAge: parseInt(process.env.STATIC_CACHE_MAX_AGE || '31536000', 10), // 1 year
      immutable: process.env.STATIC_CACHE_IMMUTABLE !== 'false'
    },

    // API response caching
    apiCache: {
      enabled: process.env.API_CACHE_ENABLED !== 'false',
      defaultTTL: parseInt(process.env.API_CACHE_DEFAULT_TTL || '300', 10), // 5 minutes
      maxSize: parseInt(process.env.API_CACHE_MAX_SIZE || '100', 10)
    }
  },

  // Feature flags
  features: {
    aiProcessing: process.env.FEATURE_AI_PROCESSING !== 'false',
    emailSync: process.env.FEATURE_EMAIL_SYNC !== 'false',
    weeklyDigest: process.env.FEATURE_WEEKLY_DIGEST !== 'false',
    smartReplies: process.env.FEATURE_SMART_REPLIES !== 'false',
    analytics: process.env.FEATURE_ANALYTICS !== 'false',

    // Experimental features
    experimental: {
      advancedAI: process.env.FEATURE_EXPERIMENTAL_AI === 'true',
      beta_ui: process.env.FEATURE_BETA_UI === 'true',
      customModels: process.env.FEATURE_CUSTOM_MODELS === 'true'
    }
  },

  // Error handling
  errorHandling: {
    // Sentry configuration
    sentry: {
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      release: process.env.VERCEL_GIT_COMMIT_SHA,

      // Sample rates
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),

      // Integration settings
      integrations: {
        http: process.env.SENTRY_HTTP_INTEGRATION !== 'false',
        express: process.env.SENTRY_EXPRESS_INTEGRATION !== 'false',
        prisma: process.env.SENTRY_PRISMA_INTEGRATION === 'true'
      }
    },

    // Fallback behavior
    gracefulShutdown: {
      enabled: process.env.GRACEFUL_SHUTDOWN !== 'false',
      timeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '30000', 10) // 30 seconds
    }
  }
} as const

// Validation function to ensure required environment variables
export function validateDeploymentConfig(): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Required environment variables
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]

  // Check for missing required variables
  required.forEach(key => {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`)
    }
  })

  // Optional but recommended variables
  const recommended = [
    'OPENAI_API_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET'
  ]

  recommended.forEach(key => {
    if (!process.env[key]) {
      warnings.push(`Missing recommended environment variable: ${key}`)
    }
  })

  // Production-specific checks
  if (deploymentConfig.environment.isProduction) {
    const productionRequired = [
      'SENTRY_DSN',
      'LOG_EXTERNAL_URL'
    ]

    productionRequired.forEach(key => {
      if (!process.env[key]) {
        warnings.push(`Missing production environment variable: ${key}`)
      }
    })

    // Check security settings
    if (!process.env.NEXTAUTH_SECRET) {
      errors.push('NEXTAUTH_SECRET is required in production')
    }

    if (!process.env.NEXTAUTH_URL) {
      warnings.push('NEXTAUTH_URL should be set in production')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// Helper function to get configuration for specific service
export function getServiceConfig<K extends keyof typeof deploymentConfig>(
  service: K
): typeof deploymentConfig[K] {
  return deploymentConfig[service]
}

// Export individual service configurations for convenience
export const {
  environment,
  server,
  database,
  apis,
  cache,
  logging,
  monitoring,
  performance,
  features,
  errorHandling
} = deploymentConfig