"""
Tests for V3.0 Master IO endpoints — Case Diary Part-I, Remand Report, CCTNS Autofill.

These exercise the routing + schema mapping without hitting the real OpenAI API.
The actual narrative composition is unit-tested implicitly by `intelligent_charge_sheet.py`
(which uses the same prompt builder pattern).
"""
import os
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-pytest")
os.environ.setdefault("DB_NAME", "nyaya_prahari_test")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")

# ---------------------------------------------------------------------------
# Unit tests — adapter functions (pure, no LLM calls)
# ---------------------------------------------------------------------------
def test_adapt_case_diary_for_fixed_layout_minimal():
    from routers.staged_upload import _adapt_case_diary_for_fixed_layout
    out = _adapt_case_diary_for_fixed_layout({
        "fir_number": "100/2025",
        "police_station": "Makthal",
        "district": "Narayanpet",
        "sections": "126(2), 118(1) BNS",
        "io": {"salutation": "Sri.", "name": "K. Lal Singh", "rank": "HC 248"},
        "complainant": {"salutation": "Smt.", "name": "Jingiti Aruna", "father_name": "Jangiti Anjaneyulu", "relation": "W/o"},
        "accused": [{"salutation": "Smt.", "name": "Chityala Sujatha", "father_name": "Ramulu", "relation": "W/o"}],
        "witnesses_examined": [{"salutation": "Smt.", "name": "Jingiti Aruna", "father_name": "Anjaneyulu", "relation": "W/o", "role": "Complainant"}],
        "brief_facts": "A short narrative.",
        "investigation_steps": ["On 24.04.2025 ...", "On 25.04.2025 ..."],
    })
    assert out["fir_number"] == "100/2025"
    assert out["io"]["name"] == "K. Lal Singh"
    assert out["io"]["designation"] == "HC 248"
    assert out["complainant"]["name"] == "Jingiti Aruna"
    assert len(out["accused"]) == 1
    assert len(out["witnesses_examined"]) == 1
    assert len(out["investigation_steps"]) == 2
    assert out["brief_facts"] == "A short narrative."


def test_adapt_case_diary_handles_witnesses_fallback():
    """If LLM emits `witnesses` instead of `witnesses_examined`, adapter still picks them up."""
    from routers.staged_upload import _adapt_case_diary_for_fixed_layout
    out = _adapt_case_diary_for_fixed_layout({
        "witnesses": [
            {"salutation": "Smt.", "name": "A", "relation": "W/o"},
            {"salutation": "Sri.", "name": "B", "relation": "S/o"},
        ],
    })
    assert len(out["witnesses_examined"]) == 2
    assert len(out["witnesses"]) == 2


def test_adapt_remand_for_fixed_layout_minimal():
    from routers.staged_upload import _adapt_remand_for_fixed_layout
    out = _adapt_remand_for_fixed_layout({
        "fir_number": "100/2025",
        "police_station": "Makthal",
        "district": "Narayanpet",
        "sections": "126(2) BNS",
        "court_name": "JUDICIAL FIRST CLASS MAGISTRATE AT MAKTHAL",
        "io": {"salutation": "Sri.", "name": "K. Lal Singh", "rank": "HC 248"},
        "complainant": {"name": "Jingiti Aruna", "salutation": "Smt."},
        "accused": [{"name": "A1", "salutation": "Sri."}],
        "witnesses": [{"name": "W1", "salutation": "Smt."}],
        "brief_facts": "Brief facts here.",
        "investigation_done": "Investigation summary.",
        "grounds_of_arrest": "Severity of offences.",
        "remand_type": "judicial",
        "enclosures": ["FIR", "Wound certificate"],
        "escort": "PC 656",
    })
    assert out["fir_number"] == "100/2025"
    assert out["court_place"] == "MAKTHAL"
    assert out["remand_type"] == "judicial"
    assert out["io"]["name"] == "K. Lal Singh"
    assert out["enclosures"] == ["FIR", "Wound certificate"]
    assert out["escort"] == "PC 656"


def test_adapt_remand_extracts_court_place_from_uppercase_at():
    from routers.staged_upload import _adapt_remand_for_fixed_layout
    out = _adapt_remand_for_fixed_layout({
        "court_name": "Magistrate AT Hyderabad",
    })
    assert out["court_place"] == "HYDERABAD"


