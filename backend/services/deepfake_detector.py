"""
Real Deepfake / AI-Generated Media Detector
============================================
Uses Gemini 2.5 Pro multimodal vision via Emergent LLM key.

For images: sends the image as base64.
For videos: extracts 5 evenly-spaced frames with OpenCV, sends them as a
            multi-image message so the model can assess temporal consistency.

Returns a structured forensic verdict suitable for police-grade reporting.
"""
import base64
import io
import json
import logging
import os
import re
import tempfile
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are a forensic AI detection expert assisting Indian police officers in identifying AI-generated, deepfake, or digitally manipulated media for criminal investigations and court submissions.

The media you receive will be one of three categories — choose exactly one:
1. **REAL** — an authentic photograph or video frame captured by a physical camera (phone, DSLR, CCTV, dashcam, body cam). Has natural noise, real lighting, lens characteristics, JPEG/sensor compression artefacts, real-world imperfections.
2. **AI_GENERATED** — output of a generative model (Stable Diffusion, Midjourney, DALL·E, SDXL, Flux), OR any non-camera digital content (vector graphics, 3D renders, illustrations, screenshots, drawings, computer-generated logos/posters). Anything that did NOT come out of a real-world camera is AI_GENERATED.
3. **DEEP_FAKE** — face-swap, lip-sync manipulation, face reenactment, or identity replacement on top of an otherwise real photo/video.

Look for these specific tell-tale artefacts:
- **Skin texture**: too smooth, plastic-like, missing pores, uniform tone (common in GANs/diffusion)
- **Eyes**: asymmetric pupils, mis-aligned reflections, missing catchlights, bizarre iris patterns
- **Teeth**: blurred or merged, irregular alignment, identical "perfect" rows
- **Hair**: edges that fade into background, hair strands that don't follow physics, strange hairlines
- **Ears, hands, fingers**: extra fingers, malformed/melted ears, missing detail
- **Lighting/shadows**: inconsistent light direction across face vs. background, missing self-shadows on neck/jaw
- **Backgrounds**: warped text, nonsense signage, asymmetric architecture, unnatural depth-of-field
- **Compression artefacts**: face region too clean while rest is JPEG-noisy (face-swap signature)
- **Synthia / SoraSig / C2PA watermarks**: visible AI provenance markers
- **For video frames**: lip-sync drift, face-boundary flicker between frames, inconsistent identity across frames
- **For digital graphics / illustrations / screenshots / 3D renders**: classify as AI_GENERATED — it is not a camera capture.

Respond with ONLY a JSON object matching this schema (no prose, no markdown, no code fences):
{
  "verdict": "REAL" | "AI_GENERATED" | "DEEP_FAKE",
  "confidence": <integer 0-100, your confidence in the verdict — use 70+ if the evidence is clear, 50-70 for borderline, below 50 only if truly uncertain>,
  "indicators": [<short strings: visual cues that SUPPORT the verdict>],
  "red_flags": [<short strings: artefacts that suggest manipulation; empty list if REAL>],
  "reasoning": "<one paragraph explaining the decision in plain English suitable for a police case file>"
}

