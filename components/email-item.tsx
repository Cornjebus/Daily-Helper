import { Mail } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface EmailItemProps {
  item: {
    id: string
    source: string
    title: string
    content: string
    category: 'now' | 'next' | 'later'
    priority: number
    metadata?: {
      from?: string
      ai_score?: number
      ai_processed?: boolean
    }
  }
}

export function EmailItem({ item }: EmailItemProps) {
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

  return (
    <div className="p-3 border rounded-lg space-y-2 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {item.source === 'gmail' && <Mail className="w-4 h-4 text-muted-foreground" />}
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
              <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">
                🚀 GPT-5 Nano
              </Badge>
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
      {item.metadata?.from && (
        <p className="text-xs text-muted-foreground">From: {item.metadata.from}</p>
      )}
      {item.metadata?.ai_score && (
        <div className="text-xs text-muted-foreground">
          AI Score: {item.metadata.ai_score}/10
        </div>
      )}
    </div>
  )
}