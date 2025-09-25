# 🎨 UI Component Design
## Email Intelligence Dashboard & Interface Architecture

### **Design System Overview**

The Email Intelligence UI is built with React components using Tailwind CSS, focusing on clean data visualization and intuitive email management workflows.

```typescript
// Design tokens and theme configuration
const DESIGN_SYSTEM = {
  colors: {
    primary: {
      50: '#f0f9ff',
      500: '#3b82f6',  // Main brand blue
      600: '#2563eb',
      900: '#1e3a8a'
    },
    success: {
      50: '#f0fdf4',
      500: '#22c55e',  // Green for positive actions
      600: '#16a34a'
    },
    warning: {
      50: '#fffbeb',
      500: '#f59e0b',  // Orange for medium priority
      600: '#d97706'
    },
    danger: {
      50: '#fef2f2',
      500: '#ef4444',  // Red for high priority/delete actions
      600: '#dc2626'
    },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      500: '#6b7280',  // Neutral text
      900: '#111827'   // Dark text
    }
  },

  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['Fira Code', 'monospace']
    },
    fontSize: {
      xs: '0.75rem',   // 12px - metadata, timestamps
      sm: '0.875rem',  // 14px - body text, buttons
      base: '1rem',    // 16px - primary text
      lg: '1.125rem',  // 18px - headings
      xl: '1.25rem',   // 20px - large headings
      '2xl': '1.5rem'  // 24px - page titles
    }
  },

  spacing: {
    component: '1rem',     // 16px - standard component spacing
    section: '2rem',       // 32px - section spacing
    page: '3rem'          // 48px - page-level spacing
  }
}
```

---

## **Core Layout Components**

### **1. Dashboard Shell**

```typescript
interface DashboardShellProps {
  children: React.ReactNode
  sidebar?: React.ReactNode
  header?: React.ReactNode
}

export function DashboardShell({ children, sidebar, header }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                Email Intelligence
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                AI-Powered
              </span>
            </div>

            {/* User menu and notifications */}
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <BudgetIndicator />
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        {sidebar && (
          <aside className="w-64 bg-white border-r border-gray-200 min-h-screen">
            {sidebar}
          </aside>
        )}

        {/* Main Content */}
        <main className={`flex-1 ${sidebar ? 'ml-0' : ''}`}>
          {header && (
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              {header}
            </div>
          )}
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
```

### **2. Navigation Sidebar**

```typescript
interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
  active?: boolean
}

export function NavigationSidebar() {
  const navigation: NavigationItem[] = [
    { name: 'Dashboard', href: '/', icon: HomeIcon },
    { name: 'Inbox', href: '/inbox', icon: InboxIcon, badge: 12 },
    { name: 'Weekly Digest', href: '/digest', icon: DocumentTextIcon, badge: 1 },
    { name: 'VIP Senders', href: '/vip-senders', icon: StarIcon },
    { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
    { name: 'Settings', href: '/settings', icon: CogIcon }
  ]

  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {navigation.map((item) => (
        <Link
          key={item.name}
          href={item.href}
          className={`
            group flex items-center px-2 py-2 text-sm font-medium rounded-md
            ${item.active
              ? 'bg-blue-100 text-blue-900'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }
          `}
        >
          <item.icon
            className={`mr-3 h-5 w-5 ${
              item.active ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
            }`}
          />
          {item.name}
          {item.badge && (
            <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {item.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  )
}
```

---

## **Email Display Components**

### **3. Email List Component**

```typescript
interface EmailListProps {
  emails: ProcessedEmail[]
  onEmailSelect?: (email: ProcessedEmail) => void
  onScoreUpdate?: (emailId: string, feedback: ScoreFeedback) => void
  loading?: boolean
  emptyState?: React.ReactNode
}

export function EmailList({ emails, onEmailSelect, onScoreUpdate, loading }: EmailListProps) {
  if (loading) {
    return <EmailListSkeleton />
  }

  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      <div className="divide-y divide-gray-200">
        {emails.map((email) => (
          <EmailListItem
            key={email.id}
            email={email}
            onClick={() => onEmailSelect?.(email)}
            onScoreUpdate={(feedback) => onScoreUpdate?.(email.id, feedback)}
          />
        ))}
      </div>
    </div>
  )
}

interface ProcessedEmail {
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
  }
  ai_analysis?: {
    category: 'now' | 'next' | 'later' | 'archive'
    priority: number
    summary?: string
    action_items?: string[]
  }
  is_unread: boolean
  is_important: boolean
  is_starred: boolean
}
```

