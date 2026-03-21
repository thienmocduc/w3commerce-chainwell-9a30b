import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { CartItem } from '@/types/database'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // ── 1. Auth ──────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    items: CartItem[]
    shipping_address: {
      name: string
      phone: string
      address: string
      district: string
      city: string
    }
    payment_method: string
    koc_ref_id?: string
    notes?: string
  }

  // ── 2. Validate items ────────────────────────────────────
  if (!body.items?.length) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
  }

  // Fetch real product data from DB (never trust client prices)
  const productIds = body.items.map(i => i.product.id)
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, price, discount_pct, stock, status, vendor_id, name_vi')
    .in('id', productIds)
    .eq('status', 'active')

  if (prodError || !products) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }

  // Check all products exist and are active
  for (const item of body.items) {
    const p = products.find(p => p.id === item.product.id)
    if (!p) return NextResponse.json({ error: `Product ${item.product.id} not found or inactive` }, { status: 400 })
    if (p.stock < item.quantity) return NextResponse.json({ error: `${p.name_vi}: only ${p.stock} left in stock` }, { status: 400 })
  }

  // ── 3. Calculate totals (server-side, authoritative) ─────
  let subtotal = 0
  const orderItems = body.items.map(item => {
    const p = products.find(p => p.id === item.product.id)!
    const unitPrice = p.price                                          // real price from DB
    const platformRevenue = unitPrice * (p.discount_pct / 100)        // vendor's cut to platform
    const itemSubtotal = unitPrice * item.quantity

    subtotal += itemSubtotal

    return {
      product_id: item.product.id,
      vendor_id: p.vendor_id,
      quantity: item.quantity,
      unit_price: unitPrice,
      discount_pct: p.discount_pct,
      platform_revenue: Math.round(platformRevenue * 100) / 100,
      subtotal: Math.round(itemSubtotal * 100) / 100,
      product_snapshot: {                                              // snapshot at order time
        name_vi: item.product.name_vi,
        emoji: item.product.emoji,
        images: item.product.images,
        price: unitPrice,
      }
    }
  })

  const shippingFee = subtotal >= 500_000 ? 0 : 30_000
  const total = subtotal + shippingFee

  // ── 4. Create order ──────────────────────────────────────
  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .insert({
      buyer_id: user.id,
      koc_ref_id: body.koc_ref_id || null,
      status: 'pending',
      subtotal: Math.round(subtotal * 100) / 100,
      shipping_fee: shippingFee,
      discount: 0,
      total: Math.round(total * 100) / 100,
      payment_method: body.payment_method as any || 'wallet',
      payment_status: 'pending',
      shipping_address: body.shipping_address,
      notes: body.notes || null,
    })
    .select()
    .single()

  if (orderError || !order) {
    console.error('[POST /api/orders] create order:', orderError)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }

  // ── 5. Create order items ────────────────────────────────
  const { error: itemsError } = await adminClient
    .from('order_items')
    .insert(orderItems.map(item => ({ ...item, order_id: order.id })))

  if (itemsError) {
    console.error('[POST /api/orders] create items:', itemsError)
    // Rollback order
    await adminClient.from('orders').delete().eq('id', order.id)
    return NextResponse.json({ error: 'Failed to create order items' }, { status: 500 })
  }

  // ── 6. Deduct stock ──────────────────────────────────────
  for (const item of body.items) {
    await adminClient.rpc('decrement_stock', {
      p_product_id: item.product.id,
      p_qty: item.quantity
    })
  }

  // ── 7. Process payment (wallet deduction for now) ─────────
  if (body.payment_method === 'wallet') {
    const { data: wallet } = await adminClient
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single()

    if (!wallet || wallet.balance < total) {
      // Mark as pending payment — user needs to top up
      await adminClient.from('orders').update({ payment_status: 'insufficient_balance' }).eq('id', order.id)
    } else {
      // Deduct balance
      await adminClient
        .from('wallets')
        .update({ balance: wallet.balance - total })
        .eq('user_id', user.id)

      // Log wallet transaction
      await adminClient.from('wallet_transactions').insert({
        wallet_id: (await adminClient.from('wallets').select('id').eq('user_id', user.id).single()).data!.id,
        type: 'purchase',
        amount: -total,
        currency: 'VND',
        balance_after: wallet.balance - total,
        ref_id: order.id,
        ref_type: 'order',
        note: `Order ${order.order_number}`,
      })

      await adminClient.from('orders').update({ payment_status: 'paid', status: 'confirmed' }).eq('id', order.id)
    }
  }

  // ── 8. Add XP to buyer ───────────────────────────────────
  await adminClient
    .from('profiles')
    .update({ xp: supabase.rpc as any })  // placeholder — use RPC in production
    .eq('id', user.id)

  // ── 9. Send notification ─────────────────────────────────
  await adminClient.from('notifications').insert({
    user_id: user.id,
    type: 'order_confirmed',
    title: `Đơn hàng ${order.order_number} đã được đặt`,
    body: `Tổng: ${total.toLocaleString('vi-VN')}đ · ${body.items.length} sản phẩm`,
    data: { order_id: order.id, order_number: order.order_number },
  })

  return NextResponse.json({
    order: {
      id: order.id,
      order_number: order.order_number,
      total,
      status: order.status,
    }
  }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const page  = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '10')
  const from  = (page - 1) * limit

  const { data: orders, error, count } = await supabase
    .from('orders')
    .select(`
      *,
      order_items(
        *,
        product:products(id, name_vi, name_en, images, emoji)
      )
    `, { count: 'exact' })
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    orders,
    pagination: { page, limit, total: count ?? 0 }
  })
}
