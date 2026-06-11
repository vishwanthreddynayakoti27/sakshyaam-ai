"""
FIR Prefill Extractor.

Takes a single FIR file (PDF / image) and uses Google Vision OCR + a focused
OpenAI gpt-4o call to extract the 8 high-confidence header fields used by
the manual-input form (Fields 01-08):

  • district
  • police_station
  • fir_number
  • fir_date
  • chargesheet_no   (rarely on FIR — usually blank)
  • sections
  • report_type      ("Charge Sheet" by default)
  • chargesheet_type ("Original" by default)
  • io_name + io_rank (filing IO, or registering IO if filing IO is absent)
  • second_io_name + second_io_rank (if a second IO is named)

For each field we also emit a confidence colour (green / yellow) so the
frontend can show a yellow flag next to fields that the LLM extracted
with low certainty.

NOTE: this module does NOT touch:
  • chargesheet_date  — writer types it (today's chargesheet date)
  • dispatch_date     — writer types it
  • un_occurred_reason — case-specific
  • court_name        — frontend dropdown
  • ack_enclosed      — frontend toggle
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Tight, focused prompt — we are NOT generating a full chargesheet here,
# just lifting 8 fields off the FIR header / Part-I content.
FIR_PREFILL_SYSTEM_PROMPT = """You are an experienced Telangana Police data-entry assistant. Your job is
to read the OCR text of a single FIR (First Information Report) document and
extract EIGHT high-confidence header fields that will pre-fill the writer's
manual-input form. The writer will review your extraction before proceeding,
so it is ALWAYS better to leave a field blank than to invent a value.

═══════════════════════════════════════════════════════════
FIELDS TO EXTRACT
═══════════════════════════════════════════════════════════
01a. district          — the district name on the FIR header
                          (e.g., "Narayanpet", "Mahabubnagar").
01b. police_station    — PS name verbatim from the FIR header
                          (e.g., "Makthal", "Narayanpet Rural").
01c. fir_number        — the FIR Cr.No. WITH year, in the form
                          "<number>/<year>" (e.g., "100/2025").
01d. fir_date          — the FIR registration date in DD.MM.YYYY
                          (e.g., "23.04.2025"). If only DD-MM-YYYY or
                          YYYY-MM-DD is found, normalise to DD.MM.YYYY.
02.  chargesheet_no    — Almost NEVER on an FIR. Leave EMPTY ("") unless
                          you see "Charge Sheet Number" / "C.S.No."
                          explicitly stamped on the document.
04.  sections          — the Acts and Sections charged at registration,
                          verbatim (e.g., "115(2), 351(2), 126(2) BNS").
                          Preserve sub-section numbers, "r/w", "BNS",
                          "BNSS", "IPC", "POCSO Act" etc. exactly.
05.  report_type       — Default to "Charge Sheet". The FIR does not
                          state this — emit "Charge Sheet" always.
07.  chargesheet_type  — Default to "Original". The FIR does not state
                          this — emit "Original" always.
08a. io_name           — the FILING IO if explicitly named in the FIR.
                          Often the FIR only names the registering officer
                          (SHO). In that case, populate io_name with the
                          registering officer and the writer will edit
                          if needed.
08b. io_rank           — the rank + belt-number / PC-number of io_name
                          (e.g., "SI of Police", "HC 248", "ASI 1557").

OPTIONAL — second IO (set both fields to "" if not present):
08c. second_io_name    — when the FIR explicitly names a SECOND officer
                          who took over investigation (rare on FIR; more
                          common on Part-II header). Leave "" otherwise.
08d. second_io_rank    — rank + belt of the second IO.

═══════════════════════════════════════════════════════════
CONFIDENCE TAGGING
═══════════════════════════════════════════════════════════
For each field, emit one of:
  "green"   — value is verbatim from the FIR text, unambiguous.
  "yellow"  — value is inferred / normalised / OCR-confidence-low /
              ambiguous between two candidates. The writer must verify.
  ""        — field was not found, value is empty string. Do NOT emit
              "yellow" or "green" for empty fields.

═══════════════════════════════════════════════════════════
OUTPUT JSON SCHEMA — emit ONLY this object, no markdown fences
═══════════════════════════════════════════════════════════
{
  "district":           "",
  "police_station":     "",
  "fir_number":         "",
  "fir_date":           "",
  "chargesheet_no":     "",
  "sections":           "",
  "report_type":        "Charge Sheet",
  "chargesheet_type":   "Original",
  "io_name":            "",
  "io_rank":            "",
  "second_io_name":     "",
  "second_io_rank":     "",
  "_confidence": {
    "district":         "green|yellow|",
    "police_station":   "green|yellow|",
    "fir_number":       "green|yellow|",
    "fir_date":         "green|yellow|",
    "chargesheet_no":   "green|yellow|",
    "sections":         "green|yellow|",
    "report_type":      "green",
    "chargesheet_type": "green",
    "io_name":          "green|yellow|",
    "io_rank":          "green|yellow|",
    "second_io_name":   "green|yellow|",
    "second_io_rank":   "green|yellow|"
  }
}

