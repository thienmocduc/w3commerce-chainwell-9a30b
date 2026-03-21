# WellKOC Platform — Full-Stack v2

**Stack:** Next.js 14 · TypeScript · Supabase · Tailwind CSS · Vercel

---

## 🚀 Bắt đầu trong 15 phút

### 1. Clone và cài đặt

```bash
git clone <repo>
cd wellkoc-v2
npm install
```

### 2. Tạo Supabase project

1. Vào https://app.supabase.com → New project
2. Điền tên: `wellkoc` | DB password: lưu lại
3. Chờ ~2 phút deploy xong

### 3. Setup database

```bash
# Copy schema lên Supabase SQL Editor
# Vào: Project → SQL Editor → New query → paste file supabase/schema.sql → Run
```

Hoặc dùng Supabase CLI:
```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

### 4. Cấu hình environment

```bash
cp .env.local.example .env.local
```

Điền vào `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Lấy keys tại: Supabase → Project Settings → API

### 5. Enable Auth providers trong Supabase

Supabase Dashboard → Authentication → Providers:
- **Email**: ✅ Enable, Confirm email: tùy chọn (tắt khi dev)
- **Google**: cần Google Cloud Console OAuth credentials
- **Phone**: cần Twilio (optional)

### 6. Chạy development

```bash
npm run dev
# → http://localhost:3000
```

---

## 📁 Cấu trúc project

```
src/
├── app/
│   ├── api/
│   │   ├── products/          # GET list, POST create
│   │   ├── orders/            # POST place order, GET list
│   │   │   └── delivered/     # Webhook khi giao hàng → trigger commission
│   │   ├── commissions/       # GET KOC commissions
│   │   └── payments/
│   │       ├── vnpay/         # VNPay tích hợp
│   │       ├── momo/          # MoMo tích hợp
│   │       └── crypto/        # USDT on Polygon verify
│   ├── auth/callback/         # OAuth callback
│   ├── login/                 # Login + Register page
│   ├── marketplace/           # Product listing (Server Component)
│   ├── checkout/              # 3-step checkout (Client Component)
│   ├── account/               # Buyer dashboard
│   ├── vendor/                # Vendor hub
│   ├── koc/                   # KOC hub
│   └── admin/                 # Admin panel
├── components/
│   ├── marketplace/           # ProductGrid, ProductFilters...
│   ├── checkout/              # CheckoutSummary, PaymentSelect...
│   └── shared/                # Navbar, CartDrawer, NotificationBell...
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # Browser client
│   │   └── server.ts          # Server client + admin client
│   ├── store/
│   │   └── cart.ts            # Zustand cart store (persisted)
│   └── utils.ts               # formatVND, calcCommission, cn...
├── types/
│   └── database.ts            # TypeScript types from Supabase schema
└── middleware.ts               # Auth + role protection
```

---

## 💰 Commission logic

```
Vendor discount: 15–55% → Platform revenue = 100%

Distribution:
├── T1 KOC (direct): 40%   → Paid T+48h on delivery
├── T2 KOC (sponsor): 13%  → Paid T+48h (need active ≥1 order/month)
├── Pool A (monthly): 9%   → Top 30 ranking, paid mùng 5
├── Pool B (annual): 5%    → Annual prizes: phone→motorbike→car→apartment
├── Pool C (global): 3%    → Quarterly, chia đều KOC active
└── WellKOC ops: 30%
```

Trigger commission: `POST /api/orders/delivered` (webhook từ shipper hoặc manual admin)

---

## 🏦 Payment gateways

### VNPay (sandbox)
- TMN Code: lấy tại https://sandbox.vnpayment.vn
- Test card: `9704198526191432198` | `07/15` | OTP: `123456`

### MoMo (sandbox)
- Đăng ký tại: https://developers.momo.vn
- Test phone: `0000000000` | OTP: `000000`

### Crypto USDT on Polygon
- Testnet: Polygon Amoy (chainId: 80002)
- Faucet: https://faucet.polygon.technology
- USDT testnet: deploy contract hoặc dùng mock token

---

## 🚀 Deploy lên Vercel

```bash
# 1. Push lên GitHub
git add . && git commit -m "init" && git push

# 2. Import vào Vercel
# vercel.com/new → Import từ GitHub

# 3. Điền Environment Variables trong Vercel dashboard
# (copy từ .env.local)

# 4. Deploy!
vercel --prod
```

Sau deploy, update Supabase:
- Authentication → URL Configuration → Site URL: `https://your-app.vercel.app`
- Add Redirect URLs: `https://your-app.vercel.app/auth/callback`

---

## 🔑 Admin account

Tạo admin trong Supabase SQL Editor:

```sql
-- 1. Tạo user qua Supabase Auth Dashboard
-- Authentication → Users → Invite user → admin@wellkoc.com

-- 2. Update role thành admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@wellkoc.com');
```

---

## 📋 Roadmap

- [x] Database schema (Supabase PostgreSQL)
- [x] Auth (email + Google OAuth)
- [x] Products API (CRUD)
- [x] Orders API (place order, server-side price validation)
- [x] Commission processing (DB function)
- [x] Cart store (Zustand, persisted)
- [x] Marketplace page (Server Component + SSR)
- [x] Checkout flow (3-step, client-side)
- [x] VNPay integration
- [x] MoMo integration
- [x] Crypto USDT verify (Polygon)
- [ ] Solidity smart contracts (Phase 2)
- [ ] KOC hub page
- [ ] Vendor hub page
- [ ] Admin dashboard
- [ ] DPP NFT mint
- [ ] Product image upload (Supabase Storage)
- [ ] Real-time order tracking (Supabase Realtime)
- [ ] Push notifications
