import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DigestService } from '@/lib/digest/service'

export async function POST(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the current hour to determine which digest to generate
    const now = new Date()
    const currentHour = now.getHours()

    let digestType: 'morning' | 'afternoon' | 'evening'

    // Determine digest type based on hour (using EST/EDT as default)
    if (currentHour >= 7 && currentHour < 9) {
      digestType = 'morning'
    } else if (currentHour >= 12 && currentHour < 14) {
      digestType = 'afternoon'
    } else if (currentHour >= 16 && currentHour < 18) {
      digestType = 'evening'
    } else {
      return NextResponse.json({
        message: 'No digest scheduled for this hour',
        hour: currentHour
      })
    }

    console.log(`Generating ${digestType} digests at hour ${currentHour}`)

    const supabase = await createClient()
    const digestService = new DigestService()

    // Get all users with digest enabled
    const { data: preferences, error: prefError } = await supabase
      .from('digest_preferences')
      .select('user_id')
      .eq('enabled', true)

    if (prefError) {
      console.error('Error fetching preferences:', prefError)
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
    }

    let generatedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    // Generate digest for each user
    for (const pref of preferences || []) {
      try {
        // Check if we should generate this digest
        const shouldGenerate = await digestService.shouldGenerateDigest(pref.user_id, digestType)
        if (!shouldGenerate) {
          console.log(`Skipping digest for user ${pref.user_id} - already generated`)
          skippedCount++
          continue
        }

        // Generate and save digest
        const digest = await digestService.generateDigest(pref.user_id, digestType)

        // Only save if there are items
        if (digest.summary.total > 0) {
          await digestService.saveDigest(pref.user_id, digest)
          generatedCount++
          console.log(`Generated digest for user ${pref.user_id} with ${digest.summary.total} items`)
        } else {
          console.log(`No items for user ${pref.user_id}, skipping digest`)
          skippedCount++
        }
      } catch (error: any) {
        console.error(`Failed to generate digest for user ${pref.user_id}:`, error)
        errors.push(`User ${pref.user_id}: ${error.message}`)
      }
    }

    return NextResponse.json({
      message: `${digestType} digest generation completed`,
      generated: generatedCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error: any) {
    console.error('Digest cron error:', error)
    return NextResponse.json(
      { error: 'Cron job failed', details: error.message },
      { status: 500 }
    )
  }
}