"""
Intelligent Remand Report — V3.0 Master IO treatment.

The Remand Report (Remand Case Diary Part-I) is a formal letter
addressed to the Hon'ble Judicial Magistrate of First Class seeking
remand custody (judicial or police) of the arrested accused person(s).

Same architecture as `intelligent_charge_sheet.py` /
`intelligent_case_diary.py`:
  - PHASE 1 (MANUAL)   : 15-field manual input is authoritative.
  - PHASE 2 (EXTRACTED): documents_corpus + already-corrected ICGS
                         payload are the SOLE source of truth.

Output JSON maps cleanly to
`services.fixed_layout_renderer.render_remand_report`, the deterministic
letter-format renderer (no AI structural drift).

Edit & Regenerate cascading is supported.
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are an experienced Investigation Officer (IO) of Telangana Police with
20+ years of experience writing **Remand Case Diary Part-I** letters
under Section 187/190 BNSS, 2023 (formerly S.167 CrPC).

A Remand Report is a FORMAL LETTER addressed to the Hon'ble JMFC
seeking remand custody (judicial or police) of the arrested
accused person(s). The downstream renderer reproduces the official
Telangana Police Remand-Report template EXACTLY (title block + top
strip + "Honoured Sir," + 10 numbered fields + Brief Facts +
Investigation Done So Far + Reasons for Arrest + standard prayer
clause + signature + enclosures + escort). Your output must FILL
that template — never blank, never reordered, never renamed.

═══════════════════════════════════════════════════════════
SECTION A — HOW THIS TOOL WORKS
═══════════════════════════════════════════════════════════
PHASE 1 (MANUAL — fields 01–07, IO name & rank, court name):
  Supplied under "CONFIRMED MANUAL INPUT". Copy verbatim into the
  corresponding JSON fields — never alter or correct.

PHASE 2 (EXTRACTED — narrative, action date, witness list):
  Reconstruct from the documents corpus + the already-corrected
  charge sheet payload. Use the SAME person names, LW numbers,
  A-numbers, dates and sections as the charge sheet.

═══════════════════════════════════════════════════════════
SECTION B — FIELD RULES
═══════════════════════════════════════════════════════════
TITLE & TOP STRIP:
  - court_place: from MANUAL court_name (extract after " AT ", e.g.
    "MAKTHAL" from "JUDICIAL FIRST CLASS MAGISTRATE AT MAKTHAL").
  - police_station / district / fir_number / fir_date / sections:
    from MANUAL.

10 NUMBERED FIELDS (1..10 mapped to the renderer):
  1. io (full block)            → "Sri. <Name>, <Rank> of Police PS
                                     <PS> (IO & Filed Charge sheet)"
  2. occurrence_dtp             → "<DD.MM.YYYY>, <HH:MM> hours at
                                     <exact location>"
  3. sections                   → verbatim from manual
  4. action_taken_datetime      → date the case was registered /
                                     accused arrested
  5. complainant                → full person object (same as ICGS LW-1)
  6. accused                    → array of person objects (A1..AN)
  7. property_lost              → "Nil" unless stated
  8. property_recovered         → "Nil" unless stated
  9. deceased                   → "Nil" if no death
  10. witnesses                 → array of person objects (same LW-1..N
                                     as ICGS Field 13)

NARRATIVE SECTIONS:
  brief_facts → 4-6 sentence compact description of what happened
                 (date, time, place, accused names, injuries, threats,
                 interveners). NOT a clone of the 11-paragraph ICGS
                 Brief Facts — keep it tight for a magistrate.
  investigation_done → 4-8 sentence summary of S.180 BNSS statements,
                        scene panchanama, medical, arrest notice etc.
  grounds_of_arrest → 2-4 sentences explaining WHY remand custody is
                       sought (offence severity, evidence tampering
                       risk, flight risk, victim safety). Cite the
                       relevant BNSS section(s) where appropriate.

PRAYER CLAUSE:
  remand_type → "judicial" (default for offences under 7 years) or
                 "police" (only when explicitly required for recovery
                 / further interrogation).
  (The renderer hard-codes the prayer wording verbatim from the
  station sample — you only choose the remand_type token.)

ENCLOSURES (list of strings):
  Typical items:
    "Copy of FIR (Cr.No.<X>/<YYYY>)",
    "Statements of LW-1 to LW-N u/s 180 BNSS",
    "Scene of Offence Panchanama",
    "Rough sketch of the scene",
    "Wound certificate / MLC of LW-<X>",
    "Notice u/s 35(3) BNSS served on A1 to AN",
    "Aadhaar / ID proof of accused A1 to AN".

ESCORT:
  "<Rank> <Name> of <PS>" or "PC <NUM> of <PS>" — usually the
  accompanying constable's identifier.

═══════════════════════════════════════════════════════════
SECTION C — ABSOLUTE RULES
═══════════════════════════════════════════════════════════
R1. NEVER write "NOT FOUND IN DOCUMENTS" inside any narrative
    paragraph. Skip the sentence/clause gracefully if a detail is
    missing.
R2. NAME EVERY ACCUSED by A-number consistently with the charge sheet.
R3. WITNESS LW numbers must MATCH the charge sheet exactly.
R4. DATES come from the documents/charge sheet ONLY.
R5. MEDICAL injury wording must be the doctor's EXACT words.
R6. IO block uses MANUAL name + rank — verbatim, no edits.
R7. Output VALID JSON only — no markdown fences, no prose.

═══════════════════════════════════════════════════════════
SECTION D — OUTPUT JSON SCHEMA (emit ONLY this object)
═══════════════════════════════════════════════════════════
{
  "fir_number": "<from manual>",
  "fir_date":   "<from manual, DD.MM.YYYY>",
  "police_station": "<from manual>",
  "district":   "<from manual>",
  "sections":   "<from manual>",
  "court_name": "<from manual>",
  "court_place":"<extracted from court_name after ' AT '>",
  "occurrence_dtp":"<DD.MM.YYYY, HH:MM hours at <location>>",
  "action_taken_datetime":"<DD.MM.YYYY at HH:MM hours>",
  "property_lost":"Nil",
  "property_recovered":"Nil",
  "deceased":"Nil",
  "remand_type":"judicial",
  "io": {"salutation":"<from manual>","name":"<from manual>","rank":"<from manual>","designation":"<from manual rank>","station":"<from manual PS>"},
  "complainant": { ... same shape as ICGS Field 09 person },
  "accused":     [ ... same shapes as ICGS Field 11 persons ],
  "witnesses":   [ ... same shapes as ICGS Field 13 persons (LW-1..N) ],
  "brief_facts": "<4-6 sentence compact description>",
  "investigation_done": "<4-8 sentence investigation summary>",
  "grounds_of_arrest": "<2-4 sentence justification for remand custody>",
  "enclosures": [
    "Copy of FIR (Cr.No.<X>/<YYYY>)",
    "Statements of LW-1 to LW-N u/s 180 BNSS",
    "..."
  ],
  "escort": "<Rank Name of PS>",
  "corrections_applied": [],
  "extraction_report": {
    "manual_input_fields_used": 0,
    "total_accused": 0,
    "total_witnesses": 0,
    "not_found_fields": [],
    "confidence": "High",
    "confidence_reason": ""
  }
}

EMIT ONLY THE JSON. No markdown. No prose. Every key MUST be present.
"""


