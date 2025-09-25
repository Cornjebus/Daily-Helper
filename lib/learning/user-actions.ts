import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/utils'

export type UserAction = 'star' | 'archive' | 'reply' | 'delete' | 'read' | 'unread'
export type ActionFeedback = 'positive' | 'negative' | 'neutral'

interface ActionEvent {
  emailId: string
  action: UserAction
  userId: string
  timestamp: Date
  emailScore?: number
  senderEmail?: string
  subject?: string
  patterns?: string[]
}

interface LearningMetrics {
  totalActions: number
  accuracyRate: number
  vipIdentificationRate: number
  patternEffectiveness: Record<string, number>
  lastUpdated: Date
}

interface PatternWeight {
  pattern: string
  weight: number
  confidence: number
  sampleSize: number
}

export class UserActionLearningEngine {
  private static instance: UserActionLearningEngine
  private learningBuffer: ActionEvent[] = []
  private batchSize = 50
  private learningRate = 0.1

  static getInstance(): UserActionLearningEngine {
    if (!UserActionLearningEngine.instance) {
      UserActionLearningEngine.instance = new UserActionLearningEngine()
    }
    return UserActionLearningEngine.instance
  }

  /**
   * Track a user action and trigger learning
   */
  async trackAction(event: ActionEvent): Promise<void> {
    try {
      // Store the action in database
      await this.storeAction(event)

      // Add to learning buffer
      this.learningBuffer.push(event)

      // Immediate learning for high-impact actions
      if (this.isHighImpactAction(event.action)) {
        await this.processActionLearning(event)
      }

      // Batch processing when buffer is full
      if (this.learningBuffer.length >= this.batchSize) {
        await this.processBatchLearning()
      }
    } catch (error) {
      logError('Failed to track user action', error)
    }
  }

  /**
   * Store action in database for historical tracking
   */
  private async storeAction(event: ActionEvent): Promise<void> {
    const { error } = await supabase
      .from('user_actions')
      .insert({
        email_id: event.emailId,
        user_id: event.userId,
        action: event.action,
        timestamp: event.timestamp.toISOString(),
        email_score: event.emailScore,
        sender_email: event.senderEmail,
        subject: event.subject,
        patterns: event.patterns
      })

    if (error) {
      throw new Error(`Failed to store action: ${error.message}`)
    }
  }

  /**
   * Process individual action for immediate learning
   */
  private async processActionLearning(event: ActionEvent): Promise<void> {
    const feedback = this.deriveActionFeedback(event.action)

    // Update VIP status based on positive actions
    if (feedback === 'positive' && event.senderEmail) {
      await this.updateVipStatus(event.senderEmail, event.userId, feedback)
    }

    // Adjust pattern weights based on action
    if (event.patterns && event.emailScore !== undefined) {
      await this.adjustPatternWeights(event.patterns, feedback, event.emailScore)
    }
  }

  /**
   * Process batch learning for accumulated actions
   */
  private async processBatchLearning(): Promise<void> {
    try {
      const batch = [...this.learningBuffer]
      this.learningBuffer = []

      // Group actions by sender for VIP analysis
      const senderActions = this.groupActionsBySender(batch)
      await this.batchUpdateVipStatus(senderActions)

      // Analyze pattern effectiveness
      await this.analyzePatternEffectiveness(batch)

      // Update learning metrics
      await this.updateLearningMetrics(batch)

    } catch (error) {
      logError('Batch learning failed', error)
    }
  }

  /**
   * Derive feedback type from user action
   */
  private deriveActionFeedback(action: UserAction): ActionFeedback {
    const feedbackMap: Record<UserAction, ActionFeedback> = {
      star: 'positive',
      reply: 'positive',
      read: 'neutral',
      archive: 'negative',
      delete: 'negative',
      unread: 'negative'
    }
    return feedbackMap[action]
  }

