"""
FIXED-LAYOUT renderers reproducing the EXACT human-written templates from the
user's reference samples (Telangana Police, Makthal PS / Narayanpet District):

  1. Charge Sheet — Form-VII (18-row 2-col table, U/s 193 BNSS)
  2. Case Diary Part-I — header table + 8 numbered fields + narrative
  3. Remand Case Diary — Part-I letter format addressed to JMFC

DESIGN PRINCIPLE
================
The skeleton is HARD-CODED to match the real station-issued documents byte-
for-byte (layout, numbering, captions, prayer clauses, footers). NO LLM
re-arranges the structure. Missing field values render as `_____` so the
officer fills them by hand or in Word.

References used (extracted via extract_file_tool):
  * 57-26 Chargesheet.pdf  (FIR 57/2026 Makthal PS)
  * 236 remand.pdf         (FIR 236/2021 Makthal PS)
  * 57-26 CD 1.pdf         (Case Diary Part-I, FIR 57/2026)
"""
from __future__ import annotations

import io
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

logger = logging.getLogger(__name__)

BLANK = "_____"


# ============================================================
# Low-level helpers
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
    s = str(cur).strip()
    return s if s else default


def _set_borders(cell, sz: str = "6"):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    for side in ("top", "left", "bottom", "right"):
        b = OxmlElement(f"w:{side}")
        b.set(qn("w:val"), "single")
        b.set(qn("w:sz"), sz)
        b.set(qn("w:color"), "000000")
        borders.append(b)
    tc_pr.append(borders)


