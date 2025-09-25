import { createClient } from '@/lib/supabase/server'
import { getUserGmailClient } from './auth'
import { gmail_v1 } from 'googleapis'

interface WebhookSubscription {
  userId: string
  topicName: string
  pushEndpoint: string
  subscriptionName: string
}

interface WebhookStats {
  totalNotifications: number
  successfulNotifications: number
  failedNotifications: number
  avgProcessingTimeMs: number
  totalEmailsProcessed: number
  successRate: number
}

/**
 * Gmail Webhook Management Utilities
 * Handles subscription creation, renewal, and monitoring
 */
export class GmailWebhookManager {
  private static instance: GmailWebhookManager
  private supabase: ReturnType<typeof createClient> | null = null

  private constructor() {}

  public static getInstance(): GmailWebhookManager {
    if (!GmailWebhookManager.instance) {
      GmailWebhookManager.instance = new GmailWebhookManager()
    }
    return GmailWebhookManager.instance
  }

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    return this.supabase
  }

  /**
   * Creates or renews a Gmail push notification subscription
   */
  async createPushSubscription(subscription: WebhookSubscription): Promise<boolean> {
    try {
      console.log('🔔 Creating Gmail push subscription for user:', subscription.userId)

      const gmail = await getUserGmailClient(subscription.userId)
      const supabase = await this.getSupabase()

      // Create the push subscription with Gmail API
      const watchResponse = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: subscription.topicName,
          labelIds: ['INBOX'], // Only watch INBOX for new emails
          labelFilterAction: 'include'
        }
      })

      if (!watchResponse.data.historyId) {
        throw new Error('Failed to create Gmail watch subscription')
      }

      // Calculate expiration time (Gmail subscriptions last ~7 days)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      // Store subscription in database
      const { error } = await supabase
        .from('gmail_push_subscriptions')
        .upsert({
          user_id: subscription.userId,
          subscription_name: subscription.subscriptionName,
          topic_name: subscription.topicName,
          push_endpoint: subscription.pushEndpoint,
          expires_at: expiresAt.toISOString(),
          history_id: watchResponse.data.historyId,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,subscription_name'
        })

      if (error) {
        console.error('❌ Failed to store subscription:', error)
        return false
      }

      console.log('✅ Push subscription created successfully')
      return true

    } catch (error) {
      console.error('❌ Failed to create push subscription:', error)
      await this.logSubscriptionError(subscription.userId, error)
      return false
    }
  }

  /**
   * Stops a Gmail push notification subscription
   */
  async stopPushSubscription(userId: string, subscriptionName?: string): Promise<boolean> {
    try {
      console.log('🛑 Stopping Gmail push subscription for user:', userId)

      const gmail = await getUserGmailClient(userId)
      const supabase = await this.getSupabase()

      // Stop the Gmail watch
      await gmail.users.stop({
        userId: 'me'
      })

      // Update subscription status in database
      const updateData: any = {
        status: 'cancelled',
        updated_at: new Date().toISOString()
      }

      let query = supabase
        .from('gmail_push_subscriptions')
        .update(updateData)
        .eq('user_id', userId)

      if (subscriptionName) {
        query = query.eq('subscription_name', subscriptionName)
      }

      const { error } = await query

      if (error) {
        console.error('❌ Failed to update subscription status:', error)
      }

      console.log('✅ Push subscription stopped successfully')
      return true

    } catch (error) {
      console.error('❌ Failed to stop push subscription:', error)
      await this.logSubscriptionError(userId, error)
      return false
    }
  }

  /**
   * Renews expiring subscriptions
   */
  async renewExpiringSubscriptions(): Promise<number> {
    try {
      const supabase = await this.getSupabase()

      // Find subscriptions expiring within 24 hours
      const { data: expiringSubscriptions } = await supabase
        .from('gmail_push_subscriptions')
        .select('*')
        .eq('status', 'active')
        .lt('expires_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())

      if (!expiringSubscriptions || expiringSubscriptions.length === 0) {
        return 0
      }

      console.log(`🔄 Renewing ${expiringSubscriptions.length} expiring subscriptions`)

      let renewedCount = 0

      for (const subscription of expiringSubscriptions) {
        const renewed = await this.createPushSubscription({
          userId: subscription.user_id,
          topicName: subscription.topic_name,
          pushEndpoint: subscription.push_endpoint,
          subscriptionName: subscription.subscription_name
        })

        if (renewed) {
          renewedCount++
        }
      }

      console.log(`✅ Renewed ${renewedCount}/${expiringSubscriptions.length} subscriptions`)
      return renewedCount

    } catch (error) {
      console.error('❌ Failed to renew expiring subscriptions:', error)
      return 0
    }
  }

  /**
   * Gets webhook processing statistics
   */
  async getWebhookStats(userId?: string, days: number = 7): Promise<WebhookStats> {
    try {
      const supabase = await this.getSupabase()

      const { data } = await supabase
        .rpc('get_webhook_stats', {
          p_user_id: userId || null,
          p_days: days
        })
        .single()

      return {
        totalNotifications: data?.total_notifications || 0,
        successfulNotifications: data?.successful_notifications || 0,
        failedNotifications: data?.failed_notifications || 0,
        avgProcessingTimeMs: data?.avg_processing_time_ms || 0,
        totalEmailsProcessed: data?.total_emails_processed || 0,
        successRate: data?.success_rate || 0
      }

    } catch (error) {
      console.error('❌ Failed to get webhook stats:', error)
      return {
        totalNotifications: 0,
        successfulNotifications: 0,
        failedNotifications: 0,
        avgProcessingTimeMs: 0,
        totalEmailsProcessed: 0,
        successRate: 0
      }
    }
  }

  /**
   * Gets active subscriptions for a user
   */
  async getActiveSubscriptions(userId: string) {
    try {
      const supabase = await this.getSupabase()

      const { data } = await supabase
        .from('gmail_push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      return data || []

    } catch (error) {
      console.error('❌ Failed to get active subscriptions:', error)
      return []
    }
  }

  /**
   * Cleans up old webhook logs
   */
  async cleanupOldLogs(): Promise<number> {
    try {
      const supabase = await this.getSupabase()

      const { data } = await supabase
        .rpc('cleanup_old_webhook_logs')
        .single()

      const deletedCount = data || 0
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old webhook logs`)
      }

      return deletedCount

    } catch (error) {
      console.error('❌ Failed to cleanup old webhook logs:', error)
      return 0
    }
  }

  /**
   * Records a webhook processing event
   */
  async logWebhookEvent(
    userId: string,
    historyId: string,
    status: 'success' | 'failed' | 'no_new_emails',
    emailCount: number = 0,
    processingTimeMs?: number,
    errorMessage?: string,
    retryCount: number = 0
  ): Promise<void> {
    try {
      const supabase = await this.getSupabase()

      await supabase
        .from('webhook_logs')
        .insert({
          user_id: userId,
          service: 'gmail',
          history_id: historyId,
          status,
          email_count: emailCount,
          processing_time_ms: processingTimeMs,
          error_message: errorMessage,
          retry_count: retryCount,
          processed_at: new Date().toISOString()
        })

      // Update subscription stats
      if (status === 'success') {
        await supabase
          .from('gmail_push_subscriptions')
          .update({
            last_notification_at: new Date().toISOString(),
            notification_count: supabase.sql`notification_count + 1`,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('status', 'active')
      } else if (status === 'failed') {
        await supabase
          .from('gmail_push_subscriptions')
          .update({
            error_count: supabase.sql`error_count + 1`,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('status', 'active')
      }

    } catch (error) {
      console.error('❌ Failed to log webhook event:', error)
      // Don't throw - logging should never break webhook processing
    }
  }

  /**
   * Logs subscription errors
   */
  private async logSubscriptionError(userId: string, error: any): Promise<void> {
    try {
      const supabase = await this.getSupabase()

      await supabase
        .from('webhook_logs')
        .insert({
          user_id: userId,
          service: 'gmail',
          status: 'failed',
          email_count: 0,
          error_message: error instanceof Error ? error.message : String(error),
          processed_at: new Date().toISOString()
        })

    } catch (logError) {
      console.error('❌ Failed to log subscription error:', logError)
    }
  }

  /**
   * Validates webhook configuration
   */
  async validateWebhookSetup(userId: string): Promise<{
    isValid: boolean
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    try {
      // Check if user has Gmail token
      const supabase = await this.getSupabase()
      const { data: gmailToken } = await supabase
        .from('gmail_tokens')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (!gmailToken) {
        issues.push('Gmail not connected')
        recommendations.push('Connect Gmail account to enable webhook notifications')
      }

      // Check for active subscriptions
      const activeSubscriptions = await this.getActiveSubscriptions(userId)
      if (activeSubscriptions.length === 0) {
        issues.push('No active webhook subscriptions')
        recommendations.push('Create a Gmail push notification subscription')
      }

      // Check subscription health
      for (const subscription of activeSubscriptions) {
        const expiresAt = new Date(subscription.expires_at)
        if (expiresAt < new Date()) {
          issues.push(`Subscription ${subscription.subscription_name} has expired`)
          recommendations.push('Renew expired subscription')
        }

        if (subscription.error_count > 10) {
          issues.push(`High error rate for subscription ${subscription.subscription_name}`)
          recommendations.push('Check webhook endpoint configuration and logs')
        }
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations
      }

    } catch (error) {
      return {
        isValid: false,
        issues: ['Failed to validate webhook setup'],
        recommendations: ['Check system logs and database connectivity']
      }
    }
  }
}

// Export singleton instance
export const gmailWebhookManager = GmailWebhookManager.getInstance()

// Utility types
export type { WebhookSubscription, WebhookStats }