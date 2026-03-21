import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET all policies
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: policies, error } = await supabase
    .from('platform_policies')
    .select('*')
    .order('key')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ policies })
}

// PATCH — admin updates a policy value
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { key: string; value: number }[]

  // Validate: sum of commission percentages must ≤ 100
  const pctKeys = ['t1_pct', 't2_pct', 'pool_a_pct', 'pool_b_pct', 'pool_c_pct', 'platform_pct']
  const updates = body.filter(u => u.key && u.value !== undefined)

  // Get current policies for validation
  const { data: current } = await supabase.from('platform_policies').select('key, value, min_val, max_val')
  const policyMap = Object.fromEntries((current ?? []).map(p => [p.key, p]))

  // Build merged values for validation
  const merged: Record<string, number> = {}
  current?.forEach(p => merged[p.key] = p.value)
  updates.forEach(u => merged[u.key] = u.value)

  // Validate ranges
  for (const u of updates) {
    const policy = policyMap[u.key]
    if (!policy) return NextResponse.json({ error: `Unknown policy: ${u.key}` }, { status: 400 })
    if (u.value < policy.min_val || u.value > policy.max_val) {
      return NextResponse.json({
        error: `${u.key}: value ${u.value} out of range [${policy.min_val}, ${policy.max_val}]`
      }, { status: 400 })
    }
  }

  // Validate: commission pcts must sum to ≤ 100
  const pctSum = pctKeys.reduce((s, k) => s + (merged[k] ?? 0), 0)
  if (pctSum > 100) {
    return NextResponse.json({
      error: `Commission percentages sum to ${pctSum.toFixed(2)}% — must be ≤ 100%`
    }, { status: 400 })
  }

  // Apply updates
  const admin = createAdminClient()
  const results = []
  for (const u of updates) {
    const { data, error } = await admin
      .from('platform_policies')
      .update({ value: u.value, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('key', u.key)
      .select()
      .single()

    if (error) return NextResponse.json({ error: `Failed to update ${u.key}: ${error.message}` }, { status: 500 })
    results.push(data)
  }

  // Log the change
  await admin.from('notifications').insert({
    user_id: user.id,
    type: 'policy_updated',
    title: `Đã cập nhật ${updates.length} chính sách`,
    body: updates.map(u => `${u.key}: ${u.value}`).join(', '),
    data: { updated: updates },
  })

  return NextResponse.json({ updated: results })
}
