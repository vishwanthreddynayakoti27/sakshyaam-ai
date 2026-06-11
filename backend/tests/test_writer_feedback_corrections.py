"""
Test the 2026-06 writer-feedback corrections to the prompt + verifier.

Covers the 7 items the police writer flagged:
  1. Court name dropdown (frontend — not asserted here)
  2. Panch witnesses come from CDF back side (prompt rule presence)
  3. Witness source mapping (LW-1 statements, panch from CDF,
     doctor from medical, IO always last)
  4. Endorsement section missing in Brief Facts (¶3 + C10 verifier check)
  5. Confession-cum-seizure for theft cases (prompt rule + C12)
  6. Inquest / Sec 194 panch handling (RULE 5B + C11)
  7. Sections from investigation content (RULE 4 override)
  8. Pop-up review flow (frontend — Phase 3)
  9. Sureties / convictions / absconding empty is correct (verifier C-SKIP)
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.charge_sheet_verifier import REVIEWER_SYSTEM_PROMPT
from services.intelligent_charge_sheet import SYSTEM_PROMPT, _build_user_prompt


class TestCDFAndPanchSource(unittest.TestCase):
    """Item 2 + 3 — panch witnesses come from CDF back side, not statements."""

    def test_prompt_mentions_panch_from_cdf_back_side(self):
        self.assertIn("BACK SIDE of the Crime Detail Form", SYSTEM_PROMPT)
        self.assertIn("NEVER in the statements", SYSTEM_PROMPT)

    def test_prompt_has_cdf_detection_rule_with_two_conditions(self):
        # CDF must be identified by HEADING + structured list, not by keyword
        self.assertIn("CDF DETECTION RULE", SYSTEM_PROMPT)
        self.assertIn("ACTUAL PAGE HEADING", SYSTEM_PROMPT)
        self.assertIn("SHORT STRUCTURED LIST", SYSTEM_PROMPT)
        # The "are NOT panches" warning wraps over a newline — collapse
        # whitespace before matching
        normalized = " ".join(SYSTEM_PROMPT.split())
        self.assertIn("are NOT panches", normalized)
        self.assertIn("ignore them completely", normalized)

    def test_prompt_maps_witness_sources_separately(self):
        # Item 3 source map must call out 4 distinct sources
        self.assertIn("WITNESS SOURCE MAP", SYSTEM_PROMPT)
        for kw in [
            "S.180 BNSS statements",
            "BACK SIDE of the Crime Detail Form",
            "medical certificate",
            "ALWAYS listed as the last two LWs",
        ]:
            self.assertIn(kw, SYSTEM_PROMPT, f"Missing witness-source kw: {kw}")


class TestEndorsementInBriefFacts(unittest.TestCase):
    """Item 4 — endorsement sentence must appear in Brief Facts ¶3."""

    def test_prompt_paragraph_3_now_has_endorsement_sentence(self):
        self.assertIn("FIR REGISTRATION + ENDORSEMENT", SYSTEM_PROMPT)
        self.assertIn("Sentence 2 — endorsement to IO", SYSTEM_PROMPT)
        self.assertIn("endorsed to LW-", SYSTEM_PROMPT)
        # Match across line-wraps by normalising whitespace
        normalized = " ".join(SYSTEM_PROMPT.split())
        self.assertIn("for further investigation", normalized)

    def test_verifier_has_c10_endorsement_check(self):
        self.assertIn("C10", REVIEWER_SYSTEM_PROMPT)
        self.assertIn("ENDORSEMENT MISSING", REVIEWER_SYSTEM_PROMPT)
        self.assertIn('"C10_endorsement_missing"', REVIEWER_SYSTEM_PROMPT)


class TestConfessionSeizureTheftCases(unittest.TestCase):
    """Item 5 — confession-cum-seizure for theft cases."""

    def test_prompt_has_theft_case_source_priority(self):
        self.assertIn("THEFT-CASE SOURCE PRIORITY", SYSTEM_PROMPT)
        self.assertIn("Confession-cum-Seizure", SYSTEM_PROMPT)
        self.assertIn("F-91", SYSTEM_PROMPT)

    def test_prompt_has_is_theft_case_rule_5C(self):
        self.assertIn("RULE 5C — THEFT CASE FLAG", SYSTEM_PROMPT)
        for sec in ("303", "304", "305", "306", "307", "308", "309"):
            self.assertIn(sec, SYSTEM_PROMPT)

    def test_verifier_has_c12_theft_property_check(self):
        self.assertIn("C12", REVIEWER_SYSTEM_PROMPT)
        self.assertIn("THEFT CASE WITH EMPTY PROPERTY", REVIEWER_SYSTEM_PROMPT)
        self.assertIn('"C12_theft_property_empty"', REVIEWER_SYSTEM_PROMPT)


class TestInquestSec194(unittest.TestCase):
    """Item 6 — inquest panchas don't have statements (Sec 194 BNSS)."""

    def test_prompt_has_inquest_panch_handling_in_field_13(self):
        self.assertIn("INQUEST / DEATH CASE PANCH", SYSTEM_PROMPT)
        self.assertIn('"Panch for inquest"', SYSTEM_PROMPT)
        self.assertIn("do NOT have S.180 statements", SYSTEM_PROMPT)

    def test_prompt_has_rule_5b_inquest_detection(self):
        self.assertIn("RULE 5B — INQUEST / DEATH CASE FLAG", SYSTEM_PROMPT)
        self.assertIn("is_inquest_case", SYSTEM_PROMPT)
        self.assertIn("194", SYSTEM_PROMPT)
        self.assertIn("is_death_case", SYSTEM_PROMPT)

    def test_witness_role_enum_includes_panch_for_inquest(self):
        # The role enum used by the renderer must allow this new value
        self.assertIn('"Panch for inquest"', SYSTEM_PROMPT)

    def test_verifier_has_c11_inquest_false_flag_check(self):
        self.assertIn("C11", REVIEWER_SYSTEM_PROMPT)
        self.assertIn("INQUEST PANCH FLAGGED AS MISSING STATEMENT", REVIEWER_SYSTEM_PROMPT)
        self.assertIn('"C11_inquest_panch_false_flag"', REVIEWER_SYSTEM_PROMPT)


