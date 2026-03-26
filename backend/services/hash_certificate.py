"""
SHA-256 Hash Certificate Generator for Digital Evidence
Generates Section 63 BSA (Bharatiya Sakshya Adhiniyam) Digital Certificate
for court admissibility of electronic records.
"""
import hashlib
from datetime import datetime, timezone
from typing import Optional
import base64

def compute_sha256(file_content: bytes) -> str:
    """Compute SHA-256 hash of file content."""
    return hashlib.sha256(file_content).hexdigest()


def compute_md5(file_content: bytes) -> str:
    """Compute MD5 hash (secondary verification)."""
    return hashlib.md5(file_content).hexdigest()


def generate_bsa_section_63_certificate(
    file_name: str,
    file_type: str,
    file_size: int,
    sha256_hash: str,
    md5_hash: str,
    fir_number: str = "",
    police_station: str = "",
    seized_from: str = "",
    seizure_date: str = "",
    officer_name: str = "",
    officer_designation: str = ""
) -> dict:
    """
    Generate Section 63 BSA Digital Certificate for electronic evidence.
    
    This certificate is required for court admissibility of digital evidence
    under Bharatiya Sakshya Adhiniyam (Indian Evidence Act replacement).
    """
    certificate_id = f"BSA63-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{sha256_hash[:8].upper()}"
    generated_at = datetime.now(timezone.utc)
    
    # Generate formatted certificate text
    certificate_text = f"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                     CERTIFICATE UNDER SECTION 63                              ║
║              BHARATIYA SAKSHYA ADHINIYAM, 2023 (BSA)                         ║
║                    [Digital Evidence Certificate]                             ║
╠══════════════════════════════════════════════════════════════════════════════╣

Certificate No: {certificate_id}
Date of Generation: {generated_at.strftime('%d.%m.%Y at %H:%M:%S IST')}

═══════════════════════════════════════════════════════════════════════════════

PART I - ELECTRONIC RECORD DETAILS:

1. File Name: {file_name}
2. File Type: {file_type}
3. File Size: {file_size:,} bytes ({file_size / (1024*1024):.2f} MB)
4. SHA-256 Hash Value: 
   {sha256_hash}
5. MD5 Hash Value (Secondary Verification):
   {md5_hash}

═══════════════════════════════════════════════════════════════════════════════

PART II - CASE REFERENCE:

1. FIR Number: {fir_number or '[ ]'}
2. Police Station: {police_station or '[ ]'}
3. Seized From: {seized_from or '[ ]'}
4. Date of Seizure: {seizure_date or '[ ]'}

═══════════════════════════════════════════════════════════════════════════════

PART III - CERTIFICATION:

I, {officer_name or '[OFFICER NAME]'}, {officer_designation or '[DESIGNATION]'},
hereby certify that:

(a) The electronic record was produced by a computer during the period over
    which it was regularly used to store or process information;

(b) Throughout the said period, information of the kind contained in the
    electronic record was regularly fed into the computer in the ordinary
    course of the said activities;

(c) Throughout the said period, the computer was operating properly and
    any periods of non-operation did not affect the integrity of the
    electronic record;

(d) The information contained in the electronic record reproduces or is
    derived from information fed into the computer in the ordinary course
    of the said activities;

(e) The above hash values (SHA-256 and MD5) uniquely identify this electronic
    record and any alteration to the record will produce different hash values.

═══════════════════════════════════════════════════════════════════════════════

HASH VERIFICATION NOTE:

To verify the integrity of this evidence at any future date:
1. Compute SHA-256 hash of the digital evidence file
2. Compare with the hash value recorded above
3. If hashes match, the evidence is UNALTERED
4. If hashes differ, the evidence has been MODIFIED

═══════════════════════════════════════════════════════════════════════════════

Signature of Certifying Officer: ____________________

Name: {officer_name or '________________________'}

Designation: {officer_designation or '________________________'}

Date: ___/___/_______

Seal of Office: [AFFIX SEAL]

