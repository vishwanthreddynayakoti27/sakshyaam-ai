"""
FIXED-LAYOUT renderers for the 3 Triple-Fusion documents:
  1. Charge Sheet (Form-VII style)
  2. Case Diary Part-I
  3. Remand Report (Sec. 187 BNSS / Section 167 CrPC)

DESIGN PRINCIPLE
================
Every layout is HARD-CODED here. We do NOT let an LLM change the structure.
The LLM is only allowed to draft *brief facts* when explicitly invoked
elsewhere — this module only assembles a deterministic skeleton and plugs in
values from `case_data`.

If a value is missing, the cell renders as `_____` (a blank line that the
officer fills by hand or in Word). NO HALLUCINATION. NO INFERENCE.

The same skeleton runs for every case — only the values change.
"""
from __future__ import annotations

import io
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Pt, Cm, RGBColor

logger = logging.getLogger(__name__)

BLANK = "_____"


# ============================================================
# Helpers
# ============================================================
def _val(d: Optional[Dict[str, Any]], *keys: str, default: str = BLANK) -> str:
    """Walk nested dict; return BLANK when missing/empty."""
    cur: Any = d or {}
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k)
        if cur is None or cur == "":
            return default
    if isinstance(cur, (list, dict)):
        return default
    return str(cur).strip() or default


def _set_cell_borders(cell):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    for side in ("top", "left", "bottom", "right"):
        b = OxmlElement(f"w:{side}")
        b.set(qn("w:val"), "single")
        b.set(qn("w:sz"), "6")
        b.set(qn("w:color"), "000000")
        borders.append(b)
    tc_pr.append(borders)


def _add_label_row(table, label: str, value: str, label_w: float = 5.0, val_w: float = 11.0):
    row = table.add_row().cells
    row[0].text = label
    row[1].text = value or BLANK
    for c in row:
        _set_cell_borders(c)
        c.paragraphs[0].runs[0].font.size = Pt(10)
    row[0].paragraphs[0].runs[0].font.bold = True
    row[0].width = Cm(label_w)
    row[1].width = Cm(val_w)


def _add_heading(doc: Document, text: str, level: int = 1, center: bool = True):
    p = doc.add_paragraph()
    if center:
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(14 if level == 1 else 12 if level == 2 else 11)


def _add_para(doc: Document, text: str, bold: bool = False, size: int = 10,
              align: int = WD_ALIGN_PARAGRAPH.LEFT):
    p = doc.add_paragraph()
    p.alignment = align
    r = p.add_run(text or "")
    r.bold = bold
    r.font.size = Pt(size)
    return p


def _make_table(doc: Document, n_rows: int, n_cols: int, widths_cm: Optional[List[float]] = None):
    t = doc.add_table(rows=n_rows, cols=n_cols)
    t.style = "Table Grid"
    if widths_cm and len(widths_cm) == n_cols:
        for i, w in enumerate(widths_cm):
            for cell in t.columns[i].cells:
                cell.width = Cm(w)
    return t


# ============================================================
# Aadhaar extraction (from already-OCR'd staged files)
# ============================================================
import re

_AADHAAR_NUM_RE = re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b")
_DOB_RE = re.compile(r"\b(?:DOB|D\.O\.B|Date of Birth|Year of Birth|YOB)[:\s]*([\d/.-]+)", re.I)
_GENDER_RE = re.compile(r"\b(Male|Female|MALE|FEMALE|M/F)\b")
_NAME_RE = re.compile(r"^[A-Z][a-zA-Z. ]{2,40}\s+[A-Z][a-zA-Z. ]{2,40}$")


