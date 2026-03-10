# SAAKSHYAM COMMAND - Product Requirements Document

## Project Overview
**App Name**: SAAKSHYAM AI - COMMAND CONSOLE
**Subtitle**: Cyber Investigation Command Center - Pre-CCTNS Intelligence & FIR Preparation System
**Purpose**: Comprehensive investigation and FIR preparation tool for law enforcement officers

## Tech Stack
- **Frontend**: React 18, Tailwind CSS, Framer Motion, Lucide Icons, jsPDF, Leaflet.js, react-dropzone
- **Backend**: FastAPI, Pydantic, Motor (MongoDB async), PyPDF2, python-docx
- **Database**: MongoDB
- **APIs**: Google Cloud Vision, Translate, Speech-to-Text, Natural Language Processing
- **Maps**: Leaflet.js with OpenStreetMap

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

### 5. Investigation Documents (NEW)
- 10 document templates:
  1. Petition Report
  2. CSR Entry
  3. Witness Statement (161 CrPC / BNSS)
  4. Arrest Memo (Section 50 BNSS)
  5. Seizure Panchanama (Section 105 BNSS)
  6. Bank Information Request (Section 94 BNSS)
  7. CDR Request Letter
  8. CCTV Footage Request
  9. Charge Sheet Draft (Section 193 BNSS)
  10. Case Status Report
- Form filling with auto-population
- PDF download, Copy, Print functionality

### 6. Media Forensic Validator
- Deterministic authenticity scoring
- Multi-factor analysis for video (MP4, MOV, AVI) and audio (WAV, MP3, M4A)

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

### 11. SENTICEL Investigation Diary (NEW)
- Social Pulse Integration & Volatility Alert System
- Sentiment analysis via Google Cloud NLP (with client-side fallback)
- Dual gauges: Legal Strength & Social Temperature
- Volatility Alerts (Protest Activity, Rumor Spreading, Crowd Formation, etc.)
- Keyword Spikes tracking
- Risk Level assessment (Safe, Moderate, Volatile)

### 12. Evidence Manager (NEW)
- File upload with drag-drop (Images, Video, Audio, PDF, Documents)
- SHA-256 hash generation via browser crypto.subtle.digest
- Evidence integrity verification
- Search and filter functionality
- Evidence Library with case linkage
- localStorage persistence

### 13. Case File Manager (NEW)
- Case file creation with all details
- Status tracking (Under Investigation, Charge Sheet Filed, Trial Ongoing, Closed, Final Report)
- Evidence linking from Evidence Manager
- Comprehensive PDF export
- localStorage persistence

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Officer registration
- `POST /api/auth/login` - Login (officer_id, password)
- `GET /api/auth/profile` - Get profile

### Documents & OCR
- `POST /api/ocr/process` - OCR with Vision API
- `POST /api/translate/process` - Translation
- `POST /api/speech/process` - Speech-to-Text

### FIR Management
- `POST /api/fir/create` - Create FIR draft
- `GET /api/fir/list` - List drafts
- `POST /api/fir/analyze-errors` - Analyze errors

### Legal Intelligence
- `POST /api/bns/analyze` - Analyze case facts
- `POST /api/bns/search` - Search by section number
- `POST /bns/peer-review` - Peer review analysis

### Jurisdiction
- `GET /api/jurisdiction/stations` - Get all 713 stations
- `POST /api/jurisdiction/find` - Find nearest station

### SENTICEL
- `POST /api/senticel/analyze` - Sentiment analysis

### CDR
- `POST /api/cdr/upload` - Upload and analyze CDR
- `GET /api/cdr/records` - Get records

### Forensic
- `POST /api/forensic/analyze` - Analyze media
- `GET /api/forensic/reports` - Get reports

### Fraud
- `POST /api/fraud/create` - Create fraud request
- `GET /api/fraud/list` - List requests

## Database Schema
- `officers`: {officer_id, name, email, password_hash, department, rank, district}
- `fir_drafts`: {officer_id, complaint_text, fir_draft}
- `documents`: {officer_id, document_type, original_text, translated_text, legal_text}
- `forensic_reports`: {officer_id, file_name, probability_score, analysis_details}
- `fraud_requests`: {officer_id, victim_name, transaction_id, amount, bank_name}
- `cdr_records`: {officer_id, case_id, phone_number, called_number, datetime_str, tower_id}
- `remand_reports`: {officer_id, fir_id, accused_name, charges, report_text}

## Test Credentials
- Officer ID: verify_test_001
- Password: Test123!

## Deployment
- Preview URL: https://nyaya-prahari.preview.emergentagent.com
- Backend: FastAPI on port 8001
- Frontend: React on port 3000

## Data Files
- `/app/backend/data/telangana_police_stations.json` - 713 stations across 34 districts, 11 commissionerates

## Implementation Status

### Completed (December 2025)
- [x] Dashboard with 13 module cards
- [x] Language Intelligence with OCR, Translation, TTS
- [x] FIR Draft Assistant with third-person conversion
- [x] Legal Intelligence Engine with 4-tab interface
- [x] Investigation Documents with 10 templates
- [x] Media Forensic Validator
- [x] Fraud Recovery Assistant
- [x] CDR Analyzer with dynamic columns
- [x] Smart Summons Tracker
- [x] Jurisdiction Finder with 713 stations
- [x] SENTICEL Investigation Diary
- [x] Evidence Manager
- [x] Case File Manager

### Notes
- Evidence Manager and Case File Manager use localStorage (no backend APIs)
- SENTICEL Diary has client-side fallback when Google NLP unavailable
- Media Forensics uses heuristic analysis

---
Last Updated: December 2025
