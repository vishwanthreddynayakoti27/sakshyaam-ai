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
- Color-coded bounding boxes:
  - GREEN: High-confidence fields (>90%)
  - YELLOW: Low-confidence fields (70-90%)
  - RED: Detected but unextracted regions (<70%)
- Generates `annotated_diff_<filename>.pdf`

## Completed Features

### 2025-04-03: Visual Diff / Overlay Tool
- ✅ Implemented `VisualDiffGenerator` class in `enhanced_legal_parser.py`
- ✅ Color-coded bounding box overlay using OpenCV
- ✅ Annotated PDF generation (pdf2image + PIL)
- ✅ Integration with `/api/document-intelligence/analyze` endpoint
- ✅ Tested with both reference PDFs:
  - 57-26_Chargesheet.pdf: 2 accused, 5 witnesses, 1.2MB annotated PDF
  - 236_remand.pdf: 9 accused, 2 witnesses, annotated PDF generated
- ✅ Response includes clean JSON + base64-encoded annotated PDF

### Previous: Enhanced Legal Parser
- ✅ OpenCV preprocessing (deskew, denoise, binarize, sharpen)
- ✅ Spatial clustering for table detection
- ✅ Rule-based extraction calibrated on real samples
- ✅ Accused parsing (handles "Al" vs "A1" OCR errors)
- ✅ Witness numbering parsing (standard and LW-X formats)

## In Progress / Pending

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
- Real deepfake detection model integration (if currently mocked)
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
│   │   └── document_intelligence.py      
│   ├── services/
│   │   ├── document_intelligence_service.py
│   │   ├── enhanced_legal_parser.py
│   │   ├── template_generator.py
│   │   └── pipeline/
│   └── server.py
└── frontend/
```

## Key API Endpoints

- `POST /api/document-intelligence/analyze` - Main analysis with Visual Diff
- `POST /api/document-intelligence/batch-analyze` - Batch processing
- `POST /api/document-intelligence/extract-for-fusion` - Triple Fusion extraction

## Test Credentials
- Officer ID: `TEST001`
- Password: `Test123!`

## Dependencies
- opencv-python-headless
- scikit-learn (DBSCAN)
- PyPDF2
- reportlab
- pdf2image
- scipy

## 3rd Party Integrations
- emergentintegrations (Emergent LLM Key - GPT 5.2)
- Google Vision API (configured)
- Azure Document Intelligence (prepared, pending key)
