'use client'

import { cn } from '@/lib/utils'

interface JunieLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  animated?: boolean
}

export function JunieLogo({
  className,
  size = 'md',
  showText = true,
  animated = false
}: JunieLogoProps) {
  const sizes = {
    sm: { logo: 32, text: 'text-xl' },
    md: { logo: 48, text: 'text-3xl' },
    lg: { logo: 64, text: 'text-4xl' },
    xl: { logo: 96, text: 'text-6xl' }
  }

  const currentSize = sizes[size]

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Logo Icon - Chaos to Clarity */}
      <div className="relative">
        {/* Chaos side - tangled lines */}
        <svg
          width={currentSize.logo}
          height={currentSize.logo}
          viewBox="0 0 100 100"
          className={cn(
            'absolute inset-0',
            animated && 'chaos-swirl'
          )}
        >
          <defs>
            <linearGradient id="chaosGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6B7280" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#374151" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <g className="opacity-60">
            <path
              d="M20,30 Q40,10 30,50 T50,40 Q70,20 60,60"
              stroke="url(#chaosGradient)"
              strokeWidth="1.5"
              fill="none"
              opacity="0.7"
            />
            <path
              d="M15,40 Q35,20 25,60 T45,50 Q65,30 55,70"
              stroke="url(#chaosGradient)"
              strokeWidth="1.5"
              fill="none"
              opacity="0.5"
            />
            <path
              d="M25,20 Q45,40 35,30 T55,60 Q75,40 65,50"
              stroke="url(#chaosGradient)"
              strokeWidth="1.5"
              fill="none"
              opacity="0.6"
            />
          </g>
        </svg>

        {/* Clarity side - organized circles */}
        <svg
          width={currentSize.logo}
          height={currentSize.logo}
          viewBox="0 0 100 100"
          className={cn(
            'relative',
            animated && 'float'
          )}
        >
          <defs>
            <linearGradient id="junieGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5EEAD4" />
              <stop offset="25%" stopColor="#3B82F6" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="75%" stopColor="#EC4899" />
              <stop offset="100%" stopColor="#F97316" />
            </linearGradient>
          </defs>

          {/* Main circles representing clarity */}
          <circle
            cx="50"
            cy="50"
            r="30"
            stroke="url(#junieGradient)"
            strokeWidth="3"
            fill="none"
            strokeDasharray="0 5"
          />
          <circle
            cx="50"
            cy="50"
            r="20"
            stroke="url(#junieGradient)"
            strokeWidth="2.5"
            fill="none"
            strokeDasharray="0 4"
            opacity="0.8"
          />
          <circle
            cx="50"
            cy="50"
            r="10"
            stroke="url(#junieGradient)"
            strokeWidth="2"
            fill="none"
            strokeDasharray="0 3"
            opacity="0.6"
          />

          {/* Center dot */}
          <circle
            cx="50"
            cy="50"
            r="3"
            fill="url(#junieGradient)"
          />
        </svg>
      </div>

      {/* Text Logo */}
      {showText && (
        <div className="flex flex-col">
          <span className={cn(
            'font-bold tracking-tight junie-gradient-text',
            currentSize.text
          )}>
            Junie
          </span>
          <span className="text-xs text-muted-foreground -mt-1">
            Clarity in the Chaos
          </span>
        </div>
      )}
    </div>
  )
}

export function JunieIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
    >
      <defs>
        <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5EEAD4" />
          <stop offset="33%" stopColor="#3B82F6" />
          <stop offset="66%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>

      <circle
        cx="50"
        cy="50"
        r="35"
        stroke="url(#iconGradient)"
        strokeWidth="4"
        fill="none"
      />
      <circle
        cx="50"
        cy="50"
        r="20"
        stroke="url(#iconGradient)"
        strokeWidth="3"
        fill="none"
        opacity="0.7"
      />
      <circle
        cx="50"
        cy="50"
        r="5"
        fill="url(#iconGradient)"
      />
    </svg>
  )
}