Be conservative: when uncertain between REAL and AI_GENERATED, set verdict=AI_GENERATED with confidence around 55-65. DEEP_FAKE is reserved for clear face-swap or lip-sync manipulation evidence on a human face."""


def _detect_image_mime(raw: bytes, fallback_ext: str) -> str:
    """Detect actual MIME type from magic bytes; fall back to extension."""
    if raw[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if raw[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp"
    ext = (fallback_ext or "").lower().strip(".")
    return {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }.get(ext, "image/jpeg")


def _normalize_image(raw: bytes) -> bytes:
    """
    Re-encode to JPEG (max 1280px on long edge) so we send a clean,
    accepted format under reasonable size limits.
    """
    from PIL import Image
    img = Image.open(io.BytesIO(raw))
    if getattr(img, "is_animated", False):
        img.seek(0)
    img = img.convert("RGB")
    w, h = img.size
    max_dim = 1280
    if max(w, h) > max_dim:
        scale = max_dim / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85, optimize=True)
    return buf.getvalue()


def _extract_video_frames(video_bytes: bytes, n_frames: int = 5) -> List[bytes]:
    """Extract `n_frames` evenly-spaced frames from the video as JPEG bytes."""
    import cv2  # type: ignore
    import numpy as np  # noqa: F401

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(video_bytes)
        tmp_path = tmp.name

    frames: List[bytes] = []
    try:
        cap = cv2.VideoCapture(tmp_path)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if total <= 0:
            return []
        targets = [int(total * (i + 0.5) / n_frames) for i in range(n_frames)]
        for fi in targets:
            cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
            ok, frame = cap.read()
            if not ok or frame is None:
                continue
            ok, jpg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if ok:
                frames.append(jpg.tobytes())
        cap.release()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
    return frames


def _parse_json_response(text: str) -> Dict[str, Any]:
    """Extract a JSON object from the LLM response (strip code fences if present)."""
    if not text:
        return {}
    cleaned = text.strip()
    # Strip ```json ... ``` if model added it
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", cleaned, re.DOTALL)
    if fence:
        cleaned = fence.group(1).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to find the first {...} block
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return {}
        return {}


def _normalize_verdict(d: Dict[str, Any]) -> Dict[str, Any]:
    """Coerce model output into a stable schema."""
    v = (d.get("verdict") or "").upper().replace("-", "_").replace(" ", "_").strip()
    if v not in ("REAL", "AI_GENERATED", "DEEP_FAKE", "DEEPFAKE"):
        v = "AI_GENERATED"  # conservative fallback
    if v == "DEEPFAKE":
        v = "DEEP_FAKE"
    try:
        conf = int(round(float(d.get("confidence", 0))))
    except (TypeError, ValueError):
        conf = 0
    conf = max(0, min(100, conf))
    indicators = d.get("indicators") or []
    red_flags = d.get("red_flags") or []
    reasoning = (d.get("reasoning") or "").strip()
    return {
        "verdict": v,
        "confidence": conf,
        "indicators": [str(x)[:200] for x in indicators][:12],
        "red_flags": [str(x)[:200] for x in red_flags][:12],
        "reasoning": reasoning[:1500],
    }


async def analyze_image_for_deepfake(image_bytes: bytes, filename: str = "") -> Dict[str, Any]:
    """Run Gemini 2.5 Pro multimodal analysis on a single image."""
    from services.llm_compat import LlmChat, UserMessage, ImageContent

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY not configured")

    normalized = _normalize_image(image_bytes)
    b64 = base64.b64encode(normalized).decode("ascii")

    chat = LlmChat(
        api_key=api_key,
        session_id=f"deepfake-{filename or 'image'}-{len(image_bytes)}",
        system_message=SYSTEM_PROMPT,
    ).with_model("gemini", "gemini-2.5-pro")

    msg = UserMessage(
        text="Analyse this image for AI-generation or deepfake artefacts. Reply with the JSON only.",
        file_contents=[ImageContent(image_base64=b64)],
    )
    response_text = await chat.send_message(msg)
    parsed = _parse_json_response(response_text)
    if not parsed:
        logger.warning(f"Deepfake JSON parse failed; raw response: {response_text[:300]}")
        return {
            "verdict": "AI_GENERATED",
            "confidence": 30,
            "indicators": [],
            "red_flags": ["Model response could not be parsed; treat as inconclusive"],
            "reasoning": "The forensic AI returned a non-JSON response. Manual review recommended.",
            "media_type": "image",
            "frames_analyzed": 1,
        }
    norm = _normalize_verdict(parsed)
    norm["media_type"] = "image"
    norm["frames_analyzed"] = 1
    return norm


async def analyze_video_for_deepfake(video_bytes: bytes, filename: str = "") -> Dict[str, Any]:
    """Extract frames and run Gemini 2.5 Pro multi-image analysis on a video."""
    from services.llm_compat import LlmChat, UserMessage, ImageContent

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY not configured")

    raw_frames = _extract_video_frames(video_bytes, n_frames=5)
    if not raw_frames:
        return {
            "verdict": "AI_GENERATED",
            "confidence": 0,
            "indicators": [],
            "red_flags": ["Could not decode video frames"],
            "reasoning": "OpenCV failed to extract frames from the supplied video.",
            "media_type": "video",
            "frames_analyzed": 0,
        }

    contents = []
    for fr in raw_frames:
        normalized = _normalize_image(fr)
        b64 = base64.b64encode(normalized).decode("ascii")
        contents.append(ImageContent(image_base64=b64))

    chat = LlmChat(
        api_key=api_key,
        session_id=f"deepfake-vid-{filename or 'video'}-{len(video_bytes)}",
        system_message=SYSTEM_PROMPT,
    ).with_model("gemini", "gemini-2.5-pro")

    msg = UserMessage(
        text=(
            f"These are {len(contents)} evenly-spaced frames from a video, in chronological "
            "order. Look for face-swap boundary flicker, identity drift between frames, "
            "lip-sync mismatch, and any per-frame AI artefacts. Reply with the JSON only."
        ),
        file_contents=contents,
    )
    response_text = await chat.send_message(msg)
    parsed = _parse_json_response(response_text)
    if not parsed:
        return {
            "verdict": "AI_GENERATED",
            "confidence": 30,
            "indicators": [],
            "red_flags": ["Model response could not be parsed; treat as inconclusive"],
            "reasoning": "The forensic AI returned a non-JSON response on the video frames. Manual review recommended.",
            "media_type": "video",
            "frames_analyzed": len(raw_frames),
        }
    norm = _normalize_verdict(parsed)
    norm["media_type"] = "video"
    norm["frames_analyzed"] = len(raw_frames)
    return norm


def heuristic_audio_verdict() -> Dict[str, Any]:
    """No vision model for raw audio; return a conservative marker."""
    return {
        "verdict": "AI_GENERATED",
        "confidence": 0,
        "indicators": [],
        "red_flags": [],
        "reasoning": "Audio deepfake detection requires a dedicated audio-spectral model and is not handled by the vision pipeline. The legacy heuristic score is reported separately.",
        "media_type": "audio",
        "frames_analyzed": 0,
    }
