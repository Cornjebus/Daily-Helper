/**
 * Automated Categorization Rules Engine
 * Allows users to define custom rules for email processing
 */

import { createClient } from '@/lib/supabase/server'
import { sseEventManager } from '@/app/api/realtime/route'

export type RuleTrigger =
  | 'sender_email'
  | 'sender_domain'
  | 'subject_contains'
  | 'subject_regex'
  | 'body_contains'
  | 'has_attachment'
  | 'is_unread'
  | 'score_threshold'
  | 'tier'

export type RuleAction =
  | 'set_priority'
  | 'set_tier'
  | 'add_label'
  | 'archive'
  | 'mark_read'
  | 'forward_to'
  | 'notify'
  | 'auto_reply'

export interface AutomationRule {
  id: string
  user_id: string
  name: string
  description?: string
  enabled: boolean
  trigger_type: RuleTrigger
  trigger_value: any
  trigger_operator?: 'equals' | 'contains' | 'regex' | 'greater_than' | 'less_than'
  action_type: RuleAction
  action_value: any
  priority: number // Order of execution
  created_at: string
  updated_at: string
  execution_count: number
  last_executed?: string
}

export class RulesEngine {
  private rules: Map<string, AutomationRule[]> = new Map()
  private ruleCache: Map<string, { rules: AutomationRule[], timestamp: number }> = new Map()
  private readonly CACHE_TTL = 60000 // 1 minute cache

  /**
   * Load user rules from database with caching
   */
  async loadUserRules(userId: string): Promise<AutomationRule[]> {
    // Check cache first
    const cached = this.ruleCache.get(userId)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.rules
    }

    const supabase = await createClient()

    // Create table if it doesn't exist
    await this.ensureRulesTableExists(supabase)

