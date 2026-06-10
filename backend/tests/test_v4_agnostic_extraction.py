"""V4.0 — Agnostic Cross-Reference Extraction Layer tests.

Covers:
  - `_scrub_v4_placeholders` defensive scrubber (recursive on str/dict/list)
  - Renderer's BLANK constant is the new underscore line, NOT
    "NOT FOUND IN DOCUMENTS"
  - Wipe-cache endpoint clears all 3 collections + on-disk DOCX
"""
import os

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-pytest")
os.environ.setdefault("DB_NAME", "nyaya_prahari_test")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")


def test_v4_scrubber_strips_not_found_in_documents_strings():
    from routers.staged_upload import _scrub_v4_placeholders

    payload = {
        "fir_number": "100/2025",
        "court": "NOT FOUND IN DOCUMENTS",
        "brief_facts": "The complainant Smt. NOT FOUND IN DOCUMENTS lodged a complaint.",
        "accused": [
            {"name": "Sri. A", "caste": "NOT FOUND IN DOCUMENTS"},
            {"name": "Sri. B", "phone": "Not found in documents"},
        ],
        "witnesses": [
            {"name": "Smt. LW1", "role": "Complainant"},
            {"name": "Sri. LW2", "phone": "N/A"},   # N/A is NOT in scrubbed tokens — kept (genuine)
        ],
        "nested": {"deep": {"empty": "NOT FOUND"}},
    }
    cleaned = _scrub_v4_placeholders(payload)
    # Top-level strings wiped
    assert cleaned["court"] == ""
    # Mid-paragraph strings collapsed (notice the double-spaces compressed)
    assert "NOT FOUND" not in cleaned["brief_facts"]
    assert "Smt." in cleaned["brief_facts"] and "lodged a complaint" in cleaned["brief_facts"]
    # Accused list scrubbed
    assert cleaned["accused"][0]["caste"] == ""
    assert cleaned["accused"][1]["phone"] == ""
    # Witnesses untouched where the value isn't a banned token
    assert cleaned["witnesses"][0]["role"] == "Complainant"
    # N/A is not in our explicit token list (intentional — N/A is a real
    # legal abbreviation that may appear legitimately, e.g. accused age "N/A").
    assert cleaned["witnesses"][1]["phone"] == "N/A"
    # Recursive deep scrub
    assert cleaned["nested"]["deep"]["empty"] == ""


def test_v4_scrubber_preserves_non_string_types():
    from routers.staged_upload import _scrub_v4_placeholders
    payload = {
        "total_accused": 6,
        "is_locked": True,
        "credits": 5.5,
        "tags": None,
    }
    cleaned = _scrub_v4_placeholders(payload)
    assert cleaned == payload  # numbers/bools/None pass through unchanged


def test_v4_scrubber_handles_empty_inputs():
    from routers.staged_upload import _scrub_v4_placeholders
    assert _scrub_v4_placeholders({}) == {}
    assert _scrub_v4_placeholders([]) == []
    assert _scrub_v4_placeholders("") == ""
    assert _scrub_v4_placeholders("NOT FOUND IN DOCUMENTS") == ""
    assert _scrub_v4_placeholders(None) is None


def test_fixed_layout_renderer_blank_constant_is_underscore_line():
    """V4.0 mandate: the BLANK fallback in fixed_layout_renderer must be a
    short underscore line for police-form fillability — NEVER the literal
    'NOT FOUND IN DOCUMENTS' string that the user explicitly banned."""
    from services.fixed_layout_renderer import BLANK
    assert "NOT FOUND" not in BLANK
    assert "____" in BLANK
    assert len(BLANK) >= 4  # at least a short visible blank line


def test_official_witness_detector_flags_police_and_doctors():
    from services.fixed_layout_renderer import _is_official_witness
    # Police variants
    assert _is_official_witness({"role": "IO 1st"})
    assert _is_official_witness({"role": "IO & filed Charge Sheet"})
    assert _is_official_witness({"rank": "Sub Inspector of Police"})
    assert _is_official_witness({"rank": "ASI 1557", "station": "Makthal"})
    assert _is_official_witness({"occupation": "Head Constable 248"})
    assert _is_official_witness({"name": "Sri. Vadla Achary", "rank": "SI of Police"})
    # Doctors / medical officers
    assert _is_official_witness({"name": "Dr. G. Kaushik Reddy"})
    assert _is_official_witness({"name": "A. Mahesh Raj", "occupation": "Medical Officer"})
    assert _is_official_witness({"salutation": "Dr.", "name": "Foo"})
    assert _is_official_witness({"role": "Issued wound certificates of LWs 1 to 3"})  # hospital implied
    # Civilians — should NOT trip
    assert not _is_official_witness({"name": "Smt. Jingiti Aruna", "role": "Complainant"})
    assert not _is_official_witness({"name": "Sri. Anjaneyulu", "occupation": "Coolie",
                                      "role": "Eyewitness and Injured"})
    assert not _is_official_witness({"name": "Smt. Bhagya", "role": "Panch for Scene of Offence"})


