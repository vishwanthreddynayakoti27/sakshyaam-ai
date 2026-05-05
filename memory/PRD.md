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

### 2026-04-27: CCTV Search — Replaced Mock with Real Per-Frame AI Detection
- ✅ **Root cause of all 3 reported bugs** was that `/cctv/analyze` was 100% mocked: random timestamps, hardcoded plate strings (`TS09EA1234`, `AP07AB5678`, `TG11CD9012`), and `thumbnail_base64=None`. This is why videos didn't jump to the right frame, custom plate searches never matched, and thumbnails were always missing
- ✅ New service `/app/backend/services/cctv_search.py` — real implementation:
  - **OpenCV** samples 1 frame every 1.5s (configurable 1.0–5.0s) — millisecond-precise timestamps
  - **Gemini 2.5 Flash** runs on every sampled frame **in parallel** (asyncio.gather, sem=6) — detects vehicles, persons, and Indian-format number plates with OCR
  - **Real base64 JPEG thumbnails** generated per match (320px max-edge, optimised) so the frontend list always shows previews
  - **Plate normalisation** — strips spaces/hyphens, uppercases, so search "TS 09 EA 1234" matches "TS09EA1234"
- ✅ Frontend `CCTVSearch.js`:
  - New **"Registration Plate (highest priority)"** input (`cctv-plate-input`) that wires into the search query and forces `search_type=number_plate` for higher-precision OCR matching
  - Removed mock fallback that was silently masking real errors — now shows real backend error messages
  - Increased axios timeout to 10 minutes (real per-frame Gemini calls take 5–60s for typical CCTV clips)
  - Result list shows plate text from `plate_text` field with priority over generic label
