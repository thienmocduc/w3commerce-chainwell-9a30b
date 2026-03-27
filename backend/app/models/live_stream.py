"""
WellKOC — Live Commerce Models (Module #30-31)
Live streaming with product popups, flash sales, and replay
Status: scheduled -> live -> ended
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, Numeric,
    String, Text, func, Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LiveStreamStatus(str, Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    ENDED = "ended"


class LiveStream(Base):
    """A KOC live commerce stream session"""
    __tablename__ = "live_streams"
    __table_args__ = (
        Index("ix_live_streams_host_id", "host_id"),
        Index("ix_live_streams_status", "status"),
        Index("ix_live_streams_started_at", "started_at"),
        {"schema": None},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    host_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # ── Stream config ────────────────────────────────────────
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default=LiveStreamStatus.LIVE, nullable=False
    )
    stream_key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    rtmp_url: Mapped[str] = mapped_column(Text, nullable=False)
    playback_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Products in stream ───────────────────────────────────
    product_ids: Mapped[Optional[list]] = mapped_column(
        JSONB, default=list, comment="List of product UUIDs showcased"
    )

    # ── Metrics ──────────────────────────────────────────────
    viewer_count: Mapped[int] = mapped_column(Integer, default=0)
    peak_viewers: Mapped[int] = mapped_column(Integer, default=0)
    total_viewers: Mapped[int] = mapped_column(Integer, default=0)
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, default=0)
    orders_count: Mapped[int] = mapped_column(Integer, default=0)
    revenue_vnd: Mapped[float] = mapped_column(Numeric(18, 2), default=0)

    # ── Recording ────────────────────────────────────────────
    recording_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recording_duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # ── Timestamps ───────────────────────────────────────────
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # ── Relationships ────────────────────────────────────────
    flash_sales: Mapped[list["LiveFlashSale"]] = relationship(
        "LiveFlashSale", back_populates="live_stream", lazy="selectin"
    )
    product_popups: Mapped[list["LiveProductPopup"]] = relationship(
        "LiveProductPopup", back_populates="live_stream", lazy="selectin"
    )


class LiveFlashSale(Base):
    """Flash sale triggered during a live stream"""
    __tablename__ = "live_flash_sales"
    __table_args__ = (
        Index("ix_live_flash_sales_stream_id", "live_stream_id"),
        {"schema": None},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    live_stream_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("live_streams.id"), nullable=False
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )

    discount_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    flash_price: Mapped[Optional[float]] = mapped_column(Numeric(18, 2), nullable=True)
    quantity_limit: Mapped[int] = mapped_column(Integer, default=50)
    quantity_sold: Mapped[int] = mapped_column(Integer, default=0)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=300)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    ends_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # ── Relationships ────────────────────────────────────────
    live_stream: Mapped["LiveStream"] = relationship(
        "LiveStream", back_populates="flash_sales"
    )


class LiveProductPopup(Base):
    """Product popup pushed to viewers during a live stream"""
    __tablename__ = "live_product_popups"
    __table_args__ = (
        Index("ix_live_product_popups_stream_id", "live_stream_id"),
        {"schema": None},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    live_stream_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("live_streams.id"), nullable=False
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )

    message: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    display_seconds: Mapped[int] = mapped_column(Integer, default=15)
    clicked_count: Mapped[int] = mapped_column(Integer, default=0)
    shown_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # ── Relationships ────────────────────────────────────────
    live_stream: Mapped["LiveStream"] = relationship(
        "LiveStream", back_populates="product_popups"
    )
