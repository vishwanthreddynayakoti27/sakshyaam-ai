"""
Multi-Camera Vehicle Tracking
==============================
Given a target plate and N CCTV clips (each from a different camera/location),
run the existing per-frame Gemini detection on each clip in parallel, filter
to only sightings of the target plate, and return a chronologically sorted
timeline so detectives can reconstruct movement.

Builds on services/cctv_search.analyze_cctv — same detection logic, just
applied across multiple inputs and merged.
"""
import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from services.cctv_search import analyze_cctv, _normalize_plate, _format_timestamp

logger = logging.getLogger(__name__)


def _fuzzy_plate_match(target: str, candidate: str, max_diff: int = 1) -> bool:
    """
    Match plates allowing up to `max_diff` character differences (handles
    OCR ambiguity like O↔0, I↔1, B↔8, S↔5 across different camera angles).
    """
    if not target or not candidate:
        return False
    t = _normalize_plate(target)
    c = _normalize_plate(candidate)
    if not t or not c:
        return False
    if t == c:
        return True
    if t in c or c in t:
        return True
    # Length must be similar
    if abs(len(t) - len(c)) > max_diff:
        return False
    # Confusable-character canonicalisation
    table = str.maketrans({"O": "0", "I": "1", "B": "8", "S": "5", "Z": "2", "G": "6", "Q": "0"})
    t2 = t.translate(table)
    c2 = c.translate(table)
    if t2 == c2:
        return True
    # Hamming distance for equal-length strings
    if len(t2) == len(c2):
        diff = sum(1 for a, b in zip(t2, c2) if a != b)
        return diff <= max_diff
    return False


async def track_vehicle_across_cameras(
    plate_text: str,
    cameras: List[Dict[str, Any]],
    sample_interval_s: float = 1.5,
    fuzzy: bool = True,
) -> Dict[str, Any]:
    """
    Args:
        plate_text: Target plate to track (normalised to uppercase, no spaces).
        cameras: list of {
            "camera_name": str,
            "location": Optional[str],
            "recording_start": Optional[ISO8601 str],
            "video_bytes": bytes,
        }
        sample_interval_s: passed to analyze_cctv per camera.
        fuzzy: allow 1-char OCR differences when matching the plate.

    Returns:
        {
          "target_plate": "...",
          "total_sightings": N,
          "cameras_with_match": M,
          "cameras": [
            {camera_name, location, recording_start, sightings_count, sightings: [...]}
          ],
          "timeline": [
            {camera_name, location, sighting_at_iso, timestamp_in_video_ms,
             timestamp_formatted, plate_text, confidence, thumbnail_base64}, ...
          ] (sorted ascending by sighting_at_iso when known, else by camera order
             then by in-video timestamp),
        }
    """
    if not plate_text or not plate_text.strip():
        raise ValueError("plate_text is required")
    if not cameras:
        raise ValueError("at least one camera clip is required")

    target = _normalize_plate(plate_text)

    # Run per-camera detections in parallel — each `analyze_cctv` already
    # parallelises across frames internally.
    async def per_camera(idx: int, cam: Dict[str, Any]):
        video_bytes = cam.get("video_bytes")
        if not video_bytes:
            return idx, cam, {"results": [], "video_duration_ms": 0, "frames_sampled": 0}
        try:
            result = await analyze_cctv(
                video_bytes=video_bytes,
                search_query=target,
                search_type="number_plate",
                sample_interval_s=sample_interval_s,
            )
            return idx, cam, result
        except Exception as e:
            logger.error(f"Camera #{idx} ({cam.get('camera_name')}) analysis failed: {e}")
            return idx, cam, {"results": [], "error": str(e)[:300], "video_duration_ms": 0}

    raw = await asyncio.gather(*[per_camera(i, c) for i, c in enumerate(cameras)])

    # Helpers
    def _iso_to_dt(s: Optional[str]) -> Optional[datetime]:
        if not s:
            return None
        try:
            # Handle "Z" suffix
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None

    cameras_out: List[Dict[str, Any]] = []
    timeline: List[Dict[str, Any]] = []

    for idx, cam, det in raw:
        camera_name = cam.get("camera_name") or f"Camera #{idx + 1}"
        location = cam.get("location") or ""
        rec_start = _iso_to_dt(cam.get("recording_start"))

        # Filter to only matches against the target plate
        sightings: List[Dict[str, Any]] = []
        for r in (det.get("results") or []):
            plate = r.get("plate_text") or r.get("ocr_text") or ""
            label = r.get("label") or ""
            ok = (
                _fuzzy_plate_match(target, plate, max_diff=1) if fuzzy
                else _normalize_plate(plate) == target
            )
            # Also try label (sometimes Gemini puts plate text in label)
            if not ok and fuzzy:
                # Look for any TS09EA1234-like substring inside label
                m = re.search(r"[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,4}", _normalize_plate(label))
                if m and _fuzzy_plate_match(target, m.group(0), max_diff=1):
                    ok = True
                    plate = m.group(0)

            if not ok:
                continue

            ts_in_video_ms = r.get("timestamp_ms", 0)
            sighting_at_iso = None
            if rec_start is not None:
                sighting_at = rec_start + timedelta(milliseconds=ts_in_video_ms)
                sighting_at_iso = sighting_at.isoformat()

            entry = {
                "camera_name": camera_name,
                "camera_index": idx,
                "location": location,
                "timestamp_in_video_ms": ts_in_video_ms,
                "timestamp_formatted": r.get("timestamp_formatted") or _format_timestamp(ts_in_video_ms),
                "sighting_at_iso": sighting_at_iso,
                "plate_text": _normalize_plate(plate) or target,
                "confidence": r.get("confidence", 0.0),
                "thumbnail_base64": r.get("thumbnail_base64"),
                "bounding_box": r.get("bounding_box"),
            }
            sightings.append(entry)
            timeline.append(entry)

        cameras_out.append({
            "camera_name": camera_name,
            "camera_index": idx,
            "location": location,
            "recording_start": cam.get("recording_start"),
            "video_duration_ms": det.get("video_duration_ms", 0),
            "frames_sampled": det.get("frames_sampled", 0),
            "sightings_count": len(sightings),
            "sightings": sightings,
            "error": det.get("error"),
        })

    # Sort timeline:
    #  1. By absolute sighting_at_iso when ALL entries have it
    #  2. Otherwise: by camera order then in-video timestamp
    has_all_iso = all(t["sighting_at_iso"] for t in timeline)
    if has_all_iso:
        timeline.sort(key=lambda t: t["sighting_at_iso"])
    else:
        timeline.sort(key=lambda t: (t["camera_index"], t["timestamp_in_video_ms"]))

    return {
        "target_plate": target,
        "fuzzy_match": fuzzy,
        "total_sightings": len(timeline),
        "cameras_with_match": sum(1 for c in cameras_out if c["sightings_count"] > 0),
        "cameras": cameras_out,
        "timeline": timeline,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