### **4. Email List Item**

```typescript
interface EmailListItemProps {
  email: ProcessedEmail
  onClick?: () => void
  onScoreUpdate?: (feedback: ScoreFeedback) => void
}

export function EmailListItem({ email, onClick, onScoreUpdate }: EmailListItemProps) {
  const tierColors = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const categoryIcons = {
    now: ExclamationIcon,
    next: ClockIcon,
    later: InboxIcon,
    archive: ArchiveIcon
  }

  return (
    <div
      className={`
        p-4 hover:bg-gray-50 cursor-pointer transition-colors
        ${email.is_unread ? 'bg-blue-50' : ''}
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
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2">
              <p className={`text-sm font-medium text-gray-900 truncate ${
                email.is_unread ? 'font-bold' : ''
              }`}>
                {email.sender_name || email.sender}
              </p>

              {/* Priority Indicators */}
              {email.is_starred && (
                <StarIcon className="h-4 w-4 text-yellow-500" />
              )}
              {email.is_important && (
                <ExclamationIcon className="h-4 w-4 text-red-500" />
              )}
            </div>

            <div className="flex items-center space-x-2">
              {/* Processing Tier Badge */}
              <span className={`
                inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border
                ${tierColors[email.score.processing_tier]}
              `}>
                {email.score.processing_tier.toUpperCase()}
              </span>

              {/* Score Display */}
              <ScoreBadge
                score={email.score.final_score}
                confidence={email.score.confidence}
              />

              <time className="text-xs text-gray-500">
                {formatRelativeTime(email.received_at)}
              </time>
            </div>
          </div>

          {/* Subject */}
          <p className={`text-sm text-gray-900 truncate mb-1 ${
            email.is_unread ? 'font-medium' : ''
          }`}>
            {email.subject}
          </p>

          {/* Snippet */}
          <p className="text-sm text-gray-600 line-clamp-2">
            {email.snippet}
          </p>

          {/* AI Analysis */}
          {email.ai_analysis && (
            <div className="mt-2 flex items-center space-x-4">
              {/* Category */}
              <div className="flex items-center space-x-1">
                {React.createElement(categoryIcons[email.ai_analysis.category], {
                  className: "h-4 w-4 text-gray-400"
                })}
                <span className="text-xs text-gray-500 capitalize">
                  {email.ai_analysis.category}
                </span>
              </div>

              {/* Priority */}
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-500">
                  Priority: {email.ai_analysis.priority}/10
                </span>
              </div>

              {/* Action Items */}
              {email.ai_analysis.action_items && email.ai_analysis.action_items.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {email.ai_analysis.action_items.length} action{email.ai_analysis.action_items.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex-shrink-0 flex items-center space-x-1">
          <QuickActionButton
            icon={ThumbUpIcon}
            tooltip="Mark as important"
            onClick={(e) => {
              e.stopPropagation()
              onScoreUpdate?.({ action: 'marked_important' })
            }}
          />
          <QuickActionButton
            icon={ThumbDownIcon}
            tooltip="Mark as low priority"
            onClick={(e) => {
              e.stopPropagation()
              onScoreUpdate?.({ action: 'marked_low' })
            }}
          />
          <QuickActionButton
            icon={ArchiveIcon}
            tooltip="Archive"
            onClick={(e) => {
              e.stopPropagation()
              // Handle archive action
            }}
          />
        </div>
      </div>
    </div>
  )
}
```

---

## **Scoring & Analytics Components**

### **5. Score Badge Component**

```typescript
interface ScoreBadgeProps {
  score: number
  confidence?: number
  size?: 'sm' | 'md' | 'lg'
  showConfidence?: boolean
}

export function ScoreBadge({ score, confidence, size = 'md', showConfidence = true }: ScoreBadgeProps) {
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
    <div className="flex items-center space-x-1">
      <span className={`
        inline-flex items-center rounded-full font-medium border
        ${getScoreColor(score)} ${getSizeClasses(size)}
      `}>
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
        </div>
      )}
    </div>
  )
}
```

### **6. Analytics Dashboard**

```typescript
interface AnalyticsDashboardProps {
  data: AnalyticsData
  timeRange: '7d' | '30d' | '90d'
  onTimeRangeChange: (range: string) => void
}

