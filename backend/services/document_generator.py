"""
Document Generator Service - Auto-generate Charge Sheets and Case Diaries.
Uses the Global Case Context and user-provided templates.
"""
import os
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv()
logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')


CHARGE_SHEET_TEMPLATE = """
IN THE COURT OF {court_name}
Dist: {district}  PS: {police_station}

FIR No.: {fir_number}  Dtd: {date_of_fir}
Charge Sheet No.: {charge_sheet_number}
Date of Charge: {date_of_charge}
Act and Section of Law: U/S {sections}
Type of Final Report: Charge Sheet
Original/Supplementary: Original

1. Name and Rank of the I.O(s):
   {io_name}, {io_rank}, PS {police_station}

2. Name and Address of the Complainant/Informant:
   {complainant_details}

3. Details of Property Seized: {property_seized}

4. Particulars of Accused Persons Charge Sheeted:
{accused_list}

5. Particulars of Accused Persons Not Charge Sheeted: {not_charge_sheeted}

6. Particulars of Witnesses to be Examined:
{witness_list}

7. Result of Laboratory Analysis: {lab_results}

8. Brief Facts of the Case:
{brief_facts}

9. Prayer:
Therefore, the Hon'ble Court is prayed that the accused persons mentioned in column No. 4 of this charge sheet may be tried and dealt with suitably as per law.

Dispatched on: {dispatch_date}

{io_signature}
{io_name}
{io_rank}
PS {police_station}
"""


CASE_DIARY_TEMPLATE = """
CASE DIARY
Part-I

PS: {police_station}  Circle: {circle}  Dist: {district}
FIR No.: {fir_number}
Date and Place of Occurrence: {date_of_offense} at {place_of_offense}
CD Date: {cd_date}
Offence U/S: {sections}

1. Date and Time of Report: {date_of_fir}
2. Name of Complainant/Informant: {complainant_name}
3. Name and Address of Accused:
{accused_list}

4. Property Lost: {property_lost}
5. Property Recovered: {property_recovered}
6. Last Case Diary Date: {last_cd_date}
7. Name of Deceased: {deceased_name}

8. Witnesses Examined:
{witness_list}

9. Investigation Progress:
{investigation_progress}

{io_signature}
{io_name}
{io_rank}
PS {police_station}
"""


async def generate_charge_sheet(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate a Charge Sheet (Sec 193 BNSS) from Global Case Context.
    """
    try:
        # Format accused list
        accused_list = ""
        for acc in context.get("accused_persons", []):
            accused_list += f"""
   {acc.get('serial', '')}. {acc.get('name', '')} S/o {acc.get('father_name', '')}, 
      Age: {acc.get('age', '')} years, Caste: {acc.get('caste', '')}, 
      Occ: {acc.get('occupation', '')}, R/o {acc.get('address', '')}
      Ph: {acc.get('phone', '')}
      a) Date of arrest/release: [To be filled]
      b) Surety particulars: [To be filled]
      c) Previous convictions: Nil
"""
        
        # Format witness list
        witness_list = ""
        for wit in context.get("witnesses", []):
            witness_list += f"""
   {wit.get('serial', '')}. {wit.get('name', '')} S/o {wit.get('father_name', '')}
      Age: {wit.get('age', '')} years, Caste: {wit.get('caste', '')}, 
      Occ: {wit.get('occupation', '')}, R/o {wit.get('address', '')}
      Ph: {wit.get('phone', '')}
      Role: {wit.get('role', '')}
