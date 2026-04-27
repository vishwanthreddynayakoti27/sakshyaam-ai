"""
Test IMEI Linkage + Location Mapping endpoints.
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, "/app/backend")

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

API = "http://localhost:8001/api"
CASE_ID = f"TEST_IMEI_{uuid.uuid4().hex[:8]}"

# Seed CDR records
SEED = [
    # IMEI A: 3 different SIMs (HIGH suspicion - SIM swapping)
    {"phone_number": "9000000001", "called_number": "9111111111", "imei": "IMEI_DEVICE_A", "tower_id": "T01", "location": "Hyderabad", "datetime_str": "2026-04-01 10:00", "duration": "120"},
    {"phone_number": "9000000001", "called_number": "9111111112", "imei": "IMEI_DEVICE_A", "tower_id": "T01", "location": "Hyderabad", "datetime_str": "2026-04-02 11:00", "duration": "60"},
    {"phone_number": "9000000002", "called_number": "9111111113", "imei": "IMEI_DEVICE_A", "tower_id": "T02", "location": "Bangalore", "datetime_str": "2026-04-05 09:00", "duration": "90"},
    {"phone_number": "9000000003", "called_number": "9111111114", "imei": "IMEI_DEVICE_A", "tower_id": "T03", "location": "Chennai", "datetime_str": "2026-04-10 15:00", "duration": "30"},
    # IMEI B: 2 SIMs (MEDIUM)
    {"phone_number": "9888000001", "called_number": "9111111111", "imei": "IMEI_DEVICE_B", "tower_id": "T05", "location": "Mumbai", "datetime_str": "2026-04-03 12:00", "duration": "45"},
    {"phone_number": "9888000002", "called_number": "9111111112", "imei": "IMEI_DEVICE_B", "tower_id": "T05", "location": "Mumbai", "datetime_str": "2026-04-04 13:00", "duration": "60"},
    # IMEI C: 1 SIM (LOW)
    {"phone_number": "9777000001", "called_number": "9111111111", "imei": "IMEI_DEVICE_C", "tower_id": "T08", "location": "Delhi", "datetime_str": "2026-04-06 08:00", "duration": "120"},
    {"phone_number": "9777000001", "called_number": "9111111112", "imei": "IMEI_DEVICE_C", "tower_id": "T08", "location": "Delhi", "datetime_str": "2026-04-07 09:00", "duration": "100"},
]


async def main():
    client_db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "test_database")]

    # Login as TEST001
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.post(f"{API}/auth/login", json={"officer_id": "TEST001", "password": "Test123!"})
        r.raise_for_status()
        login_data = r.json()
        token = login_data["token"]
        officer_id = login_data["officer"]["officer_id"]
        print(f"[OK] Logged in as {officer_id}")

    # Clean and seed
    await client_db.cdr_records.delete_many({"case_id": CASE_ID})
    docs = [
        {"id": str(uuid.uuid4()), "officer_id": officer_id, "case_id": CASE_ID, **rec,
         "uploaded_at": datetime.now(timezone.utc).isoformat()}
        for rec in SEED
    ]
    await client_db.cdr_records.insert_many(docs)
    print(f"[OK] Seeded {len(docs)} CDR records for case {CASE_ID}")

    headers = {"Authorization": f"Bearer {token}"}

    # 1. IMEI linkage
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(f"{API}/cdr/imei-linkage/{CASE_ID}", headers=headers)
        r.raise_for_status()
        data = r.json()
        assert data["total_devices"] == 3, f"Expected 3 devices, got {data['total_devices']}"
        # Find DEVICE_A
        dev_a = next(l for l in data["linkages"] if l["imei"] == "IMEI_DEVICE_A")
        assert dev_a["distinct_sims"] == 3, f"DEVICE_A should have 3 SIMs, got {dev_a['distinct_sims']}"
        assert dev_a["suspicion"] == "HIGH", f"DEVICE_A should be HIGH risk, got {dev_a['suspicion']}"
        assert "9000000001" in dev_a["phones"]
        assert "9000000002" in dev_a["phones"]
        assert "9000000003" in dev_a["phones"]
        # DEVICE_B should be MEDIUM
        dev_b = next(l for l in data["linkages"] if l["imei"] == "IMEI_DEVICE_B")
        assert dev_b["suspicion"] == "MEDIUM"
        # DEVICE_C should be LOW
        dev_c = next(l for l in data["linkages"] if l["imei"] == "IMEI_DEVICE_C")
        assert dev_c["suspicion"] == "LOW"
        assert data["high_risk_devices"] == 1, f"Expected 1 high-risk device, got {data['high_risk_devices']}"
        print(f"[OK] IMEI linkage: {data['total_devices']} devices, "
              f"{data['high_risk_devices']} HIGH-risk (DEVICE_A flagged for SIM swap)")
        # Sorted by distinct_sims desc
        assert data["linkages"][0]["imei"] == "IMEI_DEVICE_A", "Should be sorted by distinct_sims desc"
        print("[OK] Linkages sorted by suspicion (DEVICE_A first)")

    # 2. Location map (no filter)
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(f"{API}/cdr/location-map/{CASE_ID}", headers=headers)
        r.raise_for_status()
        data = r.json()
        assert data["total_points"] > 0, "Expected location points"
        assert len(data["hotspots"]) > 0, "Expected hotspots"
        # Hyderabad should appear (DEVICE_A visited twice)
        hyd = next((h for h in data["hotspots"] if h["location"] == "Hyderabad"), None)
        assert hyd is not None, "Hyderabad hotspot missing"
        assert hyd["visit_count"] == 2
        # Mumbai (DEVICE_B with 2 distinct phones)
        mum = next((h for h in data["hotspots"] if h["location"] == "Mumbai"), None)
        assert mum is not None and mum["distinct_phones_count"] == 2
        print(f"[OK] Location map: {data['total_points']} points, "
              f"{len(data['hotspots'])} hotspots; Mumbai has 2 distinct phones")

    # 3. Location map filtered by IMEI
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(f"{API}/cdr/location-map/{CASE_ID}?imei=IMEI_DEVICE_A", headers=headers)
        r.raise_for_status()
        data = r.json()
        # DEVICE_A visited Hyderabad, Bangalore, Chennai
        locs = {h["location"] for h in data["hotspots"]}
        assert locs == {"Hyderabad", "Bangalore", "Chennai"}, f"Got {locs}"
        print(f"[OK] IMEI-filtered location map: DEVICE_A visited {sorted(locs)}")

    # 4. Location map filtered by phone
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(f"{API}/cdr/location-map/{CASE_ID}?phone=9000000001", headers=headers)
        r.raise_for_status()
        data = r.json()
        # Phone 9000000001 only seen in Hyderabad
        locs = {h["location"] for h in data["hotspots"]}
        assert locs == {"Hyderabad"}, f"Got {locs}"
        print(f"[OK] Phone-filtered location map: 9000000001 only in Hyderabad")

    # Cleanup
    await client_db.cdr_records.delete_many({"case_id": CASE_ID})
    print("\nALL IMEI LINKAGE + LOCATION MAP TESTS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