═══════════════════════════════════════════════════════════
HARD RULES
═══════════════════════════════════════════════════════════
1. NEVER invent dates. If the FIR date is illegible, emit "".
2. NEVER auto-fill today's date for any field.
3. NEVER generate a chargesheet date or dispatch date — those fields
   are NOT on the FIR and are NOT in the schema above. Do not include
   them in the output.
4. When OCR has obvious garbling (e.g., "Crxx.No. 1OO/2O25"), emit a
   best-guess normalised value ("100/2025") and tag yellow.
5. report_type and chargesheet_type are always "Charge Sheet" /
   "Original" — these are not on the FIR but the manual form requires
   defaults. They are tagged "green" because they are deterministic.
6. EMIT ONLY THE JSON OBJECT. No prose, no commentary, no markdown.
"""


def _build_user_prompt(fir_ocr_text: str) -> str:
    return "\n".join([
        "═══════════════════════════════════════════════════════════════",
        " FIR PREFILL TASK — extract the 8 header fields per the schema.",
        " The writer will REVIEW the extraction in editable boxes before",
        " confirming, so prefer 'yellow' over a wrong-but-confident guess.",
        "═══════════════════════════════════════════════════════════════",
        "",
        "─── FIR OCR TEXT ───",
        (fir_ocr_text or "(empty OCR)")[:30000],
        "",
        "═══════════════════════════════════════════════════════════════",
        "REMEMBER — emit ONLY the JSON object per the Section D schema.",
        "═══════════════════════════════════════════════════════════════",
    ])


def _extract_json_from_response(text: str) -> Dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
    first = text.find("{")
    last = text.rfind("}")
    if first != -1 and last > first:
        text = text[first:last + 1]
    return json.loads(text)


def _degraded_payload() -> Dict[str, Any]:
    """Return a safe empty-form payload when the LLM call fails."""
    return {
        "district": "", "police_station": "", "fir_number": "", "fir_date": "",
        "chargesheet_no": "", "sections": "",
        "report_type": "Charge Sheet", "chargesheet_type": "Original",
        "io_name": "", "io_rank": "",
        "second_io_name": "", "second_io_rank": "",
        "_confidence": {},
        "_error": "FIR pre-fill LLM call failed; please fill the fields manually.",
    }


async def extract_fir_prefill_fields(
    fir_ocr_text: str,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Entry point: OCR text → 8-field structured prefill dict.

    Returns a dict with keys exactly matching the manual-input form
    + a `_confidence` colour map. On any failure (LLM down, malformed
    response) we return a safe empty payload so the writer can fill
    by hand.
    """
    if not fir_ocr_text or len(fir_ocr_text.strip()) < 30:
        # Nothing useful in the OCR — return safe blanks
        return _degraded_payload()

    from services.llm_compat import LlmChat, UserMessage  # lazy import

    session_id = session_id or f"firpre-{uuid.uuid4().hex[:12]}"
    user_prompt = _build_user_prompt(fir_ocr_text)

    try:
        chat = (
            LlmChat(api_key=None, session_id=session_id, system_message=FIR_PREFILL_SYSTEM_PROMPT)
            .with_model("openai", os.environ.get("OPENAI_DEFAULT_MODEL", "gpt-4o"))
            .with_temperature(0.0)
            .with_max_tokens(1200)
        )
        resp = await chat.send_message(UserMessage(text=user_prompt))
        parsed = _extract_json_from_response(resp)
        # Defensive: ensure all 12 keys present + _confidence dict
        for k in ("district", "police_station", "fir_number", "fir_date",
                  "chargesheet_no", "sections", "report_type",
                  "chargesheet_type", "io_name", "io_rank",
                  "second_io_name", "second_io_rank"):
            parsed.setdefault(k, "")
        parsed.setdefault("_confidence", {})
        # Force deterministic defaults for the two non-FIR fields
        if not parsed.get("report_type"):
            parsed["report_type"] = "Charge Sheet"
        if not parsed.get("chargesheet_type"):
            parsed["chargesheet_type"] = "Original"
        parsed["_session_id"] = session_id
        return parsed
    except Exception as e:
        logger.exception(f"[FIR-PREFILL] LLM call failed: {e}")
        payload = _degraded_payload()
        payload["_error"] = f"Pre-fill failed: {type(e).__name__}. Fill the fields manually."
        return payload
