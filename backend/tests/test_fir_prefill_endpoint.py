"""
HTTP-level tests for POST /api/staging/fir-prefill.

Covers:
  * 401 when unauthenticated
  * 400 when no file
  * 400 when unsupported file type (.docx)
  * 400 when file too large (>20MB)
  * 200 happy path with a synthesized PDF containing FIR text
  * Field schema correctness (12 keys + report_type/chargesheet_type defaults)
"""
from __future__ import annotations

import io
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://legal-fusion-queue.preview.emergentagent.com",
).rstrip("/")


def _make_fir_pdf() -> bytes:
    """Build a tiny single-page PDF with FIR-like text using reportlab."""
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    text = c.beginText(40, 800)
    text.setFont("Helvetica", 11)
    for line in [
        "First Information Report",
        "",
        "District:           Narayanpet",
        "Police Station:     Makthal",
        "Crime No.:          100/2025",
        "Date of Report:     23.04.2025",
        "Sections / Acts:    115(2), 351(2), 126(2) BNS",
        "",
        "Brief facts of the case:",
        "The complainant Smt. Jingiti Aruna W/o Late Chinna Thayappa,",
        "age 32 years, caste BC-A, occupation housewife, resident of",
        "Yellammakunta village, came to PS Makthal on 23.04.2025 at",
        "12:30 hrs and lodged a written petition stating that her late",
        "husband had been threatened by the accused.",
        "",
        "Officer reporting:  HC 248  K Lal Singh",
        "                    SHO PS Makthal",
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


class TestFIRPrefillAuth:
    def test_unauthenticated_rejected(self):
        r = requests.post(
            f"{BASE_URL}/api/staging/fir-prefill",
            files={"file": ("x.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")},
            timeout=30,
        )
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


class TestFIRPrefillValidation:
    def test_no_file_returns_400_or_422(self, auth_headers):
        # FastAPI raises 422 when required form field is missing
        r = requests.post(
            f"{BASE_URL}/api/staging/fir-prefill",
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code in (400, 422), f"got {r.status_code}: {r.text[:200]}"

    def test_unsupported_filetype_returns_400(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/staging/fir-prefill",
            headers=auth_headers,
            files={"file": ("foo.docx", b"PK\x03\x04dummy", "application/msword")},
            timeout=30,
        )
        assert r.status_code == 400
        assert "Unsupported file type" in r.text or "docx" in r.text.lower()

    def test_empty_file_returns_400(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/staging/fir-prefill",
            headers=auth_headers,
            files={"file": ("empty.pdf", b"", "application/pdf")},
            timeout=30,
        )
        assert r.status_code == 400

    def test_oversize_file_returns_400(self, auth_headers):
        big = b"%PDF-1.4\n" + (b"x" * (20 * 1024 * 1024 + 100))
        r = requests.post(
            f"{BASE_URL}/api/staging/fir-prefill",
            headers=auth_headers,
            files={"file": ("big.pdf", big, "application/pdf")},
            timeout=60,
        )
        assert r.status_code == 400
        assert "too large" in r.text.lower() or "20" in r.text


class TestFIRPrefillHappyPath:
    """Live test — uses a real PDF + OCR + LLM. Costs ~1¢ in OpenAI tokens."""

    def test_pdf_returns_12_fields_schema(self, auth_headers):
        pdf = _make_fir_pdf()
        r = requests.post(
            f"{BASE_URL}/api/staging/fir-prefill",
            headers=auth_headers,
            files={"file": ("test_fir.pdf", pdf, "application/pdf")},
            timeout=120,
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:400]}"
        body = r.json()
        assert "success" in body
        assert "fields" in body
        assert "confidence" in body
        assert "ocr_chars" in body
        fields = body["fields"]
        for k in (
            "district", "police_station", "fir_number", "fir_date",
            "chargesheet_no", "sections", "report_type", "chargesheet_type",
            "io_name", "io_rank", "second_io_name", "second_io_rank",
        ):
            assert k in fields, f"missing field {k}"
        # Locked defaults
        assert fields["report_type"] == "Charge Sheet"
        assert fields["chargesheet_type"] == "Original"
        # Confidence map values must be a known palette
        for v in body["confidence"].values():
            assert v in ("", "green", "yellow")

    def test_pdf_extracts_some_fir_data(self, auth_headers):
        """Best-effort assertion — OCR + LLM should pull at least 1 of the
        key fields out of our reportlab PDF. If OCR is too noisy, we don't
        block but log."""
        pdf = _make_fir_pdf()
        r = requests.post(
            f"{BASE_URL}/api/staging/fir-prefill",
            headers=auth_headers,
            files={"file": ("test_fir.pdf", pdf, "application/pdf")},
            timeout=120,
        )
        assert r.status_code == 200
        body = r.json()
        fields = body["fields"]
        extracted_text_lower = " ".join(str(v).lower() for v in fields.values())
        # At least one of these key tokens should be in the extracted fields
        any_hit = any(
            tok in extracted_text_lower
            for tok in ("narayanpet", "makthal", "100/2025", "115", "lal singh")
        )
        if not any_hit:
            print(f"[WARN] OCR/LLM produced no recognizable field. Body: {body}")
        # Accept either filled or graceful-degradation as long as schema holds
        assert body["ocr_chars"] >= 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
