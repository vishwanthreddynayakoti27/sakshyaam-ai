# SAAKSHYAM AI - Product Requirements Document

## Project Overview
**App Name**: SAAKSHYAM AI (formerly NYAYA PRAHARI)
**Subtitle**: Cyber Investigation Command Console
**Purpose**: Pre-CCTNS Intelligence & FIR Preparation System for police officers

## Original Problem Statement
Build a comprehensive investigation and FIR preparation tool for law enforcement officers with modules for:
- Language processing (OCR, translation, legal text conversion)
- FIR drafting with third-person conversion and error analysis
- Legal section lookup (BNS, BNSS, BSA)
- Media forensic validation
- Fraud recovery assistance
- Court summons tracking
- Jurisdiction finding with Zero FIR generation
- Audio case diary with integrity hashing

## Tech Stack
- **Frontend**: React, Tailwind CSS, Framer Motion, Lucide Icons, jsPDF
- **Backend**: FastAPI, Pydantic, Motor (MongoDB async)
- **Database**: MongoDB
- **Integrations**: Google Cloud Vision (OCR), Google Translate API (pending), Google Speech-to-Text API (pending), Google NLP API (pending)
- **Maps**: Leaflet.js with OpenStreetMap

## Core Features

### 1. Dashboard (Completed)
- 2x4 grid layout with 9 module cards
- Dark tactical cyber theme
- NEW badges on recently added modules
- HERO badge on Language Intelligence

### 2. Language Intelligence (Completed - Phase 1)
- OCR document processing via Google Vision API
- Audio upload interface (Speech-to-Text pending integration)
- 5-stage processing pipeline: Speech→Text→Translation→Grammar→Legal

### 3. FIR Draft Assistant (Completed)
- First-to-third person conversion
- Error analysis (mixed narrative detection, overuse detection)
- Remand report generation

### 4. Legal Intelligence Engine (Completed)
- 3-tab interface: BNS, BNSS, BSA
- Keyword-based section analysis
- Old law equivalents (IPC→BNS, CrPC→BNSS, Evidence Act→BSA)
- Direct section lookup by number

### 5. Media Forensic Validator (Completed)
- Deterministic authenticity scoring
- Multi-factor analysis (metadata, hash, compression, etc.)
- Support for video (MP4, MOV, AVI) and audio (WAV, MP3, M4A)

### 6. Fraud Recovery Assistant (Completed)
- Evidence upload with client-side SHA-256 hashing
- OCR extraction for transaction details
- Bank lien request letter generation
- BSA Section 63 certificate generation

### 7. CDR Analyzer (Placeholder)
- CDR file upload interface
- Visualization pending

### 8. Smart Summons Tracker (NEW - Completed)
- OCR-based summons document parsing
- Form with case number, court, hearing date/time
- Status tracking (Pending, Attended, Missed, Rescheduled)
- Urgency indicators for upcoming hearings
- PDF report generation

### 9. Jurisdiction Finder (NEW - Completed)
- Leaflet.js interactive map (Hyderabad area)
- 5 sample police stations with jurisdiction areas
- Pin drop to find nearest station
- Search by location name
- Zero FIR application PDF generator

### 10. Case Diary - Mobile Sync (NEW - Completed)
- Audio file upload (MP3, WAV, M4A, max 50MB)
- Client-side SHA-256 integrity hashing
- Case number, date, location, description fields
- Synced entries list with playback controls

## Authentication
- JWT-based authentication
- Officer registration with ID, name, department, rank, district
- Protected routes for all modules

## Database Schema
- `officers`: {officer_id, name, email, password_hash, department, rank, district, subscription_plan}
- `fir_drafts`: {officer_id, complaint_text, fir_draft, created_at}
- `documents`: {officer_id, document_type, original_text, translated_text, legal_text}
- `forensic_reports`: {officer_id, file_name, probability_score, analysis_details}
- `fraud_requests`: {officer_id, victim_name, transaction_id, amount, bank_name, status}
- `remand_reports`: {officer_id, fir_id, accused_name, charges, remand_type}

## API Endpoints
- `/api/auth/signup`, `/api/auth/login`, `/api/auth/profile`
- `/api/ocr/process` - Document OCR
- `/api/fir/create`, `/api/fir/list`, `/api/fir/{id}`
- `/api/fir/analyze-errors`
- `/api/bns/analyze`, `/api/bns/search`
- `/api/forensic/analyze`, `/api/forensic/reports`
- `/api/fraud/create`, `/api/fraud/list`, `/api/fraud/{id}`
- `/api/remand/create`, `/api/remand/list`

## Pending/Future Tasks

### Phase 2: API Integration (P1)
- [ ] Integrate Google Translation API for real-time translation
- [ ] Integrate Google Speech-to-Text API for audio transcription
- [ ] Integrate Google NLP API for auto-summary and entity extraction
- [ ] Add TTS (Text-to-Speech) verification for FIR drafts

### Phase 3: Backend Enhancements (P2)
- [ ] Create backend endpoints for summons CRUD operations
- [ ] Create backend endpoints for case diary entries
- [ ] Implement jurisdiction lookup API

### Future Enhancements
- [ ] CDR visualization with charts and timelines
- [ ] Multi-officer collaboration
- [ ] Push notifications for summons reminders
- [ ] Advanced NLP case correlation
- [ ] Export features for all modules

## Test Credentials
- Officer ID: TEST002
- Password: test1234

## Deployment
- Preview URL: https://nyaya-prahari.preview.emergentagent.com
- Backend: FastAPI on port 8001
- Frontend: React on port 3000

---
Last Updated: December 2025
