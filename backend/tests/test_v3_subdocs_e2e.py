"""
End-to-end backend test suite for V3.0 Master IO pipeline endpoints
for Case Diary Part-I, Remand Report and CCTNS Autofill.

Uses live backend at REACT_APP_BACKEND_URL with pc72 admin credentials and
the pre-prepared case CASE-20260610073343-C30D (FIR 100/2025).
"""
import os
import json
import pytest
import requests

# Resolve BASE_URL from frontend/.env (no defaults — fail fast if missing)
def _resolve_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        env_path = "/app/frontend/.env"
        if os.path.exists(env_path):
            with open(env_path) as fh:
                for line in fh:
                    line = line.strip()
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
    if not url:
        raise RuntimeError("REACT_APP_BACKEND_URL not set")
    return url.rstrip("/")

BASE_URL = _resolve_base_url()
CASE_ID = "CASE-20260610073343-C30D"
OFFICER_ID = "pc72"
PASSWORD = "Test123!"

# ---------- fixtures ----------
@pytest.fixture(scope="module")
def token():
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"officer_id": OFFICER_ID, "password": PASSWORD},
        timeout=30,
    )
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text[:300]}"
    data = resp.json()
    assert "token" in data
    return data["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module", autouse=True)
def ensure_credits(auth_headers):
    """Top up credits so all generations succeed."""
    try:
        requests.post(
            f"{BASE_URL}/api/admin/grant-credits/{OFFICER_ID}",
            headers=auth_headers,
            json={"amount": 20, "reason": "test top-up"},
            timeout=30,
        )
    except Exception:
        # Non-fatal — officer already has 344+ credits
        pass


# ---------- 1. Pre-condition: ICGS must exist ----------
def test_icgs_exists(auth_headers):
    resp = requests.get(
        f"{BASE_URL}/api/staging/intelligent-chargesheet/{CASE_ID}",
        headers=auth_headers,
        timeout=60,
    )
    assert resp.status_code == 200, f"Status {resp.status_code} body {resp.text[:300]}"
    body = resp.json()
    assert body.get("success") is True
    sd = body.get("structured_data") or {}
    assert sd.get("fir_number") == "100/2025"


# ---------- 2. Auth gate (no Bearer token) ----------
def test_auth_gate_generate_case_diary_no_token():
    resp = requests.post(
        f"{BASE_URL}/api/staging/generate-intelligent-case-diary/{CASE_ID}",
        timeout=30,
    )
    assert resp.status_code in (401, 403), f"Expected 401/403, got {resp.status_code}"


def test_auth_gate_generate_remand_report_no_token():
    resp = requests.post(
        f"{BASE_URL}/api/staging/generate-intelligent-remand-report/{CASE_ID}",
        timeout=30,
    )
    assert resp.status_code in (401, 403)


def test_auth_gate_cctns_no_token():
    resp = requests.get(
        f"{BASE_URL}/api/staging/cctns-autofill/{CASE_ID}",
        timeout=30,
    )
    assert resp.status_code in (401, 403)


# ---------- 3. Case Diary generation (POST) ----------
def test_generate_intelligent_case_diary(auth_headers):
    resp = requests.post(
        f"{BASE_URL}/api/staging/generate-intelligent-case-diary/{CASE_ID}",
        headers=auth_headers,
        timeout=180,
    )
    assert resp.status_code == 200, f"Status {resp.status_code} body {resp.text[:400]}"
    # DOCX attachment
    cd = resp.headers.get("Content-Disposition", "")
    assert "IntelligentCaseDiary" in cd, f"Bad CD header: {cd}"
    assert "X-Steps-Count" in resp.headers
    try:
        steps = int(resp.headers.get("X-Steps-Count", "0"))
    except ValueError:
        steps = 0
    assert steps >= 5, f"X-Steps-Count={steps}"
    assert "gpt" in resp.headers.get("X-Model-Used", "").lower()
    ctype = resp.headers.get("Content-Type", "")
    assert ("officedocument" in ctype) or ("octet-stream" in ctype) or ("wordprocessingml" in ctype), ctype
    assert len(resp.content) > 5000, f"DOCX too small: {len(resp.content)}"


