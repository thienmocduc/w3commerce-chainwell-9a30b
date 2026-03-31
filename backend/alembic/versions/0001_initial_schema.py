"""Initial schema — all WellKOC tables

Revision ID: 0001
Revises: None
Create Date: 2026-03-31 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# ── Revision metadata ──────────────────────────────────────────────────────
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


# ══════════════════════════════════════════════════════════════════════════════
# UPGRADE — create all tables in dependency order
# ══════════════════════════════════════════════════════════════════════════════

def upgrade() -> None:
    # ------------------------------------------------------------------
    # 0. Extensions required by the schema
    # ------------------------------------------------------------------
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    # vector extension for pgvector (product embeddings)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ------------------------------------------------------------------
    # 1. users
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        # Identity
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("wallet_address", sa.String(42), nullable=True),
        # Auth
        sa.Column("hashed_password", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("phone_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("phone_verified_at", sa.DateTime(), nullable=True),
        # Bank verification
        sa.Column("bank_name", sa.String(100), nullable=True),
        sa.Column("bank_account_number", sa.String(30), nullable=True),
        sa.Column("bank_account_holder", sa.String(200), nullable=True),
        sa.Column("bank_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("bank_verified_at", sa.DateTime(), nullable=True),
        # Identity verification
        sa.Column("identity_number", sa.String(20), nullable=True),
        sa.Column("identity_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("identity_verified_at", sa.DateTime(), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("verification_level", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_suspended", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("suspended_reason", sa.String(500), nullable=True),
        # Profile
        sa.Column("role", sa.String(20), nullable=False, server_default="buyer"),
        sa.Column("full_name", sa.String(200), nullable=True),
        sa.Column("display_name", sa.String(100), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("language", sa.String(5), nullable=False, server_default="vi"),
        # KYC
        sa.Column("kyc_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("kyc_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("kyc_reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("kyc_reviewer_id", postgresql.UUID(as_uuid=True), nullable=True),
        # Referral / Commission
        sa.Column("referral_code", sa.String(20), nullable=False, server_default=""),
        sa.Column(
            "referred_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("total_commission_earned", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        # On-chain
        sa.Column("reputation_nft_token_id", sa.Integer(), nullable=True),
        sa.Column("reputation_score", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("wk_token_balance", sa.Numeric(18, 8), nullable=False, server_default=sa.text("0")),
        # Membership
        sa.Column("membership_tier", sa.String(20), nullable=False, server_default="free"),
        sa.Column("membership_expires_at", sa.DateTime(), nullable=True),
        sa.Column("stripe_customer_id", sa.String(100), nullable=True),
        # Metadata
        sa.Column("last_login_at", sa.DateTime(), nullable=True),
        sa.Column("last_login_ip", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_users_email", "users", ["email"])
    op.create_unique_constraint("uq_users_phone", "users", ["phone"])
    op.create_unique_constraint("uq_users_wallet", "users", ["wallet_address"])
    op.create_unique_constraint("uq_users_bank_account", "users", ["bank_account_number"])
    op.create_unique_constraint("uq_users_identity", "users", ["identity_number"])
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_referral_code", "users", ["referral_code"])
    op.create_index("ix_users_verification_level", "users", ["verification_level"])
    op.create_index(sa.text("ix_users_id"), "users", ["id"])

    # ------------------------------------------------------------------
    # 2. koc_profiles
    # ------------------------------------------------------------------
    op.create_table(
        "koc_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("niche", sa.String(100), nullable=True),
        sa.Column("platforms", postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default=sa.text("'[]'::jsonb")),
        sa.Column("social_links", postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default=sa.text("'{}'::jsonb")),
        sa.Column("follower_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("avg_cvr", sa.Numeric(5, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("preferred_categories", postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # 3. vendor_profiles
    # ------------------------------------------------------------------
    op.create_table(
        "vendor_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("company_name", sa.String(300), nullable=True),
        sa.Column("tax_code", sa.String(20), nullable=True),
        sa.Column("business_license", sa.Text(), nullable=True),
        sa.Column("categories", postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default=sa.text("'[]'::jsonb")),
        sa.Column("shipping_from", sa.String(200), nullable=True),
        sa.Column("is_dpp_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("membership_tier", sa.String(20), nullable=False, server_default="starter"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # 4. products
    # ------------------------------------------------------------------
    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "vendor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        # Basic Info
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("name_en", sa.String(500), nullable=True),
        sa.Column("name_zh", sa.String(500), nullable=True),
        sa.Column("name_hi", sa.String(500), nullable=True),
        sa.Column("name_th", sa.String(500), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("description_en", sa.Text(), nullable=True),
        # Classification
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("subcategory", sa.String(100), nullable=True),
        sa.Column("brand", sa.String(200), nullable=True),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default=sa.text("'[]'::jsonb")),
        # Pricing
        sa.Column("price", sa.Numeric(18, 2), nullable=False),
        sa.Column("compare_at_price", sa.Numeric(18, 2), nullable=True),
        sa.Column("cost_price", sa.Numeric(18, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="VND"),
        # Inventory
        sa.Column("stock_quantity", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("reserved_quantity", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("reorder_point", sa.Integer(), nullable=False, server_default=sa.text("50")),
        sa.Column("sku", sa.String(100), nullable=True, unique=True),
        # Media
        sa.Column("images", postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default=sa.text("'[]'::jsonb")),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        # Physical
        sa.Column("weight_grams", sa.Integer(), nullable=True),
        sa.Column("dimensions_cm", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        # DPP / Blockchain
        sa.Column("dpp_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("dpp_nft_token_id", sa.Integer(), nullable=True),
        sa.Column("dpp_ipfs_uri", sa.Text(), nullable=True),
        sa.Column("dpp_tx_hash", sa.String(66), nullable=True),
        sa.Column("certifications", postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default=sa.text("'[]'::jsonb")),
        sa.Column("manufacturer", sa.String(500), nullable=True),
        sa.Column("origin_country", sa.String(100), nullable=True),
        sa.Column("lot_number", sa.String(100), nullable=True),
        sa.Column("manufacture_date", sa.DateTime(), nullable=True),
        sa.Column("expiry_date", sa.DateTime(), nullable=True),
        # Analytics
        sa.Column("view_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("order_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("rating_avg", sa.Numeric(3, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("rating_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        # AI / Search — vector(384) stored as native pgvector type
        sa.Column("embedding", postgresql.ARRAY(sa.Float()), nullable=True),
        # Status
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        # Metadata
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_products_vendor_id", "products", ["vendor_id"])
    op.create_index("ix_products_status", "products", ["status"])
    op.create_index("ix_products_category", "products", ["category"])
    op.create_index("ix_products_dpp_verified", "products", ["dpp_verified"])
    op.create_index(
        "ix_products_name_trgm",
        "products",
        ["name"],
        postgresql_using="gin",
        postgresql_ops={"name": "gin_trgm_ops"},
    )

    # ------------------------------------------------------------------
    # 5. product_variants
    # ------------------------------------------------------------------
    op.create_table(
        "product_variants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("sku", sa.String(100), nullable=True, unique=True),
        sa.Column("price", sa.Numeric(18, 2), nullable=True),
        sa.Column("stock_quantity", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("attributes", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # 6. dpp_records
    # ------------------------------------------------------------------
    op.create_table(
        "dpp_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("token_id", sa.Integer(), nullable=True),
        sa.Column("ipfs_uri", sa.Text(), nullable=True),
        sa.Column("tx_hash", sa.String(66), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("scan_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("minted_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # 7. orders
    # ------------------------------------------------------------------
    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_number", sa.String(30), nullable=False, unique=True),
        # Parties
        sa.Column(
            "buyer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "vendor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("koc_t1_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("koc_t2_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("affiliate_link_id", postgresql.UUID(as_uuid=True), nullable=True),
        # Items snapshot
        sa.Column("items", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        # Pricing
        sa.Column("subtotal", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("shipping_fee", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("discount_amount", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("voucher_code", sa.String(50), nullable=True),
        sa.Column("total", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("currency", sa.String(3), nullable=False, server_default="VND"),
        # Payment
        sa.Column("payment_method", sa.String(20), nullable=True),
        sa.Column("payment_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("payment_tx_id", sa.String(200), nullable=True),
        sa.Column("payment_paid_at", sa.DateTime(), nullable=True),
        # Shipping
        sa.Column("shipping_address", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("shipping_carrier", sa.String(50), nullable=True),
        sa.Column("tracking_number", sa.String(100), nullable=True),
        sa.Column("shipped_at", sa.DateTime(), nullable=True),
        sa.Column("delivered_at", sa.DateTime(), nullable=True),
        # State
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("status_history", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("idempotency_key", sa.String(100), nullable=True, unique=True),
        # Commission flags
        sa.Column("commission_calculated", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("commission_settled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        # Review
        sa.Column("review_unlocked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        # Metadata
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_orders_buyer_id", "orders", ["buyer_id"])
    op.create_index("ix_orders_vendor_id", "orders", ["vendor_id"])
    op.create_index("ix_orders_status", "orders", ["status"])
    op.create_index("ix_orders_created_at", "orders", ["created_at"])

    # ------------------------------------------------------------------
    # 8. commissions
    # ------------------------------------------------------------------
    op.create_table(
        "commissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "koc_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("commission_type", sa.String(20), nullable=False),
        sa.Column("rate", sa.Numeric(5, 4), nullable=False),
        sa.Column("base_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="VND"),
        sa.Column("period_week", sa.String(10), nullable=True),
        sa.Column("pool_rank", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("tx_hash", sa.String(66), nullable=True),
        sa.Column("block_number", sa.Integer(), nullable=True),
        sa.Column("settled_at", sa.DateTime(), nullable=True),
        sa.Column("gas_used", sa.Integer(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("error_msg", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_commissions_koc_id", "commissions", ["koc_id"])
    op.create_index("ix_commissions_order_id", "commissions", ["order_id"])
    op.create_index("ix_commissions_status", "commissions", ["status"])
    op.create_index("ix_commissions_period", "commissions", ["period_week"])

    # ------------------------------------------------------------------
    # 9. return_requests
    # ------------------------------------------------------------------
    op.create_table(
        "return_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "buyer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("reason", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("photo_urls", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("vendor_response", sa.Text(), nullable=True),
        sa.Column("refund_amount", sa.Float(), nullable=True),
        sa.Column("refund_method", sa.String(30), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_return_requests_order_id", "return_requests", ["order_id"])
    op.create_index("ix_return_requests_buyer_id", "return_requests", ["buyer_id"])
    op.create_index("ix_return_requests_status", "return_requests", ["status"])

    # ------------------------------------------------------------------
    # 10. reviews
    # ------------------------------------------------------------------
    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("images", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("media_urls", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        # On-chain integrity
        sa.Column("content_hash", sa.String(66), nullable=True),
        sa.Column("tx_hash", sa.String(66), nullable=True),
        sa.Column("block_number", sa.Integer(), nullable=True),
        # Moderation
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("flagged_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("flagged_reason", sa.Text(), nullable=True),
        sa.Column("flagged_at", sa.DateTime(), nullable=True),
        sa.Column("removed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("removed_reason", sa.Text(), nullable=True),
        sa.Column("removed_at", sa.DateTime(), nullable=True),
        # Engagement
        sa.Column("helpful_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True, server_default=sa.func.now()),
    )
    op.create_index("ix_reviews_product_id", "reviews", ["product_id"])
    op.create_index("ix_reviews_user_id", "reviews", ["user_id"])
    op.create_index("ix_reviews_order_id", "reviews", ["order_id"])
    op.create_index("ix_reviews_status", "reviews", ["status"])
    op.create_index("ix_reviews_created_at", "reviews", ["created_at"])

    # ------------------------------------------------------------------
    # 11. memberships
    # ------------------------------------------------------------------
    op.create_table(
        "memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tier", sa.String(20), nullable=False),
        sa.Column("price_vnd", sa.Numeric(18, 2), nullable=False),
        sa.Column("billing_cycle", sa.String(20), nullable=False, server_default="monthly"),
        sa.Column("started_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("perks", postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # 12. follows
    # ------------------------------------------------------------------
    op.create_table(
        "follows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "follower_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "following_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_follows_pair", "follows", ["follower_id", "following_id"])
    op.create_index("ix_follows_follower_id", "follows", ["follower_id"])
    op.create_index("ix_follows_following_id", "follows", ["following_id"])

    # ------------------------------------------------------------------
    # 13. Gamification — user_wk (was UserXP in init, renamed UserWK)
    # ------------------------------------------------------------------
    op.create_table(
        "user_wk",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("total_wk", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("current_tier", sa.String(20), nullable=False, server_default="bronze"),
        sa.Column("season_wk", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("weekly_wk", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("current_streak", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("longest_streak", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("last_checkin_date", sa.Date(), nullable=True),
        sa.Column("wk_multiplier", sa.Numeric(3, 2), nullable=False, server_default=sa.text("1.0")),
        sa.Column("multiplier_expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_user_xp_user_id", "user_wk", ["user_id"])
    op.create_index("ix_user_xp_total", "user_wk", ["total_wk"])

    # ------------------------------------------------------------------
    # 14. wk_transactions (XP transaction log)
    # ------------------------------------------------------------------
    op.create_table(
        "wk_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("wk_earned", sa.Integer(), nullable=False),
        sa.Column("multiplier_applied", sa.Numeric(3, 2), nullable=False, server_default=sa.text("1.0")),
        sa.Column("total_after", sa.Integer(), nullable=False),
        sa.Column("reference_id", sa.String(100), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_xp_tx_user", "wk_transactions", ["user_id"])
    op.create_index("ix_xp_tx_event", "wk_transactions", ["event_type"])
    op.create_index("ix_xp_tx_created", "wk_transactions", ["created_at"])

    # ------------------------------------------------------------------
    # 15. achievements
    # ------------------------------------------------------------------
    op.create_table(
        "achievements",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("name_en", sa.String(200), nullable=False),
        sa.Column("name_zh", sa.String(200), nullable=True),
        sa.Column("name_hi", sa.String(200), nullable=True),
        sa.Column("name_th", sa.String(200), nullable=True),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("icon", sa.String(10), nullable=False),
        sa.Column("wk_reward", sa.Numeric(18, 8), nullable=False, server_default=sa.text("0")),
        sa.Column("is_nft_badge", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("nft_token_id", sa.Integer(), nullable=True),
        sa.Column("is_rare", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_limited", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("condition", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # 16. user_achievements
    # ------------------------------------------------------------------
    op.create_table(
        "user_achievements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "achievement_id",
            sa.String(50),
            sa.ForeignKey("achievements.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("earned_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("nft_tx_hash", sa.String(66), nullable=True),
        sa.Column("nft_token_id", sa.Integer(), nullable=True),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_unique_constraint("uq_user_achievement", "user_achievements", ["user_id", "achievement_id"])
    op.create_index("ix_user_achievements_user", "user_achievements", ["user_id"])
    op.create_index("ix_user_achievements_earned", "user_achievements", ["earned_at"])

    # ------------------------------------------------------------------
    # 17. missions
    # ------------------------------------------------------------------
    op.create_table(
        "missions",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("name_en", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("icon", sa.String(10), nullable=False),
        sa.Column("target_event", sa.String(50), nullable=False),
        sa.Column("target_count", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("wk_reward", sa.Numeric(18, 8), nullable=False, server_default=sa.text("0")),
        sa.Column("achievement_id", sa.String(50), nullable=True),
        sa.Column("roles", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("min_tier", sa.String(20), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )

    # ------------------------------------------------------------------
    # 18. user_missions
    # ------------------------------------------------------------------
    op.create_table(
        "user_missions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "mission_id",
            sa.String(50),
            sa.ForeignKey("missions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("period", sa.String(20), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("claimed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_user_mission_period", "user_missions", ["user_id", "mission_id", "period"])
    op.create_index("ix_user_missions_user", "user_missions", ["user_id"])
    op.create_index("ix_user_missions_status", "user_missions", ["status"])

    # ------------------------------------------------------------------
    # 19. leaderboard_entries
    # ------------------------------------------------------------------
    op.create_table(
        "leaderboard_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("board_type", sa.String(30), nullable=False),
        sa.Column("period", sa.String(10), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("score", sa.Numeric(20, 4), nullable=False),
        sa.Column("pool_tier", sa.String(10), nullable=True),
        sa.Column("wk_earned", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("commission_pool_amount", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("snapshot_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_leaderboard_entry", "leaderboard_entries", ["user_id", "period", "board_type"])
    op.create_index("ix_leaderboard_period_type", "leaderboard_entries", ["period", "board_type"])
    op.create_index("ix_leaderboard_rank", "leaderboard_entries", ["rank"])

    # ------------------------------------------------------------------
    # 20. daily_checkins
    # ------------------------------------------------------------------
    op.create_table(
        "daily_checkins",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("checkin_date", sa.Date(), nullable=False),
        sa.Column("streak_day", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("wk_earned", sa.Numeric(18, 8), nullable=False, server_default=sa.text("0")),
        sa.Column("bonus_reason", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_checkin_user_date", "daily_checkins", ["user_id", "checkin_date"])
    op.create_index("ix_checkins_user", "daily_checkins", ["user_id"])

    # ------------------------------------------------------------------
    # 21. koc_battles
    # ------------------------------------------------------------------
    op.create_table(
        "koc_battles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column(
            "challenger_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "opponent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("metric", sa.String(30), nullable=False),
        sa.Column("product_category", sa.String(100), nullable=True),
        sa.Column("start_at", sa.DateTime(), nullable=False),
        sa.Column("end_at", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("challenger_score", sa.Numeric(20, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("opponent_score", sa.Numeric(20, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("winner_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("winner_xp_reward", sa.Integer(), nullable=False, server_default=sa.text("500")),
        sa.Column("loser_xp_reward", sa.Integer(), nullable=False, server_default=sa.text("100")),
        sa.Column("prize_wk", sa.Numeric(18, 8), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # 22. pool_rankings
    # ------------------------------------------------------------------
    op.create_table(
        "pool_rankings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "koc_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("week", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("pool", sa.String(1), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("score", sa.Numeric(20, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("orders_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("gmv", sa.Numeric(20, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("cvr", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("dpp_sales", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("commission_amount", sa.Numeric(20, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("tx_hash", sa.String(66), nullable=True),
        sa.Column("distributed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_pool_ranking_koc_week_year", "pool_rankings", ["koc_id", "week", "year"])
    op.create_index("ix_pool_ranking_week_year", "pool_rankings", ["week", "year"])
    op.create_index("ix_pool_ranking_pool", "pool_rankings", ["pool"])
    op.create_index("ix_pool_ranking_rank", "pool_rankings", ["rank"])
    op.create_index("ix_pool_ranking_koc", "pool_rankings", ["koc_id"])

    # ------------------------------------------------------------------
    # 23. pool_configs
    # ------------------------------------------------------------------
    op.create_table(
        "pool_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("pool", sa.String(1), nullable=False),
        sa.Column("percentage", sa.Integer(), nullable=False),
        sa.Column("min_rank", sa.Integer(), nullable=False),
        sa.Column("max_rank", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_pool_config_pool", "pool_configs", ["pool"])

    # ------------------------------------------------------------------
    # 24. pool_distributions
    # ------------------------------------------------------------------
    op.create_table(
        "pool_distributions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("week", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("pool", sa.String(1), nullable=False),
        sa.Column("total_amount", sa.Numeric(20, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("recipients_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("tx_hash", sa.String(66), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("distributed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_pool_dist_week_year", "pool_distributions", ["week", "year"])

    # ------------------------------------------------------------------
    # 25. flash_sales
    # ------------------------------------------------------------------
    op.create_table(
        "flash_sales",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "vendor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("original_price", sa.Numeric(20, 2), nullable=False),
        sa.Column("flash_price", sa.Numeric(20, 2), nullable=False),
        sa.Column("discount_percent", sa.Float(), nullable=False),
        sa.Column("quantity_limit", sa.Integer(), nullable=False),
        sa.Column("quantity_sold", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("start_at", sa.DateTime(), nullable=False),
        sa.Column("end_at", sa.DateTime(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="scheduled"),
        sa.Column("performance_metrics", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_flash_sale_product", "flash_sales", ["product_id"])
    op.create_index("ix_flash_sale_vendor", "flash_sales", ["vendor_id"])
    op.create_index("ix_flash_sale_status", "flash_sales", ["status"])
    op.create_index("ix_flash_sale_start", "flash_sales", ["start_at"])
    op.create_index("ix_flash_sale_end", "flash_sales", ["end_at"])

    # ------------------------------------------------------------------
    # 26. flash_sale_purchases
    # ------------------------------------------------------------------
    op.create_table(
        "flash_sale_purchases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "flash_sale_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("flash_sales.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("unit_price", sa.Numeric(20, 2), nullable=False),
        sa.Column("total_price", sa.Numeric(20, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_fsp_sale", "flash_sale_purchases", ["flash_sale_id"])
    op.create_index("ix_fsp_user", "flash_sale_purchases", ["user_id"])
    op.create_index("ix_fsp_created", "flash_sale_purchases", ["created_at"])

    # ------------------------------------------------------------------
    # 27. user_behavior_events
    # ------------------------------------------------------------------
    op.create_table(
        "user_behavior_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(20), nullable=False),
        sa.Column("context", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_behavior_user_id", "user_behavior_events", ["user_id"])
    op.create_index("ix_behavior_product_id", "user_behavior_events", ["product_id"])
    op.create_index("ix_behavior_event_type", "user_behavior_events", ["event_type"])
    op.create_index("ix_behavior_created_at", "user_behavior_events", ["created_at"])

    # ------------------------------------------------------------------
    # 28. recommendation_cache
    # ------------------------------------------------------------------
    op.create_table(
        "recommendation_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("product_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("algorithm", sa.String(50), nullable=False, server_default="hybrid"),
        sa.Column("score", sa.Numeric(5, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("cached_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_reccache_user_id", "recommendation_cache", ["user_id"])

    # ------------------------------------------------------------------
    # 29. social_comments
    # ------------------------------------------------------------------
    op.create_table(
        "social_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("post_id", sa.String(200), nullable=False),
        sa.Column("comment_id", sa.String(200), nullable=False, unique=True),
        sa.Column("author_name", sa.String(200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sentiment", sa.String(20), nullable=True),
        sa.Column("classification", sa.String(20), nullable=True),
        sa.Column("auto_reply", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("custom_reply", sa.Text(), nullable=True),
        sa.Column(
            "koc_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("platform_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_social_comments_koc_id", "social_comments", ["koc_id"])
    op.create_index("ix_social_comments_platform", "social_comments", ["platform"])
    op.create_index("ix_social_comments_status", "social_comments", ["status"])
    op.create_index("ix_social_comments_classification", "social_comments", ["classification"])
    op.create_index("ix_social_comments_created_at", "social_comments", ["created_at"])

    # ------------------------------------------------------------------
    # 30. coaching_reports
    # ------------------------------------------------------------------
    op.create_table(
        "coaching_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "koc_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("week_number", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("metrics_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("recommendations", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("action_items", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("peer_rank", sa.Integer(), nullable=True),
        sa.Column("improvement_score", sa.Numeric(5, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_coaching_koc_id", "coaching_reports", ["koc_id"])
    op.create_index("ix_coaching_week", "coaching_reports", ["year", "week_number"])

    # ------------------------------------------------------------------
    # 31. publish_jobs
    # ------------------------------------------------------------------
    op.create_table(
        "publish_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("media_urls", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("hashtags", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("affiliate_link", sa.String(500), nullable=True),
        sa.Column("schedule_at", sa.DateTime(), nullable=True),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("platform_post_id", sa.String(200), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("metrics", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_publish_jobs_user_id", "publish_jobs", ["user_id"])
    op.create_index("ix_publish_jobs_status", "publish_jobs", ["status"])
    op.create_index("ix_publish_jobs_platform", "publish_jobs", ["platform"])
    op.create_index("ix_publish_jobs_schedule_at", "publish_jobs", ["schedule_at"])

    # ------------------------------------------------------------------
    # 32. platform_connections
    # ------------------------------------------------------------------
    op.create_table(
        "platform_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("platform_user_id", sa.String(100), nullable=True),
        sa.Column("platform_username", sa.String(100), nullable=True),
        sa.Column("access_token_encrypted", sa.Text(), nullable=True),
        sa.Column("refresh_token_encrypted", sa.Text(), nullable=True),
        sa.Column("connected_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index("ix_platform_conn_user_id", "platform_connections", ["user_id"])
    op.create_index("ix_platform_conn_platform", "platform_connections", ["platform"])
    op.create_unique_constraint("uq_platform_conn_user_platform", "platform_connections", ["user_id", "platform"])

    # ------------------------------------------------------------------
    # 33. fraud_scores
    # ------------------------------------------------------------------
    op.create_table(
        "fraud_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("score", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("factors", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("action_taken", sa.String(20), nullable=False, server_default="none"),
        sa.Column("resolved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("is_fraud", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_fraud_scores_order_id", "fraud_scores", ["order_id"])
    op.create_index("ix_fraud_scores_score", "fraud_scores", ["score"])
    op.create_index("ix_fraud_scores_action", "fraud_scores", ["action_taken"])

    # ------------------------------------------------------------------
    # 34. fraud_alerts
    # ------------------------------------------------------------------
    op.create_table(
        "fraud_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "koc_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("alert_type", sa.String(30), nullable=False),
        sa.Column("severity", sa.String(10), nullable=False),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("resolved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resolution", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_fraud_alerts_order_id", "fraud_alerts", ["order_id"])
    op.create_index("ix_fraud_alerts_koc_id", "fraud_alerts", ["koc_id"])
    op.create_index("ix_fraud_alerts_status", "fraud_alerts", ["status"])
    op.create_index("ix_fraud_alerts_severity", "fraud_alerts", ["severity"])
    op.create_index("ix_fraud_alerts_type", "fraud_alerts", ["alert_type"])

    # ------------------------------------------------------------------
    # 35. shopping_events
    # ------------------------------------------------------------------
    op.create_table(
        "shopping_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("banner_url", sa.Text(), nullable=True),
        sa.Column("start_at", sa.DateTime(), nullable=False),
        sa.Column("end_at", sa.DateTime(), nullable=False),
        sa.Column("product_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("koc_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("commission_split", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("target_gmv", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("actual_gmv", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("total_orders", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("total_participants", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("commission_pool", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("nft_rewards_config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_shopping_events_status", "shopping_events", ["status"])
    op.create_index("ix_shopping_events_start_at", "shopping_events", ["start_at"])
    op.create_index("ix_shopping_events_end_at", "shopping_events", ["end_at"])

    # ------------------------------------------------------------------
    # 36. event_participants
    # ------------------------------------------------------------------
    op.create_table(
        "event_participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("shopping_events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "koc_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("joined_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("orders_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("gmv_contributed", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("commission_earned", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("rank", sa.Integer(), nullable=True),
        sa.Column("nft_award_token_id", sa.Integer(), nullable=True),
    )
    op.create_unique_constraint("uq_event_koc", "event_participants", ["event_id", "koc_id"])
    op.create_index("ix_event_participants_event_id", "event_participants", ["event_id"])
    op.create_index("ix_event_participants_koc_id", "event_participants", ["koc_id"])

    # ------------------------------------------------------------------
    # 37. event_leaderboard
    # ------------------------------------------------------------------
    op.create_table(
        "event_leaderboard",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("shopping_events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "koc_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("score", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("orders", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("gmv", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("rank", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_leaderboard_event_koc", "event_leaderboard", ["event_id", "koc_id"])
    op.create_index("ix_event_leaderboard_event_id", "event_leaderboard", ["event_id"])
    op.create_index("ix_event_leaderboard_rank", "event_leaderboard", ["event_id", "rank"])

    # ------------------------------------------------------------------
    # 38. compliance_reports
    # ------------------------------------------------------------------
    op.create_table(
        "compliance_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("report_type", sa.String(20), nullable=False),
        sa.Column("period_start", sa.DateTime(), nullable=False),
        sa.Column("period_end", sa.DateTime(), nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "generated_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("file_url", sa.Text(), nullable=True),
        sa.Column("sha256_hash", sa.String(64), nullable=True),
        sa.Column("blockchain_tx_hash", sa.String(66), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_compliance_reports_type", "compliance_reports", ["report_type"])
    op.create_index("ix_compliance_reports_created_at", "compliance_reports", ["created_at"])

    # ------------------------------------------------------------------
    # 39. attp_certifications
    # ------------------------------------------------------------------
    op.create_table(
        "attp_certifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "vendor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("cert_type", sa.String(50), nullable=False),
        sa.Column("cert_number", sa.String(100), nullable=False),
        sa.Column("issuer", sa.String(255), nullable=False),
        sa.Column("issued_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("document_url", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="valid"),
        sa.Column("verified_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_attp_cert_product_id", "attp_certifications", ["product_id"])
    op.create_index("ix_attp_cert_vendor_id", "attp_certifications", ["vendor_id"])
    op.create_index("ix_attp_cert_status", "attp_certifications", ["status"])

    # ------------------------------------------------------------------
    # 40. analytics_events
    # ------------------------------------------------------------------
    op.create_table(
        "analytics_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_type", sa.String(20), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("koc_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_analytics_events_type", "analytics_events", ["event_type"])
    op.create_index("ix_analytics_events_vendor_id", "analytics_events", ["vendor_id"])
    op.create_index("ix_analytics_events_product_id", "analytics_events", ["product_id"])
    op.create_index("ix_analytics_events_created_at", "analytics_events", ["created_at"])
    op.create_index("ix_analytics_events_koc_id", "analytics_events", ["koc_id"])

    # ------------------------------------------------------------------
    # 41. analytics_snapshots
    # ------------------------------------------------------------------
    op.create_table(
        "analytics_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "vendor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("period", sa.String(10), nullable=False),
        sa.Column("period_start", sa.DateTime(), nullable=False),
        sa.Column("metrics", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_analytics_snap_vendor_period", "analytics_snapshots", ["vendor_id", "period", "period_start"])

    # ------------------------------------------------------------------
    # 42. live_streams
    # ------------------------------------------------------------------
    op.create_table(
        "live_streams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "host_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="live"),
        sa.Column("stream_key", sa.String(64), nullable=False, unique=True),
        sa.Column("rtmp_url", sa.Text(), nullable=False),
        sa.Column("playback_url", sa.Text(), nullable=True),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("product_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default=sa.text("'[]'::jsonb")),
        sa.Column("viewer_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("peak_viewers", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("total_viewers", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("like_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("comment_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("orders_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("revenue_vnd", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("recording_url", sa.Text(), nullable=True),
        sa.Column("recording_duration_seconds", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_live_streams_host_id", "live_streams", ["host_id"])
    op.create_index("ix_live_streams_status", "live_streams", ["status"])
    op.create_index("ix_live_streams_started_at", "live_streams", ["started_at"])

    # ------------------------------------------------------------------
    # 43. live_flash_sales
    # ------------------------------------------------------------------
    op.create_table(
        "live_flash_sales",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "live_stream_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("live_streams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("discount_percent", sa.Numeric(5, 2), nullable=False),
        sa.Column("flash_price", sa.Numeric(18, 2), nullable=True),
        sa.Column("quantity_limit", sa.Integer(), nullable=False, server_default=sa.text("50")),
        sa.Column("quantity_sold", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default=sa.text("300")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("started_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("ends_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_live_flash_sales_stream_id", "live_flash_sales", ["live_stream_id"])

    # ------------------------------------------------------------------
    # 44. live_product_popups
    # ------------------------------------------------------------------
    op.create_table(
        "live_product_popups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "live_stream_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("live_streams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("message", sa.String(300), nullable=True),
        sa.Column("display_seconds", sa.Integer(), nullable=False, server_default=sa.text("15")),
        sa.Column("clicked_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("shown_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_live_product_popups_stream_id", "live_product_popups", ["live_stream_id"])

    # ------------------------------------------------------------------
    # 45. group_buys
    # ------------------------------------------------------------------
    op.create_table(
        "group_buys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "creator_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("tiers", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("current_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("max_participants", sa.Integer(), nullable=False, server_default=sa.text("100")),
        sa.Column("duration_hours", sa.Integer(), nullable=False, server_default=sa.text("48")),
        sa.Column("starts_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_group_buys_product_id", "group_buys", ["product_id"])
    op.create_index("ix_group_buys_status", "group_buys", ["status"])
    op.create_index("ix_group_buys_creator_id", "group_buys", ["creator_id"])
    op.create_index("ix_group_buys_expires_at", "group_buys", ["expires_at"])

    # ------------------------------------------------------------------
    # 46. group_buy_participants
    # ------------------------------------------------------------------
    op.create_table(
        "group_buy_participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "group_buy_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("group_buys.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("tier_at_join", sa.String(100), nullable=True),
        sa.Column("joined_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_group_buy_user", "group_buy_participants", ["group_buy_id", "user_id"])
    op.create_index("ix_gbp_group_buy_id", "group_buy_participants", ["group_buy_id"])
    op.create_index("ix_gbp_user_id", "group_buy_participants", ["user_id"])

    # ------------------------------------------------------------------
    # 47. shipments
    # ------------------------------------------------------------------
    op.create_table(
        "shipments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("carrier", sa.String(50), nullable=False),
        sa.Column("tracking_number", sa.String(100), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("shipped_at", sa.DateTime(), nullable=True),
        sa.Column("delivered_at", sa.DateTime(), nullable=True),
        sa.Column("events", postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


# ══════════════════════════════════════════════════════════════════════════════
# DOWNGRADE — drop all tables in reverse dependency order
# ══════════════════════════════════════════════════════════════════════════════

def downgrade() -> None:
    # Leaf / dependent tables first
    op.drop_table("shipments")
    op.drop_table("group_buy_participants")
    op.drop_table("group_buys")
    op.drop_table("live_product_popups")
    op.drop_table("live_flash_sales")
    op.drop_table("live_streams")
    op.drop_table("analytics_snapshots")
    op.drop_table("analytics_events")
    op.drop_table("attp_certifications")
    op.drop_table("compliance_reports")
    op.drop_table("event_leaderboard")
    op.drop_table("event_participants")
    op.drop_table("shopping_events")
    op.drop_table("fraud_alerts")
    op.drop_table("fraud_scores")
    op.drop_table("platform_connections")
    op.drop_table("publish_jobs")
    op.drop_table("coaching_reports")
    op.drop_table("social_comments")
    op.drop_table("recommendation_cache")
    op.drop_table("user_behavior_events")
    op.drop_table("flash_sale_purchases")
    op.drop_table("flash_sales")
    op.drop_table("pool_distributions")
    op.drop_table("pool_configs")
    op.drop_table("pool_rankings")
    op.drop_table("koc_battles")
    op.drop_table("daily_checkins")
    op.drop_table("leaderboard_entries")
    op.drop_table("user_missions")
    op.drop_table("missions")
    op.drop_table("user_achievements")
    op.drop_table("achievements")
    op.drop_table("wk_transactions")
    op.drop_table("user_wk")
    op.drop_table("follows")
    op.drop_table("memberships")
    op.drop_table("reviews")
    op.drop_table("return_requests")
    op.drop_table("commissions")
    op.drop_table("orders")
    op.drop_table("dpp_records")
    op.drop_table("product_variants")
    op.drop_table("products")
    op.drop_table("vendor_profiles")
    op.drop_table("koc_profiles")
    op.drop_table("users")
