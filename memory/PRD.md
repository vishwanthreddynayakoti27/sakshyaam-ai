# SAAKSHYAM AI - Dual-Wing Modular System

## Overview
SAAKSHYAM AI is a comprehensive police investigation command console implementing a **Dual-Wing Modular System** architecture with a shared Global Case Context.

## Latest Update: Triple Fusion Generator (March 2026)

### UI Restructure Complete ✅
- **Triple-Tab Interface**: [Charge Sheet] | [Case Diary 1] | [Remand Case Diary]
- **Removed**: Separate "Outside" Remand tool (now integrated)
- **All tabs pull from same multi-file upload folder**

### Batch Processing (No Limits) ✅
- **Unlimited file uploads**: 1-30+ files supported
- **Zero credits for uploading**: Files staged without processing
- **Credits only on "Generate Triple Fusion"**
- **Rollback on failure**: No credits deducted if generation fails

### Word Document Output ✅
- **Stable tables**: Using python-docx (no text-rendered ┌───┐ tables)
- **Template-based**: Uses 156.2025 CS format as skeleton
- **Three .DOCX downloads**: Charge Sheet, Case Diary, Remand CD

## Architecture: Dual-Wing Modular System

### WING 1: SAAKSHYAM ADMIN (Investigation & Documentation)

| Module | Description | Status |
|--------|-------------|--------|
| **Triple Fusion Generator** | Charge Sheet + Case Diary + Remand CD in one window with tabs | COMPLETE |
| **CDF Interactive Filler** | Bilingual (Telugu/English) with coordinate overlay print | COMPLETE |
| **Smart Summons** | WhatsApp auto-scheduling 1 day before court date | COMPLETE |
| **Admin Dashboard** | User approval, logs, issue tracking | COMPLETE |
| **CCTNS Bridge** | JSON export for browser extension | COMPLETE |

### WING 2: SAAKSHYAM LAB (Advanced Forensic Lab)

| Module | Description | Status |
|--------|-------------|--------|
| **CDR Analyzer** | Telecom records deep-parsing | COMPLETE |
| **Media Forensic** | [REAL]/[AI_GENERATED]/[DEEP_FAKE] verdicts | COMPLETE |
| **CCTV Search** | AI-powered attribute search with temporal sync | COMPLETE |
| **e-Sakshya & Hash** | BSA Section 63 Certificate generation | COMPLETE |

## Key API Endpoints

### Staged Upload System (Zero-Credit Uploads)
- `POST /api/staging/create-case` - Create case folder (0 credits)
- `POST /api/staging/upload-files/{case_id}` - Batch upload (0 credits)
- `GET /api/staging/case/{case_id}` - List staged files (0 credits)
- `DELETE /api/staging/case/{case_id}/file/{filename}` - Remove file (0 credits)
- `POST /api/staging/generate-triple-fusion/{case_id}` - Generate all 3 docs (CREDITS HERE)
- `GET /api/download/docx/{filename}` - Download Word document

### FIR 57/2026 Test Data
Pre-generated documents available:
- `57-2026_ChargeSheet.docx`
- `57-2026_CaseDiary.docx`

## File Structure
```
/app/
├── backend/
│   ├── routers/
│   │   └── staged_upload.py     # Staging system with batch upload
│   ├── services/
│   │   └── docx_generator.py    # Word document generator
│   └── staging/                 # Staged files storage
│       └── *.docx               # Generated documents
└── frontend/
    └── src/
        └── pages/
            └── ChargeSheetFusion.js  # Triple-Tab UI
```

## Test Credentials
- **Admin User:** TEST123 / test123

## Credit Protection Rules
1. ✅ Uploading files = 0 credits
2. ✅ Staging files = 0 credits  
3. ✅ Viewing staged files = 0 credits
4. ✅ Deleting staged files = 0 credits
5. ⚡ Generate Triple Fusion = Credits (only on SUCCESS)
6. ✅ Failed generation = 0 credits (ROLLBACK)

## Verification Checklist
- [x] Three tabs visible (Charge Sheet, CD-I, Remand)?
- [x] Can upload more than 4 files?
- [x] Output is .docx Word file (not text box)?
- [x] Credits show 0 while uploading?