  /**
   * Update VIP status based on user interactions
   */
  private async updateVipStatus(
    senderEmail: string,
    userId: string,
    feedback: ActionFeedback
  ): Promise<void> {
    try {
      // Get current VIP status
      const { data: currentVip } = await supabase
        .from('vip_senders')
        .select('*')
        .eq('sender_email', senderEmail)
        .eq('user_id', userId)
        .single()

      if (currentVip) {
        // Update existing VIP record
        const newScore = this.calculateNewVipScore(currentVip.vip_score, feedback)
        const newConfidence = this.updateConfidence(
          currentVip.confidence_score,
          feedback,
          currentVip.interaction_count + 1
        )

        await supabase
          .from('vip_senders')
          .update({
            vip_score: newScore,
            confidence_score: newConfidence,
            interaction_count: currentVip.interaction_count + 1,
            last_interaction: new Date().toISOString()
          })
          .eq('sender_email', senderEmail)
          .eq('user_id', userId)
      } else if (feedback === 'positive') {
        // Create new VIP record for positive interactions
        await supabase
          .from('vip_senders')
          .insert({
            sender_email: senderEmail,
            user_id: userId,
            vip_score: 0.7, // Initial positive score
            confidence_score: 0.3, // Low initial confidence
            interaction_count: 1,
            created_at: new Date().toISOString(),
            last_interaction: new Date().toISOString()
          })
      }
    } catch (error) {
      logError('Failed to update VIP status', error)
    }
  }

  /**
   * Adjust pattern weights based on action feedback
   */
  private async adjustPatternWeights(
    patterns: string[],
    feedback: ActionFeedback,
    emailScore: number
  ): Promise<void> {
    try {
      for (const pattern of patterns) {
        const { data: currentPattern } = await supabase
          .from('email_patterns')
          .select('*')
          .eq('pattern_name', pattern)
          .single()

        if (currentPattern) {
          const adjustment = this.calculatePatternAdjustment(feedback, emailScore)
          const newWeight = Math.max(0.1, Math.min(2.0,
            currentPattern.weight + adjustment * this.learningRate
          ))

          await supabase
            .from('email_patterns')
            .update({
              weight: newWeight,
              sample_size: currentPattern.sample_size + 1,
              last_updated: new Date().toISOString()
            })
            .eq('pattern_name', pattern)
        }
      }
    } catch (error) {
      logError('Failed to adjust pattern weights', error)
    }
  }

  /**
   * Calculate new VIP score based on feedback
   */
  private calculateNewVipScore(currentScore: number, feedback: ActionFeedback): number {
    const adjustments = {
      positive: 0.1,
      neutral: 0.0,
      negative: -0.05
    }

    const newScore = currentScore + adjustments[feedback]
    return Math.max(0.0, Math.min(1.0, newScore))
  }

  /**
   * Update confidence score based on interaction count
   */
  private updateConfidence(
    currentConfidence: number,
    feedback: ActionFeedback,
    interactionCount: number
  ): number {
    // Confidence increases with more interactions
    const baseConfidence = Math.min(0.9, interactionCount * 0.05)

    // Positive feedback increases confidence more than negative
    const feedbackMultiplier = feedback === 'positive' ? 1.1 :
                              feedback === 'negative' ? 0.9 : 1.0

    return Math.min(1.0, baseConfidence * feedbackMultiplier)
  }

  /**
   * Calculate pattern weight adjustment
   */
  private calculatePatternAdjustment(feedback: ActionFeedback, emailScore: number): number {
    const baseFeedback = {
      positive: 0.1,
      neutral: 0.0,
      negative: -0.1
    }[feedback]

    // Higher scores with positive feedback get bigger boosts
    // Lower scores with negative feedback get bigger penalties
    const scoreMultiplier = feedback === 'positive' ? emailScore : (1 - emailScore)

    return baseFeedback * scoreMultiplier
  }

