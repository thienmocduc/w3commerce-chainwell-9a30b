"""
WellKOC — Group Buy Models
Group purchasing campaigns with tiered discounts
Status: active -> completed | expired | cancelled
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import (
    DateTime, ForeignKey, Integer, Numeric,
    String, func, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class GroupBuyStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class GroupBuy(Base):
    """A group buy campaign with tiered quantity discounts"""
    __tablename__ = "group_buys"
    __table_args__ = (
        Index("ix_group_buys_product_id", "product_id"),
        Index("ix_group_buys_status", "status"),
        Index("ix_group_buys_creator_id", "creator_id"),
        Index("ix_group_buys_expires_at", "expires_at"),
        {"schema": None},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # ── Campaign config ──────────────────────────────────────
    status: Mapped[str] = mapped_column(
        String(20), default=GroupBuyStatus.ACTIVE, nullable=False
    )
    tiers: Mapped[list] = mapped_column(
        JSONB, nullable=False,
        comment='[{"min_qty": 10, "discount_percent": 5, "name": "Starter"}, ...]'
    )
    current_count: Mapped[int] = mapped_column(Integer, default=0)
    max_participants: Mapped[int] = mapped_column(Integer, default=100)
    duration_hours: Mapped[int] = mapped_column(Integer, default=48)

    # ── Timestamps ───────────────────────────────────────────
    starts_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # ── Relationships ────────────────────────────────────────
    participants: Mapped[list["GroupBuyParticipant"]] = relationship(
        "GroupBuyParticipant", back_populates="group_buy", lazy="selectin"
    )

    @property
    def current_tier(self) -> Optional[dict]:
        """Return the highest tier achieved based on current_count"""
        if not self.tiers:
            return None
        sorted_tiers = sorted(self.tiers, key=lambda t: t["min_qty"], reverse=True)
        for tier in sorted_tiers:
            if self.current_count >= tier["min_qty"]:
                return tier
        return None

    @property
    def next_tier(self) -> Optional[dict]:
        """Return the next tier to unlock"""
        if not self.tiers:
            return None
        sorted_tiers = sorted(self.tiers, key=lambda t: t["min_qty"])
        for tier in sorted_tiers:
            if self.current_count < tier["min_qty"]:
                return tier
        return None


class GroupBuyParticipant(Base):
    """Individual participant in a group buy"""
    __tablename__ = "group_buy_participants"
    __table_args__ = (
        UniqueConstraint("group_buy_id", "user_id", name="uq_group_buy_user"),
        Index("ix_gbp_group_buy_id", "group_buy_id"),
        Index("ix_gbp_user_id", "user_id"),
        {"schema": None},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    group_buy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("group_buys.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    tier_at_join: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # ── Relationships ────────────────────────────────────────
    group_buy: Mapped["GroupBuy"] = relationship(
        "GroupBuy", back_populates="participants"
    )
