export interface EmailScore {
  overall: number
  factors: {
    senderImportance: number
    contentUrgency: number
    userBehavior: number
    contextual: number
  }
  category: 'important' | 'chaos'
  suggestedAction: string
}

import { calculateEmailScore } from '@/lib/scoring/email-scorer'

export async function scoreEmailForJunie(userId: string, email: any): Promise<EmailScore> {
  // Reuse existing rule-based engine and map to new structure
  const result = await calculateEmailScore(userId, email)

  // Map factors to proposed dimensions (best-effort)
  const factors = {
    senderImportance: Math.max(0, result.factors.vipBoost + result.factors.gmailSignals),
    contentUrgency: Math.max(0, result.factors.urgentBoost),
    userBehavior: 0, // Placeholder: tie to future user_actions signals
    contextual: Math.max(0, result.factors.timeFactor)
  }

  const overall = result.finalScore
  const category: 'important' | 'chaos' = overall >= 60 ? 'important' : 'chaos'
  const suggestedAction = category === 'important' ? 'reply' : 'archive'

  return { overall, factors, category, suggestedAction }
}

