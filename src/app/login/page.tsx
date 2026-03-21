'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff } from 'lucide-react'

type Tab = 'login' | 'register'
type Role = 'buyer' | 'koc' | 'vendor'

const loginSchema = z.object({
  email:    z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Nhập mật khẩu'),
})

const registerSchema = z.object({
  display_name: z.string().min(2, 'Nhập họ và tên'),
  email:        z.string().email('Email không hợp lệ'),
  phone:        z.string().regex(/^0[0-9]{9}$/, 'SĐT không hợp lệ'),
  password:     z.string().min(8, 'Tối thiểu 8 ký tự'),
})

type LoginForm    = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

const ROLES: { id: Role; vi: string; en: string; icon: string; desc: string }[] = [
  { id: 'buyer',  vi: 'Người mua',  en: 'Buyer',  icon: '🛍️', desc: 'Mua sắm & nhận ưu đãi' },
  { id: 'koc',    vi: 'KOC/KOL',   en: 'KOC',    icon: '⭐',  desc: 'Chia sẻ & kiếm hoa hồng' },
  { id: 'vendor', vi: 'Vendor',     en: 'Vendor', icon: '🏪',  desc: 'Bán hàng & quản lý kho' },
]

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <AuthPageInner />
    </Suspense>
  )
}

function AuthPageInner() {
  const router      = useRouter()
  const params      = useSearchParams()
  const redirect    = params.get('redirect') || '/'
  const supabase    = createClient()

  const [tab,      setTab]      = useState<Tab>('login')
  const [role,     setRole]     = useState<Role>('buyer')
  const [loading,  setLoading]  = useState(false)
  const [showPw,   setShowPw]   = useState(false)

  // ── Login form ────────────────────────────────────────────
  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })
  const regForm   = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  const handleLogin = async (data: LoginForm) => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email:    data.email,
      password: data.password,
    })
    setLoading(false)

    if (error) {
      toast.error(error.message === 'Invalid login credentials'
        ? 'Email hoặc mật khẩu không đúng'
        : error.message
      )
      return
    }

    toast.success('Đăng nhập thành công!')
    router.push(redirect)
    router.refresh()
  }

  const handleRegister = async (data: RegisterForm) => {
    setLoading(true)

    // 1. Create Supabase auth user
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email:    data.email,
      password: data.password,
      options: {
        data: { display_name: data.display_name, phone: data.phone, role },
      },
    })

    if (authErr || !authData.user) {
      setLoading(false)
      toast.error(authErr?.message || 'Đăng ký thất bại')
      return
    }

    // 2. Create profile (trigger also creates wallet)
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({
        id:           authData.user.id,
        role,
        display_name: data.display_name,
        phone:        data.phone,
        referral_code: data.display_name.toLowerCase().replace(/\s+/g, '') + Math.random().toString(36).slice(2, 6).toUpperCase(),
      })

    if (profileErr) {
      setLoading(false)
      toast.error('Tạo hồ sơ thất bại: ' + profileErr.message)
      return
    }

    // 3. Create role-specific profile
    if (role === 'koc') {
      await supabase.from('koc_profiles').upsert({
        user_id: authData.user.id,
        handle:  '@' + data.display_name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, ''),
      })
    } else if (role === 'vendor') {
      await supabase.from('vendor_profiles').upsert({
        user_id:       authData.user.id,
        business_name: data.display_name,
      })
    }

    setLoading(false)
    toast.success('Tạo tài khoản thành công! Kiểm tra email để xác minh.')

    // Redirect to appropriate dashboard
    if (role === 'koc')    router.push('/koc')
    else if (role === 'vendor') router.push('/vendor')
    else router.push(redirect)
    router.refresh()
  }

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}` },
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="p-8 pb-0 text-center">
          <div className="font-syne text-3xl font-black text-gray-900 mb-1 tracking-tight">
            Well<span className="bg-gradient-to-r from-green-500 via-cyan-500 to-indigo-500 bg-clip-text text-transparent">KOC</span>
          </div>
          <p className="text-sm text-gray-400 mb-6">
            {tab === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}
          </p>

          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            {(['login', 'register'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                }`}
              >
                {t === 'login' ? 'Đăng nhập' : 'Đăng ký'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-8 pt-0">
          {/* ── LOGIN FORM ── */}
          {tab === 'login' && (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Email</label>
                <input
                  {...loginForm.register('email')}
                  type="email"
                  placeholder="ban@email.com"
                  className="input"
                  autoComplete="email"
                />
                {loginForm.formState.errors.email && (
                  <p className="text-red-500 text-xs mt-1">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Mật khẩu</label>
                <div className="relative">
                  <input
                    {...loginForm.register('password')}
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input pr-10"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-red-500 text-xs mt-1">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={15} className="animate-spin" /> Đang đăng nhập…</> : 'Đăng nhập →'}
              </button>
            </form>
          )}

          {/* ── REGISTER FORM ── */}
          {tab === 'register' && (
            <form onSubmit={regForm.handleSubmit(handleRegister)} className="space-y-4">

              {/* Role selector */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Đăng ký với tư cách:</p>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        role === r.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">{r.icon}</div>
                      <div className={`text-xs font-semibold ${role === r.id ? 'text-indigo-700' : 'text-gray-700'}`}>
                        {r.vi}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Họ và tên *</label>
                <input {...regForm.register('display_name')} placeholder="Nguyễn Văn A" className="input" />
                {regForm.formState.errors.display_name && (
                  <p className="text-red-500 text-xs mt-1">{regForm.formState.errors.display_name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Email *</label>
                  <input {...regForm.register('email')} type="email" placeholder="email@..." className="input" />
                  {regForm.formState.errors.email && (
                    <p className="text-red-500 text-xs mt-1">{regForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Điện thoại *</label>
                  <input {...regForm.register('phone')} placeholder="0912…" type="tel" className="input" />
                  {regForm.formState.errors.phone && (
                    <p className="text-red-500 text-xs mt-1">{regForm.formState.errors.phone.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Mật khẩu * (min 8 ký tự)</label>
                <div className="relative">
                  <input
                    {...regForm.register('password')}
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input pr-10"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {regForm.formState.errors.password && (
                  <p className="text-red-500 text-xs mt-1">{regForm.formState.errors.password.message}</p>
                )}
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={15} className="animate-spin" /> Đang tạo tài khoản…</> : 'Tạo tài khoản →'}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-xs text-gray-400 bg-white px-3">hoặc</div>
          </div>

          {/* Social logins */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleGoogleLogin} className="btn-secondary flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button className="btn-secondary flex items-center justify-center gap-2 opacity-50 cursor-not-allowed" disabled>
              <span className="text-blue-600 font-bold text-base">Z</span>
              Zalo (sắp ra)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
