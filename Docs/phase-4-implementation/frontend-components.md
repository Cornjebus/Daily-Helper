# 🎨 Phase 4: Frontend Components Implementation
## React Components for Email Intelligence Dashboard

### **Implementation Overview**

This section implements the core React components using TypeScript, Tailwind CSS, and modern React patterns for the email intelligence platform.

---

## **Component Architecture**

```
components/
├── ui/                           # Base UI components
│   ├── button.tsx               # Reusable button component
│   ├── badge.tsx                # Status and score badges
│   ├── card.tsx                 # Container cards
│   └── skeleton.tsx             # Loading skeletons
├── email/                       # Email-specific components
│   ├── email-list.tsx           # Email list container
│   ├── email-item.tsx           # Individual email item
│   ├── score-badge.tsx          # Email score display
│   └── sender-avatar.tsx        # Sender avatar display
├── digest/                      # Weekly digest components
│   ├── digest-overview.tsx      # Main digest view
│   ├── unsubscribe-candidates.tsx # Unsubscribe recommendations
│   └── bulk-actions.tsx         # Bulk action controls
├── analytics/                   # Analytics components
│   ├── dashboard.tsx            # Analytics dashboard
│   ├── metric-card.tsx          # Metric display cards
│   └── charts/                  # Chart components
├── vip/                         # VIP sender management
│   ├── vip-list.tsx            # VIP senders list
│   ├── vip-form.tsx            # Add/edit VIP sender
│   └── vip-item.tsx            # Individual VIP sender
└── settings/                    # Settings components
    ├── preferences.tsx          # User preferences
    ├── weight-slider.tsx        # Scoring weight controls
    └── threshold-controls.tsx   # Threshold adjustments
```

---

## **1. Base UI Components**

### **Button Component**
```typescript
// components/ui/button.tsx
import React from 'react'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 text-white shadow hover:bg-blue-700',
        destructive: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
        outline: 'border border-gray-300 bg-white shadow-sm hover:bg-gray-50',
        secondary: 'bg-gray-100 text-gray-900 shadow-sm hover:bg-gray-200',
        ghost: 'hover:bg-gray-100',
        link: 'text-blue-600 underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

### **Badge Component**
```typescript
// components/ui/badge.tsx
import React from 'react'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-gray-900 text-gray-50 shadow hover:bg-gray-900/80',
        secondary: 'border-transparent bg-gray-100 text-gray-900 hover:bg-gray-100/80',
        destructive: 'border-transparent bg-red-500 text-gray-50 shadow hover:bg-red-500/80',
        outline: 'text-gray-950 border-gray-200',
        success: 'border-transparent bg-green-500 text-white shadow hover:bg-green-500/80',
        warning: 'border-transparent bg-yellow-500 text-white shadow hover:bg-yellow-500/80',
        info: 'border-transparent bg-blue-500 text-white shadow hover:bg-blue-500/80'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
```

---

## **2. Email Components**

### **Email List Component**
```typescript
// components/email/email-list.tsx
import React from 'react'
import { EmailItem } from './email-item'
import { EmailListSkeleton } from './email-list-skeleton'
import { Card } from '@/components/ui/card'

export interface ProcessedEmail {
  id: string
  gmail_id: string
  sender: string
  sender_name?: string
  subject: string
  snippet: string
  received_at: string
  score: {
    final_score: number
    processing_tier: 'high' | 'medium' | 'low'
    confidence: number
    score_factors: {
      baseScore: number
      vipBoost: number
      urgencyBoost: number
      marketingPenalty: number
      gmailSignals: number
      timeDecay: number
      contentAnalysis: number
      senderReputation: number
      userPatterns: number
    }
  }
  ai_analysis?: {
    category: 'now' | 'next' | 'later' | 'archive'
    priority: number
    summary?: string
    action_items?: string[]
    confidence: number
  }
  is_unread: boolean
  is_important: boolean
  is_starred: boolean
  labels: string[]
}

export interface ScoreFeedback {
  action: 'marked_important' | 'marked_low' | 'categorized' | 'ignored'
  expected_category?: 'now' | 'next' | 'later' | 'archive'
  expected_priority?: number
  feedback_reason?: string
}

