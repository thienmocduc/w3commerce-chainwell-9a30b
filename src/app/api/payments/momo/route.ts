import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import https from 'https'

// MoMo integration
// Docs: https://developers.momo.vn/
// Test environment: https://test-payment.momo.vn

const MOMO_ENDPOINT   = 'https://test-payment.momo.vn/v2/gateway/api/create'
const PARTNER_CODE    = process.env.MOMO_PARTNER_CODE || 'MOMO_TEST'
const ACCESS_KEY      = process.env.MOMO_ACCESS_KEY   || 'F8BBA842ECF85'
const SECRET_KEY      = process.env.MOMO_SECRET_KEY   || 'K951B6PE1waDMi640xX08PD3vg6EkVlz'

export async function POST(req: NextRequest) {
  const { order_number, amount, order_info } = await req.json()

  const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/account/orders?success=1`
  const ipnUrl      = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/momo/ipn`
  const requestId   = `${PARTNER_CODE}${Date.now()}`

  const rawSignature = [
    `accessKey=${ACCESS_KEY}`,
    `amount=${amount}`,
    `extraData=`,
    `ipnUrl=${ipnUrl}`,
    `orderId=${order_number}`,
    `orderInfo=${order_info || 'Thanh toan don hang ' + order_number}`,
    `partnerCode=${PARTNER_CODE}`,
    `redirectUrl=${redirectUrl}`,
    `requestId=${requestId}`,
    `requestType=payWithMethod`,
  ].join('&')

  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(rawSignature)
    .digest('hex')

  const requestBody = JSON.stringify({
    partnerCode:  PARTNER_CODE,
    accessKey:    ACCESS_KEY,
    requestId,
    amount:       amount.toString(),
    orderId:      order_number,
    orderInfo:    order_info || 'Thanh toan don hang ' + order_number,
    redirectUrl,
    ipnUrl,
    extraData:    '',
    requestType:  'payWithMethod',
    signature,
    lang:         'vi',
  })

  return new Promise<NextResponse>((resolve) => {
    const options = {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
    }

    const req2 = https.request(MOMO_ENDPOINT, options, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          resolve(NextResponse.json({
            payment_url: parsed.payUrl,
            qr_code:     parsed.qrCodeUrl,
            deeplink:    parsed.deeplink,
          }))
        } catch {
          resolve(NextResponse.json({ error: 'MoMo error' }, { status: 500 }))
        }
      })
    })

    req2.on('error', () => resolve(NextResponse.json({ error: 'Connection error' }, { status: 500 })))
    req2.write(requestBody)
    req2.end()
  })
}

// ── MoMo IPN (Instant Payment Notification) ──────────────
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { orderId, resultCode, transId } = body

  if (resultCode === 0) {
    const { createAdminClient } = await import('@/lib/supabase/server')
    const admin = createAdminClient()

    await admin.from('orders')
      .update({
        payment_status: 'paid',
        status: 'confirmed',
        tx_hash: transId?.toString(),
      })
      .eq('order_number', orderId)
  }

  return NextResponse.json({ message: 'IPN received' })
}
