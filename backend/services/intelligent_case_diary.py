"""
Intelligent Case Diary Part-I — V3.0 Master IO treatment.

Same architecture as `intelligent_charge_sheet.py`:
  - PHASE 1 (MANUAL)   : 15-field manual input is authoritative.
  - PHASE 2 (EXTRACTED): the documents_corpus + the already-corrected
                         intelligent charge sheet are the SOLE source
                         of truth for everything else.

Output JSON maps cleanly to
`services.fixed_layout_renderer.render_case_diary_part1`, which is the
deterministic 8-field Telangana layout (no AI structural drift).

Edit & Regenerate cascading is supported: pass `corrections`
(+ optional `previous_payload`) and the LLM re-emits with the fix
applied across all dependent fields.
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# V3.0 Master IO system prompt for Case Diary Part-I
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are an experienced Investigation Officer (IO) of Telangana Police with
20+ years of experience writing **Case Diary Part-I** entries under
Section 192/193(8) BNSS, 2023 (formerly S.172 CrPC).

A Case Diary Part-I is the IO's CHRONOLOGICAL investigation log — every
action by the IO is recorded with date, time, place and result, in the
SAME order the actions actually happened.

The downstream renderer reproduces the official Telangana Police CD-I
template EXACTLY (header strip + 8 numbered fields + narrative
paragraphs + steps list + closing line + signature). Your output must
FILL that template — never blank, never reordered, never renamed.

═══════════════════════════════════════════════════════════
SECTION A — HOW THIS TOOL WORKS
═══════════════════════════════════════════════════════════
PHASE 1 (MANUAL — fields 01–07, IO name & rank, court name):
  Supplied under "CONFIRMED MANUAL INPUT". Copy verbatim into the
  corresponding JSON fields — never alter or correct.

PHASE 2 (EXTRACTED — narrative + chronological entries):
  Reconstruct chronologically from the documents corpus and from the
  already-corrected charge sheet payload. Use the SAME person names,
  LW numbers, A-numbers, dates and sections as the charge sheet — the
  CD and the charge sheet must be 100% consistent.

═══════════════════════════════════════════════════════════
SECTION B — FIELD RULES
═══════════════════════════════════════════════════════════
HEADER STRIP:
  - police_station / district / fir_number / sections: from MANUAL.
  - occurrence_dtp: "<DD.MM.YYYY>, <HH:MM> hours at <exact location>"
    e.g., "23.04.2025, 12:30 hours at Yellammakunta, Makthal Town".
    If both date and time are present in the docs, BOTH must appear.
  - cd_date: usually the same as the FIR date (date the IO started
    the CD on day 1). Default to manual fir_date when not stated.

NUMBERED FIELDS (1..9 mapped to the renderer):
  1. report_datetime          → "<DD.MM.YYYY> at <HH:MM> hours"
  2. complainant              → full person object (same as ICGS LW-1)
  3. accused                  → array of person objects (same A1..AN
                                 as ICGS Field 11)
  4. property_lost            → "Nil" unless stated otherwise
  5. property_recovered       → "Nil" unless stated otherwise
  6. last_cd_date             → "First CD" on day-1; otherwise the
                                 prior CD's date.
  7. deceased                 → "Nil" if there's no death.
  8. witnesses_examined       → array of person objects (same LW-1..N
                                 as ICGS Field 13).

NARRATIVE PARAGRAPH (`brief_facts`):
  A single flowing paragraph (≤ 6 sentences) that summarises WHAT
  HAPPENED and HOW the IO received the case. This is NOT a copy of
  the charge sheet's 11-paragraph Brief Facts — it is a compact CD
  summary suitable for the magistrate to skim.

INVESTIGATION STEPS (`investigation_steps`):
  An array of station-style action lines, ordered chronologically.
  Each line begins with "On <DD.MM.YYYY> at <HH:MM> hours,...".
  Typical line types:
    • "Received the complaint from LW-1 ... registered Case in
       Cr.No.<FIR>/<year> U/s <sections> and took up investigation."
    • "Issued FIR to the Hon'ble Court of JFCM <town> and to all
       concerned offices as per S.193 BNSS procedure."
    • "Visited the scene of offence at <place> in the presence of
       panch witnesses LW-X and LW-Y; conducted Scene of Offence
       Panchanama and prepared the rough sketch in the Crime Detail
       Form."
    • "Recorded the Section 180(3) BNSS statements of LW-1 (and any
       other eyewitnesses) at the scene/PS."
    • "Sent LW-1 (and any other injured) to <hospital> under
       LW-<doctor> for medical examination and wound certificate."
    • "Received the wound certificate from LW-<doctor> opining the
       injuries as <doctor's exact words>."
    • "Served notice U/s 35(3) BNSS on A1 to AN directing their
       appearance on <date> between <time> and <time> hours."
    • "Accused A1 to AN appeared at PS, voluntarily admitted guilt,
       address proofs collected, released as the offence is
       punishable with less than 7 years imprisonment."
    • "Investigation completed; charge sheet filed before the
       Hon'ble Court of JFCM <town> on <chargesheet_date>."

CLOSING:
  closing_text → exactly "Closed the CD for the day; further
  progress follows." (the renderer will italicise it).
  distribution → exactly "Copy submitted to the SDPO <district>,
  through CI of Police <circle/place> f.f.i." (renderer italicises).

═══════════════════════════════════════════════════════════
SECTION C — ABSOLUTE RULES (V4.0 AGNOSTIC CROSS-REFERENCE)
═══════════════════════════════════════════════════════════
R1. V4.0 STRICT PLACEHOLDER BAN. NEVER emit "NOT FOUND IN DOCUMENTS",
    "NOT FOUND", "N/A", "—" or any placeholder inside any narrative
    paragraph or investigation_steps entry. Before declaring any
    detail missing, scan the FULL unified corpus (FIR + S.180 BNSS
    statements + panchanama + medical reports + bail papers + Aadhaar
    + ID files) for that detail. If a specific detail is genuinely
    missing from EVERY document, SKIP that sentence or clause
    gracefully — the entry must still read like an experienced IO
    wrote it.
R2. NAME EVERY ACCUSED by A-number consistently with the charge sheet.
    If ICGS lists A1..A6, the CD must reference A1..A6, not A1 alone.
R3. WITNESS LW numbers must MATCH the charge sheet exactly (same
    LW-1 = complainant, same LW-N = filing IO). Dynamic Witness
    Compilation — iterate every "Statement of..." block in the
    corpus; emit ALL of them, never cap at LW-2.
R4. DATES come from the documents/charge sheet ONLY. Never insert
    today's date, never invent a date.
R5. MEDICAL injury wording must be the doctor's EXACT words from the
    wound certificate — never paraphrase. Scan ANY medical
    requisition / MLC / hospital report in the corpus.
R6. The IO's name and rank in field "io" must be the manual input,
    verbatim. The CD is signed by the same officer who filed the CS.
R7. EMPTY STRING ON TRUE ABSENCE: if a value is genuinely missing
    after the full cross-document scan, emit "" (empty string) for
    that JSON key — never a placeholder string.
R8. Output VALID JSON only — no markdown fences, no prose.

═══════════════════════════════════════════════════════════
SECTION D — OUTPUT JSON SCHEMA (emit ONLY this object)
═══════════════════════════════════════════════════════════
{
  "fir_number": "<from manual>",
  "fir_date":   "<from manual, DD.MM.YYYY>",
  "police_station": "<from manual>",
  "district":   "<from manual>",
  "sections":   "<from manual, verbatim>",
  "court_name": "<from manual>",
  "cd_date":    "<DD.MM.YYYY — defaults to fir_date>",
  "occurrence_dtp": "<DD.MM.YYYY, HH:MM hours at <location>>",
  "report_datetime":"<DD.MM.YYYY at HH:MM hours>",
  "last_cd_date":   "First CD",
  "property_lost":  "Nil",
  "property_recovered":"Nil",
  "deceased":       "Nil",
  "io":          {"salutation":"<from manual>","name":"<from manual>","rank":"<from manual>","designation":"<from manual>","station":"<from manual PS>"},
  "complainant": { ... same shape as ICGS Field 09 person },
  "accused":     [ ... same shapes as ICGS Field 11 persons ],
  "witnesses_examined": [ ... same shapes as ICGS Field 13 persons (LW-1..N) ],
  "brief_facts": "<single flowing paragraph (≤6 sentences) summarising what happened and how the IO took up the case>",
  "investigation_steps": [
    "On 24.04.2025 at 06:00 hours, ...",
    "On 24.04.2025 at 14:00 hours, ...",
    "On 25.04.2025 at 10:00 hours, ...",
    "..."
  ],
  "closing_text":  "Closed the CD for the day; further progress follows.",
  "distribution":  "Copy submitted to the SDPO <district>, through CI of Police <circle> f.f.i.",
  "circle":        "<from documents — circle/CI station — defaults to PS town>",
  "corrections_applied": [],
  "extraction_report": {
    "manual_input_fields_used": 0,
    "investigation_steps_count": 0,
    "total_accused": 0,
    "total_witnesses": 0,
    "not_found_fields": [],
    "confidence": "High",
    "confidence_reason": ""
  }
}

EMIT ONLY THE JSON. No markdown. No prose. Every key MUST be present.
"""


