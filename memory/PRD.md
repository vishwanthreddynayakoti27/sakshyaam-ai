# SAAKSHYAM AI - Dual-Wing Modular System

## Overview
SAAKSHYAM AI is a comprehensive police investigation command console implementing a **Dual-Wing Modular System** architecture with a shared Global Case Context.

## Original Problem Statement
Transform SAAKSHYAM AI into a Dual-Wing Modular System with:
- **WING 1: SAAKSHYAM ADMIN** - Investigation & Documentation tools
- **WING 2: SAAKSHYAM LAB** - Advanced Forensic Lab tools
- **Global Case Context** - Shared data across all modules

## Architecture: Dual-Wing Modular System

### WING 1: SAAKSHYAM ADMIN (Investigation & Documentation)

| Module | Description | Status |
|--------|-------------|--------|
| **Charge Sheet Fusion** | Multi-upload (Telugu Petition, CDF, Case Diary), **18-Column Fixed Template** with 95% accuracy extraction, **Active Blanks** for missing fields, **ML-driven BNS section suggestion**, editable charge sheet + Case Diary Part-I generation | COMPLETE |
| **Document Generator** | Auto-generates Charge Sheet, Case Diary, Remand Report, BSA 63 Certificate | COMPLETE |
| **Remand Report Module** | Dedicated 1:1 replica focusing on Grounds of Arrest and Prayer sections | COMPLETE |
| **CDF Interactive Filler** | Bilingual (Telugu/English) input form mirroring official CDF with print support | COMPLETE |
| **Smart Summons** | Summons generation with **WhatsApp auto-scheduling** (1 day before, 09:00 AM) | COMPLETE |
| **CCTNS Bridge** | JSON export for browser extension, consolidates all case data | COMPLETE |
| **Language Intelligence** | Translation, OCR, Speech-to-Text | COMPLETE |
| **Legal Intelligence** | BNS/BNSS/BSA section search and analysis | COMPLETE |
| **Investigation Docs** | 65+ document templates | COMPLETE |
| **Fraud Recovery** | Bank freeze requests, nodal officer contact | COMPLETE |
| **Jurisdiction Finder** | GPS-based police station locator (713 stations) | COMPLETE |

### WING 2: SAAKSHYAM LAB (Advanced Forensic Lab)

| Module | Description | Status |
|--------|-------------|--------|
| **CDR Analyzer** | Telecom records deep-parsing | COMPLETE |
| **Media Forensic** | Deepfake/AI detection with [REAL]/[AI_GENERATED]/[DEEP_FAKE] verdicts + confidence % | COMPLETE |
| **CCTV Search** | AI-powered attribute search with millisecond temporal sync | COMPLETE |
| **e-Sakshya & Hash** | **SHA-256 + MD5 hash generation**, **BSA Section 63 Certificate** for court admissibility | COMPLETE |

### Global Case Context
Central data model sharing information across all tools:
- Case identification (FIR Number, Crime Number)
- Complainant details
- Accused persons (A1, A2, etc.)
- Witnesses (LW-1, LW-2, etc.)
- Evidence items with SHA-256 hashes
- Legal sections (BNS/BNSS/BSA)
- Case diary entries

## Tech Stack
- **Frontend:** React, Tailwind CSS, Framer Motion, Shadcn/UI
- **Backend:** FastAPI, Pydantic, Motor (MongoDB)
- **LLM Integration:** GPT-5.2 via Emergent Integrations
- **Database:** MongoDB
- **Document Processing:** python-docx, antiword, PyPDF2, Pillow

## Key API Endpoints

### Charge Sheet Fusion
- `POST /api/charge-sheet-fusion/process` - Multi-document processing with text extraction

### Media Forensic
- `POST /api/forensic/analyze` - Returns verdict (REAL/AI_GENERATED/DEEP_FAKE) + confidence %

