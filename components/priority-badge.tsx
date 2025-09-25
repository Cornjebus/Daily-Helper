"use client"

import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, Archive } from 'lucide-react'

type Tier = 'high' | 'medium' | 'low'

export function PriorityBadge({ score, tier }: { score: number; tier: Tier }) {
  const config: Record<Tier, { variant: any; Icon: any; label: string }> = {
    high: { variant: 'destructive', Icon: AlertTriangle, label: 'HIGH' },
    medium: { variant: 'default', Icon: Clock, label: 'MEDIUM' },
    low: { variant: 'secondary', Icon: Archive, label: 'LOW' },
  }
  const { variant, Icon, label } = config[tier]
  return (
    <Badge variant={variant} className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {label}
      <span className="font-mono ml-1">{score}</span>
    </Badge>
  )
}

