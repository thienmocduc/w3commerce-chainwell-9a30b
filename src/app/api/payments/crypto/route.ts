// Crypto payment handler — USDT on Polygon
// Frontend uses wagmi + RainbowKit, backend verifies tx

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Polygon Amoy testnet USDT contract
const USDT_CONTRACT = process.env.NEXT_PUBLIC_W3C_TOKEN_ADDRESS || '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || '0x...'

// ── Verify on-chain payment ───────────────────────────────
export async function POST(req: NextRequest) {
  const { tx_hash, order_id, expected_amount } = await req.json()

  if (!tx_hash || !order_id) {
    return NextResponse.json({ error: 'tx_hash and order_id required' }, { status: 400 })
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
    // Transfer(address indexed from, address indexed to, uint256 value)
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
    const amount    = parseInt(amountHex, 16) / 1_000_000  // USDT 6 decimals

    if (expected_amount && Math.abs(amount - expected_amount) > 0.01) {
      return NextResponse.json({ error: `Amount mismatch: got ${amount}, expected ${expected_amount}` }, { status: 400 })
    }

    // Confirm order
    const admin = createAdminClient()
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
