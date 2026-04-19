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

### 2026-04-19: Triple Fusion — DB-Backed Async Job Queue (P0 FIX)
- ✅ Root cause: `generate_html_table_charge_sheet(data, case_info)` was being called with a string fir_number instead of case_info dict → `'str' object has no attribute 'get'`
- ✅ Fix: `_process_triple_fusion_background` now builds a proper `case_info` dict and passes it to all 3 generators
- ✅ Replaced 60s-blocking sync execution + in-memory `processing_jobs` dict with MongoDB-backed `triple_fusion_jobs` collection + `asyncio.create_task` worker
- ✅ New endpoints:
  - `POST /api/staging/generate-triple-fusion/{case_id}` — returns `{status:"processing", job_id}` in <1s
  - `GET /api/staging/job-status/{case_id}` — DB-persisted progress polling
- ✅ Frontend `ChargeSheetFusion.js`: `pollJobStatus()` loop + live progress bar (`fusion-progress-bar`, `fusion-progress-percent`)
- ✅ Credits (5) deducted ONLY on success; failure path logs FAILED with credit_cost=0
- ✅ 9/9 backend tests pass in `/app/backend/tests/test_triple_fusion_queue.py`
- ✅ 12-file batch completes in <3s (previously hung at 60s K8s timeout)

