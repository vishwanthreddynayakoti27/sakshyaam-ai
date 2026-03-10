# SAAKSHYAM COMMAND - Product Requirements Document

## Project Overview
**App Name**: SAAKSHYAM AI - COMMAND CONSOLE
**Subtitle**: Cyber Investigation Command Center - Pre-CCTNS Intelligence & FIR Preparation System
**Purpose**: Comprehensive investigation and FIR preparation tool for law enforcement officers

## Tech Stack
- **Frontend**: React 18, Tailwind CSS, Framer Motion, Lucide Icons, jsPDF, docx, file-saver, Leaflet.js, react-dropzone
- **Backend**: FastAPI, Pydantic, Motor (MongoDB async), PyPDF2, python-docx
- **Database**: MongoDB
- **APIs**: Google Cloud Vision, Translate, Speech-to-Text, Natural Language Processing
- **Maps**: Leaflet.js with OpenStreetMap
- **Auth**: JWT with 7-day expiration, auto-refresh on token expiration

## Core Modules (13 Total)

### 1. Dashboard
- Module grid with 13 navigation cards
- NEW badges on recently added modules
- Dark tactical cyber theme

### 2. Language Intelligence (HERO)
- Document processing: PNG, JPG, PDF, DOCX via Google Vision OCR
- Audio processing: MP3, WAV, M4A via Google Speech-to-Text
- 5-stage pipeline: Speech/OCR → Text → Translation → Grammar → Legal English
- Three-panel output: Original, Translated, Legal English
- TTS Read Aloud feature
- **Police Station Writer Style** - Converts informal narratives to formal FIR/complaint documentation style:
  - First-person to third-person conversion
  - Formal legal terminology
  - Proper sentence structure
  - Legal closing statement

### 3. FIR Draft Assistant
- First-to-third person conversion
- Error analysis (mixed narrative detection)
- Remand report generation

### 4. Legal Intelligence Engine
- 4-tab interface: All Laws, BNS, BNSS, BSA
- Case fact analysis with keyword detection
- 50+ sections with IPC/CrPC/Evidence Act mappings
- Auto-generated Remand Note
- BSA Section 63 Certifier
- Case Peer-Reviewer

### 5. Investigation Documents (EXPANDED - Dec 2025)
**65+ templates organized in 10 categories:**

| Category | Count | Templates |
|----------|-------|-----------|
| Complaint Stage | 7 | Petition Report, CSR Entry, Station Diary Entry, Complaint Acknowledgement, Preliminary Enquiry Report, Complaint Closure Report, Complaint Forwarding Note |
| FIR Stage | 5 | FIR Draft, FIR Correction Report, FIR Copy Generator, FIR Dispatch to Court, FIR Dispatch to Senior |
| Investigation | 6 | Scene of Crime Report, Crime Scene Sketch, Investigation Commencement, Case Diary Entry, Investigation Progress, Investigation Completion |
| Witness Examination | 5 | Witness Statement (161), Witness Re-examination, Witness Identification Memo, Witness Protection Note, Witness Attendance Memo |
| Evidence Collection | 9 | Seizure Panchanama, Property Seizure Memo, Vehicle Seizure Memo, Mobile Phone Seizure, Laptop Seizure Memo, Digital Evidence Report, Evidence Label Register, Evidence Transfer Memo, Chain of Custody Record |
| Forensic Requests | 5 | FSL Request Letter, Fingerprint Analysis, DNA Examination Request, Cyber Forensic Request, Document Examination |
| Investigation Letters | 8 | CDR Request, IP Address Request, Bank Account Request, Transaction History, CCTV Footage Request, Hotel Register Request, Vehicle Registration, Social Media Request |
| Accused Handling | 8 | Notice to Accused (BNSS 35), Summons to Accused, Arrest Memo, Personal Search Memo, Medical Examination, Custody Memo, Bail Opposition Note, Police Custody Request |
| Court Documents | 6 | Remand Application, Bail Objection Report, Charge Sheet Draft, Supplementary Charge Sheet, Final Investigation Report, Case Closure Report |
| Administrative | 6 | Case Status Report, Daily Crime Report, Weekly Crime Report, Monthly Crime Report, Station Crime Statistics, Property Disposal Report |

**Features:**
- Fillable form with auto-fill from FIR data
- PDF download (jsPDF)
- Word download (docx library)
- Print functionality
- Copy to clipboard
- **Save to Case File** (auto-links with Case File Manager)

