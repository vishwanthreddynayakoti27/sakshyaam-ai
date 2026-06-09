"""
Intelligent Charge Sheet Generator.

Thinks like an experienced station writer:
  1. Ingests raw (possibly jumbled) case data.
  2. Detects & corrects misclassifications — e.g. complainant listed as accused,
     jumbled name/age/caste fields, 1118 instead of 118 in section numbers.
  3. Validates BNS/BNSS section numbers against the fact narrative.
  4. Assigns LW- numbers correctly (complainant/injured first, then other
     eyewitnesses, then panches, then medical officer, then IO).
  5. Composes a flowing Brief Facts narrative in proper station-writer tone.
  6. Returns a structured dict that downstream code renders to DOCX.

The whole validation + composition happens in a SINGLE Claude Sonnet 4.5 call
with strict JSON output — simpler, faster, cheaper than multi-step chains.
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# System prompt: the LLM is primed as a senior station writer
SYSTEM_PROMPT = """You are a senior police station writer in Telangana, India, with 25+ years of experience drafting charge sheets in the Makthal/Narayanpet format. You know BNS (Bharatiya Nyaya Sanhita, 2023) and BNSS (Bharatiya Nagarik Suraksha Sanhita, 2023) thoroughly.

You are given RAW case data that may be incomplete, jumbled, or contain misclassifications (e.g., complainant wrongly listed as accused, jumbled ages/castes/names, typos in section numbers like 1118 instead of 118, garbled OCR fragments).

Your job: produce a CLEAN, STRUCTURED JSON object that a clerk can plug into a DOCX template to produce a proper charge sheet.

============================================================
7-STEP PIPELINE (apply in order, silently — do NOT narrate):
============================================================

STEP 1 — INGEST: Read every field in the raw payload. Pay special attention to the `brief_facts` / `raw_narrative` — it is the ground truth. When a structured field disagrees with the narrative, TRUST THE NARRATIVE.

STEP 2 — ROLE RESOLUTION: From the narrative, identify who was injured / who suffered the wrong → that person is the COMPLAINANT (LW-1). The people who caused the wrong are the ACCUSED. If a structured field places the complainant in the accused list (or vice-versa), MOVE them to the correct role. Never leave the same person in both lists.

STEP 3 — ENTITY CLEANUP:
  - Drop garbled rows ("tances from you", non-name tokens, impossible ages like "1 years" for an adult).
  - De-duplicate: if two accused rows share the same father's name AND address AND phone, keep only one.
  - Cross-verify caste / occupation — if the same person appears twice with different values, keep the one that matches the narrative.
  - Use gender-appropriate salutation: "Sri." for males, "Smt." for females. Infer from name if needed (e.g., "Bhagya Lakshmi" is female → Smt.).

STEP 4 — SECTION CORRECTION:
  - Fix obvious typos: "1118(2)" → "118(2)", "35 3" → "35(3)", etc.
  - Keep ONLY the sections that describe the actual offence (based on narrative). Drop procedural/administrative references like 180(3) BNSS, 35(3) BNSS, 193 BNSS from the offence line — those belong in procedure notes, not in the charged sections.
  - Common BNS mapping reference (use narrative to pick):
      * 115(2) BNS = voluntarily causing hurt
      * 118(1)/(2) BNS = voluntarily causing hurt by dangerous weapons/means
      * 352 BNS = intentional insult with intent to provoke breach of peace
      * 3(5) BNS = common intention (add when ≥2 accused acted together)
      * 303/305 BNS = theft related
      * 309 BNS = robbery
      * 296 BNS = obscene acts
  - Format: "118(2), 115(2), 352 R/w 3(5) BNS" — comma-separated, "R/w" before the common-intention clause.

STEP 5 — WITNESS RE-NUMBERING (canonical order):
  LW-1 = complainant / injured / principal victim
  LW-2 = circumstantial witness closest to LW-1 (family member who arrived right after, etc.)
  LW-3, LW-4, ... = eyewitnesses in order of proximity to the incident
  LW-n, LW-n+1 = scene-of-offence panch witnesses (exactly 2)
  LW-n+2 = medical officer (doctor who treated injured & issued wound certificate)
  LW-last = the Investigating Officer (IO)
  Assign roles crisply: "Complainant and Injured", "Cir witness and father of LW-1", "Eyewitness", "Panch for Scene of offence", "Treated the injured/LW-1, issued wound certificate", "IO and field charge sheet".

STEP 6 — BRIEF FACTS COMPOSITION:
  Write ONE flowing narrative following this exact sequence (multiple paragraphs, no repetition, no AI commentary):
    (a) LW-8 served notice U/s 35(3) BNSS on the accused persons A1 & A2 (with date), informing them of allegations and directing appearance.
    (b) Accused appeared before LW-8 on the scheduled date/time at PS and voluntarily admitted guilt. LW-8 collected address proof, released them since the offence is punishable with less than 7 years (S. 35(3) BNSS).
    (c) LW-8 received the wound certificate from LW-7 stating injuries are simple/grievous in nature.
    (d) A single paragraph describing the incident: parties & their relation/origin → date/time/place → motive/trigger → assault (exact weapons / manner) → injuries → role of eyewitnesses/panches → final line: "Thus, the accused persons A1 & A2 mentioned in Col. No. 11 of this charge sheet has committed the offence punishable U/s <sections>."
  Tone: dry, precise, station-style. Use phrases like "LW-1", "the accused persons A1 & A2", "In obedience to the said notice", "In the process, the accused persons became enraged and…".

