# SAAKSHYAM AI - Product Requirements Document

## Project Overview
**App Name**: SAAKSHYAM AI (formerly NYAYA PRAHARI)
**Subtitle**: Cyber Investigation Command Console
**Purpose**: Pre-CCTNS Intelligence & FIR Preparation System for police officers

## Original Problem Statement
Build a comprehensive investigation and FIR preparation tool for law enforcement officers with modules for:
- Language processing (OCR, translation, legal text conversion)
- FIR drafting with third-person conversion and error analysis
- Legal section lookup (BNS, BNSS, BSA) with case fact analysis
- Media forensic validation
- Fraud recovery assistance
- CDR analysis with dynamic column mapping
- Court summons tracking
- Jurisdiction finding with Haversine distance and Zero FIR generation
- Audio case diary with integrity hashing

## Tech Stack
- **Frontend**: React, Tailwind CSS, Framer Motion, Lucide Icons, jsPDF, Leaflet.js, react-dropzone
- **Backend**: FastAPI, Pydantic, Motor (MongoDB async), PyPDF2, python-docx
- **Database**: MongoDB
- **APIs**: 
  - Google Cloud Vision (OCR - configured with service account)
  - Google Cloud Translate (configured with language detection)
  - Google Cloud Speech-to-Text (configured)
- **Maps**: Leaflet.js with OpenStreetMap

## Core Features

### 1. Dashboard ✅
- 2x4 grid layout with 9 module cards
- Dark tactical cyber theme
- NEW badges on recently added modules
- HERO badge on Language Intelligence

### 2. Language Intelligence ✅ (UPGRADED Dec 2025)
- **Document Tab**: Supports PNG, JPG, PDF, DOCX
  - Images: Google Vision OCR
  - PDF: PyPDF2 text extraction with language detection
  - DOCX: python-docx text extraction with language detection
- **Audio Tab**: Supports MP3, WAV, M4A
  - Google Speech-to-Text API
  - 5-stage pipeline: Speech→Text→Translation→Grammar→Legal
- Three-panel output: Original Text, Translated English, Legal English
- Copy and Download functionality

### 3. FIR Draft Assistant ✅
- First-to-third person conversion
- Error analysis (mixed narrative, overuse detection)
- Remand report generation

### 4. Legal Intelligence Engine ✅ (Enhanced)
- 4-tab interface: All Laws, BNS, BNSS, BSA
- Case fact analysis with keyword detection
- 50+ sections in database with punishments
- IPC/CrPC/Evidence Act mappings
- **Auto-generated Remand Note** when offence sections detected
- Copy and PDF download for remand notes

### 5. Media Forensic Validator ✅
- Deterministic authenticity scoring
- Multi-factor analysis
- Video (MP4, MOV, AVI) and audio (WAV, MP3, M4A) support

### 6. Fraud Recovery Assistant ✅
- Evidence upload with SHA-256 hashing
- OCR extraction for transaction details
- Bank lien request letter generation
- BSA Section 63 certificate generation

### 7. CDR Analyzer ✅ (Enhanced)
- **Dynamic column detection** - accepts any Excel/CSV format
- Automatic header mapping (Phone, DateTime, Duration, Tower, etc.)
- Batch processing for 5000+ records
- Analysis: Most called numbers, common locations, date range

### 8. Smart Summons Tracker ✅
- OCR-based summons document parsing
- Status tracking (Pending, Attended, Missed, Rescheduled)
- Urgency indicators for upcoming hearings
- PDF report generation

### 9. Jurisdiction Finder ✅ (UPGRADED Dec 2025)
- Leaflet.js interactive map with **306 Telangana police stations across 40 districts**
- **Haversine formula** for accurate distance calculation
- Search by station name or district
- Click on map to find nearest station with 6 nearby stations list
- **Zero FIR Transfer Letter** PDF generator

### 10. Case Diary - Mobile Sync ✅
- Audio file upload (MP3, WAV, M4A, max 50MB)
- Client-side SHA-256 integrity hashing
- Case number, date, location, description fields
- Synced entries list with playback controls

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Officer registration
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Get profile

### Documents & OCR
- `POST /api/ocr/process` - OCR with Vision API (PNG, JPG, PDF, DOCX)
- `POST /api/translate/process` - Translation
- `POST /api/speech/process` - Speech-to-Text (MP3, WAV, M4A)

### FIR Management
- `POST /api/fir/create` - Create FIR draft
- `GET /api/fir/list` - List drafts
- `GET /api/fir/{id}` - Get draft
- `POST /api/fir/analyze-errors` - Analyze errors

### Legal Intelligence
- `POST /api/bns/analyze` - Analyze case facts (returns sections + remand note)
- `POST /api/bns/search` - Search by section number

### Jurisdiction
- `GET /api/jurisdiction/stations` - Get all 306 stations
- `POST /api/jurisdiction/find` - Find nearest station with Haversine

### CDR
- `POST /api/cdr/upload` - Upload and analyze CDR
- `GET /api/cdr/records` - Get records

### Forensic
- `POST /api/forensic/analyze` - Analyze media
- `GET /api/forensic/reports` - Get reports

### Fraud
- `POST /api/fraud/create` - Create fraud request
- `GET /api/fraud/list` - List requests
- `PUT /api/fraud/{id}/status` - Update status

### Reminders & Remand
- `POST /api/reminders/create` - Create reminder
- `GET /api/reminders/list` - List reminders
- `POST /api/remand/create` - Create remand report
- `GET /api/remand/list` - List reports

## Database Schema
- `officers`: {officer_id, name, email, password_hash, department, rank, district}
- `fir_drafts`: {officer_id, complaint_text, fir_draft}
- `documents`: {officer_id, document_type, original_text, translated_text, legal_text}
- `forensic_reports`: {officer_id, file_name, probability_score, analysis_details}
- `fraud_requests`: {officer_id, victim_name, transaction_id, amount, bank_name}
- `cdr_records`: {officer_id, case_id, phone_number, called_number, datetime_str, tower_id}
- `remand_reports`: {officer_id, fir_id, accused_name, charges, report_text}

## Test Credentials
- Officer ID: OFF12345
- Password: test123

## Deployment
- Preview URL: https://nyaya-prahari.preview.emergentagent.com
- Backend: FastAPI on port 8001
- Frontend: React on port 3000

## Google Cloud Configuration
Credential files stored at:
- `/app/backend/credentials/google-vision.json`
- `/app/backend/credentials/google-translate.json`
- `/app/backend/credentials/google-speech.json`
- `/app/backend/credentials/google-nlp.json`

## Data Files
- `/app/backend/data/telangana_police_stations.json` - 306 stations across 40 districts

---
Last Updated: December 2025
