"""
Word Document Generator for Charge Sheet
Generates exact Makthal PS format charge sheet in .docx with stable tables
"""
from docx import Document
from docx.shared import Inches, Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from datetime import datetime
import io


def set_cell_border(cell, **kwargs):
    """Set cell border properties."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    for edge in ['top', 'left', 'bottom', 'right']:
        if edge in kwargs:
            element = OxmlElement(f'w:{edge}')
            element.set(qn('w:val'), kwargs[edge].get('val', 'single'))
            element.set(qn('w:sz'), str(kwargs[edge].get('sz', 4)))
            element.set(qn('w:color'), kwargs[edge].get('color', '000000'))
            tcBorders.append(element)
    tcPr.append(tcBorders)


def generate_chargesheet_docx(data: dict, case_info: dict) -> bytes:
    """
    Generate Charge Sheet in Word document format (.docx)
    Exact replication of Makthal PS 18-column format
    """
    doc = Document()
    
    # Set narrow margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Cm(1.5)
        section.bottom_margin = Cm(1.5)
        section.left_margin = Cm(1.5)
        section.right_margin = Cm(1.5)
    
    # Title
    title = doc.add_paragraph()
    title_run = title.add_run("C H A R G E – S H E E T")
    title_run.bold = True
    title_run.font.size = Pt(14)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    subtitle = doc.add_paragraph()
    subtitle_run = subtitle.add_run("(UNDER SECTION 193 BNSS.)")
    subtitle_run.font.size = Pt(11)
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    court = doc.add_paragraph()
    court_run = court.add_run(f"IN THE COURT OF ADDL. JUDICIAL FIRST CLASS MAGISTRATE AT {case_info.get('police_station', 'MAKTHAL').upper()}")
    court_run.bold = True
    court_run.font.size = Pt(11)
    court.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    doc.add_paragraph()  # Spacing
    
    # Create main table (18 rows)
    table = doc.add_table(rows=18, cols=3)
    
    # Set column widths
    for row in table.rows:
        row.cells[0].width = Cm(1.2)  # Column number
        row.cells[1].width = Cm(5)    # Label
        row.cells[2].width = Cm(10)   # Data
    
    # Add borders to all cells
    for row in table.rows:
        for cell in row.cells:
            set_cell_border(cell, 
                top={'val': 'single', 'sz': 4, 'color': '000000'},
                bottom={'val': 'single', 'sz': 4, 'color': '000000'},
                left={'val': 'single', 'sz': 4, 'color': '000000'},
                right={'val': 'single', 'sz': 4, 'color': '000000'})
    
    # Extract data
    complainant = data.get('complainant', {})
    accused_list = data.get('accused_persons', [])
    witnesses = data.get('witnesses', [])
    offense = data.get('offense_details', {})
    
    # Row data
    rows_data = [
        ("01", "Dist / PS / FIR", f"Dist.:- {case_info.get('district', 'Narayanpet')} Police Station: {case_info.get('police_station', 'Makthal')} FIR. No: {case_info.get('fir_number', '57/2026')} Dated: {case_info.get('fir_date', '22.02.2026')}"),
        ("02", "Final Report/Charge Sheet No.", f"          /2026"),
        ("03", "Date", datetime.now().strftime("%d.%m.%Y")),
        ("04", "Act/Sections.", case_info.get('sections', '118(2), 115(2), 352 R/w 3(5) BNS')),
        ("05", "Type of Final Report", "Charge sheet"),
        ("06", "F.R. Un occurred (False/Mistake of fact/Mistake of Law/Non cognizable/Civil Nature)", "---"),
        ("07", "If Charge sheet (Original/supplementary)", "Original"),
        ("08", "Names of the investigating officers", f"Sri. {case_info.get('io_name', 'Y. Bhagya Lakshmi Reddy')}, {case_info.get('io_rank', 'SI of Police')} PS {case_info.get('police_station', 'Makthal')} (IO & Filed Charge sheet)"),
        ("09", "Name of the complainant/informant with father's/Husband's name", format_complainant(complainant)),
        ("10", "Detail of properties/Articles Documents Recovered/Seized during investigation", data.get('property_recovered', '---')),
        ("11", "Particulars of charge sheeted Person", format_accused_list(accused_list, data.get('notice_date', '23.02.2026'))),
        ("12", "Particulars of sureties if Released on bail / Previous convictions / Absconding", "b) Particulars of sureties if Released on bail. --\nc) Previous convictions if any. --\nd) Particulars of accused Persons absconding. --"),
        ("13", "Particulars of accused persons not charge sheeted", "---"),
        ("14", "Particulars of the witnesses to be examined", format_witnesses_list(witnesses)),
        ("15", "Result of Lab Analysis", "---"),
        ("16", "Brief facts of the case", data.get('brief_facts', '')),
        ("17", "Is ack. Copy of notice to complainant enclosed", "---"),
        ("18", "Dispatched on", datetime.now().strftime("%d.%m.%Y")),
    ]
    
    # Fill table
    for i, (num, label, value) in enumerate(rows_data):
        row = table.rows[i]
        
        # Column number
        cell0 = row.cells[0]
        cell0.text = num
        cell0.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in cell0.paragraphs[0].runs:
            run.bold = True
            run.font.size = Pt(10)
        
        # Label
        cell1 = row.cells[1]
        cell1.text = label
        for run in cell1.paragraphs[0].runs:
            run.bold = True
            run.font.size = Pt(10)
        
        # Value
        cell2 = row.cells[2]
        cell2.text = value
        for run in cell2.paragraphs[0].runs:
            run.font.size = Pt(10)
    
    # Prayer section
    doc.add_paragraph()
    prayer = doc.add_paragraph()
    prayer.add_run("PRAYER: ").bold = True
    prayer.add_run("Therefore, the Hon'ble Court is prayed that the accused persons mentioned in column No. 11 of this charge sheet may be tried and dealt with suitably as per law.")
    
    # Signature block
    doc.add_paragraph()
    doc.add_paragraph()
    sig = doc.add_paragraph()
    sig.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    sig.add_run("Signature of Investigation Officer\n")
    sig.add_run(f"{case_info.get('io_name', 'Y. Bhagya Lakshmi Reddy')}\n")
    sig.add_run(f"{case_info.get('io_rank', 'SI of Police')}\n")
    sig.add_run(f"PS {case_info.get('police_station', 'Makthal')}")
    
    # Save to bytes
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


def format_complainant(comp: dict) -> str:
    """Format complainant details for charge sheet."""
    name = comp.get('name', '[ ]')
    father = comp.get('father_name', '[ ]')
    age = comp.get('age', '[ ]')
    caste = comp.get('caste', '[ ]')
    occupation = comp.get('occupation', '[ ]')
    address = comp.get('address', '[ ]')
    phone = comp.get('phone', '[ ]')
    
    return f"Sri. {name} S/o {father}, Age: {age} years, Caste: {caste}, Occ: {occupation}, R/o {address}, Ph.{phone}"


def format_accused_list(accused: list, notice_date: str = "") -> str:
    """Format accused persons list."""
    if not accused:
        return "[ ACCUSED DETAILS MISSING ]"
    
    lines = []
    for i, acc in enumerate(accused):
        serial = acc.get('serial', f'A{i+1}')
        name = acc.get('name', '[ ]')
        father = acc.get('father_name', '[ ]')
        age = acc.get('age', '[ ]')
        caste = acc.get('caste', '[ ]')
        occupation = acc.get('occupation', '[ ]')
        address = acc.get('address', '[ ]')
        phone = acc.get('phone', '')
        
        line = f"{serial}. {name} S/o {father}, Age: {age} years, Caste: {caste}, Occ: {occupation}, R/o {address}"
        if phone:
            line += f" Ph. {phone}"
        lines.append(line)
    
    # Add arrest/notice info
    if notice_date:
        lines.append(f"\na) Date of arrest, release, Forwarded to Court.")
        lines.append(f"   Served a notice U/s 35(3) BNSS to accused on {notice_date}")
    
    return "\n".join(lines)


def format_witnesses_list(witnesses: list) -> str:
    """Format witnesses list for charge sheet."""
    if not witnesses:
        return "[ WITNESS DETAILS MISSING ]"
    
    lines = []
    for i, wit in enumerate(witnesses):
        serial = wit.get('serial', f'LW-{i+1}')
        name = wit.get('name', '[ ]')
        father = wit.get('father_name', '[ ]')
        age = wit.get('age', '[ ]')
        caste = wit.get('caste', '[ ]')
        occupation = wit.get('occupation', '[ ]')
        address = wit.get('address', '[ ]')
        phone = wit.get('phone', '')
        role = wit.get('role', '')
        
        line = f"{serial}. Sri. {name} S/o {father}, Age: {age} Yrs., Caste: {caste}, Occ: {occupation}, R/o {address}"
        if phone:
            line += f" - {phone}"
        if role:
            line += f"\n     ({role})"
        lines.append(line)
    
    return "\n\n".join(lines)


def generate_case_diary_docx(data: dict, case_info: dict) -> bytes:
    """Generate Case Diary Part-I in Word format."""
    doc = Document()
    
    # Set margins
    for section in doc.sections:
        section.top_margin = Cm(1.5)
        section.bottom_margin = Cm(1.5)
        section.left_margin = Cm(2)
        section.right_margin = Cm(2)
    
    # Header
    header = doc.add_paragraph()
    header.alignment = WD_ALIGN_PARAGRAPH.CENTER
    header_run = header.add_run("CASE DIARY (PART-I)")
    header_run.bold = True
    header_run.font.size = Pt(14)
    
    # Case details table
    table = doc.add_table(rows=8, cols=2)
    
    details = [
        ("Crime No.", case_info.get('fir_number', '57/2026')),
        ("Police Station", case_info.get('police_station', 'Makthal')),
        ("District", case_info.get('district', 'Narayanpet')),
        ("U/S", case_info.get('sections', '')),
        ("Date of Occurrence", data.get('offense_details', {}).get('date', '22.02.2026')),
        ("Time of Occurrence", data.get('offense_details', {}).get('time', '16:00 hrs')),
        ("Date of Report", case_info.get('fir_date', '22.02.2026')),
        ("Investigating Officer", case_info.get('io_name', '')),
    ]
    
    for i, (label, value) in enumerate(details):
        row = table.rows[i]
        row.cells[0].text = label
        row.cells[1].text = str(value)
        for cell in row.cells:
            set_cell_border(cell,
                top={'val': 'single', 'sz': 4, 'color': '000000'},
                bottom={'val': 'single', 'sz': 4, 'color': '000000'},
                left={'val': 'single', 'sz': 4, 'color': '000000'},
                right={'val': 'single', 'sz': 4, 'color': '000000'})
    
    doc.add_paragraph()
    
    # Investigation narrative
    narrative = doc.add_paragraph()
    narrative.add_run("INVESTIGATION NARRATIVE:\n\n").bold = True
    narrative.add_run(data.get('brief_facts', ''))
    
    # Save
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()