### 6. Media Forensic Validator
- **AI Detection System** - Clearly identifies if media is REAL or AI-GENERATED
- Deterministic authenticity scoring with clear verdicts:
  - **LIKELY AUTHENTIC** (75-100%): Green - Media appears real
  - **INCONCLUSIVE** (50-74%): Yellow - Needs professional verification  
  - **LIKELY AI-GENERATED** (0-49%): Red - Media may be fake/manipulated
- Multi-factor analysis: metadata, file hash, compression artifacts, frame/spectral analysis
- Visual verdict display with color-coded results
- Spectral analysis chart with color matching verdict
- "Understanding Your Result" interpretation guide
- Recent analyses history with REAL/FAKE/UNCLEAR labels

### 7. Fraud Recovery Assistant
- Evidence upload with SHA-256 hashing
- OCR extraction for transaction details
- Bank lien request letter generation
- BSA Section 63 certificate generation

### 8. CDR Analyzer
- Dynamic column detection for any Excel/CSV format
- Automatic header mapping
- Batch processing for 5000+ records
- Analysis: Most called numbers, common locations, date range
- **Search by Number** - Find records by phone number
- **Search by Name** - Find records by subscriber/contact name

### 9. Smart Summons Tracker
- OCR-based summons document parsing
- Status tracking (Pending, Attended, Missed, Rescheduled)
- Urgency indicators
- PDF report generation

### 10. Jurisdiction Finder
- **713 Telangana police stations** across 34 districts, 11 commissionerates
- Leaflet.js interactive map
- Haversine formula for distance calculation
- Search by station name or district
- Click-to-find nearest station
- Zero FIR Transfer Letter PDF generator

### 11. SENTICEL Investigation Diary
- Social Pulse Integration & Volatility Alert System
- Sentiment analysis via Google Cloud NLP (with client-side fallback)
- Dual gauges: Legal Strength & Social Temperature
- Volatility Alerts (Protest Activity, Rumor Spreading, Crowd Formation, etc.)
- Keyword Spikes tracking
- Risk Level assessment (Safe, Moderate, Volatile)

### 12. Evidence Manager
- File upload with drag-drop (Images, Video, Audio, PDF, Documents)
- SHA-256 hash generation via browser crypto.subtle.digest
- Evidence integrity verification
- Search and filter functionality
- Evidence Library with case linkage
- localStorage persistence
- **Auto-links with Case File Manager via Case ID**

### 13. Case File Manager
- Case file creation with all details
- Status tracking (Under Investigation, Charge Sheet Filed, Trial Ongoing, Closed, Final Report)
- **Linked Documents section** - Shows documents saved from Investigation Documents
- **Linked Evidence section** - Shows evidence from Evidence Manager
- Comprehensive PDF export (includes linked documents and evidence)
- localStorage persistence

## Auto-Linking System (NEW)
Documents and evidence are automatically linked across modules using Case ID:
- **Investigation Documents** → Save with Case ID → Appears in Case File Manager's "Linked Documents"
- **Evidence Manager** → Upload with Case ID → Appears in Case File Manager's "Linked Evidence"
- localStorage keys: `case_documents_{caseId}`, `evidence_manager_data`

## Data Files
- `/app/backend/data/telangana_police_stations.json` - 713 stations across 34 districts, 11 commissionerates

## Implementation Status

### Completed (December 2025)
- [x] Dashboard with 13 module cards
- [x] Language Intelligence with OCR, Translation, TTS
- [x] FIR Draft Assistant with third-person conversion
- [x] Legal Intelligence Engine with 4-tab interface
- [x] **Investigation Documents EXPANDED to 65+ templates in 10 categories**
- [x] **Auto-linking between Investigation Documents and Case File Manager**
- [x] **Word document download support (docx library)**
- [x] Media Forensic Validator
- [x] Fraud Recovery Assistant
- [x] CDR Analyzer with dynamic columns
- [x] Smart Summons Tracker
- [x] Jurisdiction Finder with 713 stations
- [x] SENTICEL Investigation Diary
- [x] Evidence Manager
- [x] Case File Manager with Linked Documents

### Notes
- Evidence Manager and Case File Manager use localStorage (no backend APIs)
- SENTICEL Diary has client-side fallback when Google NLP unavailable
- Media Forensics uses heuristic analysis
- Investigation Documents uses client-side PDF/Word generation

## Test Credentials
- Officer ID: verify_test_001
- Password: Test123!

## Deployment
- Preview URL: https://nyaya-prahari.preview.emergentagent.com
- Backend: FastAPI on port 8001
- Frontend: React on port 3000

---
Last Updated: December 2025
