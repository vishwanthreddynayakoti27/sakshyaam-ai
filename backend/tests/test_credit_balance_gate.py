"""
Verify credit balance-floor guard on consuming endpoints.
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
LOWUSER = f"LOWBAL{uuid.uuid4().hex[:5].upper()}"
PWD = "Test123!"


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "test_database")]
    await db.officers.delete_many({"officer_id": LOWUSER})

    async with httpx.AsyncClient(timeout=15) as hc:
        # Signup
        r = await hc.post(f"{API}/auth/signup", json={
            "officer_id": LOWUSER, "name": "Low Bal", "department": "X", "rank": "Y",
            "district": "Z", "email": f"{LOWUSER.lower()}@x.com", "password": PWD,
        })
        r.raise_for_status()

        # Admin approve
        ar = await hc.post(f"{API}/auth/login", json={"officer_id": ADMIN[0], "password": ADMIN[1]})
        atoken = ar.json()["token"]
        await hc.post(f"{API}/admin/approve-user/{LOWUSER}", headers={"Authorization": f"Bearer {atoken}"})

        # Force balance to 1 (below all costs)
        await db.officers.update_one({"officer_id": LOWUSER}, {"$set": {"credits": 1}})

        # Login as low-balance user
        lr = await hc.post(f"{API}/auth/login", json={"officer_id": LOWUSER, "password": PWD})
        ltoken = lr.json()["token"]
        lh = {"Authorization": f"Bearer {ltoken}"}

        # Create a fake staged case so the fusion endpoint reaches the credit gate.
        # We use the staging upload endpoint pattern. Actually simpler: just call the
        # endpoint and expect 402 if it gets past path checks. The fusion endpoint
        # checks folder existence first, so we need real metadata. Skip — just verify
        # intelligent charge sheet which checks credits AFTER db init.
        r = await hc.post(f"{API}/staging/generate-intelligent-charge-sheet/NONEXISTENT_CASE", headers=lh)
        # Should be 402 (insufficient credits) BEFORE the 404 for missing fusion
        assert r.status_code == 402, f"Expected 402, got {r.status_code} body={r.text}"
        assert "Insufficient credits" in r.json()["detail"]
        assert "3 credits, you have 1" in r.json()["detail"]
        print(f"[OK] Intelligent charge sheet blocked at 402 with current=1<3 credits")

        # Same for case diary (cost 2)
        r = await hc.post(f"{API}/staging/generate-intelligent-case-diary/NONEXISTENT_CASE", headers=lh)
        assert r.status_code == 402, f"Expected 402, got {r.status_code}"
        assert "2 credits, you have 1" in r.json()["detail"]
        print(f"[OK] Intelligent case diary blocked at 402 with current=1<2 credits")

        # Boost balance to 2 — case diary now reaches the next check (400 for missing ICS)
        await db.officers.update_one({"officer_id": LOWUSER}, {"$set": {"credits": 2}})
        r = await hc.post(f"{API}/staging/generate-intelligent-case-diary/NONEXISTENT_CASE", headers=lh)
        assert r.status_code == 400, f"Expected 400 (missing ICS), got {r.status_code}"
        print(f"[OK] With sufficient (2) credits, balance gate passes — falls through to 400 missing ICS")

    # Cleanup
    await db.officers.delete_many({"officer_id": LOWUSER})
    print("\nALL CREDIT BALANCE-GATE TESTS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
