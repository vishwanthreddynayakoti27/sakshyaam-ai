"""
Integration test: registration approval gate + manual credit grant + Stripe checkout + status polling.
"""
import asyncio
import os
import sys
import uuid

sys.path.insert(0, "/app/backend")

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

API = "http://localhost:8001/api"
ADMIN = ("pc72", "Test123!")
NEW_USER = f"TESTNEW{uuid.uuid4().hex[:6].upper()}"
NEW_PWD = "Test123!"


async def login(officer_id: str, password: str):
    async with httpx.AsyncClient(timeout=15) as hc:
        return await hc.post(f"{API}/auth/login", json={"officer_id": officer_id, "password": password})


async def admin_token():
    r = await login(*ADMIN)
    r.raise_for_status()
    return r.json()["token"]


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "test_database")]

    # Cleanup
    await db.officers.delete_many({"officer_id": NEW_USER})
    await db.payment_transactions.delete_many({"officer_id": NEW_USER})
    await db.credit_grants.delete_many({"officer_id": NEW_USER})

    # 1. Signup as new user → returns PENDING, NO token issued
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.post(f"{API}/auth/signup", json={
            "officer_id": NEW_USER,
            "name": "Test User",
            "department": "Police",
            "rank": "Constable",
            "district": "Hyderabad",
            "email": f"{NEW_USER.lower()}@test.com",
            "password": NEW_PWD,
        })
        r.raise_for_status()
        signup_data = r.json()
        assert signup_data.get("approval_status") == "PENDING", f"Expected PENDING, got {signup_data}"
        assert "token" not in signup_data, "Signup must NOT issue token before approval"
        print(f"[OK] Signup returns PENDING — no token issued")

    # 2. Login attempt with PENDING account → 403
    r = await login(NEW_USER, NEW_PWD)
    assert r.status_code == 403, f"Expected 403 for pending login, got {r.status_code}"
    assert "pending" in r.json().get("detail", "").lower()
    print(f"[OK] Login blocked with 403 for PENDING account")

    # 3. Admin approves → grants 20 trial credits
    atoken = await admin_token()
    headers = {"Authorization": f"Bearer {atoken}"}
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.post(f"{API}/admin/approve-user/{NEW_USER}", headers=headers)
        r.raise_for_status()
        approve_data = r.json()
        assert approve_data.get("trial_credits_granted") == 20, f"Expected 20 trial credits, got {approve_data}"
        print(f"[OK] Admin approval granted 20 trial credits")

    # 4. Login now succeeds and returns credits=20
    r = await login(NEW_USER, NEW_PWD)
    r.raise_for_status()
    login_data = r.json()
    user_token = login_data["token"]
    assert login_data["officer"]["credits"] == 20, f"Expected 20 credits, got {login_data['officer']['credits']}"
    assert login_data["officer"]["approval_status"] == "APPROVED"
    print(f"[OK] Approved user logs in with 20 credits")

    # 5. List credit packs (public)
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(f"{API}/credits/packs")
        r.raise_for_status()
        packs_data = r.json()
        pack_ids = {p["id"] for p in packs_data["packs"]}
        assert pack_ids == {"starter", "pro", "agency"}, f"Got {pack_ids}"
        # Validate amounts are server-side
        starter = next(p for p in packs_data["packs"] if p["id"] == "starter")
        assert starter["amount"] == 499.00 and starter["credits"] == 100
        print(f"[OK] Credit packs listed: {sorted(pack_ids)}; starter=₹499 for 100 credits")

    # 6. Create checkout — using starter pack
    user_headers = {"Authorization": f"Bearer {user_token}"}
    async with httpx.AsyncClient(timeout=20) as hc:
        r = await hc.post(
            f"{API}/payments/checkout",
            headers=user_headers,
            json={"pack_id": "starter", "origin_url": "https://example.com"},
        )
        r.raise_for_status()
        checkout_data = r.json()
        session_id = checkout_data["session_id"]
        assert checkout_data["url"].startswith("https://"), f"Bad URL: {checkout_data['url']}"
        assert checkout_data["amount"] == 499.00
        assert checkout_data["credits"] == 100
        print(f"[OK] Checkout session created: {session_id[:30]}... amount=₹499 credits=100")

    # 7. Verify transaction persisted as INITIATED with credits_applied=False
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    assert txn["status"] == "INITIATED"
    assert txn["credits_applied"] is False
    assert txn["officer_id"] == NEW_USER
    assert txn["credits"] == 100
    print(f"[OK] Transaction persisted: status=INITIATED credits_applied=False")

    # 8. Frontend tampering protection — custom amount manipulation
    async with httpx.AsyncClient(timeout=20) as hc:
        # Try below minimum
        r = await hc.post(
            f"{API}/payments/checkout",
            headers=user_headers,
            json={"custom_credits": 10, "origin_url": "https://example.com"},
        )
        assert r.status_code == 400, f"Expected 400 for too-few credits, got {r.status_code}"
        # Try above maximum
        r = await hc.post(
            f"{API}/payments/checkout",
            headers=user_headers,
            json={"custom_credits": 999999, "origin_url": "https://example.com"},
        )
        assert r.status_code == 400, f"Expected 400 for too-many credits, got {r.status_code}"
        print(f"[OK] Custom credits range enforced (min={50} max={10000})")

    # 9. Custom credits valid path
    async with httpx.AsyncClient(timeout=20) as hc:
        r = await hc.post(
            f"{API}/payments/checkout",
            headers=user_headers,
            json={"custom_credits": 200, "origin_url": "https://example.com"},
        )
        r.raise_for_status()
        custom_data = r.json()
        # 200 credits × ₹5 = ₹1000
        assert custom_data["amount"] == 1000.00, f"Expected ₹1000, got {custom_data['amount']}"
        assert custom_data["credits"] == 200
        print(f"[OK] Custom 200 credits → ₹1000.00 (server-computed, frontend cannot override)")

    # 10. Admin manual credit grant
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.post(
            f"{API}/admin/grant-credits/{NEW_USER}",
            headers=headers,
            json={"amount": 50, "reason": "Pilot agency rollout"},
        )
        r.raise_for_status()
        grant_data = r.json()
        assert grant_data["amount_changed"] == 50
        assert grant_data["new_balance"] == 70  # 20 trial + 50 grant
        print(f"[OK] Manual grant: 50 credits, new balance = {grant_data['new_balance']}")

    # 11. Grant history visible to admin
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(f"{API}/admin/credit-grants?officer_id={NEW_USER}", headers=headers)
        r.raise_for_status()
        grants = r.json()["grants"]
        assert len(grants) == 1 and grants[0]["amount"] == 50 and grants[0]["granted_by"] == "pc72"
        print(f"[OK] Credit grant audit log persisted with admin attribution")

    # 12. Negative grant (revoke) — guard prevents balance going negative
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.post(
            f"{API}/admin/grant-credits/{NEW_USER}",
            headers=headers,
            json={"amount": -200, "reason": "Test revoke"},
        )
        assert r.status_code == 400, f"Expected 400 for negative-balance revoke, got {r.status_code}"
        # Allowed revoke
        r = await hc.post(
            f"{API}/admin/grant-credits/{NEW_USER}",
            headers=headers,
            json={"amount": -10, "reason": "Test revoke"},
        )
        r.raise_for_status()
        assert r.json()["new_balance"] == 60
        print(f"[OK] Revoke logic — over-revoke rejected, valid revoke applied (60 left)")

    # 13. Non-admin cannot grant credits
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.post(
            f"{API}/admin/grant-credits/{NEW_USER}",
            headers=user_headers,
            json={"amount": 100},
        )
        assert r.status_code in (401, 403), f"Expected forbidden, got {r.status_code}"
        print(f"[OK] Non-admin grant blocked (HTTP {r.status_code})")

    # 14. Admin rejects a different new user → login forbidden with REJECTED message
    REJECTED_USER = f"TESTREJ{uuid.uuid4().hex[:6].upper()}"
    async with httpx.AsyncClient(timeout=15) as hc:
        await hc.post(f"{API}/auth/signup", json={
            "officer_id": REJECTED_USER, "name": "Rej", "department": "X", "rank": "Y",
            "district": "Z", "email": f"{REJECTED_USER.lower()}@x.com", "password": NEW_PWD,
        })
        r = await hc.post(f"{API}/admin/reject-user/{REJECTED_USER}", headers=headers)
        r.raise_for_status()
    r = await login(REJECTED_USER, NEW_PWD)
    assert r.status_code == 403 and "rejected" in r.json()["detail"].lower()
    print(f"[OK] Rejected users get clear 'rejected' error on login")

    # Cleanup
    await db.officers.delete_many({"officer_id": {"$in": [NEW_USER, REJECTED_USER]}})
    await db.payment_transactions.delete_many({"officer_id": NEW_USER})
    await db.credit_grants.delete_many({"officer_id": NEW_USER})
    print("\nALL CREDIT/PAYMENT TESTS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
