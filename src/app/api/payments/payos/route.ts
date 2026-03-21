import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// PayOS — Vietnamese QR payment gateway
// Docs: https://payos.vn/docs/
// Test: https://my.payos.vn/developer/test

const PAYOS_CLIENT_ID  = process.env.PAYOS_CLIENT_ID  || ''
const PAYOS_API_KEY    = process.env.PAYOS_API_KEY     || ''
const PAYOS_CHECKSUM   = process.env.PAYOS_CHECKSUM_KEY || ''
const PAYOS_BASE       = 'https://api-merchant.payos.vn'

function createSignature(data: string): string {
  return crypto.createHmac('sha256', PAYOS_CHECKSUM).update(data).digest('hex')
}

function buildSignatureString(obj: Record<string, string | number>): string {
  // Sort keys alphabetically and build key=value&key=value string
  return Object.keys(obj)
    .sort()
    .filter(k => obj[k] !== undefined && obj[k] !== null && obj[k] !== '')
    .map(k => `${k}=${obj[k]}`)
    .join('&')
}

// POST /api/payments/payos — create payment link
export async function POST(req: NextRequest) {
  const { order_number, amount, description, buyer_name, buyer_email, buyer_phone, items } = await req.json()

  const orderCode  = parseInt(order_number.replace(/[^0-9]/g, '').slice(-10))
  const returnUrl  = `${process.env.NEXT_PUBLIC_APP_URL}/account/orders?success=1`
  const cancelUrl  = `${process.env.NEXT_PUBLIC_APP_URL}/checkout?cancelled=1`

  const paymentData: Record<string, string | number | object[]> = {
    orderCode,
    amount:      Math.round(amount),
    description: description || `Thanh toan ${order_number}`,
    cancelUrl,
    returnUrl,
    ...(buyer_name  ? { buyerName:  buyer_name  } : {}),
    ...(buyer_email ? { buyerEmail: buyer_email } : {}),
    ...(buyer_phone ? { buyerPhone: buyer_phone } : {}),
    ...(items?.length ? { items } : {}),
    expiredAt: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
  }

  // Build signature (only scalar fields)
  const sigFields: Record<string, string | number> = {
    amount:      paymentData.amount as number,
    cancelUrl:   cancelUrl,
    description: paymentData.description as string,
    orderCode,
    returnUrl,
  }
  const sigStr  = buildSignatureString(sigFields)
  const signature = createSignature(sigStr)

  try {
    const res = await fetch(`${PAYOS_BASE}/v2/payment-requests`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id':  PAYOS_CLIENT_ID,
        'x-api-key':    PAYOS_API_KEY,
      },
      body: JSON.stringify({ ...paymentData, signature }),
    })

    const data = await res.json()

    if (data.code !== '00') {
      console.error('[PayOS create]', data)
      return NextResponse.json({ error: data.desc || 'PayOS error' }, { status: 400 })
    }

    return NextResponse.json({
      payment_url: data.data.checkoutUrl,
      qr_code:     data.data.qrCode,
      payment_link_id: data.data.paymentLinkId,
      order_code:  orderCode,
    })
  } catch (e) {
    console.error('[PayOS]', e)
    return NextResponse.json({ error: 'PayOS connection failed' }, { status: 500 })
  }
}

// POST /api/payments/payos/webhook — PayOS IPN
export async function PUT(req: NextRequest) {
  const body = await req.json()

  // Verify webhook signature
  const { code, desc, success, data: webhookData, signature: receivedSig } = body

  if (!webhookData) return NextResponse.json({ message: 'No data' }, { status: 400 })

  const sigFields: Record<string, string | number> = {
    amount:      webhookData.amount,
    cancelUrl:   '',
    description: webhookData.description,
    orderCode:   webhookData.orderCode,
    returnUrl:   '',
  }
  const expectedSig = createSignature(buildSignatureString(sigFields))

  if (expectedSig !== receivedSig) {
    console.error('[PayOS webhook] Invalid signature')
    return NextResponse.json({ message: 'Invalid signature' }, { status: 401 })
  }

  if (code === '00' && success) {
    const { createAdminClient } = await import('@/lib/supabase/server')
    const admin = createAdminClient()

    // orderCode → order_number mapping
    const orderCode = webhookData.orderCode.toString()
    const { data: order } = await admin
      .from('orders')
      .select('id, order_number')
      .ilike('order_number', `%-${orderCode.slice(-5)}`)
      .single()

    if (order) {
      await admin.from('orders').update({
        payment_status: 'paid',
        status:         'confirmed',
        tx_hash:        webhookData.reference,
      }).eq('id', order.id)
    }
  }

  return NextResponse.json({ message: 'Webhook received' })
}

// GET payment status
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const paymentLinkId = searchParams.get('id')
  if (!paymentLinkId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const res = await fetch(`${PAYOS_BASE}/v2/payment-requests/${paymentLinkId}`, {
    headers: {
      'x-client-id': PAYOS_CLIENT_ID,
      'x-api-key':   PAYOS_API_KEY,
    },
  })
  const data = await res.json()
  return NextResponse.json(data.data ?? {})
}