def extract_aadhaar_from_files(files_meta: List[Dict[str, Any]]) -> Dict[str, str]:
    """
    Look through OCR'd uploads (each file has at minimum {filename, ocr_text or
    extracted_data}). If any file looks like an Aadhaar card, extract:
      - aadhaar_number (12 digits)
      - aadhaar_name
      - aadhaar_dob
      - aadhaar_gender
      - aadhaar_address
    Returns BLANK strings when not detected.
    """
    out = {
        "aadhaar_number": "",
        "aadhaar_name": "",
        "aadhaar_dob": "",
        "aadhaar_gender": "",
        "aadhaar_address": "",
    }
    for f in (files_meta or []):
        text = (f.get("ocr_text") or f.get("text") or "")
        if not text and isinstance(f.get("extracted_data"), dict):
            text = f["extracted_data"].get("raw_text", "") or ""
        if not text:
            continue
        if "Aadhaar" not in text and "AADHAAR" not in text and "Government of India" not in text \
                and "UIDAI" not in text and not _AADHAAR_NUM_RE.search(text):
            continue
        # 12-digit number
        m = _AADHAAR_NUM_RE.search(text)
        if m and not out["aadhaar_number"]:
            out["aadhaar_number"] = re.sub(r"\s|-", "", m.group(0))
        # DOB
        m = _DOB_RE.search(text)
        if m and not out["aadhaar_dob"]:
            out["aadhaar_dob"] = m.group(1).strip()
        # Gender
        m = _GENDER_RE.search(text)
        if m and not out["aadhaar_gender"]:
            out["aadhaar_gender"] = m.group(1).upper().replace("MALE", "Male").replace("FEMALE", "Female")
        # Name — first line that matches a 2-word title-case pattern after the header
        for line in text.splitlines()[:30]:
            line = line.strip()
            if _NAME_RE.match(line) and "Government" not in line and "Aadhaar" not in line:
                if not out["aadhaar_name"]:
                    out["aadhaar_name"] = line
                    break
        # Address — any line starting with "Address" or "S/O"/"D/O"/"W/O"
        for ln in text.splitlines():
            ls = ln.strip()
            if ls.startswith(("Address", "S/O", "D/O", "W/O", "C/O")) and not out["aadhaar_address"]:
                out["aadhaar_address"] = ls[:300]
                break
    return out