# ---------------------------------------------------------------------------
# Prompt builder + response parser
# ---------------------------------------------------------------------------
def _build_user_prompt(raw_data: Dict[str, Any]) -> str:
    """Package raw payload for the LLM — mirrors the ICGS two-phase format."""
    ics = raw_data.get("ics_structured_data") or {}
    accused = ics.get("accused") or []
    witnesses = ics.get("witnesses") or []
    corrections = raw_data.get("corrections") or []
    prev_payload = raw_data.get("previous_payload") or {}

    parts = [
        "═══════════════════════════════════════════════════════════════",
        "ISOLATION BANNER — THIS PAYLOAD IS THE ENTIRE UNIVERSE OF FACTS",
        "═══════════════════════════════════════════════════════════════",
        "You may NOT reference any case other than the one below.",
        "═══════════════════════════════════════════════════════════════",
        "",
        "─────────────── CONFIRMED MANUAL INPUT (Phase 1) ───────────────",
        f"District          : {raw_data.get('district', '')}",
        f"Police Station    : {raw_data.get('police_station', '')}",
        f"FIR Number        : {raw_data.get('fir_number', '')}",
        f"FIR Date          : {raw_data.get('fir_date', '')}",
        f"Sections          : {raw_data.get('sections', '')}",
        f"Court Name        : {raw_data.get('court_name', '')}",
        f"Chargesheet Date  : {raw_data.get('chargesheet_date', '')}",
        f"IO Name           : {(raw_data.get('io') or {}).get('name', '')}",
        f"IO Rank           : {(raw_data.get('io') or {}).get('rank', '')}",
        "",
        "─── ALREADY-CORRECTED CHARGE SHEET JSON (Phase 2 ground truth) ───",
        "Use the SAME persons, A-numbers, LW-numbers, sections, dates as",
        "this payload — the CD and the charge sheet must be 100% consistent.",
        json.dumps(ics, ensure_ascii=False, indent=2)[:30000],
        "",
        f"Accused count from ICGS  : {len(accused)}  (map ALL of them)",
        f"Witness count from ICGS  : {len(witnesses)} (map ALL of them)",
        "",
        "═══════════════════════════════════════════════════════════════",
        "  FULL DOCUMENT TEXT CORPUS — GROUND TRUTH FOR DATES & STEPS",
        "═══════════════════════════════════════════════════════════════",
        (raw_data.get("documents_corpus") or "(no documents corpus)")[:50000],
        "",
        "═══════════════════════════════════════════════════════════════",
        "REMINDER — emit ONLY the JSON object per Section D.",
        " • Map ALL accused (A1…AN) and ALL witnesses (LW-1…LW-N).",
        " • investigation_steps must be in CHRONOLOGICAL ORDER.",
        " • Skip missing details gracefully — never print",
        "   'NOT FOUND IN DOCUMENTS' inside narrative or steps.",
        "═══════════════════════════════════════════════════════════════",
    ]

    if corrections:
        parts.extend([
            "",
            "═══════════════════════════════════════════════════════════════",
            "  USER-SUPPLIED CORRECTIONS (regenerate with these applied)",
            "═══════════════════════════════════════════════════════════════",
            "Apply each correction VERBATIM and update ALL dependent fields.",
            "",
            "CASCADE RULES:",
            "  • IO name correction      → io block + every IO reference",
            "                              in brief_facts & steps.",
            "  • Accused name correction → accused list + every A-number",
            "                              reference in steps.",
            "  • Witness correction      → witnesses_examined + every LW-N",
            "                              reference in steps.",
            "  • Date correction         → every date reference (cd_date,",
            "                              occurrence_dtp, report_datetime,",
            "                              steps).",
            "  • Sections correction     → sections + every section",
            "                              reference in steps.",
            "",
            "Each correction is one line: 'Field <X>: <plain-English fix>'.",
            "After applying, populate `corrections_applied` with one entry",
            "per affected field.",
            "",
            "USER CORRECTIONS:",
        ])
        for i, corr in enumerate(corrections, 1):
            field = (corr.get("field") or "").strip()
            instr = (corr.get("instruction") or "").strip()
            parts.append(f"  {i}. {field}: {instr}")
        parts.append("")
        if prev_payload:
            parts.extend([
                "─── PREVIOUSLY-GENERATED CASE DIARY JSON ───",
                json.dumps(prev_payload, ensure_ascii=False)[:20000],
            ])
        parts.append("═══════════════════════════════════════════════════════════════")

    return "\n".join(parts)


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


# ---------------------------------------------------------------------------
# Public entry point — same signature shape as ICGS
# ---------------------------------------------------------------------------
async def generate_intelligent_case_diary(
    raw_data: Dict[str, Any],
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Run the case-diary V3.0 LLM call and return a structured payload."""
    from services.llm_compat import LlmChat, UserMessage  # lazy import

    session_id = session_id or f"icd-{uuid.uuid4().hex[:12]}"
    user_prompt = _build_user_prompt(raw_data)

    chat = (
        LlmChat(api_key=None, session_id=session_id, system_message=SYSTEM_PROMPT)
        .with_model("openai", os.environ.get("OPENAI_DEFAULT_MODEL", "gpt-4o"))
        .with_temperature(0.1)
        .with_max_tokens(8000)
    )
    resp = await chat.send_message(UserMessage(text=user_prompt))
    result = _extract_json_from_response(resp)
    result["_model_used"] = os.environ.get("OPENAI_DEFAULT_MODEL", "gpt-4o")
    result["_session_id"] = session_id
    return result
