"""
Intelligent Case Diary Part-I generator.

Uses the structured output from `intelligent_charge_sheet.py` as the
ground-truth payload (same complainant/accused/witnesses/facts) and asks
Claude Sonnet 4.5 to compose the Case Diary Part-I narrative in proper
station-writer style.

A Case Diary Part-I is the IO's chronological investigation log — it
describes WHAT the IO did on each day of the investigation, with times,
places, statements recorded, and any seizures/panchanamas. The structured
data is identical to the charge sheet; only the narrative format differs.
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

CASE_DIARY_PROMPT = """You are a senior police SI in Telangana, India, with 25+ years of experience writing Case Diary Part-I entries in the Makthal/Narayanpet format. You know BNSS (Bharatiya Nagarik Suraksha Sanhita, 2023) thoroughly.

You are given the CLEAN, STRUCTURED charge sheet JSON for a case (which has already been validated and corrected). Your job: compose the Case Diary Part-I narrative for the SAME case in proper IO's chronological investigation log format.

============================================================
CASE DIARY PART-I STYLE RULES:
============================================================
1. First person is not used — always third person: "LW-8 (the IO) proceeded to...", not "I proceeded to...".
2. Chronological structure: entries in date order, each beginning with "On <date> at <time> hours,..."
3. Every action must be tied to a date/time/place. No vague entries.
4. Typical Part-I entry sequence for a simple hurt/assault case:
   (i)  Date of FIR registration: IO received the complaint of LW-1, registered a case in Cr. No. <fir_number> U/s <sections>, issued FIR to higher officers and the Hon'ble Court, and took up investigation.
   (ii) Same day: IO visited the scene of offence in the presence of panch witnesses LW-5 & LW-6, conducted scene observation panchanama, prepared rough sketch. Recorded Section 180 BNSS statements of LW-1 (complainant/injured), LW-2, LW-3, LW-4.
   (iii) Medical: IO sent LW-1 for medical examination to LW-7 Dr. <name> at Govt. Area Hospital <place>. Received wound certificate opining injuries as simple/grievous.
   (iv) Notice: On <date> IO served notice U/s 35(3) BNSS 2023 on accused A1 & A2 directing their appearance on <date>.
   (v) Appearance & release: On <date> at <time>, accused appeared at PS, voluntarily admitted guilt, address proof collected, released since offence < 7 years punishable.
   (vi) Completion: Investigation complete. Charge sheet filed before the Hon'ble Court of JFCM on <chargesheet_date>.
5. Use station-style phrasing: "In obedience to the said notice", "In continuation of investigation", "Recorded Section 180 BNSS statement of...", "Collected address proof and released".
6. Do NOT hallucinate dates or places. If a date is missing, write "__________" as a fill-in blank.
7. Output ONLY the JSON object. No markdown fences. No prose.

OUTPUT SCHEMA:
{
  "fir_number": "<from input>",
  "fir_date": "<from input>",
  "chargesheet_date": "<from input>",
  "police_station": "<from input>",
  "district": "<from input>",
  "sections": "<from input>",
  "io": {"salutation":"","name":"","rank":"","station":""},
  "complainant_name": "<LW-1 name>",
  "accused_list": "<A1 name & A2 name>",
  "entries": [
    {
      "date": "DD.MM.YYYY",
      "time": "HH:MM hours",
      "entry": "<single-paragraph entry in station style>"
    }
  ],
  "closing": "Investigation complete. Charge sheet filed before the Hon'ble Court of JFCM, <town> on <chargesheet_date>."
}
"""


def _extract_json(text: str) -> Dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
    first = text.find("{")
    last = text.rfind("}")
    if first != -1 and last > first:
        text = text[first:last + 1]
    return json.loads(text)


async def generate_intelligent_case_diary(
    chargesheet_data: Dict[str, Any],
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Take the already-corrected charge sheet JSON and generate Case Diary Part-I
    structured data via Claude Sonnet 4.5 (GPT-5.2 fallback).
    """
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY not configured")

    session_id = session_id or f"icd-{uuid.uuid4().hex[:12]}"
    # Strip internal markers before sending to the model
    payload = {k: v for k, v in chargesheet_data.items() if not k.startswith("_")}
    user_prompt = "CHARGE SHEET JSON (already corrected):\n" + json.dumps(payload, ensure_ascii=False, indent=2)

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=CASE_DIARY_PROMPT,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        resp = await chat.send_message(UserMessage(text=user_prompt))
        result = _extract_json(resp)
        result["_model_used"] = "claude-sonnet-4-5"
        return result
    except Exception as e:
        logger.warning(f"[ICD] Claude primary failed ({e}); falling back to GPT-5.2")

    chat = LlmChat(
        api_key=api_key,
        session_id=session_id + "-fallback",
        system_message=CASE_DIARY_PROMPT,
    ).with_model("openai", "gpt-5.2")
    resp = await chat.send_message(UserMessage(text=user_prompt))
    result = _extract_json(resp)
    result["_model_used"] = "gpt-5.2"
    return result