### 2026-04-19: RBAC + Supervisor Role + Fusion Skeleton Loader
- ✅ Added `role` field to officers: `admin` | `supervisor` | `officer` (default)
- ✅ Split backend dependencies:
  - `verify_admin` → write endpoints (approvals, cache-cleanup, role management)
  - `verify_admin_or_supervisor` → read endpoints (all GET /admin/* endpoints)
- ✅ New endpoints:
  - `GET /api/admin/officers` — list all officers with roles
  - `POST /api/admin/officers/{id}/role` (form: role) — admin-only; blocks self-demotion
- ✅ `/auth/profile` and `/auth/login` now return `role` + `is_admin` fields
- ✅ Admin Dashboard:
  - Role-aware header: "Admin Dashboard" vs "Supervisor Dashboard" + role badge
  - New **"Manage Roles"** tab (admin-only) with officer list + per-row officer/supervisor/admin buttons
  - Supervisor sees 4 tabs (no Manage Roles); approve/reject replaced with 🔒 "Read-only (Supervisor)"; cache-cleanup button disabled with Lock icon
  - `/auth/profile` auto-refreshed on mount so role changes apply without re-login
- ✅ Fusion Skeleton Loader (`ChargeSheetFusion.js`):
  - Replaces empty "Charge Sheet Preview" while `isGenerating=true`
  - Sky-blue progress banner with human-readable stage text + % counter
  - Document-shaped skeleton (title, 2-col meta grid, 5-row table, 4-line paragraph) with pulsing animation
- ✅ Testing: **55/55 tests pass** (46 new RBAC tests + 9 Triple Fusion regression) — `/app/backend/tests/test_rbac.py`, `test_triple_fusion_queue.py`

### 2026-04-19: Forgot Password — Admin-Mediated Flow (no email provider)
- ✅ Backend:
  - `POST /api/auth/forgot-password` (public) — creates pending request in `password_reset_requests` collection; generic response regardless of officer_id existence (no enumeration leak); de-dupes pending requests
  - `GET /api/admin/password-reset-requests` — admin + supervisor (read-only), status filter
  - `POST /api/admin/password-reset-requests/{id}/reset` — admin-only; generates `secrets.token_urlsafe(9)[:12]` temp password, updates `password_hash` + `must_change_password=true`, returns temp password ONCE (never stored)
  - `POST /api/admin/password-reset-requests/{id}/reject` — admin-only
  - `POST /api/auth/change-password` — authenticated; verifies current password, enforces min 8 chars, clears `must_change_password` flag
  - `LoginResponse` now includes `must_change_password` boolean
- ✅ Frontend:
  - "Forgot password?" link on Login page opens `ForgotPasswordModal` with officer_id + email + reason fields
  - `ForceChangePasswordModal` blocks users with `must_change_password=true` from reaching the app until they submit a new password
  - New **"Password Resets"** tab in Admin Dashboard (visible to admin + supervisor) with pending/completed/rejected filters, Reset/Reject buttons (admin-only), and one-time temp password banner with Copy/Dismiss
- ✅ Security: no officer_id enumeration, dedupe per officer, audit trail via `log_action` (PASSWORD_RESET_REQUEST / APPROVE / REJECT / PASSWORD_CHANGE)
- ✅ Testing: **71/71 total tests pass** (16 new password-reset + 55 RBAC/Fusion regression) — `/app/backend/tests/test_password_reset.py`

### 2026-04-19: Case-Insensitive Login
- ✅ `POST /api/auth/login` and `/api/auth/forgot-password` now use case-insensitive regex match (`re.escape(oid)` with `i` flag). `Pc72`, `PC72`, `pc72` all resolve to the same officer.

### 2026-04-19: Fusion Page Refactor — Removed Preview, Added Status Card
- ✅ Root cause of mobile 'Script error at handleError': `dangerouslySetInnerHTML` with large generated HTML under iOS/Android WebView strict-mode CSP
- ✅ Fix: Removed the entire HTML preview pane + Charge Sheet/Case Diary/Remand tab header
- ✅ Replaced with 3 pure React subviews on the right panel:
  - `FusionIdleView` — "Ready to Generate" card with FIR/file checklist
  - `FusionGeneratingView` — pulsing cyan rings + spinning loader + progress bar + stage text + file count
  - `FusionCompletedView` — green checkmark + extraction summary + 3 color-coded download buttons (ChargeSheet / CaseDiary / Remand)
- ✅ Removed `FusionSkeleton`, `FusionEmptyState` helpers + `printDocument` dead code + unused imports
- ✅ Duplicate progress bar in sidebar hidden on mobile (`hidden lg:block`)
- ✅ `replace('/', '-')` → `replaceAll('/', '-')` for multi-slash FIR numbers
- ✅ Testing: **71/71 regression pass on both desktop (1920×1080) and mobile (500×900)** — zero console errors, zero pageerrors

### 2026-04-19: Intelligent Charge Sheet Generator (Station-Writer Grade)
- ✅ New service `/app/backend/services/intelligent_charge_sheet.py` — single Claude Sonnet 4.5 call (GPT-5.2 fallback) that validates + corrects + composes in one pass
- ✅ System prompt primes the LLM as a "senior station writer" with BNS/BNSS fluency + 7-step pipeline (INGEST → ROLE RESOLUTION → ENTITY CLEANUP → SECTION CORRECTION → WITNESS RE-NUMBERING → BRIEF FACTS COMPOSITION → FIELD POLICY)
- ✅ Returns strict JSON with full charge-sheet structure + `corrections_applied` array listing every fix
- ✅ New renderer `/app/backend/services/station_charge_sheet_renderer.py` produces DOCX matching the real Makthal 18-column layout:
  - 3-column kv table (No./Field/Value) matching station format
  - Witness list as separate 3-column table (LW# / Name block / Role)
  - Brief Facts as justified paragraphs
  - Missing fields render as visible `__________` placeholders so officers can fill in by hand
  - Completely-empty witness list adds one blank row for manual entry
- ✅ New endpoints:
  - `POST /api/staging/generate-intelligent-charge-sheet/{case_id}` — returns DOCX directly (3 credits, rollback-safe)
  - `GET /api/staging/intelligent-chargesheet/{case_id}` — returns corrections list + metadata
- ✅ Frontend: orange "Generate Station-Format Charge Sheet" button in `FusionCompletedView` with inline corrections display after download
- ✅ Verified against FIR 57/2026 — 7 corrections applied (complainant moved from accused, garbled OCR dropped, procedural sections stripped, Smt. salutation inferred, witnesses re-numbered, chargesheet date preserved)
- ✅ Output matches real station-written charge sheet format by Y. Bhagya Lakshmi Reddy (verified via extract_file_tool)

### 2026-04-19: Intelligent Case Diary Part-I Generator
- ✅ New service `/app/backend/services/intelligent_case_diary.py` — takes the already-corrected ICGS JSON as input, composes chronological IO investigation log via Claude Sonnet 4.5
- ✅ System prompt enforces 3rd-person station style, date-ordered entries: FIR registration → scene panchanama + rough sketch + S.180 BNSS statements → medical examination + wound certificate → 35(3) BNSS notice → accused appearance + address proof + release → charge sheet filing
- ✅ New renderer `/app/backend/services/station_case_diary_renderer.py` produces DOCX with 3-col table (Date / Time / Entry), FIR header, signature block; empty entries render as blank rows for manual entry
- ✅ New endpoint `POST /api/staging/generate-intelligent-case-diary/{case_id}` — 2 credits, requires prior ICGS output
- ✅ Frontend: blue "Generate Case Diary Part-I" button in `FusionCompletedView`, disabled until charge sheet is generated with explicit hint
- ✅ Tested against FIR 57/2026 — 7 chronological entries composed correctly (scene visit, S.180 statements, medical, 35(3) notice, accused appearance, completion)

### Previous: Base Pipeline
- ✅ OpenCV preprocessing (deskew, denoise, binarize, sharpen)
- ✅ Spatial clustering for table detection
- ✅ Rule-based extraction calibrated on real samples

## In Progress / Pending

### ~~P0 - Triple Fusion Endpoint~~ ✅ FIXED (2026-04-19)
- ✅ `'str' object has no attribute 'get'` bug fixed — `case_info` dict now passed to all generator functions instead of fir_number string
- ✅ Replaced 60s-blocking sync loop with **DB-backed async job queue** (`triple_fusion_jobs` MongoDB collection + `asyncio.create_task`)
- ✅ POST `/api/staging/generate-triple-fusion/{case_id}` returns in <1s with `{status:"processing", job_id, progress, stage}`
- ✅ GET `/api/staging/job-status/{case_id}` returns DB-persisted progress/stage; on completion returns full `documents`, `extracted_data`, `credits_used:5`
- ✅ Idempotency: in-flight job returns same job_id; completed fusion returns cached result with `credits_used:0`
- ✅ Rollback-safe: credits deducted only after successful persistence; FAILED action_logs on error
- ✅ 9/9 backend tests pass (`/app/backend/tests/test_triple_fusion_queue.py`)
- ✅ 12-file batch completes end-to-end (was previously timing out)
- ✅ Frontend polling integrated in `ChargeSheetFusion.js` with live progress bar

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
