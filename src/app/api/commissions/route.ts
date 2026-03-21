import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const page  = parseInt(searchParams.get('page') || '1')
  const limit = 20
  const from  = (page - 1) * limit

  // Get commissions with order details
  const { data: commissions, count, error } = await supabase
    .from('commissions')
    .select(`
      *,
      order:orders(order_number, created_at, total, buyer_id),
      order_item:order_items(
        quantity,
        product:products(name_vi, emoji)
      )
    `, { count: 'exact' })
    .eq('koc_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Summary stats
  const { data: stats } = await supabase
    .from('commissions')
    .select('tier, status, amount')
    .eq('koc_id', user.id)

  const summary = stats?.reduce((acc, c) => {
    acc.total  += c.amount
    if (c.status === 'paid')    acc.paid    += c.amount
    if (c.status === 'pending') acc.pending += c.amount
    if (c.tier  === 'T1')       acc.t1      += c.amount
    if (c.tier  === 'T2')       acc.t2      += c.amount
    return acc
  }, { total: 0, paid: 0, pending: 0, t1: 0, t2: 0 })

  return NextResponse.json({ commissions, count, summary })
}