    const { data: rules, error } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true)
      .order('priority', { ascending: true })

    if (error) {
      console.error('Error loading automation rules:', error)
      return []
    }

    const userRules = rules || []

    // Update cache
    this.ruleCache.set(userId, { rules: userRules, timestamp: Date.now() })
    this.rules.set(userId, userRules)

    return userRules
  }

  /**
   * Apply rules to an email
   */
  async applyRules(
    userId: string,
    email: {
      id: string
      from_email?: string
      subject?: string
      snippet?: string
      has_attachments?: boolean
      is_unread?: boolean
      score?: number
      tier?: string
    }
  ): Promise<{ applied: RuleAction[], results: any[] }> {
    const rules = await this.loadUserRules(userId)
    const applied: RuleAction[] = []
    const results: any[] = []

    console.log(`🎯 Applying ${rules.length} rules to email ${email.id}`)

    for (const rule of rules) {
      if (this.evaluateTrigger(rule, email)) {
        console.log(`✅ Rule "${rule.name}" triggered for email ${email.id}`)

        const result = await this.executeAction(rule, email, userId)
        applied.push(rule.action_type)
        results.push(result)

        // Update rule execution stats
        await this.updateRuleStats(rule.id)

        // Notify UI of rule execution
        sseEventManager.broadcast({
          type: 'rule_executed',
          data: {
            userId,
            emailId: email.id,
            ruleName: rule.name,
            action: rule.action_type,
            timestamp: new Date().toISOString()
          }
        })
      }
    }

    return { applied, results }
  }

  /**
   * Evaluate if a rule trigger matches an email
   */
  private evaluateTrigger(rule: AutomationRule, email: any): boolean {
    switch (rule.trigger_type) {
      case 'sender_email':
        return this.compareValue(
          email.from_email?.toLowerCase(),
          rule.trigger_value?.toLowerCase(),
          rule.trigger_operator || 'equals'
        )

      case 'sender_domain':
        const domain = email.from_email?.split('@')[1]?.toLowerCase()
        return this.compareValue(
          domain,
          rule.trigger_value?.toLowerCase(),
          rule.trigger_operator || 'equals'
        )

      case 'subject_contains':
        return email.subject?.toLowerCase().includes(rule.trigger_value?.toLowerCase())

      case 'subject_regex':
        try {
          const regex = new RegExp(rule.trigger_value, 'i')
          return regex.test(email.subject || '')
        } catch {
          return false
        }

      case 'body_contains':
        return email.snippet?.toLowerCase().includes(rule.trigger_value?.toLowerCase())

      case 'has_attachment':
        return email.has_attachments === rule.trigger_value

      case 'is_unread':
        return email.is_unread === rule.trigger_value

      case 'score_threshold':
        return this.compareNumber(
          email.score || 0,
          rule.trigger_value,
          rule.trigger_operator || 'greater_than'
        )

      case 'tier':
        return email.tier === rule.trigger_value

      default:
        return false
    }
  }

  /**
   * Execute a rule action
   */
  private async executeAction(
    rule: AutomationRule,
    email: any,
    userId: string
  ): Promise<any> {
    const supabase = await createClient()

    switch (rule.action_type) {
      case 'set_priority':
        await supabase
          .from('emails')
          .update({ priority: rule.action_value })
          .eq('id', email.id)
        return { priority: rule.action_value }

      case 'set_tier':
        await supabase
          .from('email_scores')
          .update({ processing_tier: rule.action_value })
          .eq('email_id', email.id)
        return { tier: rule.action_value }

      case 'add_label':
        // Add to metadata
        const { data: current } = await supabase
          .from('emails')
          .select('metadata')
          .eq('id', email.id)
          .single()

        const labels = current?.metadata?.labels || []
        labels.push(rule.action_value)

        await supabase
          .from('emails')
          .update({
            metadata: { ...current?.metadata, labels, auto_labeled: true }
          })
          .eq('id', email.id)
        return { label: rule.action_value }

      case 'archive':
        await supabase
          .from('emails')
          .update({
            is_archived: true,
            archived_at: new Date().toISOString(),
            archived_by_rule: rule.id
          })
          .eq('id', email.id)
        return { archived: true }

      case 'mark_read':
        await supabase
          .from('emails')
          .update({ is_unread: false })
          .eq('id', email.id)
        return { marked_read: true }

      case 'notify':
        // Send notification (integrate with your notification system)
        console.log(`📢 Notification: ${rule.action_value} for email ${email.id}`)
        return { notified: true, message: rule.action_value }

      case 'auto_reply':
        // Store auto-reply request for later processing
        await supabase
          .from('pending_actions')
          .insert({
            user_id: userId,
            email_id: email.id,
            action_type: 'auto_reply',
            action_data: { template: rule.action_value },
            created_at: new Date().toISOString()
          })
        return { auto_reply_queued: true }

      case 'forward_to':
        // Store forward request for later processing
        await supabase
          .from('pending_actions')
          .insert({
            user_id: userId,
            email_id: email.id,
            action_type: 'forward',
            action_data: { to: rule.action_value },
            created_at: new Date().toISOString()
          })
        return { forward_queued: true, to: rule.action_value }

      default:
        return null
    }
  }

  /**
   * Helper: Compare values based on operator
   */
  private compareValue(value: any, target: any, operator: string): boolean {
    switch (operator) {
      case 'equals':
        return value === target
      case 'contains':
        return String(value).includes(String(target))
      case 'regex':
        try {
          return new RegExp(target).test(String(value))
        } catch {
          return false
        }
      default:
        return false
    }
  }

  /**
   * Helper: Compare numbers
   */
  private compareNumber(value: number, target: number, operator: string): boolean {
    switch (operator) {
      case 'greater_than':
        return value > target
      case 'less_than':
        return value < target
      case 'equals':
        return value === target
      default:
        return false
    }
  }

  /**
   * Update rule execution statistics
   */
  private async updateRuleStats(ruleId: string): Promise<void> {
    const supabase = await createClient()

    await supabase.rpc('increment_rule_execution', {
      rule_id: ruleId,
      executed_at: new Date().toISOString()
    })
  }

  /**
   * Ensure rules table exists
   */
  private async ensureRulesTableExists(supabase: any): Promise<void> {
    // This would normally be in a migration, but adding here for safety
    await supabase.rpc('create_automation_rules_if_not_exists')
      .catch(() => {
        // Table might already exist, that's okay
      })
  }

  /**
   * Create a new rule
   */
  async createRule(rule: Partial<AutomationRule>): Promise<AutomationRule | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('automation_rules')
      .insert({
        ...rule,
        execution_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating rule:', error)
      return null
    }

    // Clear cache for user
    if (rule.user_id) {
      this.ruleCache.delete(rule.user_id)
    }

    return data
  }

  /**
   * Update an existing rule
   */
  async updateRule(ruleId: string, updates: Partial<AutomationRule>): Promise<boolean> {
    const supabase = await createClient()

    const { error } = await supabase
      .from('automation_rules')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', ruleId)

    if (error) {
      console.error('Error updating rule:', error)
      return false
    }

    // Clear all caches (we don't know which user)
    this.ruleCache.clear()

    return true
  }

  /**
   * Delete a rule
   */
  async deleteRule(ruleId: string): Promise<boolean> {
    const supabase = await createClient()

    const { error } = await supabase
      .from('automation_rules')
      .delete()
      .eq('id', ruleId)

    if (error) {
      console.error('Error deleting rule:', error)
      return false
    }

    // Clear all caches
    this.ruleCache.clear()

    return true
  }

  /**
   * Get popular rule templates
   */
  getTemplates(): Partial<AutomationRule>[] {
    return [
      {
        name: 'Archive Marketing Emails',
        description: 'Automatically archive emails with marketing keywords',
        trigger_type: 'body_contains',
        trigger_value: 'unsubscribe',
        action_type: 'archive',
        action_value: true,
        priority: 10
      },
      {
        name: 'VIP Priority',
        description: 'Set high priority for emails from your boss',
        trigger_type: 'sender_email',
        trigger_value: 'boss@company.com',
        action_type: 'set_priority',
        action_value: 1,
        priority: 1
      },
      {
        name: 'Auto-Read Newsletters',
        description: 'Mark newsletters as read automatically',
        trigger_type: 'subject_contains',
        trigger_value: 'newsletter',
        action_type: 'mark_read',
        action_value: true,
        priority: 20
      },
      {
        name: 'High Score Alert',
        description: 'Get notified for very important emails',
        trigger_type: 'score_threshold',
        trigger_value: 90,
        trigger_operator: 'greater_than',
        action_type: 'notify',
        action_value: 'High priority email received!',
        priority: 5
      },
      {
        name: 'Weekend Archive',
        description: 'Archive all low-tier emails received on weekends',
        trigger_type: 'tier',
        trigger_value: 'low',
        action_type: 'archive',
        action_value: true,
        priority: 30
      }
    ]
  }
}

// Export singleton instance
export const rulesEngine = new RulesEngine()