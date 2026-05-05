"""
Real CCTV Search — vehicle / person / number-plate detection per frame
using Gemini 2.5 Flash multimodal vision (parallelised).

Replaces the previous mock random-detection path. Returns millisecond-precise
timestamps + base64 JPEG thumbnails so the frontend can:
  - jump the <video> element to the exact moment of detection
  - search for a real Indian registration plate (e.g. "TS09EA1234") and find it
  - render a reliable preview thumbnail in the result list
"""
import asyncio
import base64
import io
import json
import logging
import os
import re
import tempfile
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Indian-style plate matcher: 2 letters - 2 digits - 1-2 letters - 4 digits.
# Tolerant to spaces / dashes / case.
PLATE_RE = re.compile(r"\b([A-Z]{2})[\s-]?(\d{1,2})[\s-]?([A-Z]{1,3})[\s-]?(\d{3,4})\b")

# Detection prompt — strict JSON, focused on what police actually need
SYSTEM_PROMPT = """You are a CCTV forensic-vision analyst assisting Indian police.

Look at the supplied frame and report every clearly visible:
  - vehicle (car, truck, motorcycle, auto-rickshaw, bus, van, scooter, bicycle)
  - person (walking, running, standing, group)
  - number plate / registration plate (Indian format like TS09EA1234, KA01MJ4567)

For each number plate, OCR the text EXACTLY as visible. Use only A-Z and 0-9, no spaces. If the plate is partially occluded, give the best-effort string and lower the confidence accordingly.

Respond with ONLY a JSON object (no prose, no markdown, no code fences):
{
  "detections": [
    {
      "object_type": "vehicle" | "person" | "number_plate",
      "label": "<short label e.g. 'Red Maruti Swift', 'Person walking', 'TS09EA1234'>",
      "confidence": <integer 0-100>,
      "plate_text": "<plate text in CAPS, no spaces; only when object_type is number_plate; null otherwise>",
      "bbox": {"x": <0-100 pct from left>, "y": <0-100 pct from top>, "w": <0-100 pct width>, "h": <0-100 pct height>}
    }
  ]
}

If nothing relevant is visible, return {"detections": []}."""


def _normalize_plate(text: str) -> str:
    """Uppercase, strip non-alphanumeric, collapse spaces."""
    if not text:
        return ""
    cleaned = re.sub(r"[^A-Za-z0-9]", "", text).upper()
    return cleaned


def _extract_frames_with_thumbs(video_bytes: bytes, sample_interval_s: float = 1.5,
                                thumb_max_dim: int = 320) -> List[Dict[str, Any]]:
    """
    Sample frames from the video at `sample_interval_s` seconds and return:
      [{timestamp_ms, frame_jpeg, thumb_jpeg_b64}, ...]
    Thumbnail is downscaled to ~320px for transmission; full frame is sent to LLM.
    """
    import cv2  # type: ignore
    from PIL import Image  # type: ignore

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(video_bytes)
        tmp_path = tmp.name

    out: List[Dict[str, Any]] = []
    try:
        cap = cv2.VideoCapture(tmp_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration_ms = int((total_frames / fps) * 1000) if fps > 0 else 0
        if total_frames <= 0:
            return []

        step_frames = max(1, int(round(fps * sample_interval_s)))
        for fi in range(0, total_frames, step_frames):
            cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
            ok, frame = cap.read()
            if not ok or frame is None:
                continue
            timestamp_ms = int((fi / fps) * 1000) if fps > 0 else 0

            # Encode FULL frame for LLM analysis
            ok2, fjpg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not ok2:
                continue

            # Build thumbnail (smaller)
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil = Image.fromarray(rgb)
            w, h = pil.size
            if max(w, h) > thumb_max_dim:
                scale = thumb_max_dim / max(w, h)
                pil = pil.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
            buf = io.BytesIO()
            pil.save(buf, format="JPEG", quality=70, optimize=True)
            thumb_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

            out.append({
                "timestamp_ms": timestamp_ms,
                "frame_jpeg": fjpg.tobytes(),
                "thumb_b64": thumb_b64,
            })
        cap.release()
        # Stash duration on the first item for easy retrieval
        if out:
            out[0]["_video_duration_ms"] = duration_ms
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
    return out


def _format_timestamp(ms: int) -> str:
    s = ms // 1000
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}.{ms % 1000:03d}"


def _parse_json(text: str) -> Dict[str, Any]:
    if not text:
        return {}
    cleaned = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", cleaned, re.DOTALL)
    if fence:
        cleaned = fence.group(1).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return {}
    return {}


