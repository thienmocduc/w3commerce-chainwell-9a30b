import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST — buyer submits return/exchange request
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { order_id, order_item_id, type, reason, description, images } = body

  if (!order_id || !reason) {
    return NextResponse.json({ error: 'order_id and reason required' }, { status: 400 })
  }

  // Verify order belongs to buyer and is delivered
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, delivered_at, buyer_id')
    .eq('id', order_id)
    .eq('buyer_id', user.id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'delivered') {
    return NextResponse.json({ error: 'Can only return delivered orders' }, { status: 400 })
  }

  // Check 7-day return window
  if (order.delivered_at) {
    const deliveredAt  = new Date(order.delivered_at)
    const daysSince    = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince > 7) {
      return NextResponse.json({ error: 'Return window expired (7 days from delivery)' }, { status: 400 })
    }
  }

  // Check no existing return for this order
  const { data: existing } = await supabase
    .from('returns')
    .select('id, status')
    .eq('order_id', order_id)
    .not('status', 'eq', 'rejected')
    .single()

  if (existing) {
    return NextResponse.json({ error: `Return already exists (status: ${existing.status})` }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: returnReq, error } = await admin
    .from('returns')
    .insert({
      order_id,
      order_item_id,
      buyer_id:    user.id,
      type:        type || 'return',
      reason,
      description,
      images:      images || [],
      status:      'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update order status
  await admin.from('orders').update({ status: 'refunded' }).eq('id', order_id)

  // Notify vendor
  const { data: items } = await admin
    .from('order_items')
    .select('vendor_id')
    .eq('order_id', order_id)
    .limit(1)

  if (items?.[0]?.vendor_id) {
    await admin.from('notifications').insert({
      user_id: items[0].vendor_id,
      type:    'return_request',
      title:   `Yêu cầu ${type === 'exchange' ? 'đổi hàng' : 'hoàn trả'} cho đơn ${order_id.slice(-8)}`,
      body:    `Lý do: ${reason}`,
      data:    { return_id: returnReq.id, order_id },
    })
  }

  return NextResponse.json({ return: returnReq }, { status: 201 })
}

// GET returns list (buyer sees own, vendor/admin sees all)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin   = profile?.role === 'admin'
  const isVendor  = profile?.role === 'vendor'
  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')

  let query = supabase
    .from('returns')
    .select(`
      *,
      order:orders(order_number, total, created_at),
      order_item:order_items(quantity, product:products(name_vi, emoji))
    `)
    .order('created_at', { ascending: false })

  if (!isAdmin && !isVendor) query = query.eq('buyer_id', user.id)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ returns: data })
}

// PATCH — vendor/admin processes a return
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { return_id, action, note, refund_amount } = await req.json()
  if (!['approved', 'rejected', 'completed'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: returnReq, error } = await admin
    .from('returns')
    .update({
      status:         action,
      reviewed_by:    user.id,
      review_note:    note,
      refund_amount:  refund_amount,
      ...(action === 'completed' ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq('id', return_id)
    .select('buyer_id, order_id, refund_amount')
    .single()

  if (error || !returnReq) return NextResponse.json({ error: error?.message }, { status: 500 })

  // If approved + refund_amount → credit buyer wallet
  if (action === 'approved' && returnReq.refund_amount && returnReq.refund_amount > 0) {
    const { data: wallet } = await admin
      .from('wallets')
      .select('id, balance')
      .eq('user_id', returnReq.buyer_id)
      .single()

    if (wallet) {
      await admin.from('wallets')
        .update({ balance: wallet.balance + returnReq.refund_amount })
        .eq('id', wallet.id)

      await admin.from('wallet_transactions').insert({
        wallet_id:     wallet.id,
        type:          'refund',
        amount:        returnReq.refund_amount,
        currency:      'VND',
        balance_after: wallet.balance + returnReq.refund_amount,
        ref_id:        returnReq.order_id,
        ref_type:      'return',
        note:          `Hoàn tiền đơn ${returnReq.order_id.slice(-8)}`,
      })
    }
  }

  // Notify buyer
  const msgs: Record<string, string> = {
    approved:  `Yêu cầu hoàn/đổi hàng đã được duyệt${returnReq.refund_amount ? ` — hoàn ${returnReq.refund_amount.toLocaleString('vi-VN')}đ vào ví` : ''}`,
    rejected:  `Yêu cầu hoàn/đổi hàng bị từ chối: ${note || ''}`,
    completed: 'Quy trình hoàn/đổi hàng hoàn tất',
  }
  await admin.from('notifications').insert({
    user_id: returnReq.buyer_id,
    type:    `return_${action}`,
    title:   msgs[action],
    data:    { return_id, action, refund_amount },
  })

  return NextResponse.json({ success: true, action })
}
