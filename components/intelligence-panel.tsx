"use client"

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TrendingUp, Star, Clock as ClockIcon, Zap } from 'lucide-react'

type Factors = { base?: number; patternPenalties?: number; urgentBoost?: number; vipBoost?: number; gmailSignals?: number; timeFactor?: number }

export function IntelligencePanel({ emailId }: { emailId: string }) {
  const [data, setData] = useState<{ finalScore: number; tier: 'high' | 'medium' | 'low'; factors: Factors } | null>(null)

  useEffect(() => {
    fetch(`/api/ai/email/${emailId}/score`).then(r => r.json()).then(setData).catch(() => setData(null))
  }, [emailId])

  if (!data || typeof data.finalScore !== 'number') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Email Score Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No analysis available yet for this email. Try processing or backfilling scores.
          </div>
        </CardContent>
      </Card>
    )
  }

  const finalScore = typeof data.finalScore === 'number' ? data.finalScore : 0
  const tier = (data.tier === 'high' || data.tier === 'medium' || data.tier === 'low') ? data.tier : 'low'
  const factors = (data.factors || {}) as Factors
  const tierVariant = tier === 'high' ? 'destructive' : tier === 'medium' ? 'default' : 'secondary'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Email Score Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="font-mono">{finalScore}/100</Badge>
            <Badge variant={tierVariant as any}>{(tier || 'low').toUpperCase()}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center"><span className="text-sm">Base Score</span><span className="font-mono text-sm">+{factors.base ?? 0}</span></div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500" /><span className="text-sm">VIP Sender</span></div>
          <span className="font-mono text-sm text-green-600">+{factors.vipBoost ?? 0}</span>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-orange-500" /><span className="text-sm">Urgent Keywords</span></div>
          <span className="font-mono text-sm text-green-600">+{factors.urgentBoost ?? 0}</span>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2"><ClockIcon className="h-4 w-4 text-blue-500" /><span className="text-sm">Time Factor</span></div>
          <span className="font-mono text-sm text-green-600">{(factors.timeFactor ?? 0) >= 0 ? '+' : ''}{factors.timeFactor ?? 0}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">Pattern Penalties</span>
          <span className="font-mono text-sm text-red-600">{factors.patternPenalties ?? 0}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm">Gmail Signals</span>
          <span className="font-mono text-sm text-green-600">+{factors.gmailSignals ?? 0}</span>
        </div>
        <Separator />
        <div className="flex justify-between items-center pt-2">
          <span className="text-sm font-medium">AI Confidence</span>
          <Badge variant="outline">94%</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
