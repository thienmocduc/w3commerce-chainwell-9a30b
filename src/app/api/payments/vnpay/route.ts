import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// VNPay integration
// Docs: https://sandbox.vnpayment.vn/apis/docs/
// Test card: 9704198526191432198 | 07/15 | OTP: 123456

const VNPAY_URL    = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
const TMN_CODE     = process.env.VNPAY_TMN_CODE || 'TESTCODE'
const HASH_SECRET  = process.env.VNPAY_HASH_SECRET || 'testhashsecret'

function sortObject(obj: Record<string, string>) {
  return Object.keys(obj).sort().reduce((sorted: Record<string, string>, key) => {
    sorted[key] = obj[key]
    return sorted
  }, {})
}

export async function POST(req: NextRequest) {
  const { order_id, order_number, amount, bank_code } = await req.json()

  const date   = new Date()
  const pad    = (n: number) => n.toString().padStart(2, '0')
  const createDate = `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  const expireDate = new Date(Date.now() + 15 * 60 * 1000)
  const expireStr  = `${expireDate.getFullYear()}${pad(expireDate.getMonth()+1)}${pad(expireDate.getDate())}${pad(expireDate.getHours())}${pad(expireDate.getMinutes())}${pad(expireDate.getSeconds())}`

  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/vnpay/callback`

  const params: Record<string, string> = {
    vnp_Version:      '2.1.0',
    vnp_Command:      'pay',
    vnp_TmnCode:      TMN_CODE,
    vnp_Locale:       'vn',
    vnp_CurrCode:     'VND',
    vnp_TxnRef:       order_number,
    vnp_OrderInfo:    `Thanh toan don hang ${order_number}`,
    vnp_OrderType:    'other',
    vnp_Amount:       (amount * 100).toString(),
    vnp_ReturnUrl:    returnUrl,
    vnp_IpAddr:       req.headers.get('x-forwarded-for') || '127.0.0.1',
    vnp_CreateDate:   createDate,
    vnp_ExpireDate:   expireStr,
  }
  if (bank_code) params.vnp_BankCode = bank_code

  const sorted  = sortObject(params)
  const signData = new URLSearchParams(sorted).toString()
  const hmac     = crypto.createHmac('sha512', HASH_SECRET)
  const signed   = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex')

  const paymentUrl = `${VNPAY_URL}?${signData}&vnp_SecureHash=${signed}`

  return NextResponse.json({ payment_url: paymentUrl })
}

// ── VNPay callback ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const vnpParams: Record<string, string> = {}

  searchParams.forEach((value, key) => {
    if (key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType') {
      vnpParams[key] = value
    }
  })

  const receivedHash = searchParams.get('vnp_SecureHash')
  const sorted       = sortObject(vnpParams)
  const signData     = new URLSearchParams(sorted).toString()
  const hmac         = crypto.createHmac('sha512', HASH_SECRET)
  const signed       = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex')

  const isValid     = signed === receivedHash
  const isSuccess   = searchParams.get('vnp_ResponseCode') === '00'
  const orderNumber = searchParams.get('vnp_TxnRef')

  if (isValid && isSuccess && orderNumber) {
    // Update order status
    const { createAdminClient } = await import('@/lib/supabase/server')
    const admin = createAdminClient()

    await admin.from('orders')
      .update({
        payment_status: 'paid',
        status: 'confirmed',
        tx_hash: searchParams.get('vnp_TransactionNo') || undefined,
      })
      .eq('order_number', orderNumber)

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/account/orders?success=1`)
  }

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/checkout?payment_error=1`)
}