### Case Context
- `POST /api/case-context/create` - Create new case context
- `GET /api/case-context/list` - List all case contexts
- `GET /api/case-context/{id}/export-cctns` - Export CCTNS JSON

### Evidence Manager (NEW - Session 6)
- `POST /api/evidence/generate-certificate` - Generate BSA Section 63 Digital Certificate
- `POST /api/evidence/compute-hash-only` - Quick SHA-256 + MD5 hash computation
- `GET /api/evidence/certificates` - List generated certificates
- `POST /api/evidence/upload` - Upload evidence with auto-hashing

### Smart Summons Scheduler (NEW - Session 6)
- `POST /api/summons/schedule` - Schedule WhatsApp notifications
- `GET /api/summons/scheduled` - List scheduled summons
- `DELETE /api/summons/{id}/cancel` - Cancel scheduled notification

## Completed Features (December 2025 - March 2026)

### Session 1 (Unified Intelligence Pipeline)
- [x] Global Case Context data model
- [x] Unified Pipeline page with 4-step workflow
- [x] Document Generator with 4 document types
- [x] Evidence & Hash Manager with SHA-256
- [x] CCTNS Bridge with JSON export
- [x] GPT-5.2 integration for Legal LLM

### Session 2 (Dual-Wing System Pivot)
- [x] Dual-Wing UI architecture (Layout.js, Dashboard.js)
- [x] Charge Sheet Fusion with multi-upload support
- [x] Document text extraction (DOCX, DOC, PDF)
- [x] OCR support for Telugu Petition images (Google Vision + Translation)
- [x] Active Blanks for missing mandatory fields
- [x] Media Forensic with new verdict format ([REAL]/[AI_GENERATED]/[DEEP_FAKE] + %)
- [x] Image file support for Media Forensic (JPG, PNG, GIF, WebP)
- [x] Deprecated modules removed (SenticelDiary, CaseFileManager, FIRDraftAssistant)

### Session 3 (Voice Input & UI Refinements)
- [x] Voice recording for Charge Sheet Fusion (Telugu/Hindi/English transcription + legal conversion)
- [x] Dashboard UI update: WING 2 moved to right side
- [x] Active Investigations section removed from dashboard
- [x] User name/designation replaced with "SAAKSHYAM AI Command Center"
- [x] CCTV Search video fixes: Added video thumbnail preview, main video player, and working "Jump to" timestamp feature

### Session 4 (18-Column Fixed Template System)
- [x] 18-Column Charge Sheet Template matching Makthal PS format (Columns 01-18)
- [x] 8-Point Case Diary (Part-I) with all rows always present for manual entry
- [x] Blank Integrity: Missing fields shown as `[ ]` placeholder instead of errors
- [x] ML-Driven Section Suggestion: Auto-populates BNS sections based on brief facts
- [x] Dynamic Row Expansion: Accused (A1-An) and Witnesses (LW1-LWn) rows expand dynamically
- [x] HTML Table Export for print-ready charge sheets
- [x] GD Linkage: Added GD Entry No. and GD Entry Time fields
- [x] Investigation Timeline: Added "Resumed at" and "Closed for the day at" timestamps
- [x] Investigation Narrative: Auto-generates "On this day I resumed further investigation..." text
- [x] Witness Examination: Auto-generates 180 BNSS statement recording notes
- [x] APP Consultation & CDF Verification notes included
- [x] Tabbed Document View: Switch between Charge Sheet (18-Col) and Case Diary Part-I

### Session 5 (Structural Patches - Grid-Cell, CDF, CCTV)
- [x] PATCH 1: Grid-Cell Mandate - All documents use HTML tables with border="1"
- [x] PATCH 2: Remand CD Generator - Auto-triggered when arrest detected, includes Grounds of Arrest and Prayer
- [x] PATCH 3: Bilingual CDF Overlay - Digital CDF form with Telugu/English toggle
- [x] PATCH 4: CDF Auto-Sync - CDF data syncs to Charge Sheet Columns 13 (Witnesses) & 16 (Modus Operandi)
- [x] PATCH 5: CCTV Temporal Sync - Millisecond-precise timestamp indexing (HH:MM:SS.mmm)
- [x] PATCH 6: Auto-Seek Video Player - Click result → player.seek(timestamp_ms) with auto-play
- [x] PATCH 7: CCTV API Endpoints - /api/cctv/analyze and /api/cctv/extract-frame
- [x] PATCH 8: OCR Lock for Number Plates - 95% confidence threshold for plate detection

