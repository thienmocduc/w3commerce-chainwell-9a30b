"""
WellKOC — Review Model (On-chain integrity)
Reviews are hashed for on-chain verification. Supports flagging & moderation.
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import String, Integer, Text, DateTime, Boolean, ForeignKey, func, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ReviewStatus(str, Enum):
    ACTIVE = "active"
    FLAGGED = "flagged"
    UNDER_REVIEW = "under_review"
    REMOVED = "removed"


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        Index("ix_reviews_product_id", "product_id"),
        Index("ix_reviews_user_id", "user_id"),
        Index("ix_reviews_order_id", "order_id"),
        Index("ix_reviews_status", "status"),
        Index("ix_reviews_created_at", "created_at"),
        {"schema": None},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"))
    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    # ── Content ───────────────────────────────────────────────
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    images: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    media_urls: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)

    # ── On-chain integrity ────────────────────────────────────
    content_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True)
    tx_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True)
    block_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # ── Moderation ────────────────────────────────────────────
    status: Mapped[str] = mapped_column(String(20), default=ReviewStatus.ACTIVE)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True)
    flagged_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    flagged_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    flagged_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    removed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    removed_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    removed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # ── Engagement ────────────────────────────────────────────
    helpful_count: Mapped[int] = mapped_column(Integer, default=0)

    # ── Timestamps ────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<Review {self.id} product={self.product_id} rating={self.rating} [{self.status}]>"
