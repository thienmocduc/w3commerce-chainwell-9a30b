// Crypto payment handler — USDT on Polygon
// Frontend uses wagmi + RainbowKit, backend verifies tx

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Polygon Amoy testnet USDT contract
const USDT_CONTRACT = process.env.NEXT_PUBLIC_W3C_TOKEN_ADDRESS || '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS
if (!PLATFORM_WALLET || PLATFORM_WALLET === '0x...') {
  console.warn('[crypto] PLATFORM_WALLET_ADDRESS not configured properly')
}

// ── Verify on-chain payment ───────────────────────────────
export async function POST(req: NextRequest) {
  // Auth check — must be logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!PLATFORM_WALLET || PLATFORM_WALLET === '0x...') {
    return NextResponse.json({ error: 'Payment not configured' }, { status: 500 })
  }

  const { tx_hash, order_id, expected_amount } = await req.json()

  if (!tx_hash || !order_id) {
    return NextResponse.json({ error: 'tx_hash and order_id required' }, { status: 400 })
  }

  // Validate tx_hash format (0x + 64 hex chars)
  if (!/^0x[a-fA-F0-9]{64}$/.test(tx_hash)) {
    return NextResponse.json({ error: 'Invalid tx_hash format' }, { status: 400 })
  }

  // Validate order_id format (UUID)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order_id)) {
    return NextResponse.json({ error: 'Invalid order_id format' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify user owns this order
  const { data: order } = await admin
    .from('orders')
    .select('id, buyer_id, payment_status')
    .eq('id', order_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.buyer_id !== user.id) {
    return NextResponse.json({ error: 'Not your order' }, { status: 403 })
  }
  if (order.payment_status === 'paid') {
    return NextResponse.json({ error: 'Order already paid' }, { status: 400 })
  }

  // Replay protection — check if tx_hash already used
  const { data: existingTx } = await admin
    .from('orders')
    .select('id')
    .eq('tx_hash', tx_hash)
    .eq('payment_status', 'paid')
    .limit(1)

  if (existingTx?.length) {
    return NextResponse.json({ error: 'Transaction already used for another order' }, { status: 400 })
  }

  try {
    // Verify transaction on Polygon
    const rpc = process.env.NEXT_PUBLIC_POLYGON_RPC || 'https://rpc-amoy.polygon.technology'

    const txResponse = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method:  'eth_getTransactionReceipt',
        params:  [tx_hash],
        id:      1,
      }),
    })

    const txData = await txResponse.json()
    const receipt = txData.result

    if (!receipt) {
      return NextResponse.json({ error: 'Transaction not found or pending' }, { status: 400 })
    }

    if (receipt.status !== '0x1') {
      return NextResponse.json({ error: 'Transaction failed on-chain' }, { status: 400 })
    }

    // Parse ERC-20 Transfer event from logs
    const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    const transferLog = receipt.logs?.find((log: any) =>
      log.address?.toLowerCase() === USDT_CONTRACT.toLowerCase() &&
      log.topics?.[0] === TRANSFER_TOPIC &&
      log.topics?.[2]?.toLowerCase().includes(PLATFORM_WALLET.toLowerCase().slice(2))
    )

    if (!transferLog) {
      return NextResponse.json({ error: 'No valid USDT transfer to platform wallet found' }, { status: 400 })
    }

    // Decode amount (USDT = 6 decimals)
    const amountHex = transferLog.data
    const amount    = parseInt(amountHex, 16) / 1_000_000

    if (expected_amount && Math.abs(amount - expected_amount) > 0.01) {
      return NextResponse.json({ error: `Amount mismatch: got ${amount}, expected ${expected_amount}` }, { status: 400 })
    }

    // Confirm order
    await admin.from('orders').update({
      payment_status: 'paid',
      status: 'confirmed',
      tx_hash,
    }).eq('id', order_id)

    return NextResponse.json({ success: true, amount, tx_hash })

  } catch (e) {
    console.error('[crypto payment verify]', e)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