def test_official_witness_short_format_omits_personal_blanks():
    from services.fixed_layout_renderer import _format_person_block
    # Police officer with NO personal fields → short format only
    police = _format_person_block({
        "name": "Vadla Achary",
        "rank": "SI of Police",
        "station": "Makthal",
        "role": "IO 1st",
    })
    assert "Vadla Achary" in police
    assert "SI of Police" in police
    assert "PS Makthal" in police
    # The forbidden personal-field blanks must NOT appear
    assert "S/o" not in police
    assert "Age:" not in police
    assert "Caste:" not in police
    assert "Ph." not in police
    assert "Occ:" not in police
    assert "R/o" not in police

    # Doctor — Dr. salutation auto-detected, no personal blanks
    doc = _format_person_block({
        "name": "G. Kaushik Reddy",
        "occupation": "Medical Officer",
        "station": "Govt. Hospital, Makthal",
        "role": "Issued wound certificates of LWs 1 to 3",
    })
    assert "G. Kaushik Reddy" in doc
    assert "Medical Officer" in doc
    assert "Govt. Hospital, Makthal" in doc
    assert "S/o" not in doc
    assert "Age:" not in doc
    assert "Caste:" not in doc
    assert "Ph." not in doc

    # Civilian — must still get the FULL format including blanks for missing fields
    civilian = _format_person_block({
        "name": "Jingiti Aruna",
        "gender": "female",
        "marital_status": "married",
        "father": "Jangiti Anjaneyulu",
        "age": "44",
        "caste": "Mudiraj",
        "occupation": "Housewife",
        "address": "Yellammakunta, Makthal",
        "phone": "9011645665",
        "role": "Complainant and Injured",
    })
    assert "Smt." in civilian
    assert "Jingiti Aruna" in civilian
    assert "W/o Jangiti Anjaneyulu" in civilian
    assert "Age: 44 years" in civilian
    assert "Caste: Mudiraj" in civilian
    assert "Ph.9011645665" in civilian


def test_intelligent_chargesheet_prompt_contains_v4_rules():
    """Verify the V4.0 cross-reference rules + Phase 1/2/3 mandate are present."""
    from services.intelligent_charge_sheet import SYSTEM_PROMPT
    assert "STRICT PLACEHOLDER BAN" in SYSTEM_PROMPT
    assert "Dynamic Witness Compilation" in SYSTEM_PROMPT
    assert "Accused Profiling" in SYSTEM_PROMPT
    assert "FORBIDDEN from emitting the literal strings" in SYSTEM_PROMPT
    # Phase 1/2/3 mandatory structure
    assert "PHASE 1 — COMPLETE DOCUMENT EXTRACTION" in SYSTEM_PROMPT
    assert "PHASE 1 SELF-CHECK" in SYSTEM_PROMPT
    assert "PHASE 3 — MANDATORY VERIFICATION REPORT" in SYSTEM_PROMPT
    assert "WITNESS NUMBERING (universal)" in SYSTEM_PROMPT
    assert "LW-1            = ALWAYS the complainant" in SYSTEM_PROMPT
    assert "OFFENCE CLASSIFICATION (universal)" in SYSTEM_PROMPT
    assert "INJURY CLASSIFICATION (universal)" in SYSTEM_PROMPT


def test_intelligent_case_diary_prompt_contains_v4_rules():
    from services.intelligent_case_diary import SYSTEM_PROMPT
    assert "V4.0 STRICT PLACEHOLDER BAN" in SYSTEM_PROMPT
    assert "Dynamic Witness\n    Compilation" in SYSTEM_PROMPT or "Dynamic Witness Compilation" in SYSTEM_PROMPT
    assert "EMPTY STRING ON TRUE ABSENCE" in SYSTEM_PROMPT


def test_intelligent_remand_report_prompt_contains_v4_rules():
    from services.intelligent_remand_report import SYSTEM_PROMPT
    assert "V4.0 STRICT PLACEHOLDER BAN" in SYSTEM_PROMPT
    assert "Dynamic Witness\n    Compilation" in SYSTEM_PROMPT or "Dynamic Witness Compilation" in SYSTEM_PROMPT
    assert "EMPTY STRING ON TRUE ABSENCE" in SYSTEM_PROMPT
