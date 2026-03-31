"""
WellKOC — Orders endpoint tests.

Covers:
    POST   /api/v1/orders              Create order
    GET    /api/v1/orders              List orders (paginated)
    GET    /api/v1/orders/{id}         Get single order
    PUT    /api/v1/orders/{id}/status  Vendor/admin status update
    GET    /api/v1/orders/{id}/tracking Tracking info

All tests use the in-memory SQLite DB wired up in conftest.py.
Celery workers (commission_worker, gamification_worker) are mocked so
tests never touch a real broker or blockchain.
"""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

AUTH_BASE = "/api/v1/auth"
ORDERS_BASE = "/api/v1/orders"


# ── Helpers ───────────────────────────────────────────────────────────────────

async def register_and_login(
    client: AsyncClient,
    email: str,
    password: str,
    role: str,
) -> str:
    """
    Register a new user and return the access token.

    Parameters
    ----------
    client:   The test AsyncClient.
    email:    Unique e-mail for this user.
    password: Plain-text password (min 8 chars).
    role:     One of 'buyer', 'vendor', 'koc', 'admin'.

    Returns
    -------
    str — Bearer access token ready for use in Authorization headers.
    """
    resp = await client.post(
        f"{AUTH_BASE}/register",
        json={"email": email, "password": password, "role": role},
    )
    assert resp.status_code == 201, f"Registration failed for {email}: {resp.text}"
    return resp.json()["access_token"]


def _buyer_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _checkout_payload(
    vendor_id: str | None = None,
    idempotency_key: str | None = None,
) -> dict:
    """Minimal valid checkout request body."""
    return {
        "items": [
            {
                "product_id": str(uuid.uuid4()),
                "vendor_id": vendor_id or str(uuid.uuid4()),
                "name": "Test Product",
                "price": 150000,
                "quantity": 2,
            }
        ],
        "shipping_address": {
            "name": "Nguyen Van A",
            "phone": "0901234567",
            "address": "123 Le Loi",
            "city": "Ho Chi Minh",
            "province": "TP.HCM",
        },
        "payment_method": "cod",
        **({"idempotency_key": idempotency_key} if idempotency_key else {}),
    }


# ── Create order ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_order_unauthenticated(client: AsyncClient):
    """POST /orders without a token must return 401."""
    resp = await client.post(ORDERS_BASE, json=_checkout_payload())
    assert resp.status_code == 401, resp.text


