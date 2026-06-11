"""
Unit + integration tests for the FIR Auto-Prefill module.

Coverage:
  - prompt structure (8 fields described, deterministic defaults documented)
  - degraded-payload returned when LLM call fails
  - degraded-payload returned when OCR text is too short
  - JSON parsing handles markdown fences + prose prefix
  - LIVE OpenAI test (gated by RUN_LIVE_FIR_PREFILL=1) hits gpt-4o with a
    realistic FIR OCR snippet and asserts the 12 keys are returned
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.fir_prefill_extractor import (
    FIR_PREFILL_SYSTEM_PROMPT,
    _build_user_prompt,
    _degraded_payload,
    _extract_json_from_response,
    extract_fir_prefill_fields,
)


SAMPLE_FIR_TEXT = """
First Information Report

District:           Narayanpet
Police Station:     Makthal
Crime No.:          100/2025
Date of Report:     23.04.2025
Sections / Acts:    115(2), 351(2), 126(2) BNS

Brief facts of the case:
The complainant Smt. Jingiti Aruna W/o Late Chinna Thayappa, age 32 years,
caste BC-A, occupation housewife, resident of Yellammakunta village, came
to PS Makthal on 23.04.2025 at 12:30 hrs and lodged a written petition...

Officer reporting:  HC 248  K Lal Singh
                    SHO PS Makthal