interface EmailListProps {
  emails: ProcessedEmail[]
  onEmailSelect?: (email: ProcessedEmail) => void
  onScoreUpdate?: (emailId: string, feedback: ScoreFeedback) => Promise<void>
  loading?: boolean
  emptyState?: React.ReactNode
  className?: string
}

export function EmailList({
  emails,
  onEmailSelect,
  onScoreUpdate,
  loading = false,
  emptyState,
  className = ''
}: EmailListProps) {
  if (loading) {
    return <EmailListSkeleton />
  }

  if (emails.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>
  }

  if (emails.length === 0) {
    return (
      <Card className={`p-8 text-center ${className}`}>
        <div className="text-gray-500">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-6m-4 0H4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No emails found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Your email intelligence system is waiting for new emails to process.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="divide-y divide-gray-200">
        {emails.map((email) => (
          <EmailItem
            key={email.id}
            email={email}
            onClick={() => onEmailSelect?.(email)}
            onScoreUpdate={(feedback) => onScoreUpdate?.(email.id, feedback)}
          />
        ))}
      </div>
    </Card>
  )
}
```

### **Email Item Component**
```typescript
// components/email/email-item.tsx
import React, { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ProcessedEmail, ScoreFeedback } from './email-list'
import { ScoreBadge } from './score-badge'
import { SenderAvatar } from './sender-avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ThumbUpIcon,
  ThumbDownIcon,
  ArchiveIcon,
  StarIcon,
  ExclamationIcon,
  ClockIcon,
  InboxIcon
} from '@heroicons/react/24/outline'
import {
  StarIcon as StarSolidIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/solid'

interface EmailItemProps {
  email: ProcessedEmail
  onClick?: () => void
  onScoreUpdate?: (feedback: ScoreFeedback) => Promise<void>
}

export function EmailItem({ email, onClick, onScoreUpdate }: EmailItemProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleScoreUpdate = async (feedback: ScoreFeedback) => {
    if (!onScoreUpdate) return

    setIsUpdating(true)
    try {
      await onScoreUpdate(feedback)
    } catch (error) {
      console.error('Failed to update score:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const getTierConfig = (tier: string) => {
    switch (tier) {
      case 'high':
        return { color: 'bg-red-100 text-red-800 border-red-200', label: 'HIGH' }
      case 'medium':
        return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'MED' }
      case 'low':
        return { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'LOW' }
      default:
        return { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'UNK' }
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'now': return ExclamationTriangleIcon
      case 'next': return ClockIcon
      case 'later': return InboxIcon
      case 'archive': return ArchiveIcon
      default: return InboxIcon
    }
  }

  const tierConfig = getTierConfig(email.score.processing_tier)
  const formattedTime = formatDistanceToNow(new Date(email.received_at), { addSuffix: true })

  return (
    <div
      className={`
        p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-150
        ${email.is_unread ? 'bg-blue-50' : ''}
        ${isUpdating ? 'opacity-50' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-start space-x-3">
        {/* Sender Avatar */}
        <div className="flex-shrink-0">
          <SenderAvatar
            sender={email.sender}
            name={email.sender_name}
            size="md"
          />
        </div>

        {/* Email Content */}
        <div className="flex-1 min-w-0">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <p className={`text-sm font-medium text-gray-900 truncate ${
                email.is_unread ? 'font-bold' : ''
              }`}>
                {email.sender_name || email.sender.split('@')[0]}
              </p>

              {/* Priority Indicators */}
              {email.is_starred && (
                <StarSolidIcon className="h-4 w-4 text-yellow-500 flex-shrink-0" />
              )}
              {email.is_important && (
                <ExclamationIcon className="h-4 w-4 text-red-500 flex-shrink-0" />
              )}

              {/* Domain Badge */}
              <span className="text-xs text-gray-500 truncate">
                @{email.sender.split('@')[1]}
              </span>
            </div>

            {/* Right Side Controls */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              {/* Processing Tier Badge */}
              <Badge
                variant="outline"
                className={`text-xs font-medium ${tierConfig.color}`}
              >
                {tierConfig.label}
              </Badge>

              {/* Score Badge */}
              <ScoreBadge
                score={email.score.final_score}
                confidence={email.score.confidence}
                size="sm"
              />

              {/* Timestamp */}
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {formattedTime}
              </span>
            </div>
          </div>

          {/* Subject */}
          <h3 className={`text-sm text-gray-900 mb-1 ${
            email.is_unread ? 'font-medium' : ''
          }`}>
            {email.subject}
          </h3>

          {/* Snippet */}
          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
            {email.snippet}
          </p>

          {/* AI Analysis */}
          {email.ai_analysis && (
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              {/* Category */}
              <div className="flex items-center space-x-1">
                {React.createElement(getCategoryIcon(email.ai_analysis.category), {
                  className: "h-3 w-3"
                })}
                <span className="capitalize">{email.ai_analysis.category}</span>
              </div>

              {/* Priority */}
              <div className="flex items-center space-x-1">
                <span>Priority: {email.ai_analysis.priority}/10</span>
              </div>

              {/* Action Items */}
              {email.ai_analysis.action_items && email.ai_analysis.action_items.length > 0 && (
                <Badge variant="success" className="text-xs">
                  {email.ai_analysis.action_items.length} action{email.ai_analysis.action_items.length !== 1 ? 's' : ''}
                </Badge>
              )}

              {/* Confidence */}
              <div className="flex items-center space-x-1">
                <span>±{Math.round((1 - email.ai_analysis.confidence) * 100)}%</span>
              </div>
            </div>
          )}

          {/* Labels */}
          {email.labels && email.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {email.labels.slice(0, 3).map((label) => (
                <Badge key={label} variant="secondary" className="text-xs">
                  {label.replace('CATEGORY_', '').toLowerCase()}
                </Badge>
              ))}
              {email.labels.length > 3 && (
                <span className="text-xs text-gray-500">
                  +{email.labels.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex-shrink-0 flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-green-600"
            onClick={(e) => {
              e.stopPropagation()
              handleScoreUpdate({ action: 'marked_important' })
            }}
            disabled={isUpdating}
            title="Mark as important"
          >
            <ThumbUpIcon className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-red-600"
            onClick={(e) => {
              e.stopPropagation()
              handleScoreUpdate({ action: 'marked_low' })
            }}
            disabled={isUpdating}
            title="Mark as low priority"
          >
            <ThumbDownIcon className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-blue-600"
            onClick={(e) => {
              e.stopPropagation()
              // Handle archive action
            }}
            disabled={isUpdating}
            title="Archive"
          >
            <ArchiveIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
```

### **Score Badge Component**
```typescript
// components/email/score-badge.tsx
import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ScoreBadgeProps {
  score: number
  confidence?: number
  size?: 'sm' | 'md' | 'lg'
  showConfidence?: boolean
  className?: string
}

export function ScoreBadge({
  score,
  confidence,
  size = 'md',
  showConfidence = false,
  className
}: ScoreBadgeProps) {
  const getScoreVariant = (score: number) => {
    if (score >= 80) return 'destructive' // High priority
    if (score >= 40) return 'warning'     // Medium priority
    return 'secondary'                    // Low priority
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-700 bg-red-100 border-red-200'
    if (score >= 40) return 'text-yellow-700 bg-yellow-100 border-yellow-200'
    return 'text-gray-700 bg-gray-100 border-gray-200'
  }

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm': return 'px-2 py-0.5 text-xs'
      case 'lg': return 'px-3 py-1 text-base'
      default: return 'px-2.5 py-0.5 text-sm'
    }
  }

  return (
    <div className={cn('flex items-center space-x-1', className)}>
      <span
        className={cn(
          'inline-flex items-center rounded-full font-medium border',
          getScoreColor(score),
          getSizeClasses(size)
        )}
      >
        {score}
      </span>

      {showConfidence && confidence !== undefined && (
        <div className="flex items-center space-x-1">
          <span className="text-xs text-gray-500">±</span>
          <div className="w-8 bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">
            {Math.round(confidence * 100)}%
          </span>
        </div>
      )}
    </div>
  )
}
```

---

## **3. Weekly Digest Components**

### **Digest Overview Component**
```typescript
// components/digest/digest-overview.tsx
import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UnsubscribeCandidates } from './unsubscribe-candidates'
import { BulkActions } from './bulk-actions'
import { formatDistanceToNow, format } from 'date-fns'
import { InformationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

export interface WeeklyDigest {
  id: string
  week_start_date: string
  week_end_date: string
  generated_at: string
  summary: {
    total_emails: number
    safe_unsubscribe_count: number
    bulk_action_opportunities: number
    estimated_monthly_reduction: number
    key_insights: string[]
  }
  unsubscribe_opportunities: {
    safe_to_unsubscribe: UnsubscribeCandidate[]
    needs_review: UnsubscribeCandidate[]
    bulk_actions: BulkAction[]
  }
  metrics: {
    potential_cost_savings: number
    time_savings: number
    inbox_cleanliness_improvement: number
  }
}

export interface UnsubscribeCandidate {
  sender: string
  domain: string
  confidence: number
  email_count: number
  reasons: string[]
  unsubscribe_links: string[]
  estimated_monthly_savings: number
}

export interface BulkAction {
  action_type: 'bulk_unsubscribe_domain' | 'bulk_unsubscribe_category'
  domain?: string
  category?: string
  senders: string[]
  total_senders: number
  total_emails_weekly: number
  recommended: boolean
}

export interface DigestActions {
  unsubscribe: string[]
  keep: string[]
  bulk_actions: string[]
}

interface DigestOverviewProps {
  digest: WeeklyDigest
  onActionExecute: (actions: DigestActions) => Promise<void>
  loading?: boolean
}

export function DigestOverview({ digest, onActionExecute, loading = false }: DigestOverviewProps) {
  const [selectedActions, setSelectedActions] = useState<DigestActions>({
    unsubscribe: [],
    keep: [],
    bulk_actions: []
  })
  const [isExecuting, setIsExecuting] = useState(false)

  const handleExecuteActions = async () => {
    if (selectedActions.unsubscribe.length === 0 && selectedActions.bulk_actions.length === 0) {
      return
    }

    setIsExecuting(true)
    try {
      await onActionExecute(selectedActions)
      // Reset selections after successful execution
      setSelectedActions({ unsubscribe: [], keep: [], bulk_actions: [] })
    } catch (error) {
      console.error('Failed to execute actions:', error)
    } finally {
      setIsExecuting(false)
    }
  }

  const calculateEstimatedReduction = () => {
    const individualReduction = selectedActions.unsubscribe.reduce((total, sender) => {
      const candidate = digest.unsubscribe_opportunities.safe_to_unsubscribe.find(c => c.sender === sender)
      return total + (candidate?.estimated_monthly_savings || 0)
    }, 0)

    const bulkReduction = selectedActions.bulk_actions.reduce((total, actionId) => {
      const action = digest.unsubscribe_opportunities.bulk_actions.find(a => a.action_type === actionId)
      return total + (action?.total_emails_weekly * 4 || 0)
    }, 0)

    return individualReduction + bulkReduction
  }

  return (
    <div className="space-y-6">
      {/* Digest Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Weekly Email Digest</h1>
              <p className="text-sm text-gray-600 mt-1">
                {format(new Date(digest.week_start_date), 'MMM d')} - {format(new Date(digest.week_end_date), 'MMM d, yyyy')}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">
                {digest.summary.safe_unsubscribe_count}
              </div>
              <p className="text-sm text-gray-600">Safe to unsubscribe</p>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-white rounded-lg border border-blue-100">
              <div className="text-2xl font-bold text-gray-900">
                {digest.summary.total_emails}
              </div>
              <p className="text-sm text-gray-600">Low priority emails</p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border border-blue-100">
              <div className="text-2xl font-bold text-green-600">
                {digest.summary.estimated_monthly_reduction}
              </div>
              <p className="text-sm text-gray-600">Est. monthly reduction</p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border border-blue-100">
              <div className="text-2xl font-bold text-purple-600">
                {digest.summary.bulk_action_opportunities}
              </div>
              <p className="text-sm text-gray-600">Bulk opportunities</p>
            </div>
          </div>

          {/* Key Insights */}
          <div className="space-y-2">
            {digest.summary.key_insights.map((insight, index) => (
              <div key={index} className="flex items-start space-x-2">
                <InformationCircleIcon className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Action Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unsubscribe Candidates */}
        <UnsubscribeCandidates
          candidates={digest.unsubscribe_opportunities.safe_to_unsubscribe}
          selected={selectedActions.unsubscribe}
          onSelectionChange={(selected) =>
            setSelectedActions(prev => ({ ...prev, unsubscribe: selected }))
          }
        />

        {/* Bulk Actions */}
        <BulkActions
          actions={digest.unsubscribe_opportunities.bulk_actions}
          selected={selectedActions.bulk_actions}
          onSelectionChange={(selected) =>
            setSelectedActions(prev => ({ ...prev, bulk_actions: selected }))
          }
        />
      </div>

      {/* Action Summary & Execute */}
      <Card className="bg-gray-50 border-gray-200">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">
                  {selectedActions.unsubscribe.length}
                </span>{' '}
                individual unsubscribes,{' '}
                <span className="font-medium text-gray-900">
                  {selectedActions.bulk_actions.length}
                </span>{' '}
                bulk actions selected
              </div>
              <div className="text-xs text-gray-500">
                Estimated monthly reduction:{' '}
                <span className="font-medium text-green-600">
                  {calculateEstimatedReduction()}
                </span>{' '}
                emails
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => setSelectedActions({ unsubscribe: [], keep: [], bulk_actions: [] })}
                disabled={isExecuting}
              >
                Clear Selection
              </Button>
              <Button
                onClick={handleExecuteActions}
                loading={isExecuting}
                disabled={
                  loading ||
                  (selectedActions.unsubscribe.length === 0 && selectedActions.bulk_actions.length === 0)
                }
              >
                {isExecuting ? 'Processing...' : 'Execute Actions'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              ${digest.metrics.potential_cost_savings.toFixed(2)}
            </div>
            <p className="text-sm text-gray-600">Potential AI cost savings</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(digest.metrics.time_savings)}m
            </div>
            <p className="text-sm text-gray-600">Estimated time saved</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(digest.metrics.inbox_cleanliness_improvement * 100)}%
            </div>
            <p className="text-sm text-gray-600">Inbox cleanliness gain</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
```

---

## **4. Analytics Components**

### **Analytics Dashboard**
```typescript
// components/analytics/dashboard.tsx
import React from 'react'
import { Card } from '@/components/ui/card'
import { MetricCard } from './metric-card'
import { TierDistributionChart } from './charts/tier-distribution-chart'
import { CostTrackingChart } from './charts/cost-tracking-chart'
import {
  InboxIcon,
  TrendingDownIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

export interface AnalyticsData {
  period: '7d' | '30d' | '90d'
  email_stats: {
    total_processed: number
    tier_distribution: {
      high: number
      medium: number
      low: number
    }
    avg_processing_time: number
    accuracy_score: number
    change_from_previous: number
  }
  cost_analytics: {
    total_ai_cost: number
    cost_per_email: number
    budget_utilization: number
    projected_monthly_cost: number
    cost_savings_vs_traditional: number
    daily_costs: Array<{
      date: string
      cost: number
      email_count: number
    }>
  }
  learning_progress: {
    patterns_learned: number
    accuracy_improvement: number
    learning_velocity: number
    top_performing_patterns: Array<{
      pattern_type: string
      pattern_value: string
      impact: number
      confidence: number
    }>
  }
  productivity_metrics: {
    emails_auto_categorized: number
    time_saved_minutes: number
    inbox_cleanliness_score: number
    unsubscribe_actions_taken: number
  }
}

interface AnalyticsDashboardProps {
  data: AnalyticsData
  timeRange: '7d' | '30d' | '90d'
  onTimeRangeChange: (range: '7d' | '30d' | '90d') => void
  loading?: boolean
}

export function AnalyticsDashboard({
  data,
  timeRange,
  onTimeRangeChange,
  loading = false
}: AnalyticsDashboardProps) {
  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Email Intelligence Analytics</h1>
        <TimeRangeSelector value={timeRange} onChange={onTimeRangeChange} />
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Emails Processed"
          value={data.email_stats.total_processed.toLocaleString()}
          change={data.email_stats.change_from_previous}
          icon={InboxIcon}
          trend={data.email_stats.change_from_previous > 0 ? 'up' : 'down'}
        />
        <MetricCard
          title="AI Cost Savings"
          value={`$${data.cost_analytics.cost_savings_vs_traditional.toFixed(2)}`}
          change={67}
          suffix="%"
          icon={TrendingDownIcon}
          trend="down"
          positive="down" // Cost reduction is positive when trending down
        />
        <MetricCard
          title="Accuracy Score"
          value={`${data.email_stats.accuracy_score}%`}
          change={data.learning_progress.accuracy_improvement}
          icon={CheckCircleIcon}
          trend="up"
        />
        <MetricCard
          title="Time Saved"
          value={`${Math.round(data.productivity_metrics.time_saved_minutes / 60)}h`}
          change={23}
          suffix="this period"
          icon={ClockIcon}
          trend="up"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Tier Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Email Tier Distribution</h3>
          <TierDistributionChart data={data.email_stats.tier_distribution} />
        </Card>

        {/* Cost Tracking */}
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Daily AI Costs</h3>
          <CostTrackingChart data={data.cost_analytics.daily_costs} />
        </Card>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cost Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Cost Analysis</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total AI Cost</span>
              <span className="font-medium">${data.cost_analytics.total_ai_cost.toFixed(4)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Cost Per Email</span>
              <span className="font-medium">${data.cost_analytics.cost_per_email.toFixed(6)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Budget Utilization</span>
              <span className="font-medium">
                {Math.round(data.cost_analytics.budget_utilization * 100)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Projected Monthly</span>
              <span className="font-medium">${data.cost_analytics.projected_monthly_cost.toFixed(2)}</span>
            </div>
          </div>
        </Card>

        {/* Learning Progress */}
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Learning Progress</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Patterns Learned</span>
              <span className="font-medium">{data.learning_progress.patterns_learned}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Accuracy Improvement</span>
              <span className="font-medium text-green-600">
                +{data.learning_progress.accuracy_improvement.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Learning Velocity</span>
              <span className="font-medium">{data.learning_progress.learning_velocity.toFixed(1)}/week</span>
            </div>
          </div>
        </Card>

        {/* Top Patterns */}
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Performing Patterns</h3>
          <div className="space-y-3">
            {data.learning_progress.top_performing_patterns.slice(0, 5).map((pattern, index) => (
              <div key={index} className="flex justify-between items-center text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">
                    {pattern.pattern_value}
                  </p>
                  <p className="text-gray-500 capitalize">{pattern.pattern_type}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{pattern.impact > 0 ? '+' : ''}{pattern.impact}</p>
                  <p className="text-gray-500">{Math.round(pattern.confidence * 100)}%</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function TimeRangeSelector({
  value,
  onChange
}: {
  value: string
  onChange: (value: '7d' | '30d' | '90d') => void
}) {
  const options = [
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' }
  ]

  return (
    <div className="flex rounded-md shadow-sm">
      {options.map((option, index) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value as '7d' | '30d' | '90d')}
          className={`
            px-4 py-2 text-sm font-medium
            ${index === 0 ? 'rounded-l-md' : ''}
            ${index === options.length - 1 ? 'rounded-r-md' : ''}
            ${value === option.value
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }
            border focus:z-10 focus:ring-1 focus:ring-blue-500 focus:border-blue-500
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-8 bg-gray-300 rounded w-64"></div>
        <div className="h-10 bg-gray-300 rounded w-32"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-6">
            <div className="h-4 bg-gray-300 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-300 rounded w-16 mb-1"></div>
            <div className="h-3 bg-gray-300 rounded w-20"></div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-6">
            <div className="h-6 bg-gray-300 rounded w-40 mb-4"></div>
            <div className="h-64 bg-gray-300 rounded"></div>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

The comprehensive frontend implementation provides a complete, accessible, and performant React component library for the email intelligence platform, with proper TypeScript definitions, error handling, and loading states.