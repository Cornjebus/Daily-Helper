import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DigestService } from '@/lib/digest/service'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    const digestService = new DigestService()
    const history = await digestService.getDigestHistory(user.id, limit)

    return NextResponse.json({ history })
  } catch (error: any) {
    console.error('Get history error:', error)
    return NextResponse.json(
      { error: 'Failed to get history', details: error.message },
      { status: 500 }
    )
  }
}