"""


class TestPromptStructure(unittest.TestCase):

    def test_prompt_documents_all_12_output_fields(self):
        for k in ("district", "police_station", "fir_number", "fir_date",
                  "chargesheet_no", "sections", "report_type", "chargesheet_type",
                  "io_name", "io_rank", "second_io_name", "second_io_rank"):
            self.assertIn(k, FIR_PREFILL_SYSTEM_PROMPT, f"Missing field: {k}")

    def test_prompt_documents_3_confidence_colors(self):
        self.assertIn('"green"', FIR_PREFILL_SYSTEM_PROMPT)
        self.assertIn('"yellow"', FIR_PREFILL_SYSTEM_PROMPT)
        self.assertIn('""', FIR_PREFILL_SYSTEM_PROMPT)

    def test_prompt_forbids_inventing_dates(self):
        self.assertIn("NEVER invent dates", FIR_PREFILL_SYSTEM_PROMPT)
        self.assertIn("NEVER auto-fill today's date", FIR_PREFILL_SYSTEM_PROMPT)

    def test_prompt_locks_report_type_and_chargesheet_type_defaults(self):
        self.assertIn('"Charge Sheet"', FIR_PREFILL_SYSTEM_PROMPT)
        self.assertIn('"Original"', FIR_PREFILL_SYSTEM_PROMPT)

    def test_build_user_prompt_includes_ocr_text(self):
        prompt = _build_user_prompt(SAMPLE_FIR_TEXT)
        self.assertIn("100/2025", prompt)
        self.assertIn("Jingiti Aruna", prompt)
        self.assertIn("FIR PREFILL TASK", prompt)


class TestJSONExtraction(unittest.TestCase):

    def test_plain_response(self):
        raw = '{"district": "Narayanpet", "fir_number": "100/2025"}'
        parsed = _extract_json_from_response(raw)
        self.assertEqual(parsed["district"], "Narayanpet")

    def test_markdown_fence(self):
        raw = '```json\n{"district": "Narayanpet"}\n```'
        self.assertEqual(_extract_json_from_response(raw)["district"], "Narayanpet")

    def test_prose_prefix(self):
        raw = 'Here you go: {"district": "Narayanpet"} -- thanks!'
        self.assertEqual(_extract_json_from_response(raw)["district"], "Narayanpet")


class TestGracefulDegradation(unittest.TestCase):

    def _run(self, coro):
        return asyncio.get_event_loop().run_until_complete(coro)

    def test_empty_ocr_returns_degraded_immediately(self):
        out = self._run(extract_fir_prefill_fields("", session_id="t1"))
        # No LLM call should be attempted
        self.assertEqual(out["district"], "")
        self.assertEqual(out["report_type"], "Charge Sheet")
        self.assertEqual(out["chargesheet_type"], "Original")
        self.assertIn("_error", out)

    def test_short_ocr_returns_degraded_immediately(self):
        out = self._run(extract_fir_prefill_fields("hi", session_id="t2"))
        self.assertEqual(out["district"], "")
        self.assertIn("_error", out)

    def test_returns_degraded_payload_on_llm_failure(self):
        async def go():
            with patch("services.llm_compat.LlmChat") as MockChat:
                inst = MockChat.return_value
                inst.with_model.return_value = inst
                inst.with_temperature.return_value = inst
                inst.with_max_tokens.return_value = inst
                inst.send_message = AsyncMock(side_effect=RuntimeError("boom"))
                out = await extract_fir_prefill_fields(SAMPLE_FIR_TEXT, session_id="t3")
                self.assertEqual(out["district"], "")
                self.assertEqual(out["report_type"], "Charge Sheet")
                self.assertEqual(out["chargesheet_type"], "Original")
                self.assertIn("_error", out)
        self._run(go())

    def test_returns_parsed_payload_on_clean_response(self):
        async def go():
            fake = {
                "district": "Narayanpet", "police_station": "Makthal",
                "fir_number": "100/2025", "fir_date": "23.04.2025",
                "chargesheet_no": "", "sections": "115(2), 351(2), 126(2) BNS",
                "report_type": "Charge Sheet", "chargesheet_type": "Original",
                "io_name": "K Lal Singh", "io_rank": "HC 248",
                "second_io_name": "", "second_io_rank": "",
                "_confidence": {
                    "district": "green", "police_station": "green",
                    "fir_number": "green", "fir_date": "green",
                    "sections": "green", "io_name": "yellow", "io_rank": "yellow",
                },
            }
            with patch("services.llm_compat.LlmChat") as MockChat:
                inst = MockChat.return_value
                inst.with_model.return_value = inst
                inst.with_temperature.return_value = inst
                inst.with_max_tokens.return_value = inst
                inst.send_message = AsyncMock(return_value=json.dumps(fake))
                out = await extract_fir_prefill_fields(SAMPLE_FIR_TEXT, session_id="t4")
                self.assertEqual(out["district"], "Narayanpet")
                self.assertEqual(out["fir_number"], "100/2025")
                self.assertEqual(out["io_name"], "K Lal Singh")
                self.assertEqual(out["_confidence"]["io_name"], "yellow")
        self._run(go())

    def test_degraded_payload_has_all_12_keys(self):
        p = _degraded_payload()
        for k in ("district", "police_station", "fir_number", "fir_date",
                  "chargesheet_no", "sections", "report_type", "chargesheet_type",
                  "io_name", "io_rank", "second_io_name", "second_io_rank"):
            self.assertIn(k, p)
        self.assertEqual(p["report_type"], "Charge Sheet")
        self.assertEqual(p["chargesheet_type"], "Original")


@unittest.skipUnless(
    os.environ.get("RUN_LIVE_FIR_PREFILL") == "1",
    "Set RUN_LIVE_FIR_PREFILL=1 to run the live OpenAI prefill test",
)
class TestLiveFIRPrefill(unittest.TestCase):

    def test_live_extracts_realistic_fir(self):
        out = asyncio.get_event_loop().run_until_complete(
            extract_fir_prefill_fields(SAMPLE_FIR_TEXT, session_id="live")
        )
        self.assertEqual(out["district"].lower(), "narayanpet")
        self.assertEqual(out["police_station"].lower(), "makthal")
        self.assertIn("100/2025", out["fir_number"])
        self.assertIn("115", out["sections"])
        self.assertEqual(out["report_type"], "Charge Sheet")
        self.assertEqual(out["chargesheet_type"], "Original")
        self.assertIn("K Lal", out["io_name"])
        self.assertIn("HC 248", out["io_rank"])
        # Confidence map is present and uses the colour scheme
        conf = out.get("_confidence", {})
        self.assertTrue(all(v in ("", "green", "yellow") for v in conf.values()))
        print("\nLIVE prefill output:", json.dumps(
            {k: v for k, v in out.items() if not k.startswith("_")}, indent=2
        ))


if __name__ == "__main__":
    unittest.main()