╚══════════════════════════════════════════════════════════════════════════════╝
"""

    # Generate HTML version for printing
    certificate_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page {{ size: A4; margin: 15mm; }}
        body {{ font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.4; }}
        .certificate {{ border: 3px double #000; padding: 20px; max-width: 800px; margin: auto; }}
        .header {{ text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 15px; }}
        .header h1 {{ margin: 5px 0; font-size: 14pt; }}
        .header h2 {{ margin: 5px 0; font-size: 12pt; font-weight: normal; }}
        .section {{ margin: 15px 0; padding: 10px; background: #f9f9f9; border-left: 3px solid #333; }}
        .section-title {{ font-weight: bold; margin-bottom: 10px; text-transform: uppercase; }}
        table {{ width: 100%; border-collapse: collapse; }}
        td {{ padding: 5px; vertical-align: top; }}
        td:first-child {{ width: 180px; font-weight: bold; }}
        .hash-box {{ background: #efefef; font-family: monospace; font-size: 9pt; 
                     padding: 8px; word-break: break-all; border: 1px solid #ccc; margin: 5px 0; }}
        .certification {{ font-style: italic; margin: 10px 0; }}
        .signature-block {{ margin-top: 30px; display: flex; justify-content: space-between; }}
        .signature-field {{ text-align: center; width: 200px; }}
        .signature-line {{ border-top: 1px solid #000; margin-top: 50px; padding-top: 5px; }}
        .verification-note {{ background: #ffe; border: 1px solid #cc0; padding: 10px; margin: 15px 0; }}
        .seal-box {{ width: 80px; height: 80px; border: 2px solid #000; margin: 10px auto; 
                    display: flex; align-items: center; justify-content: center; font-size: 8pt; }}
    </style>
</head>
<body>
    <div class="certificate">
        <div class="header">
            <h1>CERTIFICATE UNDER SECTION 63</h1>
            <h2>BHARATIYA SAKSHYA ADHINIYAM, 2023 (BSA)</h2>
            <h2>[Digital Evidence Certificate]</h2>
            <p><strong>Certificate No:</strong> {certificate_id}</p>
            <p><strong>Generated:</strong> {generated_at.strftime('%d.%m.%Y at %H:%M:%S IST')}</p>
        </div>
        
        <div class="section">
            <div class="section-title">Part I - Electronic Record Details</div>
            <table>
                <tr><td>File Name:</td><td>{file_name}</td></tr>
                <tr><td>File Type:</td><td>{file_type}</td></tr>
                <tr><td>File Size:</td><td>{file_size:,} bytes ({file_size / (1024*1024):.2f} MB)</td></tr>
            </table>
            <div style="margin-top: 10px;">
                <strong>SHA-256 Hash Value:</strong>
                <div class="hash-box">{sha256_hash}</div>
            </div>
            <div>
                <strong>MD5 Hash Value (Secondary):</strong>
                <div class="hash-box">{md5_hash}</div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Part II - Case Reference</div>
            <table>
                <tr><td>FIR Number:</td><td>{fir_number or '[ ]'}</td></tr>
                <tr><td>Police Station:</td><td>{police_station or '[ ]'}</td></tr>
                <tr><td>Seized From:</td><td>{seized_from or '[ ]'}</td></tr>
                <tr><td>Date of Seizure:</td><td>{seizure_date or '[ ]'}</td></tr>
            </table>
        </div>
        
        <div class="section">
            <div class="section-title">Part III - Certification</div>
            <p class="certification">
                I, <strong>{officer_name or '[OFFICER NAME]'}</strong>, 
                <strong>{officer_designation or '[DESIGNATION]'}</strong>, hereby certify that:
            </p>
            <p>(a) The electronic record was produced by a computer during the period over which it was regularly used;</p>
            <p>(b) Information of the kind contained was regularly fed into the computer in the ordinary course of activities;</p>
            <p>(c) The computer was operating properly and the electronic record's integrity was maintained;</p>
            <p>(d) The information reproduces or is derived from information fed into the computer in ordinary course;</p>
            <p>(e) The above hash values uniquely identify this electronic record. Any alteration will produce different hashes.</p>
        </div>
        
        <div class="verification-note">
            <strong>HASH VERIFICATION:</strong> To verify integrity, compute SHA-256 hash of the evidence file.
            If it matches the recorded hash, the evidence is UNALTERED. Different hash = file has been MODIFIED.
        </div>
        
        <div class="signature-block">
            <div class="signature-field">
                <div class="signature-line">Signature of Certifying Officer</div>
                <p>{officer_name or '________________________'}</p>
                <p>{officer_designation or '________________________'}</p>
            </div>
            <div class="signature-field">
                <div class="seal-box">SEAL</div>
                <p>Date: ___/___/_______</p>
            </div>
        </div>
    </div>
</body>
</html>
"""

    return {
        "certificate_id": certificate_id,
        "certificate_text": certificate_text,
        "certificate_html": certificate_html,
        "file_name": file_name,
        "file_type": file_type,
        "file_size": file_size,
        "sha256_hash": sha256_hash,
        "md5_hash": md5_hash,
        "fir_number": fir_number,
        "police_station": police_station,
        "seized_from": seized_from,
        "seizure_date": seizure_date,
        "generated_at": generated_at.isoformat(),
        "certificate_type": "BSA Section 63 Digital Evidence Certificate"
    }
