import { createClient } from '@/lib/supabase/server'

/**
 * Configuration interface for email processing system
 */
export interface ProcessingConfig {
  // Batching settings
  maxBatchSize: number
  maxWaitTimeMs: number

  // AI processing thresholds
  aiThreshold: number  // Only emails above this rule score get AI processing

  // Cost management
  costBudgetCents: number  // Daily budget in cents
  maxCostPerEmail: number  // Maximum cost per email in cents

  // Priority thresholds
  priorityThresholds: {
    high: number
    medium: number
  }

  // Processing rules
  processVipImmediately: boolean
  processUrgentImmediately: boolean
  skipMarketingEmails: boolean

  // Retry settings
  maxRetries: number
  retryDelayMs: number

  // Performance settings
  enableCache: boolean
  cacheExpiryMs: number

  // Monitoring
  enableMetrics: boolean
  logLevel: 'error' | 'warn' | 'info' | 'debug'
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: ProcessingConfig = {
  // Batching settings
  maxBatchSize: 10,
  maxWaitTimeMs: 30000, // 30 seconds

  // AI processing thresholds
  aiThreshold: 60, // Only emails scoring 60+ get AI processing

  // Cost management
  costBudgetCents: 100, // $1 daily budget
  maxCostPerEmail: 10, // 10 cents max per email

  // Priority thresholds
  priorityThresholds: {
    high: 80,
    medium: 40
  },

  // Processing rules
  processVipImmediately: true,
  processUrgentImmediately: true,
  skipMarketingEmails: false,

  // Retry settings
  maxRetries: 3,
  retryDelayMs: 1000,

  // Performance settings
  enableCache: true,
  cacheExpiryMs: 300000, // 5 minutes

  // Monitoring
  enableMetrics: true,
  logLevel: 'info'
}

/**
 * User-specific configuration overrides
 */
export interface UserConfig {
  userId: string
  config: Partial<ProcessingConfig>
  updatedAt: Date
  active: boolean
}

/**
 * In-memory config cache for performance
 */
class ConfigCache {
  private cache = new Map<string, { config: ProcessingConfig; expires: number }>()
  private defaultExpiry = 5 * 60 * 1000 // 5 minutes

  set(userId: string, config: ProcessingConfig, expiry?: number): void {
    this.cache.set(userId, {
      config,
      expires: Date.now() + (expiry || this.defaultExpiry)
    })
  }

  get(userId: string): ProcessingConfig | null {
    const cached = this.cache.get(userId)
    if (!cached) return null

    if (Date.now() > cached.expires) {
      this.cache.delete(userId)
      return null
    }

    return cached.config
  }

  clear(userId?: string): void {
    if (userId) {
      this.cache.delete(userId)
    } else {
      this.cache.clear()
    }
  }