  /**
   * Group actions by sender for batch processing
   */
  private groupActionsBySender(actions: ActionEvent[]): Record<string, ActionEvent[]> {
    return actions.reduce((groups, action) => {
      if (action.senderEmail) {
        if (!groups[action.senderEmail]) {
          groups[action.senderEmail] = []
        }
        groups[action.senderEmail].push(action)
      }
      return groups
    }, {} as Record<string, ActionEvent[]>)
  }

  /**
   * Batch update VIP status for multiple senders
   */
  private async batchUpdateVipStatus(
    senderActions: Record<string, ActionEvent[]>
  ): Promise<void> {
    const promises = Object.entries(senderActions).map(([senderEmail, actions]) => {
      const userId = actions[0].userId
      const feedback = this.aggregateActionFeedback(actions)
      return this.updateVipStatus(senderEmail, userId, feedback)
    })

    await Promise.all(promises)
  }

  /**
   * Aggregate feedback from multiple actions
   */
  private aggregateActionFeedback(actions: ActionEvent[]): ActionFeedback {
    const feedbackScores = actions.map(action => {
      const feedback = this.deriveActionFeedback(action.action)
      return feedback === 'positive' ? 1 : feedback === 'negative' ? -1 : 0
    })

    const averageScore = feedbackScores.reduce((sum, score) => sum + score, 0) / feedbackScores.length

    if (averageScore > 0.2) return 'positive'
    if (averageScore < -0.2) return 'negative'
    return 'neutral'
  }

  /**
   * Analyze pattern effectiveness across actions
   */
  private async analyzePatternEffectiveness(actions: ActionEvent[]): Promise<void> {
    const patternStats: Record<string, { positive: number; negative: number; total: number }> = {}

    // Collect pattern statistics
    actions.forEach(action => {
      if (action.patterns) {
        const feedback = this.deriveActionFeedback(action.action)
        action.patterns.forEach(pattern => {
          if (!patternStats[pattern]) {
            patternStats[pattern] = { positive: 0, negative: 0, total: 0 }
          }
          patternStats[pattern].total++
          if (feedback === 'positive') patternStats[pattern].positive++
          if (feedback === 'negative') patternStats[pattern].negative++
        })
      }
    })

    // Update pattern effectiveness scores
    const promises = Object.entries(patternStats).map(([pattern, stats]) => {
      const effectiveness = (stats.positive - stats.negative) / stats.total
      return this.updatePatternEffectiveness(pattern, effectiveness, stats.total)
    })

    await Promise.all(promises)
  }

  /**
   * Update pattern effectiveness in database
   */
  private async updatePatternEffectiveness(
    pattern: string,
    effectiveness: number,
    sampleSize: number
  ): Promise<void> {
    try {
      await supabase
        .from('pattern_effectiveness')
        .upsert({
          pattern_name: pattern,
          effectiveness_score: effectiveness,
          sample_size: sampleSize,
          last_updated: new Date().toISOString()
        })
    } catch (error) {
      logError('Failed to update pattern effectiveness', error)
    }
  }

  /**
   * Update overall learning metrics
   */
  private async updateLearningMetrics(actions: ActionEvent[]): Promise<void> {
    try {
      const metrics: LearningMetrics = {
        totalActions: actions.length,
        accuracyRate: await this.calculateAccuracyRate(),
        vipIdentificationRate: await this.calculateVipIdentificationRate(),
        patternEffectiveness: await this.getPatternEffectivenessMap(),
        lastUpdated: new Date()
      }

      await supabase
        .from('learning_metrics')
        .upsert({
          metric_type: 'user_actions',
          metrics: metrics,
          updated_at: new Date().toISOString()
        })
    } catch (error) {
      logError('Failed to update learning metrics', error)
    }
  }

