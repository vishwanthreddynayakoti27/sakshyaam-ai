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

You are given RAW case data that may be incomplete, jumbled, or contain misclassifications (e.g., complainant wrongly listed as accused, jumbled ages/castes/names, typos in section numbers like 1118 instead of 118).

Your job: produce a CLEAN, STRUCTURED JSON object that a clerk can plug into a DOCX template to produce a proper charge sheet.

RULES — think step by step BEFORE emitting JSON:
1. **Identify who is who.** The complainant/injured/victim is NOT the accused. If the raw data places the same person in both roles, use the narrative/brief facts to decide and put them ONLY as complainant+LW-1.
2. **Correct typos in section numbers.** "1118(2)" → "118(2)". Never invent new sections. Keep only sections that match the narrative (e.g., 118(2) BNS = voluntarily causing hurt by dangerous means; 115(2) BNS = voluntarily causing hurt; 352 BNS = intentional insult; 3(5) BNS = common intention).
3. **Fix impossible ages** (e.g., "1 year" for an adult accused → mark as "unknown" or infer from context).
4. **Re-number witnesses.** LW-1 = complainant/injured. LW-2 = circumstantial witness. LW-3, LW-4 = eyewitnesses. LW-5, LW-6 = scene-of-offence panches. LW-7 = medical officer. LW-8 = IO. Adjust as needed.
5. **Brief Facts must be a single flowing narrative.** Sequence: (a) parties & their relation/origin, (b) incident date/time/place, (c) what happened (motive, trigger, assault, injury), (d) role of each witness/panch, (e) medical examination, (f) 35(3) BNSS service on accused, (g) accused appearance, (h) closing with the offence sections. Use the exact station style: "LW-1", "LW-8 served notice U/s 35(3) BNSS", "the accused persons A1 & A2", etc. NO repetition. NO generic filler. NO AI commentary.
6. **Never hallucinate names, ages, phone numbers, addresses, dates, sections, or any other field.** If a field is missing from input, output EXACTLY an empty string `""`. The officer will fill it in manually on the printed form. Do NOT guess, do NOT infer from similar cases, do NOT carry over values from one person to another. Empty is always safer than wrong.
7. **Prayer & closing.** Use: "Therefore, the Hon'ble Court is prayed that to conduct trial against the accused persons A1 & A2 mentioned in Col.11 of this Charge sheet and punish them according to law. Hence charge sheet."
8. **Output ONLY the JSON object.** No markdown fences, no explanations.

Output JSON schema:
{
  "court": "<e.g., 'IN THE COURT OF JUDICIAL FIRST CLASS MAGISTRATE AT MAKTHAL'>",
  "district": "Narayanpet",
  "police_station": "Makthal",
  "fir_number": "57/2026",
  "fir_date": "22.02.2026",
  "chargesheet_date": "26.03.2026",
  "sections": "118(2), 115(2), 352 R/w 3(5) BNS",
  "chargesheet_type": "Original",
  "io": {
    "name": "Y. Bhagya Lakshmi Reddy",
    "rank": "SI of Police",
    "station": "PS Makthal",
    "salutation": "Sri."
  },
  "complainant": {
    "salutation": "Sri.",
    "name": "Chandapuram Manikanta",
    "father_name": "Chandrashekar",
    "age": "22 years",
    "caste": "Mudiraj",
    "occupation": "Business (Glass Frame work)",
    "address": "Nethajinagar, Makthal Mandal, Narayanpet",
    "phone": "9441016205"
  },
  "accused": [
    {
      "serial": "A1",
      "salutation": "Sri.",
      "name": "...",
      "father_name": "...",
      "age": "36 years",
      "caste": "Yadav",
      "occupation": "Agriculture",
      "address": "H.No. 2-72 Maganoor Village & Mandal, Narayanpet District",
      "phone": "9959282848",
      "section_35_3_notice_date": "23.2.2026"
    }
  ],
  "witnesses": [
    {
      "serial": "LW-1",
      "salutation": "Sri.",
      "name": "...",
      "father_name": "...",
      "age": "22 years",
      "caste": "Mudiraj",
      "occupation": "Business (Glass Frame work)",
      "address": "Nethajinagar, Makthal Mandal",
      "phone": "9441016205",
      "role": "Complainant and Injured"
    }
  ],
  "property_recovered": "",
  "notice_ack_enclosed": "",
  "brief_facts": "<single flowing paragraph/multi-para narrative>",
  "prayer": "Therefore, the Hon'ble Court is prayed that to conduct trial against the accused persons A1 & A2 mentioned in Col.11 of this Charge sheet and punish them according to law. Hence charge sheet.",
  "corrections_applied": [
    "Moved 'Chandapuram Manikanta' from accused list to complainant/LW-1 — he is the injured party",
    "Corrected section '1118(2)' → '118(2) BNS'",
    "Renumbered witnesses: previous LW-7 duplicate removed; LW-1 = complainant, LW-8 = IO"
  ]
}
"""


def _build_user_prompt(raw_data: Dict[str, Any]) -> str:
    """Package raw data for the LLM in a clean format."""
    parts = [
        f"FIR Number: {raw_data.get('fir_number', '')}",
        f"FIR Date: {raw_data.get('fir_date', '')}",
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
    from emergentintegrations.llm.chat import LlmChat, UserMessage  # lazy import

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