  size(): number {
    return this.cache.size
  }
}

const configCache = new ConfigCache()

/**
 * Get configuration for a specific user, with fallback to defaults
 */
export async function getUserConfig(userId: string): Promise<ProcessingConfig> {
  try {
    // Check cache first
    const cached = configCache.get(userId)
    if (cached) {
      return cached
    }

    // Load from database
    const supabase = await createClient()
    const { data: userConfig } = await supabase
      .from('user_processing_config')
      .select('config')
      .eq('user_id', userId)
      .eq('active', true)
      .single()

    // Merge user config with defaults
    const config: ProcessingConfig = {
      ...DEFAULT_CONFIG,
      ...userConfig?.config
    }

    // Validate config values
    const validatedConfig = validateConfig(config)

    // Cache the result
    configCache.set(userId, validatedConfig)

    return validatedConfig

  } catch (error) {
    console.error(`❌ Error loading config for user ${userId}:`, error)

    // Return defaults on error
    return DEFAULT_CONFIG
  }
}

/**
 * Update configuration for a specific user
 */
export async function updateUserConfig(
  userId: string,
  configUpdates: Partial<ProcessingConfig>
): Promise<ProcessingConfig> {
  try {
    const supabase = await createClient()

    // Get current config
    const currentConfig = await getUserConfig(userId)

    // Merge updates
    const newConfig = { ...currentConfig, ...configUpdates }

    // Validate
    const validatedConfig = validateConfig(newConfig)

    // Save to database
    await supabase
      .from('user_processing_config')
      .upsert({
        user_id: userId,
        config: validatedConfig,
        updated_at: new Date().toISOString(),
        active: true
      })

    // Update cache
    configCache.set(userId, validatedConfig)

    console.log(`✅ Updated config for user ${userId}`)
    return validatedConfig

  } catch (error) {
    console.error(`❌ Error updating config for user ${userId}:`, error)
    throw error
  }
}

/**
 * Validate configuration values and apply constraints
 */
function validateConfig(config: ProcessingConfig): ProcessingConfig {
  const validated = { ...config }

  // Batch size constraints
  validated.maxBatchSize = Math.max(1, Math.min(50, config.maxBatchSize))
  validated.maxWaitTimeMs = Math.max(1000, Math.min(300000, config.maxWaitTimeMs))

  // Threshold constraints
  validated.aiThreshold = Math.max(0, Math.min(100, config.aiThreshold))
  validated.priorityThresholds.high = Math.max(0, Math.min(100, config.priorityThresholds.high))
  validated.priorityThresholds.medium = Math.max(0, Math.min(100, config.priorityThresholds.medium))

  // Ensure medium < high
  if (validated.priorityThresholds.medium >= validated.priorityThresholds.high) {
    validated.priorityThresholds.medium = Math.max(0, validated.priorityThresholds.high - 10)
  }

  // Cost constraints
  validated.costBudgetCents = Math.max(0, Math.min(10000, config.costBudgetCents)) // Max $100/day
  validated.maxCostPerEmail = Math.max(1, Math.min(100, config.maxCostPerEmail)) // Max $1/email

  // Retry constraints
  validated.maxRetries = Math.max(0, Math.min(10, config.maxRetries))
  validated.retryDelayMs = Math.max(100, Math.min(60000, config.retryDelayMs))

  // Cache constraints
  validated.cacheExpiryMs = Math.max(60000, Math.min(3600000, config.cacheExpiryMs)) // 1 minute to 1 hour

  return validated
}

/**
 * Get system-wide configuration statistics
 */
export async function getConfigStats(): Promise<{
  totalUsers: number
  customConfigs: number
  avgBatchSize: number
  avgAiThreshold: number
  cacheSize: number
}> {
  try {
    const supabase = await createClient()

    const { data: configs } = await supabase
      .from('user_processing_config')
      .select('config')
      .eq('active', true)

    const totalUsers = configs?.length || 0
    const customConfigs = totalUsers // All entries in this table are custom

    const avgBatchSize = configs?.reduce((sum, c) => sum + (c.config?.maxBatchSize || DEFAULT_CONFIG.maxBatchSize), 0) / (totalUsers || 1)
    const avgAiThreshold = configs?.reduce((sum, c) => sum + (c.config?.aiThreshold || DEFAULT_CONFIG.aiThreshold), 0) / (totalUsers || 1)

    return {
      totalUsers,
      customConfigs,
      avgBatchSize: Math.round(avgBatchSize),
      avgAiThreshold: Math.round(avgAiThreshold),
      cacheSize: configCache.size()
    }

  } catch (error) {
    console.error('❌ Error getting config stats:', error)
    return {
      totalUsers: 0,
      customConfigs: 0,
      avgBatchSize: DEFAULT_CONFIG.maxBatchSize,
      avgAiThreshold: DEFAULT_CONFIG.aiThreshold,
      cacheSize: configCache.size()
    }
  }
}

/**
 * Reset user configuration to defaults
 */
export async function resetUserConfig(userId: string): Promise<ProcessingConfig> {
  try {
    const supabase = await createClient()

    // Deactivate existing config
    await supabase
      .from('user_processing_config')
      .update({ active: false })
      .eq('user_id', userId)

    // Clear cache
    configCache.clear(userId)

    console.log(`✅ Reset config to defaults for user ${userId}`)
    return DEFAULT_CONFIG

  } catch (error) {
    console.error(`❌ Error resetting config for user ${userId}:`, error)
    throw error
  }
}

/**
 * Bulk update configurations (for admin operations)
 */
export async function bulkUpdateConfigs(updates: Array<{
  userId: string
  config: Partial<ProcessingConfig>
}>): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  for (const update of updates) {
    try {
      await updateUserConfig(update.userId, update.config)
      success++
    } catch (error) {
      console.error(`❌ Bulk update failed for user ${update.userId}:`, error)
      failed++
    }
  }

  console.log(`📊 Bulk config update complete: ${success} success, ${failed} failed`)
  return { success, failed }
}

/**
 * Configuration presets for common use cases
 */
export const CONFIG_PRESETS: Record<string, Partial<ProcessingConfig>> = {
  // Cost-conscious setup
  economical: {
    aiThreshold: 80, // Only highest priority emails get AI
    costBudgetCents: 50, // $0.50 daily budget
    maxCostPerEmail: 5, // 5 cents max
    maxBatchSize: 20, // Larger batches
    processVipImmediately: false
  },

  // Performance-focused setup
  performance: {
    aiThreshold: 40, // More AI processing
    costBudgetCents: 500, // $5 daily budget
    maxCostPerEmail: 25, // 25 cents max
    maxBatchSize: 5, // Smaller batches for speed
    processVipImmediately: true,
    processUrgentImmediately: true
  },

  // Balanced approach
  balanced: DEFAULT_CONFIG,

  // High-volume setup
  enterprise: {
    aiThreshold: 50,
    costBudgetCents: 2000, // $20 daily budget
    maxCostPerEmail: 15,
    maxBatchSize: 25,
    maxWaitTimeMs: 60000, // 1 minute batching
    enableCache: true,
    processVipImmediately: true
  }
}

/**
 * Apply a configuration preset to a user
 */
export async function applyConfigPreset(
  userId: string,
  presetName: keyof typeof CONFIG_PRESETS
): Promise<ProcessingConfig> {
  const preset = CONFIG_PRESETS[presetName]
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}`)
  }

  return await updateUserConfig(userId, preset)
}

/**
 * Health check for configuration system
 */
export async function configHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  cacheSize: number
  dbConnection: boolean
  lastUpdate?: Date
}> {
  try {
    // Test database connection
    const supabase = await createClient()
    const { error } = await supabase
      .from('user_processing_config')
      .select('updated_at')
      .limit(1)

    return {
      status: error ? 'degraded' : 'healthy',
      cacheSize: configCache.size(),
      dbConnection: !error,
      lastUpdate: new Date()
    }

  } catch (error) {
    return {
      status: 'unhealthy',
      cacheSize: configCache.size(),
      dbConnection: false
    }
  }
}