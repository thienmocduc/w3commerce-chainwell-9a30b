import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET tracking history for an order
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const orderId = searchParams.get('order_id')
  if (!orderId) return NextResponse.json({ error: 'order_id required' }, { status: 400 })

  // Verify user owns this order
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, order_number, buyer_id, koc_ref_id')
    .eq('id', orderId)
    .single()

  if (!order || (order.buyer_id !== user.id && order.koc_ref_id !== user.id)) {
    // Check if admin
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin' && profile?.role !== 'vendor') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
  }

  const { data: tracking } = await supabase
    .from('order_tracking')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  const { data: shipper } = await supabase
    .from('shipper_assignments')
    .select('*')
    .eq('order_id', orderId)
    .single()

  return NextResponse.json({ order, tracking: tracking ?? [], shipper })
}

// POST — add tracking event (vendor/admin)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { order_id, status, note, location } = await req.json()
  const admin = createAdminClient()

  const { data, error } = await admin.from('order_tracking').insert({
    order_id,
    status,
    note,
    location,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tracking: data })
}
