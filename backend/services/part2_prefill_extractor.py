"""
Part-II Statements Auto-Detect Extractor (Step 0.5).

The FIR (Step 0) tells us who REGISTERED the case — usually the SHO of
the Police Station. But the chargesheet's filing IO is named on the
Part-II / endorsement page after the SHO endorses the case to a junior
officer. Sections may ALSO change between FIR registration and filing
("registered U/s 115 BNS → filed U/s 117(2) grievous hurt").

This extractor takes ONE Part-II statements PDF (which always
includes the endorsement page + S.180 BNSS statements) and lifts:
    • io_name           — the FILING IO from the endorsement page
                          ("This case is endorsed to HC 248 K Lal Singh
                           for further investigation U/s ...")
    • io_rank           — that IO's rank + belt/PC number
    • sections          — the FINAL chargesheet sections (often
                          upgraded from FIR header), formatted exactly
                          as written: "117(2), 351(2), 126(2) BNS",
                          "S.318(4) BNS r/w 3(5) BNS", "326 IPC", etc.
    • second_io_name    — set ONLY when the registering officer named
                          in the FIR header is DIFFERENT from this
                          filing IO. Empty otherwise.
    • second_io_rank    — rank + belt of the second (registering) IO.

Returns a confidence colour per field (green/yellow/empty) so the
frontend can flag uncertain extractions.

The frontend applies a STRICT overwrite rule: only auto-fill a manual
form field if the writer has NOT already edited it. Manual edits
always win.

BNSS/CrPC-AWARENESS:
    The prompt preserves the act suffix EXACTLY as it appears in the
    Part-II text — "BNS", "BNSS", "IPC", "CrPC", "POCSO Act", etc.
    No silent renaming, no auto-translation of IPC↔BNS section
    numbers. Mixed acts ("U/s 117 BNS r/w S.180 BNSS") preserved
    verbatim.
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


PART2_PREFILL_SYSTEM_PROMPT = """You are an experienced Telangana Police data-entry assistant. Your job is
to read the OCR text of a Part-II BNSS Statements document (which contains
the FIR's Part-II header + endorsement page + S.180 statements) and lift
exactly THREE high-confidence fields that may have CHANGED since the FIR
was originally registered:

    1. The FILING IO  (io_name + io_rank)
    2. The FINAL chargesheet sections
    3. (Optionally) a SECOND IO — the registering officer — if they
       are different from the filing IO

The writer has ALREADY pre-filled the form from the FIR. Your output
is used to OVERWRITE those values ONLY if (a) you found a clear,
authoritative value in the Part-II document AND (b) the writer has
not manually edited the field since the FIR pre-fill.

═══════════════════════════════════════════════════════════
WHERE TO FIND EACH FIELD
═══════════════════════════════════════════════════════════
• io_name + io_rank  — Look for an "endorsement" or "Part-II"
                       header that names a SPECIFIC officer:
                         "Endorsed to HC 248 K Lal Singh, PS Makthal,
                          for further investigation U/s 117(2) BNS"
                         "This case is taken up by SI of Police
                          B Ramesh, PS Narayanpet"
                         "Investigation Officer: ASI 1557 J Srinivas"
                       Always pick the FILING IO — the one to whom
                       the case was endorsed for charge-sheet filing.

• sections           — Read the endorsement line + the S.180
                       statement headers + any "Charge Sheet filed
                       U/s ..." line. The MOST RECENT section list
                       wins. Sections often UPGRADE from FIR to
                       chargesheet (e.g., 115 BNS → 117(2) BNS).

• second_io_name +
  second_io_rank     — Populate ONLY when the endorsement page
                       names a registering officer (typically the
                       SHO) who is DIFFERENT from the filing IO.
                       Example: "Case registered by Inspector V.
                       Kumar, endorsed to HC 248 K Lal Singh" →
                       io_name="K Lal Singh", second_io_name="V.
                       Kumar". If only one officer is named (no
                       SHO/filing distinction), leave second_io_*
                       fields empty.

═══════════════════════════════════════════════════════════
CONFIDENCE TAGGING
═══════════════════════════════════════════════════════════
For each emitted field:
  "green"   — verbatim from a clearly-labelled Part-II line
              ("Endorsed to ...", "Investigation Officer: ...",
              "Sections: ...", "U/s ..."). High certainty.
  "yellow"  — inferred / OCR-low-confidence / one of two
              candidate officers / sections derived from
              statement context rather than an explicit list.
              The writer must verify.
  ""        — field empty (Part-II did not contain a clear value).
              Do NOT emit a colour for empty fields.