async def _analyze_one_frame(api_key: str, frame_jpeg: bytes, frame_idx: int) -> Dict[str, Any]:
    """Send a single frame to Gemini 2.5 Flash and parse detections."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

    b64 = base64.b64encode(frame_jpeg).decode("ascii")
    chat = LlmChat(
        api_key=api_key,
        session_id=f"cctv-frame-{frame_idx}",
        system_message=SYSTEM_PROMPT,
    ).with_model("gemini", "gemini-2.5-flash")

    msg = UserMessage(
        text="Analyse this CCTV frame. Reply with the JSON only.",
        file_contents=[ImageContent(image_base64=b64)],
    )
    try:
        response_text = await chat.send_message(msg)
        parsed = _parse_json(response_text)
        return parsed if isinstance(parsed, dict) else {}
    except Exception as e:
        logger.warning(f"CCTV frame {frame_idx} analysis failed: {e}")
        return {}


async def analyze_cctv(
    video_bytes: bytes,
    search_query: str = "",
    search_type: str = "all",
    sample_interval_s: float = 1.5,
    max_concurrent: int = 6,
) -> Dict[str, Any]:
    """
    Sample frames + run Gemini detection in parallel + filter by search query.
    Returns the same shape the existing /cctv/analyze endpoint returned, but
    with REAL data and base64 thumbnails.
    """
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY not configured")

    samples = _extract_frames_with_thumbs(video_bytes, sample_interval_s=sample_interval_s)
    if not samples:
        return {"success": False, "error": "Could not decode video", "results": [],
                "video_duration_ms": 0, "total_detections": 0}

    duration_ms = samples[0].get("_video_duration_ms", 0)

    # Parallelise Gemini calls in batches of `max_concurrent` to be respectful
    sem = asyncio.Semaphore(max_concurrent)

    async def bounded(idx: int, sample: Dict[str, Any]):
        async with sem:
            data = await _analyze_one_frame(api_key, sample["frame_jpeg"], idx)
            return idx, data

    parsed_per_frame = await asyncio.gather(
        *[bounded(i, s) for i, s in enumerate(samples)]
    )

    # Build flattened detection list
    query_norm = _normalize_plate(search_query) if search_query else ""
    query_lower = (search_query or "").strip().lower()
    results: List[Dict[str, Any]] = []

    for idx, parsed in parsed_per_frame:
        sample = samples[idx]
        for det in parsed.get("detections", []) or []:
            try:
                obj_type = (det.get("object_type") or "").lower().strip()
                if obj_type not in ("vehicle", "person", "number_plate"):
                    continue
                # Filter by search_type
                if search_type != "all" and search_type != obj_type:
                    continue

                label = str(det.get("label") or "").strip()[:120]
                conf = int(det.get("confidence") or 0)
                conf_clamped = max(0, min(100, conf))
                plate_text = det.get("plate_text")
                if plate_text:
                    plate_text = _normalize_plate(plate_text)
                # Some models return plate text even on vehicle objects — treat it as plate too
                if not plate_text and obj_type == "number_plate":
                    plate_text = _normalize_plate(label)

                # Apply user search query — match against label OR plate text
                if query_lower:
                    haystack = (label or "").lower()
                    plate_match = bool(query_norm) and bool(plate_text) and (
                        query_norm in plate_text or plate_text in query_norm
                    )
                    label_match = query_lower in haystack
                    if not (label_match or plate_match):
                        continue

                bbox = det.get("bbox") or {}
                ts_ms = sample["timestamp_ms"]
                results.append({
                    "timestamp_ms": ts_ms,
                    "timestamp_formatted": _format_timestamp(ts_ms),
                    "object_type": obj_type,
                    "label": label or obj_type,
                    "confidence": round(conf_clamped / 100.0, 3),
                    "ocr_text": plate_text,
                    "plate_text": plate_text,
                    "thumbnail_base64": sample["thumb_b64"],
                    "bounding_box": {
                        "x": int(bbox.get("x", 0) or 0),
                        "y": int(bbox.get("y", 0) or 0),
                        "width": int(bbox.get("w", 0) or 0),
                        "height": int(bbox.get("h", 0) or 0),
                    },
                })
            except Exception as e:
                logger.debug(f"Skipping malformed detection: {e}")

    results.sort(key=lambda r: r["timestamp_ms"])

    return {
        "success": True,
        "video_duration_ms": duration_ms,
        "frames_sampled": len(samples),
        "total_detections": len(results),
        "results": results,
        "search_query": search_query,
        "search_type": search_type,
    }


async def extract_thumbnail(video_bytes: bytes, timestamp_ms: int,
                            max_dim: int = 720) -> Optional[str]:
    """Extract a single high-res frame at `timestamp_ms` and return base64 JPEG."""
    import cv2  # type: ignore

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(video_bytes)
        tmp_path = tmp.name
    try:
        cap = cv2.VideoCapture(tmp_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        target_frame = int((timestamp_ms / 1000.0) * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
        ok, frame = cap.read()
        cap.release()
        if not ok or frame is None:
            return None
        h, w = frame.shape[:2]
        if max(w, h) > max_dim:
            scale = max_dim / max(w, h)
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        ok, jpg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 88])
        if not ok:
            return None
        return base64.b64encode(jpg.tobytes()).decode("ascii")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
