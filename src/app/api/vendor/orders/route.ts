import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET vendor's orders
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const page   = parseInt(searchParams.get('page') || '1')
  const limit  = 20
  const from   = (page - 1) * limit

  let query = supabase
    .from('order_items')
    .select(`
      *,
      order:orders!order_items_order_id_fkey(
        id, order_number, status, payment_status, total, created_at,
        shipping_address, notes,
        buyer:profiles!orders_buyer_id_fkey(id, display_name, phone)
      ),
      product:products(id, name_vi, images, emoji)
    `, { count: 'exact' })
    .eq('vendor_id', user.id)
    .order('created_at', { referencedTable: 'orders', ascending: false })
    .range(from, from + limit - 1)

  if (status) query = query.eq('order.status', status)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate by order
  const orderMap = new Map()
  data?.forEach(item => {
    const ordId = item.order.id
    if (!orderMap.has(ordId)) {
      orderMap.set(ordId, { ...item.order, items: [] })
    }
    orderMap.get(ordId).items.push({
      id:         item.id,
      product:    item.product,
      quantity:   item.quantity,
      unit_price: item.unit_price,
      subtotal:   item.subtotal,
      discount_pct: item.discount_pct,
    })
  })

  return NextResponse.json({
    orders: Array.from(orderMap.values()),
    pagination: { page, limit, total: count ?? 0 },
  })
}

// PATCH — vendor confirms/ships an order
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { order_id, action, tracking_no, carrier, note } = await req.json()

  // Verify vendor owns items in this order
  const { data: items } = await supabase
    .from('order_items')
    .select('id')
    .eq('order_id', order_id)
    .eq('vendor_id', user.id)

  if (!items?.length) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const admin = createAdminClient()
  const now   = new Date().toISOString()

  const statusMap: Record<string, string> = {
    confirm:  'confirmed',
    ship:     'shipping',
    complete: 'delivered',
  }

  const newStatus = statusMap[action]
  if (!newStatus) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  await admin.from('orders')
    .update({
      status:       newStatus,
      ...(newStatus === 'shipping'  ? { shipped_at: now } : {}),
      ...(newStatus === 'delivered' ? { delivered_at: now } : {}),
    })
    .eq('id', order_id)

  // Add tracking event
  await admin.from('order_tracking').insert({
    order_id,
    status:     newStatus,
    note:       note || { confirmed:'Vendor xác nhận đơn', shipping:'Đã giao cho shipper', delivered:'Đã giao thành công' }[action],
    created_by: user.id,
  })

  // If shipping, save shipper info
  if (action === 'ship' && tracking_no) {
    await admin.from('shipper_assignments').upsert({
      order_id,
      tracking_no,
      carrier: carrier || 'manual',
      assigned_at: now,
    })
  }

  // If delivered, trigger commission processing
  if (action === 'complete') {
    await admin.rpc('process_order_commissions_v2', { p_order_id: order_id })
    // Trigger commission payout (reuse delivered webhook logic)
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/orders/delivered`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': process.env.WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({ order_id }),
    }).catch(() => {})
  }

  // Notify buyer
  const { data: order } = await admin.from('orders').select('buyer_id, order_number').eq('id', order_id).single()
  if (order) {
    const msgMap: Record<string, string> = {
      confirmed: `Đơn ${order.order_number} đã được xác nhận`,
      shipping:  `Đơn ${order.order_number} đang trên đường giao`,
      delivered: `Đơn ${order.order_number} đã được giao thành công`,
    }
    await admin.from('notifications').insert({
      user_id:  order.buyer_id,
      type:     `order_${newStatus}`,
      title:    msgMap[newStatus] ?? `Đơn hàng cập nhật`,
      data:     { order_id, tracking_no },
    })
  }

  return NextResponse.json({ success: true, status: newStatus })
}
