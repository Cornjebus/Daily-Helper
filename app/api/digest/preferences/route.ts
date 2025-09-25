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

    const digestService = new DigestService()
    const preferences = await digestService.getDigestPreferences(user.id)

    return NextResponse.json({ preferences })
  } catch (error: any) {
    console.error('Get preferences error:', error)
    return NextResponse.json(
      { error: 'Failed to get preferences', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const updates = await request.json()

    // Validate the updates
    const allowedFields = [
      'enabled',
      'morning_digest_time',
      'afternoon_digest_time',
      'evening_digest_time',
      'delivery_method',
      'include_sources',
      'min_priority',
      'timezone'
    ]

    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key]
        return obj
      }, {} as any)

    const digestService = new DigestService()
    const preferences = await digestService.updateDigestPreferences(user.id, filteredUpdates)

    return NextResponse.json({
      message: 'Preferences updated successfully',
      preferences
    })
  } catch (error: any) {
    console.error('Update preferences error:', error)
    return NextResponse.json(
      { error: 'Failed to update preferences', details: error.message },
      { status: 500 }
    )
  }
}