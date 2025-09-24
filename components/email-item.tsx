import { Mail, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface EmailItemProps {
  item: {
    id: string
    source: string
    // feed_items.external_id (email id)
    external_id?: string
    title: string
    content: string
    category: 'now' | 'next' | 'later'
    priority: number
    metadata?: {
      from?: string
      ai_score?: number
      ai_processed?: boolean
      ai_model?: string
    }
  }
}

export function EmailItem({ item }: EmailItemProps) {
  const [replies, setReplies] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getPriorityColor = (priority: number) => {
    if (priority <= 3) return 'bg-red-50 text-red-700 border-red-200'
    if (priority <= 6) return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    return 'bg-green-50 text-green-700 border-green-200'
  }

  const getPriorityLabel = (priority: number) => {
    if (priority <= 3) return 'High'
    if (priority <= 6) return 'Medium'
    return 'Low'
  }

  const getSmartReplies = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/smart-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feed_item_id: item.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to generate replies')
      setReplies(data.replies)
    } catch (e: any) {
      setError(e?.message || 'Failed to generate replies')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-3 border rounded-lg space-y-2 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {item.source === 'gmail' && <Mail className="w-4 h-4 text-muted-foreground" />}
          {item.source === 'slack' && <MessageSquare className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm font-medium">{item.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {item.metadata?.ai_processed && (
            <>
              <Badge
                variant="outline"
                className={`text-xs ${getPriorityColor(item.priority)}`}
              >
                {getPriorityLabel(item.priority)} ({item.priority}/10)
              </Badge>
              {item.metadata?.ai_model && (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">
                  {item.metadata.ai_model}
                </Badge>
              )}
            </>
          )}
          {!item.metadata?.ai_processed && (
            <Badge variant="outline" className="bg-gray-50 text-gray-600 text-xs">
              Not processed
            </Badge>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2">{item.content}</p>
      {item.source === 'slack' && item.metadata?.channel && (
        <p className="text-xs text-muted-foreground">Channel: #{item.metadata.channel}</p>
      )}
      {item.metadata?.from && (
        <p className="text-xs text-muted-foreground">From: {item.metadata.from}</p>
      )}
      {item.metadata?.ai_score && (
        <div className="text-xs text-muted-foreground">
          AI Score: {item.metadata.ai_score}/10
        </div>
      )}

      {/* Smart replies */}
      <div className="pt-2">
        <Button size="sm" variant="outline" onClick={getSmartReplies} disabled={loading}>
          {loading ? 'Generating…' : 'Smart Replies'}
        </Button>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
      {replies && replies.length > 0 && (
        <ul className="mt-2 space-y-1">
          {replies.map((r, i) => (
            <li key={i} className="text-sm text-muted-foreground">• {r}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
