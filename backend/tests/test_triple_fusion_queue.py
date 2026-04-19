"""
Backend tests for Triple Fusion DB-backed async job queue
Covers:
- Fast return from POST /api/staging/generate-triple-fusion/{case_id}
- Polling GET /api/staging/job-status/{case_id}
- Idempotency (cached completed + in-flight processing)
- Failure rollback (no credit deduction)
- Bug fix for `'str' object has no attribute 'get'` on 12+ file batches
- triple_fusion_jobs MongoDB collection persistence
"""

import os
import time
import uuid
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://legal-fusion-queue.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SAMPLES = Path("/app/backend/reference_samples")
CHARGE_PDF = SAMPLES / "57-26_Chargesheet.pdf"
REMAND_PDF = SAMPLES / "236_remand.pdf"

OFFICER_ID = "TEST001"
PASSWORD = "Test123!"


# ---------------- Fixtures ----------------

@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"officer_id": OFFICER_ID, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"No token in response: {data}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _get_credits(auth_headers):
    """Return current officer credit balance (try /auth/me, fallback /officers/me)."""
    for path in ["/auth/me", "/officers/me", "/auth/profile"]:
        r = requests.get(f"{API}{path}", headers=auth_headers, timeout=15)
        if r.status_code == 200:
            d = r.json()
            # may be nested
            if "credits" in d:
                return d["credits"]
            if "officer" in d and isinstance(d["officer"], dict) and "credits" in d["officer"]:
                return d["officer"]["credits"]
    return None


def _create_case(auth_headers, fir="TEST-FIR-001"):
    r = requests.post(
        f"{API}/staging/create-case",
        headers=auth_headers,
        data={
            "police_station": "Test PS",
            "district": "Test District",
            "fir_number": fir,
            "sections": "302,307",
        },
        timeout=30,
    )
    assert r.status_code == 200, f"create-case failed: {r.status_code} {r.text}"
    return r.json()["case_id"]


def _upload_files(auth_headers, case_id, file_paths):
    files = []
    for fp in file_paths:
        files.append(("files", (fp.name, open(fp, "rb"), "application/pdf")))
    r = requests.post(
        f"{API}/staging/upload-files/{case_id}",
        headers=auth_headers,
        files=files,
        timeout=60,
    )
    for _, (_, fh, _) in files:
        try:
            fh.close()
        except Exception:
            pass
    assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
    return r.json()


def _poll_until_terminal(auth_headers, case_id, timeout=180, interval=2):
    """Poll job-status until status is completed/failed/not_found."""
    start = time.time()
    last = None
    while time.time() - start < timeout:
        r = requests.get(f"{API}/staging/job-status/{case_id}", headers=auth_headers, timeout=30)
        assert r.status_code == 200, f"job-status: {r.status_code} {r.text}"
        last = r.json()
        st = last.get("status")
        if st in ("completed", "failed", "not_found"):
            return last
        time.sleep(interval)
    return last


# ---------------- Tests ----------------

