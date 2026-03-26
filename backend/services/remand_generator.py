"""
Remand Case Diary Template Generator
Generates court-ready Remand CD when arrest status is detected
"""
from datetime import datetime
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


def generate_remand_case_diary_html(data: Dict, case_info: Dict) -> str:
    """
    Generate Remand Case Diary Part-1 as HTML table
    Auto-triggered when arrest status is detected
    """
    # Extract complainant
    comp = data.get("complainant", {})
    
    # Format accused list
    accused_html = format_accused_for_remand(data.get("accused_persons", []))
    
    # Format witness list
    witness_html = format_witnesses_for_remand(data.get("witnesses", []))
    
    # Grounds of arrest
    grounds_of_arrest = generate_grounds_of_arrest(data)
    
    # Prayer section
    accused_count = len(data.get("accused_persons", []))
    prayer = generate_prayer_section(accused_count)
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Times New Roman', serif; font-size: 12px; margin: 20px; }}
            table {{ width: 100%; border-collapse: collapse; margin: 10px 0; }}
            th, td {{ border: 1px solid #000; padding: 8px; text-align: left; vertical-align: top; }}
            th {{ background-color: #f0f0f0; font-weight: bold; }}
            .header {{ text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; }}
            .sub-header {{ text-align: center; font-size: 14px; margin-bottom: 10px; }}
            .section-title {{ font-weight: bold; background-color: #f5f5f5; padding: 10px; margin: 15px 0 5px 0; }}
            .row-num {{ width: 30px; text-align: center; font-weight: bold; }}
            .editable {{ min-height: 20px; background-color: #fffef0; }}
            textarea {{ width: 100%; min-height: 60px; border: 1px solid #ccc; padding: 5px; font-family: inherit; }}
            .grounds-list {{ margin-left: 20px; }}
            .grounds-list li {{ margin: 8px 0; }}
            .prayer {{ font-style: italic; margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-left: 3px solid #333; }}
            .signature-block {{ margin-top: 40px; text-align: right; }}
            @media print {{
                body {{ margin: 0; padding: 15px; }}
                textarea {{ border: none; background: transparent; }}
            }}
        </style>
    </head>
    <body>
        <div class="header">REMAND CASE DIARY</div>
        <div class="sub-header">Part-1</div>
        
        <table>
            <tr>
                <td style="width: 50%;"><strong>P.S.:</strong> {case_info.get('police_station', '')}</td>
                <td><strong>FIR No.:</strong> {case_info.get('fir_number', '')}</td>
            </tr>
            <tr>
                <td><strong>Dist.:</strong> {case_info.get('district', '')}</td>
                <td><strong>Dated:</strong> {datetime.now().strftime('%d-%m-%Y')}</td>
            </tr>
            <tr>
                <td colspan="2"><strong>Date and place of occurrence:</strong><br/>
                    <textarea class="editable" data-field="occurrence_details">{data.get('offense_details', {}).get('date', '')} at {data.get('offense_details', {}).get('time', '')} at {data.get('offense_details', {}).get('place', '')}</textarea>
                </td>
            </tr>
            <tr>
                <td colspan="2"><strong>Offence U/s:</strong> {case_info.get('sections', '') or ', '.join(data.get('sections_of_law', []))}</td>
            </tr>
        </table>

        <table>
            <tr>
                <td class="row-num">1</td>
                <td><strong>Date on which action was taken:</strong><br/>
                    <textarea class="editable" data-field="action_date">On: {datetime.now().strftime('%d-%m-%Y')} at _____ Hours.</textarea>
                </td>
            </tr>
            <tr>
                <td class="row-num">2</td>
                <td><strong>Name of the complainant:</strong><br/>
                    <textarea class="editable" data-field="complainant">{comp.get('name', '')} {f"S/o {comp.get('father_name', '')}" if comp.get('father_name') else ''}, age: {comp.get('age', '')} years, caste: {comp.get('caste', '')}, occ: {comp.get('occupation', '')}, r/o {comp.get('address', '')}, cell No. {comp.get('phone', '')}</textarea>
                </td>
            </tr>
            <tr>
                <td class="row-num">3</td>
                <td><strong>Name of the accused:</strong><br/>
                    {accused_html}
                </td>
            </tr>
            <tr>
                <td class="row-num">4</td>
                <td><strong>Property lost:</strong><br/>
                    <textarea class="editable" data-field="property_lost">{data.get('property_lost', '--')}</textarea>
                </td>
            </tr>
            <tr>
                <td class="row-num">5</td>
                <td><strong>Property recovered:</strong><br/>
                    <textarea class="editable" data-field="property_recovered">{data.get('property_recovered', '--')}</textarea>
                </td>
            </tr>
            <tr>
                <td class="row-num">6</td>
                <td><strong>Previous case diary (if not the first one):</strong><br/>
                    <textarea class="editable" data-field="prev_cd">--</textarea>
                </td>
            </tr>
            <tr>
                <td class="row-num">7</td>
                <td><strong>Name of the deceased:</strong><br/>
                    <textarea class="editable" data-field="deceased">{data.get('deceased_details', '--')}</textarea>
                </td>
            </tr>
            <tr>
                <td class="row-num">8</td>
                <td><strong>Name of the witnesses examined:</strong><br/>
                    {witness_html}
                </td>
            </tr>
        </table>

        <div class="section-title">IN THE COURT OF JUDICIAL MAGISTRATE OF FIRST CLASS AT {case_info.get('district', '').upper()}</div>
        
        <table>
            <tr>
                <td>
                    <strong>Brief Facts of the Case:</strong><br/>
                    <textarea class="editable" data-field="brief_facts" style="min-height: 150px;">{data.get('brief_facts', '')}</textarea>
                </td>
            </tr>
        </table>

        <div class="section-title">REASONS FOR ARREST:</div>
        {grounds_of_arrest}

        <div class="prayer">
            <strong>PRAYER:</strong><br/><br/>
            {prayer}
        </div>

        <div class="signature-block">
            <p>Signature of the Investigation officer</p>
            <p>({case_info.get('io_name', '_____________')})</p>
            <p>{case_info.get('io_rank', 'Sub Inspector of Police')}</p>
            <p>PS {case_info.get('police_station', '_____________')}</p>
        </div>

        <table style="margin-top: 30px;">
            <tr>
                <td style="width: 50%;"><strong>Encl:</strong>
                    <ol>
                        <li>Copy of FIR</li>
                        <li>Copy of CD Part-I</li>
                        <li>Arrest Memo</li>
                        <li>Medical Report</li>
                        <li>Property Seizure Memo (if any)</li>
                        <li>_______________</li>
                    </ol>
                </td>
                <td><strong>Escort:</strong><br/>
                    <textarea class="editable" data-field="escort">PC _____ / HC _____</textarea>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    return html


def format_accused_for_remand(accused_persons: List[Dict]) -> str:
    """Format accused list for Remand CD with arrest details"""
    if not accused_persons:
        return '<textarea class="editable" data-field="accused">No accused details</textarea>'
    
    html_parts = []
    for i, acc in enumerate(accused_persons):
        serial = f"A{i+1}"
        name = acc.get("name", "")
        father = acc.get("father_name", "")
        age = acc.get("age", "")
        caste = acc.get("caste", "")
        occupation = acc.get("occupation", "")
        address = acc.get("address", "")
        phone = acc.get("phone", "")
        
        html_parts.append(f'''
        <div style="margin: 5px 0; padding: 5px; border-bottom: 1px dashed #ccc;">
            <strong>{serial}:</strong> 
            <textarea class="editable" data-field="accused_{i}" style="width: 90%;">{name} S/o {father}, age: {age} years, caste: {caste}, occ: {occupation}, r/o {address}, cell No. {phone}</textarea>
        </div>
        ''')
    
    return "\n".join(html_parts)


def format_witnesses_for_remand(witnesses: List[Dict]) -> str:
    """Format witness list for Remand CD"""
    if not witnesses:
        return '<textarea class="editable" data-field="witnesses">No witness details</textarea>'
    
    html_parts = []
    for i, wit in enumerate(witnesses):
        serial = i + 1
        name = wit.get("name", "")
        father = wit.get("father_name", "")
        age = wit.get("age", "")
        caste = wit.get("caste", "")
        occupation = wit.get("occupation", "")
        address = wit.get("address", "")
        phone = wit.get("phone", "")
        role = wit.get("role", "")
        
        html_parts.append(f'''
        <div style="margin: 3px 0;">
            <strong>{serial}.</strong> 
            <textarea class="editable" data-field="witness_{i}" style="width: 85%;">{name} {f"S/o {father}" if father else ""}, age: {age} years, caste: {caste}, occ: {occupation}, r/o {address}, cell No. {phone} - ({role})</textarea>
        </div>
        ''')
    
    return "\n".join(html_parts)


def generate_grounds_of_arrest(data: Dict) -> str:
    """Generate Grounds of Arrest based on case type"""
    grounds = [
        "If the accused persons are released on bail, they may create law & order problems in the locality.",
        "There is likelihood that the accused persons may commit the same offence if released.",
        "If released on bail, the accused persons may tamper with witnesses and evidence.",
        "If released on bail, the accused persons may abscond from the jurisdiction.",
        "The accused persons did not respond to the 41-A BNSS notice served upon them."
    ]
    
    # Add specific grounds based on offense type
    brief_facts = data.get("brief_facts", "").lower()
    if "fraud" in brief_facts or "cheat" in brief_facts:
        grounds.append("The accused may dispose of the fraudulently obtained property if released.")
    if "threat" in brief_facts or "intimidat" in brief_facts:
        grounds.append("The accused may threaten or intimidate the complainant and witnesses if released.")
    
    html = '<ol class="grounds-list">'
    for ground in grounds:
        html += f'<li>{ground}</li>'
    html += '</ol>'
    html += '<p style="margin-top: 15px;"><strong>Hence it is necessary for the prosecution to arrest the accused to complete the investigation in proper lines.</strong></p>'
    
    return html


def generate_prayer_section(accused_count: int) -> str:
    """Generate Prayer section for Remand CD"""
    accused_range = f"A1 to A{accused_count}" if accused_count > 1 else "A1"
    return f"""The arrested accused person(s) {accused_range} are herewith produced before the Hon'ble Court under proper escort with a prayer to send them for judicial remand custody as the Hon'ble Court deems fit."""


def detect_arrest_status(data: Dict) -> bool:
    """Detect if arrest has been made based on case data"""
    # Check for arrest-related keywords in the data
    brief_facts = data.get("brief_facts", "").lower()
    
    arrest_keywords = ["arrested", "apprehended", "taken into custody", "remand", "produced before court"]
    
    for keyword in arrest_keywords:
        if keyword in brief_facts:
            return True
    
    # Check if accused have arrest dates
    for accused in data.get("accused_persons", []):
        if accused.get("arrest_date"):
            return True
    
    return False
