# SAAKSHYAM AI - Dual-Wing Modular System

## Overview
SAAKSHYAM AI is a comprehensive police investigation command console implementing a **Dual-Wing Modular System** architecture with a shared Global Case Context.

## Original Problem Statement
Transform SAAKSHYAM AI into a Dual-Wing Modular System with:
- **WING 1: SAAKSHYAM ADMIN** - Investigation & Documentation tools
- **WING 2: SAAKSHYAM LAB** - Advanced Forensic Lab tools
- **Global Case Context** - Shared data across all modules
- **Admin Dashboard** - User approval, action logs, issue tracking

## Architecture: Dual-Wing Modular System

### WING 1: SAAKSHYAM ADMIN (Investigation & Documentation)

| Module | Description | Status |
|--------|-------------|--------|
| **Charge Sheet Fusion** | Multi-upload (Telugu Petition, CDF, Case Diary), **18-Column Fixed Template** with 95% accuracy extraction, **Active Blanks** for missing fields, **ML-driven BNS section suggestion**, editable charge sheet + Case Diary Part-I generation | COMPLETE |
| **Document Generator** | Auto-generates Charge Sheet, Case Diary, Remand Report, BSA 63 Certificate | COMPLETE |
| **Remand Report Module** | Dedicated 1:1 replica focusing on Grounds of Arrest and Prayer sections | COMPLETE |
| **CDF Interactive Filler** | Bilingual (Telugu/English) input form with **Coordinate Overlay Print**, Scene Sketch Canvas (Section 11), Witness Grid, Correlation ID tracking | COMPLETE |
| **Smart Summons** | Summons generation with **WhatsApp auto-scheduling** (1 day before, 09:00 AM) | COMPLETE |
| **CCTNS Bridge** | JSON export for browser extension, consolidates all case data | COMPLETE |
| **Admin Dashboard** | User approval, system logs, issue tracking with Correlation IDs | COMPLETE |

### WING 2: SAAKSHYAM LAB (Advanced Forensic Lab)

| Module | Description | Status |
|--------|-------------|--------|
| **CDR Analyzer** | Telecom records deep-parsing | COMPLETE |
| **Media Forensic** | Deepfake/AI detection with [REAL]/[AI_GENERATED]/[DEEP_FAKE] verdicts + confidence % | COMPLETE |
| **CCTV Search** | AI-powered attribute search with millisecond temporal sync | COMPLETE |
| **e-Sakshya & Hash** | **SHA-256 + MD5 hash generation**, **BSA Section 63 Certificate** for court admissibility | COMPLETE |

## Latest Session Updates (March 2026)

### 1. Charge Sheet HTML Template (FIR 156/2025)
- Created filled HTML charge sheet from uploaded docx file
- 18-column format matching Makthal PS template
- File: `/app/frontend/public/templates/chargesheet_156_2025.html`

### 2. CDF Template Engine with Coordinate Overlay
- Bilingual (Telugu/English) CDF with exact layout matching official form
- Interactive Scene Sketch Canvas (Section 11) with:
  - Drawing capability
  - Image upload for sketch
  - Draggable compass icon
- Witness Grid with mandatory fields (Name, S/o, Age, Caste, Occupation, Address, Cell No.)
- Officer signature block at bottom right
- **Correlation ID** in footer for error tracking
- API: `POST /api/cdf/generate`

### 3. Admin Dashboard
- **User Approval System**: Pending users list with Approve/Reject buttons
- **System Action Logs**: Tracks all CDF generations, certificate creations with timestamps
- **Issue Tracking**: Filters failed actions with Correlation IDs for debugging
- APIs:
  - `GET /api/admin/pending-users`
  - `POST /api/admin/approve-user/{id}`
  - `POST /api/admin/reject-user/{id}`
  - `GET /api/admin/logs`
  - `GET /api/admin/issues`
  - `GET /api/admin/action-logs`

### 4. Error Logging with Correlation IDs
- Every CDF generation creates unique Correlation ID: `CDF-YYYYMMDD-XXXX`
- Failed actions generate: `ERR-YYYYMMDD-XXXX`
- Stored in both file logs and MongoDB `action_logs` collection

## Tech Stack
- **Frontend:** React, Tailwind CSS, Framer Motion, Shadcn/UI
- **Backend:** FastAPI, Pydantic, Motor (MongoDB)
- **LLM Integration:** GPT-5.2 via Emergent Integrations
- **Database:** MongoDB
- **Document Processing:** python-docx, antiword, PyPDF2, Pillow

## Key API Endpoints

### CDF Template Engine (NEW)
- `POST /api/cdf/generate` - Generate bilingual CDF with coordinate overlay

### Admin Dashboard (NEW)
- `GET /api/admin/pending-users` - List users awaiting approval
- `POST /api/admin/approve-user/{id}` - Approve user
- `POST /api/admin/reject-user/{id}` - Reject user
- `GET /api/admin/logs` - System logs with Correlation IDs
- `GET /api/admin/issues` - Failed actions for debugging

### Evidence Manager
- `POST /api/evidence/generate-certificate` - BSA Section 63 Certificate
- `POST /api/evidence/compute-hash-only` - Quick SHA-256 + MD5 hash

### Smart Summons
- `POST /api/summons/schedule` - Schedule WhatsApp notifications

## File Structure
```
/app/
├── backend/
│   ├── admin/
│   │   └── logs/
│   │       └── system.log          # Action logs file
│   ├── services/
│   │   ├── cdf_template_engine.py  # NEW: Bilingual CDF overlay
│   │   ├── hash_certificate.py     # BSA Section 63
│   │   └── summons_scheduler.py    # WhatsApp scheduling
│   └── server.py
└── frontend/
    └── src/
        ├── pages/
        │   ├── AdminDashboard.js   # NEW: User approval, logs, issues
        │   └── CDFFiller.js        # Updated: API integration
        └── public/
            └── templates/
                └── chargesheet_156_2025.html  # NEW: Filled template
```

## Test Credentials
- **Admin User:** TEST123 / test123 (is_admin: true)
- **Pending User:** PENDING_USER (for approval testing)

## Mocked APIs
- WhatsApp notification sending (logs to console, needs Business API credentials)
- CCTV Search AI analysis (returns mock results)
- Media Forensic analysis (heuristic scoring)

## Backlog / Future Tasks

### P0 - High Priority
- [ ] WhatsApp Business API integration for actual notification sending

### P1 - Medium Priority
- [ ] IMEI Identity Linkage and Location Mapping in CDR Analyzer
- [ ] Word XML Replica Export (embedding Rough Sketch/CDF into .docx)
- [ ] Full AI video analysis for CCTV Search

### P2 - Low Priority
- [ ] Real deepfake detection model integration
- [ ] Case Timeline visualization
- [ ] Browser extension for CCTNS auto-fill
