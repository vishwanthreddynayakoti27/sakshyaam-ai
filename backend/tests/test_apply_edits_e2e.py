"""E2E tests for /api/staging/apply-edits/{case_id} + is_death_case persistence."""
import os
import io
import json
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
SEEDED_CASE_ID = "CASE-20260610073343-C30D"


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"officer_id": "pc72", "password": "Test123!"},
        timeout=20,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok, "No token returned"
    return tok


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ----------------------- is_death_case manual-input persistence -----------------------
class TestIsDeathCasePersistence:
    def test_create_case_with_is_death_case_true(self, auth_headers):
        data = {
            "police_station": "MAKTHAL",
            "district": "MAHABUBNAGAR",
            "fir_number": "TEST-DEATH-CASE-001",
            "is_death_case": "true",
        }
        r = requests.post(
            f"{BASE_URL}/api/staging/create-case",
            headers=auth_headers,
            data=data,
            timeout=30,
        )
        assert r.status_code == 200, f"create-case failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        case_id = body.get("case_id")
        assert case_id, f"No case_id in body: {body}"

        # GET the case and inspect metadata.manual_input.is_death_case
        g = requests.get(
            f"{BASE_URL}/api/staging/case/{case_id}",
            headers=auth_headers,
            timeout=15,
        )
        assert g.status_code == 200, f"GET case failed: {g.status_code} {g.text[:300]}"
        payload = g.json()
        meta = payload.get("metadata") or {}
        manual_input = meta.get("manual_input") or {}
        assert manual_input.get("is_death_case") is True, (
            f"Expected metadata.manual_input.is_death_case=True, got {manual_input.get('is_death_case')!r}. "
            f"Full manual_input keys: {list(manual_input.keys())}"
        )

    def test_create_case_with_is_death_case_false_default(self, auth_headers):
        data = {
            "police_station": "MAKTHAL",
            "district": "MAHABUBNAGAR",
            "fir_number": "TEST-NON-DEATH-001",
        }
        r = requests.post(
            f"{BASE_URL}/api/staging/create-case",
            headers=auth_headers,
            data=data,
            timeout=30,
        )
        assert r.status_code == 200
        case_id = r.json()["case_id"]
        g = requests.get(f"{BASE_URL}/api/staging/case/{case_id}", headers=auth_headers, timeout=15)
        manual_input = (g.json().get("metadata") or {}).get("manual_input") or {}
        assert manual_input.get("is_death_case") is False, (
            f"Default should be False, got {manual_input.get('is_death_case')!r}"
        )


# ----------------------- apply-edits endpoint -----------------------
class TestApplyEditsEndpoint:
    def test_apply_edits_simple_field(self, auth_headers):
        # Read current value of complainant.caste first to keep test independent
        gpre = requests.get(
            f"{BASE_URL}/api/staging/intelligent-chargesheet/{SEEDED_CASE_ID}",
            headers=auth_headers,
            timeout=20,
        )
        assert gpre.status_code == 200, f"Pre-GET failed: {gpre.status_code} {gpre.text[:200]}"
        sd_pre = (gpre.json().get("structured_data") or {})
        comp_pre = (sd_pre.get("complainant") or {})
        old_caste = comp_pre.get("caste", "")
        new_caste = "BC-A" if old_caste != "BC-A" else "BC-B"

        edits = [{"path": "complainant.caste", "old_value": old_caste, "new_value": new_caste}]
        r = requests.post(
            f"{BASE_URL}/api/staging/apply-edits/{SEEDED_CASE_ID}",
            headers=auth_headers,
            json={"edits": edits},
            timeout=60,
        )
        assert r.status_code == 200, f"apply-edits failed: {r.status_code} {r.text[:300]}"
        # DOCX content-type
        ctype = r.headers.get("Content-Type", "")
        assert "openxmlformats-officedocument.wordprocessingml" in ctype or "application/vnd.openxmlformats" in ctype, (
            f"Expected DOCX content-type, got: {ctype}"
        )
        # Custom headers
        assert r.headers.get("X-Cost") == "0-credits-no-llm", (
            f"Missing/wrong X-Cost header: {r.headers.get('X-Cost')}"
        )
        edits_applied = r.headers.get("X-Edits-Applied")
        assert edits_applied is not None, "Missing X-Edits-Applied header"
        assert int(edits_applied) >= 1, f"Expected >=1 edits, got {edits_applied}"
        # Body looks like DOCX (PK zip signature)
        assert r.content[:2] == b"PK", "Response body doesn't start with PK (not a DOCX zip)"

        # Verify persistence via GET
        g = requests.get(
            f"{BASE_URL}/api/staging/intelligent-chargesheet/{SEEDED_CASE_ID}",
            headers=auth_headers,
            timeout=20,
        )
        assert g.status_code == 200, f"GET failed: {g.status_code}"
        sd = (g.json().get("structured_data") or {})
        comp = (sd.get("complainant") or {})
        assert comp.get("caste") == new_caste, (
            f"Persistence failed. Expected complainant.caste={new_caste}, got {comp.get('caste')}"
        )

    def test_apply_edits_brief_facts_cascade(self, auth_headers):
        # GET current io.name + brief_facts
        g0 = requests.get(
            f"{BASE_URL}/api/staging/intelligent-chargesheet/{SEEDED_CASE_ID}",
            headers=auth_headers,
            timeout=20,
        )
        assert g0.status_code == 200
        sd0 = g0.json().get("structured_data") or {}
        io_pre = (sd0.get("io") or {})
        old_name = io_pre.get("name") or ""
        # Use a deterministic pair; ensure they differ
        new_name = "B. Ramesh"
        if old_name == new_name:
            new_name = "B. Suresh"

        edits = [{"path": "io.name", "old_value": old_name, "new_value": new_name}]
        r = requests.post(
            f"{BASE_URL}/api/staging/apply-edits/{SEEDED_CASE_ID}",
            headers=auth_headers,
            json={"edits": edits},
            timeout=60,
        )
        assert r.status_code == 200, f"apply-edits cascade failed: {r.status_code} {r.text[:300]}"
        assert r.headers.get("X-Cost") == "0-credits-no-llm"

        # Verify cascade: brief_facts should no longer contain old_name (if it appeared)
        g = requests.get(
            f"{BASE_URL}/api/staging/intelligent-chargesheet/{SEEDED_CASE_ID}",
            headers=auth_headers,
            timeout=20,
        )
        sd = g.json().get("structured_data") or {}
        assert (sd.get("io") or {}).get("name") == new_name
        brief = sd.get("brief_facts")
        # brief_facts can be string OR list of paragraphs
        brief_text = ""
        if isinstance(brief, str):
            brief_text = brief
        elif isinstance(brief, list):
            brief_text = "\n".join(str(x) for x in brief)
        elif isinstance(brief, dict):
            brief_text = json.dumps(brief)

        if old_name and len(old_name) > 1 and old_name in brief_text:
            pytest.fail(
                f"Brief-facts cascade did not replace '{old_name}'. Still present in brief_facts."
            )
        # If new_name was substituted, it should now appear (only assert if old was present originally)
