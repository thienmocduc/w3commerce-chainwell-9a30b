# WellKOC Phase 1 MVP - Tai lieu ky thuat toan dien

> Phien ban: 1.0 | Ngay cap nhat: 2026-03-27

---

## Muc luc

1. [Tong quan Phase 1 MVP](#1-tong-quan-phase-1-mvp)
2. [Kien truc he thong](#2-kien-truc-he-thong)
3. [Danh sach tinh nang Phase 1](#3-danh-sach-tinh-nang-phase-1---22-modules)
4. [Huong dan cai dat & chay project](#4-huong-dan-cai-dat--chay-project)
5. [API Reference](#5-api-reference)
6. [Database Schema](#6-database-schema)
7. [Smart Contracts](#7-smart-contracts)
8. [Environment Variables](#8-environment-variables)
9. [Deployment](#9-deployment)

---

## 1. Tong quan Phase 1 MVP

### WellKOC la gi?

WellKOC la nen tang **Web3 Social Commerce** dau tien tai Viet Nam, ket noi ba doi tuong chinh:

- **Buyer** (Nguoi mua): Mua san pham da xac minh bang DPP (Digital Product Passport)
- **KOC/KOL** (Key Opinion Consumer): Tao noi dung, chia se link affiliate, nhan hoa hong tu dong tren blockchain
- **Vendor** (Nha ban): Dang san pham, quan ly don hang, theo doi doanh thu

### Diem noi bat

- **Hoa hong on-chain**: Tu dong phan phoi hoa hong T1 (40%) + T2 (13%) + Pool A/B/C tren Polygon blockchain
- **DPP NFT**: Moi san pham co "Ho chieu ky thuat so" (Digital Product Passport) la NFT ERC-721 tren Polygon
- **111 AI Agents**: He thong AI ho tro KOC tao noi dung, hashtag, lich dang bai, coaching
- **Gamification**: He thong XP/WK Token, thanh tich, nhiem vu, bang xep hang
- **Multi-gateway payment**: VNPay, MoMo, PayOS, USDT on-chain

### Muc tieu Phase 1

- Xay dung toan bo backend API (22 modules) voi day du CRUD va business logic
- Trien khai smart contracts tren Polygon (Commission, DPP, WK Token, Reputation NFT)
- Frontend React SPA voi 18+ trang (lazy-loaded)
- Tich hop thanh toan da cong (VNPay, MoMo, PayOS, USDT)
- He thong real-time qua WebSocket

---

## 2. Kien truc he thong

```
                          +-------------------+
                          |   Frontend (SPA)  |
                          |  React + TS + Vite|
                          |   Port: 5173      |
                          +---------+---------+
                                    |
                                    | HTTPS / WSS
                                    v
                          +-------------------+
                          |   Backend (API)   |
                          |  FastAPI + Python  |
                          |  Uvicorn :8000     |
                          +---------+---------+
                                    |
                  +-----------------+-----------------+
                  |                 |                 |
                  v                 v                 v
         +--------+------+  +------+------+  +-------+-------+
         |  PostgreSQL   |  |    Redis    |  | Elasticsearch |
         |  (Supabase)   |  |  Cache/Cart |  | Vector Search |
         |  Port: 5432   |  |  Port: 6379 |  |  Port: 9200   |
         +---------------+  +------+------+  +---------------+
                                    |
                                    v
                          +-------------------+
                          |   Celery Workers  |
                          | Commission Settle |
                          | DPP Mint / Notif  |
                          +-------------------+
                                    |
                                    v
                    +-------------------------------+
                    |     Polygon Blockchain         |
                    |  (Mainnet: 137 / Testnet: Amoy)|
                    +-------------------------------+
                    |  CommissionDistributor.sol     |
                    |  WellKOCCommission.sol         |
                    |  WellKOCDPP.sol / DPPFactory   |
                    |  WKToken.sol / W3CToken.sol    |
                    |  ReputationNFT.sol             |
                    |  CreatorTokenFactory.sol       |
                    +-------------------------------+

         +-------------------------------------------+
         |         Third-party Integrations           |
         +-------------------------------------------+
         | VNPay  | MoMo  | PayOS  | GHN   | GHTK   |
         | Twilio | FCM   | Pinata | S3    | Sentry  |
         | Anthropic (Claude AI)                      |
         +-------------------------------------------+
```

### Tech Stack chi tiet

| Layer | Technology | Phien ban |
|-------|-----------|----------|
| Frontend | React + TypeScript + Vite | React 18, Vite 5 |
| Backend | FastAPI + Python + SQLAlchemy | FastAPI 0.110+, Python 3.11+ |
| Database | PostgreSQL (Supabase) | PostgreSQL 15+ |
| Cache | Redis | Redis 7+ |
| Search | Elasticsearch + pgvector | ES 8+ |
| Blockchain | Polygon (Solidity) | Solidity 0.8.20-0.8.24 |
| Smart Contract Framework | Hardhat / Foundry | |
| Background Jobs | Celery + Redis | |
| AI | Anthropic Claude API | claude-sonnet-4-6 |
| Storage | AWS S3 + Pinata (IPFS) | |
| Monitoring | Sentry + Prometheus | |

---

## 3. Danh sach tinh nang Phase 1 - 22 Modules

### Module 1: Auth & Users
- **Mo ta**: Dang ky, dang nhap, OTP, ket noi vi MetaMask, JWT token management
- **API Endpoints**:
  - `POST /api/v1/auth/register` - Dang ky tai khoan (Buyer/KOC/Vendor)
  - `POST /api/v1/auth/login` - Dang nhap bang email/phone + password
  - `POST /api/v1/auth/otp/send` - Gui OTP qua SMS/email
  - `POST /api/v1/auth/otp/verify` - Xac minh OTP
  - `POST /api/v1/auth/wallet/connect` - Dang nhap bang MetaMask (EIP-712)
  - `POST /api/v1/auth/refresh` - Lam moi access token
  - `POST /api/v1/auth/logout` - Dang xuat
  - `GET /api/v1/auth/me` - Thong tin user hien tai
- **Trang thai**: Done

### Module 2: Products
- **Mo ta**: CRUD san pham, tim kiem hybrid (vector + full-text), filter, sort, DPP mint
- **API Endpoints**:
  - `GET /api/v1/products` - Danh sach san pham (filter, sort, pagination)
  - `GET /api/v1/products/search` - Tim kiem hybrid (pgvector + Elasticsearch, 5 ngon ngu)
  - `GET /api/v1/products/{product_id}` - Chi tiet san pham
  - `POST /api/v1/products` - Tao san pham (Vendor only)
  - `PUT /api/v1/products/{product_id}` - Cap nhat san pham
  - `DELETE /api/v1/products/{product_id}` - Xoa mem (archive)
  - `POST /api/v1/products/{product_id}/dpp` - Mint DPP NFT tren Polygon
- **Trang thai**: Done

### Module 3: Cart
- **Mo ta**: Gio hang luu tren Redis (TTL 7 ngay), ho tro copy cart cua KOC
- **API Endpoints**:
  - `GET /api/v1/cart` - Xem gio hang
  - `POST /api/v1/cart/items` - Them san pham vao gio
  - `PATCH /api/v1/cart/items/{product_id}` - Cap nhat so luong
  - `DELETE /api/v1/cart/items/{product_id}` - Xoa san pham khoi gio
  - `DELETE /api/v1/cart` - Xoa toan bo gio hang
  - `POST /api/v1/cart/copy/{koc_id}` - Sao chep gio hang tu KOC
- **Trang thai**: Done

### Module 4: Orders
- **Mo ta**: Tao don hang, theo doi trang thai, idempotency key, status machine
- **API Endpoints**:
  - `POST /api/v1/orders` - Tao don hang moi (checkout)
  - `GET /api/v1/orders` - Danh sach don hang cua user
  - `GET /api/v1/orders/{order_id}` - Chi tiet don hang
  - `PUT /api/v1/orders/{order_id}/status` - Cap nhat trang thai (Vendor/Admin)
  - `GET /api/v1/orders/{order_id}/tracking` - Theo doi van chuyen
- **Trang thai**: Done

### Module 5: Payments
- **Mo ta**: Thanh toan da cong (VNPay, MoMo, PayOS, USDT on-chain), webhook xu ly tu dong
- **API Endpoints**:
  - `POST /api/v1/payments/initiate` - Khoi tao thanh toan (chon gateway)
  - `POST /api/v1/payments/webhook/vnpay` - Webhook nhan ket qua VNPay
  - `POST /api/v1/payments/webhook/momo` - Webhook nhan ket qua MoMo
  - `POST /api/v1/payments/webhook/payos` - Webhook nhan ket qua PayOS
  - `POST /api/v1/payments/verify/usdt` - Xac minh giao dich USDT on-chain
  - `GET /api/v1/payments/status/{txn_ref}` - Kiem tra trang thai thanh toan
- **Trang thai**: Done

### Module 6: Commissions
- **Mo ta**: Tinh hoa hong T1/T2, theo doi trang thai, on-chain settlement
- **API Endpoints**:
  - `GET /api/v1/commissions` - Danh sach hoa hong cua KOC
  - `GET /api/v1/commissions/summary` - Tong hop hoa hong (da thanh toan + dang cho)
  - `GET /api/v1/commissions/pending` - Hoa hong dang cho xu ly
- **Trang thai**: Done

### Module 7: Reviews
- **Mo ta**: Danh gia san pham (cua so 48h sau khi nhan hang), hash noi dung cho on-chain integrity, flag/remove
- **API Endpoints**:
  - `POST /api/v1/reviews` - Tao danh gia (nguoi mua, trong 48h)
  - `GET /api/v1/reviews/product/{product_id}` - Danh sach danh gia san pham
  - `GET /api/v1/reviews/stats/{product_id}` - Thong ke danh gia (trung binh, phan bo sao)
  - `PUT /api/v1/reviews/{review_id}/flag` - Vendor ghi co danh gia
  - `DELETE /api/v1/reviews/{review_id}` - Admin xoa danh gia
- **Trang thai**: Done

### Module 8: DPP (Digital Product Passport)
- **Mo ta**: Mint, xac minh, scan DPP NFT tren Polygon. Metadata luu tren IPFS.
- **API Endpoints**:
  - `POST /api/v1/dpp/mint/{product_id}` - Mint DPP NFT (Vendor only)
  - `GET /api/v1/dpp/verify/{token_id}` - Xac minh DPP (public)
  - `GET /api/v1/dpp/product/{product_id}` - Thong tin DPP cua san pham
  - `POST /api/v1/dpp/scan/{token_id}` - Scan DPP (nhan WK token)
- **Trang thai**: Done

### Module 9: KYC
- **Mo ta**: Upload CCCD (mat truoc + mat sau), duyet/tu choi boi admin
- **API Endpoints**:
  - `POST /api/v1/kyc/upload` - Upload anh CCCD (JPEG/PNG/WebP)
  - `GET /api/v1/kyc/status` - Kiem tra trang thai KYC
  - `PUT /api/v1/kyc/review/{user_id}` - Admin duyet/tu choi KYC
- **Trang thai**: Done

### Module 10: Returns & Refunds
- **Mo ta**: Yeu cau tra hang (cua so 7 ngay), vendor duyet, admin xu ly hoan tien
- **API Endpoints**:
  - `POST /api/v1/returns` - Tao yeu cau tra hang (nguoi mua)
  - `GET /api/v1/returns` - Danh sach yeu cau tra hang (theo role)
  - `GET /api/v1/returns/{return_id}` - Chi tiet yeu cau tra hang
  - `PUT /api/v1/returns/{return_id}/decision` - Vendor duyet/tu choi
  - `POST /api/v1/returns/{return_id}/refund` - Admin xu ly hoan tien
- **Trang thai**: Done

### Module 11: KOC System
- **Mo ta**: Profile KOC, affiliate link, bang xep hang, analytics
- **API Endpoints**:
  - `GET /api/v1/koc/profile/{koc_id}` - Xem profile KOC
  - `PUT /api/v1/koc/profile` - Cap nhat profile KOC
  - `GET /api/v1/koc/leaderboard` - Bang xep hang KOC (theo commission)
  - `GET /api/v1/koc/affiliate-link` - Tao link affiliate cho san pham
  - `GET /api/v1/koc/analytics` - Thong ke KOC (GMV, don hang, commission)
- **Trang thai**: Done

### Module 12: Vendor
- **Mo ta**: Dashboard vendor, quan ly don hang, mang luoi KOC, AI gia, ton kho
- **API Endpoints**:
  - `GET /api/v1/vendor/dashboard` - Tong quan (san pham, don hang, doanh thu, KOC)
  - `GET /api/v1/vendor/orders` - Danh sach don hang cua vendor
  - `GET /api/v1/vendor/koc-network` - Mang luoi KOC lien ket
  - `POST /api/v1/vendor/ai-price/{product_id}` - Goi y gia bang AI
  - `GET /api/v1/vendor/inventory` - Quan ly ton kho, canh bao het hang
- **Trang thai**: Done

### Module 13: Vendor Onboarding
- **Mo ta**: Dang ky vendor nhieu buoc, admin duyet don dang ky
- **API Endpoints**:
  - `POST /api/v1/vendor/onboard` - Gui don dang ky vendor
  - `GET /api/v1/vendor/onboard/status` - Kiem tra trang thai dang ky
  - `PUT /api/v1/vendor/onboard/{vendor_id}/review` - Admin duyet/tu choi
- **Trang thai**: Done

### Module 14: Admin
- **Mo ta**: Dashboard tong quan, quan ly user, KYC queue, theo doi commission
- **API Endpoints**:
  - `GET /api/v1/admin/dashboard` - Tong quan platform (users, KYC, commission, GMV)
  - `GET /api/v1/admin/users` - Danh sach users (filter role, KYC, search)
  - `PUT /api/v1/admin/users/{user_id}/suspend` - Khoa tai khoan user
  - `GET /api/v1/admin/kyc/queue` - Hang doi KYC can duyet
  - `PUT /api/v1/admin/kyc/{user_id}/review` - Duyet/tu choi KYC
  - `GET /api/v1/admin/commissions/pending` - Commission dang cho xu ly
- **Trang thai**: Done

### Module 15: Gamification
- **Mo ta**: WK XP, check-in hang ngay, thanh tich, nhiem vu, bang xep hang, tier KOC
- **API Endpoints**:
  - `GET /api/v1/gamification/me` - Profile WK (tier, streak, XP)
  - `POST /api/v1/gamification/checkin` - Check-in hang ngay (nhan WK)
  - `GET /api/v1/gamification/achievements` - Thanh tich da dat
  - `GET /api/v1/gamification/achievements/catalog` - Catalog thanh tich (public)
  - `GET /api/v1/gamification/missions` - Nhiem vu hien tai + tien do
  - `POST /api/v1/gamification/missions/{mission_id}/claim` - Nhan thuong nhiem vu
  - `GET /api/v1/gamification/leaderboard` - Bang xep hang (KOC GMV, orders, buyer XP)
  - `GET /api/v1/gamification/tiers` - Thong tin tier KOC (public)
- **Trang thai**: Done

### Module 16: Shipping
- **Mo ta**: Tinh phi van chuyen (GHN), danh sach nha van chuyen, theo doi don
- **API Endpoints**:
  - `POST /api/v1/shipping/calculate-fee` - Tinh phi van chuyen (GHN API)
  - `GET /api/v1/shipping/carriers` - Danh sach nha van chuyen
  - `POST /api/v1/shipping/track` - Theo doi don hang
- **Trang thai**: Done

### Module 17: AI Agents
- **Mo ta**: 111 AI Agents ho tro KOC (Caption, Hashtag, Content Calendar, Affiliate Link, Coaching)
- **API Endpoints**:
  - `POST /api/v1/ai/caption` - Agent A01: Tao caption cho TikTok/IG/FB/YT/Telegram (streaming)
  - `POST /api/v1/ai/hashtags` - Agent A03: Tao hashtag (viral/mid/niche)
  - `POST /api/v1/ai/content-calendar` - Agent A07: Len lich noi dung nhieu tuan
  - `POST /api/v1/ai/link` - Tao smart affiliate link voi UTM tracking
  - `POST /api/v1/ai/coaching/{koc_id}` - Agent A20: Bao cao coaching hieu suat KOC
- **Trang thai**: Done

### Module 18: Group Buy
- **Mo ta**: Chien dich mua chung theo tang gia, dem nguoc thoi gian, atomic counter
- **API Endpoints**:
  - `POST /api/v1/groupbuy` - Tao chien dich mua chung
  - `GET /api/v1/groupbuy` - Danh sach chien dich (filter trang thai)
  - `GET /api/v1/groupbuy/{group_buy_id}` - Chi tiet + tien do real-time
  - `POST /api/v1/groupbuy/{group_buy_id}/join` - Tham gia mua chung
  - `PUT /api/v1/groupbuy/{group_buy_id}/cancel` - Huy chien dich
- **Trang thai**: Done

### Module 19: Live Commerce
- **Mo ta**: Live stream ban hang, product popup, flash sale, replay
- **API Endpoints**:
  - `POST /api/v1/live/start` - Bat dau live stream (KOC/Vendor)
  - `GET /api/v1/live/active` - Danh sach live dang phat
  - `GET /api/v1/live/{stream_id}` - Chi tiet live stream
  - `POST /api/v1/live/{stream_id}/product-popup` - Day popup san pham
  - `POST /api/v1/live/{stream_id}/flash-sale` - Kich hoat flash sale
  - `PUT /api/v1/live/{stream_id}/end` - Ket thuc live stream
  - `GET /api/v1/live/{stream_id}/replay` - Xem lai ban ghi
- **Trang thai**: Done

### Module 20: Social
- **Mo ta**: Follow/unfollow, danh sach followers/following, feed ca nhan hoa
- **API Endpoints**:
  - `POST /api/v1/social/follow/{user_id}` - Follow nguoi dung
  - `DELETE /api/v1/social/unfollow/{user_id}` - Unfollow
  - `GET /api/v1/social/followers/{user_id}` - Danh sach nguoi theo doi
  - `GET /api/v1/social/following/{user_id}` - Danh sach dang theo doi
  - `GET /api/v1/social/feed` - Feed ca nhan hoa (review KOC + trending)
- **Trang thai**: Done

### Module 21: Membership
- **Mo ta**: Goi thanh vien (Free/Bronze/Silver/Gold/Diamond), billing, invoices
- **API Endpoints**:
  - `GET /api/v1/membership/plans` - Danh sach goi thanh vien + gia
  - `POST /api/v1/membership/subscribe` - Dang ky goi
  - `GET /api/v1/membership/current` - Goi hien tai
  - `POST /api/v1/membership/cancel` - Huy goi
  - `GET /api/v1/membership/invoices` - Lich su thanh toan
- **Trang thai**: Done

### Module 22: WebSocket (Real-time)
- **Mo ta**: Ket noi real-time cho cap nhat don hang, commission, live viewer, groupbuy
- **API Endpoints**:
  - `WS /api/v1/ws?token=JWT` - WebSocket connection
- **Events gui den client**:
  - `order_update` - Cap nhat trang thai don hang
  - `commission_paid` - Hoa hong da thanh toan
  - `live_viewer_count` - So nguoi xem live
  - `groupbuy_progress` - Tien do mua chung
  - `notification` - Thong bao chung
- **Events nhan tu client**:
  - `subscribe` - Dang ky theo doi room (live, groupbuy, koc, admin)
  - `unsubscribe` - Huy theo doi room
  - `ping` - Kiem tra ket noi
- **Trang thai**: Done

---

## 4. Huong dan cai dat & chay project

### 4.1 Prerequisites

| Tool | Phien ban | Ghi chu |
|------|----------|--------|
| Node.js | >= 18.x | Frontend |
| Python | >= 3.11 | Backend |
| PostgreSQL | >= 15 | Database (hoac Supabase) |
| Redis | >= 7 | Cache, Cart, Celery broker |
| Elasticsearch | >= 8 (optional) | Tim kiem nang cao |
| Git | >= 2.40 | Version control |

### 4.2 Clone repository

```bash
git clone https://github.com/chainwell/w3commerce.git
cd w3commerce
```

### 4.3 Backend Setup

```bash
# Tao virtual environment
cd backend
python -m venv venv

# Kich hoat (Windows)
venv\Scripts\activate
# Kich hoat (Linux/Mac)
source venv/bin/activate

# Cai dat dependencies
pip install -r requirements.txt

# Sao chep file .env
cp ../.env.example .env
# Chinh sua .env voi thong tin thuc te

# Chay migrations (Alembic)
alembic upgrade head

# Khoi dong server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend se chay tai: `http://localhost:8000`
Swagger UI: `http://localhost:8000/docs`
ReDoc: `http://localhost:8000/redoc`

### 4.4 Frontend Setup

```bash
cd frontend

# Cai dat dependencies
npm install

# Tao file .env
cat > .env << EOF
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000/api/v1/ws
VITE_POLYGON_RPC=https://rpc-amoy.polygon.technology
VITE_COMMISSION_CONTRACT=
VITE_DPP_CONTRACT=
VITE_WK_TOKEN_CONTRACT=
EOF

# Khoi dong dev server
npm run dev
```

Frontend se chay tai: `http://localhost:5173`

### 4.5 Database Setup

**Option A: Local PostgreSQL**

```bash
# Tao database
createdb wellkoc

# Chay schema
psql -d wellkoc -f supabase/schema.sql
```

**Option B: Supabase**

1. Tao project tai [supabase.com](https://supabase.com)
2. Vao SQL Editor, paste noi dung file `supabase/schema.sql`
3. Copy connection string vao `DATABASE_URL` trong `.env`

### 4.6 Redis Setup

```bash
# Docker
docker run -d --name wellkoc-redis -p 6379:6379 redis:7-alpine

# Hoac cai dat truc tiep
# Ubuntu: sudo apt install redis-server
# Mac: brew install redis
```

### 4.7 Celery Workers

```bash
cd backend

# Worker chinh (commission, gamification)
celery -A app.workers.celery_app worker --loglevel=info --queues=default,commissions

# Worker notifications
celery -A app.workers.celery_app worker --loglevel=info --queues=notifications

# Beat scheduler (cho cron jobs)
celery -A app.workers.celery_app beat --loglevel=info
```

### 4.8 Smart Contract Deployment

```bash
cd contracts

# Cai dat dependencies
npm install

# Compile
npx hardhat compile

# Deploy len Polygon Amoy testnet
npx hardhat run scripts/deploy.js --network amoy

# Verify tren PolygonScan
npx hardhat verify --network amoy <CONTRACT_ADDRESS>
```

Sau khi deploy, cap nhat cac dia chi contract vao `.env`:
- `COMMISSION_CONTRACT_ADDRESS`
- `DPP_FACTORY_ADDRESS`
- `WK_TOKEN_ADDRESS`

---

## 5. API Reference

> Base URL: `http://localhost:8000/api/v1`
> Authentication: Bearer JWT token trong header `Authorization: Bearer <token>`

### 5.1 Auth & Users

#### POST /auth/register

Dang ky tai khoan moi.

- **Auth**: Khong
- **Request Body**:
```json
{
  "email": "user@wellkoc.com",
  "phone": "+84901234567",
  "password": "SecurePass123!",
  "role": "buyer",
  "referral_code": "LINH2026",
  "language": "vi"
}
```
- **Response** (201):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

#### POST /auth/login

Dang nhap bang email/phone + password.

- **Auth**: Khong
- **Request Body**:
```json
{
  "identifier": "user@wellkoc.com",
  "password": "SecurePass123!"
}
```
- **Response** (200): TokenResponse (nhu register)

#### POST /auth/otp/send

Gui OTP qua SMS hoac email (gioi han 1 lan/phut).

- **Auth**: Khong
- **Request Body**:
```json
{
  "target": "+84901234567",
  "purpose": "verify_phone"
}
```
- **Response** (200):
```json
{
  "message": "OTP da duoc gui",
  "expires_in": 300
}
```

#### POST /auth/otp/verify

Xac minh OTP va tra ve JWT tokens.

- **Auth**: Khong
- **Request Body**:
```json
{
  "target": "+84901234567",
  "code": "123456",
  "purpose": "verify_phone"
}
```
- **Response** (200): TokenResponse

#### POST /auth/wallet/connect

Dang nhap bang vi MetaMask (xac minh EIP-712 signature).

- **Auth**: Khong
- **Request Body**:
```json
{
  "wallet_address": "0x1234...abcd",
  "signature": "0xsig...",
  "message": "Sign in to WellKOC"
}
```
- **Response** (200): TokenResponse

#### POST /auth/refresh

Lam moi access token tu refresh token.

- **Auth**: Khong
- **Request Body**: `refresh_token` (query param)
- **Response** (200): TokenResponse

#### POST /auth/logout

Dang xuat va vo hieu hoa session.

- **Auth**: Required
- **Response** (200):
```json
{
  "message": "Dang xuat thanh cong"
}
```

#### GET /auth/me

Lay thong tin user hien tai.

- **Auth**: Required
- **Response** (200): UserMeResponse (id, email, phone, role, display_name, kyc_status, membership_tier, ...)

---

### 5.2 Products

#### GET /products

Danh sach san pham voi filter va sort.

- **Auth**: Khong
- **Query Params**:
  - `category` (string, optional) - Loc theo danh muc
  - `brand` (string, optional) - Loc theo thuong hieu
  - `min_price` (float, optional) - Gia toi thieu
  - `max_price` (float, optional) - Gia toi da
  - `dpp_only` (bool, default: false) - Chi san pham co DPP
  - `sort` (enum: popular/newest/price_asc/price_desc/rating)
  - `page` (int, default: 1)
  - `per_page` (int, default: 20, max: 100)
- **Response** (200):
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Serum Vitamin C 20%",
      "price": 350000,
      "original_price": 450000,
      "thumbnail_url": "https://cdn.wellkoc.com/...",
      "rating_avg": 4.7,
      "sold_count": 1284,
      "dpp_verified": true,
      "vendor_id": "uuid"
    }
  ],
  "total": 156,
  "page": 1,
  "per_page": 20
}
```

#### GET /products/search

Tim kiem hybrid (pgvector semantic + Elasticsearch full-text). Ho tro 5 ngon ngu.

- **Auth**: Khong
- **Query Params**:
  - `q` (string, required) - Tu khoa tim kiem
  - `category` (string, optional)
  - `dpp_only` (bool, default: false)
  - `lang` (enum: vi/en/zh/hi/th)
  - `page`, `per_page`
- **Response** (200): ProductListResponse

#### GET /products/{product_id}

Chi tiet san pham voi DPP metadata.

- **Auth**: Khong
- **Response** (200): ProductResponse (full product data)

#### POST /products

Tao san pham moi (Vendor only). Tu dong mint DPP neu co certifications.

- **Auth**: Required (Vendor/Admin)
- **Request Body**:
```json
{
  "name": "Serum Vitamin C 20%",
  "description": "Serum duong da...",
  "price": 350000,
  "category": "skincare",
  "images": ["url1", "url2"],
  "certifications": ["GMP", "ISO22000"],
  "manufacturer": "ABC Corp",
  "origin_country": "Vietnam"
}
```
- **Response** (201): ProductResponse

#### PUT /products/{product_id}

Cap nhat san pham (chu so huu hoac admin).

- **Auth**: Required
- **Request Body**: ProductUpdate (partial fields)
- **Response** (200): ProductResponse

#### DELETE /products/{product_id}

Xoa mem san pham (archive).

- **Auth**: Required
- **Response** (204): No content

#### POST /products/{product_id}/dpp

Trigger mint DPP NFT tren Polygon (async qua Celery).

- **Auth**: Required (Vendor/Admin)
- **Response** (202):
```json
{
  "message": "DPP minting queued",
  "job_id": "celery-task-id"
}
```

---

### 5.3 Cart

#### GET /cart

Xem gio hang (luu tren Redis, TTL 7 ngay).

- **Auth**: Required
- **Response** (200):
```json
{
  "items": [
    {
      "product_id": "uuid",
      "name": "Serum Vitamin C",
      "thumbnail": "url",
      "price": 350000,
      "quantity": 2,
      "dpp_verified": true,
      "koc_ref_id": "abc123"
    }
  ],
  "item_count": 2,
  "subtotal": 700000,
  "total": 700000
}
```

#### POST /cart/items

Them san pham vao gio hang.

- **Auth**: Required
- **Request Body**:
```json
{
  "product_id": "uuid",
  "variant_id": "uuid (optional)",
  "quantity": 1,
  "koc_ref_id": "KOC_REFERRAL_CODE"
}
```
- **Response** (201):
```json
{
  "status": "added",
  "item_count": 3
}
```

#### PATCH /cart/items/{product_id}

Cap nhat so luong (quantity=0 de xoa).

- **Auth**: Required
- **Request Body**: `{"quantity": 3}`
- **Response** (200): `{"status": "updated"}`

#### DELETE /cart/items/{product_id}

Xoa san pham khoi gio.

- **Auth**: Required
- **Response** (204)

#### DELETE /cart

Xoa toan bo gio hang.

- **Auth**: Required
- **Response** (204)

#### POST /cart/copy/{koc_id}

Sao chep gio hang cua KOC vao gio minh.

- **Auth**: Required
- **Response** (200):
```json
{
  "status": "copied",
  "items_added": 3
}
```

---

### 5.4 Orders

#### POST /orders

Tao don hang moi (checkout). Ho tro idempotency key chong duplicate.

- **Auth**: Required
- **Request Body**:
```json
{
  "items": [
    {
      "product_id": "uuid",
      "vendor_id": "uuid",
      "name": "Serum Vitamin C",
      "price": 350000,
      "quantity": 2
    }
  ],
  "shipping_address": {
    "name": "Nguyen Van A",
    "phone": "+84901234567",
    "address": "123 Le Loi",
    "district": "Quan 1",
    "city": "Ho Chi Minh"
  },
  "payment_method": "vnpay",
  "voucher_code": "WELCOME50",
  "koc_ref_id": "KOC_ID",
  "idempotency_key": "unique-key-123"
}
```
- **Response** (201):
```json
{
  "order_id": "uuid",
  "order_number": "ORD-202603-A1B2C3",
  "total": 700000,
  "status": "pending"
}
```

#### GET /orders

Danh sach don hang cua user hien tai.

- **Auth**: Required
- **Query Params**: `status` (optional), `page`, `per_page`
- **Response** (200):
```json
{
  "items": [
    {
      "id": "uuid",
      "order_number": "ORD-202603-A1B2C3",
      "status": "confirmed",
      "total": 700000,
      "items": [...],
      "payment_method": "vnpay",
      "created_at": "2026-03-25T10:30:00Z"
    }
  ],
  "total": 15,
  "page": 1
}
```

#### GET /orders/{order_id}

Chi tiet don hang.

- **Auth**: Required (buyer hoac admin)
- **Response** (200): Order detail object

#### PUT /orders/{order_id}/status

Cap nhat trang thai don hang (Vendor/Admin). Khi status = DELIVERED, tu dong trigger tinh commission va gamification.

- **Auth**: Required (Vendor/Admin)
- **Query Params**: `status` (string)
- **Status flow**: pending -> confirmed -> packing -> shipping -> delivered -> completed
- **Response** (200):
```json
{
  "status": "delivered",
  "order_id": "uuid"
}
```

#### GET /orders/{order_id}/tracking

Thong tin theo doi van chuyen.

- **Auth**: Required
- **Response** (200):
```json
{
  "tracking_number": "GHN123456",
  "carrier": "GHN",
  "status": "shipping",
  "history": [
    {"status": "confirmed", "timestamp": "2026-03-25T10:30:00Z"},
    {"status": "shipping", "timestamp": "2026-03-26T08:00:00Z"}
  ]
}
```

---

### 5.5 Payments

#### POST /payments/initiate

Khoi tao thanh toan. Tra ve URL redirect den cong thanh toan.

- **Auth**: Required
- **Request Body**:
```json
{
  "order_id": "uuid",
  "gateway": "vnpay",
  "return_url": "https://wellkoc.com/payment/return"
}
```
- **Gateway = vnpay** - Response:
```json
{
  "gateway": "vnpay",
  "payment_url": "https://sandbox.vnpayment.vn/...",
  "txn_ref": "A1B2C3D4"
}
```
- **Gateway = momo** - Response:
```json
{
  "gateway": "momo",
  "payment_url": "https://momo.vn/...",
  "deeplink": "momo://...",
  "qr_code_url": "https://...",
  "txn_ref": "A1B2C3D4"
}
```
- **Gateway = payos** - Response:
```json
{
  "gateway": "payos",
  "payment_url": "https://pay.payos.vn/...",
  "order_code": 1234567890,
  "txn_ref": "A1B2C3D4"
}
```
- **Gateway = usdt** - Response:
```json
{
  "gateway": "usdt",
  "network": "Polygon",
  "contract": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  "amount_usdt": 28.57,
  "wallet": "0x1234...",
  "txn_ref": "A1B2C3D4"
}
```

#### POST /payments/webhook/vnpay

Webhook VNPay (VNPay goi). Xac minh signature HMAC-SHA512, cap nhat trang thai don hang.

- **Auth**: Khong (VNPay server call)

#### POST /payments/webhook/momo

Webhook MoMo. Xac minh signature HMAC-SHA256.

- **Auth**: Khong (MoMo server call)

#### POST /payments/webhook/payos

Webhook PayOS. Xac minh checksum.

- **Auth**: Khong (PayOS server call)

#### POST /payments/verify/usdt

Xac minh giao dich USDT on-chain tren Polygon. Kiem tra receipt, parse Transfer event, verify so tien.

- **Auth**: Required
- **Request Body**:
```json
{
  "order_id": "uuid",
  "tx_hash": "0xabc123...",
  "network": "polygon"
}
```
- **Response** (200):
```json
{
  "verified": true,
  "tx_hash": "0xabc123...",
  "amount_usdt": 28.57,
  "expected_usdt": 28.57,
  "block_number": 48392014,
  "order_status": "confirmed"
}
```

#### GET /payments/status/{txn_ref}

Kiem tra trang thai thanh toan.

- **Auth**: Required
- **Response** (200):
```json
{
  "txn_ref": "A1B2C3D4",
  "order_id": "uuid",
  "order_number": "ORD-202603-A1B2C3",
  "status": "paid",
  "payment_method": "vnpay",
  "paid_at": "2026-03-25T10:35:00Z",
  "order_status": "confirmed"
}
```

---

### 5.6 Commissions

#### GET /commissions

Danh sach commission cua KOC hien tai.

- **Auth**: Required
- **Query Params**: `status` (optional), `period` (format: 2026-W12), `page`, `per_page`
- **Response** (200):
```json
{
  "items": [
    {
      "id": "uuid",
      "type": "t1",
      "amount": 140000,
      "status": "settled",
      "tx_hash": "0xabc...",
      "block": 48392014,
      "created_at": "2026-03-25T10:35:00Z"
    }
  ],
  "total": 45,
  "page": 1
}
```

#### GET /commissions/summary

Tong hop commission.

- **Auth**: Required
- **Response** (200):
```json
{
  "total_settled": 5600000,
  "count": 45,
  "pending_amount": 840000,
  "currency": "VND"
}
```

#### GET /commissions/pending

Commission dang cho xu ly.

- **Auth**: Required
- **Response** (200):
```json
{
  "items": [
    {"id": "uuid", "amount": 140000, "type": "t1", "status": "queued"}
  ],
  "total_pending": 840000
}
```

---

### 5.7 KOC System

#### GET /koc/profile/{koc_id}

Xem profile KOC (public).

- **Auth**: Khong
- **Response** (200):
```json
{
  "id": "uuid",
  "display_name": "Linh Beauty",
  "bio": "KOC skincare top 1 Vietnam",
  "avatar_url": "https://...",
  "reputation_score": 850,
  "total_commission_earned": 15600000,
  "tier": "gold",
  "referral_code": "LINH2026"
}
```

#### PUT /koc/profile

Cap nhat profile KOC.

- **Auth**: Required (KOC only)
- **Request Body**:
```json
{
  "display_name": "Linh Beauty Official",
  "bio": "Updated bio",
  "avatar_url": "https://..."
}
```

#### GET /koc/leaderboard

Bang xep hang KOC theo tong commission.

- **Auth**: Khong
- **Query Params**: `limit` (10-200, default: 50)
- **Response** (200):
```json
{
  "items": [
    {"rank": 1, "id": "uuid", "display_name": "Linh", "total_earned": 15600000, "reputation_score": 850}
  ]
}
```

#### GET /koc/affiliate-link

Tao link affiliate cho san pham.

- **Auth**: Required (KOC only)
- **Query Params**: `product_id` (UUID)
- **Response** (200):
```json
{
  "short_url": "https://wkc.io/A1B2C3D4",
  "full_url": "https://wellkoc.com/products/{id}?ref=LINH2026",
  "short_code": "A1B2C3D4"
}
```

#### GET /koc/analytics

Thong ke hieu suat KOC.

- **Auth**: Required (KOC only)
- **Response** (200):
```json
{
  "gmv_total": 284000000,
  "orders_total": 1560,
  "commission_total": 15600000,
  "reputation_score": 850,
  "referral_code": "LINH2026"
}
```

---

### 5.8 DPP (Digital Product Passport)

#### POST /dpp/mint/{product_id}

Mint DPP NFT tren Polygon (async).

- **Auth**: Required (Vendor/Admin)
- **Response** (200):
```json
{
  "job_id": "celery-task-id",
  "product_id": "uuid",
  "status": "queued",
  "message": "DPP NFT minting da duoc xep hang"
}
```

#### GET /dpp/verify/{token_id}

Xac minh DPP token (public - dung cho QR scan).

- **Auth**: Khong
- **Response** (200): DPP metadata (product info, certifications, supply chain, carbon score)

#### GET /dpp/product/{product_id}

Thong tin DPP cua san pham.

- **Auth**: Khong
- **Response** (200):
```json
{
  "dpp_verified": true,
  "product_id": "uuid",
  "product_name": "Serum Vitamin C 20%",
  "token_id": 42,
  "contract_address": "0x...",
  "ipfs_uri": "ipfs://Qm...",
  "certifications": ["GMP", "ISO22000"],
  "manufacturer": "ABC Corp",
  "origin_country": "Vietnam"
}
```

#### POST /dpp/scan/{token_id}

Scan DPP NFT (nhan WK token thuong).

- **Auth**: Required
- **Response** (200):
```json
{
  "scanned": true,
  "wk_earned": 15,
  "message": "San pham chinh hang da xac minh"
}
```

---

### 5.9 KYC

#### POST /kyc/upload

Upload anh CCCD (mat truoc + mat sau).

- **Auth**: Required
- **Content-Type**: multipart/form-data
- **Fields**: `front_image` (file), `back_image` (file) - JPEG/PNG/WebP
- **Response** (200):
```json
{
  "message": "KYC documents da duoc upload thanh cong",
  "kyc_status": "processing",
  "front_image_url": "/uploads/kyc/...",
  "back_image_url": "/uploads/kyc/..."
}
```

#### GET /kyc/status

Kiem tra trang thai KYC.

- **Auth**: Required
- **Response** (200):
```json
{
  "kyc_status": "processing",
  "has_documents": true,
  "uploaded_at": "2026-03-25T10:30:00Z",
  "reviewed_at": null,
  "reject_reason": null
}
```

#### PUT /kyc/review/{user_id}

Admin duyet hoac tu choi KYC.

- **Auth**: Required (Admin)
- **Request Body**:
```json
{
  "action": "approve",
  "reason": null
}
```
- **Response** (200):
```json
{
  "message": "KYC da duoc approve",
  "user_id": "uuid",
  "kyc_status": "approved",
  "reviewed_at": "2026-03-25T11:00:00Z"
}
```

---

### 5.10 Returns & Refunds

#### POST /returns

Tao yeu cau tra hang (cua so 7 ngay sau khi nhan hang).

- **Auth**: Required (Buyer)
- **Request Body**:
```json
{
  "order_id": "uuid",
  "reason": "damaged",
  "description": "San pham bi vo khi van chuyen",
  "photo_urls": ["https://..."]
}
```
- **Reasons**: `damaged`, `wrong_item`, `not_as_described`, `other`
- **Response** (201): ReturnRequest object

#### GET /returns

Danh sach yeu cau tra hang (Buyer thay cua minh, Vendor thay cua don hang minh, Admin thay tat ca).

- **Auth**: Required
- **Query Params**: `status`, `page`, `per_page`

#### GET /returns/{return_id}

Chi tiet yeu cau tra hang.

- **Auth**: Required

#### PUT /returns/{return_id}/decision

Vendor duyet hoac tu choi yeu cau tra hang.

- **Auth**: Required (Vendor/Admin)
- **Request Body**:
```json
{
  "decision": "approved",
  "vendor_response": "Chap nhan tra hang",
  "refund_amount": 350000
}
```

#### POST /returns/{return_id}/refund

Admin xu ly hoan tien.

- **Auth**: Required (Admin)
- **Request Body**:
```json
{
  "refund_method": "original_payment",
  "refund_amount": 350000
}
```
- **Refund methods**: `original_payment`, `wallet_credit`

---

### 5.11 Vendor

#### GET /vendor/dashboard

Tong quan vendor.

- **Auth**: Required (Vendor/Admin)
- **Response** (200):
```json
{
  "products": 45,
  "orders": 1280,
  "revenue": 456000000,
  "active_kocs": 23
}
```

#### GET /vendor/orders

Don hang cua vendor.

- **Auth**: Required (Vendor/Admin)
- **Query Params**: `status`, `page`, `per_page`

#### GET /vendor/koc-network

Mang luoi KOC da tao GMV cho vendor.

- **Auth**: Required (Vendor/Admin)
- **Response** (200):
```json
{
  "kocs": [
    {"koc_id": "uuid", "gmv_generated": 45000000, "orders": 156}
  ]
}
```

#### POST /vendor/ai-price/{product_id}

AI goi y gia ban toi uu.

- **Auth**: Required (Vendor/Admin)
- **Response** (200):
```json
{
  "current_price": 350000,
  "suggested_price": 361000,
  "reasoning": "Phan tich competitor + CVR tuan + ton kho",
  "expected_revenue_uplift": "+3.2%"
}
```

#### GET /vendor/inventory

Quan ly ton kho.

- **Auth**: Required (Vendor/Admin)
- **Response** (200):
```json
{
  "products": 45,
  "low_stock": [
    {"id": "uuid", "name": "Serum Vitamin C", "stock": 5, "reorder_point": 10}
  ],
  "total_sku": 45
}
```

---

### 5.12 Vendor Onboarding

#### POST /vendor/onboard

Gui don dang ky vendor.

- **Auth**: Required
- **Request Body**:
```json
{
  "business_name": "ABC Cosmetics",
  "tax_code": "0123456789",
  "business_license_url": "https://...",
  "bank_account": "1234567890",
  "bank_name": "Vietcombank",
  "address": "123 Le Loi, Q1, HCMC",
  "phone": "+84901234567",
  "product_categories": ["skincare", "supplement"],
  "dpp_certifications": ["GMP", "ISO22000"]
}
```
- **Response** (200):
```json
{
  "vendor_id": "uuid",
  "status": "pending_review",
  "message": "Don dang ky vendor da duoc gui, cho duyet"
}
```

#### GET /vendor/onboard/status

Kiem tra trang thai dang ky vendor.

- **Auth**: Required

#### PUT /vendor/onboard/{vendor_id}/review

Admin duyet/tu choi don dang ky vendor.

- **Auth**: Required (Admin)
- **Request Body**:
```json
{
  "action": "approve",
  "reason": null
}
```

---

### 5.13 Admin

#### GET /admin/dashboard

Tong quan platform.

- **Auth**: Required (Admin/Super Admin)
- **Response** (200):
```json
{
  "users": {"buyer": 15420, "koc": 342, "vendor": 89},
  "kyc_pending": 23,
  "commissions": {
    "total_settled_vnd": 1560000000,
    "total_count": 8945
  },
  "today": {
    "orders": 156,
    "gmv_vnd": 78400000
  },
  "system": {
    "ai_agents_online": 108,
    "polygon_block": 48392014
  }
}
```

#### GET /admin/users

Danh sach users voi filter.

- **Auth**: Required (Admin)
- **Query Params**: `role`, `kyc_status`, `search`, `page`, `per_page`

#### PUT /admin/users/{user_id}/suspend

Khoa tai khoan user (tru super admin).

- **Auth**: Required (Admin)
- **Query Params**: `reason` (string)

#### GET /admin/kyc/queue

Hang doi KYC can duyet.

- **Auth**: Required (Admin)

#### PUT /admin/kyc/{user_id}/review

Duyet/tu choi KYC.

- **Auth**: Required (Admin)
- **Query Params**: `approved` (bool), `rejection_reason` (optional)

#### GET /admin/commissions/pending

Commission dang cho xu ly tren toan platform.

- **Auth**: Required (Admin)
- **Response** (200):
```json
{
  "pending_count": 156,
  "pending_amount_vnd": 23400000
}
```

---

### 5.14 Gamification

#### GET /gamification/me

Profile gamification ca nhan.

- **Auth**: Required
- **Response**: WK profile (tier, streak, XP, progress to next tier, recent activity)

#### POST /gamification/checkin

Check-in hang ngay. Gioi han 1 lan/ngay UTC.

- **Auth**: Required
- **Response** (200):
```json
{
  "wk_earned": 15,
  "streak_days": 7,
  "bonus": 5,
  "total_wk": 1250
}
```

#### GET /gamification/achievements

Thanh tich da dat duoc va thanh tich chua mo.

- **Auth**: Required

#### GET /gamification/achievements/catalog

Catalog toan bo thanh tich (public).

- **Auth**: Khong
- **Query Params**: `category` (optional)

#### GET /gamification/missions

Nhiem vu hien tai (daily/weekly) voi tien do.

- **Auth**: Required
- **Response** (200):
```json
{
  "missions": [
    {
      "id": "m1",
      "type": "daily",
      "name": "Chia se 3 san pham",
      "target_count": 3,
      "progress": 2,
      "progress_pct": 66,
      "status": "active",
      "wk_reward": 10,
      "can_claim": false
    }
  ],
  "period_daily": "2026-03-27",
  "period_weekly": "2026-W13"
}
```

#### POST /gamification/missions/{mission_id}/claim

Nhan thuong nhiem vu da hoan thanh.

- **Auth**: Required
- **Response** (200):
```json
{
  "claimed": true,
  "mission_name": "Chia se 3 san pham",
  "wk_reward": 10
}
```

#### GET /gamification/leaderboard

Bang xep hang live. Pool A/B/C ranking.

- **Auth**: Khong
- **Query Params**:
  - `board_type` (enum: koc_weekly_gmv/koc_weekly_orders/vendor_revenue/buyer_xp)
  - `period` (format: 2026-W12, optional)
  - `limit` (10-500, default: 100)
- **Response** (200):
```json
{
  "board_type": "koc_weekly_gmv",
  "entries": [
    {"rank": 1, "user_id": "uuid", "display_name": "Linh", "value": 45000000, "pool_tier": "A"}
  ],
  "pool_cutoffs": {
    "pool_a": "Top 5%",
    "pool_b": "Top 6-20%",
    "pool_c": "Top 21-50%"
  }
}
```

#### GET /gamification/tiers

Thong tin he thong tier KOC (public).

- **Auth**: Khong
- **Response** (200): Danh sach tiers (Bronze/Silver/Gold/Diamond/Legend) voi min XP va perks

---

### 5.15 Shipping

#### POST /shipping/calculate-fee

Tinh phi van chuyen (GHN API).

- **Auth**: Required
- **Request Body**:
```json
{
  "to_province_id": 202,
  "to_district_id": 1442,
  "to_ward_code": "21012",
  "weight": 500,
  "length": 20,
  "width": 15,
  "height": 10
}
```
- **Response** (200):
```json
{
  "fee": 35000,
  "currency": "VND",
  "carrier": "GHN",
  "estimate_days": "2-3"
}
```

#### GET /shipping/carriers

Danh sach nha van chuyen.

- **Auth**: Khong

#### POST /shipping/track

Theo doi trang thai van chuyen.

- **Auth**: Khong
- **Query Params**: `tracking_code`, `carrier`

---

### 5.16 AI Agents

#### POST /ai/caption

Agent A01: Tao caption toi uu cho platform (streaming response).

- **Auth**: Required
- **Request Body**:
```json
{
  "product_id": "uuid",
  "platform": "tiktok",
  "tone": "enthusiastic",
  "language": "vi",
  "kpi_goal": "conversion",
  "dpp_verified": true,
  "include_affiliate_placeholder": true
}
```
- **Response**: text/plain stream

#### POST /ai/hashtags

Agent A03: Tao hashtag (viral/mid/niche).

- **Auth**: Required
- **Request Body**:
```json
{
  "topic": "serum vitamin c skincare",
  "platform": "tiktok",
  "niche": "skincare",
  "language": "vi",
  "count": 30
}
```
- **Response** (200):
```json
{
  "viral": ["#skincare", "#tiktokshop"],
  "mid_tier": ["#serumvitaminc", "#duongda"],
  "niche": ["#WellKOC", "#DPPVerified"],
  "all_hashtags": [...],
  "total": 30
}
```

#### POST /ai/content-calendar

Agent A07: Len lich noi dung nhieu tuan.

- **Auth**: Required
- **Request Body**:
```json
{
  "koc_id": "uuid",
  "platform": "tiktok",
  "product_ids": ["uuid1", "uuid2"],
  "weeks": 4
}
```
- **Response** (200): ContentCalendarResponse (weeks > days > topic, time, content_type, caption_hook)

#### POST /ai/link

Tao smart affiliate link voi UTM tracking.

- **Auth**: Required
- **Request Body**:
```json
{
  "product_id": "uuid",
  "koc_id": "uuid",
  "platform": "tiktok",
  "campaign_name": "summer_sale"
}
```
- **Response** (200):
```json
{
  "short_url": "https://wkc.io/A1B2C3D4",
  "full_url": "https://wellkoc.com/products/uuid?utm_source=tiktok&...",
  "short_code": "A1B2C3D4",
  "tracking": {"platform": "tiktok", "koc_id": "uuid", "campaign": "summer_sale"}
}
```

#### POST /ai/coaching/{koc_id}

Agent A20: Bao cao coaching hieu suat KOC hang tuan.

- **Auth**: Required
- **Response** (200):
```json
{
  "report": "Bao cao chi tiet bang tieng Viet...",
  "metrics": {
    "total_orders": 284,
    "gmv_vnd": 28400000,
    "cvr": 5.9,
    "top_product": "Serum Vitamin C 20%"
  }
}
```

---

### 5.17 Group Buy

#### POST /groupbuy

Tao chien dich mua chung voi tang gia giam dan.

- **Auth**: Required
- **Request Body**:
```json
{
  "product_id": "uuid",
  "tiers": [
    {"min_qty": 10, "discount_percent": 10, "name": "Tier 1"},
    {"min_qty": 50, "discount_percent": 20, "name": "Tier 2"},
    {"min_qty": 100, "discount_percent": 30, "name": "Tier 3"}
  ],
  "duration_hours": 48,
  "max_participants": 100
}
```

#### GET /groupbuy

Danh sach chien dich. Query param: `status_filter` (default: active)

#### GET /groupbuy/{group_buy_id}

Chi tiet voi tien do real-time va danh sach nguoi tham gia.

#### POST /groupbuy/{group_buy_id}/join

Tham gia mua chung (atomic counter update).

- **Request Body**: `{"quantity": 1}`

#### PUT /groupbuy/{group_buy_id}/cancel

Huy chien dich (chi nguoi tao hoac admin).

---

### 5.18 Live Commerce

#### POST /live/start

Bat dau live stream. Tra ve RTMP stream key.

- **Auth**: Required (KOC/Vendor/Admin)
- **Request Body**:
```json
{
  "title": "Flash Sale Serum Vitamin C!",
  "description": "Giam gia 50% chi hom nay",
  "product_ids": ["uuid1", "uuid2"],
  "thumbnail_url": "https://..."
}
```
- **Response** (201):
```json
{
  "id": "uuid",
  "stream_key": "random-stream-key",
  "rtmp_url": "rtmp://live.wellkoc.com/stream/...",
  "playback_url": "https://live.wellkoc.com/watch/...",
  "title": "Flash Sale Serum Vitamin C!",
  "status": "live",
  "started_at": "2026-03-27T19:00:00Z"
}
```

#### GET /live/active

Danh sach live stream dang phat (sap xep theo viewer count).

#### GET /live/{stream_id}

Chi tiet live stream (viewer count, flash sales, product popups).

#### POST /live/{stream_id}/product-popup

Day popup san pham den tat ca viewer.

- **Request Body**:
```json
{
  "product_id": "uuid",
  "message": "San pham hot nhat!",
  "display_seconds": 15
}
```

#### POST /live/{stream_id}/flash-sale

Kich hoat flash sale trong live.

- **Request Body**:
```json
{
  "product_id": "uuid",
  "discount_percent": 50,
  "quantity_limit": 50,
  "duration_seconds": 300
}
```

#### PUT /live/{stream_id}/end

Ket thuc live stream. Tao recording URL tu dong.

#### GET /live/{stream_id}/replay

Xem lai ban ghi live stream.

---

### 5.19 Social

#### POST /social/follow/{user_id}

Follow nguoi dung.

- **Auth**: Required
- **Response** (201):
```json
{
  "status": "followed",
  "follower_id": "uuid",
  "following_id": "uuid"
}
```

#### DELETE /social/unfollow/{user_id}

Unfollow.

- **Auth**: Required

#### GET /social/followers/{user_id}

Danh sach nguoi theo doi (paginated).

#### GET /social/following/{user_id}

Danh sach dang theo doi (paginated).

#### GET /social/feed

Feed ca nhan hoa: review tu KOC dang follow + san pham trending.

- **Auth**: Required
- **Response** (200):
```json
{
  "items": [
    {
      "type": "koc_review",
      "id": "uuid",
      "product_name": "Serum Vitamin C",
      "rating": 5,
      "comment": "San pham tuyet voi!",
      "author": {"id": "uuid", "display_name": "Linh"}
    },
    {
      "type": "trending_product",
      "id": "uuid",
      "product_name": "Kem chong nang",
      "price": 299000,
      "rating_avg": 4.8
    }
  ],
  "following_count": 45,
  "followers_count": 1200
}
```

---

### 5.20 Membership

#### GET /membership/plans

Danh sach goi thanh vien.

- **Auth**: Khong
- **Response** (200):
```json
{
  "plans": [
    {"id": "free", "name_vi": "Mien Phi", "price_vnd": 0},
    {"id": "bronze", "name_vi": "Dong", "price_vnd": 299000},
    {"id": "silver", "name_vi": "Bac", "price_vnd": 599000},
    {"id": "gold", "name_vi": "Vang", "price_vnd": 999000},
    {"id": "diamond", "name_vi": "Kim Cuong", "price_vnd": 1999000}
  ],
  "currency": "VND"
}
```

#### POST /membership/subscribe

Dang ky goi thanh vien (30 ngay).

- **Auth**: Required
- **Request Body**:
```json
{
  "plan_id": "gold",
  "payment_method": "vnpay"
}
```

#### GET /membership/current

Goi thanh vien hien tai.

- **Auth**: Required

#### POST /membership/cancel

Huy goi (tra ve Free).

- **Auth**: Required

#### GET /membership/invoices

Lich su thanh toan membership.

- **Auth**: Required

---

### 5.21 WebSocket

#### WS /ws?token=JWT

Ket noi WebSocket real-time.

- **Auth**: JWT token trong query param
- **Client -> Server**:
```json
{"action": "subscribe", "room": "live:session_id"}
{"action": "unsubscribe", "room": "live:session_id"}
{"action": "ping"}
```
- **Server -> Client**:
```json
{"event": "connected", "data": {"user_id": "...", "connections": 4283}}
{"event": "order_update", "data": {"order_id": "...", "status": "delivered"}}
{"event": "commission_paid", "data": {"amount": 840000, "tx_hash": "0x..."}}
{"event": "live_viewer_count", "data": {"session_id": "...", "count": 4283}}
{"event": "groupbuy_progress", "data": {"id": "...", "count": 156, "target": 200}}
{"event": "notification", "data": {"title": "...", "body": "..."}}
```
- **Room types**: `live:{id}`, `groupbuy:{id}`, `koc:{id}`, `admin`

---

## 6. Database Schema

### Bang chinh (PostgreSQL / Supabase)

| Bang | Mo ta | Cot chinh |
|------|-------|----------|
| `profiles` (users) | Thong tin user | id, email, phone, role, display_name, kyc_status, kyc_data, xp, referral_code, wallet_address |
| `koc_profiles` | Data rieng KOC | user_id, handle, tier, total_gmv, total_t1, total_t2, team_size, sponsor_id |
| `vendor_profiles` | Data rieng Vendor | user_id, business_name, business_reg, categories, bank_account, default_discount_pct, rating |
| `wallets` | Vi noi bo | user_id, balance (VND), coins, w3c_tokens, frozen |
| `wallet_transactions` | Lich su giao dich vi | wallet_id, type, amount, currency, ref_id, tx_hash |
| `categories` | Danh muc san pham | slug, name_vi, name_en, icon, sort_order |
| `products` | San pham | vendor_id, category_id, name_vi, price, discount_pct, stock, sold_count, is_dpp, dpp_token_id, rating |
| `orders` | Don hang | buyer_id, koc_ref_id, status, subtotal, total, payment_method, shipping_address, tracking |
| `order_items` | Chi tiet don hang | order_id, product_id, vendor_id, quantity, unit_price, platform_revenue |
| `commissions` | Hoa hong | order_id, koc_id, tier (T1/T2/pool), pct, base_amount, amount, status, tx_hash |
| `reward_pools` | Pool thuong (A/B/C) | pool_type, period, total_amount, distributed |
| `pool_contributions` | Dong gop vao pool | pool_id, order_id, amount |
| `pool_payouts` | Chi tra pool | pool_id, koc_id, rank, pct_share, amount, status |
| `dpp_passports` | Ho chieu san pham so | product_id, token_id, contract_addr, ipfs_uri, manufacturer, certifications, carbon_score |
| `reviews` | Danh gia san pham | product_id, order_id, user_id, rating, body, images, is_verified, helpful_count |
| `affiliate_links` | Link affiliate KOC | koc_id, product_id, short_code, clicks, conversions, revenue |
| `return_requests` | Yeu cau tra hang | order_id, buyer_id, reason, status, vendor_response, refund_amount, refund_method |
| `memberships` | Goi thanh vien | user_id, tier, price_vnd, billing_cycle, started_at, expires_at, is_active, perks |
| `follows` | Quan he follow | follower_id, following_id, created_at |
| `group_buys` | Chien dich mua chung | product_id, creator_id, tiers, current_count, max_participants, status, expires_at |
| `group_buy_participants` | Nguoi tham gia mua chung | group_buy_id, user_id, quantity, tier_at_join |
| `live_streams` | Live stream | host_id, title, stream_key, status, viewer_count, peak_viewers, revenue_vnd |
| `live_flash_sales` | Flash sale trong live | live_stream_id, product_id, discount_percent, flash_price, quantity_limit |
| `live_product_popups` | Popup san pham trong live | live_stream_id, product_id, message, display_seconds |
| `missions` | Nhiem vu gamification | type (daily/weekly), name, target_count, wk_reward, is_active |
| `user_missions` | Tien do nhiem vu user | user_id, mission_id, period, progress, status |

### Enums

| Enum | Gia tri |
|------|--------|
| `user_role` | buyer, koc, vendor, admin, super_admin |
| `order_status` | pending, confirmed, packing, shipping, delivered, completed, cancelled, refunding, refunded |
| `payment_method` | vnpay, momo, payos, usdt, wk_token, cod |
| `commission_status` | pending, queued, settling, settled, failed, clawback |
| `kyc_status` | pending, processing, approved, rejected |
| `pool_type` | A (monthly), B (annual), C (global quarterly) |
| `product_status` | pending, active, paused, rejected |

---

## 7. Smart Contracts

### Deployed tren Polygon (chain_id: 137 mainnet / 80002 Amoy testnet)

### 7.1 WellKOCCommission.sol

**Mo ta**: Phan phoi hoa hong tu dong cho moi don hang.

| Function | Mo ta |
|----------|-------|
| `processOrder(orderId, amount, discountBps, kocT1, kocT2)` | Xu ly don hang va phan phoi hoa hong |
| `updateRates(newRates)` | Cap nhat ty le hoa hong (onlyOwner) |
| `updateWallets(platform, poolA, poolB, poolC)` | Cap nhat dia chi vi (onlyOwner) |
| `pause()` / `unpause()` | Tam dung / tiep tuc (onlyOwner) |
| `emergencyWithdraw(token)` | Rut khan cap (onlyOwner) |
| `getRates()` | Xem ty le hoa hong hien tai |
| `isProcessed(orderId)` | Kiem tra don hang da xu ly chua |

**Events**: `OrderProcessed`, `CommissionPaid`, `RatesUpdated`, `EmergencyWithdraw`

**Commission Rates** (basis points, tong = 10000):
- T1 KOC: 4000 (40%)
- T2 KOC: 1300 (13%)
- Pool A: 900 (9%)
- Pool B: 500 (5%)
- Pool C: 300 (3%)
- Platform: 3000 (30%)

### 7.2 CommissionDistributor.sol (UUPS Upgradeable)

**Mo ta**: Phien ban upgradeable cua commission distributor. Ho tro batch distribution va pool rewards.

| Function | Mo ta |
|----------|-------|
| `initialize(owner, backend, platformTreasury)` | Khoi tao contract |
| `batchDistribute(records[])` | Phan phoi hoa hong hang loat (max 50/batch) |
| `distributePool(tier, recipients[], amounts[])` | Phan phoi pool thuong (max 200 nguoi nhan) |
| `clawback(orderId)` | Thu hoi hoa hong (khi don bi refund) |
| `setBackend(address)` | Cap nhat backend signer (onlyOwner) |
| `setPlatformTreasury(address)` | Cap nhat dia chi treasury (onlyOwner) |

**Events**: `CommissionPaid`, `BatchDistributed`, `PoolDistributed`, `BackendUpdated`

### 7.3 WellKOCDPP.sol (ERC-721)

**Mo ta**: Digital Product Passport NFT. Moi san pham co 1 DPP token duy nhat.

| Function | Mo ta |
|----------|-------|
| `mintDPP(to, productId, vendorId, uri)` | Mint DPP NFT (MINTER_ROLE) |
| `updateURI(tokenId, newURI)` | Cap nhat metadata (ADMIN_ROLE) |
| `deactivateDPP(tokenId, reason)` | Vo hieu hoa DPP (thu hoi san pham) |
| `getProductInfo(tokenId)` | Thong tin san pham tu tokenId |
| `getTokenByProduct(productId)` | Tim tokenId tu productId |
| `isValid(tokenId)` | Kiem tra DPP con hieu luc khong |
| `totalMinted()` | Tong so DPP da mint |

**Events**: `DPPMinted`, `DPPDeactivated`, `DPPUpdated`

### 7.4 DPPFactory.sol (ERC-721 Soulbound)

**Mo ta**: Phien ban soulbound (khong the chuyen nhuong) cua DPP NFT.

| Function | Mo ta |
|----------|-------|
| `mintDPP(productId, vendor, ipfsURI)` | Mint DPP (MINTER_ROLE) |
| `updateDPP(tokenId, newURI)` | Cap nhat metadata (UPDATER_ROLE) |
| `scanVerify(tokenId)` | Log su kien scan QR |
| `getDPPByProduct(productId)` | Tim DPP tu productId |
| `totalMinted()` | Tong so da mint |

**Soulbound**: Block tat ca transfer. Chi cho phep mint.

### 7.5 WKToken.sol (ERC-20 + Governance)

**Mo ta**: WK Token - token gamification va governance cua WellKOC.

| Function | Mo ta |
|----------|-------|
| `mint(to, amount)` | Mint WK token (onlyOwner) |
| `stake(amount)` | Stake WK token (5% APY) |
| `unstake(amount)` | Rut stake + phan thuong |

**Thong so**: MAX_SUPPLY = 1,000,000,000 WK. Initial mint: 100M cho owner.

### 7.6 W3CToken.sol (ERC-20)

**Mo ta**: W3C Token - token utility chinh cua nen tang.

| Function | Mo ta |
|----------|-------|
| `mint(to, amount)` | Mint token (onlyMinter) |
| `addMinter(address)` | Them minter (onlyOwner) |
| `removeMinter(address)` | Xoa minter (onlyOwner) |
| `burn(amount)` | Dot token |

**Tokenomics** (Total: 10B W3C):
- Platform treasury: 30% (3B) - mint ban dau
- KOC rewards: 40% (4B)
- Ecosystem fund: 20% (2B)
- Team (3yr vest): 10% (1B)

### 7.7 ReputationNFT.sol (ERC-721 Soulbound)

**Mo ta**: Reputation NFT cho KOC - theo doi lich su on-chain.

| Function | Mo ta |
|----------|-------|
| `mintReputation(koc, uri, handle)` | Mint reputation NFT cho KOC |
| `updateReputation(tokenId, gmvDelta, ordersDelta, newTier, newUri)` | Cap nhat du lieu reputation |

**Data luu tru**: totalGMV, totalOrders, tier, joinedAt, handle

### 7.8 CreatorTokenFactory.sol

**Mo ta**: Moi KOC co the deploy fan token ERC-20 rieng.

| Function | Mo ta |
|----------|-------|
| `deployCreatorToken(name, symbol, priceWei)` | Deploy fan token cho KOC |
| `buy(amount)` | Mua fan token (90% cho KOC, 10% platform) |

---

## 8. Environment Variables

### App Core

| Bien | Mo ta | Mac dinh |
|------|-------|---------|
| `APP_NAME` | Ten ung dung | WellKOC |
| `APP_ENV` | Moi truong (development/staging/production) | development |
| `SECRET_KEY` | JWT secret (min 32 ky tu) | (bat buoc) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Thoi gian het han access token | 60 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Thoi gian het han refresh token | 7 |

### Database

| Bien | Mo ta | Mac dinh |
|------|-------|---------|
| `DATABASE_URL` | PostgreSQL connection string (asyncpg) | postgresql+asyncpg://wellkoc:wellkoc_dev@localhost:5432/wellkoc |
| `DB_POOL_SIZE` | Kich thuoc connection pool | 20 |
| `DB_MAX_OVERFLOW` | Max overflow connections | 10 |

### Redis

| Bien | Mo ta | Mac dinh |
|------|-------|---------|
| `REDIS_URL` | Redis connection string | redis://localhost:6379/0 |
| `REDIS_CACHE_TTL` | TTL cache (giay) | 300 |

### Blockchain (Polygon)

| Bien | Mo ta | Mac dinh |
|------|-------|---------|
| `POLYGON_RPC_URL` | Polygon mainnet RPC | https://polygon-rpc.com |
| `POLYGON_TESTNET_RPC` | Polygon Amoy testnet RPC | https://rpc-amoy.polygon.technology |
| `WALLET_PRIVATE_KEY` | Private key deployer wallet | (bat buoc) |
| `COMMISSION_CONTRACT_ADDRESS` | Dia chi contract CommissionDistributor | |
| `DPP_FACTORY_ADDRESS` | Dia chi contract DPP Factory | |
| `WK_TOKEN_ADDRESS` | Dia chi contract WK Token | |
| `CHAIN_ID` | Chain ID (137=mainnet, 80002=Amoy) | 137 |

### Payments

| Bien | Mo ta |
|------|-------|
| `VNPAY_TMN_CODE` | VNPay Terminal Code |
| `VNPAY_HASH_SECRET` | VNPay HMAC secret |
| `VNPAY_URL` | VNPay gateway URL |
| `MOMO_PARTNER_CODE` | MoMo partner code |
| `MOMO_ACCESS_KEY` | MoMo access key |
| `MOMO_SECRET_KEY` | MoMo HMAC secret |
| `MOMO_ENDPOINT` | MoMo API endpoint |
| `PAYOS_CLIENT_ID` | PayOS client ID |
| `PAYOS_API_KEY` | PayOS API key |
| `PAYOS_CHECKSUM_KEY` | PayOS HMAC checksum key |
| `STRIPE_SECRET_KEY` | Stripe secret (membership billing) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |

### AI / Anthropic

| Bien | Mo ta | Mac dinh |
|------|-------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key | |
| `ANTHROPIC_MODEL` | Model su dung | claude-sonnet-4-6 |
| `AI_RATE_LIMIT_PER_MIN` | Rate limit API AI | 60 |

### Storage

| Bien | Mo ta |
|------|-------|
| `AWS_ACCESS_KEY_ID` | AWS S3 access key |
| `AWS_SECRET_ACCESS_KEY` | AWS S3 secret |
| `AWS_S3_BUCKET` | S3 bucket name |
| `AWS_REGION` | AWS region |
| `CDN_BASE_URL` | CDN base URL |
| `PINATA_API_KEY` | Pinata IPFS API key |
| `PINATA_SECRET` | Pinata secret |

### Notifications

| Bien | Mo ta |
|------|-------|
| `TWILIO_ACCOUNT_SID` | Twilio SID (OTP SMS) |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE` | Twilio phone number |
| `FCM_SERVER_KEY` | Firebase Cloud Messaging key |

### Shipping

| Bien | Mo ta |
|------|-------|
| `GHN_TOKEN` | GHN API token |
| `GHN_SHOP_ID` | GHN shop ID |
| `GHTK_TOKEN` | GHTK API token |

### Commission Rates

| Bien | Mo ta | Mac dinh |
|------|-------|---------|
| `COMMISSION_T1_RATE` | Ty le T1 KOC | 0.40 (40%) |
| `COMMISSION_T2_RATE` | Ty le T2 KOC | 0.13 (13%) |
| `COMMISSION_POOL_A` | Ty le Pool A (monthly) | 0.09 (9%) |
| `COMMISSION_POOL_B` | Ty le Pool B (annual) | 0.05 (5%) |
| `COMMISSION_POOL_C` | Ty le Pool C (global quarterly) | 0.03 (3%) |
| `COMMISSION_PLATFORM` | Ty le Platform | 0.30 (30%) |

### Monitoring

| Bien | Mo ta |
|------|-------|
| `SENTRY_DSN` | Sentry DSN (error tracking) |

---

## 9. Deployment

### 9.1 Production Stack (Khuyen nghi)

```
                    +--------------------+
                    |   Cloudflare CDN   |
                    |   + DDoS Protection|
                    +----------+---------+
                               |
                    +----------+---------+
                    |   Nginx (Reverse   |
                    |   Proxy + SSL)     |
                    +----+----------+----+
                         |          |
              +----------+--+  +---+----------+
              | Backend     |  | Frontend     |
              | (Docker)    |  | (Static/Vercel)|
              | Gunicorn    |  |              |
              | + Uvicorn   |  |              |
              +------+------+  +--------------+
                     |
         +-----------+-----------+
         |           |           |
    +----+----+ +----+----+ +---+-----+
    |PostgreSQL| |  Redis  | |Celery   |
    |Supabase  | | Cluster | |Workers  |
    +----------+ +---------+ +---------+
```

### 9.2 Docker Deployment

```bash
# Build va chay voi Docker Compose
docker-compose up -d

# Services:
# - backend: FastAPI + Uvicorn
# - frontend: Nginx serving static files
# - postgres: PostgreSQL 15
# - redis: Redis 7
# - celery-worker: Celery worker
# - celery-beat: Celery beat scheduler
```

### 9.3 Frontend Deployment (Vercel)

```bash
cd frontend
npm run build
# Deploy dist/ len Vercel/Netlify/Cloudflare Pages
```

### 9.4 Backend Deployment

```bash
# Production server
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Voi SSL
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --certfile cert.pem --keyfile key.pem
```

### 9.5 Smart Contract Deployment

```bash
# Mainnet (Polygon)
npx hardhat run scripts/deploy.js --network polygon

# Verify contracts
npx hardhat verify --network polygon <ADDRESS> <CONSTRUCTOR_ARGS>
```

### 9.6 Monitoring Checklist

- [ ] Sentry configured cho backend errors
- [ ] Prometheus metrics endpoint `/metrics`
- [ ] Redis health check
- [ ] PostgreSQL connection pool monitoring
- [ ] Celery worker status
- [ ] Polygon RPC health check
- [ ] Payment webhook delivery monitoring
- [ ] WebSocket connection count tracking

---

## Frontend Routes

| Path | Component | Mo ta |
|------|-----------|-------|
| `/` | Home | Trang chu |
| `/login` | Login | Dang nhap |
| `/register` | Register | Dang ky |
| `/marketplace` | Marketplace | Cho san pham |
| `/products/:id` | ProductDetail | Chi tiet san pham |
| `/cart` | Cart | Gio hang |
| `/checkout` | Checkout | Thanh toan |
| `/promo` | Promo | Khuyen mai |
| `/live` | Live | Live commerce |
| `/feed` | Feed | Social feed |
| `/hot` | Hot | San pham hot |
| `/dashboard` | Dashboard | Dashboard user |
| `/academy` | Academy | Hoc vien |
| `/dpp` | DPP | Digital Product Passport |
| `/agents` | Agents | 111 AI Agents |
| `/gamification` | Gamification | XP / Nhiem vu / Thanh tich |
| `/koc` | KOC | KOC dashboard |
| `/vendor` | Vendor | Vendor dashboard |
| `/admin` | Admin | Admin panel |
| `/pricing` | Pricing | Bang gia membership |

---

> Tai lieu nay duoc tao tu ma nguon thuc te cua WellKOC Phase 1 MVP.
> Moi thac mac lien he team backend hoac tao issue tren repository.