# ============================================================
# 1. CHARGE SHEET — fixed layout
# ============================================================
def render_charge_sheet(case: Dict[str, Any]) -> bytes:
    """
    Produces a fixed Form-VII style charge sheet. ALL field positions are
    hard-coded; only values vary case-to-case.
    """
    doc = Document()

    _add_heading(doc, "CHARGE SHEET", level=1)
    _add_para(doc, "(Under Section 193 of BNSS / Section 173 CrPC)",
              size=10, align=WD_ALIGN_PARAGRAPH.CENTER)
    _add_para(doc, "Form-VII", bold=True, size=10, align=WD_ALIGN_PARAGRAPH.CENTER)
    doc.add_paragraph("")

    # --- Header table: PS / FIR / Date ---
    head = _make_table(doc, 1, 4, [4.5, 4.5, 3.5, 3.5])
    cells = head.rows[0].cells
    cells[0].text = "Police Station: " + _val(case, "police_station")
    cells[1].text = "District: " + _val(case, "district")
    cells[2].text = "FIR No.: " + _val(case, "fir_number")
    cells[3].text = "Date: " + _val(case, "fir_date")
    for c in cells:
        _set_cell_borders(c)

    doc.add_paragraph("")
    _add_heading(doc, "1. Sections of Law", level=2, center=False)
    _add_para(doc, _val(case, "sections"), size=10)

    _add_heading(doc, "2. Name and Address of the Complainant", level=2, center=False)
    comp = _make_table(doc, 0, 2, [5.0, 11.0])
    _add_label_row(comp, "Name", _val(case, "complainant", "name"))
    _add_label_row(comp, "Father's / Husband's Name", _val(case, "complainant", "guardian"))
    _add_label_row(comp, "Age / Gender", _val(case, "complainant", "age_gender"))
    _add_label_row(comp, "Occupation", _val(case, "complainant", "occupation"))
    _add_label_row(comp, "Address", _val(case, "complainant", "address"))
    _add_label_row(comp, "Phone", _val(case, "complainant", "phone"))

    _add_heading(doc, "3. Particulars of the Accused", level=2, center=False)
    accused_list = case.get("accused") or [{}]
    if not isinstance(accused_list, list) or not accused_list:
        accused_list = [{}]
    for idx, acc in enumerate(accused_list, 1):
        _add_para(doc, f"A{idx}.", bold=True, size=10)
        at = _make_table(doc, 0, 2, [5.0, 11.0])
        _add_label_row(at, "Name", _val(acc, "name"))
        _add_label_row(at, "S/o (Father)", _val(acc, "father"))
        _add_label_row(at, "Age", _val(acc, "age"))
        _add_label_row(at, "Gender", _val(acc, "gender"))
        _add_label_row(at, "Occupation", _val(acc, "occupation"))
        _add_label_row(at, "Permanent Address", _val(acc, "permanent_address"))
        _add_label_row(at, "Present Address", _val(acc, "present_address"))
        _add_label_row(at, "Aadhaar Number", _val(acc, "aadhaar_number"))
        _add_label_row(at, "Phone", _val(acc, "phone"))
        _add_label_row(at, "Date of Arrest", _val(acc, "arrest_date"))
        _add_label_row(at, "Custody Status", _val(acc, "custody_status"))
        doc.add_paragraph("")

    _add_heading(doc, "4. Witnesses (LW1 — LWN)", level=2, center=False)
    wts = case.get("witnesses") or []
    if not wts:
        wts = [{}, {}, {}]  # always render at least 3 blank rows
    wt = _make_table(doc, 1, 4, [1.5, 5.5, 5.5, 3.5])
    hdr = wt.rows[0].cells
    hdr[0].text = "LW#"
    hdr[1].text = "Name"
    hdr[2].text = "Address"
    hdr[3].text = "Type"
    for c in hdr:
        _set_cell_borders(c)
        c.paragraphs[0].runs[0].font.bold = True
    for i, w in enumerate(wts, 1):
        row = wt.add_row().cells
        row[0].text = f"LW{i}"
        row[1].text = _val(w, "name")
        row[2].text = _val(w, "address")
        row[3].text = _val(w, "type")
        for c in row:
            _set_cell_borders(c)

    _add_heading(doc, "5. Brief Facts of the Case", level=2, center=False)
    _add_para(doc, _val(case, "brief_facts", default="(To be filled. Use the Narration Generator or write here.)"),
              size=10)

    _add_heading(doc, "6. Material Objects (MO 1 — MON)", level=2, center=False)
    mos = case.get("material_objects") or [{}]
    mt = _make_table(doc, 1, 3, [1.5, 9.5, 5.0])
    hdr = mt.rows[0].cells
    hdr[0].text = "MO#"
    hdr[1].text = "Description"
    hdr[2].text = "Recovered From"
    for c in hdr:
        _set_cell_borders(c)
        c.paragraphs[0].runs[0].font.bold = True
    for i, m in enumerate(mos, 1):
        row = mt.add_row().cells
        row[0].text = f"MO{i}"
        row[1].text = _val(m, "description")
        row[2].text = _val(m, "recovered_from")
        for c in row:
            _set_cell_borders(c)

    _add_heading(doc, "7. Investigation Officer", level=2, center=False)
    iot = _make_table(doc, 0, 2, [5.0, 11.0])
    _add_label_row(iot, "Name", _val(case, "io", "name"))
    _add_label_row(iot, "Designation", _val(case, "io", "designation"))
    _add_label_row(iot, "Police Station", _val(case, "police_station"))
    _add_label_row(iot, "Phone", _val(case, "io", "phone"))

    doc.add_paragraph("")
    _add_para(doc, "Place: " + _val(case, "place"), size=10)
    _add_para(doc, "Date:  " + _val(case, "today_date"), size=10)
    doc.add_paragraph("")
    _add_para(doc, "Signature of Investigating Officer", bold=True, size=10,
              align=WD_ALIGN_PARAGRAPH.RIGHT)
    _add_para(doc, "Seal of Police Station", bold=True, size=10,
              align=WD_ALIGN_PARAGRAPH.RIGHT)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ============================================================