def test_cctns_autofill_shape_and_safe_values():
    from routers.staged_upload import _build_cctns_autofill
    cs = {
        "fir_number": "100/2025",
        "fir_date": "24.04.2025",
        "chargesheet_no": "100/2025",
        "chargesheet_date": "10.06.2026",
        "district": "Narayanpet",
        "police_station": "Makthal",
        "court": "IN THE COURT OF JFCM AT MAKTHAL",
        "sections": "126(2), 118(1), 352, 351, R/w 3(5) BNS",
        "report_type": "Charge Sheet.",
        "chargesheet_type": "Original.",
        "io": {"salutation": "Sri.", "name": "K. Lal Singh", "rank": "HC 248", "station": "Makthal"},
        "complainant": {
            "salutation": "Smt.", "name": "Jingiti Aruna",
            "father_name": "Jangiti Anjaneyulu", "relation": "W/o",
            "gender": "female", "marital_status": "married",
            "age": "44", "caste": "Mudiraj", "occupation": "Housewife",
            "address": "Yellammakunta, Makthal", "phone": "9011645665",
        },
        "accused": [
            {"salutation": "Smt.", "name": "Chityala Sujatha", "father_name": "Ramulu",
             "relation": "W/o", "gender": "female", "age": "54", "phone": "8187015150"},
            {"salutation": "Sri.", "name": "Chityala Praveen", "father_name": "Ramulu",
             "relation": "S/o", "gender": "male", "age": "31", "phone": "7036127159"},
        ],
        "witnesses": [
            {"salutation": "Smt.", "name": "Jingiti Aruna", "role": "Complainant and Injured"},
            {"salutation": "Sri.", "name": "Jangiti Anjaneylu", "role": "Eyewitness and Injured"},
        ],
        "brief_facts": "A short narrative paragraph.",
        "arrest_release": "Notice U/s 35(3) BNSS served to A1 to A2 on 28.04.2025.",
        "prayer": "Hon'ble court is prayed to try the accused.",
    }
    flat = _build_cctns_autofill(cs)
    assert flat["fir_number"] == "100/2025"
    assert flat["police_station"] == "Makthal"
    assert flat["state"] == "Telangana"
    assert flat["sections_list"] == ["126(2)", "118(1)", "352", "351", "R/w 3(5) BNS"]
    assert flat["total_accused"] == 2
    assert flat["total_witnesses"] == 2
    assert flat["complainant_name"] == "Jingiti Aruna"
    assert flat["complainant_relation"] == "W/o"
    assert flat["a1_name"] == "Chityala Sujatha"
    assert flat["a1_relation"] == "W/o"
    assert flat["a2_name"] == "Chityala Praveen"
    assert flat["a2_relation"] == "S/o"
    assert flat["lw1_role"] == "Complainant and Injured"
    assert flat["lw2_role"] == "Eyewitness and Injured"
    assert "_generated_at" in flat
    # NOT FOUND IN DOCUMENTS should collapse to "" via _safe()
    cs2 = {"fir_number": "NOT FOUND IN DOCUMENTS"}
    flat2 = _build_cctns_autofill(cs2)
    assert flat2["fir_number"] == ""


def test_cctns_autofill_empty_input_doesnt_crash():
    from routers.staged_upload import _build_cctns_autofill
    flat = _build_cctns_autofill({})
    assert flat["total_accused"] == 0
    assert flat["total_witnesses"] == 0
    assert flat["state"] == "Telangana"


def test_intelligent_case_diary_prompt_builds_without_corrections():
    from services.intelligent_case_diary import _build_user_prompt
    p = _build_user_prompt({
        "fir_number": "100/2025",
        "police_station": "Makthal",
        "district": "Narayanpet",
        "fir_date": "24.04.2025",
        "sections": "126(2) BNS",
        "court_name": "JFCM AT MAKTHAL",
        "io": {"name": "K. Lal Singh", "rank": "HC 248"},
        "ics_structured_data": {"accused": [{"name": "X"}], "witnesses": [{"name": "Y"}]},
        "documents_corpus": "FILE: fir.pdf\nThe complainant Jingiti Aruna...",
    })
    assert "CONFIRMED MANUAL INPUT" in p
    assert "FIR Number        : 100/2025" in p
    assert "K. Lal Singh" in p
    assert "FULL DOCUMENT TEXT CORPUS" in p
    assert "USER-SUPPLIED CORRECTIONS" not in p


def test_intelligent_case_diary_prompt_includes_corrections_block():
    from services.intelligent_case_diary import _build_user_prompt
    p = _build_user_prompt({
        "fir_number": "100/2025",
        "ics_structured_data": {},
        "corrections": [
            {"field": "Brief Facts paragraph", "instruction": "Add the stones detail."},
            {"field": "Steps Taken", "instruction": "Add the wound certificate step."},
        ],
        "previous_payload": {"brief_facts": "Old text"},
    })
    assert "USER-SUPPLIED CORRECTIONS" in p
    assert "Brief Facts paragraph: Add the stones detail." in p
    assert "Steps Taken: Add the wound certificate step." in p
    assert "PREVIOUSLY-GENERATED CASE DIARY JSON" in p
    assert "Old text" in p


def test_intelligent_remand_report_prompt_builds():
    from services.intelligent_remand_report import _build_user_prompt
    p = _build_user_prompt({
        "fir_number": "100/2025",
        "police_station": "Makthal",
        "district": "Narayanpet",
        "fir_date": "24.04.2025",
        "sections": "126(2) BNS",
        "court_name": "JFCM AT MAKTHAL",
        "io": {"name": "K. Lal Singh", "rank": "HC 248"},
        "ics_structured_data": {"accused": [{"name": "X"}], "witnesses": [{"name": "Y"}]},
        "documents_corpus": "FILE: fir.pdf\n…",
    })
    assert "CONFIRMED MANUAL INPUT" in p
    assert "Honoured Sir" not in p  # the SYSTEM PROMPT contains it, not user prompt
    assert "K. Lal Singh" in p


def test_intelligent_remand_report_corrections_block():
    from services.intelligent_remand_report import _build_user_prompt
    p = _build_user_prompt({
        "fir_number": "100/2025",
        "ics_structured_data": {},
        "corrections": [{"field": "Reasons for arrest", "instruction": "Add the prior animosity."}],
        "previous_payload": {"grounds_of_arrest": "Old grounds"},
    })
    assert "USER-SUPPLIED CORRECTIONS" in p
    assert "Reasons for arrest: Add the prior animosity." in p
    assert "PREVIOUSLY-GENERATED REMAND REPORT JSON" in p
    assert "Old grounds" in p


def test_intelligent_case_diary_extract_json_strips_fences():
    from services.intelligent_case_diary import _extract_json_from_response
    raw = "```json\n{\"a\": 1}\n```"
    parsed = _extract_json_from_response(raw)
    assert parsed == {"a": 1}


def test_intelligent_remand_report_extract_json_strips_fences():
    from services.intelligent_remand_report import _extract_json_from_response
    raw = "Some commentary\n{\"x\": 2}\nafter"
    parsed = _extract_json_from_response(raw)
    assert parsed == {"x": 2}