═══════════════════════════════════════════════════════════
ACT-SUFFIX PRESERVATION (BNSS / CrPC / IPC aware)
═══════════════════════════════════════════════════════════
ALWAYS preserve the act suffix EXACTLY as it appears in the
Part-II text. Do NOT translate or rename:
    "117(2) BNS"      → keep "117(2) BNS"
    "326 IPC"         → keep "326 IPC" (do NOT auto-convert to BNS)
    "U/s 174 CrPC"    → keep "174 CrPC"
    "S.180 BNSS"      → keep "S.180 BNSS"
    "Sec 6 POCSO Act" → keep "Sec 6 POCSO Act"
Mixed cases preserved verbatim (e.g., "117(2) BNS r/w 3(5) BNS,
S.180 BNSS").

═══════════════════════════════════════════════════════════
HARD RULES
═══════════════════════════════════════════════════════════
1. NEVER invent or guess section numbers. If unclear, emit "".
2. NEVER guess an IO name. If the endorsement page is illegible,
   emit "" for io_name + io_rank and let the writer fill it.
3. If sections are listed in MULTIPLE places (FIR-style header,
   endorsement line, S.180 statement, charge-sheet stamp), use
   the MOST RECENT / chargesheet-filing version — typically the
   one on the charge-sheet header stamp or the most recent
   endorsement line.
4. Output ONLY the JSON object specified below. No prose, no
   markdown fences.

═══════════════════════════════════════════════════════════
OUTPUT JSON SCHEMA — emit ONLY this object
═══════════════════════════════════════════════════════════
{
  "io_name":            "",
  "io_rank":            "",
  "sections":           "",
  "second_io_name":     "",
  "second_io_rank":     "",
  "_confidence": {
    "io_name":          "green|yellow|",
    "io_rank":          "green|yellow|",
    "sections":         "green|yellow|",
    "second_io_name":   "green|yellow|",
    "second_io_rank":   "green|yellow|"
  }
}
"""


def _build_user_prompt(part2_ocr_text: str) -> str:
    return "\n".join([
        "═══════════════════════════════════════════════════════════════",
        " PART-II EXTRACTION — lift IO + sections from this Part-II PDF.",
        " The writer will review the values before they overwrite the",
        " form fields, so prefer 'yellow' over a wrong-but-confident",
        " guess. Leave fields empty if unclear.",
        "═══════════════════════════════════════════════════════════════",
        "",
        "─── PART-II OCR TEXT ───",
        (part2_ocr_text or "(empty OCR)")[:30000],
        "",
        "═══════════════════════════════════════════════════════════════",
        "REMEMBER — emit ONLY the JSON object per the schema above.",
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
    return {
        "io_name": "", "io_rank": "", "sections": "",
        "second_io_name": "", "second_io_rank": "",
        "_confidence": {},
        "_error": "Part-II extraction failed; the FIR pre-fill values stand.",
    }


async def extract_part2_prefill_fields(
    part2_ocr_text: str,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Entry point: Part-II OCR text → 5-field structured prefill dict.

    Returns a dict with keys (io_name, io_rank, sections, second_io_name,
    second_io_rank) + a `_confidence` colour map. On any failure (LLM
    down, malformed response, very short OCR) we return a safe empty
    payload so the writer can stick with the FIR pre-fill values.
    """
    if not part2_ocr_text or len(part2_ocr_text.strip()) < 50:
        return _degraded_payload()

    from services.llm_compat import LlmChat, UserMessage  # lazy import

    session_id = session_id or f"p2pre-{uuid.uuid4().hex[:12]}"
    user_prompt = _build_user_prompt(part2_ocr_text)

    try:
        chat = (
            LlmChat(api_key=None, session_id=session_id, system_message=PART2_PREFILL_SYSTEM_PROMPT)
            .with_model("openai", os.environ.get("OPENAI_DEFAULT_MODEL", "gpt-4o"))
            .with_temperature(0.0)
            .with_max_tokens(800)
        )
        resp = await chat.send_message(UserMessage(text=user_prompt))
        parsed = _extract_json_from_response(resp)
        for k in ("io_name", "io_rank", "sections",
                  "second_io_name", "second_io_rank"):
            parsed.setdefault(k, "")
        parsed.setdefault("_confidence", {})
        parsed["_session_id"] = session_id
        return parsed
    except Exception as e:
        logger.exception(f"[PART2-PREFILL] LLM call failed: {e}")
        payload = _degraded_payload()
        payload["_error"] = f"Part-II pre-fill failed: {type(e).__name__}. FIR values stand."
        return payload
