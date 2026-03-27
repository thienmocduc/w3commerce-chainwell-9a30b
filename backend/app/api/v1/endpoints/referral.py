"""WellKOC — Referral Tree & Network Endpoints"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.v1.deps import CurrentUser, require_role, get_current_user
from app.models.user import User, UserRole
from app.models.order import Commission, CommissionStatus

router = APIRouter(prefix="/referral", tags=["Referral"])


# ── Helpers ──────────────────────────────────────────────────

def _user_node(user: User, level: int = 0) -> dict:
    """Serialize a user into a referral-tree node (without children)."""
    return {
        "user_id": str(user.id),
        "name": user.display_name or user.full_name or user.email or "Unknown",
        "role": user.role,
        "level": level,
        "commission_earned": float(user.total_commission_earned),
        "referral_code": user.referral_code,
        "is_active": user.is_active,
        "avatar_url": user.avatar_url,
    }


async def _build_tree(
    db: AsyncSession, user_id: UUID, depth: int, current_level: int = 0
) -> dict:
    """Recursively build referral tree up to *depth* levels."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return {}

    node = _user_node(user, current_level)

    if current_level >= depth:
        node["children"] = []
        return node

    children_result = await db.execute(
        select(User).where(User.referred_by_id == user_id, User.is_active == True)
    )
    children = children_result.scalars().all()

    node["children"] = [
        await _build_tree(db, child.id, depth, current_level + 1)
        for child in children
    ]
    return node


async def _count_network(db: AsyncSession, user_id: UUID, max_depth: int = 10) -> dict:
    """Gather network stats: total members, active, depth, tier breakdown."""
    total = 0
    active = 0
    actual_depth = 0
    tier_breakdown: dict[str, int] = {}

    queue = [(user_id, 0)]
    visited: set[UUID] = {user_id}

    while queue:
        current_id, level = queue.pop(0)
        if level > max_depth:
            continue

        r = await db.execute(
            select(User).where(User.referred_by_id == current_id)
        )
        children = r.scalars().all()

        for child in children:
            if child.id in visited:
                continue
            visited.add(child.id)
            total += 1
            if child.is_active:
                active += 1
            if level + 1 > actual_depth:
                actual_depth = level + 1
            tier = child.membership_tier or "free"
            tier_breakdown[tier] = tier_breakdown.get(tier, 0) + 1
            queue.append((child.id, level + 1))

    return {
        "total_members": total,
        "active_members": active,
        "max_depth": actual_depth,
        "tier_breakdown": tier_breakdown,
    }


# ── Endpoints ────────────────────────────────────────────────

@router.get("/tree/{user_id}")
async def get_referral_tree(
    user_id: UUID,
    depth: int = Query(5, ge=1, le=10),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return nested referral tree from *user_id* down to *depth* levels."""
    root = await db.execute(select(User).where(User.id == user_id))
    if not root.scalar_one_or_none():
        raise HTTPException(404, "Người dùng không tồn tại")

    tree = await _build_tree(db, user_id, depth)
    return tree


@router.get("/my-team")
async def my_team(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Current user's direct referrals + aggregated stats."""
    # Direct referrals
    r = await db.execute(
        select(User).where(User.referred_by_id == current_user.id)
    )
    direct = r.scalars().all()

    # Commission total for entire network
    network = await _count_network(db, current_user.id)

    # Total commission earned by user
    r = await db.execute(
        select(func.sum(Commission.amount))
        .where(Commission.koc_id == current_user.id, Commission.status == CommissionStatus.SETTLED)
    )
    total_commission = float(r.scalar() or 0)

    return {
        "direct_referrals": [_user_node(u, 1) for u in direct],
        "total_members": network["total_members"],
        "active_count": network["active_members"],
        "total_commission": total_commission,
    }


@router.get("/stats/{user_id}")
async def referral_stats(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Network stats for a given user: total members, commission, depth, tiers."""
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Người dùng không tồn tại")

    network = await _count_network(db, user_id)

    r = await db.execute(
        select(func.sum(Commission.amount))
        .where(Commission.koc_id == user_id, Commission.status == CommissionStatus.SETTLED)
    )
    total_commission = float(r.scalar() or 0)

    return {
        "user_id": str(user_id),
        "total_members": network["total_members"],
        "active_members": network["active_members"],
        "max_depth": network["max_depth"],
        "tier_breakdown": network["tier_breakdown"],
        "total_commission": total_commission,
    }


@router.get("/network-search")
async def network_search(
    query: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search users in the current user's referral network by name/email/referral_code."""
    # First collect all user IDs in network via BFS
    network_ids: set[UUID] = set()
    queue = [current_user.id]
    visited: set[UUID] = {current_user.id}

    while queue:
        current_id = queue.pop(0)
        r = await db.execute(
            select(User.id).where(User.referred_by_id == current_id)
        )
        child_ids = r.scalars().all()
        for cid in child_ids:
            if cid not in visited:
                visited.add(cid)
                network_ids.add(cid)
                queue.append(cid)

    if not network_ids:
        return {"results": []}

    # Search within network
    like_q = f"%{query}%"
    r = await db.execute(
        select(User).where(
            User.id.in_(network_ids),
            or_(
                User.full_name.ilike(like_q),
                User.display_name.ilike(like_q),
                User.email.ilike(like_q),
                User.referral_code.ilike(like_q),
            ),
        ).limit(50)
    )
    users = r.scalars().all()

    return {
        "results": [_user_node(u) for u in users],
        "total": len(users),
    }
