"""
WellKOC — API v1 Router
Registers all endpoint modules with prefix /api/v1
"""
from fastapi import APIRouter

from app.api.v1.endpoints import (
    gamification, returns,
    auth, products, orders, cart, payments,
    commissions, koc, vendor, vendor_onboarding, admin, ai_agents,
    shipping, reviews, dpp, websocket, kyc,
    group_buy, live,
    social, membership,
    referral, share_links,
)

api_router = APIRouter()

# ── Auth & Users ─────────────────────────────────────────────
api_router.include_router(auth.router)
api_router.include_router(kyc.router)

# ── Commerce ─────────────────────────────────────────────────
api_router.include_router(products.router)
api_router.include_router(cart.router)
api_router.include_router(orders.router)
api_router.include_router(payments.router)
api_router.include_router(shipping.router)
api_router.include_router(reviews.router)
api_router.include_router(returns.router)

# ── Blockchain ───────────────────────────────────────────────
api_router.include_router(dpp.router)
api_router.include_router(commissions.router)

# ── Platform roles ───────────────────────────────────────────
api_router.include_router(koc.router)
api_router.include_router(vendor.router)
api_router.include_router(vendor_onboarding.router)
api_router.include_router(admin.router)

# ── AI & Intelligence ────────────────────────────────────────
api_router.include_router(ai_agents.router)

# ── Social Commerce ─────────────────────────────────────────
api_router.include_router(group_buy.router)
api_router.include_router(live.router)
api_router.include_router(social.router)

# ── Referral & Share ───────────────────────────────────────
api_router.include_router(referral.router)
api_router.include_router(share_links.router)

# ── Membership ─────────────────────────────────────────────
api_router.include_router(membership.router)

# ── Gamification ────────────────────────────────────────────
api_router.include_router(gamification.router)

# ── Real-time (WebSocket) ────────────────────────────────────
api_router.include_router(websocket.router)
