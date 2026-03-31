"""
WellKOC — Auth endpoint tests.

Covers:
    POST /api/v1/auth/register
    POST /api/v1/auth/login
    GET  /api/v1/auth/me
    POST /api/v1/auth/logout
    POST /api/v1/auth/refresh
"""
import pytest
from httpx import AsyncClient

BASE = "/api/v1/auth"


# ── Register ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_new_user(client: AsyncClient):
    """Registering with a fresh email returns 201 and JWT tokens."""
    resp = await client.post(
        f"{BASE}/register",
        json={
            "email": "newuser@example.com",
            "password": "securepass1",
            "role": "buyer",
            "language": "vi",
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data
    assert data["user"]["email"] == "newuser@example.com"
    assert data["user"]["role"] == "buyer"


@pytest.mark.asyncio
async def test_register_duplicate_email_returns_error(client: AsyncClient):
    """Re-registering with the same email must fail (422 or 400/409)."""
    payload = {
        "email": "dup@example.com",
        "password": "securepass1",
        "role": "buyer",
    }
    r1 = await client.post(f"{BASE}/register", json=payload)
    assert r1.status_code == 201

    r2 = await client.post(f"{BASE}/register", json=payload)
    assert r2.status_code in (400, 409, 422), r2.text


# ── Login ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_with_valid_credentials(client: AsyncClient):
    """Login after registration returns tokens."""
    email = "logintest@example.com"
    password = "mypassword99"

    reg = await client.post(
        f"{BASE}/register",
        json={"email": email, "password": password, "role": "buyer"},
    )
    assert reg.status_code == 201

    resp = await client.post(
        f"{BASE}/login",
        json={"identifier": email, "password": password},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == email


@pytest.mark.asyncio
async def test_login_with_invalid_credentials_returns_401(client: AsyncClient):
    """Wrong password must return HTTP 401."""
    email = "wrongpass@example.com"
    reg = await client.post(
        f"{BASE}/register",
        json={"email": email, "password": "correctpass1", "role": "buyer"},
    )
    assert reg.status_code == 201

    resp = await client.post(
        f"{BASE}/login",
        json={"identifier": email, "password": "wrongpassword"},
    )
    assert resp.status_code == 401, resp.text


@pytest.mark.asyncio
async def test_login_nonexistent_user_returns_401(client: AsyncClient):
    """Logging in with an email that was never registered returns 401."""
    resp = await client.post(
        f"{BASE}/login",
        json={"identifier": "ghost@example.com", "password": "anypass123"},
    )
    assert resp.status_code == 401, resp.text


# ── /me ──────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_me_with_valid_token(client: AsyncClient):
    """GET /me with a valid Bearer token returns the authenticated user."""
    email = "metest@example.com"
    reg = await client.post(
        f"{BASE}/register",
        json={"email": email, "password": "testpass12", "role": "buyer"},
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]

    resp = await client.get(
        f"{BASE}/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["email"] == email
    assert "id" in data
    assert "role" in data


@pytest.mark.asyncio
async def test_get_me_without_token_returns_401(client: AsyncClient):
    """GET /me without an Authorization header must return 401."""
    resp = await client.get(f"{BASE}/me")
    assert resp.status_code == 401, resp.text


@pytest.mark.asyncio
async def test_get_me_with_malformed_token_returns_401(client: AsyncClient):
    """A garbage Bearer token must be rejected with 401."""
    resp = await client.get(
        f"{BASE}/me",
        headers={"Authorization": "Bearer not.a.valid.token"},
    )
    assert resp.status_code == 401, resp.text


# ── Logout ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_logout(client: AsyncClient):
    """Logout returns 200 and subsequent /me with the same token fails."""
    email = "logout@example.com"
    reg = await client.post(
        f"{BASE}/register",
        json={"email": email, "password": "logoutpass1", "role": "buyer"},
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]

    # Confirm /me works before logout
    me_before = await client.get(
        f"{BASE}/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_before.status_code == 200

    # Logout
    logout_resp = await client.post(
        f"{BASE}/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert logout_resp.status_code == 200, logout_resp.text
    assert "message" in logout_resp.json()

    # /me must now be rejected (token blacklisted in fake Redis)
    me_after = await client.get(
        f"{BASE}/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_after.status_code == 401, me_after.text


# ── Refresh ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient):
    """A valid refresh token exchanges for a new access token."""
    email = "refresh@example.com"
    reg = await client.post(
        f"{BASE}/register",
        json={"email": email, "password": "refreshpass1", "role": "buyer"},
    )
    assert reg.status_code == 201
    refresh_token = reg.json()["refresh_token"]

    resp = await client.post(
        f"{BASE}/refresh",
        params={"refresh_token": refresh_token},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data
    # New access token should differ from original (new iat/jti)
    assert data["access_token"] != reg.json()["access_token"]


@pytest.mark.asyncio
async def test_refresh_with_invalid_token_returns_401(client: AsyncClient):
    """A bogus refresh token must return 401."""
    resp = await client.post(
        f"{BASE}/refresh",
        params={"refresh_token": "not.a.real.refresh.token"},
    )
    assert resp.status_code == 401, resp.text


# ── Role in token payload ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_koc_role(client: AsyncClient):
    """Registering as KOC stores the koc role in the response."""
    resp = await client.post(
        f"{BASE}/register",
        json={
            "email": "koc_new@example.com",
            "password": "kocpassword1",
            "role": "koc",
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["user"]["role"] == "koc"


@pytest.mark.asyncio
async def test_register_vendor_role(client: AsyncClient):
    """Registering as vendor stores the vendor role in the response."""
    resp = await client.post(
        f"{BASE}/register",
        json={
            "email": "vendor_new@example.com",
            "password": "vendorpassword1",
            "role": "vendor",
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["user"]["role"] == "vendor"


@pytest.mark.asyncio
async def test_register_with_referral_code(client: AsyncClient):
    """Registration with a valid referral code should succeed."""
    # First create a referrer
    reg_referrer = await client.post(
        f"{BASE}/register",
        json={"email": "referrer@example.com", "password": "referrerpass1", "role": "koc"},
    )
    assert reg_referrer.status_code == 201
    referral_code = reg_referrer.json()["user"]["referral_code"]

    # Register a new user with the referral code
    resp = await client.post(
        f"{BASE}/register",
        json={
            "email": "referred@example.com",
            "password": "referredpass1",
            "role": "buyer",
            "referral_code": referral_code,
        },
    )
    assert resp.status_code == 201, resp.text
    assert "access_token" in resp.json()
