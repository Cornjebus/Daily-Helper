// Learning system database types
export interface UserAction {
  id: string
  email_id: string
  user_id: string
  action: 'star' | 'archive' | 'reply' | 'delete' | 'read' | 'unread'
  timestamp: string
  email_score?: number
  sender_email?: string
  subject?: string
  patterns?: string[]
  created_at: string
}

export interface VipSender {
  id: string
  sender_email: string
  user_id: string
  vip_score: number
  confidence_score: number
  interaction_count: number
  created_at: string
  last_interaction: string
  updated_at: string
}

export interface EmailPattern {
  id: string
  pattern_name: string
  pattern_type: 'keyword' | 'sender' | 'subject' | 'content' | 'time' | 'urgency'
  weight: number
  sample_size: number
  effectiveness_score?: number
  created_at: string
  last_updated: string
  is_active: boolean
}

export interface PatternEffectiveness {
  id: string
  pattern_name: string
  effectiveness_score: number
  sample_size: number
  positive_actions: number
  negative_actions: number
  last_updated: string
}

export interface LearningMetrics {
  id: string
  metric_type: string
  metrics: {
    totalActions: number
    accuracyRate: number
    vipIdentificationRate: number
    patternEffectiveness: Record<string, number>
    lastUpdated: string
  }
  updated_at: string
}

// API Response types
export interface ActionTrackingResponse {
  success: boolean
  message?: string
  learningEnabled: boolean
  error?: string
}

export interface LearningStatisticsResponse {
  success: boolean
  statistics: {
    totalActions: number
    accuracyRate: number
    vipIdentificationRate: number
    patternEffectiveness: Record<string, number>
    lastUpdated: string
  } | null
  error?: string
}

export interface ActionHistoryResponse {
  success: boolean
  actions: UserAction[]
  count: number
  error?: string
}

// Learning engine types
export type ActionFeedback = 'positive' | 'negative' | 'neutral'

export interface ActionEvent {
  emailId: string
  action: 'star' | 'archive' | 'reply' | 'delete' | 'read' | 'unread'
  userId: string
  timestamp: Date
  emailScore?: number
  senderEmail?: string
  subject?: string
  patterns?: string[]
}

export interface PatternWeight {
  pattern: string
  weight: number
  confidence: number
  sampleSize: number
}

export interface LearningConfiguration {
  batchSize: number
  learningRate: number
  confidenceThreshold: number
  vipScoreThreshold: number
  patternWeightMin: number
  patternWeightMax: number
}