"""
        
        # Format complainant details
        complainant_details = f"""{context.get('complainant_name', '')} S/o {context.get('complainant_father_name', '')}, 
   Age: {context.get('complainant_age', '')} years, Caste: {context.get('complainant_caste', '')},
   Occ: {context.get('complainant_occupation', '')}, R/o {context.get('complainant_address', '')}
   Ph: {context.get('complainant_phone', '')}"""
        
        # Format sections
        sections = ", ".join(context.get("sections_of_law", []))
        
        # Generate charge sheet
        charge_sheet = CHARGE_SHEET_TEMPLATE.format(
            court_name=context.get("jurisdiction_court", "JUDICIAL FIRST CLASS MAGISTRATE"),
            district=context.get("district", ""),
            police_station=context.get("police_station", ""),
            fir_number=context.get("fir_number", ""),
            date_of_fir=context.get("date_of_fir", ""),
            charge_sheet_number=context.get("charge_sheet_number", "[To be assigned]"),
            date_of_charge=datetime.now().strftime("%d.%m.%Y"),
            sections=sections,
            io_name=context.get("investigating_officer", ""),
            io_rank=context.get("io_rank", ""),
            complainant_details=complainant_details,
            property_seized=context.get("property_lost", "---"),
            accused_list=accused_list if accused_list else "   Nil",
            not_charge_sheeted="Nil",
            witness_list=witness_list if witness_list else "   Nil",
            lab_results="---",
            brief_facts=context.get("legal_facts", "") or context.get("translated_facts", "") or context.get("brief_facts", ""),
            dispatch_date=datetime.now().strftime("%d.%m.%Y"),
            io_signature="[Signature]"
        )
        
        return {
            "success": True,
            "document_type": "Charge Sheet (Sec 193 BNSS)",
            "content": charge_sheet,
            "editable_fields": [
                "[Charge Sheet No]",
                "[Date of arrest/release]",
                "[Surety particulars]",
                "[To be assigned]",
                "[To be filled]"
            ]
        }
        
    except Exception as e:
        logger.error(f"Charge sheet generation error: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def generate_case_diary(
    context: Dict[str, Any],
    entry_number: int = 1,
    investigation_progress: str = ""
) -> Dict[str, Any]:
    """
    Generate a Case Diary Entry (Sec 172 BNSS) from Global Case Context.
    """
    try:
        # Format accused list
        accused_list = ""
        for acc in context.get("accused_persons", []):
            accused_list += f"   {acc.get('serial', '')}. {acc.get('name', '')} S/o {acc.get('father_name', '')}, Age: {acc.get('age', '')} years, R/o {acc.get('address', '')}\n"
        
        # Format witness list
        witness_list = ""
        for wit in context.get("witnesses", []):
            witness_list += f"   {wit.get('serial', '')}. {wit.get('name', '')} - {wit.get('role', '')}\n"
        
        # Format sections
        sections = ", ".join(context.get("sections_of_law", []))
        
        # Generate case diary
        case_diary = CASE_DIARY_TEMPLATE.format(
            police_station=context.get("police_station", ""),
            circle=context.get("circle", ""),
            district=context.get("district", ""),
            fir_number=context.get("fir_number", ""),
            date_of_offense=context.get("date_of_offense", ""),
            place_of_offense=context.get("place_of_offense", ""),
            cd_date=datetime.now().strftime("%d.%m.%Y"),
            sections=sections,
            date_of_fir=context.get("date_of_fir", ""),
            complainant_name=context.get("complainant_name", ""),
            accused_list=accused_list if accused_list else "   Nil",
            property_lost=context.get("property_lost", "---"),
            property_recovered=context.get("property_recovered", "---"),
            last_cd_date=context.get("date_of_fir", ""),
            deceased_name="---",
            witness_list=witness_list if witness_list else "   Nil",
            investigation_progress=investigation_progress or "Investigation in progress.",
            io_name=context.get("investigating_officer", ""),
            io_rank=context.get("io_rank", ""),
            io_signature="[Signature]"
        )
        
        return {
            "success": True,
            "document_type": f"Case Diary Entry #{entry_number} (Sec 172 BNSS)",
            "content": case_diary,
            "entry_number": entry_number
        }
        
    except Exception as e:
        logger.error(f"Case diary generation error: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def generate_remand_report(
    context: Dict[str, Any],
    accused_serial: str,
    grounds_for_remand: str = ""
) -> Dict[str, Any]:
    """
    Generate a Remand Report from Global Case Context.
    """
    try:
        # Find the specific accused
        accused = None
        for acc in context.get("accused_persons", []):
            if acc.get("serial") == accused_serial:
                accused = acc
                break
        
        if not accused:
            return {"success": False, "error": f"Accused {accused_serial} not found"}
        
        sections = ", ".join(context.get("sections_of_law", []))
        
        remand_template = f"""
REMAND CASE DIARY
Part-I

PS: {context.get('police_station', '')}  Circle: {context.get('circle', '')}  Dist: {context.get('district', '')}
FIR No.: {context.get('fir_number', '')}
Date and Place of Offence: {context.get('date_of_offense', '')} at {context.get('place_of_offense', '')}
Dated: {datetime.now().strftime('%d.%m.%Y')}
Offence U/S: {sections}

Name of the Complainant: {context.get('complainant_name', '')}

Name and Address of the Accused:
   {accused.get('serial', '')}. {accused.get('name', '')} S/o {accused.get('father_name', '')}
   Age: {accused.get('age', '')} years, Caste: {accused.get('caste', '')}
   Occ: {accused.get('occupation', '')}, R/o {accused.get('address', '')}
   Ph: {accused.get('phone', '')}