def _shade_cell(cell, fill: str = "DDDDDD"):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def _set_run(run, *, bold: bool = False, italic: bool = False, size: int = 11,
             color: Optional[Tuple[int, int, int]] = None):
    run.font.name = "Times New Roman"
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.append(rFonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs"):
        rFonts.set(qn(attr), "Times New Roman")
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    if color:
        run.font.color.rgb = RGBColor(*color)


def _para(doc, text: str = "", *, bold: bool = False, italic: bool = False,
          size: int = 11, align: int = WD_ALIGN_PARAGRAPH.LEFT,
          space_before: int = 0, space_after: int = 0):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    if text:
        run = p.add_run(text)
        _set_run(run, bold=bold, italic=italic, size=size)
    return p


def _cell_para(cell, text: str, *, bold: bool = False, size: int = 11,
               align: int = WD_ALIGN_PARAGRAPH.LEFT, clear_first: bool = True):
    """Replace cell content with a single paragraph styled consistently."""
    if clear_first:
        # Replace existing default paragraph
        cell.text = ""
    p = cell.paragraphs[0] if cell.paragraphs else cell.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run(text or "")
    _set_run(run, bold=bold, size=size)
    return p


def _make_table(doc, rows: int, cols: int, widths_cm: Optional[List[float]] = None):
    t = doc.add_table(rows=rows, cols=cols)
    t.style = "Table Grid"
    t.autofit = False
    if widths_cm:
        for i, w in enumerate(widths_cm):
            for cell in t.columns[i].cells:
                cell.width = Cm(w)
    for row in t.rows:
        for c in row.cells:
            _set_borders(c)
            c.vertical_alignment = WD_ALIGN_VERTICAL.TOP
    return t


def _set_margins(doc, top: float = 1.5, right: float = 1.5,
                 bottom: float = 1.5, left: float = 1.5):
    for section in doc.sections:
        section.top_margin = Cm(top)
        section.right_margin = Cm(right)
        section.bottom_margin = Cm(bottom)
        section.left_margin = Cm(left)


# ============================================================
# Person / witness formatting helpers (matches station style)
# ============================================================
def _format_person_block(p: Dict[str, Any]) -> str:
    """
    Compose a station-style person block:
    "Sri. <Name> S/o <Father>, Age: <N> years, Caste: <X>, Occ: <Y>,
     R/o <Address>, Ph.<phone>"
    Missing parts collapse to '_____' so officer can fill in.
    """
    if not isinstance(p, dict):
        return BLANK
    salutation = p.get("salutation") or ("Smt." if (p.get("gender") or "").lower().startswith("f") else "Sri.")
    name = p.get("name") or ""
    relation = p.get("relation") or "S/o"
    father = p.get("father") or p.get("guardian") or ""
    age = p.get("age") or ""
    caste = p.get("caste") or ""
    occ = p.get("occupation") or p.get("occ") or ""
    addr = p.get("address") or p.get("permanent_address") or ""
    phone = p.get("phone") or ""

    def f(v): return v if v else BLANK
    pieces = [
        f"{salutation} {f(name)}",
        f"{relation} {f(father)}",
        f"Age: {f(age)} years" if age else "Age: _____ years",
        f"Caste: {f(caste)}",
        f"Occ: {f(occ)}",
        f"R/o {f(addr)}",
    ]
    if phone:
        pieces.append(f"Ph.{phone}")
    else:
        pieces.append("Ph._____")
    return ", ".join(pieces)


def _format_io_block(io: Dict[str, Any], ps: str) -> str:
    """Sri. <Name>, <Rank> of Police PS <PS> (IO & Filed Charge sheet)"""
    if not isinstance(io, dict):
        io = {}
    name = io.get("name") or BLANK
    rank = io.get("designation") or io.get("rank") or "SI"
    return f"Sri. {name}, {rank} of Police PS {ps or BLANK} (IO & Filed Charge sheet)"


# ============================================================
# Aadhaar auto-extraction (mechanical, no AI)
# ============================================================
_AADHAAR_NUM_RE = re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b")
_DOB_RE = re.compile(r"\b(?:DOB|D\.O\.B|Date of Birth|Year of Birth|YOB)[:\s]*([\d/.\-]+)", re.I)
_GENDER_RE = re.compile(r"\b(Male|Female|MALE|FEMALE)\b")
_NAME_RE = re.compile(r"^[A-Z][a-zA-Z. ]{2,40}\s+[A-Z][a-zA-Z. ]{2,40}$")


def extract_aadhaar_from_files(files_meta: List[Dict[str, Any]]) -> Dict[str, str]:
    """Return a dict of aadhaar_* fields, BLANK strings when not detected."""
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
        if ("Aadhaar" not in text and "AADHAAR" not in text and "Government of India" not in text
                and "UIDAI" not in text and not _AADHAAR_NUM_RE.search(text)):
            continue
        m = _AADHAAR_NUM_RE.search(text)
        if m and not out["aadhaar_number"]:
            out["aadhaar_number"] = re.sub(r"\s|-", "", m.group(0))
        m = _DOB_RE.search(text)
        if m and not out["aadhaar_dob"]:
            out["aadhaar_dob"] = m.group(1).strip()
        m = _GENDER_RE.search(text)
        if m and not out["aadhaar_gender"]:
            out["aadhaar_gender"] = m.group(1).title()
        for line in text.splitlines()[:30]:
            line = line.strip()
            if _NAME_RE.match(line) and "Government" not in line and "Aadhaar" not in line:
                if not out["aadhaar_name"]:
                    out["aadhaar_name"] = line
                    break
        for ln in text.splitlines():
            ls = ln.strip()
            if ls.startswith(("Address", "S/O", "D/O", "W/O", "C/O", "S/o", "D/o", "W/o", "C/o")) \
                    and not out["aadhaar_address"]:
                out["aadhaar_address"] = ls[:300]
                break
    return out


# ============================================================
# 1. CHARGE SHEET — Telangana Form-VII (18-row table) layout
# ============================================================
# This matches the user's sample 57-26 Chargesheet.pdf exactly.
_CHARGE_SHEET_ROWS = [
    # (number, label) — Each pair is one row of the 2-column body table.
    # Row 1 is split into 4 sub-cells (handled separately below).
    ("2", "Final Report/Charge Sheet No."),
    ("3", "Date"),
    ("4", "Act/Sections."),
    ("5", "Type of Final form (charge Sheet/Untraced/not Charge sheeted for want of Evidence/Offence abated/Un occurred)"),
    ("6", "F.R. Un occurred (False/Mistake of fact/Mistake of Law/Non cognizable/Civil Nature)"),
    ("7", "If Charge sheet (Original/supplementary)"),
    ("8", "Names of the investigating officers"),
    ("9", "Name of the complaint informant with father's/Husband's name."),
    ("10", "Detail of properties/Articles/Documents Recovered/Seized during investigation and relied upon."),
]


def render_charge_sheet(case: Dict[str, Any]) -> bytes:
    doc = Document()
    _set_margins(doc, top=1.2, right=1.5, bottom=1.5, left=1.5)

    # ── Title block ────────────────────────────────────────────────
    _para(doc, "CHARGE-SHEET", bold=True, size=14, align=WD_ALIGN_PARAGRAPH.CENTER)
    _para(doc, "(UNDER SECTION 193 BNSS.)", italic=True, size=11, align=WD_ALIGN_PARAGRAPH.CENTER)
    _para(doc, "", size=4)
    court_name = _val(case, "court_name", default="JUDICIAL FIRST CLASS MAGISTRATE")
    court_place = _val(case, "court_place", default=_val(case, "place", default="MAKTHAL"))
    _para(doc, f"IN THE COURT OF {court_name.upper()}", bold=True, size=12,
          align=WD_ALIGN_PARAGRAPH.CENTER)
    _para(doc, f"AT {court_place.upper()}", bold=True, size=12, align=WD_ALIGN_PARAGRAPH.CENTER)
    _para(doc, "", size=4)

    # ── Row 1 — top header strip (PS / FIR / Date) ─────────────────
    top = _make_table(doc, 1, 1, widths_cm=[16.0])
    top_cell = top.rows[0].cells[0]
    _cell_para(
        top_cell,
        f"1.  Dist.:- {_val(case, 'district')}    "
        f"Police Station: {_val(case, 'police_station')}    "
        f"FIR. No: {_val(case, 'fir_number')}    "
        f"Dated: {_val(case, 'fir_date')}",
        bold=True, size=11,
    )

    # ── Body 2-column table — rows 2..10 ───────────────────────────
    body = _make_table(doc, 0, 2, widths_cm=[8.5, 7.5])
    for num, label in _CHARGE_SHEET_ROWS:
        row = body.add_row()
        c1, c2 = row.cells
        _cell_para(c1, f"{num}.  {label}", size=10)
        _set_borders(c1)
        # Map row → value
        val_map = {
            "2": _val(case, "charge_sheet_no"),
            "3": _val(case, "today_date", default=datetime.now().strftime("%d.%m.%Y")),
            "4": _val(case, "sections"),
            "5": _val(case, "final_report_type", default="Charge sheet"),
            "6": _val(case, "fr_unoccurred", default="---"),
            "7": _val(case, "charge_sheet_kind", default="Original"),
            "8": _format_io_block(case.get("io") or {}, _val(case, "police_station", default="")),
            "9": _format_person_block(case.get("complainant") or {}),
            "10": _val(case, "properties_seized"),
        }
        _cell_para(c2, val_map.get(num, BLANK), size=10)
        _set_borders(c2)

    # ── Row 11 — Particulars of charge-sheeted persons ────────────
    r11 = body.add_row()
    _cell_para(r11.cells[0], "11.  Particulars of charge sheeted Person.:-", size=10)
    accused = case.get("accused") or [{}]
    if not isinstance(accused, list) or not accused:
        accused = [{}]
    a_lines = []
    for i, a in enumerate(accused, 1):
        a_lines.append(f"A{i}.  {_format_person_block(a)}")
    _cell_para(r11.cells[1], "\n".join(a_lines), size=10)
    for c in r11.cells:
        _set_borders(c)

    # 11(a) Date of arrest
    for sub_label, sub_key, sub_default in [
        ("a) Date of arrest, release, Forwarded to Court.", "arrest_release", BLANK),
        ("b) Particulars of sureties if Released on bail.", "sureties", "--"),
        ("c) Previous convictions if any.", "previous_convictions", "--"),
        ("d) Particulars of accused Persons absconding.", "absconding", "--"),
    ]:
        row = body.add_row()
        _cell_para(row.cells[0], "      " + sub_label, size=10)
        _cell_para(row.cells[1], _val(case, sub_key, default=sub_default), size=10)
        for c in row.cells:
            _set_borders(c)

    # 12. Particulars of accused not charge-sheeted
    r12 = body.add_row()
    _cell_para(r12.cells[0], "12.  Particulars of accused persons not charge sheeted.", size=10)
    _cell_para(r12.cells[1], _val(case, "accused_not_chargesheeted", default="--"), size=10)
    for c in r12.cells:
        _set_borders(c)

    # 13. Witnesses
    r13 = body.add_row()
    _cell_para(r13.cells[0], "13.  Particulars of the witnesses to be examined:", bold=True, size=10)
    _cell_para(r13.cells[1], "", size=10)
    for c in r13.cells:
        _set_borders(c)

    # Witness rows — LW-1, LW-2, ...
    witnesses = case.get("witnesses") or []
    if not witnesses:
        witnesses = [{}, {}, {}]
    # The witness section uses a 3-column sub-table within the body for clarity
    doc.add_paragraph("")
    wt = _make_table(doc, 1, 3, widths_cm=[1.7, 11.0, 3.3])
    h = wt.rows[0].cells
    _cell_para(h[0], "S.No.", bold=True, size=10, align=WD_ALIGN_PARAGRAPH.CENTER)
    _cell_para(h[1], "Name and Address", bold=True, size=10, align=WD_ALIGN_PARAGRAPH.CENTER)
    _cell_para(h[2], "Role", bold=True, size=10, align=WD_ALIGN_PARAGRAPH.CENTER)
    for c in h:
        _shade_cell(c, "EEEEEE")
        _set_borders(c)
    for i, w in enumerate(witnesses, 1):
        row = wt.add_row()
        _cell_para(row.cells[0], f"LW-{i}", bold=True, size=10, align=WD_ALIGN_PARAGRAPH.CENTER)
        _cell_para(row.cells[1], _format_person_block(w), size=10)
        _cell_para(row.cells[2], _val(w, "type", default=_val(w, "role")), size=10,
                   align=WD_ALIGN_PARAGRAPH.CENTER)
        for c in row.cells:
            _set_borders(c)

    # ── Brief facts (paragraphs 14–16 of the original) ────────────
    doc.add_paragraph("")
    _para(doc, "14.  Brief facts of the case:", bold=True, size=11)
    _para(doc, _val(case, "brief_facts",
                    default="(To be filled. Use the Narration Generator or write here.)"),
          size=11, align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_after=4)

    _para(doc, "15.  Investigation done so far:", bold=True, size=11)
    _para(doc, _val(case, "investigation_done", default="(To be filled.)"),
          size=11, align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_after=4)

    _para(doc, "16.  Result of investigation:", bold=True, size=11)
    _para(doc, _val(case, "result_of_investigation",
                    default="The case is found to be true. The accused is/are charge-sheeted."),
          size=11, align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_after=4)

    _para(doc, "Hence charge sheet.", bold=True, size=11, space_before=6, space_after=6)

    # ── 17, 18 ─────────────────────────────────────────────────────
    _para(doc, f"17.  Is ack. Copy of notice to complainant enclosed: "
               f"{_val(case, 'ack_notice_enclosed', default='--')}", size=11)
    _para(doc, f"18.  Dispatched on: {_val(case, 'dispatch_date', default=BLANK)}",
          size=11, space_after=20)

    # ── Signature block ────────────────────────────────────────────
    _para(doc, "Signature of the Investigation officer", bold=True, size=11,
          align=WD_ALIGN_PARAGRAPH.RIGHT)
    _para(doc, "Submitting charge-sheet.", italic=True, size=10,
          align=WD_ALIGN_PARAGRAPH.RIGHT, space_after=8)
    _para(doc, f"Name:  {_val(case, 'io', 'name')}", size=11, align=WD_ALIGN_PARAGRAPH.RIGHT)
    _para(doc, f"Rank:  {_val(case, 'io', 'designation')}, of PS {_val(case, 'police_station')}",
          size=11, align=WD_ALIGN_PARAGRAPH.RIGHT)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ============================================================
# 2. CASE DIARY PART-I — Telangana CD format
# ============================================================
# Matches the user's sample 57-26 CD 1.pdf exactly:
#   header strip (PS / Dist / FIR / Date-place / CD Dt / Offence)
#   numbered table 1..8
#   narrative body (paragraphs)
#   "Closed the CD for the day; further progress follows."
#   "Copy submitted to the SDPO ..., through CI of Police ... f.f.i."
# ============================================================
def render_case_diary_part1(case: Dict[str, Any]) -> bytes:
    doc = Document()
    _set_margins(doc, top=1.2, right=1.5, bottom=1.5, left=1.5)

    _para(doc, "CASE DIARY", bold=True, size=14, align=WD_ALIGN_PARAGRAPH.CENTER)
    _para(doc, "(Part-I)", italic=True, size=11, align=WD_ALIGN_PARAGRAPH.CENTER)
    _para(doc, "(Under Section 193(8) BNSS / Section 172 CrPC)",
          italic=True, size=10, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=6)

    # Header strip (single 2-col table with 6 rows)
    head = _make_table(doc, 0, 2, widths_cm=[5.5, 10.5])
    for label, key in [
        ("Police Station", "police_station"),
        ("Dist.", "district"),
        ("F.I.R No.", "fir_number"),
        ("Date, Time & Place of occurrence", "occurrence_dtp"),
        ("CD Dt.", "cd_date"),
        ("Offence U/s", "sections"),
    ]:
        row = head.add_row()
        _cell_para(row.cells[0], label, bold=True, size=11)
        _cell_para(row.cells[1], _val(case, key), size=11)
        _shade_cell(row.cells[0], "F2F2F2")
        for c in row.cells:
            _set_borders(c)

    doc.add_paragraph("")

    # Numbered fields (1..8)
    body = _make_table(doc, 0, 2, widths_cm=[7.5, 8.5])
    for num, label, key, default in [
        ("1", "Date and time of report", "report_datetime", BLANK),
        ("2", "Name of the Complainant / Informant", "_complainant_block", None),
        ("3", "Name and address of accused", "_accused_block", None),
        ("4", "Property Lost", "property_lost", "Nil"),
        ("5", "Property recovered", "property_recovered", "Nil"),
        ("6", "Date of Last Case Diary", "last_cd_date", "First CD"),
        ("7", "Name and address of deceased", "deceased", "Nil"),
        ("8", "Name and address of witnesses examined", "_witnesses_block", None),
    ]:
        row = body.add_row()
        _cell_para(row.cells[0], f"{num}.  {label}", bold=True, size=10)
        if key == "_complainant_block":
            value = _format_person_block(case.get("complainant") or {})
        elif key == "_accused_block":
            accused = case.get("accused") or [{}]
            if not isinstance(accused, list) or not accused:
                accused = [{}]
            value = "\n".join(f"A{i}. {_format_person_block(a)}" for i, a in enumerate(accused, 1))
        elif key == "_witnesses_block":
            wts = case.get("witnesses_examined") or case.get("witnesses") or []
            if not wts:
                wts = [{}, {}, {}]
            value = "\n".join(f"LW-{i}. {_format_person_block(w)}" for i, w in enumerate(wts, 1))
        else:
            value = _val(case, key, default=default or BLANK)
        _cell_para(row.cells[1], value, size=10)
        for c in row.cells:
            _set_borders(c)

    doc.add_paragraph("")

    # Narrative body (chronological investigation) — paragraphs
    _para(doc, "Brief Facts and Investigation Details:", bold=True, size=11, space_before=6)
    _para(doc, _val(case, "brief_facts",
                    default="(To be filled. Describe the complaint, registration of FIR, "
                            "examination of witnesses, scene visit, panchanama, sketch, "
                            "search & seizure, accused notice/appearance.)"),
          size=11, align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_after=4)

    # Step list
    _para(doc, "Steps Taken:", bold=True, size=11, space_before=6)
    for step_num, step in enumerate(case.get("investigation_steps") or [], 1):
        _para(doc, f"   {step_num}.  {step}", size=11,
              align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_after=2)
    if not case.get("investigation_steps"):
        for tmpl in [
            "Visited the scene of offence and observed the surroundings.",
            "Conducted Scene of Offence Panchanama in the presence of mediators.",
            "Recorded statements of witnesses LW-1 to LW-N u/s 180 BNSS / 161 CrPC.",
            "Issued notice u/s 35(3) BNSS to the accused for appearance.",
            "Collected ID proofs and acknowledgement receipts from the accused.",
        ]:
            _para(doc, f"   •  {tmpl}", italic=True, size=10,
                  align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_after=2,
                  )

    # Closing statement
    doc.add_paragraph("")
    _para(doc, "Closed the CD for the day; further progress follows.", italic=True,
          size=11, align=WD_ALIGN_PARAGRAPH.LEFT, space_after=18)

    # Signature block
    _para(doc, f"Signature of the Investigation Officer", bold=True, size=11,
          align=WD_ALIGN_PARAGRAPH.RIGHT)
    _para(doc, f"({_val(case, 'io', 'name')})", size=11, align=WD_ALIGN_PARAGRAPH.RIGHT)
    _para(doc, f"{_val(case, 'io', 'designation')}, PS {_val(case, 'police_station')}",
          size=11, align=WD_ALIGN_PARAGRAPH.RIGHT, space_after=14)

    # Distribution footer
    _para(
        doc,
        f"Copy submitted to the SDPO {_val(case, 'district')}, through CI of Police "
        f"{_val(case, 'circle', default=_val(case, 'place'))} f.f.i.",
        italic=True, size=10,
    )

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ============================================================
# 3. REMAND CASE DIARY (Part-I) — letter-format to Magistrate
# ============================================================
# Matches the user's sample 236 remand.pdf exactly:
#   Title: "REMAND CASE DIARY", "Part-I"
#   "IN THE COURT OF JUDICIAL MAGISTRATE OF FIRST CLASS AT ..."
#   "P.S.: <PS>   Dist: <DIST>"   "FIR No. ../....   Dated: ..."
#   "Honoured Sir,"
#   1..8 numbered fields (Investigating Officer / occurrence / offence /
#                         action / complainant / accused / property / witnesses)
#   Narrative paragraphs
#   "Reasons for arrest:" + para
#   "Hence the remand report."
#   Standard prayer clause (verbatim)
#   Signature, Encl, Escort
# ============================================================
def render_remand_report(case: Dict[str, Any]) -> bytes:
    doc = Document()
    _set_margins(doc, top=1.2, right=1.5, bottom=1.5, left=1.5)

    _para(doc, "REMAND CASE DIARY", bold=True, size=14, align=WD_ALIGN_PARAGRAPH.CENTER)
    _para(doc, "Part-I", italic=True, size=11, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=8)

    court_place = _val(case, "court_place", default=_val(case, "district", default="NARAYANPET"))
    _para(doc, f"IN THE COURT OF JUDICIAL MAGISTRATE OF FIRST CLASS AT {court_place.upper()},",
          bold=True, size=11, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=10)

    # Top strip: PS / Dist / FIR No / Dated
    strip = _make_table(doc, 1, 2, widths_cm=[8.0, 8.0])
    _cell_para(strip.rows[0].cells[0],
               f"P.S.: {_val(case, 'police_station')}\nDist: {_val(case, 'district')}",
               bold=True, size=11)
    _cell_para(strip.rows[0].cells[1],
               f"FIR No. {_val(case, 'fir_number')}\nDated: {_val(case, 'fir_date')}",
               bold=True, size=11, align=WD_ALIGN_PARAGRAPH.RIGHT)

    doc.add_paragraph("")
    _para(doc, "Honoured Sir,", size=11, space_after=6)

    # Numbered fields 1..8 in a 2-col table (matches sample)
    body = _make_table(doc, 0, 2, widths_cm=[7.5, 8.5])

    def addrow(num: str, label: str, value: str, bold_label: bool = True):
        row = body.add_row()
        _cell_para(row.cells[0], f"{num}. {label}", bold=bold_label, size=10)
        _cell_para(row.cells[1], value, size=10)
        for c in row.cells:
            _set_borders(c)

    addrow("1", "Name of the Investigating Officer",
           _format_io_block(case.get("io") or {}, _val(case, "police_station", default="")))
    addrow("2", "Date and place of occurrence", _val(case, "occurrence_dtp"))
    addrow("3", "Offence U/s", _val(case, "sections"))
    addrow("4", "Date on which action was taken",
           _val(case, "action_taken_datetime", default=_val(case, "fir_date")))
    addrow("5", "Name of the complainant", _format_person_block(case.get("complainant") or {}))

    # Accused — multi-line A1..AN
    accused = case.get("accused") or [{}]
    if not isinstance(accused, list) or not accused:
        accused = [{}]
    acc_text = "\n".join(f"A{i}. {_format_person_block(a)}" for i, a in enumerate(accused, 1))
    addrow("6", "Name of the accused", acc_text)
    addrow("7", "Property lost", _val(case, "property_lost", default="Nil"))
    addrow("8", "Property recovered", _val(case, "property_recovered", default="Nil"))
    addrow("9", "Name of the deceased", _val(case, "deceased", default="Nil"))

    # Witnesses (renumbered list 1..N)
    witnesses = case.get("witnesses") or [{}, {}, {}]
    wt_text = "\n".join(f"{i}. {_format_person_block(w)}" for i, w in enumerate(witnesses, 1))
    addrow("10", "Name of the witnesses", wt_text)

    doc.add_paragraph("")

    # Narrative — Brief facts
    _para(doc, "Brief Facts of the Case:", bold=True, size=11, space_before=6)
    _para(doc, _val(case, "brief_facts",
                    default="(To be filled. Describe the date, time, place of occurrence, "
                            "the act of the accused, and how the case was registered.)"),
          size=11, align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_after=4)

    _para(doc, "Investigation Done So Far:", bold=True, size=11, space_before=6)
    _para(doc, _val(case, "investigation_done",
                    default="(To be filled. Witness statements u/s 180 BNSS, scene visit, "
                            "panchanama, recovery, arrest of accused.)"),
          size=11, align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_after=4)

    # Reasons for arrest
    _para(doc, "Reasons for arrest:", bold=True, size=11, space_before=6)
    _para(doc, _val(case, "grounds_of_arrest",
                    default="(To be filled. Grounds and necessity of arrest u/s 35 BNSS.)"),
          size=11, align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_after=4)

    _para(doc, "Hence the remand report.", bold=True, size=11, space_before=6, space_after=4)

    # Standard prayer (verbatim from sample)
    n_acc = len(accused)
    last = f"A{n_acc}" if n_acc > 1 else "A1"
    prayer = (
        f"The arrested accused person{'s' if n_acc > 1 else ''} "
        f"{'A1 to ' + last if n_acc > 1 else 'A1'} herewith produced before the Hon'ble Court "
        f"under proper escort with a pray to send {'them' if n_acc > 1 else 'him/her'} for "
        f"{_val(case, 'remand_type', default='judicial')} remand custody as the court deems fit."
    )
    _para(doc, prayer, italic=True, size=11, align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_after=14)

    # Signature
    _para(doc, "", size=4)
    _para(doc, "Signature of the Investigating Officer", bold=True, size=11,
          align=WD_ALIGN_PARAGRAPH.RIGHT)
    _para(doc, f"({_val(case, 'io', 'name')})", size=11, align=WD_ALIGN_PARAGRAPH.RIGHT)
    _para(doc, f"{_val(case, 'io', 'designation')}", size=11, align=WD_ALIGN_PARAGRAPH.RIGHT)
    _para(doc, f"{_val(case, 'police_station')} P.S.", size=11,
          align=WD_ALIGN_PARAGRAPH.RIGHT, space_after=14)

    # Encl & Escort
    _para(doc, "Encl:", bold=True, size=11)
    encl_items = case.get("enclosures") or [
        "Copy of FIR",
        "Statements of LW-1 to LW-N u/s 180 BNSS",
        "Scene of Offence Panchanama",
        "Wound certificate / MLC",
        "Notice u/s 35(3) BNSS to accused",
        "Aadhaar/ID proof of accused",
    ]
    for it in encl_items:
        _para(doc, f"   • {it}", size=10)
    _para(doc, "", size=4)
    _para(doc, f"Escort: {_val(case, 'escort', default=BLANK)}", size=11)

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
