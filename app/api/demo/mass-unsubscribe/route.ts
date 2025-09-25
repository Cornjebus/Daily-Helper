import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Mass Unsubscribe Demo API Endpoint
 * Simulates bulk unsubscribe functionality with realistic data
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { dryRun = false, categories = ['marketing', 'promotional', 'newsletter'] } = body

    // Simulate finding bulk senders from email data
    const { data: emails } = await supabase
      .from('emails')
      .select('from_email, subject, snippet, id')
      .eq('user_id', user.id)
      .limit(500)

    // Identify potential bulk/marketing senders
    const senderAnalysis = new Map()

    emails?.forEach(email => {
      const sender = email.from_email.toLowerCase()
      const isMarketing = isMarketingEmail(email.subject, email.snippet, sender)

      if (!senderAnalysis.has(sender)) {
        senderAnalysis.set(sender, {
          email: sender,
          emailCount: 0,
          isMarketing: false,
          lastSubject: '',
          domains: new Set(),
          marketingKeywords: []
        })
      }

      const analysis = senderAnalysis.get(sender)
      analysis.emailCount++
      analysis.lastSubject = email.subject
      analysis.domains.add(sender.split('@')[1])

      if (isMarketing.isMarketing) {
        analysis.isMarketing = true
        analysis.marketingKeywords.push(...isMarketing.keywords)
      }
    })

    // Filter for bulk unsubscribe candidates
    const unsubscribeCandidates = Array.from(senderAnalysis.values())
      .filter(sender =>
        (sender.emailCount >= 3 && sender.isMarketing) || // 3+ marketing emails
        sender.emailCount >= 10 || // 10+ emails from any sender
        isBulkSender(sender.email)
      )
      .map(sender => ({
        ...sender,
        domains: Array.from(sender.domains),
        marketingKeywords: [...new Set(sender.marketingKeywords)],
        unsubscribeReason: getUnsubscribeReason(sender),
        estimatedTimeSavedMinutes: Math.round(sender.emailCount * 0.5), // 30 seconds per email
        confidence: calculateUnsubscribeConfidence(sender)
      }))
      .sort((a, b) => b.emailCount - a.emailCount)

    // Simulate unsubscribe actions
    const unsubscribeResults = []
    let totalEmailsAffected = 0
    let totalTimeSavedMinutes = 0

    for (const candidate of unsubscribeCandidates.slice(0, 25)) { // Limit to 25 for demo
      const result = await simulateUnsubscribe(candidate, dryRun, supabase, user.id)
      unsubscribeResults.push(result)
      totalEmailsAffected += candidate.emailCount
      totalTimeSavedMinutes += candidate.estimatedTimeSavedMinutes
    }

    // Log the unsubscribe session
    if (!dryRun) {
      await supabase
        .from('unsubscribe_sessions')
        .insert({
          user_id: user.id,
          total_senders: unsubscribeResults.length,
          total_emails_affected: totalEmailsAffected,
          estimated_time_saved_minutes: totalTimeSavedMinutes,
          categories_processed: categories,
          session_type: 'bulk_unsubscribe',
          created_at: new Date().toISOString()
        })
    }

    const response = {
      summary: {
        candidatesAnalyzed: senderAnalysis.size,
        unsubscribeActions: unsubscribeResults.length,
        totalEmailsAffected,
        estimatedTimeSavedMinutes: totalTimeSavedMinutes,
        estimatedTimeSavedHours: Math.round(totalTimeSavedMinutes / 60 * 10) / 10,
        dryRun,
        categories: categories
      },
      results: unsubscribeResults.slice(0, 10), // Limit response size
      statistics: {
        byCategory: {
          marketing: unsubscribeResults.filter(r => r.category === 'marketing').length,
          newsletters: unsubscribeResults.filter(r => r.category === 'newsletter').length,
          promotional: unsubscribeResults.filter(r => r.category === 'promotional').length,
          social: unsubscribeResults.filter(r => r.category === 'social').length,
          other: unsubscribeResults.filter(r => r.category === 'other').length
        },
        byConfidence: {
          high: unsubscribeResults.filter(r => r.confidence > 0.8).length,
          medium: unsubscribeResults.filter(r => r.confidence > 0.6 && r.confidence <= 0.8).length,
          low: unsubscribeResults.filter(r => r.confidence <= 0.6).length
        }
      },
      recommendations: generateRecommendations(unsubscribeResults, totalTimeSavedMinutes),
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('❌ Mass unsubscribe error:', error)

    return NextResponse.json({
      error: 'Mass unsubscribe failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Helper functions
function isMarketingEmail(subject: string, snippet: string, sender: string) {
  const marketingKeywords = [
    'unsubscribe', 'newsletter', 'promotion', 'deal', 'sale', 'discount',
    'offer', 'limited time', 'exclusive', 'marketing', 'advertisement',
    'shop now', 'buy now', 'click here', 'free shipping', 'coupon'
  ]

  const text = `${subject} ${snippet}`.toLowerCase()
  const senderText = sender.toLowerCase()

  const foundKeywords = marketingKeywords.filter(keyword =>
    text.includes(keyword) || senderText.includes(keyword)
  )

  return {
    isMarketing: foundKeywords.length > 0,
    keywords: foundKeywords
  }
}

function isBulkSender(email: string) {
  const bulkPatterns = [
    'noreply', 'no-reply', 'donotreply', 'newsletter', 'marketing',
    'notifications', 'updates', 'promotions', 'deals', 'offers'
  ]

  return bulkPatterns.some(pattern => email.includes(pattern))
}

function getUnsubscribeReason(sender: any) {
  if (sender.emailCount >= 10) return 'High frequency sender (10+ emails)'
  if (sender.isMarketing) return 'Marketing/promotional content detected'
  if (isBulkSender(sender.email)) return 'Bulk sender pattern detected'
  return 'Low engagement sender'
}

function calculateUnsubscribeConfidence(sender: any) {
  let confidence = 0.5

  // High frequency increases confidence
  if (sender.emailCount >= 10) confidence += 0.3
  else if (sender.emailCount >= 5) confidence += 0.2

  // Marketing content increases confidence
  if (sender.isMarketing) confidence += 0.3

  // Bulk sender patterns increase confidence
  if (isBulkSender(sender.email)) confidence += 0.2

  // Cap at 0.95
  return Math.min(0.95, confidence)
}

async function simulateUnsubscribe(candidate: any, dryRun: boolean, supabase: any, userId: string) {
  // Simulate unsubscribe process
  const unsubscribeMethod = Math.random() > 0.3 ? 'one-click' : 'email-link'
  const success = Math.random() > 0.05 // 95% success rate

  const result = {
    sender: candidate.email,
    emailCount: candidate.emailCount,
    category: categorizeEmailType(candidate),
    confidence: candidate.confidence,
    method: unsubscribeMethod,
    success: success,
    estimatedTimeSavedMinutes: candidate.estimatedTimeSavedMinutes,
    action: dryRun ? 'simulated' : (success ? 'unsubscribed' : 'failed'),
    reason: candidate.unsubscribeReason,
    lastSubject: candidate.lastSubject
  }

  // If not a dry run and successful, mark emails as unsubscribed
  if (!dryRun && success) {
    await supabase
      .from('emails')
      .update({
        unsubscribed: true,
        unsubscribed_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('from_email', candidate.email)
  }

  return result
}

function categorizeEmailType(sender: any) {
  if (sender.marketingKeywords.some(k => ['newsletter', 'updates'].includes(k))) return 'newsletter'
  if (sender.marketingKeywords.some(k => ['deal', 'sale', 'discount', 'offer'].includes(k))) return 'promotional'
  if (sender.email.includes('social') || sender.email.includes('notification')) return 'social'
  if (sender.isMarketing) return 'marketing'
  return 'other'
}

function generateRecommendations(results: any[], timeSaved: number) {
  const recommendations = []

  if (timeSaved > 60) {
    recommendations.push(`You've saved ${Math.round(timeSaved/60*10)/10} hours of manual email processing!`)
  }

  const highVolumeCount = results.filter(r => r.emailCount >= 10).length
  if (highVolumeCount > 0) {
    recommendations.push(`${highVolumeCount} high-volume senders were processed - consider setting up filters for similar senders.`)
  }

  const lowConfidenceCount = results.filter(r => r.confidence < 0.7).length
  if (lowConfidenceCount > 0) {
    recommendations.push(`${lowConfidenceCount} uncertain unsubscribes - review these manually for best results.`)
  }

  recommendations.push('Run weekly bulk unsubscribe to maintain optimal inbox efficiency.')

  return recommendations
}

/**
 * GET endpoint for unsubscribe statistics
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get unsubscribe session history
    const { data: sessions } = await supabase
      .from('unsubscribe_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    // Calculate totals
    const totalSessions = sessions?.length || 0
    const totalSendersProcessed = sessions?.reduce((sum, s) => sum + s.total_senders, 0) || 0
    const totalTimeSavedMinutes = sessions?.reduce((sum, s) => sum + s.estimated_time_saved_minutes, 0) || 0

    return NextResponse.json({
      summary: {
        totalSessions,
        totalSendersProcessed,
        totalTimeSavedMinutes,
        totalTimeSavedHours: Math.round(totalTimeSavedMinutes / 60 * 10) / 10,
        lastSession: sessions?.[0]?.created_at
      },
      recentSessions: sessions,
      projectedSavings: {
        weeklyMinutes: Math.round(totalTimeSavedMinutes / totalSessions) || 45,
        monthlyMinutes: Math.round((totalTimeSavedMinutes / totalSessions) * 4.3) || 194,
        yearlyHours: Math.round(((totalTimeSavedMinutes / totalSessions) * 4.3 * 12) / 60 * 10) / 10 || 38.8
      }
    })

  } catch (error: any) {
    console.error('❌ Error getting unsubscribe stats:', error)

    return NextResponse.json({
      error: 'Failed to get unsubscribe statistics',
      details: error.message
    }, { status: 500 })
  }
}