# ---------- 4. Case Diary fetch (GET) ----------
def test_get_intelligent_case_diary(auth_headers):
    resp = requests.get(
        f"{BASE_URL}/api/staging/intelligent-case-diary/{CASE_ID}",
        headers=auth_headers,
        timeout=60,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("success") is True
    sd = body.get("structured_data") or {}
    assert sd.get("fir_number") == "100/2025"
    assert sd.get("police_station") == "Makthal"
    assert sd.get("district") == "Narayanpet"
    io = sd.get("io") or {}
    assert io.get("name") == "K. Lal Singh"
    assert io.get("rank") == "HC 248"
    steps = sd.get("investigation_steps") or []
    assert isinstance(steps, list)
    assert len(steps) >= 5, f"investigation_steps too short: {len(steps)}"


# ---------- 5. Remand report generation (POST) ----------
def test_generate_intelligent_remand_report(auth_headers):
    resp = requests.post(
        f"{BASE_URL}/api/staging/generate-intelligent-remand-report/{CASE_ID}",
        headers=auth_headers,
        timeout=180,
    )
    assert resp.status_code == 200, f"Status {resp.status_code} body {resp.text[:400]}"
    cd = resp.headers.get("Content-Disposition", "")
    assert "IntelligentRemandReport" in cd, f"Bad CD header: {cd}"
    assert "gpt" in resp.headers.get("X-Model-Used", "").lower()
    er = resp.headers.get("X-Extraction-Report", "")
    # Header may be JSON or k=v string; accept both
    assert "total_accused" in er and "6" in er, f"X-Extraction-Report: {er}"
    assert "total_witnesses" in er and "9" in er, f"X-Extraction-Report: {er}"
    assert len(resp.content) > 5000


# ---------- 6. Remand fetch (GET) ----------
def test_get_intelligent_remand_report(auth_headers):
    resp = requests.get(
        f"{BASE_URL}/api/staging/intelligent-remand-report/{CASE_ID}",
        headers=auth_headers,
        timeout=60,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("success") is True
    sd = body.get("structured_data") or {}
    assert sd.get("fir_number") == "100/2025"
    io = sd.get("io") or {}
    assert io.get("name") == "K. Lal Singh"
    accused = sd.get("accused") or []
    witnesses = sd.get("witnesses") or sd.get("witnesses_examined") or []
    assert len(accused) == 6, f"accused length {len(accused)}"
    assert len(witnesses) == 9, f"witnesses length {len(witnesses)}"
    assert sd.get("brief_facts"), "brief_facts empty"
    assert sd.get("investigation_done"), "investigation_done empty"
    assert sd.get("grounds_of_arrest"), "grounds_of_arrest empty"
    assert (sd.get("remand_type") or "").lower() == "judicial"
    enc = sd.get("enclosures") or []
    assert isinstance(enc, list) and len(enc) > 0, f"enclosures empty: {enc}"


# ---------- 7. Regenerate case diary (Edit & Regenerate cascade) ----------
def test_regenerate_case_diary(auth_headers):
    body = {
        "corrections": [
            {
                "field": "Brief Facts paragraph",
                "instruction": "Add explicit mention of the death ceremony of Chinna Thayappa.",
            }
        ]
    }
    resp = requests.post(
        f"{BASE_URL}/api/staging/regenerate-case-diary/{CASE_ID}",
        headers=auth_headers,
        json=body,
        timeout=240,
    )
    assert resp.status_code == 200, f"Status {resp.status_code} body {resp.text[:400]}"
    assert resp.headers.get("X-Corrections-Count") == "1"
    try:
        regen = int(resp.headers.get("X-Regeneration-Count", "0"))
    except ValueError:
        regen = 0
    assert regen >= 1
    cascade = resp.headers.get("X-Cascade-Report", "")
    assert cascade, "X-Cascade-Report header missing"
    assert ("Brief Facts" in cascade) or ("Chinna Thayappa" in cascade) or ("death ceremony" in cascade.lower()), cascade[:300]


# ---------- 8. Regenerate remand report ----------
def test_regenerate_remand_report(auth_headers):
    body = {
        "corrections": [
            {
                "field": "Grounds for arrest",
                "instruction": "Strengthen the necessity for judicial remand.",
            }
        ]
    }
    resp = requests.post(
        f"{BASE_URL}/api/staging/regenerate-remand-report/{CASE_ID}",
        headers=auth_headers,
        json=body,
        timeout=240,
    )
    assert resp.status_code == 200, f"Status {resp.status_code} body {resp.text[:400]}"
    cd = resp.headers.get("Content-Disposition", "")
    assert "rev1" in cd.lower() or "v1" in cd.lower() or "rev" in cd.lower(), f"CD missing rev marker: {cd}"
    assert resp.headers.get("X-Cascade-Report"), "X-Cascade-Report header missing"


# ---------- 9. CCTNS autofill ----------
def test_cctns_autofill(auth_headers):
    resp = requests.get(
        f"{BASE_URL}/api/staging/cctns-autofill/{CASE_ID}",
        headers=auth_headers,
        timeout=60,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("success") is True, f"Body: {body}"
    af = body.get("cctns_autofill") or {}
    assert af.get("fir_number") == "100/2025"
    assert af.get("state") == "Telangana"
    assert isinstance(af.get("sections_list"), list)
    assert af.get("io_name") == "K. Lal Singh"
    assert af.get("io_rank") == "HC 248"
    assert af.get("total_accused") == 6
    assert af.get("total_witnesses") == 9
    assert af.get("complainant_name") == "Jingiti Aruna"
    assert af.get("complainant_relation") == "W/o"
    assert isinstance(af.get("a1_name"), str) and af.get("a1_name")
    assert isinstance(af.get("a6_name"), str) and af.get("a6_name")
    assert isinstance(af.get("lw1_role"), str)
    assert isinstance(af.get("lw9_role"), str)


# ---------- 10. Error handling ----------
def test_cctns_invalid_case(auth_headers):
    resp = requests.get(
        f"{BASE_URL}/api/staging/cctns-autofill/INVALID-CASE-ID",
        headers=auth_headers,
        timeout=30,
    )
    # Accept either success=false in 200 OR 4xx
    if resp.status_code == 200:
        body = resp.json()
        assert body.get("success") is False, f"Expected success=false: {body}"
    else:
        assert resp.status_code in (400, 404), f"Status {resp.status_code}"


def test_regenerate_case_diary_empty_corrections(auth_headers):
    resp = requests.post(
        f"{BASE_URL}/api/staging/regenerate-case-diary/{CASE_ID}",
        headers=auth_headers,
        json={"corrections": []},
        timeout=30,
    )
    assert resp.status_code == 400, f"Status {resp.status_code} body {resp.text[:300]}"


def test_generate_case_diary_missing_icgs(auth_headers):
    resp = requests.post(
        f"{BASE_URL}/api/staging/generate-intelligent-case-diary/SOME-FAKE-CASE",
        headers=auth_headers,
        timeout=30,
    )
    assert resp.status_code == 400, f"Status {resp.status_code} body {resp.text[:300]}"
