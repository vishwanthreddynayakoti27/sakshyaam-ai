"""
Tests for the 2026-06 ¶10 evidence-conclusion LW/A-tagging rule.

The "junior IO" prompt now requires every person mentioned in
brief_facts ¶10 to be prefixed by an LW number (witnesses) or
A number (accused) AND followed by a role descriptor. Plain
names like "Jangiti Aruna lodged a petition" are forbidden.

These tests ensure:
  - the rule + reference example + forbidden-list are in the
    prompt
  - the verifier has a C13 check for missing tags
  - the audit_checks output schema includes C13
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.charge_sheet_verifier import REVIEWER_SYSTEM_PROMPT
from services.intelligent_charge_sheet import SYSTEM_PROMPT


class TestPara10TaggingPrompt(unittest.TestCase):

    def test_para_10_has_v5_lw_a_tag_block(self):
        # The new ¶10 block must explain the tag-and-role pattern
        self.assertIn("EVIDENCE CONCLUSION (UPDATED 2026-06", SYSTEM_PROMPT)
        self.assertIn("Tag-and-role pattern", SYSTEM_PROMPT)
        normalized = " ".join(SYSTEM_PROMPT.split())
        # All 7 pattern lines — collapsed to single-space form
        for kw in [
            "LW-1 <name> is the complainant",
            "is an eyewitness and injured",
            "is a panch witness",
            "is the medical officer who issued",
            "is the first Investigating Officer",
            "is the Investigating Officer who filed",
            "The accused A1 <name>",
        ]:
            self.assertIn(kw, normalized, f"Missing tag pattern: {kw!r}")

    def test_para_10_includes_reference_example_from_case_100(self):
        normalized = " ".join(SYSTEM_PROMPT.split())
        self.assertIn("LW-1 Jangiti Aruna is the complainant", normalized)
        self.assertIn("LWs 2 to 4 are eyewitnesses", normalized)
        self.assertIn("LW-5 and LW-6 are panch", normalized)
        self.assertIn("LW-7 Dr. A.", normalized)
        self.assertIn("The accused A1 Pothi Narayana", normalized)

    def test_para_10_has_forbidden_list(self):
        # The prompt explicitly enumerates 3 forbidden patterns
        self.assertIn("FORBIDDEN in ¶10", SYSTEM_PROMPT)
        normalized = " ".join(SYSTEM_PROMPT.split())
        # The pattern "plain name without tag" forbidden example
        self.assertIn("Plain names anywhere without their LW", normalized)

    def test_rule_r2_strengthened_for_v5(self):
        # R2 now explicitly says "Plain names are FORBIDDEN" with V5.0
        self.assertIn("V5.0 — added 2026-06", SYSTEM_PROMPT)
        self.assertIn("are FORBIDDEN", SYSTEM_PROMPT)


class TestVerifierC13Check(unittest.TestCase):

    def test_verifier_has_c13_audit_check(self):
        self.assertIn("C13", REVIEWER_SYSTEM_PROMPT)
        self.assertIn("¶10 EVIDENCE CONCLUSION MISSING LW/A TAGS",
                      REVIEWER_SYSTEM_PROMPT)
        self.assertIn('"C13_para10_missing_lw_a_tags"',
                      REVIEWER_SYSTEM_PROMPT)

    def test_verifier_lists_all_5_tag_patterns_in_c13(self):
        # The C13 check should list complainant + eyewitness + panch
        # + doctor + accused patterns (use normalized whitespace)
        normalized = " ".join(REVIEWER_SYSTEM_PROMPT.split())
        for kw in [
            'LW-1 <name>, the complainant',
            'LW-<n> <name> is an eyewitness',
            'LW-<n> <name> is a panch witness',
            'LW-<n> Dr.',
            'The accused A1 <name>',
        ]:
            self.assertIn(kw, normalized, f"Missing C13 pattern: {kw!r}")

    def test_verifier_audit_section_count_now_says_thirteen(self):
        self.assertIn("THIRTEEN MANDATORY AUDIT CHECKS", REVIEWER_SYSTEM_PROMPT)


if __name__ == "__main__":
    unittest.main()