  /**
   * Calculate model accuracy based on user feedback
   */
  private async calculateAccuracyRate(): Promise<number> {
    try {
      const { data: actions } = await supabase
        .from('user_actions')
        .select('action, email_score')
        .not('email_score', 'is', null)
        .limit(1000)
        .order('timestamp', { ascending: false })

      if (!actions || actions.length === 0) return 0

      let accurateCount = 0
      actions.forEach(action => {
        const feedback = this.deriveActionFeedback(action.action as UserAction)
        const expectedPositive = (action.email_score || 0) > 0.7
        const actualPositive = feedback === 'positive'

        if (expectedPositive === actualPositive) {
          accurateCount++
        }
      })

      return accurateCount / actions.length
    } catch (error) {
      logError('Failed to calculate accuracy rate', error)
      return 0
    }
  }

  /**
   * Calculate VIP identification success rate
   */
  private async calculateVipIdentificationRate(): Promise<number> {
    try {
      const { data: vipActions } = await supabase
        .from('user_actions')
        .select(`
          action,
          sender_email,
          vip_senders!inner(vip_score)
        `)
        .limit(500)
        .order('timestamp', { ascending: false })

      if (!vipActions || vipActions.length === 0) return 0

      let correctIdentifications = 0
      vipActions.forEach(action => {
        const feedback = this.deriveActionFeedback(action.action as UserAction)
        const isVip = (action.vip_senders as any)?.vip_score > 0.6

        if ((feedback === 'positive' && isVip) || (feedback === 'negative' && !isVip)) {
          correctIdentifications++
        }
      })

      return correctIdentifications / vipActions.length
    } catch (error) {
      logError('Failed to calculate VIP identification rate', error)
      return 0
    }
  }

  /**
   * Get pattern effectiveness mapping
   */
  private async getPatternEffectivenessMap(): Promise<Record<string, number>> {
    try {
      const { data: patterns } = await supabase
        .from('pattern_effectiveness')
        .select('pattern_name, effectiveness_score')

      if (!patterns) return {}

      return patterns.reduce((map, pattern) => {
        map[pattern.pattern_name] = pattern.effectiveness_score
        return map
      }, {} as Record<string, number>)
    } catch (error) {
      logError('Failed to get pattern effectiveness', error)
      return {}
    }
  }

  /**
   * Check if action requires immediate learning
   */
  private isHighImpactAction(action: UserAction): boolean {
    return ['star', 'reply', 'delete'].includes(action)
  }

  /**
   * Get learning statistics for dashboard
   */
  async getLearningStatistics(): Promise<LearningMetrics | null> {
    try {
      const { data } = await supabase
        .from('learning_metrics')
        .select('metrics')
        .eq('metric_type', 'user_actions')
        .single()

      return data?.metrics || null
    } catch (error) {
      logError('Failed to get learning statistics', error)
      return null
    }
  }

  /**
   * Process historical actions for initial learning
   */
  async processHistoricalActions(userId: string, limit: number = 1000): Promise<void> {
    try {
      const { data: actions } = await supabase
        .from('user_actions')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (!actions) return

      const actionEvents = actions.map(action => ({
        emailId: action.email_id,
        action: action.action as UserAction,
        userId: action.user_id,
        timestamp: new Date(action.timestamp),
        emailScore: action.email_score,
        senderEmail: action.sender_email,
        subject: action.subject,
        patterns: action.patterns
      }))

      // Process in batches to avoid overwhelming the system
      const batchSize = 100
      for (let i = 0; i < actionEvents.length; i += batchSize) {
        const batch = actionEvents.slice(i, i + batchSize)
        await this.analyzePatternEffectiveness(batch)

        // Process VIP updates
        const senderActions = this.groupActionsBySender(batch)
        await this.batchUpdateVipStatus(senderActions)
      }

      await this.updateLearningMetrics(actionEvents)
    } catch (error) {
      logError('Failed to process historical actions', error)
    }
  }
}

// Export singleton instance
export const learningEngine = UserActionLearningEngine.getInstance()