@pytest.mark.asyncio
async def test_create_order_authenticated(client: AsyncClient):
    """Authenticated buyer can create an order; response includes order_id + order_number."""
    token = await register_and_login(client, "buyer_create@test.com", "password123", "buyer")

    resp = await client.post(
        ORDERS_BASE,
        json=_checkout_payload(),
        headers=_buyer_headers(token),
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert "order_id" in data, "Response must include order_id"
    assert "order_number" in data, "Response must include order_number"
    assert data["order_number"].startswith("ORD-"), f"Unexpected order_number: {data['order_number']}"
    assert "total" in data
    assert float(data["total"]) == 300000.0  # 150_000 * 2
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_create_order_idempotency(client: AsyncClient):
    """
    Sending the same idempotency_key twice must return 409 on the second call,
    preventing duplicate orders.
    """
    token = await register_and_login(client, "buyer_idem@test.com", "password123", "buyer")
    key = str(uuid.uuid4())
    payload = _checkout_payload(idempotency_key=key)

    r1 = await client.post(ORDERS_BASE, json=payload, headers=_buyer_headers(token))
    assert r1.status_code == 201, r1.text

    r2 = await client.post(ORDERS_BASE, json=payload, headers=_buyer_headers(token))
    assert r2.status_code == 409, (
        "Second request with same idempotency_key must return 409, "
        f"got {r2.status_code}: {r2.text}"
    )


# ── List orders ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_orders_empty(client: AsyncClient):
    """A freshly registered buyer with no orders gets an empty items list."""
    token = await register_and_login(client, "buyer_empty@test.com", "password123", "buyer")

    resp = await client.get(ORDERS_BASE, headers=_buyer_headers(token))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "items" in data
    assert data["items"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_orders_after_create(client: AsyncClient):
    """After creating an order, the list endpoint returns it."""
    token = await register_and_login(client, "buyer_list@test.com", "password123", "buyer")

    create_resp = await client.post(
        ORDERS_BASE,
        json=_checkout_payload(),
        headers=_buyer_headers(token),
    )
    assert create_resp.status_code == 201

    list_resp = await client.get(ORDERS_BASE, headers=_buyer_headers(token))
    assert list_resp.status_code == 200, list_resp.text
    data = list_resp.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["status"] == "pending"


@pytest.mark.asyncio
async def test_list_orders_unauthenticated(client: AsyncClient):
    """GET /orders without a token must return 401."""
    resp = await client.get(ORDERS_BASE)
    assert resp.status_code == 401, resp.text


@pytest.mark.asyncio
async def test_list_orders_pagination(client: AsyncClient):
    """page and per_page query params are respected."""
    token = await register_and_login(client, "buyer_page@test.com", "password123", "buyer")
    headers = _buyer_headers(token)

    # Create 3 orders with distinct idempotency keys
    for i in range(3):
        r = await client.post(
            ORDERS_BASE,
            json=_checkout_payload(idempotency_key=f"pg-key-{i}"),
            headers=headers,
        )
        assert r.status_code == 201

    # Only ask for 2 per page
    resp = await client.get(ORDERS_BASE, params={"page": 1, "per_page": 2}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert len(data["items"]) == 2
    assert data["page"] == 1

    # Second page should have 1 item
    resp2 = await client.get(ORDERS_BASE, params={"page": 2, "per_page": 2}, headers=headers)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert len(data2["items"]) == 1


# ── Get single order ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_order_by_id(client: AsyncClient):
    """GET /orders/{id} returns the correct order for its owner."""
    token = await register_and_login(client, "buyer_getid@test.com", "password123", "buyer")
    headers = _buyer_headers(token)

    create_resp = await client.post(ORDERS_BASE, json=_checkout_payload(), headers=headers)
    assert create_resp.status_code == 201
    order_id = create_resp.json()["order_id"]

    resp = await client.get(f"{ORDERS_BASE}/{order_id}", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["id"] == order_id
    assert "order_number" in data
    assert "status" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_get_order_wrong_user(client: AsyncClient):
    """A different authenticated user must receive 403 for another user's order."""
    buyer_token = await register_and_login(
        client, "buyer_owner@test.com", "password123", "buyer"
    )
    other_token = await register_and_login(
        client, "buyer_other@test.com", "password123", "buyer"
    )

    # Buyer creates an order
    create_resp = await client.post(
        ORDERS_BASE,
        json=_checkout_payload(),
        headers=_buyer_headers(buyer_token),
    )
    assert create_resp.status_code == 201
    order_id = create_resp.json()["order_id"]

    # Other user tries to fetch it
    resp = await client.get(
        f"{ORDERS_BASE}/{order_id}",
        headers=_buyer_headers(other_token),
    )
    assert resp.status_code == 403, (
        f"Expected 403 for unauthorised access, got {resp.status_code}: {resp.text}"
    )


@pytest.mark.asyncio
async def test_get_order_not_found(client: AsyncClient):
    """Requesting a non-existent order UUID returns 404."""
    token = await register_and_login(
        client, "buyer_notfound@test.com", "password123", "buyer"
    )
    random_id = str(uuid.uuid4())

    resp = await client.get(
        f"{ORDERS_BASE}/{random_id}",
        headers=_buyer_headers(token),
    )
    assert resp.status_code == 404, resp.text


@pytest.mark.asyncio
async def test_get_order_invalid_uuid(client: AsyncClient):
    """A malformed UUID in the path returns 422 (validation error)."""
    token = await register_and_login(
        client, "buyer_baduuid@test.com", "password123", "buyer"
    )
    resp = await client.get(
        f"{ORDERS_BASE}/not-a-valid-uuid",
        headers=_buyer_headers(token),
    )
    assert resp.status_code == 422, resp.text


# ── Vendor status update ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_order_status_as_vendor(client: AsyncClient):
    """
    A vendor can update an order status.
    Celery tasks triggered on DELIVERED status are mocked away.
    """
    buyer_token = await register_and_login(
        client, "buyer_status@test.com", "password123", "buyer"
    )
    vendor_token = await register_and_login(
        client, "vendor_status@test.com", "password123", "vendor"
    )

    # Buyer creates order
    create_resp = await client.post(
        ORDERS_BASE,
        json=_checkout_payload(),
        headers=_buyer_headers(buyer_token),
    )
    assert create_resp.status_code == 201
    order_id = create_resp.json()["order_id"]

    # Vendor updates status to confirmed
    resp = await client.put(
        f"{ORDERS_BASE}/{order_id}/status",
        params={"status": "confirmed"},
        headers=_buyer_headers(vendor_token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "confirmed"
    assert data["order_id"] == order_id


@pytest.mark.asyncio
async def test_update_order_status_as_buyer_forbidden(client: AsyncClient):
    """A buyer must not be able to update order status (requires vendor/admin role)."""
    buyer_token = await register_and_login(
        client, "buyer_forbidden_status@test.com", "password123", "buyer"
    )

    # Create an order
    create_resp = await client.post(
        ORDERS_BASE,
        json=_checkout_payload(),
        headers=_buyer_headers(buyer_token),
    )
    assert create_resp.status_code == 201
    order_id = create_resp.json()["order_id"]

    # Buyer tries to update status
    resp = await client.put(
        f"{ORDERS_BASE}/{order_id}/status",
        params={"status": "confirmed"},
        headers=_buyer_headers(buyer_token),
    )
    assert resp.status_code == 403, (
        f"Buyer should not update order status, got {resp.status_code}: {resp.text}"
    )


@pytest.mark.asyncio
async def test_update_order_status_delivered_mocked_workers(client: AsyncClient):
    """
    Setting status to 'delivered' triggers Celery tasks.
    Both award_order_wk tasks are patched so no broker is needed.
    """
    buyer_token = await register_and_login(
        client, "buyer_delivered@test.com", "password123", "buyer"
    )
    vendor_token = await register_and_login(
        client, "vendor_delivered@test.com", "password123", "vendor"
    )

    create_resp = await client.post(
        ORDERS_BASE,
        json=_checkout_payload(),
        headers=_buyer_headers(buyer_token),
    )
    assert create_resp.status_code == 201
    order_id = create_resp.json()["order_id"]

    mock_task = MagicMock()
    mock_task.apply_async = MagicMock(return_value=MagicMock(id="fake-task-id"))

    with patch(
        "app.workers.gamification_worker.award_order_wk",
        mock_task,
    ):
        resp = await client.put(
            f"{ORDERS_BASE}/{order_id}/status",
            params={"status": "delivered"},
            headers=_buyer_headers(vendor_token),
        )

    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "delivered"


@pytest.mark.asyncio
async def test_update_order_status_not_found(client: AsyncClient):
    """Updating status of a non-existent order returns 404."""
    vendor_token = await register_and_login(
        client, "vendor_404@test.com", "password123", "vendor"
    )
    fake_id = str(uuid.uuid4())

    resp = await client.put(
        f"{ORDERS_BASE}/{fake_id}/status",
        params={"status": "confirmed"},
        headers=_buyer_headers(vendor_token),
    )
    assert resp.status_code == 404, resp.text


# ── Tracking ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_track_order(client: AsyncClient):
    """GET /orders/{id}/tracking returns tracking info for the order owner."""
    token = await register_and_login(
        client, "buyer_track@test.com", "password123", "buyer"
    )
    headers = _buyer_headers(token)

    create_resp = await client.post(ORDERS_BASE, json=_checkout_payload(), headers=headers)
    assert create_resp.status_code == 201
    order_id = create_resp.json()["order_id"]

    resp = await client.get(f"{ORDERS_BASE}/{order_id}/tracking", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    # Fields exist even if not yet populated
    assert "tracking_number" in data, "tracking_number key must be present"
    assert "carrier" in data, "carrier key must be present"
    assert "status" in data, "status key must be present"
    assert "history" in data, "history key must be present"
    assert isinstance(data["history"], list)
    # Newly created order should have exactly one status_history entry (pending)
    assert len(data["history"]) >= 1
    assert data["history"][0]["status"] == "pending"


@pytest.mark.asyncio
async def test_track_order_not_found(client: AsyncClient):
    """Tracking a non-existent order returns 404."""
    token = await register_and_login(
        client, "buyer_track404@test.com", "password123", "buyer"
    )
    fake_id = str(uuid.uuid4())

    resp = await client.get(
        f"{ORDERS_BASE}/{fake_id}/tracking",
        headers=_buyer_headers(token),
    )
    assert resp.status_code == 404, resp.text


@pytest.mark.asyncio
async def test_track_order_unauthenticated(client: AsyncClient):
    """GET /orders/{id}/tracking without a token must return 401."""
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"{ORDERS_BASE}/{fake_id}/tracking")
    assert resp.status_code == 401, resp.text
