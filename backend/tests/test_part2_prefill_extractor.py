"""
Tests for Part-II Statements Auto-Detect Extractor (Step 0.5).

Covers:
  - prompt structure (3 output fields documented, BNSS/CrPC-aware,
    overwrite rule mentioned)
  - JSON parsing with markdown fences + prose prefix
  - graceful degradation on empty/short OCR + LLM failure
  - parsed payload pass-through with confidence colours
  - LIVE OpenAI test (gated by RUN_LIVE_PART2_PREFILL=1)
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

from services.part2_prefill_extractor import (
    PART2_PREFILL_SYSTEM_PROMPT,
    _build_user_prompt,
    _degraded_payload,
    _extract_json_from_response,
    extract_part2_prefill_fields,
)


SAMPLE_PART2_TEXT = """
Part-II BNSS Statements

District: Narayanpet | Police Station: Makthal | Cr.No. 100/2025

ENDORSEMENT
The above mentioned case was registered by Inspector V. Kumar on
23.04.2025 at 13:15 hrs. Hence this case is endorsed to HC 248
K Lal Singh, PS Makthal, for further investigation U/s 117(2),
351(2), 126(2) BNS r/w 3(5) BNS.

S.180 BNSS — Statement of LW-1 Jingiti Aruna ...
[statement body]