# 2. CASE DIARY PART-I — fixed layout
# ============================================================
def render_case_diary_part1(case: Dict[str, Any]) -> bytes:
    doc = Document()
    _add_heading(doc, "CASE DIARY — PART I", level=1)
    _add_para(doc, "(Under Section 193(8) BNSS / Section 172 CrPC)",
              size=10, align=WD_ALIGN_PARAGRAPH.CENTER)
    doc.add_paragraph("")

    head = _make_table(doc, 0, 2, [5.0, 11.0])
    _add_label_row(head, "Police Station", _val(case, "police_station"))
    _add_label_row(head, "District", _val(case, "district"))
    _add_label_row(head, "FIR No.", _val(case, "fir_number"))
    _add_label_row(head, "FIR Date", _val(case, "fir_date"))
    _add_label_row(head, "Sections", _val(case, "sections"))
    _add_label_row(head, "Investigating Officer", _val(case, "io", "name"))
    _add_label_row(head, "Designation", _val(case, "io", "designation"))
    _add_label_row(head, "Diary No.", _val(case, "diary_no"))
    _add_label_row(head, "Diary Date", _val(case, "diary_date"))

    _add_heading(doc, "1. Place(s) Visited", level=2, center=False)
    _add_para(doc, _val(case, "places_visited"), size=10)

    _add_heading(doc, "2. Distance Travelled", level=2, center=False)
    _add_para(doc, _val(case, "distance_travelled"), size=10)

    _add_heading(doc, "3. Time of Departure / Arrival", level=2, center=False)
    tt = _make_table(doc, 0, 2, [5.0, 11.0])
    _add_label_row(tt, "Time of Departure from PS", _val(case, "time_departure"))
    _add_label_row(tt, "Time of Arrival at PS", _val(case, "time_arrival"))

    _add_heading(doc, "4. Witnesses Examined", level=2, center=False)
    wts = case.get("witnesses_examined") or [{}, {}]
    wt = _make_table(doc, 1, 3, [1.5, 6.0, 8.5])
    hdr = wt.rows[0].cells
    hdr[0].text = "S.No."
    hdr[1].text = "Name & Address"
    hdr[2].text = "Brief of Statement (Sec. 180/161)"
    for c in hdr:
        _set_cell_borders(c)
        c.paragraphs[0].runs[0].font.bold = True
    for i, w in enumerate(wts, 1):
        row = wt.add_row().cells
        row[0].text = str(i)
        row[1].text = _val(w, "name_address")
        row[2].text = _val(w, "statement_brief")
        for c in row:
            _set_cell_borders(c)

    _add_heading(doc, "5. Search & Seizure Conducted", level=2, center=False)
    _add_para(doc, _val(case, "search_seizure"), size=10)

    _add_heading(doc, "6. Material Objects Seized", level=2, center=False)
    _add_para(doc, _val(case, "material_seized"), size=10)

    _add_heading(doc, "7. Steps Taken / Action Today", level=2, center=False)
    _add_para(doc, _val(case, "actions_today"), size=10)

    _add_heading(doc, "8. Result / Findings", level=2, center=False)
    _add_para(doc, _val(case, "findings"), size=10)

    _add_heading(doc, "9. Next Steps Planned", level=2, center=False)
    _add_para(doc, _val(case, "next_steps"), size=10)

    doc.add_paragraph("")
    _add_para(doc, "Place: " + _val(case, "place"), size=10)
    _add_para(doc, "Date:  " + _val(case, "today_date"), size=10)
    doc.add_paragraph("")
    _add_para(doc, "Signature of Investigating Officer", bold=True,
              size=10, align=WD_ALIGN_PARAGRAPH.RIGHT)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ============================================================
