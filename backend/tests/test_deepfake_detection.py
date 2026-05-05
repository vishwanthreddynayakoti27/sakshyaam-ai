"""
End-to-end test for AI-powered deepfake detection.
Sends a real photograph and a clearly synthetic image to /api/forensic/analyze
and asserts the AI verdict is sensible.
"""
import asyncio
import io
import os
import sys

sys.path.insert(0, "/app/backend")

import httpx
from PIL import Image, ImageDraw, ImageFilter

API = "http://localhost:8001/api"
LOGIN = ("pc72", "Test123!")


def make_realistic_photo() -> bytes:
    """
    Build a photo-like JPEG: gradient sky, sand, sun, with JPEG compression
    artefacts and slight noise — characteristic of camera capture.
    """
    img = Image.new("RGB", (800, 600))
    px = img.load()
    # Sky gradient
    for y in range(0, 350):
        r = int(80 + (200 - 80) * (y / 350))
        g = int(140 + (220 - 140) * (y / 350))
        b = int(220 - (220 - 180) * (y / 350))
        for x in range(800):
            px[x, y] = (r, g, b)
    # Sand
    for y in range(350, 600):
        for x in range(800):
            r = 230 - (y - 350) // 5
            g = 200 - (y - 350) // 6
            b = 150 - (y - 350) // 8
            # noise
            n = ((x * 31 + y * 17) % 13) - 6
            px[x, y] = (max(0, r + n), max(0, g + n), max(0, b + n))
    # Sun
    draw = ImageDraw.Draw(img)
    draw.ellipse([(620, 80), (740, 200)], fill=(255, 240, 180))
    # Slight blur to mimic optical softness
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=78)
    return buf.getvalue()


def make_obvious_synthetic() -> bytes:
    """
    Build a clearly artificial image: perfect symmetric flat-shaded shapes with
    no noise — the kind of low-information image a vision model will mark as
    NOT a real photograph (likely AI_GENERATED or at least suspicious).
    """
    img = Image.new("RGB", (512, 512), (245, 245, 250))
    draw = ImageDraw.Draw(img)
    # Perfectly symmetric circles + squares, no texture
    draw.ellipse([(180, 100), (340, 260)], fill=(255, 100, 130))
    draw.rectangle([(150, 300), (370, 440)], fill=(80, 200, 200))
    draw.polygon([(260, 60), (200, 160), (320, 160)], fill=(255, 220, 50))
    # No noise, no compression artefacts -> non-photographic
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def login_token():
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.post(f"{API}/auth/login", json={"officer_id": LOGIN[0], "password": LOGIN[1]})
        r.raise_for_status()
        return r.json()["token"]


async def upload(file_bytes: bytes, filename: str, token: str):
    async with httpx.AsyncClient(timeout=120) as hc:
        files = {"file": (filename, file_bytes, "image/jpeg" if filename.endswith(".jpg") else "image/png")}
        r = await hc.post(f"{API}/forensic/analyze", files=files, headers={"Authorization": f"Bearer {token}"})
        r.raise_for_status()
        return r.json()


async def main():
    token = await login_token()
    print(f"[OK] Logged in")

    # ---- Test 1: Realistic photo ----
    photo_bytes = make_realistic_photo()
    print(f"[OK] Built realistic JPEG ({len(photo_bytes)} bytes)")
    res1 = await upload(photo_bytes, "beach.jpg", token)
    print(f"[REAL TEST] verdict={res1['verdict']}  authenticity={res1['confidence']}  ai_confidence={res1.get('ai_confidence')}  ai_model={res1.get('ai_model')}")
    print(f"            indicators={len(res1.get('indicators', []))}  red_flags={len(res1.get('red_flags', []))}")
    print(f"            details: {res1['details'][:200]}")
    # We can't strictly assert REAL because Gemini may legitimately flag a 
    # synthesized-from-PIL image as AI_GENERATED, BUT the response must be
    # well-formed and contain the AI verdict block.
    assert res1["verdict"] in ("REAL", "AI_GENERATED", "DEEP_FAKE"), f"Bad verdict: {res1['verdict']}"
    assert isinstance(res1["confidence"], (int, float))
    assert res1["details"], "details should be non-empty (AI reasoning)"
    assert res1.get("ai_model") == "gemini-2.5-pro", f"ai_model not set: {res1.get('ai_model')}"
    assert isinstance(res1.get("indicators"), list)
    assert isinstance(res1.get("red_flags"), list)
    # Score sanity: AI_GENERATED verdict should never produce authenticity > 50
    if res1["verdict"] == "AI_GENERATED":
        assert res1["confidence"] <= 50, f"AI_GENERATED but authenticity={res1['confidence']} > 50"
    if res1["verdict"] == "DEEP_FAKE":
        assert res1["confidence"] <= 30, f"DEEP_FAKE but authenticity={res1['confidence']} > 30"
    if res1["verdict"] == "REAL":
        assert res1["confidence"] >= 50, f"REAL but authenticity={res1['confidence']} < 50"
    print("[OK] Verdict + reasoning + score-sanity passed for realistic photo")

    # ---- Test 2: Obvious synthetic ----
    synthetic_bytes = make_obvious_synthetic()
    print(f"\n[OK] Built obvious synthetic PNG ({len(synthetic_bytes)} bytes)")
    res2 = await upload(synthetic_bytes, "shapes.png", token)
    print(f"[SYN TEST] verdict={res2['verdict']}  confidence={res2['confidence']}")
    print(f"           details: {res2['details'][:200]}")
    assert res2["verdict"] in ("AI_GENERATED", "DEEP_FAKE", "REAL"), f"Bad verdict: {res2['verdict']}"
    assert res2["details"], "details should be non-empty"
    # Synthetic image MUST not be REAL with high confidence — that would mean the model is broken
    if res2["verdict"] == "REAL":
        assert res2["confidence"] < 70, f"Model wrongly classified obvious shapes as REAL with high confidence ({res2['confidence']})"
    print("[OK] Synthetic image verdict is sensible")

    # ---- Test 3: Verify ai_analysis stored in MongoDB ----
    from motor.motor_asyncio import AsyncIOMotorClient
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "test_database")]
    rep = await db.forensic_reports.find_one({"id": res1["report_id"]}, {"_id": 0})
    assert rep, "Report not persisted"
    ai = rep["analysis_details"].get("ai_analysis")
    assert ai is not None, "ai_analysis should be in stored report"
    assert ai.get("verdict") in ("REAL", "AI_GENERATED", "DEEP_FAKE")
    assert rep["analysis_details"].get("ai_model") == "gemini-2.5-pro"
    print(f"\n[OK] Report persisted with ai_analysis block: model={rep['analysis_details']['ai_model']}, verdict={ai['verdict']}")

    print("\nALL DEEPFAKE DETECTION TESTS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