export function AnalyticsDashboard({ data, timeRange, onTimeRangeChange }: AnalyticsDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Email Intelligence Analytics</h2>
        <TimeRangeSelector value={timeRange} onChange={onTimeRangeChange} />
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Emails Processed"
          value={data.email_stats.total_processed}
          change={data.email_stats.change_from_previous}
          icon={InboxIcon}
          trend="up"
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
          suffix="this week"
          icon={ClockIcon}
          trend="up"
        />
      </div>

      {/* Charts and Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Tier Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Email Tier Distribution</h3>
          <TierDistributionChart data={data.email_stats.tier_distribution} />
        </div>

        {/* Cost Tracking */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Daily AI Costs</h3>
          <CostTrackingChart data={data.cost_analytics.daily_costs} />
        </div>

        {/* Learning Progress */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Learning Progress</h3>
          <LearningProgressChart data={data.learning_progress} />
        </div>

        {/* Top Patterns */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Performing Patterns</h3>
          <TopPatternsTable patterns={data.learning_progress.top_performing_patterns} />
        </div>
      </div>
    </div>
  )
}
```

---

## **Weekly Digest Components**

### **7. Digest Overview**

```typescript
interface DigestOverviewProps {
  digest: WeeklyDigest
  onActionExecute: (actions: DigestActions) => Promise<void>
  loading?: boolean
}

export function DigestOverview({ digest, onActionExecute, loading }: DigestOverviewProps) {
  const [selectedActions, setSelectedActions] = useState<DigestActions>({
    unsubscribe: [],
    keep: [],
    bulk_actions: []
  })

  return (
    <div className="space-y-6">
      {/* Digest Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Weekly Email Digest</h2>
            <p className="text-sm text-gray-600 mt-1">
              {formatDateRange(digest.week_start_date, digest.week_end_date)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-blue-600">
              {digest.summary.safe_unsubscribe_count}
            </p>
            <p className="text-sm text-gray-600">Safe to unsubscribe</p>
          </div>
        </div>

        {/* Key Insights */}
        <div className="mt-4 space-y-2">
          {digest.summary.key_insights.map((insight, index) => (
            <div key={index} className="flex items-center space-x-2">
              <InformationCircleIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <p className="text-sm text-gray-700">{insight}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Action Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Safe Unsubscribe Candidates */}
        <UnsubscribeCandidates
          candidates={digest.unsubscribe_opportunities.safe_to_unsubscribe}
          selected={selectedActions.unsubscribe}
          onSelectionChange={(selected) =>
            setSelectedActions(prev => ({ ...prev, unsubscribe: selected }))
          }
        />

        {/* Bulk Actions */}
        <BulkActionOpportunities
          opportunities={digest.unsubscribe_opportunities.bulk_actions}
          selected={selectedActions.bulk_actions}
          onSelectionChange={(selected) =>
            setSelectedActions(prev => ({ ...prev, bulk_actions: selected }))
          }
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
        <div className="text-sm text-gray-600">
          <p>
            {selectedActions.unsubscribe.length} individual unsubscribes,
            {selectedActions.bulk_actions.length} bulk actions selected
          </p>
          <p className="text-xs mt-1">
            Estimated monthly reduction: {calculateEstimatedReduction(selectedActions)} emails
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            onClick={() => setSelectedActions({ unsubscribe: [], keep: [], bulk_actions: [] })}
          >
            Clear Selection
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
            onClick={() => onActionExecute(selectedActions)}
            disabled={loading || (selectedActions.unsubscribe.length === 0 && selectedActions.bulk_actions.length === 0)}
          >
            {loading ? 'Processing...' : 'Execute Actions'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

### **8. Unsubscribe Candidates Component**

```typescript
interface UnsubscribeCandidatesProps {
  candidates: UnsubscribeCandidate[]
  selected: string[]
  onSelectionChange: (selected: string[]) => void
}

export function UnsubscribeCandidates({ candidates, selected, onSelectionChange }: UnsubscribeCandidatesProps) {
  const handleToggleAll = () => {
    if (selected.length === candidates.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(candidates.map(c => c.sender))
    }
  }

  const handleToggle = (sender: string) => {
    if (selected.includes(sender)) {
      onSelectionChange(selected.filter(s => s !== sender))
    } else {
      onSelectionChange([...selected, sender])
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Safe to Unsubscribe</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {selected.length} of {candidates.length} selected
            </span>
            <button
              type="button"
              className="text-sm text-blue-600 hover:text-blue-500"
              onClick={handleToggleAll}
            >
              {selected.length === candidates.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {candidates.map((candidate) => (
          <div
            key={candidate.sender}
            className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
              selected.includes(candidate.sender) ? 'bg-blue-50' : ''
            }`}
            onClick={() => handleToggle(candidate.sender)}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 pt-0.5">
                <input
                  type="checkbox"
                  checked={selected.includes(candidate.sender)}
                  onChange={() => handleToggle(candidate.sender)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {candidate.sender}
                  </p>
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {Math.round(candidate.confidence * 100)}% confidence
                    </span>
                    <span className="text-xs text-gray-500">
                      {candidate.email_count} emails
                    </span>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mt-1">
                  {candidate.domain}
                </p>

                {/* Reasons */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {candidate.reasons.slice(0, 3).map((reason, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {reason}
                    </span>
                  ))}
                  {candidate.reasons.length > 3 && (
                    <span className="text-xs text-gray-500">
                      +{candidate.reasons.length - 3} more
                    </span>
                  )}
                </div>

                {/* Estimated savings */}
                <p className="text-xs text-gray-500 mt-2">
                  Monthly reduction: ~{candidate.estimated_monthly_savings} emails
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## **Settings & Configuration Components**

### **9. Settings Panel**

```typescript
interface SettingsPanelProps {
  preferences: UserPreferences
  onUpdate: (preferences: Partial<UserPreferences>) => Promise<void>
}

export function SettingsPanel({ preferences, onUpdate }: SettingsPanelProps) {
  const [localPreferences, setLocalPreferences] = useState(preferences)
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(localPreferences)
      setHasChanges(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Email Intelligence Settings</h2>
        {hasChanges && (
          <div className="flex space-x-3">
            <button
              type="button"
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              onClick={() => {
                setLocalPreferences(preferences)
                setHasChanges(false)
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Scoring Weights Section */}
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Scoring Weights</h3>
          <p className="text-sm text-gray-600 mt-1">
            Adjust how different factors influence email scoring
          </p>
        </div>
        <div className="p-6 space-y-6">
          <WeightSlider
            label="VIP Sender Importance"
            value={localPreferences.scoring_weights.vip_sender_weight}
            onChange={(value) => {
              setLocalPreferences(prev => ({
                ...prev,
                scoring_weights: { ...prev.scoring_weights, vip_sender_weight: value }
              }))
              setHasChanges(true)
            }}
            min={0}
            max={2}
            step={0.1}
            description="How much VIP senders boost email scores"
          />
          <WeightSlider
            label="Urgency Keywords"
            value={localPreferences.scoring_weights.urgent_keywords_weight}
            onChange={(value) => {
              setLocalPreferences(prev => ({
                ...prev,
                scoring_weights: { ...prev.scoring_weights, urgent_keywords_weight: value }
              }))
              setHasChanges(true)
            }}
            min={0}
            max={2}
            step={0.1}
            description="Impact of urgent keywords like 'ASAP', 'URGENT'"
          />
          {/* Additional weight sliders... */}
        </div>
      </div>

      {/* Processing Thresholds Section */}
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Processing Thresholds</h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure when emails get high-priority AI processing
          </p>
        </div>
        <div className="p-6 space-y-6">
          <ThresholdSlider
            label="High Priority Threshold"
            value={localPreferences.processing_preferences.high_priority_threshold}
            onChange={(value) => {
              setLocalPreferences(prev => ({
                ...prev,
                processing_preferences: { ...prev.processing_preferences, high_priority_threshold: value }
              }))
              setHasChanges(true)
            }}
            min={50}
            max={100}
            description="Emails scoring above this get immediate AI analysis"
            color="red"
          />
          <ThresholdSlider
            label="Medium Priority Threshold"
            value={localPreferences.processing_preferences.medium_priority_threshold}
            onChange={(value) => {
              setLocalPreferences(prev => ({
                ...prev,
                processing_preferences: { ...prev.processing_preferences, medium_priority_threshold: value }
              }))
              setHasChanges(true)
            }}
            min={10}
            max={80}
            description="Emails scoring above this get batched AI processing"
            color="yellow"
          />
        </div>
      </div>

      {/* Budget Management */}
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">AI Budget Management</h3>
          <p className="text-sm text-gray-600 mt-1">
            Control your daily AI processing costs
          </p>
        </div>
        <div className="p-6 space-y-6">
          <BudgetSlider
            label="Daily AI Budget"
            value={localPreferences.processing_preferences.max_ai_cost_per_day}
            onChange={(value) => {
              setLocalPreferences(prev => ({
                ...prev,
                processing_preferences: { ...prev.processing_preferences, max_ai_cost_per_day: value }
              }))
              setHasChanges(true)
            }}
            min={0.25}
            max={10.00}
            step={0.25}
            format={(value) => `$${value.toFixed(2)}`}
            description="Maximum AI processing cost per day"
          />
        </div>
      </div>
    </div>
  )
}
```

---

## **Real-time Updates & Notifications**

### **10. Real-time Status Indicator**

```typescript
export function RealtimeStatusIndicator() {
  const { connectionStatus, lastUpdate, processingQueue } = useRealtimeConnection()

  const statusConfig = {
    connected: { color: 'text-green-500', bg: 'bg-green-100', label: 'Connected' },
    connecting: { color: 'text-yellow-500', bg: 'bg-yellow-100', label: 'Connecting' },
    disconnected: { color: 'text-red-500', bg: 'bg-red-100', label: 'Disconnected' }
  }

  const config = statusConfig[connectionStatus]

  return (
    <div className="flex items-center space-x-2 text-sm">
      <div className={`flex items-center space-x-1 px-2 py-1 rounded-full ${config.bg}`}>
        <div className={`w-2 h-2 rounded-full ${config.color.replace('text-', 'bg-')}`} />
        <span className={config.color}>
          {config.label}
        </span>
      </div>

      {processingQueue > 0 && (
        <span className="text-gray-500">
          {processingQueue} processing
        </span>
      )}

      {lastUpdate && (
        <span className="text-gray-400">
          Updated {formatRelativeTime(lastUpdate)}
        </span>
      )}
    </div>
  )
}
```

### **11. Notification System**

```typescript
interface NotificationProps {
  notifications: Notification[]
  onDismiss: (id: string) => void
  onAction?: (id: string, action: string) => void
}

export function NotificationSystem({ notifications, onDismiss, onAction }: NotificationProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto border-l-4
            ${notification.type === 'success' ? 'border-green-400' :
              notification.type === 'error' ? 'border-red-400' :
              notification.type === 'warning' ? 'border-yellow-400' : 'border-blue-400'
            }
          `}
        >
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {notification.type === 'success' && <CheckCircleIcon className="h-5 w-5 text-green-400" />}
                {notification.type === 'error' && <XCircleIcon className="h-5 w-5 text-red-400" />}
                {notification.type === 'warning' && <ExclamationIcon className="h-5 w-5 text-yellow-400" />}
                {notification.type === 'info' && <InformationCircleIcon className="h-5 w-5 text-blue-400" />}
              </div>

              <div className="ml-3 w-0 flex-1 pt-0.5">
                <p className="text-sm font-medium text-gray-900">
                  {notification.title}
                </p>
                {notification.message && (
                  <p className="mt-1 text-sm text-gray-500">
                    {notification.message}
                  </p>
                )}

                {notification.actions && (
                  <div className="mt-3 flex space-x-2">
                    {notification.actions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        className="text-sm font-medium text-blue-600 hover:text-blue-500"
                        onClick={() => onAction?.(notification.id, action.value)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="ml-4 flex-shrink-0 flex">
                <button
                  type="button"
                  className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
                  onClick={() => onDismiss(notification.id)}
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

The UI component design provides a comprehensive, user-friendly interface for the email intelligence platform, focusing on clarity, efficiency, and actionable insights while maintaining excellent user experience standards.