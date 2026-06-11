"""
HTTP-level tests for POST /api/staging/part2-prefill (Step 0.5).

Covers:
  * 401 when unauthenticated
  * 400/422 when no file
  * 400 when unsupported file type (.docx)
  * 400 when file empty
  * 400 when file too large (>20MB)
  * 200 happy path with a Part-II PDF (endorsement text)
  * Field schema correctness (5 keys + confidence + ocr_chars)
"""
from __future__ import annotations

import io
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


def _make_part2_pdf() -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    text = c.beginText(40, 800)
    text.setFont("Helvetica", 11)
    for line in [
        "Part-II BNSS Statements",
        "",
        "District: Narayanpet | Police Station: Makthal | Cr.No. 100/2025",
        "",
        "ENDORSEMENT",
        "The above mentioned case was registered by Inspector V. Kumar on",
        "23.04.2025 at 13:15 hrs. Hence this case is endorsed to HC 248",
        "K Lal Singh, PS Makthal, for further investigation U/s 117(2),",
        "351(2), 126(2) BNS r/w 3(5) BNS.",
        "",
        "S.180 BNSS - Statement of LW-1 Jingiti Aruna",
        "[statement body]",
        "",
        "S.180 BNSS - Statement of LW-2 Bandi Pothi Lakshmi",
        "[statement body]",
    ]:
        text.textLine(line)
    c.drawText(text)
    c.showPage()
    c.save()
    return buf.getvalue()


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"officer_id": "pc72", "password": "Test123!"},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text[:200]}")
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


class TestPart2PrefillAuth:
    def test_unauthenticated_rejected(self):
        r = requests.post(
            f"{BASE_URL}/api/staging/part2-prefill",
            files={"file": ("x.pdf", b"%PDF-1.4", "application/pdf")},
            timeout=30,
        )
        assert r.status_code in (401, 403)


class TestPart2PrefillValidation:
    def test_no_file_returns_4xx(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/staging/part2-prefill",
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code in (400, 422)

    def test_unsupported_filetype_returns_400(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/staging/part2-prefill",
            headers=auth_headers,
            files={"file": ("doc.docx", b"PKfakeDocx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
            timeout=30,
        )
        assert r.status_code == 400

    def test_empty_file_returns_400(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/staging/part2-prefill",
            headers=auth_headers,
            files={"file": ("empty.pdf", b"", "application/pdf")},
            timeout=30,
        )
        assert r.status_code == 400

    def test_oversize_file_returns_400(self, auth_headers):
        big = b"%PDF-1.4\n" + (b"X" * (20 * 1024 * 1024 + 100))
        r = requests.post(
            f"{BASE_URL}/api/staging/part2-prefill",
            headers=auth_headers,
            files={"file": ("big.pdf", big, "application/pdf")},
            timeout=60,
        )
        assert r.status_code == 400


class TestPart2PrefillHappyPath:
    def test_pdf_returns_5_fields_schema(self, auth_headers):
        pdf = _make_part2_pdf()
        r = requests.post(
            f"{BASE_URL}/api/staging/part2-prefill",
            headers=auth_headers,
            files={"file": ("part2.pdf", pdf, "application/pdf")},
            timeout=120,
        )
        assert r.status_code == 200, r.text[:500]
        data = r.json()
        assert data.get("success") is True
        assert "fields" in data
        assert "confidence" in data
        assert "ocr_chars" in data
        for k in ("io_name", "io_rank", "sections",
                  "second_io_name", "second_io_rank"):
            assert k in data["fields"], f"Missing field {k}"
        # confidence color whitelist
        for k, v in data["confidence"].items():
            assert v in ("", "green", "yellow"), f"{k}={v}"

    def test_pdf_extracts_endorsement_io_and_sections(self, auth_headers):
        pdf = _make_part2_pdf()
        r = requests.post(
            f"{BASE_URL}/api/staging/part2-prefill",
            headers=auth_headers,
            files={"file": ("part2.pdf", pdf, "application/pdf")},
            timeout=120,
        )
        assert r.status_code == 200, r.text[:500]
        fields = r.json()["fields"]
        # IO from the endorsement
        assert "Lal Singh" in (fields.get("io_name") or ""), fields
        # Sections must include 117(2)
        assert "117(2)" in (fields.get("sections") or ""), fields
        assert "BNS" in (fields.get("sections") or ""), fields
        # Second IO V. Kumar registered the case (Inspector)
        assert "Kumar" in (fields.get("second_io_name") or ""), fields
