"""
Tests for the 2026-06 V6.0 "Professional Persona / Triple Mindset" block.

Verifies the new judicial framing is present in both:
  • services/intelligent_charge_sheet.SYSTEM_PROMPT (primary IO LLM)
  • services/charge_sheet_verifier.REVIEWER_SYSTEM_PROMPT (senior reviewer LLM)

The mindset asks the LLM to internalise three perspectives — IO,
Legal Advisor, Judge — before generating Brief Facts / Conclusion,
and forces a final audit "would this withstand the magistrate's
first reading?" check before output.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.charge_sheet_verifier import REVIEWER_SYSTEM_PROMPT
from services.intelligent_charge_sheet import SYSTEM_PROMPT


def _norm(s: str) -> str:
    """Collapse whitespace for newline-insensitive substring assertions."""
    return " ".join(s.split())


class TestPrimaryPromptTripleMindset(unittest.TestCase):

    def test_section_header_is_present(self):
        self.assertIn("SECTION ⋄ — PROFESSIONAL PERSONA & TRIPLE MINDSET",
                      SYSTEM_PROMPT)
        self.assertIn("V6.0 / 2026-06", SYSTEM_PROMPT)

    def test_three_personas_are_called_out(self):
        normalized = _norm(SYSTEM_PROMPT)
        # IO, Lawyer, Judge — all three must be named
        self.assertIn("AS AN INVESTIGATION OFFICER", normalized)
        self.assertIn("AS A LEGAL ADVISOR / ADVOCATE", normalized)
        self.assertIn("AS IF WRITING FOR THE JUDGE", normalized)

    def test_four_lens_pre_write_question_present(self):
        self.assertIn("FOUR-LENS PRE-WRITE QUESTION", SYSTEM_PROMPT)
        for q in ("Q1 (IO lens)", "Q2 (Lawyer lens)",
                  "Q3 (Judge lens)", "Q4 (Audit lens)"):
            self.assertIn(q, SYSTEM_PROMPT)

    def test_six_practical_consequences_present(self):
        # The 6 numbered practical-effects items from the spec
        normalized = _norm(SYSTEM_PROMPT)
        for kw in [
            "1. LEGAL ACCURACY",
            "2. EVIDENCE CLARITY",
            "3. ZERO CONTRADICTIONS",
            "4. PROPER LEGAL LANGUAGE",
            "5. LOGICAL NARRATIVE FLOW",
            "6. COMPLETE EVIDENCE CHAIN",
        ]:
            self.assertIn(kw, normalized, f"Missing practical rule: {kw}")

    def test_final_judge_check_with_8_ticks(self):
        self.assertIn("FINAL CHECK BEFORE OUTPUT", SYSTEM_PROMPT)
        # Must contain the explicit 8-tick checklist marker
        self.assertGreaterEqual(SYSTEM_PROMPT.count("[✓]"), 8,
                                "Need 8 [✓] checklist items in final-check block")

    def test_final_check_demands_judges_scrutiny(self):
        normalized = _norm(SYSTEM_PROMPT)
        self.assertIn("AS A JUDGE WOULD", normalized)
        self.assertIn("withstand the\njudge's scrutiny", SYSTEM_PROMPT)


class TestReviewerPromptTripleMindset(unittest.TestCase):

    def test_section_header_is_present(self):
        self.assertIn("REVIEWER'S TRIPLE MINDSET (V6.0", REVIEWER_SYSTEM_PROMPT)

    def test_three_lenses_named_in_reviewer(self):
        normalized = _norm(REVIEWER_SYSTEM_PROMPT)
        self.assertIn("AS A SENIOR IO", normalized)
        self.assertIn("AS A LEGAL ADVISOR", normalized)
        self.assertIn("AS THE MAGISTRATE WHO WILL READ", normalized)

    def test_reviewer_demands_magistrate_first_reading_test(self):
        normalized = _norm(REVIEWER_SYSTEM_PROMPT)
        self.assertIn("Would this pass the magistrate's first reading?", normalized)
        self.assertIn("PASS is reserved for", normalized)


if __name__ == "__main__":
    unittest.main()