STEP 7 — FIELD POLICY (CRITICAL):
  Never hallucinate names, ages, phone numbers, addresses, dates, sections, or any other field. If a field is missing from raw input, output EXACTLY an empty string `""`. The officer will fill it in manually on the printed form. Do NOT guess, do NOT infer from similar cases, do NOT carry over values from one person to another. Empty is always safer than wrong.

============================================================
OUTPUT SCHEMA (emit ONLY this JSON — no prose, no markdown fences):
============================================================
{
  "court": "IN THE COURT OF JUDICIAL FIRST CLASS MAGISTRATE AT <TOWN>",
  "district": "<district>",
  "police_station": "<PS name>",
  "fir_number": "<e.g., 57/2026>",
  "fir_date": "<DD.MM.YYYY>",
  "chargesheet_date": "<DD.MM.YYYY>",
  "sections": "<corrected BNS sections line>",
  "chargesheet_type": "Original",
  "io": {"salutation":"Sri./Smt.","name":"","rank":"","station":""},
  "complainant": {"salutation":"","name":"","father_name":"","age":"","caste":"","occupation":"","address":"","phone":""},
  "accused": [
    {"serial":"A1","salutation":"","name":"","father_name":"","age":"","caste":"","occupation":"","address":"","phone":"","section_35_3_notice_date":""}
  ],
  "witnesses": [
    {"serial":"LW-1","salutation":"","name":"","father_name":"","age":"","caste":"","occupation":"","address":"","phone":"","role":"Complainant and Injured"}
  ],
  "property_recovered": "",
  "notice_ack_enclosed": "",
  "brief_facts": "<multi-paragraph narrative per Step 6>",
  "prayer": "Therefore, the Hon'ble court is prayed that to conduct trial against the accused persons A1 & A2 mentioned in Col.11 of this Charge sheet and punish them according to law. Hence charge sheet.",
  "corrections_applied": ["<plain-English fix 1>", "<plain-English fix 2>", "..."]
}

NON-NEGOTIABLES:
- Output ONLY the JSON object. No markdown fences. No explanations before or after.
- Every `corrections_applied` entry must name the specific field + the fix.
- If a section of the schema has no data, emit the key with an empty string/array — do NOT drop keys.
- Your job is done when the JSON is valid, all 7 steps applied, and a clerk can render it verbatim.
"""


def _build_user_prompt(raw_data: Dict[str, Any]) -> str:
    """Package raw data for the LLM in a clean format."""
    parts = [
        f"FIR Number: {raw_data.get('fir_number', '')}",
        f"FIR Date: {raw_data.get('fir_date', '')}",
        f"Charge Sheet Date: {raw_data.get('chargesheet_date', '')}",
        f"Police Station: {raw_data.get('police_station', '')}",
        f"District: {raw_data.get('district', '')}",
        f"Raw sections text: {raw_data.get('sections', '')}",
        f"IO (raw): {json.dumps(raw_data.get('io') or {})}",
        f"Complainant (raw): {json.dumps(raw_data.get('complainant') or {})}",
        f"Accused (raw): {json.dumps(raw_data.get('accused_persons') or [])}",
        f"Witnesses (raw): {json.dumps(raw_data.get('witnesses') or [])}",
        f"Scene of offence: {raw_data.get('incident_place', '')}",
        f"Incident date: {raw_data.get('incident_date', '')}",
        f"Incident time: {raw_data.get('incident_time', '')}",
        f"Medical findings: {raw_data.get('medical_findings', '')}",
        f"Section 35(3) dates: {raw_data.get('section_35_3_dates', '')}",
        "",
        "--- RAW NARRATIVE / BRIEF FACTS FROM FIR / STATEMENTS (may be messy) ---",
        (raw_data.get("brief_facts") or raw_data.get("raw_narrative") or "")[:8000],
    ]
    return "\n".join(parts)


def _extract_json_from_response(text: str) -> Dict[str, Any]:
    """Strip any markdown fences and parse JSON."""
    text = text.strip()
    # Strip markdown fences if present
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
    # Find the first { and last } to trim any stray commentary
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        text = text[first_brace:last_brace + 1]
    return json.loads(text)


async def generate_intelligent_charge_sheet(
    raw_data: Dict[str, Any],
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Entry point: run the raw case data through Claude Sonnet 4.5
    and return a clean structured charge sheet dict.

    On LLM failure, falls back to GPT-5.2.
    """
    from services.llm_compat import LlmChat, UserMessage  # lazy import

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY not configured")

    session_id = session_id or f"ics-{uuid.uuid4().hex[:12]}"
    user_prompt = _build_user_prompt(raw_data)

    # Primary: Claude Sonnet 4.5
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=SYSTEM_PROMPT,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        resp = await chat.send_message(UserMessage(text=user_prompt))
        result = _extract_json_from_response(resp)
        result["_model_used"] = "claude-sonnet-4-5"
        result["_session_id"] = session_id
        return result
    except Exception as e:
        logger.warning(f"[ICGS] Claude primary failed ({e}); falling back to GPT-5.2")

    # Fallback: GPT-5.2
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id + "-fallback",
        system_message=SYSTEM_PROMPT,
    ).with_model("openai", "gpt-5.2")
    resp = await chat.send_message(UserMessage(text=user_prompt))
    result = _extract_json_from_response(resp)
    result["_model_used"] = "gpt-5.2"
    result["_session_id"] = session_id
    return result