- ✅ Test `/app/backend/tests/test_cctv_search.py` builds a 6-second synthetic CCTV video (yellow Indian-style plate "TS09EA1234" on a moving red car) and verifies — **8/8 assertions pass**:
  - duration_ms=6000 (real, not mocked)
  - 6 frames sampled, 8–10 detections returned
  - All thumbnails decode to valid JPEGs >500 bytes
  - Timestamps are sorted, within video duration
  - Search "TS09EA1234" returns **6 plate-text matches** (Gemini OCR'd it on every frame)
  - plate_text normalised to uppercase, no spaces
- ✅ Endpoint `/cctv/analyze` now accepts `sample_interval` form param (1.0–5.0s) for finer/coarser sampling

### 2026-04-27: Real Deepfake Detection (Gemini 2.5 Pro Multimodal Vision)
- ✅ New service `/app/backend/services/deepfake_detector.py` — replaces the heuristic-only verdict for images and videos with real AI multimodal forensic analysis using **Gemini 2.5 Pro** via Emergent LLM key (no extra API cost)
- ✅ Strict 3-class classifier: **REAL** (camera capture), **AI_GENERATED** (Stable Diffusion / Midjourney / DALL·E / SDXL / Flux / non-photographic graphics), **DEEP_FAKE** (face-swap / lip-sync manipulation)
- ✅ For videos: extracts 5 evenly-spaced frames via OpenCV, sends multi-image message so model can detect face-boundary flicker, identity drift, lip-sync mismatch across frames
- ✅ Image normalisation pipeline: re-encodes to JPEG (max 1280px long-edge, q=85) before sending — handles WEBP/PNG/animated GIF correctly
- ✅ Strict JSON output schema with police-grade fields: `{verdict, confidence, indicators[], red_flags[], reasoning}`. Model prompt enumerates 11 specific deepfake artefact families (skin texture, asymmetric eyes, melted ears, lighting mismatch, Synthia/SoraSig watermarks, etc.)
- ✅ `ForensicAnalysisResponse` extended with `ai_confidence`, `indicators[]`, `red_flags[]`, `ai_model` so frontend can surface the model's reasoning
- ✅ Authenticity-score mapping rewritten with floors: REAL→max(50, conf), AI_GENERATED→100-max(50,conf), DEEP_FAKE→100-max(70,conf) — prevents confusing 0% scores when model returns ambiguous confidence
- ✅ Frontend `MediaForensic.js` now displays the AI model's confidence next to authenticity score, plus dedicated **Red Flags** (bordered red panel) and **Supporting Indicators** lists from the AI verdict
- ✅ Audio still uses heuristic (audio deepfake needs dedicated spectral model — out of scope)
- ✅ Test suite `/app/backend/tests/test_deepfake_detection.py` — 3/3 pass: realistic-photo path, obvious-synthetic path, MongoDB persistence of `ai_analysis` block (verdict + indicators + red flags). Real Gemini API hit confirmed, returns ~10 indicators and 5 red flags per image with police-grade reasoning paragraph

### 2026-04-27: GitHub Push Protection — History-Rewrite Cleanup
- ✅ `git filter-branch` purged `backend/credentials/` from ALL git commits (was triggering GitHub secret scanner on commit `630a26c`)
- ✅ Total commits reduced 127 → 125 (2 empty commits pruned). Local history is fully clean — no commit anywhere references the credentials directory
- ✅ Strengthened `.gitignore`: `backend/credentials/` + `**/credentials/*.json` patterns prevent re-introduction
- ✅ Disk files preserved (Google Vision/NLP/Translate/Speech keep working). Recommendation made to user to rotate the keys in GCP Console as a definitive security fix

### 2026-04-27: Dashboard Buy-Credits CTA
- ✅ Added compact credit-balance pill in the Dashboard top status bar (`dashboard-buy-credits` testid) — live balance fetched from `/auth/profile`, click navigates to `/credits`. No Layout migration required (preserves bespoke hero design)

### 2026-04-27: Credit & Payment System (Stripe + Approval Gate + Manual Grant)
- ✅ **Officer model**: added `credits:int=0`, `approval_status: PENDING|APPROVED|REJECTED` (default PENDING for new signups). Startup backfill marks all pre-existing officers APPROVED so live users aren't locked out
- ✅ **Approval gate on /auth/login**: PENDING → 403 with "pending admin approval" detail; REJECTED → 403 with "rejected" detail
- ✅ **Signup flow rewritten**: /auth/signup no longer issues a token — returns `{approval_status:"PENDING", officer_id, message}`. Frontend Signup.js renders a "Pending Admin Approval" card (`pending-approval-card`) with Back-to-Login button, no auto-login
- ✅ **20 free trial credits** granted on first admin approval (idempotent — `trial_granted` flag prevents double-grant on re-approve)
- ✅ **Stripe Checkout integration** via emergentintegrations:
  - `GET /api/credits/packs` (public): 3 packs (starter ₹499/100cr, pro ₹1999/500cr, agency ₹6999/2000cr) + custom config (₹5/credit, 50–10000 range)
  - `POST /api/payments/checkout`: server-side amount/credit resolution (frontend cannot tamper); creates Stripe session + persists `payment_transactions` row with `credits_applied:false`
  - `GET /api/payments/status/{session_id}`: polled by success page; applies credits exactly once via atomic `credits_applied:false → true` guard
  - `POST /api/webhook/stripe`: idempotent webhook with same atomic guard
  - `GET /api/payments/history`: user's own transactions
- ✅ **Admin manual credit grant**: `POST /api/admin/grant-credits/{officer_id}` (positive=grant, negative=revoke) with reason; full audit trail in `credit_grants` collection. Guard: revokes that would push balance negative are rejected with 400. Non-admins blocked with 403. `GET /api/admin/credit-grants` lists history
- ✅ **Balance-floor guard** added to all credit-consuming endpoints (Triple Fusion 5cr, Intelligent Charge Sheet 3cr, Intelligent Case Diary 2cr): pre-check returns 402 with friendly "Insufficient credits — Buy more at /credits" before any deduction
- ✅ **Frontend new pages**:
  - `/credits` — current balance card, 3 pack cards (Most-popular badge on Pro), custom amount with live ₹ calculation, payment history
  - `/credits/success` — polls /payments/status with 8 attempts × 2s timeout; shows +N credits added or failure card
  - Sidebar "Buy Credits" link visible on every Layout page
  - Admin Dashboard new "Grant Credits" tab — officer list with current balance + amount/reason inputs + Grant/Revoke buttons + recent grants ledger with admin attribution
- ✅ **Tests** (3 new test files):
  - `test_credits_payments.py` — 14/14 pass (signup approval gate, login block, trial grant, packs, real Stripe checkout session, custom price tampering, manual grant, revoke guard, audit ledger, RBAC, REJECTED login)
  - `test_credit_balance_gate.py` — 3/3 pass (insufficient-credit 402 on charge sheet + case diary; gate clears at exact threshold)
- ✅ **Backfill**: 2 officers with pre-existing negative credit balances (from before the gate) reset to 0
- ✅ E2E verified by testing agent (iteration 16): backend 14/14 + frontend 14/14 — real Stripe checkout redirect confirmed working end-to-end

### 2026-04-27: IMEI Identity Linkage + Location Mapping (CDR Analyzer)
- ✅ New endpoint `GET /api/cdr/imei-linkage/{case_id}` — MongoDB aggregation groups all phone numbers used per IMEI; flags **HIGH suspicion** for 3+ distinct SIMs (SIM-swap pattern), MEDIUM for 2 SIMs, LOW for 1
- ✅ New endpoint `GET /api/cdr/location-map/{case_id}?phone=&imei=` — aggregates tower/location frequency with first/last-seen timestamps; supports phone or IMEI filter for per-subject movement reconstruction; returns hotspot summary + detailed points
- ✅ Frontend `CDRAnalyzer.js`: two new collapsible sections (IMEI Linkage + Location Mapping) auto-loaded after upload; risk badges (HIGH=red, MEDIUM=amber, LOW=green); phone/IMEI filter UI with Apply button; movement timeline with first→last seen
- ✅ Test suite `/app/backend/tests/test_imei_linkage.py` — seeds 8 records across 3 IMEIs, verifies 1 HIGH/1 MEDIUM/1 LOW classification, hotspot counts (Mumbai 2 phones), and IMEI-filter + phone-filter both working — **6/6 assertions pass**

### 2026-04-27: GitHub Push Hardening — Removed Hardcoded JWT Fallback
- ✅ Removed hardcoded `JWT_SECRET` fallback string `'nyaya-prahari-secret-key-2025-secure'` from 7 files (`server.py` + 6 routers); now `JWT_SECRET = os.environ['JWT_SECRET']` (fails fast if missing)
- ✅ Unblocks GitHub "Save to Github" feature which detected the embedded secret
- ✅ Verified login still works post-change

### 2026-04-27: Encrypted Translation/Petition Cache (At-Rest Encryption)
- ✅ Petition/complaint translation + entity-extraction results cached in MongoDB `document_cache` collection are now **encrypted at rest** with AES-128-CBC + HMAC-SHA256 (Fernet)
- ✅ Per-record Data Encryption Key derived via **HKDF-SHA256** from a master `CACHE_ENCRYPTION_KEY` env var + 16-byte random salt; leaking one record's key cannot decrypt others
- ✅ New service `/app/backend/services/cache_crypto.py` with `encrypt_payload()` / `decrypt_payload()` / `encryption_enabled()`
- ✅ Updated `document_cache.py`: `set_cached_result` writes `cached_data_enc={v:1, salt, ct}`, drops legacy plaintext fields via `$unset`; `get_cached_result` decrypts at read time, falls back to plaintext for legacy records
- ✅ Tampered ciphertext → HMAC integrity check fails → record treated as cache miss (no silent corruption)
- ✅ `GET /api/admin/cache-stats` now exposes `encryption_enabled` + `encryption_algorithm`
- ✅ Admin Dashboard "Document Cache" card shows green "🔒 Encrypted at rest" badge (or red warning if key missing)
- ✅ Test suite `/app/backend/tests/test_cache_encryption.py` verifies: (1) no plaintext leakage of names/locations/translations in MongoDB, (2) MISS→SET→HIT round-trip, (3) tamper rejection, (4) stats expose flag — **6/6 checks pass**
- ✅ Master key `CACHE_ENCRYPTION_KEY` (Fernet 256-bit URL-safe base64) added to `backend/.env`

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