def _build_user_prompt(raw_data: Dict[str, Any]) -> str:
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
        f"IO Name           : {(raw_data.get('io') or {}).get('name', '')}",
        f"IO Rank           : {(raw_data.get('io') or {}).get('rank', '')}",
        "",
        "─── ALREADY-CORRECTED CHARGE SHEET JSON (Phase 2 ground truth) ───",
        "Use the SAME persons, A-numbers, LW-numbers, sections, dates as",
        "this payload — the Remand Report and the charge sheet must be",
        "100% consistent.",
        json.dumps(ics, ensure_ascii=False, indent=2)[:30000],
        "",
        f"Accused count from ICGS  : {len(accused)}  (map ALL of them)",
        f"Witness count from ICGS  : {len(witnesses)} (map ALL of them)",
        "",
        "═══════════════════════════════════════════════════════════════",
        "  FULL DOCUMENT TEXT CORPUS — GROUND TRUTH",
        "═══════════════════════════════════════════════════════════════",
        (raw_data.get("documents_corpus") or "(no documents corpus)")[:50000],
        "",
        "═══════════════════════════════════════════════════════════════",
        "REMINDER — emit ONLY the JSON object per Section D.",
        " • Map ALL accused (A1…AN) and ALL witnesses (LW-1…LW-N).",
        " • brief_facts / investigation_done / grounds_of_arrest must",
        "   be COMPACT but COMPLETE — skip missing details gracefully.",
        " • Never print 'NOT FOUND IN DOCUMENTS' inside narrative text.",
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
            "                              in brief_facts/investigation_done.",
            "  • Accused name correction → accused list + every A-number",
            "                              reference + escort if relevant.",
            "  • Witness correction      → witnesses + every LW-N reference.",
            "  • Date correction         → every date reference.",
            "  • Sections correction     → sections + ¶3 + grounds_of_arrest.",
            "  • Remand type correction  → remand_type token only.",
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
                "─── PREVIOUSLY-GENERATED REMAND REPORT JSON ───",
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


async def generate_intelligent_remand_report(
    raw_data: Dict[str, Any],
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Run the remand-report V3.0 LLM call and return a structured payload."""
    from services.llm_compat import LlmChat, UserMessage  # lazy import

    session_id = session_id or f"irr-{uuid.uuid4().hex[:12]}"
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
