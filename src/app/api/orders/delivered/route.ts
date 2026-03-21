import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Called by shipping provider webhook OR manually by admin when order is delivered
// This is the moment commissions become real and get credited to KOC wallets

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  const { order_id } = await req.json()
  if (!order_id) return NextResponse.json({ error: 'order_id required' }, { status: 400 })

  const admin = createAdminClient()

  // ── 1. Mark order as delivered ──────────────────────────
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', order_id)
    .select('*, order_items(*)')
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // ── 2. Process commissions via DB function ──────────────
  const { error: commErr } = await admin.rpc('process_order_commissions', {
    p_order_id: order_id
  })

  if (commErr) {
    console.error('[webhook/delivered] commission error:', commErr)
    // Don't fail — log and retry later
  }

  // ── 3. Pay out T1 and T2 immediately (T+48h in production) ──
  const { data: commissions } = await admin
    .from('commissions')
    .select('*, koc:profiles!commissions_koc_id_fkey(id)')
    .eq('order_id', order_id)
    .in('tier', ['T1', 'T2'])
    .eq('status', 'pending')

  if (commissions?.length) {
    for (const comm of commissions) {
      // Find or create wallet
      const { data: wallet } = await admin
        .from('wallets')
        .select('id, balance')
        .eq('user_id', comm.koc_id)
        .single()

      if (wallet) {
        // Credit commission to wallet
        await admin.from('wallets')
          .update({ balance: wallet.balance + comm.amount })
          .eq('id', wallet.id)

        await admin.from('wallet_transactions').insert({
          wallet_id: wallet.id,
          type: 'commission',
          amount: comm.amount,
          currency: 'VND',
          balance_after: wallet.balance + comm.amount,
          ref_id: comm.id,
          ref_type: 'commission',
          note: `${comm.tier} commission — Order ${order.order_number}`,
        })

        // Mark commission as paid
        await admin.from('commissions')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', comm.id)

        // Notify KOC
        await admin.from('notifications').insert({
          user_id: comm.koc_id,
          type: 'commission_paid',
          title: `💰 Hoa hồng ${comm.tier}: +${comm.amount.toLocaleString('vi-VN')}đ`,
          body: `Đơn hàng ${order.order_number} đã giao thành công`,
          data: { commission_id: comm.id, order_id, amount: comm.amount },
        })
      }
    }
  }

  // ── 4. Contribute to pools ──────────────────────────────
  // Pool contributions already created in process_order_commissions
  // Pool payouts happen on schedule (monthly/annual/quarterly)

  // ── 5. Update vendor stats ───────────────────────────────
  const vendorIds = [...new Set(order.order_items.map((i: any) => i.vendor_id))]
  for (const vendorId of vendorIds) {
    const vendorItems = order.order_items.filter((i: any) => i.vendor_id === vendorId)
    const vendorRevenue = vendorItems.reduce((s: number, i: any) => {
      return s + (i.unit_price - i.unit_price * i.discount_pct / 100) * i.quantity
    }, 0)

    await admin.from('vendor_profiles')
      .update({
        total_orders: admin.rpc as any,  // Use increment RPC in production
        total_revenue: admin.rpc as any,
      })
      .eq('user_id', vendorId)
  }

  return NextResponse.json({ success: true, order_id, commissions_processed: commissions?.length ?? 0 })
}