class TestSectionsCanChange(unittest.TestCase):
    """Item 7 — sections can change between FIR and chargesheet."""

    def test_prompt_has_sections_change_rule(self):
        self.assertIn("SECTIONS-CAN-CHANGE-BETWEEN-FIR-AND-CHARGESHEET", SYSTEM_PROMPT)
        normalized = " ".join(SYSTEM_PROMPT.split())
        self.assertIn("FINAL chargesheet sections", normalized)
        self.assertIn("never silently rewrite either", normalized)


class TestSuretiesEmptyIsCorrect(unittest.TestCase):
    """Item 9 — sureties / convictions / absconding empty is CORRECT."""

    def test_verifier_has_c_skip_rule_for_11bcd(self):
        self.assertIn("C-SKIP", REVIEWER_SYSTEM_PROMPT)
        self.assertIn("11(b) SURETIES, 11(c) PREVIOUS CONVICTIONS,", REVIEWER_SYSTEM_PROMPT)
        self.assertIn("99% of the time", REVIEWER_SYSTEM_PROMPT)
        self.assertIn("Do NOT mark them as red", REVIEWER_SYSTEM_PROMPT)


class TestUserPromptWiresNewFlags(unittest.TestCase):
    """The user-prompt builder must surface the new manual-input flags
    (is_death_case, is_theft_case_override) so the LLM can see them."""

    def test_user_prompt_includes_death_case_override(self):
        prompt = _build_user_prompt({
            "is_death_case": True,
            "fir_number": "100/2025",
        })
        self.assertIn("Death/Inquest case flag", prompt)
        self.assertIn("YES", prompt)

    def test_user_prompt_includes_theft_case_override(self):
        prompt = _build_user_prompt({
            "is_theft_case_override": True,
            "fir_number": "100/2025",
        })
        self.assertIn("Theft case flag", prompt)
        self.assertIn("YES", prompt)

    def test_user_prompt_default_no_override(self):
        prompt = _build_user_prompt({"fir_number": "100/2025"})
        self.assertIn("auto-detect from sections", prompt)


class TestJSONSchemaHasNewKeys(unittest.TestCase):
    """The output-JSON schema in SYSTEM_PROMPT must declare the new flags."""

    def test_schema_has_endorsing_officer(self):
        self.assertIn('"endorsing_officer"', SYSTEM_PROMPT)

    def test_schema_has_is_inquest_case(self):
        self.assertIn('"is_inquest_case"', SYSTEM_PROMPT)

    def test_schema_has_is_theft_case(self):
        self.assertIn('"is_theft_case"', SYSTEM_PROMPT)


if __name__ == "__main__":
    unittest.main()
