import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Test the connection by checking if we can query the auth schema
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      return NextResponse.json({
        status: 'error',
        message: 'Supabase connection failed',
        error: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      status: 'success',
      message: 'Supabase is connected!',
      hasSession: !!data.session,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'missing'
    })
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: 'Failed to initialize Supabase',
      error: error.message
    }, { status: 500 })
  }
}