S.180 BNSS — Statement of LW-2 Bandi Pothi Lakshmi ...
[statement body]
"""


class TestPart2PromptStructure(unittest.TestCase):

    def test_prompt_documents_all_5_output_fields(self):
        for k in ("io_name", "io_rank", "sections",
                  "second_io_name", "second_io_rank"):
            self.assertIn(k, PART2_PREFILL_SYSTEM_PROMPT, f"Missing field: {k}")

    def test_prompt_explains_endorsement_lookup_location(self):
        normalized = " ".join(PART2_PREFILL_SYSTEM_PROMPT.split())
        self.assertIn("endorsement", normalized.lower())
        # Specific endorsement-line example must be present
        self.assertIn("This case is taken up", normalized)
        self.assertIn("Endorsed to", normalized)

    def test_prompt_handles_section_upgrade_scenario(self):
        # The prompt must mention "sections often upgrade from FIR to chargesheet"
        normalized = " ".join(PART2_PREFILL_SYSTEM_PROMPT.split()).lower()
        self.assertIn("most recent section list", normalized)
        self.assertIn("upgrade from fir", normalized)
        # Concrete upgrade example
        self.assertIn("115 bns → 117(2) bns", normalized.lower())

    def test_prompt_is_bnss_crpc_ipc_aware(self):
        # The prompt must preserve act suffixes
        for act in ("BNS", "BNSS", "IPC", "CrPC", "POCSO Act"):
            self.assertIn(act, PART2_PREFILL_SYSTEM_PROMPT, f"Missing act suffix: {act}")

    def test_prompt_demands_act_suffix_preservation(self):
        normalized = " ".join(PART2_PREFILL_SYSTEM_PROMPT.split())
        self.assertIn("ACT-SUFFIX PRESERVATION", normalized)
        self.assertIn("Do NOT translate or rename", normalized)

    def test_prompt_handles_dual_io_case(self):
        normalized = " ".join(PART2_PREFILL_SYSTEM_PROMPT.split())
        # Must explicitly explain when to populate second_io_name vs leave empty
        self.assertIn("DIFFERENT from the filing IO", normalized)
        self.assertIn("If only one officer is named", normalized)

    def test_prompt_documents_3_confidence_colors(self):
        for c in ('"green"', '"yellow"', '""'):
            self.assertIn(c, PART2_PREFILL_SYSTEM_PROMPT, f"Missing color: {c}")

    def test_prompt_forbids_inventing_sections(self):
        normalized = " ".join(PART2_PREFILL_SYSTEM_PROMPT.split())
        self.assertIn("NEVER invent or guess section numbers", normalized)
        self.assertIn("NEVER guess an IO name", normalized)

    def test_build_user_prompt_includes_ocr_text(self):
        prompt = _build_user_prompt(SAMPLE_PART2_TEXT)
        self.assertIn("117(2)", prompt)
        self.assertIn("K Lal Singh", prompt)
        self.assertIn("PART-II EXTRACTION", prompt)


class TestPart2JSONExtraction(unittest.TestCase):

    def test_plain_response(self):
        raw = '{"io_name": "K Lal Singh", "sections": "117(2) BNS"}'
        parsed = _extract_json_from_response(raw)
        self.assertEqual(parsed["sections"], "117(2) BNS")

    def test_markdown_fence(self):
        raw = '```json\n{"io_name": "K Lal Singh"}\n```'
        self.assertEqual(_extract_json_from_response(raw)["io_name"], "K Lal Singh")

    def test_prose_prefix(self):
        raw = 'Sure: {"io_name": "K Lal Singh"} -- thanks!'
        self.assertEqual(_extract_json_from_response(raw)["io_name"], "K Lal Singh")


class TestPart2GracefulDegradation(unittest.TestCase):

    def _run(self, coro):
        return asyncio.get_event_loop().run_until_complete(coro)

    def test_empty_ocr_returns_degraded_immediately(self):
        out = self._run(extract_part2_prefill_fields("", session_id="t1"))
        self.assertEqual(out["io_name"], "")
        self.assertEqual(out["sections"], "")
        self.assertIn("_error", out)

    def test_short_ocr_returns_degraded_immediately(self):
        out = self._run(extract_part2_prefill_fields("hi there", session_id="t2"))
        self.assertEqual(out["io_name"], "")
        self.assertIn("_error", out)

    def test_returns_degraded_payload_on_llm_failure(self):
        async def go():
            with patch("services.llm_compat.LlmChat") as MockChat:
                inst = MockChat.return_value
                inst.with_model.return_value = inst
                inst.with_temperature.return_value = inst
                inst.with_max_tokens.return_value = inst
                inst.send_message = AsyncMock(side_effect=RuntimeError("boom"))
                out = await extract_part2_prefill_fields(SAMPLE_PART2_TEXT, session_id="t3")
                self.assertEqual(out["io_name"], "")
                self.assertIn("_error", out)
        self._run(go())

    def test_returns_parsed_payload_on_clean_response(self):
        async def go():
            fake = {
                "io_name": "K Lal Singh", "io_rank": "HC 248",
                "sections": "117(2), 351(2), 126(2) BNS r/w 3(5) BNS",
                "second_io_name": "V. Kumar", "second_io_rank": "Inspector",
                "_confidence": {
                    "io_name": "green", "io_rank": "green",
                    "sections": "green",
                    "second_io_name": "yellow", "second_io_rank": "yellow",
                },
            }
            with patch("services.llm_compat.LlmChat") as MockChat:
                inst = MockChat.return_value
                inst.with_model.return_value = inst
                inst.with_temperature.return_value = inst
                inst.with_max_tokens.return_value = inst
                inst.send_message = AsyncMock(return_value=json.dumps(fake))
                out = await extract_part2_prefill_fields(SAMPLE_PART2_TEXT, session_id="t4")
                self.assertEqual(out["io_name"], "K Lal Singh")
                self.assertEqual(out["sections"], "117(2), 351(2), 126(2) BNS r/w 3(5) BNS")
                self.assertEqual(out["second_io_name"], "V. Kumar")
                self.assertEqual(out["_confidence"]["second_io_name"], "yellow")
        self._run(go())

    def test_degraded_payload_has_all_5_keys(self):
        p = _degraded_payload()
        for k in ("io_name", "io_rank", "sections",
                  "second_io_name", "second_io_rank"):
            self.assertIn(k, p)


@unittest.skipUnless(
    os.environ.get("RUN_LIVE_PART2_PREFILL") == "1",
    "Set RUN_LIVE_PART2_PREFILL=1 to run the live OpenAI test",
)
class TestLivePart2Prefill(unittest.TestCase):

    def test_live_extracts_endorsement_io_and_upgraded_sections(self):
        out = asyncio.get_event_loop().run_until_complete(
            extract_part2_prefill_fields(SAMPLE_PART2_TEXT, session_id="live")
        )
        # IO from endorsement line
        self.assertIn("Lal Singh", out["io_name"])
        self.assertIn("HC", out["io_rank"])
        # Sections (note: upgraded "117(2)" — not just "115" from FIR)
        self.assertIn("117(2)", out["sections"])
        self.assertIn("BNS", out["sections"])
        # Second IO (Inspector V. Kumar registered the case)
        self.assertIn("Kumar", out["second_io_name"])
        # Confidence colours
        conf = out.get("_confidence", {})
        self.assertTrue(all(v in ("", "green", "yellow") for v in conf.values()))
        print("\nLIVE Part-II output:", json.dumps(
            {k: v for k, v in out.items() if not k.startswith("_")}, indent=2
        ))


if __name__ == "__main__":
    unittest.main()
