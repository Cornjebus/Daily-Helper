import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DigestService } from '@/lib/digest/service'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const digestType = body.type || 'manual'

    // Validate digest type
    if (!['morning', 'afternoon', 'evening', 'manual'].includes(digestType)) {
      return NextResponse.json({ error: 'Invalid digest type' }, { status: 400 })
    }

    const digestService = new DigestService()

    // Check if we should generate this digest
    if (digestType !== 'manual') {
      const shouldGenerate = await digestService.shouldGenerateDigest(user.id, digestType as 'morning' | 'afternoon' | 'evening')
      if (!shouldGenerate) {
        // Return the existing digest for today
        const existingDigest = await digestService.getLatestDigest(user.id)
        return NextResponse.json({
          message: 'Digest already generated today',
          generated: false,
          digest: existingDigest
        })
      }
    }

    // Generate the digest
    const digest = await digestService.generateDigest(user.id, digestType)

    // Save the digest to database
    const savedDigest = await digestService.saveDigest(user.id, digest)

    return NextResponse.json({
      message: 'Digest generated successfully',
      generated: true,
      digest: savedDigest,
      summary: digest.summary,
      preview: {
        now: digest.items.now.length,
        next: digest.items.next.length,
        later: digest.items.later.length
      }
    })
  } catch (error: any) {
    console.error('Digest generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate digest', details: error.message },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve the latest digest
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const digestService = new DigestService()
    const latestDigest = await digestService.getLatestDigest(user.id)

    if (!latestDigest) {
      return NextResponse.json({
        message: 'No digest available',
        digest: null
      })
    }

    return NextResponse.json({
      digest: latestDigest
    })
  } catch (error: any) {
    console.error('Error fetching digest:', error)
    return NextResponse.json(
      { error: 'Failed to fetch digest', details: error.message },
      { status: 500 }
    )
  }
}