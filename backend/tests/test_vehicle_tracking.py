"""
End-to-end test for /api/cctv/track-vehicle.
Builds 3 short synthetic videos (each from a different "camera") featuring
the target plate "TS09EA1234" + one camera with a different plate "KA01AB9999"
to verify the filter works. Asserts:
  - Multi-file upload works
  - Per-camera sighting counts are correct (target plate matches in 2 of 3)
  - Timeline is sorted by camera index + in-video timestamp
  - When recording_start metadata is provided, sighting_at_iso is filled
  - Thumbnails are real JPEGs
  - Vehicle track persisted in MongoDB
"""
import asyncio
import base64
import json
import os
import sys
import tempfile
from datetime import datetime, timezone

sys.path.insert(0, "/app/backend")

import httpx
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

API = "http://localhost:8001/api"
ADMIN = ("pc72", "Test123!")
TARGET_PLATE = "TS09EA1234"
DECOY_PLATE = "KA01AB9999"


def build_video(out_path: str, plate_text: str, duration_s: int = 4, fps: int = 8):
    width, height = 480, 360
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(out_path, fourcc, fps, (width, height))
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
    except Exception:
        font = ImageFont.load_default()
    total = duration_s * fps
    for fi in range(total):
        img = Image.new("RGB", (width, height), (50, 50, 50))
        d = ImageDraw.Draw(img)
        progress = fi / total
        car_x = int(40 + progress * (width - 240))
        d.rectangle([car_x, 160, car_x + 200, 280], fill=(160, 40, 40), outline=(255, 255, 255), width=2)
        plate_x = car_x + 40
        plate_y = 220
        d.rectangle([plate_x, plate_y, plate_x + 130, plate_y + 38], fill=(255, 220, 60), outline=(0, 0, 0), width=2)
        d.text((plate_x + 6, plate_y + 4), plate_text, fill=(0, 0, 0), font=font)
        writer.write(cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR))
    writer.release()


async def login_token():
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.post(f"{API}/auth/login", json={"officer_id": ADMIN[0], "password": ADMIN[1]})
        r.raise_for_status()
        return r.json()["token"]


async def main():
    token = await login_token()
    print(f"[OK] Logged in as {ADMIN[0]}")

    # Build 3 videos: cam-A (target), cam-B (decoy), cam-C (target again)
    paths = []
    plates = [TARGET_PLATE, DECOY_PLATE, TARGET_PLATE]
    cam_names = ["MG Road Cam", "JN Stadium Cam", "Tank Bund Cam"]
    cam_locations = ["MG Road, Hyderabad", "JN Stadium Gate", "Tank Bund Bridge"]

    # Pretend cameras recorded in this absolute order:
    base = datetime(2026, 4, 27, 18, 0, 0, tzinfo=timezone.utc)
    rec_starts = [
        base.isoformat(),
        (base.replace(minute=4)).isoformat(),
        (base.replace(minute=8)).isoformat(),
    ]

    try:
        for i, plate in enumerate(plates):
            with tempfile.NamedTemporaryFile(suffix=f"_cam{i}.mp4", delete=False) as tmp:
                p = tmp.name
            build_video(p, plate)
            paths.append(p)
        print(f"[OK] Built {len(paths)} synthetic camera clips")

        meta = [
            {"camera_name": cam_names[i], "location": cam_locations[i], "recording_start": rec_starts[i]}
            for i in range(3)
        ]

        async with httpx.AsyncClient(timeout=300) as hc:
            files = []
            file_handles = []
            for i, p in enumerate(paths):
                fh = open(p, "rb")
                file_handles.append(fh)
                files.append(("files", (f"cam{i}.mp4", fh.read(), "video/mp4")))
            for fh in file_handles:
                fh.close()
            data = {
                "plate_text": TARGET_PLATE,
                "camera_metadata": json.dumps(meta),
                "sample_interval": "1.5",
                "fuzzy": "true",
            }
            r = await hc.post(
                f"{API}/cctv/track-vehicle",
                files=files,
                data=data,
                headers={"Authorization": f"Bearer {token}"},
            )
            r.raise_for_status()
            result = r.json()

        # --- Assertions ---
        assert result["target_plate"] == TARGET_PLATE
        print(f"[OK] target_plate normalised: {result['target_plate']}")

        cams = result["cameras"]
        assert len(cams) == 3, f"Expected 3 cameras, got {len(cams)}"
        # Cam-A and Cam-C must have hits, Cam-B must have 0
        assert cams[0]["sightings_count"] >= 1, f"Cam-A should match (got {cams[0]['sightings_count']})"
        assert cams[2]["sightings_count"] >= 1, f"Cam-C should match (got {cams[2]['sightings_count']})"
        # Cam-B has decoy plate; with fuzzy match=1 char tolerance, KA01AB9999 should NOT match TS09EA1234
        assert cams[1]["sightings_count"] == 0, f"Cam-B (decoy) should have 0 matches, got {cams[1]['sightings_count']}"
        print(f"[OK] Per-camera filter: A={cams[0]['sightings_count']}, B={cams[1]['sightings_count']} (decoy), C={cams[2]['sightings_count']}")

        assert result["cameras_with_match"] == 2
        assert result["total_sightings"] == cams[0]["sightings_count"] + cams[2]["sightings_count"]
        print(f"[OK] cameras_with_match=2, total_sightings={result['total_sightings']}")

        # Timeline: chronologically sorted by sighting_at_iso (since all metadata supplied)
        timeline = result["timeline"]
        assert all(t["sighting_at_iso"] for t in timeline), "All entries should have sighting_at_iso"
        ts_iso = [t["sighting_at_iso"] for t in timeline]
        assert ts_iso == sorted(ts_iso), "Timeline must be sorted ascending by sighting_at_iso"
        print(f"[OK] Timeline sorted chronologically; first={ts_iso[0][:19]}, last={ts_iso[-1][:19]}")

        # First sighting should be from Cam-A (recorded earliest), last from Cam-C
        assert timeline[0]["camera_name"] == "MG Road Cam", f"First sighting should be MG Road Cam, got {timeline[0]['camera_name']}"
        assert timeline[-1]["camera_name"] == "Tank Bund Cam", f"Last sighting should be Tank Bund Cam, got {timeline[-1]['camera_name']}"
        print(f"[OK] Movement order: {timeline[0]['camera_name']} → {timeline[-1]['camera_name']}")

        # Thumbnails are real
        for i, t in enumerate(timeline):
            b = t.get("thumbnail_base64") or ""
            assert b, f"Timeline entry {i} missing thumbnail"
            raw = base64.b64decode(b)
            assert raw[:3] == b"\xff\xd8\xff", f"Thumb {i} not valid JPEG"
        print(f"[OK] All {len(timeline)} timeline thumbnails are valid JPEGs")

        # Persisted in MongoDB
        from motor.motor_asyncio import AsyncIOMotorClient
        db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "test_database")]
        latest = await db.vehicle_tracks.find_one(
            {"officer_id": "pc72", "target_plate": TARGET_PLATE},
            {"_id": 0}, sort=[("generated_at", -1)]
        )
        assert latest, "Vehicle track not persisted"
        assert latest["camera_count"] == 3
        assert latest["cameras_with_match"] == 2
        print(f"[OK] Vehicle track persisted: {latest['total_sightings']} sightings across {latest['cameras_with_match']}/{latest['camera_count']} cameras")

        print("\nALL VEHICLE TRACKING TESTS PASSED")

    finally:
        for p in paths:
            try:
                os.unlink(p)
            except OSError:
                pass


if __name__ == "__main__":
    asyncio.run(main())
