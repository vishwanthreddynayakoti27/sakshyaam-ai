# SAAKSHYAM AI - Unified Intelligence Pipeline

## Overview
SAAKSHYAM AI is a comprehensive police investigation command console that automates investigation workflows through a unified data-sharing ecosystem.

## Original Problem Statement
Transform the existing SAAKSHYAM AI application from a collection of siloed tools into a **Unified Intelligence Pipeline** - a seamless data-sharing ecosystem that automates police investigation workflows from petition analysis to CCTNS data entry.

## Core Architecture: Unified Intelligence Pipeline

### 1. Global Case Context
The central data model that shares information across all tools:
- Case identification (FIR Number, Crime Number)
- Complainant details
- Accused persons (A1, A2, etc.)
- Witnesses (LW-1, LW-2, etc.)
- Evidence items with SHA-256 hashes
- Legal sections (BNS/BNSS/BSA)
- Case diary entries

### 2. Single-Source Entry (Unified Pipeline Page)
- Multi-modal input: Text, File upload (PDF/JPG), Voice
- Legal LLM (GPT-5.2) for translation preserving police legalese
- Auto-extracts entities: Name, Phone, Vehicle, BNS Sections
- Populates Global Case Context automatically
- 4-step workflow: Input Petition → AI Processing → Review & Edit → Case Context

### 3. Document Generator
Auto-generates legal documents from Case Context:
- **Charge Sheet** (Sec 193 BNSS) - Brief Facts, Witness Table, Accused Details
- **Case Diary** (Sec 172 BNSS) - Chronological investigation entries
- **Remand Report** - For requesting judicial custody
- **BSA Section 63 Certificate** - Digital evidence authentication

### 4. Evidence & Hash Manager
- Upload digital evidence (video/photo/documents)
- Instant SHA-256 hash computation
- Hash verification for integrity checking
- Auto-links to Case Context with FIR Number
- BSA Sec 63 certificate generation

### 5. CCTV Attribute Search (Beta)
- Upload CCTV footage
- Search by attributes (Vehicle Type, Color, Model, Person Clothing)
- AI scans video for timestamped matches
- Attach screenshots to case evidence
- *Note: AI video analysis is mocked in beta*

### 6. CCTNS Extension Bridge
- Consolidates all case data into CCTNS-compatible JSON
- Backend endpoint: `/api/case-context/{id}/export-cctns`
- Designed for browser extension auto-fill
- Maps to official CCTNS portal form fields

## Tech Stack
- **Frontend:** React, Tailwind CSS, Framer Motion, Shadcn/UI
- **Backend:** FastAPI, Pydantic, Motor (MongoDB)
- **LLM Integration:** GPT-5.2 via Emergent Integrations
- **Database:** MongoDB

## API Endpoints (New)

### Case Context
- `POST /api/case-context/create` - Create new case context
- `GET /api/case-context/list` - List all case contexts
- `GET /api/case-context/{id}` - Get specific context
- `PUT /api/case-context/{id}` - Update context
- `POST /api/case-context/{id}/process-petition` - Process petition with AI
- `POST /api/case-context/{id}/add-accused` - Add accused person
- `POST /api/case-context/{id}/add-witness` - Add witness
- `POST /api/case-context/{id}/add-evidence` - Add evidence
- `POST /api/case-context/{id}/suggest-sections` - Get BNS section suggestions
- `GET /api/case-context/{id}/export-cctns` - Export CCTNS JSON

### Document Generator
- `POST /api/documents/{id}/charge-sheet` - Generate Charge Sheet
- `POST /api/documents/{id}/case-diary` - Generate Case Diary
- `POST /api/documents/{id}/remand-report` - Generate Remand Report
- `POST /api/documents/{id}/bsa-63-certificate` - Generate BSA 63 Certificate

### Evidence Manager
- `POST /api/evidence/upload` - Upload evidence with auto-hashing
- `POST /api/evidence/compute-hash` - Compute hash only (no storage)
- `GET /api/evidence/{context_id}/list` - List evidence items
- `POST /api/evidence/{id}/verify-hash` - Verify file integrity

## Completed Features (Phase 1)

### December 2025
- [x] Unified Pipeline page with 4-step workflow
- [x] Document Generator with 4 document types
- [x] Evidence & Hash Manager with SHA-256
- [x] CCTV Search UI (beta - mocked)
- [x] CCTNS Bridge with JSON export
- [x] Global Case Context data model
- [x] Backend routers: case_context, document_generator, evidence_manager
- [x] GPT-5.2 integration for Legal LLM
- [x] Dashboard updated with NEW badges
- [x] Deprecated modules removed (SENTICEL Diary, Case File Manager, Media Forensic)

## Existing Features (Pre-Pipeline)
- [x] Authentication with JWT and auto-refresh
- [x] Language Intelligence (Translation)
- [x] FIR Draft Assistant
- [x] Legal Intelligence (BNS Search)
- [x] Investigation Documents (65+ templates)
- [x] CDR Analyzer (Search by Number/Name)
- [x] Fraud Recovery
- [x] Smart Summons
- [x] Jurisdiction Finder (713 stations)

## Backlog / Future Tasks

### P0 - High Priority
- [ ] Full AI video analysis for CCTV Search (currently mocked)
- [ ] OSINT Integration (SurePass/OSINT Industries) for deep search on phone numbers
- [ ] Voice input processing in Unified Pipeline

### P1 - Medium Priority
- [ ] Template management for custom document formats
- [ ] Batch processing for multiple petitions
- [ ] Case linking between related FIRs

### P2 - Low Priority
- [ ] Browser extension for CCTNS auto-fill (frontend)
- [ ] Analytics dashboard for case statistics
- [ ] Officer performance tracking

## Test Credentials
- Officer ID: `TEST123`
- Password: `test123`

## File Structure
```
/app/
├── backend/
│   ├── models/
│   │   └── case_context.py    # Global Case Context model
│   ├── routers/
│   │   ├── case_context.py    # Case Context API
│   │   ├── document_generator.py  # Document generation API
│   │   └── evidence_manager.py    # Evidence management API
│   ├── services/
│   │   ├── legal_llm.py       # GPT-5.2 integration
│   │   └── document_generator.py  # Document templates
│   └── server.py              # Main FastAPI app
└── frontend/
    └── src/
        └── pages/
            ├── UnifiedPipeline.js    # Main pipeline entry
            ├── DocumentGenerator.js  # Document generation
            ├── EvidenceHash.js       # Evidence management
            ├── CCTVSearch.js         # CCTV analysis (beta)
            └── CCTNSBridge.js        # CCTNS export
```
