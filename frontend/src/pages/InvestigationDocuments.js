import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileStack, FileText, Download, Copy, Printer, Save, ChevronRight,
  User, MapPin, Calendar, Hash, Building, Shield, Search, Filter,
  FileCheck, Users, Package, Microscope, Mail, Scale, BarChart3,
  Folder, CheckCircle
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const InvestigationDocuments = () => {
  const [selectedCategory, setSelectedCategory] = useState('complaint');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [savedDocuments, setSavedDocuments] = useState([]);
  const [formData, setFormData] = useState({
    policeStation: '',
    crimeNumber: '',
    firNumber: '',
    caseId: '',
    complainantName: '',
    complainantAddress: '',
    complainantPhone: '',
    accusedName: '',
    accusedAddress: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].slice(0,5),
    location: '',
    officerName: '',
    officerRank: '',
    officerBadge: '',
    witnessName: '',
    witnessAddress: '',
    witnessPhone: '',
    seizureItems: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    mobileNumber: '',
    imeiNumber: '',
    vehicleNumber: '',
    vehicleType: '',
    ipAddress: '',
    socialMediaHandle: '',
    description: '',
    sections: '',
    court: '',
    magistrate: '',
    remandDays: '15',
    fslType: '',
    evidenceType: ''
  });
  const [generatedDocument, setGeneratedDocument] = useState('');

  // Load saved documents from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('investigation_documents_data');
    if (saved) setSavedDocuments(JSON.parse(saved));
  }, []);

  // Save documents to localStorage
  useEffect(() => {
    localStorage.setItem('investigation_documents_data', JSON.stringify(savedDocuments));
  }, [savedDocuments]);

  // Auto-fill from FIR data if available
  useEffect(() => {
    const firData = localStorage.getItem('fir_autofill_data');
    if (firData) {
      const data = JSON.parse(firData);
      setFormData(prev => ({
        ...prev,
        firNumber: data.firNumber || '',
        caseId: data.caseId || '',
        complainantName: data.complainantName || '',
        accusedName: data.accusedName || '',
        policeStation: data.policeStation || '',
        sections: data.sections || ''
      }));
    }
  }, []);

  const categories = [
    { id: 'complaint', name: 'Complaint Stage', icon: FileText, count: 7 },
    { id: 'fir', name: 'FIR Stage', icon: FileCheck, count: 5 },
    { id: 'investigation', name: 'Investigation', icon: Search, count: 6 },
    { id: 'witness', name: 'Witness Examination', icon: Users, count: 5 },
    { id: 'evidence', name: 'Evidence Collection', icon: Package, count: 9 },
    { id: 'forensic', name: 'Forensic Requests', icon: Microscope, count: 5 },
    { id: 'letters', name: 'Investigation Letters', icon: Mail, count: 8 },
    { id: 'accused', name: 'Accused Handling', icon: Shield, count: 8 },
    { id: 'court', name: 'Court Documents', icon: Scale, count: 6 },
    { id: 'admin', name: 'Administrative', icon: BarChart3, count: 6 }
  ];

  const templates = {
    complaint: [
      { id: 'petition', name: 'Petition Report', desc: 'Initial petition/complaint report' },
      { id: 'csr', name: 'CSR Entry', desc: 'Crime & Station Report entry' },
      { id: 'station_diary', name: 'Station Diary Entry', desc: 'General diary entry' },
      { id: 'complaint_ack', name: 'Complaint Acknowledgement', desc: 'Receipt for complainant' },
      { id: 'preliminary_enquiry', name: 'Preliminary Enquiry Report', desc: 'PE report before FIR' },
      { id: 'complaint_closure', name: 'Complaint Closure Report', desc: 'Close non-cognizable complaint' },
      { id: 'complaint_forward', name: 'Complaint Forwarding Note', desc: 'Forward to concerned PS' }
    ],
    fir: [
      { id: 'fir_draft', name: 'FIR Draft', desc: 'First Information Report draft' },
      { id: 'fir_correction', name: 'FIR Correction Report', desc: 'Corrections to registered FIR' },
      { id: 'fir_copy', name: 'FIR Copy Generator', desc: 'Certified copy of FIR' },
      { id: 'fir_court', name: 'FIR Dispatch to Court', desc: 'Send FIR copy to court' },
      { id: 'fir_senior', name: 'FIR Dispatch to Senior', desc: 'Report to senior officer' }
    ],
    investigation: [
      { id: 'scene_observation', name: 'Scene of Crime Report', desc: 'Crime scene observation report' },
      { id: 'crime_sketch', name: 'Crime Scene Sketch', desc: 'Detailed scene sketch report' },
      { id: 'investigation_start', name: 'Investigation Commencement', desc: 'Start of investigation report' },
      { id: 'case_diary', name: 'Case Diary Entry', desc: 'Daily investigation diary' },
      { id: 'progress_report', name: 'Investigation Progress', desc: 'Progress report to superiors' },
      { id: 'investigation_complete', name: 'Investigation Completion', desc: 'Final investigation report' }
    ],
    witness: [
      { id: 'witness_161', name: 'Witness Statement (161)', desc: '161 CrPC / BNSS statement' },
      { id: 'witness_reexam', name: 'Witness Re-examination', desc: 'Re-examination of witness' },
      { id: 'witness_identification', name: 'Witness Identification Memo', desc: 'TIP memorandum' },
      { id: 'witness_protection', name: 'Witness Protection Note', desc: 'Protection request' },
      { id: 'witness_attendance', name: 'Witness Attendance Memo', desc: 'Attendance record' }
    ],
    evidence: [
      { id: 'seizure', name: 'Seizure Panchanama', desc: 'General seizure document' },
      { id: 'property_seizure', name: 'Property Seizure Memo', desc: 'Property seizure document' },
      { id: 'vehicle_seizure', name: 'Vehicle Seizure Memo', desc: 'Vehicle seizure document' },
      { id: 'mobile_seizure', name: 'Mobile Phone Seizure', desc: 'Mobile phone seizure memo' },
      { id: 'laptop_seizure', name: 'Laptop Seizure Memo', desc: 'Laptop/Computer seizure' },
      { id: 'digital_evidence', name: 'Digital Evidence Report', desc: 'Digital evidence seizure' },
      { id: 'evidence_label', name: 'Evidence Label Register', desc: 'Label and tag evidence' },
      { id: 'evidence_transfer', name: 'Evidence Transfer Memo', desc: 'Transfer to FSL/court' },
      { id: 'chain_custody', name: 'Chain of Custody Record', desc: 'Evidence custody chain' }
    ],
    forensic: [
      { id: 'fsl_request', name: 'FSL Request Letter', desc: 'Forensic Science Lab request' },
      { id: 'fingerprint_request', name: 'Fingerprint Analysis', desc: 'Fingerprint examination' },
      { id: 'dna_request', name: 'DNA Examination Request', desc: 'DNA analysis request' },
      { id: 'cyber_forensic', name: 'Cyber Forensic Request', desc: 'Digital forensics request' },
      { id: 'document_exam', name: 'Document Examination', desc: 'Questioned document analysis' }
    ],
    letters: [
      { id: 'cdr_request', name: 'CDR Request Letter', desc: 'Call Detail Records request' },
      { id: 'ip_request', name: 'IP Address Request', desc: 'IP information request' },
      { id: 'bank_request', name: 'Bank Account Request', desc: 'Bank account details' },
      { id: 'transaction_request', name: 'Transaction History', desc: 'Transaction details request' },
      { id: 'cctv_request', name: 'CCTV Footage Request', desc: 'CCTV footage requisition' },
      { id: 'hotel_register', name: 'Hotel Register Request', desc: 'Hotel guest verification' },
      { id: 'vehicle_request', name: 'Vehicle Registration', desc: 'RTO information request' },
      { id: 'social_media', name: 'Social Media Request', desc: 'Social media account info' }
    ],
    accused: [
      { id: 'notice_35', name: 'Notice to Accused (BNSS 35)', desc: 'Notice under Section 35' },
      { id: 'summons_accused', name: 'Summons to Accused', desc: 'Court summons to accused' },
      { id: 'arrest_memo', name: 'Arrest Memo', desc: 'Arrest memorandum' },
      { id: 'personal_search', name: 'Personal Search Memo', desc: 'Body search record' },
      { id: 'medical_exam', name: 'Medical Examination', desc: 'Medical exam request' },
      { id: 'custody_memo', name: 'Custody Memo', desc: 'Custody transfer memo' },
      { id: 'bail_opposition', name: 'Bail Opposition Note', desc: 'Oppose bail application' },
      { id: 'police_custody', name: 'Police Custody Request', desc: 'PC remand application' }
    ],
    court: [
      { id: 'remand_application', name: 'Remand Application', desc: 'Judicial custody remand' },
      { id: 'bail_objection', name: 'Bail Objection Report', desc: 'Detailed bail objection' },
      { id: 'chargesheet', name: 'Charge Sheet Draft', desc: 'Final charge sheet' },
      { id: 'supplementary_cs', name: 'Supplementary Charge Sheet', desc: 'Additional charge sheet' },
      { id: 'final_report', name: 'Final Investigation Report', desc: 'FR / Closure report' },
      { id: 'case_closure', name: 'Case Closure Report', desc: 'Case closure memo' }
    ],
    admin: [
      { id: 'case_status', name: 'Case Status Report', desc: 'Current case status' },
      { id: 'daily_crime', name: 'Daily Crime Report', desc: 'Daily crime statistics' },
      { id: 'weekly_crime', name: 'Weekly Crime Report', desc: 'Weekly crime summary' },
      { id: 'monthly_crime', name: 'Monthly Crime Report', desc: 'Monthly statistics' },
      { id: 'station_stats', name: 'Station Crime Statistics', desc: 'PS-wise crime data' },
      { id: 'property_disposal', name: 'Property Disposal Report', desc: 'Seized property disposal' }
    ]
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateDocumentContent = (templateId) => {
    const { policeStation, crimeNumber, firNumber, caseId, complainantName, complainantAddress, complainantPhone,
      accusedName, accusedAddress, date, time, location, officerName, officerRank, officerBadge,
      witnessName, witnessAddress, witnessPhone, seizureItems, bankName, accountNumber, ifscCode,
      mobileNumber, imeiNumber, vehicleNumber, vehicleType, ipAddress, socialMediaHandle,
      description, sections, court, magistrate, remandDays, fslType, evidenceType } = formData;

    const currentDateTime = new Date().toLocaleString();
    const templates = {
      // COMPLAINT STAGE
      petition: `PETITION REPORT

Police Station: ${policeStation}
Crime Number: ${crimeNumber}
Date: ${date}

COMPLAINANT DETAILS:
Name: ${complainantName}
Address: ${complainantAddress}
Phone: ${complainantPhone}

ACCUSED DETAILS (If Known):
Name: ${accusedName}
Address: ${accusedAddress}

COMPLAINT DESCRIPTION:
${description}

This petition is filed under the provisions of Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023.

Received By: ${officerName}
Rank: ${officerRank}
Badge No: ${officerBadge}
Date & Time: ${currentDateTime}

Signature of Complainant: _______________
Signature of Receiving Officer: _______________`,

      csr: `CRIME & STATION REPORT (CSR)

Police Station: ${policeStation}
CSR Number: CSR/${crimeNumber}/${new Date().getFullYear()}
Date & Time of Entry: ${currentDateTime}

INCIDENT DETAILS:
Location: ${location}
Date of Incident: ${date}
Time of Incident: ${time}

COMPLAINANT:
Name: ${complainantName}
Contact: ${complainantPhone}

ACCUSED (If Known):
Name: ${accusedName}

BRIEF FACTS:
${description}

ACTION TAKEN:
[ ] FIR Registered
[ ] Preliminary Enquiry Ordered
[ ] Referred to Concerned PS
[ ] Community Service Register

Station House Officer: ${officerName}
Rank: ${officerRank}`,

      station_diary: `STATION DIARY ENTRY

Police Station: ${policeStation}
GD Entry Number: GD/${new Date().getFullYear()}/______
Date: ${date}
Time: ${time}

NATURE OF ENTRY:
${description}

PERSONS INVOLVED:
${complainantName || 'N/A'}

ACTION TAKEN:
_________________________________

Entry Made By: ${officerName}
Rank: ${officerRank}
Signature: _______________`,

      complaint_ack: `COMPLAINT ACKNOWLEDGEMENT RECEIPT

Police Station: ${policeStation}
Receipt Number: ACK/${crimeNumber}/${new Date().getFullYear()}
Date: ${date}

This is to acknowledge that a complaint has been received from:

Name: ${complainantName}
Address: ${complainantAddress}
Phone: ${complainantPhone}

Nature of Complaint: ${description.substring(0, 100)}...

The complaint has been registered and will be processed as per law.

Reference Number for Follow-up: ${crimeNumber}

Received By:
${officerName}
${officerRank}
${policeStation}

Note: Please retain this receipt for future reference.`,

      preliminary_enquiry: `PRELIMINARY ENQUIRY REPORT

Police Station: ${policeStation}
PE Number: PE/${crimeNumber}/${new Date().getFullYear()}
Date: ${date}

SUBJECT: Preliminary Enquiry in the matter of ${complainantName}

1. COMPLAINT RECEIVED:
   Date: ${date}
   From: ${complainantName}
   
2. ALLEGATIONS:
${description}

3. ENQUIRY CONDUCTED:
   [Details of enquiry steps taken]

4. FINDINGS:
   [Summary of findings]

5. RECOMMENDATION:
   [ ] Register FIR under sections: ${sections}
   [ ] Close as non-cognizable
   [ ] Refer to appropriate authority

Enquiry Officer: ${officerName}
Rank: ${officerRank}
Date: ${currentDateTime}`,

      complaint_closure: `COMPLAINT CLOSURE REPORT

Police Station: ${policeStation}
Complaint Number: ${crimeNumber}
Date: ${date}

COMPLAINANT:
Name: ${complainantName}
Address: ${complainantAddress}

ORIGINAL COMPLAINT:
${description}

REASON FOR CLOSURE:
[ ] Civil dispute - not cognizable
[ ] No offence disclosed
[ ] Compromise between parties
[ ] Withdrawn by complainant
[ ] Referred to other authority

REMARKS:
_________________________________

Approved By:
Station House Officer: _______________
Date: ${date}`,

      complaint_forward: `COMPLAINT FORWARDING NOTE

From: SHO, ${policeStation}
To: SHO, _______________
Date: ${date}

Subject: Forwarding of Complaint for Necessary Action

Sir/Madam,

The following complaint is forwarded to your police station as the incident falls within your jurisdiction:

Complainant: ${complainantName}
Contact: ${complainantPhone}
Nature: ${description.substring(0, 150)}...

Original Complaint Number: ${crimeNumber}
Date of Receipt: ${date}

Kindly take necessary action and acknowledge receipt.

${officerName}
${officerRank}
${policeStation}`,

      // FIR STAGE
      fir_draft: `FIRST INFORMATION REPORT (FIR)

Police Station: ${policeStation}
FIR Number: ${firNumber || '______/2025'}
Date & Time: ${date} at ${time}

District: _______________
Year: ${new Date().getFullYear()}

1. OCCURRENCE OF OFFENCE:
   Date From: ${date}  Time: ${time}
   Date To: ______    Time: ______
   Place: ${location}
   
2. COMPLAINANT:
   Name: ${complainantName}
   Father/Husband: _______________
   Address: ${complainantAddress}
   Phone: ${complainantPhone}
   
3. ACCUSED (If Known):
   Name: ${accusedName}
   Address: ${accusedAddress}
   
4. DETAILS OF OFFENCE:
${description}

5. SECTIONS APPLICABLE:
   BNS: ${sections}
   Special Acts: _______________

6. PROPERTY STOLEN/INVOLVED:
   _______________

7. TOTAL VALUE: Rs. _______________

8. INVESTIGATION:
   Handed Over To: ${officerName}
   Rank: ${officerRank}

Signature of Complainant: _______________
Signature of SHO: _______________`,

      fir_correction: `FIR CORRECTION REPORT

Police Station: ${policeStation}
FIR Number: ${firNumber}
Date of FIR: ${date}

CORRECTIONS REQUIRED:

Serial No. | Original Entry | Corrected Entry
1.         | _____________ | _____________
2.         | _____________ | _____________
3.         | _____________ | _____________

REASON FOR CORRECTION:
${description}

Requested By: ${officerName}
Rank: ${officerRank}

Approved By:
SHO: _______________
Date: ${currentDateTime}`,

      fir_copy: `CERTIFIED COPY OF FIR

Police Station: ${policeStation}
FIR Number: ${firNumber}
Date: ${date}

This is to certify that the above FIR has been registered at this police station.

Complainant: ${complainantName}
Accused: ${accusedName}
Sections: ${sections}

This certified copy is issued to: _______________
Purpose: _______________

Fee Paid: Rs. _______________
Receipt No: _______________

Certified that this is a true copy of the original FIR.

Station House Officer
${policeStation}
Seal & Signature`,

      fir_court: `FIR DISPATCH TO COURT

From: SHO, ${policeStation}
To: The Registrar, ${court || 'Judicial Magistrate First Class'}
Date: ${date}

Subject: Dispatch of FIR Copy

Sir/Madam,

Kindly find enclosed herewith a copy of FIR No. ${firNumber} registered at ${policeStation} for your record and necessary action.

FIR Details:
- Number: ${firNumber}
- Date: ${date}
- Sections: ${sections}
- Accused: ${accusedName}

Enclosures:
1. Copy of FIR
2. Medical Report (if applicable)

${officerName}
${officerRank}
${policeStation}`,

      fir_senior: `FIR DISPATCH TO SENIOR OFFICER

From: SHO, ${policeStation}
To: DCP/ACP/SDPO _______________
Date: ${date}

Subject: Report regarding FIR No. ${firNumber}

Sir/Madam,

This is to report that FIR No. ${firNumber} has been registered at ${policeStation}.

Brief Facts:
${description}

Sections Applied: ${sections}
Accused: ${accusedName}
Current Status: Under Investigation

Investigation assigned to: ${officerName}, ${officerRank}

Submitted for your kind information.

Station House Officer
${policeStation}`,

      // INVESTIGATION STAGE
      scene_observation: `SCENE OF CRIME OBSERVATION REPORT

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

1. PLACE OF OCCURRENCE:
   Location: ${location}
   Type of Place: _______________

2. DATE & TIME OF VISIT:
   Date: ${date}
   Time: ${time}

3. OBSERVATIONS:
${description}

4. PHYSICAL EVIDENCE FOUND:
   a. _______________
   b. _______________
   c. _______________

5. PHOTOGRAPHS TAKEN: Yes / No
   Number of Photos: _______________

6. SKETCH PREPARED: Yes / No

7. FORENSIC TEAM CALLED: Yes / No

Investigating Officer: ${officerName}
Rank: ${officerRank}
Signature: _______________

Witnesses Present:
1. ${witnessName} - ${witnessAddress}
2. _______________`,

      crime_sketch: `CRIME SCENE SKETCH REPORT

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

Location: ${location}

SKETCH DETAILS:
[Attach hand-drawn or digital sketch]

LEGEND:
A - Entry point
B - Body/Victim location
C - Weapon/Evidence location
D - Exit point

MEASUREMENTS:
Room Size: ___ x ___ feet
Distance A to B: ___ feet
Distance B to C: ___ feet

DESCRIPTION:
${description}

Prepared By: ${officerName}
Rank: ${officerRank}
Date: ${date}`,

      investigation_start: `INVESTIGATION COMMENCEMENT REPORT

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

SUBJECT: Commencement of Investigation

1. FIR registered on: ${date}
2. Investigation commenced on: ${date}
3. Investigating Officer: ${officerName}, ${officerRank}

4. INITIAL STEPS TAKEN:
   [ ] Scene of crime visited
   [ ] Complainant statement recorded
   [ ] Witnesses identified
   [ ] Evidence collected
   [ ] Accused identified

5. PRELIMINARY FINDINGS:
${description}

6. NEXT STEPS PLANNED:
   a. _______________
   b. _______________

Investigating Officer: ${officerName}
Signature: _______________`,

      case_diary: `CASE DIARY ENTRY

FIR Number: ${firNumber}
Police Station: ${policeStation}
Diary Date: ${date}
CD Number: CD-___

INVESTIGATION PROGRESS:

Today's Activities:
${description}

Evidence Collected: _______________
Statements Recorded: _______________
Places Visited: ${location}

Persons Examined:
1. ${witnessName}
2. _______________

Next Steps:
_______________

Time Spent: _____ hours

Investigating Officer: ${officerName}
Rank: ${officerRank}
Signature: _______________`,

      progress_report: `INVESTIGATION PROGRESS REPORT

To: ${court || 'Senior Officer'}
From: IO, ${policeStation}
Date: ${date}

Subject: Progress Report in FIR No. ${firNumber}

Sir/Madam,

The following progress has been made in the investigation:

1. FIR Details:
   - Number: ${firNumber}
   - Sections: ${sections}
   - Accused: ${accusedName}

2. Investigation Progress:
${description}

3. Evidence Collected:
   _______________

4. Accused Status:
   [ ] Arrested [ ] Absconding [ ] On Bail

5. Expected Time for Completion: _____ days

Investigating Officer: ${officerName}
Rank: ${officerRank}`,

      investigation_complete: `INVESTIGATION COMPLETION REPORT

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

INVESTIGATION SUMMARY:

1. Date of FIR: ${date}
2. Date of Completion: ${date}
3. Total Days: _____

4. FINDINGS:
${description}

5. EVIDENCE COLLECTED:
   a. _______________
   b. _______________

6. WITNESSES EXAMINED: _____

7. ACCUSED STATUS:
   Name: ${accusedName}
   Status: _______________

8. RECOMMENDATION:
   [ ] File Charge Sheet
   [ ] File Final Report
   [ ] Further Investigation Needed

Investigating Officer: ${officerName}
Rank: ${officerRank}
Date: ${date}`,

      // WITNESS EXAMINATION
      witness_161: `STATEMENT UNDER SECTION 161 CrPC / SECTION 180 BNSS

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

WITNESS DETAILS:
Name: ${witnessName}
Father/Husband: _______________
Age: _____ years
Occupation: _______________
Address: ${witnessAddress}
Phone: ${witnessPhone}

STATEMENT:
I, ${witnessName}, do hereby state as follows:

${description}

I state that the above statement is true to the best of my knowledge and belief. I understand that making a false statement is punishable under law.

Signature of Witness: _______________
Date: ${date}
Time: ${time}

Statement Recorded By:
${officerName}, ${officerRank}
Signature: _______________`,

      witness_reexam: `WITNESS RE-EXAMINATION REPORT

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

WITNESS: ${witnessName}

REASON FOR RE-EXAMINATION:
${description}

ADDITIONAL STATEMENT:
_______________________________________________
_______________________________________________

Signature of Witness: _______________

Re-examination Conducted By:
${officerName}, ${officerRank}`,

      witness_identification: `WITNESS IDENTIFICATION MEMO (TIP)

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

TEST IDENTIFICATION PARADE MEMORANDUM

Conducted At: ${location}
Under Supervision of: ${magistrate || 'Judicial Magistrate'}

WITNESS:
Name: ${witnessName}
Address: ${witnessAddress}

IDENTIFICATION:
The witness identified the following person(s):
1. ${accusedName} - Position in line-up: _____

OBSERVATIONS:
${description}

Witness Signature: _______________
Magistrate Signature: _______________
IO Signature: _______________`,

      witness_protection: `WITNESS PROTECTION NOTE

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

REQUEST FOR WITNESS PROTECTION

Witness Details:
Name: ${witnessName}
Address: ${witnessAddress}
Phone: ${witnessPhone}

Nature of Threat:
${description}

Protection Requested:
[ ] Police escort
[ ] Safe house accommodation
[ ] Identity protection
[ ] Relocation assistance

Urgency: [ ] High [ ] Medium [ ] Low

Recommended By: ${officerName}, ${officerRank}
Approved By: _______________`,

      witness_attendance: `WITNESS ATTENDANCE MEMO

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

WITNESS ATTENDANCE RECORD

Name: ${witnessName}
Address: ${witnessAddress}
Relation to Case: _______________

Purpose of Visit: Statement Recording / Evidence / Other

Arrival Time: ${time}
Departure Time: _____

Statement/Evidence Provided: Yes / No

Signature of Witness: _______________

Recorded By: ${officerName}
Rank: ${officerRank}`,

      // EVIDENCE COLLECTION
      seizure: `SEIZURE PANCHANAMA
(Under Section 105 BNSS)

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date & Time: ${date} at ${time}
Place of Seizure: ${location}

In presence of the following witnesses, the following articles were seized:

ITEMS SEIZED:
${seizureItems || '1. _____\n2. _____\n3. _____'}

DESCRIPTION:
${description}

The seized articles have been properly sealed, labeled, and taken into custody.
Seal Mark: ${policeStation}/SEIZURE/${new Date().getFullYear()}

Investigating Officer:
Name: ${officerName}
Rank: ${officerRank}
Signature: _______________

WITNESSES:
1. Name: _______________ Address: _______________
   Signature: _______________

2. Name: _______________ Address: _______________
   Signature: _______________

Acknowledgment of Seizure by Owner/Possessor: _______________`,

      property_seizure: `PROPERTY SEIZURE MEMO

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

PROPERTY DETAILS:
Description: ${seizureItems}
Location Found: ${location}
Owner/Possessor: ${accusedName}

ESTIMATED VALUE: Rs. _______________

CONDITION: [ ] Good [ ] Fair [ ] Damaged

STORAGE LOCATION: ${policeStation} Malkhana

Receipt Number: MKH/${new Date().getFullYear()}/______

Seized By: ${officerName}, ${officerRank}
Witness: ${witnessName}

Owner's Signature: _______________
IO Signature: _______________`,

      vehicle_seizure: `VEHICLE SEIZURE MEMO

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

VEHICLE DETAILS:
Type: ${vehicleType}
Registration Number: ${vehicleNumber}
Make/Model: _______________
Color: _______________
Engine Number: _______________
Chassis Number: _______________

OWNER DETAILS:
Name: ${accusedName}
Address: ${accusedAddress}

CONDITION AT SEIZURE:
Odometer Reading: _____ km
Fuel Level: _______________
Damage (if any): _______________

STORAGE LOCATION: _______________

Seized By: ${officerName}, ${officerRank}
Owner's Signature: _______________`,

      mobile_seizure: `MOBILE PHONE SEIZURE MEMO

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

DEVICE DETAILS:
Make: _______________
Model: _______________
Color: _______________
Mobile Number: ${mobileNumber}
IMEI Number: ${imeiNumber}
IMEI 2: _______________

SIM CARD DETAILS:
SIM 1: Provider: _______ Number: _______
SIM 2: Provider: _______ Number: _______

MEMORY CARD: Yes / No
Capacity: _____ GB

CONDITION: [ ] Working [ ] Damaged [ ] Locked

OWNER/POSSESSOR: ${accusedName}

Chain of Custody initiated.
Sealed in evidence bag: Seal No. _______________

Seized By: ${officerName}, ${officerRank}`,

      laptop_seizure: `LAPTOP/COMPUTER SEIZURE MEMO

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

DEVICE DETAILS:
Type: [ ] Laptop [ ] Desktop [ ] Tablet
Make: _______________
Model: _______________
Serial Number: _______________
Color: _______________

ACCESSORIES SEIZED:
[ ] Power Adapter
[ ] Mouse
[ ] Keyboard
[ ] External Hard Drive
[ ] USB Drives: Quantity _____

CONDITION: [ ] Working [ ] Damaged

OWNER/POSSESSOR: ${accusedName}

Digital forensic imaging recommended: Yes / No

Sealed with evidence seal: ${policeStation}/DIG/${new Date().getFullYear()}/____

Seized By: ${officerName}, ${officerRank}`,

      digital_evidence: `DIGITAL EVIDENCE SEIZURE REPORT

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

DIGITAL EVIDENCE DETAILS:

Type of Evidence:
[ ] Email Records
[ ] Social Media Data
[ ] Chat Messages
[ ] Digital Images/Videos
[ ] Financial Records
[ ] Other: _______________

SOURCE:
Platform/Service: _______________
Account/ID: ${socialMediaHandle}
IP Address: ${ipAddress}

PRESERVATION METHOD:
[ ] Screenshot with timestamp
[ ] Hash verification (MD5/SHA-256)
[ ] Forensic image
[ ] Certified copy from service provider

Hash Value: _______________

${description}

Collected By: ${officerName}, ${officerRank}
Date: ${date}`,

      evidence_label: `EVIDENCE LABEL REGISTER

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

EVIDENCE LABEL DETAILS:

Label Number: EVD/${firNumber}/${new Date().getFullYear()}/____

Item Description: ${seizureItems}

Category:
[ ] Physical [ ] Digital [ ] Documentary [ ] Biological

Collection Details:
Date: ${date}
Time: ${time}
Location: ${location}
Collected By: ${officerName}

Current Location: _______________
Status: [ ] In Custody [ ] Sent to FSL [ ] Produced in Court

Remarks: ${description}`,

      evidence_transfer: `EVIDENCE TRANSFER MEMO

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

TRANSFER DETAILS:

From: ${policeStation}
To: ${fslType || 'FSL'} / ${court || 'Court'}

ITEMS TRANSFERRED:
${seizureItems}

Purpose: [ ] Forensic Analysis [ ] Court Production [ ] Safe Custody

Seal Numbers: _______________

Handed Over By:
Name: ${officerName}
Rank: ${officerRank}
Signature: _______________
Date/Time: ${date} at ${time}

Received By:
Name: _______________
Designation: _______________
Signature: _______________
Date/Time: _______________`,

      chain_custody: `CHAIN OF CUSTODY RECORD

FIR Number: ${firNumber}
Police Station: ${policeStation}
Evidence Reference: EVD/${firNumber}/____

ITEM DESCRIPTION:
${seizureItems}

CUSTODY CHAIN:

| Date/Time | From | To | Purpose | Signature |
|-----------|------|-----|---------|-----------|
| ${date} | Scene | ${officerName} | Seizure | _______ |
| _______ | _______ | _______ | _______ | _______ |
| _______ | _______ | _______ | _______ | _______ |

INTEGRITY STATUS:
Original Seal Intact: Yes / No
Hash Verified (if digital): Yes / No

Current Custodian: _______________
Location: _______________`,

      // FORENSIC REQUESTS
      fsl_request: `FSL REQUEST LETTER

From: IO, ${policeStation}
To: Director, Forensic Science Laboratory
Date: ${date}

Subject: Request for Forensic Examination - FIR No. ${firNumber}

Sir/Madam,

Kindly examine the following exhibits and furnish report:

EXHIBITS:
${seizureItems}

TYPE OF EXAMINATION REQUIRED:
${fslType || '[ ] Chemical [ ] Biological [ ] Ballistics [ ] Documents [ ] Digital'}

BRIEF FACTS:
${description}

SPECIFIC QUESTIONS:
1. _______________
2. _______________

Urgency: [ ] Routine [ ] Urgent [ ] Very Urgent

Enclosures:
1. Sealed exhibits with seal impression
2. Copy of FIR

${officerName}
${officerRank}
${policeStation}`,

      fingerprint_request: `FINGERPRINT ANALYSIS REQUEST

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

To: Fingerprint Bureau

EXHIBITS SENT:
${seizureItems}

SUSPECTED PERSON:
Name: ${accusedName}
FP Slip Number (if available): _______________

EXAMINATION REQUIRED:
[ ] Development of latent prints
[ ] Comparison with suspect
[ ] Search in AFIS database

Location where prints were lifted: ${location}

${description}

Requesting Officer: ${officerName}, ${officerRank}`,

      dna_request: `DNA EXAMINATION REQUEST

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

To: DNA Division, FSL

BIOLOGICAL SAMPLES SENT:
${seizureItems}

REFERENCE SAMPLES:
Victim: _______________
Suspect: ${accusedName}

EXAMINATION REQUIRED:
[ ] DNA Profiling
[ ] Comparison with reference
[ ] Paternity/Maternity test
[ ] Database search

COLD CHAIN MAINTAINED: Yes / No

${description}

Requesting Officer: ${officerName}, ${officerRank}`,

      cyber_forensic: `CYBER FORENSIC ANALYSIS REQUEST

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

To: Cyber Forensic Division

DIGITAL DEVICES/DATA:
${seizureItems}

EXAMINATION REQUIRED:
[ ] Data extraction and analysis
[ ] Deleted file recovery
[ ] Email/Chat analysis
[ ] Browser history analysis
[ ] Social media analysis
[ ] Malware analysis
[ ] IP tracing

SPECIFIC QUERIES:
1. ${description}
2. _______________

Device Passwords (if known): _______________

Hash Values:
MD5: _______________
SHA-256: _______________

Requesting Officer: ${officerName}, ${officerRank}`,

      document_exam: `DOCUMENT EXAMINATION REQUEST

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

To: Document Examination Division, FSL

QUESTIONED DOCUMENTS:
${seizureItems}

STANDARD/SPECIMEN SAMPLES:
${description}

EXAMINATION REQUIRED:
[ ] Handwriting comparison
[ ] Signature verification
[ ] Typewriting examination
[ ] Alterations/Additions
[ ] Age determination
[ ] Paper and ink analysis

SPECIFIC QUESTIONS:
1. _______________
2. _______________

Requesting Officer: ${officerName}, ${officerRank}`,

      // INVESTIGATION LETTERS
      cdr_request: `CDR REQUEST LETTER

From: ${officerName}, ${officerRank}
${policeStation}

To: Nodal Officer
${bankName || '[Service Provider Name]'}

Date: ${date}

Subject: Request for Call Detail Records - FIR No. ${firNumber}

Sir/Madam,

Investigation is being conducted in FIR No. ${firNumber}. 

Mobile Number(s): ${mobileNumber}

Period: From __________ To __________

Please provide:
1. Incoming and outgoing call details
2. SMS details
3. Data usage details
4. Cell tower/location information
5. IMEI details
6. Subscriber details

This is an urgent requirement for investigation purposes.

${officerName}
${officerRank}
${policeStation}`,

      ip_request: `IP ADDRESS INFORMATION REQUEST

From: ${officerName}, ${officerRank}
${policeStation}

To: Nodal Officer
[Internet Service Provider]

Date: ${date}

Subject: Request for IP Address Information - FIR No. ${firNumber}

Sir/Madam,

Please provide subscriber details for the following IP address:

IP Address: ${ipAddress}
Date/Time of Activity: ${date} at ${time}

Information Required:
1. Subscriber name and address
2. Contact details
3. MAC address
4. Connection type

${description}

${officerName}
${officerRank}
${policeStation}`,

      bank_request: `BANK ACCOUNT INFORMATION REQUEST
(Under Section 94 BNSS)

From: ${officerName}, ${officerRank}
${policeStation}

To: Branch Manager
${bankName}

Date: ${date}

Subject: Request for Bank Account Information - FIR No. ${firNumber}

Sir/Madam,

Please provide the following information for:

Account Number: ${accountNumber}
IFSC Code: ${ifscCode}

Information Required:
1. Account holder details with KYC
2. Account opening date
3. Last 6 months statement
4. Cheque book details
5. Linked mobile numbers
6. Any suspicious transactions

This is issued under BNSS for investigation purposes.

${officerName}
${officerRank}
${policeStation}`,

      transaction_request: `TRANSACTION HISTORY REQUEST

From: ${officerName}, ${officerRank}
${policeStation}

To: Branch Manager
${bankName}

Date: ${date}

Subject: Transaction History - FIR No. ${firNumber}

Sir/Madam,

Please provide transaction history for:

Account Number: ${accountNumber}
Period: From __________ To __________

Specific Transactions (if known):
${description}

Include:
1. All credits and debits
2. UPI transactions
3. NEFT/RTGS/IMPS details
4. Beneficiary details
5. Transaction reference numbers

${officerName}
${officerRank}
${policeStation}`,

      cctv_request: `CCTV FOOTAGE REQUEST

From: ${officerName}, ${officerRank}
${policeStation}

To: Manager/Owner
${location}

Date: ${date}

Subject: Request for CCTV Footage - FIR No. ${firNumber}

Sir/Madam,

Please preserve and provide CCTV footage for:

Date: ${date}
Time: From _____ To _____
Location/Camera: ${description}

Format: USB/DVD (readable format)

Note: Please do not overwrite the footage as it is evidence in a criminal case.

${officerName}
${officerRank}
${policeStation}`,

      hotel_register: `HOTEL REGISTER VERIFICATION REQUEST

From: ${officerName}, ${officerRank}
${policeStation}

To: Manager
${location}

Date: ${date}

Subject: Guest Register Verification - FIR No. ${firNumber}

Sir/Madam,

Please provide guest registration details for:

Guest Name: ${accusedName}
Date of Stay: ${date}
Room Number (if known): _______________

Required Information:
1. ID proof submitted
2. Check-in/Check-out times
3. Contact number provided
4. Accompanying persons
5. Payment method
6. CCTV footage of lobby/corridor

${officerName}
${officerRank}
${policeStation}`,

      vehicle_request: `VEHICLE REGISTRATION INFORMATION REQUEST

From: ${officerName}, ${officerRank}
${policeStation}

To: Regional Transport Officer
_______________

Date: ${date}

Subject: Vehicle Registration Details - FIR No. ${firNumber}

Sir/Madam,

Please provide registration details for:

Vehicle Number: ${vehicleNumber}

Information Required:
1. Registered owner name and address
2. Insurance details
3. Fitness certificate validity
4. Hypothecation details
5. RC book copy

${description}

${officerName}
${officerRank}
${policeStation}`,

      social_media: `SOCIAL MEDIA ACCOUNT INFORMATION REQUEST

From: ${officerName}, ${officerRank}
${policeStation}

To: Grievance Officer
[Platform Name]

Date: ${date}

Subject: Request for Account Information - FIR No. ${firNumber}

Sir/Madam,

Please provide information for the following account:

Platform: _______________
Username/Handle: ${socialMediaHandle}
Profile URL: _______________

Information Required:
1. Account registration details
2. Email/Phone linked
3. IP logs for last 90 days
4. Content posted (if still available)
5. Messages (as per platform policy)

${description}

This is a lawful request for criminal investigation.

${officerName}
${officerRank}
${policeStation}`,

      // ACCUSED HANDLING
      notice_35: `NOTICE UNDER SECTION 35 BNSS

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

To: ${accusedName}
Address: ${accusedAddress}

NOTICE

You are hereby directed to appear before the undersigned at ${policeStation} on __________ at _____ hours in connection with FIR No. ${firNumber} for the purpose of investigation.

Sections: ${sections}

You are informed of your rights:
1. You may consult a lawyer
2. You are not bound to make any statement
3. Any statement made may be used in evidence

Failure to appear without sufficient cause may result in arrest.

${officerName}
${officerRank}
${policeStation}`,

      summons_accused: `SUMMONS TO ACCUSED

In the Court of ${court || 'Judicial Magistrate'}

Case Number: _______________
FIR Number: ${firNumber}

To: ${accusedName}
Address: ${accusedAddress}

SUMMONS

You are hereby summoned to appear before this court on __________ at _____ hours to answer the charges under ${sections}.

Failure to appear will result in issuance of warrant.

By Order of Court

Presiding Officer: _______________
Date: ${date}
Seal of Court`,

      arrest_memo: `ARREST MEMORANDUM
(Under Section 50 BNSS)

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date & Time of Arrest: ${date} at ${time}

ARRESTED PERSON:
Name: ${accusedName}
Father's Name: _______________
Age: _____ years
Address: ${accusedAddress}

GROUNDS OF ARREST:
${description}

Sections: ${sections}

RIGHTS OF ARRESTED PERSON:
1. Right to be informed of grounds of arrest - INFORMED
2. Right to legal counsel - INFORMED
3. Right to inform relative/friend - INFORMED
4. Right to be produced before Magistrate within 24 hours - INFORMED

Person Informed: _______________
Relationship: _______________
Time of Information: _____

Arresting Officer: ${officerName}
Rank: ${officerRank}

Signature of Arrested Person: _______________
Signature of Arresting Officer: _______________
Signature of Witness: _______________`,

      personal_search: `PERSONAL SEARCH MEMO

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

PERSON SEARCHED:
Name: ${accusedName}
Address: ${accusedAddress}

ARTICLES FOUND:
${seizureItems || '1. _____\n2. _____\n3. _____'}

SEARCH CONDUCTED BY:
Name: ${officerName}
Rank: ${officerRank}

In presence of witnesses:
1. ${witnessName}
2. _______________

Signature of Person Searched: _______________
Signature of Searching Officer: _______________
Signature of Witnesses: _______________`,

      medical_exam: `MEDICAL EXAMINATION REQUEST

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

To: Medical Officer
Government Hospital, _______________

Please conduct medical examination of:

Name: ${accusedName}
Age: _____
Gender: _____

PURPOSE:
[ ] Age determination
[ ] Injury examination
[ ] Fitness for custody
[ ] Potency test
[ ] Intoxication test

BRIEF FACTS:
${description}

Escorted By: ${officerName}, ${officerRank}

Note: Person has been informed of the examination.`,

      custody_memo: `CUSTODY MEMO

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

CUSTODY TRANSFER DETAILS:

Person: ${accusedName}

Transferred From: _______________
Transferred To: _______________
Date & Time: ${date} at ${time}

Purpose: [ ] Court Production [ ] Jail [ ] Medical [ ] Transit

Condition at Transfer:
[ ] Healthy [ ] Injured [ ] Requires medical attention

Handed Over By:
Name: ${officerName}
Rank: ${officerRank}
Signature: _______________

Received By:
Name: _______________
Designation: _______________
Signature: _______________`,

      bail_opposition: `BAIL OPPOSITION NOTE

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

In the Court of ${court}

State vs ${accusedName}

GROUNDS FOR OPPOSING BAIL:

1. Nature of Offence:
   Sections: ${sections}
   Maximum Punishment: _______________

2. Investigation Status:
${description}

3. Reasons for Opposition:
   [ ] Likely to flee
   [ ] May tamper with evidence
   [ ] May influence witnesses
   [ ] May commit similar offences
   [ ] Flight risk

4. Evidence collected/to be collected: _______________

PRAYER:
Bail application may be rejected in the interest of justice.

${officerName}
${officerRank}
${policeStation}`,

      police_custody: `POLICE CUSTODY REMAND APPLICATION

In the Court of ${court}
FIR Number: ${firNumber}

State vs ${accusedName}

APPLICATION FOR POLICE CUSTODY

The accused was arrested on ${date} in FIR No. ${firNumber}.

GROUNDS FOR POLICE CUSTODY:

1. ${description}
2. Recovery of _______________
3. Identification of co-accused
4. Verification of facts

Sections: ${sections}

CUSTODY REQUIRED: ${remandDays} days

PRAYER:
Grant Police Custody for ${remandDays} days.

${officerName}
${officerRank}
${policeStation}
Date: ${date}`,

      // COURT DOCUMENTS
      remand_application: `REMAND APPLICATION

In the Court of ${court}
FIR Number: ${firNumber}

State vs ${accusedName}

APPLICATION FOR JUDICIAL CUSTODY

The accused was arrested on ${date} under sections ${sections}.

BRIEF FACTS:
${description}

INVESTIGATION STATUS:
[ ] Evidence collection in progress
[ ] Forensic reports awaited
[ ] Witnesses to be examined

The accused was produced within 24 hours of arrest.

PRAYER:
Grant Judicial Custody for ${remandDays} days.

${officerName}
${officerRank}
${policeStation}
Date: ${date}`,

      bail_objection: `BAIL OBJECTION REPORT

In the Court of ${court}
FIR Number: ${firNumber}
Bail Application No.: _______________

State vs ${accusedName}

DETAILED BAIL OBJECTION

1. CASE DETAILS:
   - FIR No.: ${firNumber}
   - Sections: ${sections}
   - Date of Arrest: ${date}

2. BRIEF FACTS:
${description}

3. GROUNDS OF OBJECTION:
   a) Gravity of offence
   b) Role of accused
   c) Likelihood of absconding
   d) Tampering with evidence
   e) Influencing witnesses

4. EVIDENCE AGAINST ACCUSED:
   _______________

5. PREVIOUS CRIMINAL RECORD: Yes/No

PRAYER:
Bail application may be rejected.

${officerName}
${officerRank}
${policeStation}`,

      chargesheet: `CHARGE SHEET
(Under Section 193 BNSS)

In the Court of ${court}
FIR Number: ${firNumber}
Police Station: ${policeStation}

State vs ${accusedName}

CHARGE SHEET

1. CASE DETAILS:
   FIR Date: ${date}
   Sections: ${sections}

2. ACCUSED:
   Name: ${accusedName}
   Father's Name: _______________
   Address: ${accusedAddress}
   Present Status: [ ] In Custody [ ] On Bail [ ] Absconding

3. COMPLAINANT:
   Name: ${complainantName}
   Address: ${complainantAddress}

4. BRIEF FACTS:
${description}

5. EVIDENCE:
   a) Oral Evidence: _____ witnesses
   b) Documentary Evidence: _____
   c) Scientific Evidence: _____

6. PRAYER:
   Trial of accused for offences under ${sections}.

Investigating Officer:
${officerName}
${officerRank}
${policeStation}
Date: ${date}`,

      supplementary_cs: `SUPPLEMENTARY CHARGE SHEET

In the Court of ${court}
FIR Number: ${firNumber}
Original CS Date: _______________

SUPPLEMENTARY CHARGE SHEET

1. ADDITIONAL ACCUSED:
   Name: _______________
   Role: _______________

2. ADDITIONAL SECTIONS:
   ${sections}

3. NEW EVIDENCE:
${description}

4. REASON FOR SUPPLEMENTARY:
   [ ] New accused identified
   [ ] New evidence discovered
   [ ] Change in sections

${officerName}
${officerRank}
${policeStation}
Date: ${date}`,

      final_report: `FINAL INVESTIGATION REPORT

In the Court of ${court}
FIR Number: ${firNumber}
Police Station: ${policeStation}

FINAL REPORT

1. FIR DETAILS:
   Date: ${date}
   Sections: ${sections}
   Complainant: ${complainantName}
   Accused: ${accusedName}

2. INVESTIGATION FINDINGS:
${description}

3. CONCLUSION:
   [ ] True case - Charge Sheet filed
   [ ] Mistake of fact
   [ ] Mistake of law
   [ ] Civil dispute
   [ ] Untraced
   [ ] Insufficient evidence

4. RECOMMENDATION:
   [ ] Close the case
   [ ] Keep pending
   [ ] Transfer to other PS

${officerName}
${officerRank}
${policeStation}
Date: ${date}`,

      case_closure: `CASE CLOSURE REPORT

FIR Number: ${firNumber}
Police Station: ${policeStation}
Date: ${date}

CASE CLOSURE MEMO

1. FIR Details:
   Number: ${firNumber}
   Date: ${date}
   Sections: ${sections}

2. Complainant: ${complainantName}
3. Accused: ${accusedName}

4. Closure Reason:
   [ ] Final Report accepted by court
   [ ] Conviction
   [ ] Acquittal
   [ ] Compromise (compoundable)
   [ ] Abatement due to death

5. Final Status:
${description}

6. Property Disposed: Yes / No

Closure Approved By:
SHO: _______________
Date: ${date}`,

      // ADMINISTRATIVE REPORTS
      case_status: `CASE STATUS REPORT

Police Station: ${policeStation}
FIR Number: ${firNumber}
Report Date: ${date}

CASE STATUS SUMMARY

1. CASE DETAILS:
   Complainant: ${complainantName}
   Accused: ${accusedName}
   Sections: ${sections}
   Date of Registration: ${date}

2. CURRENT STATUS:
   [ ] Under Investigation
   [ ] Charge Sheet Filed
   [ ] Trial Ongoing
   [ ] Disposed

3. INVESTIGATION PROGRESS:
${description}

4. ACCUSED STATUS:
   [ ] Arrested [ ] On Bail [ ] Absconding

5. NEXT HEARING: _______________

Investigating Officer: ${officerName}
Rank: ${officerRank}`,

      daily_crime: `DAILY CRIME REPORT

Police Station: ${policeStation}
Date: ${date}

DAILY CRIME STATISTICS

1. FIRs Registered Today: _____
2. Arrests Made: _____
3. Cases Disposed: _____

CASES REGISTERED:
| S.No | FIR No. | Sections | Status |
|------|---------|----------|--------|
| 1    |         |          |        |
| 2    |         |          |        |

SIGNIFICANT INCIDENTS:
${description}

Station House Officer: ${officerName}
Signature: _______________`,

      weekly_crime: `WEEKLY CRIME REPORT

Police Station: ${policeStation}
Week: ${date} to _______________

WEEKLY CRIME STATISTICS

| Day | FIRs | Arrests | Disposed |
|-----|------|---------|----------|
| Mon |      |         |          |
| Tue |      |         |          |
| Wed |      |         |          |
| Thu |      |         |          |
| Fri |      |         |          |
| Sat |      |         |          |
| Sun |      |         |          |

TOTAL: FIRs: ___ | Arrests: ___ | Disposed: ___

NOTABLE CASES:
${description}

Station House Officer: ${officerName}`,

      monthly_crime: `MONTHLY CRIME REPORT

Police Station: ${policeStation}
Month: _______________
Year: ${new Date().getFullYear()}

MONTHLY CRIME STATISTICS

Category-wise Cases:
| Category | Registered | Disposed | Pending |
|----------|------------|----------|---------|
| Murder   |            |          |         |
| Robbery  |            |          |         |
| Theft    |            |          |         |
| Cheating |            |          |         |
| Cyber    |            |          |         |
| Others   |            |          |         |

TOTAL: Registered: ___ | Disposed: ___ | Pending: ___

Comparison with Previous Month: +/- ___%

${description}

Station House Officer: ${officerName}`,

      station_stats: `STATION CRIME STATISTICS

Police Station: ${policeStation}
Period: _______________

COMPREHENSIVE STATISTICS

1. CRIME REGISTRATION:
   Total FIRs: _____
   Cognizable: _____
   Non-Cognizable: _____

2. DISPOSAL:
   Charge Sheet: _____
   Final Report: _____
   Pending: _____

3. ARREST:
   Total Arrests: _____
   Judicial Custody: _____
   On Bail: _____

4. CONVICTION RATE: ___%

5. PROPERTY:
   Recovered: Rs. _____
   Disposed: Rs. _____

${description}

Station House Officer: ${officerName}`,

      property_disposal: `PROPERTY DISPOSAL REPORT

Police Station: ${policeStation}
FIR Number: ${firNumber}
Date: ${date}

PROPERTY DISPOSAL DETAILS

1. PROPERTY DESCRIPTION:
${seizureItems}

2. COURT ORDER:
   Order Date: _______________
   Order Details: _______________

3. DISPOSAL METHOD:
   [ ] Returned to owner
   [ ] Confiscated
   [ ] Auctioned
   [ ] Destroyed

4. DISPOSAL DATE: ${date}

5. RECIPIENT (if returned):
   Name: _______________
   Address: _______________
   ID Proof: _______________

Disposal Supervised By: ${officerName}
Witness: ${witnessName}

Signatures:
Officer: _______________
Recipient: _______________
Witness: _______________`
    };

    return templates[templateId] || 'Template not found';
  };

  const generateDocument = () => {
    if (!selectedTemplate) {
      toast.error('Please select a document template');
      return;
    }

    const content = generateDocumentContent(selectedTemplate);
    setGeneratedDocument(content);
    toast.success('Document generated!');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedDocument);
    toast.success('Copied to clipboard');
  };

  const downloadPDF = () => {
    if (!generatedDocument) {
      toast.error('Generate a document first');
      return;
    }

    const doc = new jsPDF();
    const lines = doc.splitTextToSize(generatedDocument, 180);
    doc.setFontSize(9);
    let y = 15;
    
    lines.forEach((line, i) => {
      if (y > 280) {
        doc.addPage();
        y = 15;
      }
      doc.text(line, 15, y);
      y += 5;
    });

    const templateName = Object.values(templates).flat().find(t => t.id === selectedTemplate)?.name || 'Document';
    doc.save(`${templateName.replace(/\s+/g, '_')}_${formData.crimeNumber || formData.firNumber || 'draft'}.pdf`);
    toast.success('PDF downloaded');
  };

  const downloadWord = async () => {
    if (!generatedDocument) {
      toast.error('Generate a document first');
      return;
    }

    const paragraphs = generatedDocument.split('\n').map(line => 
      new Paragraph({
        children: [new TextRun({ text: line, size: 22 })],
        spacing: { after: 100 }
      })
    );

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    const blob = await Packer.toBlob(doc);
    const templateName = Object.values(templates).flat().find(t => t.id === selectedTemplate)?.name || 'Document';
    saveAs(blob, `${templateName.replace(/\s+/g, '_')}_${formData.crimeNumber || formData.firNumber || 'draft'}.docx`);
    toast.success('Word document downloaded');
  };

  const printDocument = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${Object.values(templates).flat().find(t => t.id === selectedTemplate)?.name || 'Document'}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 40px; white-space: pre-wrap; font-size: 12px; }
          </style>
        </head>
        <body>${generatedDocument}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const saveToCaseFile = () => {
    if (!generatedDocument || !formData.caseId) {
      toast.error('Enter Case ID and generate document first');
      return;
    }

    const docRecord = {
      id: `DOC-${Date.now()}`,
      templateId: selectedTemplate,
      templateName: Object.values(templates).flat().find(t => t.id === selectedTemplate)?.name,
      caseId: formData.caseId,
      firNumber: formData.firNumber,
      content: generatedDocument,
      createdAt: new Date().toISOString(),
      category: selectedCategory
    };

    const newDocs = [docRecord, ...savedDocuments];
    setSavedDocuments(newDocs);
    
    // Also save to case_documents for Case File Manager linking
    const caseDocsKey = `case_documents_${formData.caseId}`;
    const existingDocs = JSON.parse(localStorage.getItem(caseDocsKey) || '[]');
    localStorage.setItem(caseDocsKey, JSON.stringify([docRecord, ...existingDocs]));

    toast.success('Saved to Case File!');
  };

  const filteredTemplates = (templates[selectedCategory] || []).filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.desc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryIcon = (id) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.icon : FileText;
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto" data-testid="investigation-documents-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <FileStack className="text-accent" size={32} />
            <h1 className="text-3xl font-heading font-bold text-white text-glow" data-testid="page-title">
              Investigation Documents
            </h1>
          </div>
          <p className="text-white/60">
            Complete police documentation system - 65+ templates organized by investigation stage
          </p>
        </motion.div>

        {/* Category Tabs */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-2">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id); setSelectedTemplate(null); }}
                  data-testid={`category-${cat.id}`}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'bg-accent text-black border-accent font-bold'
                      : 'bg-white/5 text-white/70 border-white/10 hover:border-white/30'
                  }`}
                >
                  <Icon size={16} />
                  <span className="text-sm">{cat.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    selectedCategory === cat.id ? 'bg-black/20' : 'bg-white/10'
                  }`}>{cat.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Template Selection */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-3 glassmorphism rounded-xl p-4 border border-white/10"
          >
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white/5 border-white/20 text-white pl-9 text-sm"
              />
            </div>
            
            <div className="space-y-1 max-h-[450px] overflow-y-auto">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  data-testid={`template-${template.id}`}
                  className={`w-full p-2.5 rounded-lg border text-left transition-all ${
                    selectedTemplate === template.id
                      ? 'bg-accent/20 border-accent'
                      : 'bg-white/5 border-white/10 hover:border-white/30'
                  }`}
                >
                  <p className={`font-semibold text-sm ${selectedTemplate === template.id ? 'text-accent' : 'text-white'}`}>
                    {template.name}
                  </p>
                  <p className="text-white/50 text-xs">{template.desc}</p>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Form Fields */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-4 glassmorphism rounded-xl p-4 border border-white/10"
          >
            <h2 className="text-base font-heading font-bold text-white mb-3">Document Details</h2>
            
            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Police Station</label>
                  <Input
                    placeholder="PS Name"
                    value={formData.policeStation}
                    onChange={(e) => handleInputChange('policeStation', e.target.value)}
                    className="bg-white/5 border-white/20 text-white text-sm h-8"
                  />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Case ID</label>
                  <Input
                    placeholder="CR/2025/001"
                    value={formData.caseId}
                    onChange={(e) => handleInputChange('caseId', e.target.value)}
                    className="bg-white/5 border-white/20 text-white text-sm h-8"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">FIR Number</label>
                  <Input
                    placeholder="123/2025"
                    value={formData.firNumber}
                    onChange={(e) => handleInputChange('firNumber', e.target.value)}
                    className="bg-white/5 border-white/20 text-white text-sm h-8"
                  />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Crime Number</label>
                  <Input
                    placeholder="456/2025"
                    value={formData.crimeNumber}
                    onChange={(e) => handleInputChange('crimeNumber', e.target.value)}
                    className="bg-white/5 border-white/20 text-white text-sm h-8"
                  />
                </div>
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Complainant Name</label>
                <Input
                  placeholder="Full Name"
                  value={formData.complainantName}
                  onChange={(e) => handleInputChange('complainantName', e.target.value)}
                  className="bg-white/5 border-white/20 text-white text-sm h-8"
                />
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Accused Name</label>
                <Input
                  placeholder="Full Name (if known)"
                  value={formData.accusedName}
                  onChange={(e) => handleInputChange('accusedName', e.target.value)}
                  className="bg-white/5 border-white/20 text-white text-sm h-8"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Date</label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className="bg-white/5 border-white/20 text-white text-sm h-8"
                  />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Time</label>
                  <Input
                    type="time"
                    value={formData.time}
                    onChange={(e) => handleInputChange('time', e.target.value)}
                    className="bg-white/5 border-white/20 text-white text-sm h-8"
                  />
                </div>
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Location</label>
                <Input
                  placeholder="Address/Place"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="bg-white/5 border-white/20 text-white text-sm h-8"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Officer Name</label>
                  <Input
                    placeholder="Your Name"
                    value={formData.officerName}
                    onChange={(e) => handleInputChange('officerName', e.target.value)}
                    className="bg-white/5 border-white/20 text-white text-sm h-8"
                  />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Rank</label>
                  <Input
                    placeholder="SI/CI/Inspector"
                    value={formData.officerRank}
                    onChange={(e) => handleInputChange('officerRank', e.target.value)}
                    className="bg-white/5 border-white/20 text-white text-sm h-8"
                  />
                </div>
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Sections (BNS/BNSS)</label>
                <Input
                  placeholder="e.g., 302, 34 BNS"
                  value={formData.sections}
                  onChange={(e) => handleInputChange('sections', e.target.value)}
                  className="bg-white/5 border-white/20 text-white text-sm h-8"
                />
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Description / Details</label>
                <Textarea
                  placeholder="Enter relevant details..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="bg-white/5 border-white/20 text-white text-sm min-h-[80px]"
                />
              </div>

              <Button
                onClick={generateDocument}
                data-testid="generate-document-btn"
                className="w-full bg-accent text-black font-bold hover:bg-accent/80"
              >
                Generate Document
              </Button>
            </div>
          </motion.div>

          {/* Document Preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-5 glassmorphism rounded-xl p-4 border border-white/10"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-heading font-bold text-white">Preview</h2>
              {generatedDocument && (
                <div className="flex gap-1">
                  <Button onClick={copyToClipboard} size="sm" className="bg-white/10 text-white hover:bg-white/20 h-7 px-2">
                    <Copy size={12} />
                  </Button>
                  <Button onClick={downloadPDF} size="sm" className="bg-white/10 text-white hover:bg-white/20 h-7 px-2">
                    <Download size={12} />
                    <span className="text-xs ml-1">PDF</span>
                  </Button>
                  <Button onClick={downloadWord} size="sm" className="bg-white/10 text-white hover:bg-white/20 h-7 px-2">
                    <Download size={12} />
                    <span className="text-xs ml-1">Word</span>
                  </Button>
                  <Button onClick={printDocument} size="sm" className="bg-white/10 text-white hover:bg-white/20 h-7 px-2">
                    <Printer size={12} />
                  </Button>
                  <Button onClick={saveToCaseFile} size="sm" className="bg-accent/20 text-accent hover:bg-accent/30 h-7 px-2">
                    <Save size={12} />
                    <span className="text-xs ml-1">Save</span>
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-black/40 rounded-lg p-3 border border-white/10 h-[450px] overflow-y-auto">
              {generatedDocument ? (
                <pre className="text-white/80 text-xs whitespace-pre-wrap font-mono" data-testid="document-preview">
                  {generatedDocument}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-white/40">
                  <div className="text-center">
                    <FileText size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Select a template and fill details</p>
                    <p className="text-sm mt-2">65+ police document templates available</p>
                  </div>
                </div>
              )}
            </div>

            {/* Saved Documents Summary */}
            {savedDocuments.length > 0 && (
              <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60 text-xs flex items-center gap-1">
                    <Folder size={12} />
                    Recently Saved ({savedDocuments.length})
                  </span>
                </div>
                <div className="space-y-1 max-h-[100px] overflow-y-auto">
                  {savedDocuments.slice(0, 5).map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between text-xs">
                      <span className="text-white truncate">{doc.templateName}</span>
                      <span className="text-white/40">{doc.caseId}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default InvestigationDocuments;
