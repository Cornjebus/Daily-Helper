import { createClient } from '@/lib/supabase/server'
import { format, startOfDay, endOfDay } from 'date-fns'

export interface DigestItem {
  id: string
  source: string
  title: string
  content: string
  priority: number
  category: 'now' | 'next' | 'later'
  created_at: string
  metadata?: any
}

export interface DigestData {
  user: {
    email: string
    id: string
  }
  period: 'morning' | 'afternoon' | 'evening' | 'manual'
  timestamp: Date
  items: {
    now: DigestItem[]
    next: DigestItem[]
    later: DigestItem[]
  }
  summary: {
    total: number
    highPriority: number
    bySource: Record<string, number>
  }
  upcomingEvents: any[]
}

export class DigestService {
  async generateDigest(userId: string, digestType: 'morning' | 'afternoon' | 'evening' | 'manual' = 'manual'): Promise<DigestData> {
    const supabase = await createClient()

    // Get user info from auth
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('User not found')

    // Get user preferences
    const { data: preferences } = await supabase
      .from('digest_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    const minPriority = preferences?.min_priority || 5
    const includeSources = preferences?.include_sources || ['gmail', 'calendar']

    // Get today's feed items
    const today = new Date()
    const startOfToday = startOfDay(today)
    const endOfToday = endOfDay(today)

    const { data: feedItems, error: feedError } = await supabase
      .from('feed_items')
      .select('*')
      .eq('user_id', userId)
      .in('source', includeSources)
      .gte('priority', minPriority)
      .gte('created_at', startOfToday.toISOString())
      .lte('created_at', endOfToday.toISOString())
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })

    if (feedError) throw feedError

    // Categorize items
    const items = {
      now: [] as DigestItem[],
      next: [] as DigestItem[],
      later: [] as DigestItem[]
    }

    const bySource: Record<string, number> = {}
    let highPriorityCount = 0

    for (const item of feedItems || []) {
      const category = item.category as 'now' | 'next' | 'later'
      items[category].push(item)

      // Track source counts
      bySource[item.source] = (bySource[item.source] || 0) + 1

      // Count high priority (1-3)
      if (item.priority <= 3) highPriorityCount++
    }

    // Get upcoming calendar events for context
    const { data: upcomingEvents } = await supabase
      .from('feed_items')
      .select('*')
      .eq('user_id', userId)
      .eq('source', 'calendar')
      .gte('metadata->>start', today.toISOString())
      .order('metadata->>start', { ascending: true })
      .limit(5)

    return {
      user: {
        email: user.email!,
        id: user.id
      },
      period: digestType,
      timestamp: today,
      items,
      summary: {
        total: feedItems?.length || 0,
        highPriority: highPriorityCount,
        bySource
      },
      upcomingEvents: upcomingEvents || []
    }
  }

  async getDigestPreferences(userId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('digest_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code === 'PGRST116') {
      // No preferences exist, create defaults
      const { data: newPrefs, error: insertError } = await supabase
        .from('digest_preferences')
        .insert({ user_id: userId })
        .select()
        .single()

      if (insertError) throw insertError
      return newPrefs
    }

    if (error) throw error
    return data
  }

  async updateDigestPreferences(userId: string, updates: any) {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('digest_preferences')
      .upsert({
        user_id: userId,
        ...updates,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async saveDigest(userId: string, digestData: DigestData) {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('digest_history')
      .insert({
        user_id: userId,
        digest_type: digestData.period,
        item_count: digestData.summary.total,
        high_priority_count: digestData.summary.highPriority,
        content: {
          items: digestData.items,
          summary: digestData.summary,
          upcomingEvents: digestData.upcomingEvents
        },
        status: 'generated',
        delivery_method: 'dashboard'
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getLatestDigest(userId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('digest_history')
      .select('*')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  async getDigestHistory(userId: string, limit = 10) {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('digest_history')
      .select('*')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data
  }

  async shouldGenerateDigest(userId: string, digestType: 'morning' | 'afternoon' | 'evening'): Promise<boolean> {
    const supabase = await createClient()

    // Check if user has digest enabled
    const preferences = await this.getDigestPreferences(userId)
    if (!preferences?.enabled) return false

    // Check if we've already sent this digest today
    const today = startOfDay(new Date())
    const { data: todaysDigests } = await supabase
      .from('digest_history')
      .select('*')
      .eq('user_id', userId)
      .eq('digest_type', digestType)
      .gte('sent_at', today.toISOString())

    if (todaysDigests && todaysDigests.length > 0) {
      return false // Already generated today
    }

    return true
  }
}