# 3. REMAND REPORT — fixed layout
# ============================================================
def render_remand_report(case: Dict[str, Any]) -> bytes:
    doc = Document()
    _add_heading(doc, "REMAND REPORT", level=1)
    _add_para(doc, "(Under Section 187 of BNSS / Section 167 CrPC)",
              size=10, align=WD_ALIGN_PARAGRAPH.CENTER)
    doc.add_paragraph("")

    _add_para(doc, "To,", size=10)
    _add_para(doc, "The Hon'ble Magistrate / Court of " + _val(case, "court_name"), size=10)
    _add_para(doc, _val(case, "court_address"), size=10)
    doc.add_paragraph("")
    _add_para(doc, "Sir / Madam,", size=10)
    doc.add_paragraph("")

    head = _make_table(doc, 0, 2, [5.0, 11.0])
    _add_label_row(head, "Police Station", _val(case, "police_station"))
    _add_label_row(head, "District", _val(case, "district"))
    _add_label_row(head, "FIR No. / Date", f"{_val(case, 'fir_number')} dt. {_val(case, 'fir_date')}")
    _add_label_row(head, "Sections of Law", _val(case, "sections"))
    _add_label_row(head, "Date & Time of Arrest", _val(case, "arrest_datetime"))
    _add_label_row(head, "Date & Time of Production before Magistrate", _val(case, "production_datetime"))

    _add_heading(doc, "1. Particulars of Accused Produced", level=2, center=False)
    accused_list = case.get("accused") or [{}]
    if not isinstance(accused_list, list) or not accused_list:
        accused_list = [{}]
    for idx, acc in enumerate(accused_list, 1):
        _add_para(doc, f"A{idx}.", bold=True, size=10)
        at = _make_table(doc, 0, 2, [5.0, 11.0])
        _add_label_row(at, "Name", _val(acc, "name"))
        _add_label_row(at, "S/o (Father)", _val(acc, "father"))
        _add_label_row(at, "Age / Gender", _val(acc, "age_gender", default=_val(acc, "age")))
        _add_label_row(at, "Address", _val(acc, "permanent_address"))
        _add_label_row(at, "Aadhaar Number", _val(acc, "aadhaar_number"))
        doc.add_paragraph("")

    _add_heading(doc, "2. Brief Facts of the Case", level=2, center=False)
    _add_para(doc, _val(case, "brief_facts"), size=10)

    _add_heading(doc, "3. Grounds of Arrest", level=2, center=False)
    _add_para(doc, _val(case, "grounds_of_arrest"), size=10)

    _add_heading(doc, "4. Investigation Done So Far", level=2, center=False)
    _add_para(doc, _val(case, "investigation_done"), size=10)

    _add_heading(doc, "5. Reasons for Seeking Police / Judicial Custody", level=2, center=False)
    _add_para(doc, _val(case, "reasons_for_remand"), size=10)

    _add_heading(doc, "6. Further Investigation Required", level=2, center=False)
    _add_para(doc, _val(case, "further_investigation"), size=10)

    _add_heading(doc, "7. Remand Sought", level=2, center=False)
    rm = _make_table(doc, 0, 2, [5.0, 11.0])
    _add_label_row(rm, "Type of Remand", _val(case, "remand_type"))
    _add_label_row(rm, "Duration Sought", _val(case, "remand_duration"))
    _add_label_row(rm, "From (Date)", _val(case, "remand_from"))
    _add_label_row(rm, "To (Date)", _val(case, "remand_to"))

    doc.add_paragraph("")
    _add_para(doc, "It is therefore prayed that the Hon'ble Court may kindly be pleased to grant "
              + _val(case, "remand_type") + " custody of the accused for "
              + _val(case, "remand_duration") + " in the interest of justice.", size=10)

    doc.add_paragraph("")
    _add_para(doc, "Place: " + _val(case, "place"), size=10)
    _add_para(doc, "Date:  " + _val(case, "today_date"), size=10)
    doc.add_paragraph("")
    _add_para(doc, _val(case, "io", "name"), bold=True, size=10, align=WD_ALIGN_PARAGRAPH.RIGHT)
    _add_para(doc, _val(case, "io", "designation"), size=10, align=WD_ALIGN_PARAGRAPH.RIGHT)
    _add_para(doc, _val(case, "police_station"), size=10, align=WD_ALIGN_PARAGRAPH.RIGHT)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ============================================================
# Top-level dispatcher
# ============================================================
RENDERERS = {
    "charge_sheet": render_charge_sheet,
    "case_diary_part1": render_case_diary_part1,
    "remand_report": render_remand_report,
}


def render_fixed_doc(doc_type: str, case_data: Dict[str, Any]) -> Tuple[bytes, str]:
    """Returns (docx_bytes, suggested_filename)."""
    if doc_type not in RENDERERS:
        raise ValueError(f"Unknown doc_type: {doc_type}. Must be one of {list(RENDERERS)}")
    bytes_ = RENDERERS[doc_type](case_data)
    safe_fir = re.sub(r"[^A-Za-z0-9_-]", "_", _val(case_data, "fir_number", default="UNKNOWN"))
    fname = f"{doc_type}_{safe_fir}_{datetime.now().strftime('%Y%m%d')}.docx"
    return bytes_, fname
