"""
Tests for LAYER 1 Self-Verification (charge_sheet_verifier.py).

These tests do NOT hit the real OpenAI API by default — they assert prompt
structure + graceful-degradation behaviour. If OPENAI_API_KEY is set and
the env var `RUN_LIVE_VERIFIER=1` is exported, an end-to-end live test is
also executed.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

# Load backend .env so OPENAI_API_KEY is visible
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.charge_sheet_verifier import (
    REVIEWER_SYSTEM_PROMPT,
    _build_user_prompt,
    _extract_json_from_response,
    run_self_verification,
)


SAMPLE_DRAFT = {
    "fir_number": "100/2025",
    "fir_date": "23.04.2025",
    "sections": "115(2), 351(2), 126(2) BNS",
    "court": "IN THE COURT OF JFCM AT MAKTHAL",
    "io": {"name": "K Lal Singh", "rank": "HC 248"},
    "complainant": {
        "name": "Jingiti Aruna",
        "father": "Late Chinna Thayappa",
        "age": "32",
        "caste": "BC-A",
        "address": "Yellammakunta",
        "phone": "9876543210",
    },
    "accused": [
        {
            "name": "John Doe",
            "father": "Doe Sr",
            "age": "28",
            "address": "Hyderabad",
            "phone": "9999999999",
        }
    ],
    "witnesses": [
        # LW-1 = complainant
        {
            "name": "Jingiti Aruna",
            "father": "Late Chinna Thayappa",
            "type": "Complainant",
        },
        # LW-2 with a fractured wrist (should stay 'grievous')
        {
            "name": "Neerati Narasimha",
            "type": "Eye Witness",
        },
    ],
    "brief_facts": "On 23.04.2025 at 12:30 hrs near Yellammakunta...",
    "medical_findings": "LW-2 sustained a fracture to the left wrist (simple in nature)",
}


class TestPromptStructure(unittest.TestCase):

    def test_reviewer_prompt_contains_all_9_audit_checks(self):
        for marker in ("C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"):
            self.assertIn(marker, REVIEWER_SYSTEM_PROMPT, f"Missing audit check {marker} in reviewer prompt")

    def test_reviewer_prompt_contains_3_layer_keywords(self):
        for keyword in ("field_confidence", "quality_review", "structured_data"):
            self.assertIn(keyword, REVIEWER_SYSTEM_PROMPT)

    def test_reviewer_prompt_contains_confidence_colors(self):
        for color in ('"green"', '"yellow"', '"red"'):
            self.assertIn(color, REVIEWER_SYSTEM_PROMPT)

    def test_build_user_prompt_includes_draft_and_corpus(self):
        prompt = _build_user_prompt(SAMPLE_DRAFT, "DOCUMENT_TEXT_HERE")
        self.assertIn("100/2025", prompt)
        self.assertIn("DOCUMENT_TEXT_HERE", prompt)
        self.assertIn("DRAFT CHARGESHEET JSON", prompt)


class TestJSONExtraction(unittest.TestCase):

    def test_extract_json_from_plain_response(self):
        raw = '{"structured_data": {"fir_number": "100/2025"}, "quality_review": {}, "field_confidence": {}}'
        parsed = _extract_json_from_response(raw)
        self.assertEqual(parsed["structured_data"]["fir_number"], "100/2025")

    def test_extract_json_strips_markdown_fence(self):
        raw = '```json\n{"structured_data": {"x": 1}, "quality_review": {}, "field_confidence": {}}\n```'
        parsed = _extract_json_from_response(raw)
        self.assertEqual(parsed["structured_data"]["x"], 1)

    def test_extract_json_handles_prose_prefix(self):
        raw = 'Sure, here you go:\n{"structured_data": {"x": 2}, "quality_review": {}, "field_confidence": {}}\nThanks!'
        parsed = _extract_json_from_response(raw)
        self.assertEqual(parsed["structured_data"]["x"], 2)


class TestGracefulDegradation(unittest.TestCase):
    """If the verifier LLM call raises, run_self_verification must NOT crash
    — it should return the original draft + a degraded quality_review block."""

    def _run(self, coro):
        return asyncio.get_event_loop().run_until_complete(coro)

    def test_returns_degraded_block_on_llm_failure(self):
        async def go():
            with patch("services.llm_compat.LlmChat") as MockChat:
                instance = MockChat.return_value
                instance.with_model.return_value = instance
                instance.with_temperature.return_value = instance
                instance.with_max_tokens.return_value = instance
                instance.send_message = AsyncMock(side_effect=RuntimeError("LLM down"))
                out = await run_self_verification(SAMPLE_DRAFT, "corpus", session_id="test-1")
                self.assertEqual(out["structured_data"], SAMPLE_DRAFT)
                self.assertEqual(out["quality_review"]["overall_status"], "OFFICER_MUST_COMPLETE")
                self.assertIn("error", out["quality_review"])
                self.assertEqual(out["field_confidence"], {})
        self._run(go())

    def test_returns_degraded_block_on_malformed_json(self):
        async def go():
            with patch("services.llm_compat.LlmChat") as MockChat:
                instance = MockChat.return_value
                instance.with_model.return_value = instance
                instance.with_temperature.return_value = instance
                instance.with_max_tokens.return_value = instance
                instance.send_message = AsyncMock(return_value="this is not json at all")
                out = await run_self_verification(SAMPLE_DRAFT, "corpus", session_id="test-2")
                self.assertEqual(out["structured_data"], SAMPLE_DRAFT)
                self.assertEqual(out["quality_review"]["overall_status"], "OFFICER_MUST_COMPLETE")
        self._run(go())

    def test_returns_parsed_payload_on_clean_response(self):
        async def go():
            fake = {
                "structured_data": {**SAMPLE_DRAFT, "fixed_marker": True},
                "quality_review": {
                    "completion_pct": 78,
                    "fixes_applied": [{"check": "C1", "before": "x", "after": "y", "reason": "test"}],
                    "items_to_verify": ["complainant.phone"],
                    "audit_checks": {"C1_dual_listed_person": "FIXED"},
                    "overall_status": "REVIEW_NEEDED",
                },
                "field_confidence": {
                    "complainant.name": "green",
                    "complainant.phone": "yellow",
                    "io.rank": "red",
                },
            }
            with patch("services.llm_compat.LlmChat") as MockChat:
                instance = MockChat.return_value
                instance.with_model.return_value = instance
                instance.with_temperature.return_value = instance
                instance.with_max_tokens.return_value = instance
                instance.send_message = AsyncMock(return_value=json.dumps(fake))
                out = await run_self_verification(SAMPLE_DRAFT, "corpus", session_id="test-3")
                self.assertEqual(out["structured_data"]["fixed_marker"], True)
                self.assertEqual(out["quality_review"]["completion_pct"], 78)
                self.assertEqual(out["quality_review"]["overall_status"], "REVIEW_NEEDED")
                self.assertEqual(out["field_confidence"]["complainant.phone"], "yellow")
                self.assertEqual(out["field_confidence"]["io.rank"], "red")
        self._run(go())


@unittest.skipUnless(
    os.environ.get("RUN_LIVE_VERIFIER") == "1",
    "RUN_LIVE_VERIFIER=1 not set — skipping live OpenAI call",
)
class TestLiveOpenAICall(unittest.TestCase):
    """Live end-to-end test (only runs if RUN_LIVE_VERIFIER=1 + OPENAI_API_KEY set)."""

    def test_real_verifier_returns_3_required_keys(self):
        async def go():
            out = await run_self_verification(
                SAMPLE_DRAFT,
                "FIR 100/2025 dated 23.04.2025 — Jingiti Aruna lodged complaint at PS Makthal. "
                "Accused John Doe was arrested. LW-2 Neerati Narasimha witnessed the assault and "
                "sustained a fracture to the left wrist (treated by Dr A Mahesh Raj at CHC Makthal).",
                session_id="live-test",
            )
            self.assertIn("structured_data", out)
            self.assertIn("quality_review", out)
            self.assertIn("field_confidence", out)
            self.assertIsInstance(out["quality_review"], dict)
            self.assertIsInstance(out["field_confidence"], dict)
            print("\nLIVE quality_review:", json.dumps(out["quality_review"], indent=2)[:1000])
            print("\nLIVE field_confidence sample:", dict(list(out["field_confidence"].items())[:8]))
        asyncio.get_event_loop().run_until_complete(go())


if __name__ == "__main__":
    unittest.main()
