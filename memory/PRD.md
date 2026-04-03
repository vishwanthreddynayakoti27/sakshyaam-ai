# SAAKSHYAM AI - Dual-Wing Modular System

## Overview
SAAKSHYAM AI is a comprehensive police investigation command console implementing a **Dual-Wing Modular System** architecture with a shared Global Case Context.

## Latest Update: Modular Document Pipeline (April 2026)

### Production-Ready Pipeline Architecture ✅
- **Modular Services**: OCR → Classification → Extraction → Aggregation → Validation → DOCX Generation
- **Template-Based DOCX**: Using `docxtpl` with Jinja2 tags ({{fir_number}}, {{accused_formatted}})
- **Regex-First Extraction**: All data extraction is rule-based (NO AI for extraction)
- **AI Usage Strictly Limited**: ONLY for Brief Facts, Remand Narrative, Telugu Translation

### Pipeline Services Implemented ✅
| Service | Description | File |
|---------|-------------|------|
| **OCRService** | Local Tesseract OCR (Telugu+English+Hindi, NO API key needed) | `pipeline/ocr_service.py` |
| **FileClassifier** | Document type detection (FIR, CD, Witness, Medical) | `pipeline/file_classifier.py` |
| **ExtractionService** | Regex-based data extraction (persons, dates, sections) | `pipeline/extraction_service.py` |
| **WitnessService** | Witness role classification (Complainant, Eyewitness, Panch) | `pipeline/witness_service.py` |
| **AggregatorService** | Unified JSON schema builder with deduplication | `pipeline/aggregator_service.py` |
| **ValidationService** | Required field validation with completeness score | `pipeline/validation_service.py` |
| **TemplateService** | Template-based DOCX generation using docxtpl | `pipeline/template_service.py` |

### OCR Configuration ✅
- **Primary Engine**: Azure Document Intelligence (90%+ table accuracy)
- **Fallback Engine**: Google Vision API (Telugu/English support)
- **Emergency Fallback**: Tesseract OCR (local, no API)
- **Languages**: English (eng) + Telugu (tel) + Hindi (hin)
- **Formats**: PDF, JPG, PNG, DOCX, DOC, TIFF

### Azure Document Intelligence Pipeline ✅
| Stage | Description | File |
|-------|-------------|------|
| **Pre-processing** | OpenCV deskew, denoise, CLAHE, binarize, sharpen | `document_intelligence_service.py` |
| **Azure Analysis** | Layout + Table extraction with cell structure | `document_intelligence_service.py` |
| **Table Reconstruction** | DBSCAN clustering, merged cell handling | `document_intelligence_service.py` |
| **Legal Parsing** | Regex rules for Indian legal formats (FIR, Accused, Witnesses) | `document_intelligence_service.py` |
| **Confidence Validation** | Auto-accept >90%, flag low-confidence for review | `document_intelligence_service.py` |

### Document Intelligence API Endpoints ✅
- `POST /api/document-intelligence/analyze` - Single document analysis
- `POST /api/document-intelligence/batch-analyze` - Batch processing (up to 10 files)
- `POST /api/document-intelligence/preprocess-image` - OpenCV preprocessing
- `POST /api/document-intelligence/detect-tables` - Table boundary detection
- `GET /api/document-intelligence/status` - Service status and configuration
- `POST /api/document-intelligence/extract-for-fusion` - Optimized for Triple Fusion

### Unified JSON Schema ✅
```json
{
  "fir": {"number": "", "date": "", "police_station": "", "district": "", "sections": []},
  "complainant": {"name": "", "father_name": "", "age": null, "caste": "", "occupation": "", "address": "", "phone": ""},
  "accused": [{"serial": "A1", "name": "", ...}],
  "witnesses": [{"serial": "LW-1", "name": "", "role": "Complainant/Eyewitness/Panch", ...}],
  "incident": {"date": "", "time": "", "place": ""},
  "medical": {"findings": ""},
  "property": {"lost": "", "recovered": ""},
  "facts": {"raw": "", "ai_generated": ""},
  "notices": {"section_35_3_dates": []}
}
```

### CCTNS Export JSON ✅
- Flat JSON structure for browser extension autofill
- Fields: fir_number, police_station, district, sections, complainant_name, accused_1_name, witness_count, etc.

## Triple Fusion Generator (March 2026)

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
- **Template-based generation**: Using docxtpl with Jinja2 tags
- **Templates location**: `/app/backend/templates/`
- **Three .DOCX downloads**: Charge Sheet, Case Diary, Remand CD

## Architecture: Dual-Wing Modular System

### WING 1: SAAKSHYAM ADMIN (Investigation & Documentation)

| Module | Description | Status |
|--------|-------------|--------|
| **Triple Fusion Generator** | Charge Sheet + Case Diary + Remand CD with modular pipeline | COMPLETE |
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
  - Returns: documents, cctns_json, pipeline_stats, validation
- `GET /api/download/docx/{filename}` - Download Word document
- `GET /api/staging/my-cases` - List all staging cases for officer

## File Structure
```
/app/
├── backend/
│   ├── routers/
│   │   └── staged_upload.py       # Staging + Pipeline integration
│   ├── services/
│   │   ├── pipeline/              # NEW: Modular pipeline services
│   │   │   ├── __init__.py
│   │   │   ├── ocr_service.py
│   │   │   ├── file_classifier.py
│   │   │   ├── extraction_service.py
│   │   │   ├── witness_service.py
│   │   │   ├── aggregator_service.py
│   │   │   ├── validation_service.py
│   │   │   ├── template_service.py
│   │   │   └── pipeline.py        # Main orchestrator
│   │   └── docx_generator.py      # Legacy generator (fallback)
│   ├── templates/                 # NEW: DOCX templates with Jinja2 tags
│   │   ├── chargesheet_template.docx
│   │   ├── casediary_template.docx
│   │   └── remand_template.docx
│   └── staging/                   # Staged files storage
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
- [x] Can upload more than 4 files (30+ supported)?
- [x] Output is .docx Word file (template-based)?
- [x] Credits show 0 while uploading?
- [x] CCTNS JSON returned in response?
- [x] Pipeline stats (files_classified, extraction_stats) returned?
- [x] Validation completeness score returned?

## Test Reports
- `/app/test_reports/iteration_11.json` - Modular pipeline testing (100% pass rate)
