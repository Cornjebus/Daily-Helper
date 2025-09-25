import { createClient } from '@/lib/supabase/server'

type ScoreFactors = {
  base: number
  patternPenalties: number
  urgentBoost: number
  vipBoost: number
  gmailSignals: number
  timeFactor: number
}

type ScoringResult = {
  rawScore: number
  finalScore: number
  tier: 'high' | 'medium' | 'low'
  factors: ScoreFactors
}

const MARKETING_PATTERNS = [
  'unsubscribe', 'percent off', 'sale', 'deal', 'limited time', 'coupon',
  'newsletter', 'digest', 'promo', 'promotion', 'offer', 'clearance', 'flash sale'
]

const URGENT_PATTERNS = ['urgent', 'asap', 'immediately', 'deadline', 'overdue', 'critical']

export async function calculateEmailScore(userId: string, email: {
  id: string
  subject?: string | null
  from_email?: string | null
  snippet?: string | null
  is_important?: boolean | null
  is_starred?: boolean | null
  is_unread?: boolean | null
  received_at?: string | null
}): Promise<ScoringResult> {
  const base = 30
  const subject = (email.subject || '').toLowerCase()
  const snippet = (email.snippet || '').toLowerCase()
  const from = (email.from_email || '').toLowerCase()

  // Pattern penalties (marketing/newsletters)
  let patternPenalties = 0
  const haystack = `${subject} ${snippet}`
  if (MARKETING_PATTERNS.some(p => haystack.includes(p))) {
    patternPenalties -= 30
  }

  // Urgent boost
  let urgentBoost = 0
  if (URGENT_PATTERNS.some(p => subject.includes(p))) urgentBoost += 25

  // VIP boost (if sender is in vip_senders)
  let vipBoost = 0
  try {
    const supabase = await createClient()
    const { data: vip } = await supabase
      .from('vip_senders')
      .select('score_boost')
      .eq('user_id', userId)
      .eq('sender_email', email.from_email || '')
      .maybeSingle()
    if (vip?.score_boost) vipBoost += vip.score_boost
  } catch {}

  // Gmail signals
  let gmailSignals = 0
  if (email.is_important) gmailSignals += 20
  if (email.is_starred) gmailSignals += 15
  if (email.is_unread) gmailSignals += 10

  // Time factor
  let timeFactor = 0
  if (email.received_at) {
    const received = new Date(email.received_at)
    const diffHours = (Date.now() - received.getTime()) / (1000 * 60 * 60)
    if (diffHours < 2) timeFactor += 15
    else if (diffHours > 24) timeFactor -= 10
  }

  let raw = base + patternPenalties + urgentBoost + vipBoost + gmailSignals + timeFactor
  raw = Math.max(0, Math.min(100, raw))

  const finalScore = raw // For now; can adjust with AI later
  const tier: 'high' | 'medium' | 'low' = finalScore >= 80 ? 'high' : finalScore >= 40 ? 'medium' : 'low'

  return {
    rawScore: Math.round(raw),
    finalScore: Math.round(finalScore),
    tier,
    factors: {
      base,
      patternPenalties,
      urgentBoost,
      vipBoost,
      gmailSignals,
      timeFactor,
    }
  }
}

