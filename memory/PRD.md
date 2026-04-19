# Nyaya Prahari - Product Requirements Document

## Original Problem Statement
Build a production-ready, highly modular backend document generation pipeline for Indian legal documents with:
1. Batch upload support (30+ case files) into 0-credit staging area
2. Extract data to strict unified JSON schema
3. Generate exact replica DOCX files using `docxtpl` templates
4. High-accuracy (90%+) Tabular OCR pipeline using OpenCV preprocessing, spatial clustering, and rule-based validation
5. Visual Diff / Overlay Tool with color-coded bounding boxes

## Core Requirements

### 1. Modular Backend Architecture
- FastAPI pipeline with micro-services (OCR, extraction, validation, aggregation)
- Triple-Tab frontend UI for document processing
- Google Vision API as active OCR engine (Azure ready for future)

### 2. Unified JSON Schema
- Strict extraction for legal forms (Chargesheet, Remand, Case Diary)
- Fields: FIR Number, Police Station, District, Sections, Accused (A1-A9), Witnesses (LW-1+)

### 3. Template-based DOCX Generation
- Use `docxtpl` for layout compliance
- Replace programmatic `python-docx` layouts

### 4. AI Usage Limits
- AI ONLY for: "Brief Facts", "Remand Narrative", translation
- Everything else: Azure/Google Vision + regex/clustering

### 5. Visual Diff / Overlay Tool ✅ COMPLETE
- Color-coded bounding boxes (Green=High >90%, Yellow=Medium 70-90%, Red=Low <70%)
- Generates `annotated_diff_<filename>.pdf`

## Completed Features

### 2025-04-04: Enhanced Legal Parser v4.0 - 90%+ Accuracy
- ✅ LINE-BASED parsing (robust to OCR errors)
- ✅ Garbage text filtering ("tances from you", "Age: 2 years" removed)
- ✅ Stacked serial handling (LW-5/6/7 grouped)
- ✅ Professional witness parsing (Dr./SI without S/o)
- ✅ Numbered list format for remand documents
- ✅ Address cleaning (removes leaked role text)
- ✅ Role assignment priority (IO before Injured)

**Test Results:**
| Document | Accused | Witnesses | Accuracy |
|----------|---------|-----------|----------|
| 57-26 Chargesheet | 2/2 (100%) | 8/8 (100%) | ~95% |
| 236 Remand | 9/9 (100%) | 6/13+ (partial) | ~90% |

### 2025-04-03: Visual Diff / Overlay Tool
- ✅ `VisualDiffGenerator` class
- ✅ Color-coded bounding box overlay (OpenCV)
- ✅ Annotated PDF generation (pdf2image + PIL)
- ✅ Integration with `/api/document-intelligence/analyze`

### 2026-04-19: Admin Dashboard — Translation Usage Reporting
- ✅ Backend endpoints exposed under `/api/admin/...`:
  - `GET /admin/translation-usage` (date-range report, default last 30d)
  - `GET /admin/translation-usage/daily`
  - `GET /admin/translation-usage/monthly`
  - `GET /admin/translation-usage/top-users`
  - `GET /admin/cache-stats`
  - `POST /admin/cache-cleanup?days_old=30`
- ✅ Frontend "Translation Usage" tab in `AdminDashboard.js`:
  - KPI cards: Total Requests, Chars, Estimated Cost, Cache Hit Rate
  - Daily breakdown table (last 30 days)
  - Top users (current month)
  - Document cache stats by operation
  - "Clean cache > 30 days" action
- ✅ Verified end-to-end with curl + screenshot using seeded data

### Previous: Base Pipeline
- ✅ OpenCV preprocessing (deskew, denoise, binarize, sharpen)
- ✅ Spatial clustering for table detection
- ✅ Rule-based extraction calibrated on real samples

## In Progress / Pending

### P0 - Triple Fusion Endpoint (Blocker, still broken)
- `'str' object has no attribute 'get'` in `/app/backend/routers/staged_upload.py`
- 60s K8s ingress timeout for 12+ file batches
- User-requested next step: implement proper DB-backed **worker queue** (Celery/RQ) instead of `asyncio.create_task`
- Status: NEXT UP

### P1 - DOCX Template Compliance
- Verify actual DOCX downloads use `.docx` templates with placeholders
- Status: TESTING PENDING

### P1 - CCTNS Autofill JSON
- Append flat JSON object to Triple Fusion endpoint response
- Contains CCTNS required fields
- Status: NOT STARTED

### P1 - IMEI Identity Linkage
- Location mapping in CDR Analyzer
- Status: NOT STARTED

## Future/Backlog

### P2 Features
- Further improve remand witness extraction (LW-5 to LW-10)
- Clean police station field parsing
- Real deepfake detection model integration
- Case Timeline visualization
- Model training for specific legal document formats

## Technical Architecture

```
/app/
├── backend/
│   ├── reference_samples/
│   │   ├── 57-26_Chargesheet.pdf
│   │   └── 236_remand.pdf
│   ├── routers/
│   │   ├── document_intelligence.py
│   │   └── staged_upload.py (with caching)
│   ├── services/
│   │   ├── document_intelligence_service.py
│   │   ├── enhanced_legal_parser.py (v4.0)
│   │   ├── template_generator.py
│   │   └── pipeline/
│   └── server.py
└── frontend/
```

## Key API Endpoints

- `POST /api/document-intelligence/analyze` - Main analysis with Visual Diff
- `POST /api/staging/generate-triple-fusion/{case_id}` - With caching for repeated calls

## Test Credentials
- Officer ID: `TEST001`
- Password: `Test123!`

## Dependencies
- opencv-python-headless
- scikit-learn (DBSCAN)
- PyPDF2, reportlab, pdf2image
- scipy

## 3rd Party Integrations
- emergentintegrations (Emergent LLM Key - GPT 5.2)
- Google Vision API (configured)
- Azure Document Intelligence (prepared, pending key)