### Session 6 (Production Updates - March 2026)
- [x] **BSA Section 63 Hash Certificate Generator** - Court-admissible digital evidence certificates
  - SHA-256 and MD5 hash computation
  - Full certificate in text and HTML formats
  - Case reference fields (FIR, Police Station, Seized From, Date)
  - Print and download functionality
- [x] **Smart Summons WhatsApp Scheduler Backend**
  - Background task scheduling with asyncio
  - Notifications scheduled 1 day before hearing at 09:00 AM
  - Validates future dates, rejects past dates
  - Stores scheduled summons in MongoDB
  - WhatsApp API ready (requires Business API credentials)
- [x] **CCTV Search Beta Tag Removed** - Transitioned to production state
- [x] **Evidence Hash UI Enhanced** - Added BSA Certificate generation form

## Removed Modules
- SENTICEL Investigation Diary
- Case File Manager
- FIR Draft (legacy)

## Backlog / Future Tasks

### P0 - High Priority
- [ ] WhatsApp Business API integration for actual notification sending
- [ ] CDF Coordinate Overlay for exact print alignment on official forms

### P1 - Medium Priority
- [ ] IMEI Identity Linkage and Location Mapping in CDR Analyzer
- [ ] Word XML Replica Export (embedding Rough Sketch and CDF into .docx)
- [ ] Full AI video analysis for CCTV Search (currently uses demo results)
- [ ] OSINT Integration for phone number deep search

### P2 - Low Priority
- [ ] Browser extension for CCTNS auto-fill
- [ ] Analytics dashboard for case statistics
- [ ] Case Timeline visualization
- [ ] Real deepfake detection model integration

## Test Credentials
- Officer ID: `TEST123`
- Password: `test123`

## Mocked APIs
- WhatsApp notification sending (logs to console, needs Business API credentials)
- CCTV Search AI analysis (returns mock results)
- Media Forensic analysis (uses heuristic scoring, not actual AI deepfake detection model)

## File Structure
```
/app/
├── backend/
│   ├── models/
│   │   └── case_context.py
│   ├── routers/
│   │   ├── case_context.py
│   │   ├── charge_sheet_fusion.py
│   │   ├── document_generator.py
│   │   └── evidence_manager.py
│   ├── services/
│   │   ├── legal_llm.py
│   │   ├── template_generator.py    # 18-col CS & CD part-I
│   │   ├── remand_generator.py      # Remand CD
│   │   ├── cdf_overlay.py           # Bilingual CDF
│   │   ├── hash_certificate.py      # BSA Section 63 certificates
│   │   └── summons_scheduler.py     # WhatsApp scheduling
│   └── server.py
└── frontend/
    └── src/
        ├── components/
        │   └── Layout.js            # Dual-wing sidebar
        └── pages/
            ├── Dashboard.js         # Dual-wing dashboard
            ├── ChargeSheetFusion.js # WING 1 core module
            ├── RemandReport.js      # Remand CD UI
            ├── CDFFiller.js         # Bilingual CDF
            ├── SmartSummons.js      # WhatsApp scheduler UI
            ├── MediaForensic.js     # WING 2 - Verdict format
            ├── CCTVSearch.js        # WING 2 - Temporal sync
            └── EvidenceHash.js      # WING 2 - BSA certificates
```

## Test Reports
- Iteration 10: All tests passed (BSA certificates, Summons scheduler, CCTV Beta removal)
- Location: `/app/test_reports/iteration_10.json`
