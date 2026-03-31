"""
WellKOC — pytest configuration and shared fixtures.

Uses an in-memory SQLite database (via aiosqlite) so tests run without
a live PostgreSQL or Redis instance.  PostgreSQL-specific column types
(UUID, JSONB, ARRAY, Vector) are mapped to compatible SQLite equivalents
through SQLAlchemy's TypeDecorator overrides defined below.
"""
import asyncio
import uuid
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from passlib.context import CryptContext
from sqlalchemy import String, Text, event
from sqlalchemy.dialects import sqlite as _sqlite_dialect
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.types import TypeDecorator

# ── Patch PostgreSQL-only column types before importing models ──────────────
# SQLAlchemy renders JSONB / UUID(as_uuid=True) / Vector as PG-only DDL.
# We swap them out for TEXT/VARCHAR so SQLite can create the schema.

from sqlalchemy.dialects.postgresql import JSONB as _PG_JSONB
from sqlalchemy.dialects.postgresql import UUID as _PG_UUID
import sqlalchemy.dialects.postgresql as _pg


class _JSONBCompat(TypeDecorator):
    """Store JSONB as TEXT in SQLite."""
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        import json
        if value is None:
            return None
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        import json
        if value is None:
            return None
        try:
            return json.loads(value)
        except Exception:
            return value


class _UUIDCompat(TypeDecorator):
    """Store UUID as VARCHAR(36) in SQLite."""
    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        try:
            return uuid.UUID(value)
        except Exception:
            return value


# Monkey-patch the PostgreSQL dialect types used in models
_pg.JSONB = _JSONBCompat
_pg.ARRAY = lambda *a, **kw: Text  # ARRAY columns become TEXT

# pgvector is optional — stub it if not installed
try:
    from pgvector.sqlalchemy import Vector as _PgVector  # noqa: F401

    class _VectorCompat(TypeDecorator):
        impl = Text
        cache_ok = True

        def process_bind_param(self, value, dialect):
            if value is None:
                return None
            import json
            return json.dumps(list(value))

        def process_result_value(self, value, dialect):
            if value is None:
                return None
            import json
            try:
                return json.loads(value)
            except Exception:
                return value

    import pgvector.sqlalchemy as _pgv_mod
    _pgv_mod.Vector = _VectorCompat
except ImportError:
    pass

# Now safe to import app modules
from app.core.database import Base, get_db  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.user import User, UserRole, KYCStatus  # noqa: E402

# ── Test DB ──────────────────────────────────────────────────────────────────

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Redis mock ────────────────────────────────────────────────────────────────

class _FakeRedis:
    """Minimal in-memory Redis mock sufficient for auth tests."""

    def __init__(self):
        self._store: dict = {}

    async def get(self, key):
        return self._store.get(key)

    async def set(self, key, value, ex=None):
        self._store[key] = value

    async def delete(self, key):
        self._store.pop(key, None)

    async def ping(self):
        return True


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop_policy():
    """Use the default asyncio policy."""
    return asyncio.DefaultEventLoopPolicy()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create all tables before each test, drop them after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client wired to the FastAPI app with test DB and fake Redis."""
    fake_redis = _FakeRedis()

    # Override Redis globally
    import app.core.redis_client as _redis_mod
    _redis_mod.redis_client = fake_redis

    # Override get_db dependency
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app = create_app()
    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


# ── User fixture helpers ──────────────────────────────────────────────────────

def _make_user(
    *,
    email: str,
    password: str,
    role: str,
    display_name: str = "",
) -> User:
    return User(
        id=uuid.uuid4(),
        email=email,
        hashed_password=_pwd_context.hash(password),
        role=role,
        is_active=True,
        is_verified=True,
        email_verified=True,
        kyc_status=KYCStatus.PENDING,
        display_name=display_name,
        referral_code=f"WK-{str(uuid.uuid4()).replace('-', '')[:6].upper()}",
        language="vi",
        membership_tier="free",
    )


@pytest_asyncio.fixture
async def buyer_user(db_session: AsyncSession) -> User:
    user = _make_user(
        email="buyer@test.com",
        password="password123",
        role=UserRole.BUYER,
        display_name="Test Buyer",
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def koc_user(db_session: AsyncSession) -> User:
    user = _make_user(
        email="koc@test.com",
        password="password123",
        role=UserRole.KOC,
        display_name="Test KOC",
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def vendor_user(db_session: AsyncSession) -> User:
    user = _make_user(
        email="vendor@test.com",
        password="password123",
        role=UserRole.VENDOR,
        display_name="Test Vendor",
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    user = _make_user(
        email="admin@test.com",
        password="adminpassword123",
        role=UserRole.ADMIN,
        display_name="Test Admin",
    )
    db_session.add(user)
    await db_session.flush()
    return user
