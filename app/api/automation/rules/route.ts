import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rulesEngine } from '@/lib/automation/rules-engine'

/**
 * GET: Fetch user's automation rules
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const rules = await rulesEngine.loadUserRules(user.id)

    return NextResponse.json({
      rules,
      templates: rulesEngine.getTemplates()
    })
  } catch (error: any) {
    console.error('Error fetching rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rules', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST: Create a new automation rule
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.trigger_type || !body.action_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const rule = await rulesEngine.createRule({
      ...body,
      user_id: user.id,
      enabled: body.enabled ?? true,
      priority: body.priority ?? 50,
      execution_count: 0
    })

    if (!rule) {
      return NextResponse.json(
        { error: 'Failed to create rule' },
        { status: 500 }
      )
    }

    return NextResponse.json({ rule })
  } catch (error: any) {
    console.error('Error creating rule:', error)
    return NextResponse.json(
      { error: 'Failed to create rule', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT: Update an existing rule
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Rule ID required' },
        { status: 400 }
      )
    }

    // Verify user owns the rule
    const { data: existingRule } = await supabase
      .from('automation_rules')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existingRule || existingRule.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    const success = await rulesEngine.updateRule(id, updates)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update rule' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating rule:', error)
    return NextResponse.json(
      { error: 'Failed to update rule', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Delete a rule
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ruleId = searchParams.get('id')

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Rule ID required' },
        { status: 400 }
      )
    }

    // Verify user owns the rule
    const { data: existingRule } = await supabase
      .from('automation_rules')
      .select('user_id')
      .eq('id', ruleId)
      .single()

    if (!existingRule || existingRule.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    const success = await rulesEngine.deleteRule(ruleId)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete rule' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting rule:', error)
    return NextResponse.json(
      { error: 'Failed to delete rule', details: error.message },
      { status: 500 }
    )
  }
}