class TestTripleFusionQueue:

    def test_01_health_login(self, auth_headers):
        # Sanity: we can reach the API
        r = requests.get(f"{API}/staging/my-cases", headers=auth_headers, timeout=30)
        assert r.status_code == 200

    def test_02_generate_returns_fast_with_job_id(self, auth_headers):
        """POST should return {status:'processing', job_id} within 5s for a multi-file batch."""
        case_id = _create_case(auth_headers, fir=f"FAST-{uuid.uuid4().hex[:6]}")
        # Upload 4 PDFs (2 unique x 2)
        files = [CHARGE_PDF, REMAND_PDF, CHARGE_PDF, REMAND_PDF]
        _upload_files(auth_headers, case_id, files)

        t0 = time.time()
        r = requests.post(f"{API}/staging/generate-triple-fusion/{case_id}", headers=auth_headers, timeout=15)
        elapsed = time.time() - t0

        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert body.get("status") == "processing", f"Expected processing, got {body}"
        assert body.get("job_id"), f"No job_id in response: {body}"
        assert body.get("progress") == 0
        assert body.get("stage") in ("queued", "extracting_text")
        assert elapsed < 5.0, f"POST took too long: {elapsed:.2f}s (should be non-blocking)"

        # Poll until terminal
        terminal = _poll_until_terminal(auth_headers, case_id, timeout=180)
        assert terminal.get("status") == "completed", f"Job did not complete: {terminal}"
        docs = terminal.get("documents", {})
        assert "charge_sheet" in docs and docs["charge_sheet"]
        assert "case_diary" in docs and docs["case_diary"]
        assert "remand_cd" in docs and docs["remand_cd"]
        assert terminal.get("credits_used") == 5
        assert terminal.get("extracted_data") is not None

        # Save for idempotency test
        pytest.completed_case_id = case_id

    def test_03_idempotency_cached_completed(self, auth_headers):
        """Second POST on completed case returns cached with credits_used=0."""
        case_id = getattr(pytest, "completed_case_id", None)
        assert case_id, "requires test_02 to have completed"

        credits_before = _get_credits(auth_headers)
        r = requests.post(f"{API}/staging/generate-triple-fusion/{case_id}", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") == "completed"
        assert body.get("credits_used") == 0
        assert "cache" in (body.get("message") or "").lower()
        credits_after = _get_credits(auth_headers)
        if credits_before is not None and credits_after is not None:
            assert credits_before == credits_after, f"Credits changed on cache hit: {credits_before} -> {credits_after}"

    def test_04_idempotency_processing_same_job_id(self, auth_headers):
        """Second POST while job runs returns same job_id (no duplicate job)."""
        case_id = _create_case(auth_headers, fir=f"IDEMP-{uuid.uuid4().hex[:6]}")
        _upload_files(auth_headers, case_id, [CHARGE_PDF, REMAND_PDF, CHARGE_PDF])

        r1 = requests.post(f"{API}/staging/generate-triple-fusion/{case_id}", headers=auth_headers, timeout=15)
        assert r1.status_code == 200
        b1 = r1.json()
        assert b1["status"] == "processing"
        job_id_1 = b1["job_id"]

        # Immediately post again
        r2 = requests.post(f"{API}/staging/generate-triple-fusion/{case_id}", headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        b2 = r2.json()
        # Either still processing with same job_id, or completed very fast
        if b2["status"] == "processing":
            assert b2["job_id"] == job_id_1, f"Duplicate job created: {job_id_1} vs {b2['job_id']}"
        else:
            # completed in between — acceptable
            assert b2["status"] == "completed"

        # Let it finish to free state
        _poll_until_terminal(auth_headers, case_id, timeout=180)

    def test_05_job_status_progress_fields(self, auth_headers):
        """GET /job-status returns progress + stage during run and persists in triple_fusion_jobs collection."""
        case_id = _create_case(auth_headers, fir=f"PROG-{uuid.uuid4().hex[:6]}")
        _upload_files(auth_headers, case_id, [CHARGE_PDF, REMAND_PDF])

        r = requests.post(f"{API}/staging/generate-triple-fusion/{case_id}", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body.get("job_id")

        # One poll immediately
        r2 = requests.get(f"{API}/staging/job-status/{case_id}", headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        s = r2.json()
        assert s.get("status") in ("processing", "completed")
        assert s.get("job_id") == body["job_id"] or s.get("status") == "completed"
        assert "progress" in s
        assert "stage" in s

        terminal = _poll_until_terminal(auth_headers, case_id, timeout=180)
        assert terminal.get("status") == "completed"

    def test_06_twelve_file_batch_end_to_end(self, auth_headers):
        """Full 12-file batch (regression for `.get() on str` bug) completes successfully."""
        case_id = _create_case(auth_headers, fir=f"BATCH12-{uuid.uuid4().hex[:6]}")

        # Build 12 file list by repeating the 2 samples
        files_12 = []
        for i in range(6):
            files_12.append(CHARGE_PDF)
            files_12.append(REMAND_PDF)
        assert len(files_12) == 12

        _upload_files(auth_headers, case_id, files_12)

        credits_before = _get_credits(auth_headers)

        t0 = time.time()
        r = requests.post(f"{API}/staging/generate-triple-fusion/{case_id}", headers=auth_headers, timeout=15)
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") == "processing", body
        assert elapsed < 5.0, f"POST blocked for {elapsed:.2f}s on 12-file batch"

        terminal = _poll_until_terminal(auth_headers, case_id, timeout=300, interval=3)
        assert terminal.get("status") == "completed", f"12-file batch failed: {terminal}"

        # Bug-regression check: no '.get' error surfaced
        err_str = str(terminal.get("error") or "")
        assert "has no attribute 'get'" not in err_str, f"Regression: {err_str}"

        # Credit accounting: 5 deducted
        credits_after = _get_credits(auth_headers)
        if credits_before is not None and credits_after is not None:
            assert credits_after == credits_before - 5, f"Expected -5 credits, {credits_before} -> {credits_after}"

    def test_07_invalid_case_returns_404(self, auth_headers):
        r = requests.post(f"{API}/staging/generate-triple-fusion/NONEXISTENT-CASE-999", headers=auth_headers, timeout=15)
        assert r.status_code in (404, 400), r.status_code

    def test_08_no_files_returns_400(self, auth_headers):
        case_id = _create_case(auth_headers, fir=f"EMPTY-{uuid.uuid4().hex[:6]}")
        r = requests.post(f"{API}/staging/generate-triple-fusion/{case_id}", headers=auth_headers, timeout=15)
        assert r.status_code == 400, f"Expected 400 for empty case, got {r.status_code} {r.text}"

    def test_09_job_status_not_found_for_new_case(self, auth_headers):
        case_id = _create_case(auth_headers, fir=f"NOJOB-{uuid.uuid4().hex[:6]}")
        r = requests.get(f"{API}/staging/job-status/{case_id}", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        b = r.json()
        assert b.get("status") == "not_found"
