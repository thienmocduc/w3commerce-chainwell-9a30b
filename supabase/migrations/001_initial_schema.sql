-- ============================================================
-- W3Commerce — Initial Database Schema
-- 11 Tables + pgvector + RLS Policies
-- Run: npx supabase db push
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Enum Types ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'vendor', 'koc', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE product_status AS ENUM ('draft', 'active', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE commission_status AS ENUM ('pending', 'confirmed', 'paid', 'clawed_back');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rule_type AS ENUM ('flat', 'tiered', 'recurring', 'lifetime', 'split');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE nft_type AS ENUM ('dpp', 'koc_badge', 'creator_token');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE stream_status AS ENUM ('scheduled', 'live', 'ended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Table 1: users ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       text UNIQUE NOT NULL,
  wallet_address text UNIQUE,
  role        user_role NOT NULL DEFAULT 'user',
  xp_points   integer NOT NULL DEFAULT 0,
  level       integer NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ─── Table 2: products ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text NOT NULL DEFAULT '',
  price             numeric(12,2) NOT NULL CHECK (price >= 0),
  stock             integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  dpp_hash          text,
  blockchain_tx_hash text,
  embedding         vector(1536),
  metadata          jsonb DEFAULT '{}',
  status            product_status NOT NULL DEFAULT 'draft',
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- ─── Table 3: orders ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_amount      numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  payment_status    payment_status NOT NULL DEFAULT 'pending',
  blockchain_tx_hash text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(payment_status);

-- ─── Table 4: order_items ──────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity          integer NOT NULL CHECK (quantity > 0),
  unit_price        numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  commission_earned numeric(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ─── Table 5: affiliate_rules ──────────────────────────────
CREATE TABLE IF NOT EXISTS affiliate_rules (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id       uuid REFERENCES products(id) ON DELETE SET NULL,
  rule_type        rule_type NOT NULL,
  commission_rate  numeric(5,2) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
  threshold_amount numeric(12,2),
  bonus_amount     numeric(12,2),
  is_active        boolean NOT NULL DEFAULT true,
  config           jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_affiliate_rules_vendor ON affiliate_rules(vendor_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_rules_product ON affiliate_rules(product_id) WHERE product_id IS NOT NULL;

-- ─── Table 6: commissions ──────────────────────────────────
CREATE TABLE IF NOT EXISTS commissions (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  koc_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id          uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rule_id           uuid NOT NULL REFERENCES affiliate_rules(id) ON DELETE CASCADE,
  amount            numeric(12,2) NOT NULL CHECK (amount >= 0),
  status            commission_status NOT NULL DEFAULT 'pending',
  blockchain_tx_hash text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_koc ON commissions(koc_id);
CREATE INDEX IF NOT EXISTS idx_commissions_order ON commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);

-- ─── Table 7: user_nfts ────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_nfts (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_id         text NOT NULL,
  contract_address text NOT NULL,
  nft_type         nft_type NOT NULL,
  metadata         jsonb DEFAULT '{}',
  minted_at        timestamptz NOT NULL DEFAULT now(),
  chain_id         integer NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_nfts_user ON user_nfts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_nfts_type ON user_nfts(nft_type);

-- ─── Table 8: courses ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title                   text NOT NULL,
  description             text NOT NULL DEFAULT '',
  instructor_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price                   numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  nft_certificate_required boolean NOT NULL DEFAULT false,
  content                 jsonb DEFAULT '{}',
  published               boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses(instructor_id);

-- ─── Table 9: course_enrollments ───────────────────────────
CREATE TABLE IF NOT EXISTS course_enrollments (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id         uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  progress          integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  completed         boolean NOT NULL DEFAULT false,
  certificate_nft_id text,
  enrolled_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user ON course_enrollments(user_id);

-- ─── Table 10: competitor_data ─────────────────────────────
CREATE TABLE IF NOT EXISTS competitor_data (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform     text NOT NULL,
  product_name text NOT NULL,
  price        numeric(12,2) NOT NULL,
  sales_count  integer NOT NULL DEFAULT 0,
  battlecard   jsonb DEFAULT '{}',
  scraped_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitor_vendor ON competitor_data(vendor_id);

-- ─── Table 11: livestreams ─────────────────────────────────
CREATE TABLE IF NOT EXISTS livestreams (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aws_channel_arn text,
  stream_key      text,
  status          stream_status NOT NULL DEFAULT 'scheduled',
  viewer_count    integer NOT NULL DEFAULT 0,
  total_tips      numeric(12,2) NOT NULL DEFAULT 0,
  started_at      timestamptz,
  ended_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_livestreams_host ON livestreams(host_id);
CREATE INDEX IF NOT EXISTS idx_livestreams_status ON livestreams(status);

-- ─── Auxiliary tables ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_nonces (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nonce      text NOT NULL UNIQUE,
  wallet     text,
  used       boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id   uuid NOT NULL REFERENCES users(id),
  action     text NOT NULL,
  target_id  uuid,
  details    jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── pgvector index (IVFFlat for cosine similarity) ────────
-- Note: requires at least some rows before this works effectively
-- CREATE INDEX IF NOT EXISTS products_embedding_idx
--   ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- Use HNSW instead for small datasets:
CREATE INDEX IF NOT EXISTS products_embedding_hnsw_idx
  ON products USING hnsw (embedding vector_cosine_ops);

-- ─── Updated_at trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── pgvector match function for RAG ───────────────────────
CREATE OR REPLACE FUNCTION match_products(
  query_embedding vector(1536),
  match_count int DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  price numeric,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.description,
    p.price,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM products p
  WHERE p.status = 'active' AND p.embedding IS NOT NULL
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_nfts ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE livestreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- ── Users RLS ──────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "users_admin_all" ON users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Public read for basic user info (profiles)
CREATE POLICY IF NOT EXISTS "users_public_read" ON users
  FOR SELECT USING (true);

-- ── Products RLS ───────────────────────────────────────────
-- Anyone can view active products
CREATE POLICY IF NOT EXISTS "products_public_read" ON products
  FOR SELECT USING (status = 'active');

-- Vendors manage own products
CREATE POLICY IF NOT EXISTS "products_vendor_all" ON products
  FOR ALL USING (auth.uid() = vendor_id);

-- Admin full access
CREATE POLICY IF NOT EXISTS "products_admin_all" ON products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ── Orders RLS ─────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "orders_buyer_select" ON orders
  FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY IF NOT EXISTS "orders_buyer_insert" ON orders
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY IF NOT EXISTS "orders_admin_all" ON orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ── Order Items RLS ────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "order_items_buyer_select" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.buyer_id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "order_items_admin_all" ON order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ── Affiliate Rules RLS ────────────────────────────────────
CREATE POLICY IF NOT EXISTS "affiliate_rules_public_read" ON affiliate_rules
  FOR SELECT USING (is_active = true);

CREATE POLICY IF NOT EXISTS "affiliate_rules_vendor_all" ON affiliate_rules
  FOR ALL USING (auth.uid() = vendor_id);

CREATE POLICY IF NOT EXISTS "affiliate_rules_admin_all" ON affiliate_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ── Commissions RLS ────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "commissions_koc_select" ON commissions
  FOR SELECT USING (auth.uid() = koc_id);

CREATE POLICY IF NOT EXISTS "commissions_admin_all" ON commissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ── User NFTs RLS ──────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "user_nfts_owner_select" ON user_nfts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "user_nfts_admin_all" ON user_nfts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ── Courses RLS ────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "courses_public_read" ON courses
  FOR SELECT USING (published = true);

CREATE POLICY IF NOT EXISTS "courses_instructor_all" ON courses
  FOR ALL USING (auth.uid() = instructor_id);

CREATE POLICY IF NOT EXISTS "courses_admin_all" ON courses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ── Course Enrollments RLS ─────────────────────────────────
CREATE POLICY IF NOT EXISTS "enrollments_user_select" ON course_enrollments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "enrollments_user_insert" ON course_enrollments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "enrollments_user_update" ON course_enrollments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "enrollments_admin_all" ON course_enrollments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ── Competitor Data RLS ────────────────────────────────────
CREATE POLICY IF NOT EXISTS "competitor_data_vendor_select" ON competitor_data
  FOR SELECT USING (auth.uid() = vendor_id);

CREATE POLICY IF NOT EXISTS "competitor_data_admin_all" ON competitor_data
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ── Livestreams RLS ────────────────────────────────────────
-- Anyone can view active streams
CREATE POLICY IF NOT EXISTS "livestreams_public_read" ON livestreams
  FOR SELECT USING (status IN ('scheduled', 'live'));

CREATE POLICY IF NOT EXISTS "livestreams_host_all" ON livestreams
  FOR ALL USING (auth.uid() = host_id);

CREATE POLICY IF NOT EXISTS "livestreams_admin_all" ON livestreams
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ── Session Nonces RLS (service role only) ─────────────────
CREATE POLICY IF NOT EXISTS "nonces_service_only" ON session_nonces
  FOR ALL USING (false);

-- ── Admin Actions RLS ──────────────────────────────────────
CREATE POLICY IF NOT EXISTS "admin_actions_admin_all" ON admin_actions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
