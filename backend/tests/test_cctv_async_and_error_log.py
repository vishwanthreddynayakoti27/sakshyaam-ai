"""
Test the async-job version of /cctv/analyze and the frontend-error logging.
"""
import asyncio
import os
import sys
import tempfile

sys.path.insert(0, "/app/backend")

import httpx
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

API = "http://localhost:8001/api"
ADMIN = ("pc72", "Test123!")
PLATE = "TS09EA1234"


def build_video(out_path: str, duration_s: int = 4, fps: int = 8):
    width, height = 480, 360
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(out_path, fourcc, fps, (width, height))
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
    except Exception:
        font = ImageFont.load_default()
    total = duration_s * fps
    for fi in range(total):
        img = Image.new("RGB", (width, height), (45, 45, 45))
        d = ImageDraw.Draw(img)
        progress = fi / total
        car_x = int(40 + progress * (width - 240))
        d.rectangle([car_x, 160, car_x + 200, 280], fill=(160, 40, 40))
        plate_x = car_x + 40
        d.rectangle([plate_x, 220, plate_x + 130, 258], fill=(255, 220, 60), outline=(0, 0, 0), width=2)
        d.text((plate_x + 6, 224), PLATE, fill=(0, 0, 0), font=font)
        writer.write(cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR))
    writer.release()


async def login_token():
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.post(f"{API}/auth/login", json={"officer_id": ADMIN[0], "password": ADMIN[1]})
        r.raise_for_status()
        return r.json()["token"]


async def main():
    token = await login_token()
    headers = {"Authorization": f"Bearer {token}"}
    print(f"[OK] Logged in")

    # 1. Async CCTV analyze: POST returns job_id quickly, then poll status
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        vp = tmp.name
    try:
        build_video(vp)
        async with httpx.AsyncClient(timeout=60) as hc:
            with open(vp, "rb") as f:
                files = {"file": ("cam.mp4", f.read(), "video/mp4")}
            data = {"search_query": "", "search_type": "all", "sample_interval": "1.5"}
            t0 = asyncio.get_event_loop().time()
            r = await hc.post(f"{API}/cctv/analyze", files=files, data=data, headers=headers)
            r.raise_for_status()
            elapsed = asyncio.get_event_loop().time() - t0
        body = r.json()
        assert body.get("status") == "processing", f"Expected processing, got {body}"
        job_id = body["job_id"]
        # The enqueue MUST return in well under 60s (the K8s ingress timeout)
        assert elapsed < 30, f"Enqueue took {elapsed:.1f}s — too slow, would risk 502"
        print(f"[OK] /cctv/analyze enqueued in {elapsed:.2f}s, job_id={job_id[:12]}…")

        # 2. Poll status until completed
        result = None
        for i in range(40):  # 40 * 3s = 2 min max
            await asyncio.sleep(3)
            async with httpx.AsyncClient(timeout=15) as hc:
                sr = await hc.get(f"{API}/cctv/analyze/status/{job_id}", headers=headers)
                sr.raise_for_status()
                job = sr.json()
            if job["status"] == "completed":
                result = job["result"]
                print(f"[OK] Job completed after ~{(i + 1) * 3}s — {result.get('total_detections', 0)} detections")
                break
            if job["status"] == "failed":
                raise AssertionError(f"Job failed: {job.get('error')}")
            print(f"   ...polling: status={job['status']} stage={job.get('stage')} progress={job.get('progress')}")
        assert result is not None, "Job did not complete within 2 minutes"
        assert result.get("success"), f"Result not successful: {result}"
        assert result.get("total_detections", 0) > 0, "Expected non-zero detections"

        # 3. Job status returns 404 for someone else's job (RBAC)
        async with httpx.AsyncClient(timeout=10) as hc:
            wrong = await hc.get(f"{API}/cctv/analyze/status/{job_id}",
                                 headers={"Authorization": "Bearer not-a-real-token"})
        assert wrong.status_code in (401, 403, 404), f"Expected 401/403/404, got {wrong.status_code}"
        print(f"[OK] Job status protected — wrong token gets HTTP {wrong.status_code}")

        # 4. Frontend-error reporting endpoint
        async with httpx.AsyncClient(timeout=10) as hc:
            er = await hc.post(f"{API}/admin/log-frontend-error", headers=headers, json={
                "error_type": "HTTP_502",
                "message": "Request failed with status code 502 (test)",
                "url": "POST /api/cctv/analyze",
                "component": "axios",
                "status_code": 502,
                "stack": "Error: 502 at axios.js:42:12",
            })
            er.raise_for_status()
            corr = er.json()["correlation_id"]
            print(f"[OK] Frontend error logged with correlation_id={corr}")

            # 5. Admin sees it in /admin/issues (FAILED actions)
            issues = await hc.get(f"{API}/admin/issues", headers=headers)
            issues.raise_for_status()
            found = any(corr in (i.get("correlation_id") or "") for i in issues.json()["issues"])
            assert found, f"Frontend error correlation {corr} not found in /admin/issues"
            print(f"[OK] /admin/issues now contains the frontend error (FE-{corr})")

            # 6. Admin /admin/frontend-errors returns the full record
            fe = await hc.get(f"{API}/admin/frontend-errors?limit=20", headers=headers)
            fe.raise_for_status()
            entries = fe.json()["errors"]
            ours = [e for e in entries if e["id"] == corr]
            assert ours, "Frontend error not found in /admin/frontend-errors"
            assert ours[0]["status_code"] == 502
            assert "axios.js" in (ours[0]["stack"] or "")
            print(f"[OK] /admin/frontend-errors persists full stack ({len(entries)} total entries)")

        print("\nALL CCTV ASYNC + ERROR-LOG TESTS PASSED")
    finally:
        try:
            os.unlink(vp)
        except OSError:
            pass


if __name__ == "__main__":
    asyncio.run(main())