Property Lost: {context.get('property_lost', '---')}
Property Recovered: {context.get('property_recovered', '---')}

BRIEF FACTS OF THE CASE:
{context.get('legal_facts', '') or context.get('translated_facts', '') or context.get('brief_facts', '')}

GROUNDS FOR REMAND:
{grounds_for_remand or '''
1. The accused has committed a cognizable offence under the above sections.
2. Custodial interrogation is necessary to:
   a) Recover evidence and stolen property (if any)
   b) Identify co-conspirators and accomplices
   c) Establish the complete chain of events
   d) Prevent tampering with evidence
3. The investigation is at a crucial stage.
4. There is reasonable apprehension that if released, the accused may:
   a) Flee from justice
   b) Tamper with evidence
   c) Influence witnesses
   d) Commit similar offences
'''}

PRAYER:
Therefore, the arrested accused {accused.get('serial', '')} {accused.get('name', '')} is being produced before the Hon'ble Court with a prayer to remand to judicial custody for a period of 14 days to enable the police to complete the pending investigation and file charge sheet.

Date: {datetime.now().strftime('%d/%m/%Y')}
Place: {context.get('police_station', '')}

[Signature]
{context.get('investigating_officer', '')}
{context.get('io_rank', '')}
PS {context.get('police_station', '')}
"""
        
        return {
            "success": True,
            "document_type": "Remand Report",
            "content": remand_template,
            "accused": accused
        }
        
    except Exception as e:
        logger.error(f"Remand report generation error: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def generate_bsa_63_certificate(
    context: Dict[str, Any],
    evidence_id: str
) -> Dict[str, Any]:
    """
    Generate a BSA Section 63 Digital Evidence Certificate.
    """
    try:
        # Find the specific evidence item
        evidence = None
        for ev in context.get("evidence_items", []):
            if ev.get("id") == evidence_id:
                evidence = ev
                break
        
        if not evidence:
            return {"success": False, "error": f"Evidence {evidence_id} not found"}
        
        certificate = f"""
CERTIFICATE UNDER SECTION 63 OF BHARATIYA SAKSHYA ADHINIYAM, 2023
(Admissibility of Electronic Records)

This is to certify that:

1. FIR/Crime No.: {context.get('fir_number', '')}
   Police Station: {context.get('police_station', '')}
   District: {context.get('district', '')}

2. PARTICULARS OF ELECTRONIC EVIDENCE:
   File Name: {evidence.get('file_name', '')}
   File Type: {evidence.get('file_type', '')}
   Description: {evidence.get('description', '')}
   
3. HASH VALUE (SHA-256):
   {evidence.get('sha256_hash', '')}

4. COLLECTION DETAILS:
   Seized From: {evidence.get('seized_from', '')}
   Date of Seizure: {evidence.get('seizure_date', '')}

5. CERTIFICATION:
   I, {context.get('investigating_officer', '')}, {context.get('io_rank', '')}, 
   PS {context.get('police_station', '')}, being the person in charge of this 
   electronic evidence, hereby certify that:

   a) The electronic record described above was produced by a computer during 
      the period when the computer was used regularly to store or process 
      information for the purposes of any activities regularly carried on over 
      that period by the person having lawful control over the use of the 
      computer.

   b) During the said period, information of the kind contained in the 
      electronic record was regularly fed into the computer in the ordinary 
      course of the said activities.

   c) The computer was operating properly during the material part of the said 
      period, and if it was not operating properly during that part of that 
      period, the accuracy of the record was not affected by such circumstances.

   d) The information contained in the electronic record reproduces or is 
      derived from such information fed into the computer in the ordinary 
      course of the said activities.

   e) The SHA-256 hash value mentioned above is a unique digital fingerprint 
      of this file and can be used to verify that the file has not been 
      altered since this certificate was issued.

Date: {datetime.now().strftime('%d/%m/%Y')}
Time: {datetime.now().strftime('%H:%M:%S')} IST

[Signature]
{context.get('investigating_officer', '')}
{context.get('io_rank', '')}
PS {context.get('police_station', '')}
District: {context.get('district', '')}

[OFFICIAL SEAL]
"""
        
        return {
            "success": True,
            "document_type": "BSA Section 63 Certificate",
            "content": certificate,
            "evidence": evidence,
            "hash": evidence.get('sha256_hash', '')
        }
        
    except Exception as e:
        logger.error(f"BSA 63 certificate generation error: {e}")
        return {
            "success": False,
            "error": str(e)
        }
