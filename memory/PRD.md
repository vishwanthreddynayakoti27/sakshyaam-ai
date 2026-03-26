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
| **CCTNS Bridge** | JSON export for browser extension, consolidates all case data | COMPLETE |
| **Language Intelligence** | Translation, OCR, Speech-to-Text | COMPLETE |
| **Legal Intelligence** | BNS/BNSS/BSA section search and analysis | COMPLETE |
| **Investigation Docs** | 65+ document templates | COMPLETE |
| **Fraud Recovery** | Bank freeze requests, nodal officer contact | COMPLETE |
| **Smart Summons** | Summons generation with reminders | COMPLETE |
| **Jurisdiction Finder** | GPS-based police station locator (713 stations) | COMPLETE |

### WING 2: SAAKSHYAM LAB (Advanced Forensic Lab)

| Module | Description | Status |
|--------|-------------|--------|
| **CDR Analyzer** | Telecom records deep-parsing | COMPLETE |
| **Media Forensic** | Deepfake/AI detection with [REAL]/[AI_GENERATED]/[DEEP_FAKE] verdicts + confidence % | COMPLETE |
| **CCTV Search** | AI-powered attribute search (beta - mocked) | BETA |
| **e-Sakshya & Hash** | SHA-256 hash generation, BSA Sec 63 certificates | COMPLETE |

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

### Evidence Manager
- `POST /api/evidence/upload` - Upload evidence with auto-hashing
- `POST /api/evidence/compute-hash` - Compute hash only

## Completed Features (December 2025)

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
- [x] **OCR support for Telugu Petition images (Google Vision + Translation)**
- [x] Active Blanks for missing mandatory fields
- [x] Media Forensic with new verdict format ([REAL]/[AI_GENERATED]/[DEEP_FAKE] + %)
- [x] Image file support for Media Forensic (JPG, PNG, GIF, WebP)
- [x] User name/designation removed from top bar
- [x] Navigation updated for dual-wing modules
- [x] **Deprecated modules removed (SenticelDiary, CaseFileManager, FIRDraftAssistant)**

### Session 3 (Voice Input & UI Refinements)
- [x] **Voice recording for Charge Sheet Fusion** (Telugu/Hindi/English transcription + legal conversion)
- [x] **Dashboard UI update**: WING 2 moved to right side
- [x] **Active Investigations section removed from dashboard**
- [x] **User name/designation replaced with "SAAKSHYAM AI Command Center"**
- [x] **CCTV Search video fixes**: Added video thumbnail preview, main video player, and working "Jump to" timestamp feature

### Session 4 (18-Column Fixed Template System)
- [x] **18-Column Charge Sheet Template** matching Makthal PS format (Columns 01-18)
- [x] **8-Point Case Diary (Part-I)** with all rows always present for manual entry
- [x] **Blank Integrity**: Missing fields shown as `[ ]` placeholder instead of errors
- [x] **ML-Driven Section Suggestion**: Auto-populates BNS sections based on brief facts
- [x] **Dynamic Row Expansion**: Accused (A1-An) and Witnesses (LW1-LWn) rows expand dynamically
- [x] **HTML Table Export** for print-ready charge sheets

## Removed Modules
- SENTICEL Investigation Diary
- Case File Manager
- FIR Draft (legacy)

## Backlog / Future Tasks

### P0 - High Priority
- [ ] Voice input processing in Charge Sheet Fusion
- [ ] Full AI video analysis for CCTV Search (currently mocked)
- [ ] OSINT Integration for phone number deep search

### P1 - Medium Priority
- [ ] Template management for custom document formats
- [ ] Batch processing for multiple petitions
- [ ] Case linking between related FIRs

### P2 - Low Priority
- [ ] Browser extension for CCTNS auto-fill
- [ ] Analytics dashboard for case statistics
- [ ] Officer performance tracking

## Test Credentials
- Officer ID: `TEST123`
- Password: `test123`

## Mocked APIs
- CCTV Search AI analysis (returns mock results)
- Media Forensic analysis (uses heuristic scoring, not actual AI deepfake detection)

## File Structure
```
/app/
├── backend/
│   ├── models/
│   │   └── case_context.py
│   ├── routers/
│   │   ├── case_context.py
│   │   ├── charge_sheet_fusion.py  # NEW - Multi-upload processing
│   │   ├── document_generator.py
│   │   └── evidence_manager.py
│   ├── services/
│   │   ├── legal_llm.py
│   │   └── document_generator.py
│   └── server.py
└── frontend/
    └── src/
        ├── components/
        │   └── Layout.js           # Dual-wing sidebar
        └── pages/
            ├── Dashboard.js        # Dual-wing dashboard
            ├── ChargeSheetFusion.js # WING 1 core module
            ├── MediaForensic.js    # WING 2 - Updated verdict format
            └── (Other modules)
```
