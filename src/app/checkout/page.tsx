'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCartStore } from '@/lib/store/cart'
import { formatVND, calcCommission } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2, MapPin, CreditCard, CheckCircle2, Package } from 'lucide-react'

const addressSchema = z.object({
  name:     z.string().min(2, 'Nhập họ tên'),
  phone:    z.string().regex(/^0[0-9]{9}$/, 'Số điện thoại không hợp lệ'),
  address:  z.string().min(5, 'Nhập địa chỉ'),
  district: z.string().min(2, 'Nhập quận/huyện'),
  city:     z.string().min(2, 'Nhập tỉnh/thành'),
})

type AddressForm = z.infer<typeof addressSchema>

type Step = 'address' | 'payment' | 'confirm' | 'success'

export default function CheckoutPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('address')
  const [payMethod, setPayMethod] = useState<string>('wallet')
  const [loading, setLoading] = useState(false)
  const [orderId, setOrderId] = useState<string>()
  const [orderNumber, setOrderNumber] = useState<string>()

  const { items, subtotal, kocRefId, clearCart } = useCartStore()
  const sub   = subtotal()
  const ship  = sub >= 500_000 ? 0 : 30_000
  const total = sub + ship

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
  })

  if (!items.length && step !== 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        <div className="text-center">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p>Giỏ hàng trống</p>
          <button onClick={() => router.push('/marketplace')} className="mt-4 text-indigo-600 text-sm font-medium">
            Tiếp tục mua sắm →
          </button>
        </div>
      </div>
    )
  }

  // ── Step bar ──────────────────────────────────────────────
  const steps: { key: Step; label: string }[] = [
    { key: 'address', label: 'Địa chỉ' },
    { key: 'payment', label: 'Thanh toán' },
    { key: 'confirm', label: 'Xác nhận' },
  ]

  const placeOrder = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          shipping_address: getValues(),
          payment_method: payMethod,
          koc_ref_id: kocRefId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Đặt hàng thất bại')
        setLoading(false)
        return
      }

      setOrderId(data.order.id)
      setOrderNumber(data.order.order_number)
      clearCart()
      setStep('success')
    } catch (e) {
      toast.error('Lỗi kết nối. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  // ── Success screen ────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-xl">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-green-200">
            <CheckCircle2 size={32} className="text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Đặt hàng thành công!</h2>
          <p className="text-indigo-600 font-mono text-sm mb-2">{orderNumber}</p>
          <p className="text-gray-400 text-sm mb-6">SMS xác nhận sẽ gửi trong vài phút</p>

          <div className="bg-gray-50 rounded-2xl p-4 text-left mb-5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tổng thanh toán</span>
              <span className="font-bold text-gray-900">{formatVND(total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Giao hàng</span>
              <span className="text-gray-600">2–3 ngày làm việc</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Hoa hồng KOC</span>
              <span className="text-green-600 font-medium">Tự động khi giao</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push('/account/orders')}
              className="py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold"
            >
              Theo dõi đơn
            </button>
            <button
              onClick={() => router.push('/marketplace')}
              className="py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium"
            >
              Mua thêm
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Step bar */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-center gap-0">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${step === s.key ? 'bg-indigo-50 text-indigo-700 font-semibold' : steps.indexOf({key:step} as any) > i ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === s.key ? 'bg-indigo-600 text-white' : steps.findIndex(x => x.key === step) > i ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {steps.findIndex(x => x.key === step) > i ? '✓' : i + 1}
                </div>
                <span className="text-sm">{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className="w-8 h-px bg-gray-200 mx-1" />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 grid md:grid-cols-5 gap-6">
        {/* Main content */}
        <div className="md:col-span-3">

          {/* STEP 1: Address */}
          {step === 'address' && (
            <form onSubmit={handleSubmit(() => setStep('payment'))} className="bg-white rounded-2xl p-6">
              <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
                <MapPin size={18} className="text-indigo-500" /> Địa chỉ giao hàng
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Họ và tên *</label>
                  <input {...register('name')} placeholder="Nguyễn Văn A" className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Số điện thoại *</label>
                  <input {...register('phone')} placeholder="0912 345 678" type="tel" className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Số nhà, tên đường *</label>
                  <input {...register('address')} placeholder="12 Trần Hưng Đạo" className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Quận/Huyện *</label>
                  <input {...register('district')} placeholder="Hoàn Kiếm" className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  {errors.district && <p className="text-red-500 text-xs mt-1">{errors.district.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Tỉnh/Thành *</label>
                  <input {...register('city')} placeholder="Hà Nội" className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
                </div>
              </div>
              <button type="submit" className="mt-5 w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors">
                Tiếp theo →
              </button>
            </form>
          )}

          {/* STEP 2: Payment */}
          {step === 'payment' && (
            <div className="bg-white rounded-2xl p-6">
              <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
                <CreditCard size={18} className="text-indigo-500" /> Phương thức thanh toán
              </h3>
              <div className="space-y-3">
                {[
                  { id: 'wallet', label: 'Ví WellKOC', sub: 'Số dư: 280,000đ', icon: '💳' },
                  { id: 'cod',    label: 'Thanh toán khi nhận hàng', sub: 'COD +15,000đ', icon: '💵' },
                  { id: 'vnpay', label: 'VNPay / ATM / Internet Banking', sub: 'Thanh toán tức thì', icon: '🏦' },
                  { id: 'w3c_token', label: 'W3C Token', sub: 'Giảm 5% khi dùng W3C', icon: '⬡' },
                ].map(m => (
                  <label key={m.id} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${payMethod === m.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="pay" value={m.id} checked={payMethod === m.id} onChange={() => setPayMethod(m.id)} className="sr-only" />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${payMethod === m.id ? 'border-indigo-500' : 'border-gray-300'}`}>
                      {payMethod === m.id && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                    </div>
                    <span className="text-lg">{m.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{m.label}</div>
                      <div className="text-xs text-gray-500">{m.sub}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setStep('address')} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">← Quay lại</button>
                <button onClick={() => setStep('confirm')} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold">Xem lại đơn →</button>
              </div>
            </div>
          )}

          {/* STEP 3: Confirm */}
          {step === 'confirm' && (
            <div className="bg-white rounded-2xl p-6">
              <h3 className="font-bold text-gray-900 mb-4">Xác nhận đơn hàng</h3>
              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                {items.map(item => (
                  <div key={item.product.id} className="flex items-center gap-3">
                    <span className="text-2xl">{item.product.emoji ?? '🏷️'}</span>
                    <div className="flex-1 text-sm">
                      <div className="font-medium text-gray-900 line-clamp-1">{item.product.name_vi}</div>
                      <div className="text-gray-400 text-xs">×{item.quantity}</div>
                    </div>
                    <span className="text-sm font-semibold">{formatVND(item.product.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 text-sm space-y-2">
                <div className="flex justify-between text-gray-500"><span>Tổng sản phẩm</span><span>{formatVND(sub)}</span></div>
                <div className="flex justify-between text-gray-500"><span>Phí vận chuyển</span><span>{ship === 0 ? 'Miễn phí' : formatVND(ship)}</span></div>
                <div className="flex justify-between font-bold text-gray-900 text-base border-t pt-2"><span>Tổng thanh toán</span><span className="text-indigo-700">{formatVND(total)}</span></div>
              </div>
              <div className="mt-4 p-3 bg-green-50 rounded-xl border border-green-200 text-xs text-green-700 flex gap-2">
                <span>✓</span>
                <span>Hoa hồng KOC tự động xử lý qua smart contract khi giao hàng thành công</span>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setStep('payment')} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">← Quay lại</button>
                <button
                  onClick={placeOrder}
                  disabled={loading}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Đang xử lý…</> : '✓ Đặt hàng ngay'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Order summary sidebar */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl p-5 sticky top-24">
            <h4 className="font-bold text-gray-900 text-sm mb-3">Đơn hàng ({items.length} sản phẩm)</h4>
            <div className="space-y-2 max-h-36 overflow-y-auto mb-4">
              {items.map(item => (
                <div key={item.product.id} className="flex gap-2 text-xs">
                  <span>{item.product.emoji ?? '🏷️'}</span>
                  <span className="flex-1 text-gray-700 line-clamp-1">{item.product.name_vi} ×{item.quantity}</span>
                  <span className="font-mono font-semibold text-gray-900">{formatVND(item.product.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-500"><span>Tạm tính</span><span>{formatVND(sub)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Vận chuyển</span><span className={ship === 0 ? 'text-green-600 font-medium' : ''}>{ship === 0 ? 'Miễn phí' : formatVND(ship)}</span></div>
              {sub < 500_000 && <p className="text-[10px] text-gray-400">Mua thêm {formatVND(500_000 - sub)} để miễn phí ship</p>}
            </div>
            <div className="flex justify-between font-bold text-gray-900 mt-3 pt-3 border-t">
              <span>Tổng</span>
              <span className="text-indigo-700 text-lg">{formatVND(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
