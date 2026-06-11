# Nyaya Prahari - Product Requirements Document

## Original Problem Statement
Build a production-ready, highly modular backend document generation pipeline for Indian legal documents with:
1. Batch upload support (30+ case files) into 0-credit staging area
2. Extract data to strict unified JSON schema
3. Generate exact replica DOCX files using `docxtpl` templates
4. High-accuracy (90%+) Tabular OCR pipeline using OpenCV preprocessing, spatial clustering, and rule-based validation
5. Visual Diff / Overlay Tool with color-coded bounding boxes
6. "Intelligent Charge Sheet Generator" V3.0 acting as Master IO
7. Direct OpenAI API integration (user's own key)
8. 15-field manual input form (manual values are authoritative, never AI-altered)
9. "Edit & Regenerate" cascading corrections
10. Apply V3.0 treatment to Case Diary Part-I and Remand Report (same architecture)
11. CCTNS Autofill JSON (external database interoperability)

## Core Requirements

### 1. Modular Backend Architecture
- FastAPI pipeline with micro-services (OCR, extraction, validation, aggregation)
- Triple-Tab frontend UI for document processing
- Google Vision API as active OCR engine

### 2. Unified JSON Schema
- Strict extraction for legal forms (Chargesheet, Remand, Case Diary)

### 3. Template-based DOCX Generation
- `fixed_layout_renderer.py` produces deterministic 18-section Telangana Charge Sheet,
  8-field Case Diary Part-I, and 10-field Remand Report letter format
- AI fills cell values only — layout never drifts

### 4. AI Usage
- OpenAI gpt-4o (via `llm_compat.py` shim) for:
  - Charge Sheet narrative composition + extraction
  - Case Diary Part-I chronological log + steps
  - Remand Report letter + grounds of arrest

### 5. Two-phase Manual Input
- 15-field manual form blocks ANY LLM alteration of Phase 1 fields
- Court name, IO name+rank, FIR no, FIR date, etc. come from manual input verbatim

## Completed Features (latest first)

### 2026-06-13: Judicial Persona V6.0 + Step 0.5 Part-II Auto-Detect

**Part A — Judicial Persona / Triple-Mindset Prompt (V6.0):**
- ✅ `intelligent_charge_sheet.SYSTEM_PROMPT` now has a **SECTION ⋄ — PROFESSIONAL PERSONA & TRIPLE MINDSET** block injected before SECTION A. Forces the LLM to internalise three perspectives simultaneously before generating any Brief Facts / Conclusion:
  - **⋄1 IO mindset** — knows the facts, witnesses, investigation sequence; writes confident, fact-anchored prose.
  - **⋄2 Legal Advisor mindset** — knows which BNS/BNSS sections fit which fact pattern; uses proper court language.
  - **⋄3 Judge mindset** — every line written for the Magistrate; zero errors, zero contradictions, zero ambiguity.
- ✅ **FOUR-LENS PRE-WRITE QUESTION** (Q1 IO / Q2 Lawyer / Q3 Judge / Q4 Audit) the LLM internally answers before each paragraph.
- ✅ **6 practical consequences**: Legal Accuracy, Evidence Clarity, Zero Contradictions, Proper Legal Language, Logical Narrative Flow, Complete Evidence Chain.
- ✅ **FINAL CHECK with 8 [✓] ticks** the LLM must mentally verify before emitting JSON. "Would this pass the magistrate's first reading?" is the gating question.
- ✅ Same Triple-Mindset framing mirrored into `charge_sheet_verifier.REVIEWER_SYSTEM_PROMPT` so the senior-reviewer pass also acts as the magistrate doing a final read.

**Part B — Step 0.5 Part-II Statements Auto-Detect:**
- ✅ **NEW `services/part2_prefill_extractor.py`** (4875-char prompt) — focused gpt-4o call (temp 0.0, max 800 tokens) that lifts only 5 fields from the Part-II / endorsement PDF: `io_name`, `io_rank`, `sections`, `second_io_name`, `second_io_rank`. BNSS/CrPC/IPC/BNS/POCSO-aware (preserves act suffixes verbatim, never auto-translates between codes).
- ✅ **NEW `POST /api/staging/part2-prefill`** endpoint — mirrors `/fir-prefill` contract (auth, 20 MB cap, file-type allow-list, async OCR + LLM, tempfile cleanup, structured logging). Returns `{success, fields, confidence, ocr_chars}`.
- ✅ **Frontend Step 0.5 card** sits between Step 0 (FIR upload) and Step 1 (manual form). Clean visual cue: card de-emphasizes when Step 0 hasn't been run yet (tip: "run Step 0 first") and brightens once FIR pre-fill is in.
- ✅ **STRICT OVERWRITE RULE**: `firPrefillSnapshotRef` captures the Step 0 values as the "untouched baseline". On Part-II upload we apply the new value ONLY IF the current form value still equals the snapshot (writer hasn't typed since FIR). If the writer typed even one character → manual edit wins, Part-II's value is shown in the diff but skipped.
- ✅ **Per-field diff visualisation**: each changed field appears as a row with old → new value. Green (`bg-[#00FFB3]/10`) row labelled "Updated from Part-II" for applied fields. Yellow (`bg-[#FFB800]/10`) row labelled "Manual edit kept" for skipped fields. Writer instantly sees `Sections: 115 BNS → 117(2) BNS — Updated from Part-II`.
- ✅ **Dual-IO handling**: when Part-II's `second_io_name` differs from `io_name` (registering officer ≠ filing IO), both are captured. Step 0's IO (registering) becomes `secondIo.name` (will surface as IO 1st in witness table); Part-II's IO (filing) becomes the primary `io_name` (Field 08).
- ✅ **Toast summary**: "Part-II: 3 applied · 1 kept (manual edit wins)" tells the writer exactly what happened.

**Tests (121 passing total, +14 since iteration 22):**
- `test_v6_triple_mindset.py` — 9 tests (3 personas, Q1-Q4 lens block, 6 practical-consequence items, 8 final-check ticks, reviewer triple-mindset, magistrate-first-reading enforcement).
- `test_part2_prefill_extractor.py` — 17 unit + 1 live OpenAI test (gated by `RUN_LIVE_PART2_PREFILL=1`, returns K Lal Singh / 117(2) BNS / V. Kumar in 3 seconds).
- `test_part2_prefill_endpoint.py` (testing-agent created) — 7 HTTP-level tests with reportlab-generated Part-II PDF.
- Zero regressions across all existing test suites.

**End-to-end iteration 23**: 121/121 backend (3 skipped gated) + 10/10 frontend contracts. CORE strict-overwrite + dirty-guard scenarios both passed under Playwright.

---

### 2026-06-12: FIR Auto-Prefill (Step 0) + ¶10 LW/A-Tagging (V5.0)

**Part A — FIR Auto-Prefill for Fields 01-08:**
- ✅ **NEW backend service `services/fir_prefill_extractor.py`** — focused LLM call (gpt-4o, temp 0.0, max 1200 tokens) that lifts 12 high-confidence header fields off a single FIR file: district, police_station, fir_number, fir_date, chargesheet_no (rare on FIR), sections, report_type (default "Charge Sheet"), chargesheet_type (default "Original"), io_name, io_rank, second_io_name, second_io_rank. Each field carries a confidence colour (green/yellow/empty). Graceful degradation: short OCR → blank payload; LLM exception → blank payload + _error message.
- ✅ **NEW endpoint `POST /api/staging/fir-prefill`** — accepts a single PDF/PNG/JPG/WEBP/HEIC/TIF up to 20 MB, OCRs via `extract_text_from_staged_file`, calls the extractor, returns `{success, fields:{...12 keys}, confidence:{...}, ocr_chars}`. Stateless (no MongoDB writes). Robust error handling: unauth→401, no file→400, bad type→400, oversized→400, empty→400, short OCR→success=false with error message.
- ✅ **Frontend Step 0 card** (`ChargeSheetFusion.js` lines ~558-660) — sits above the manual-input-form. Single "Upload FIR & auto-fill" button (`fir-prefill-upload-btn`) triggers a hidden file input (`fir-prefill-file-input`). After successful prefill: 8 manual-form inputs auto-populate, fields the LLM was uncertain about get a **yellow border** (`border-[#FFB800]/70 ring-1 ring-[#FFB800]/40`), a summary block shows filename + ocr_chars + yellow count + "Second IO detected: ..." (if applicable) + the explainer "Fields 03 / 13 / 14 / 15 are NOT on the FIR — fill manually below." Button label flips to "Re-upload FIR (overwrites fields)". Card de-emphasizes (opacity-60) + button disables when manualFormSubmitted=true.
- ✅ **Critical non-touch guarantee**: Fields 03 (charge sheet date), 14 (dispatched on), 17 (ack copy), and 13 (court name) are **NEVER** auto-filled by the prefill flow. They remain writer-controlled (court is the datalist combo shipped in iteration 21, dates are HTML5 date pickers).
- ✅ **Prompt-level safety** — FIR_PREFILL_SYSTEM_PROMPT explicitly says "NEVER invent dates", "NEVER auto-fill today's date", "NEVER derive chargesheet_no from BNS section numbers / Crime Number digits / ages / other numeric strings — only an explicitly-labelled CS field qualifies".

**Part B — Brief Facts ¶10 must tag every person with LW/A number + role (V5.0):**
- ✅ `intelligent_charge_sheet.SYSTEM_PROMPT` ¶10 was rewritten to enforce the tag-and-role pattern for every person in the conclusion paragraph:
  - Complainant only → "LW-1 \<name\> is the complainant"
  - Complainant + injured → "LW-1 \<name\> is the complainant and the injured party"
  - Injured eyewitness → "LW-\<n\> \<name\> is an eyewitness and injured"
  - Pure eyewitness → "LW-\<n\> \<name\> is an eyewitness to the incident"
  - Multiple eyewitnesses → "LWs \<a\> to \<b\> are eyewitnesses"
  - Single panch → "LW-\<n\> \<name\> is a panch witness"
  - Multiple panch → "LWs \<a\> and \<b\> are panch witnesses"
  - Doctor → "LW-\<n\> Dr. \<name\> is the medical officer who issued the wound certificate"
  - IOs → "LW-\<n\> \<rank+name\> is the first/filing Investigating Officer"
  - Accused → "The accused A1 \<name\> \<specific act\>..." for every accused (never stop at A1/A2)
- ✅ Reference example from case 100/2025 included verbatim in the prompt. Explicit FORBIDDEN list at the end.
- ✅ R2 strengthened to V5.0: "Plain names ('Jangiti Aruna abused...') are FORBIDDEN".
- ✅ Verifier check **C13_para10_missing_lw_a_tags** added — flags any plain name in the last 2-3 paragraphs and auto-rewrites to "LW-X \<name\>, the \<role\>, ...". Audit count is now THIRTEEN MANDATORY AUDIT CHECKS.

**Tests added (88 passing total):**
- `tests/test_para10_lw_a_tagging.py` — 7 prompt-content + verifier-content tests.
- `tests/test_fir_prefill_extractor.py` — 13 unit tests + 1 live OpenAI test (gated by `RUN_LIVE_FIR_PREFILL=1`, returns all 12 fields correctly in 4s).
- `tests/test_fir_prefill_endpoint.py` (testing-agent created) — 7 HTTP-level tests covering auth, file-type allow-list, 20MB size cap, empty file, happy-path schema, OCR round-trip with reportlab-generated FIR PDF.
- Zero regressions across all existing test suites.

**End-to-end iteration 22**: 100% backend (88/88 + 2 skipped gated tests) + 100% frontend (10/10 exercised UI contracts).

---

### 2026-06-11: Writer-Feedback Corrections (9 items) — Phases 1 + 2 + 3 (Option A)
Detailed input from an actual Telangana police-station writer triggered a 3-phase upgrade.

**Phase 1 — Backend prompts + 12 audit checks (was 9):**
- ✅ **Item 2 — CDF back-side panch witnesses**: `intelligent_charge_sheet.SYSTEM_PROMPT` now has a CDF DETECTION RULE that requires TWO conditions — page heading "Crime Detail Form" / "CDF" AND a structured 2-3 person list with name+father+age+address. Passing mentions of "CDF" inside FIR / statements / chargesheet body are explicitly excluded.
- ✅ **Item 3 — Witness source map**: prompt now maps LW-1+statement witnesses → S.180 statements, panch → CDF back side, doctor → medical certificate, IO 1st + filing IO → always last two LWs regardless of physical presence.
- ✅ **Item 4 — Endorsement in Brief Facts ¶3**: ¶3 was rewritten to two sentences: (1) registration "LW-<SHO> registered Cr.No.<X>/<year> U/s <FIR sections>", (2) endorsement "The said case was endorsed to LW-<IO>, <rank+name>, <PS> Police Station, for further investigation U/s <final sections>". Verifier check **C10_endorsement_missing** flags drafts that skip sentence 2.
- ✅ **Item 5 — Confession-cum-seizure for theft**: Field 10 source priority now lists (a) F-91 / confession-cum-seizure PDF, (b) CDF back-side seizure column, (c) inline mahazar. Verifier check **C12_theft_property_empty** flags theft cases (BNS 303-309) with empty property.
- ✅ **Item 6 — Inquest / Sec 194 BNSS**: new **RULE 5B** auto-detects `is_inquest_case=true` from sections (194/174/103/105) or explicit override. Panch role becomes "Panch for inquest". Verifier check **C11_inquest_panch_false_flag** removes false "missing statement" flags for inquest panchas.
- ✅ **Item 7 — Sections can change between FIR and chargesheet**: RULE 4 now explicitly allows this — Field 04 uses manual-input final sections; ¶3 quotes FIR sections in registration sentence and final sections in endorsement sentence; ¶10 uses final sections. Never auto-rewrite either.
- ✅ **Item 9 — Sureties / convictions / absconding (11 b/c/d)**: verifier now has a **C-SKIP** rule — these fields default to "--" and must NOT be flagged red/yellow.
- ✅ JSON schema additions: `endorsing_officer`, `is_inquest_case`, `is_theft_case`. User-prompt now forwards `is_death_case` + `is_theft_case_override` from manual input.

**Phase 2 — Manual form UX (Item 1 + Item 5):**
- ✅ **Court name combo with autocomplete + saved courts**: Field 13 is now a free-text Input with HTML5 `<datalist>` autocomplete. Seeded with 4 default courts (Makthal JFCM / Narayanpet JFCM / Mahabubnagar JFCM / Mahabubnagar Sessions). A "+ Save" button persists new courts to `localStorage.np_saved_courts` so future cases auto-suggest them.
- ✅ **Death/Inquest case checkbox**: New `manual-is-death-case` checkbox under Field 13 with explainer "Sec. 194 BNSS / 174 CrPC / 103 / 105 BNS — Panch witnesses will be labelled 'Panch for inquest' and won't be flagged for missing statements." Wired through `POST /staging/create-case` → `metadata.manual_input.is_death_case` → `raw_data` to LLM.

**Phase 3 — Careful / Fast mode (Item 8, Option A "Pause before render"):**
- ✅ **Fast / Careful toggle** in the Station-Writer Intelligent Charge Sheet card. Fast (default) auto-downloads; Careful pauses after generation and opens a Review & Edit modal. State persists to `localStorage.np_gen_mode`.
- ✅ **ReviewAndEditModal** (`ChargeSheetFusion.js` lines 1308-1683) — a full editable form with: sections, court, FIR #, FIR date, IO name+rank, complainant (6 fields), every accused (7 fields each), every witness (4 fields each, official rows auto-locked), and brief_facts textarea. Patch-based state (snapshot stays immutable) keyed to remount cleanly between generations. Diff computed against snapshot at save time.
- ✅ **NEW backend endpoint `POST /api/staging/apply-edits/{case_id}`** — the "cheap path" that:
  - Loads the saved `structured_data`.
  - Applies each edit by dot-path via `_set_by_path` (supports `accused[0].phone`, `complainant.caste`, etc.).
  - Cascades old→new value through `brief_facts` via simple string replace (no LLM, guarded by `len(old) >= 2 AND old != new AND old in bf`).
  - Re-renders the DOCX via `render_authentic_charge_sheet`.
  - Persists updated structured_data + corrections_applied entries to MongoDB.
  - Returns DOCX with `X-Cost: 0-credits-no-llm` header.
- ✅ **Backlog ticket created**: Upgrade to Option B (full two-phase split with separate `extract-only` and `render-only` endpoints) when paying-station volume makes credit cost a real factor.

**Tests (72 passing):**
- `tests/test_writer_feedback_corrections.py` — 20 prompt-content + verifier tests for items 2/3/4/5/6/7/9 + CDF detection rule + JSON schema additions.
- `tests/test_apply_edits_cheap_path.py` — 13 unit tests for `_set_by_path` (nested dict/list paths, malformed paths, out-of-bounds indices) + brief-facts cascade behaviour (length threshold, no-op on missing old, multi-edit chain).
- `tests/test_apply_edits_e2e.py` — 4 live E2E tests (created by testing agent) hitting `POST /staging/apply-edits` + `POST /staging/create-case` with is_death_case=true.
- All existing test files (`test_charge_sheet_verifier`, `test_v4_agnostic_extraction`, `test_layer3_review_banner`, `test_v3_subdocs`) — 38 tests — still pass with zero regressions.

**End-to-end testing-agent iteration 21**: 100% backend (72/72 active tests) + 100% frontend (4/4 contracts).

---

### 2026-06-10: 3-Layer Self-Verifying Architecture — Layer 1 + Layer 2 UI + Layer 3 DOCX Banner
- ✅ **Layer 1 — Senior-Reviewer LLM (`charge_sheet_verifier.py`)**: A second OpenAI gpt-4o call audits the primary "Master IO" draft against 9 high-impact failure modes (C1 dual-listed person, C2 injury gravity, C3 duplicate phone, C4 non-independent panch, C5 identical start/end time, C6 IO as LW-1, C7 LW mentioned but missing, C8 duplicate paragraphs, C9 injuries wrong person), auto-applies fixes, and returns: corrected JSON + `quality_review` (completion %, fixes, items to verify, audit grid, overall_status) + `field_confidence` (per-field green/yellow/red colour map). Wired into the async ICGS background task (`_process_icgs_background` in `staged_upload.py`) between the primary LLM call and the renderer. Graceful degradation — if the verifier itself fails, the pipeline continues with the unverified draft + a degraded quality_review block (no crashes).
- ✅ **Layer 2 — Frontend Confidence Flags UI (`QualityReviewPanel` in `ChargeSheetFusion.js`)**: A new panel sits between the orange "Station-Writer Intelligent Charge Sheet" card and the orange "Edit & Regenerate" card. It mirrors the verifier output with:
  - Overall status pill (green ✓ READY TO FILE / amber ! REVIEW NEEDED / red !! OFFICER MUST COMPLETE) + a draft-completeness bar (`quality-completion-pct`)
  - Two info boxes — "N Auto-fixes applied" (green, shows [Cx] tag + reason + before→after diff) and "N Items need officer review" (amber)
  - **Field-by-field confidence grid** with 3 colour-grouped chip lists: 🔴 *Missing — officer must fill*, 🟡 *Verify before filing*, 🟢 *Verified from source docs*. Each chip uses a human label (`accused[0].name` → "Accused A1 — Name", `witnesses[4].caste` → "Witness LW-5 — Caste"). Long lists truncate to 6 with "+N more…" and a Show all / Collapse toggle.
  - 9-Check Audit Summary grid (C1=PASS, C2=FIXED, etc.) — colour-coded pill per check.
  - Defensive: panel is hidden entirely when no quality_review/field_confidence is present (empty-state safe).
  - Comprehensive data-testid coverage: `quality-review-panel`, `quality-overall-status`, `quality-completion-pct`, `autofix-{i}`, `verify-item-{i}`, `confidence-group-{red|yellow|green}`, `confidence-flag-{color}-{path}`, `audit-checks-grid`, `audit-C{1..9}`, `toggle-show-all-confidence`.
- ✅ **Layer 3 — Review Summary banner injected at the TOP of the rendered chargesheet DOCX** (`fixed_layout_renderer._render_review_summary`). The banner is a single boxed cell with status-tinted background (green/amber/red), showing: title pill ("DRAFT QUALITY REPORT — REVIEW NEEDED"), completion %, items-to-verify list, fixes-applied with [Cx] tags, and a one-line "C1=PASS, C2=FIXED, …" audit grid. Skips silently if no quality_review is attached.
- ✅ **DB schema**: `intelligent_chargesheets` now persists `quality_review` (dict) + `field_confidence` (dict) on the same row as `structured_data` so the GET `/staging/intelligent-chargesheet/{case_id}` endpoint returns them for frontend hydration.
- ✅ **Tests added**: 
  - `/app/backend/tests/test_charge_sheet_verifier.py` — 10 unit tests (prompt structure, JSON extraction with markdown fences/prose prefix, graceful degradation on LLM failure / malformed JSON, parsed payload pass-through) + 1 LIVE end-to-end OpenAI test (gated by `RUN_LIVE_VERIFIER=1`) that hit real gpt-4o, returned completion_pct=94, FIXED C2 (simple→grievous fracture), tagged 8 fields as yellow/red.
  - `/app/backend/tests/test_layer3_review_banner.py` — 4 DOCX rendering tests (no-QR no-crash, complete banner content, READY_TO_FILE pill, OFFICER_MUST_COMPLETE pill).
- ✅ **All existing test suites still pass** — 21/21 across V4 agnostic extraction + fixed layout + V3 subdocs. Zero regressions.
- ✅ **End-to-end frontend validation (testing agent iteration 20)**: 10/10 data-testid contracts pass. Panel renders all 9 audit checks, 31 field flags (1R/4Y/26G), 2 autofixes, 4 items-to-verify, completion 78%, status REVIEW_NEEDED. Show-all toggle expands 6→26 green chips. Empty-state correctly hides the panel for cases without a quality_review row.

### 2026-06-10: 3 User-Reported Fixes — Official-Witness Formatting + Multi-Page OCR + Field 11 Table
- ✅ **FIX 1 — Official-witness short format**. Police officers (IO 1st / IO & filed Charge Sheet / SI / ASI / HC / PC / Inspector / Circle Inspector) and Medical Officers (Dr. / Medical Officer / Civil Surgeon / hospital staff) now render with ONLY `salutation + name + rank/designation + station`. Personal fields (S/o, age, caste, occupation, address, phone) are completely omitted — no more `Sri. X, S/o ___, Age: ___, Caste: ___` blanks for officials. New helpers `_is_official_witness()` + `_format_official_witness_block()` in `fixed_layout_renderer.py`; LLM prompt also explicitly instructs to OMIT these keys for official roles.
- ✅ **FIX 2 — Multi-page PDF extraction**. Two issues fixed:
  1. **poppler-utils was missing on this container** (already in `apt-deps.txt` for the deploy pipeline but the dev container didn't have it). Installed `apt-get install poppler-utils tesseract-ocr antiword`. pdf2image now renders all pages.
  2. **PyPDF2-vs-OCR gating rewritten** in `extract_text_from_staged_file()`. The old code returned PyPDF2's text whenever total length was ≥ 80 chars, which missed scanned-page-2 medical certificates (page 1 had typed patient details ≥ 80 chars → OCR skipped → doctor's signature on page 2 lost). New logic: track per-page length, and if ANY page < 40 chars trigger the full Vision OCR fallback, then merge PyPDF2 + OCR page-by-page (keep the longer of the two per page). Verified on `mcs.pdf` — now returns text from all 8 pages including the doctor's name + injury opinion.
- ✅ **FIX 3 — Field 11 table alignment**. Multi-paragraph cell rendering for the accused list:
  - New `_cell_multi_paragraphs()` helper emits a separate `<w:p>` per accused (A1, A2, A3...) with hanging indent so wrapped lines line up under the name, not the "A1." prefix.
  - New `_enable_cell_wrap()` removes any `<w:noWrap>` on the cell + disables `tcFitText` so long addresses wrap cleanly.
  - New `_set_table_fixed_layout()` sets `<w:tblLayout w:type="fixed"/>` on the body table so columns don't auto-resize when one cell has long content.
  - Applied to both Field 11 (accused) cell AND the witness sub-table's name+address cell. Verified visually: 6 accused (A1–A6) each on a clean separate line with proper wrap.
- ✅ **Tests**: 38/38 pass · 2 new tests covering `_is_official_witness` (police + doctor variants) and `_format_official_witness_block` (omits S/o/Age/Caste/Phone blanks for officials, keeps full block for civilians).
- ✅ Fresh sample DOCX: https://legal-fusion-queue.preview.emergentagent.com/test-docs/FIR_100-2025_ChargeSheet_V4_Phase123_Fixes123.docx

### 2026-06-10: V4.0 + Master IO Phase 1 / Phase 2 / Phase 3 prompt
- ✅ **User-mandated Phase 1 / 2 / 3 prompt structure** integrated into the ICGS SYSTEM_PROMPT:
  - **Phase 1 — Complete Document Extraction (mandatory)**: LLM is required to build three internal extraction tables before composing — PEOPLE (with role + cross-document back-fill), EVENTS (every dated event), FACTS (offence + location + injuries + property + vehicles). Then COUNT total persons/witnesses/accused.
  - **Phase 1 Self-Check (mandatory before Phase 2)**: four internal questions — (Q1) IO identified, never LW-1; (Q2) every person in Brief Facts has an LW number; (Q3) accused details extracted fully not halfway; (Q4) every missing date re-checked across all files.
  - **Phase 2 — 7 Universal Rules (case-type agnostic)**: rewrites Section C as RULE 1 (Witness Numbering: LW-1 = ALWAYS complainant), RULE 2 (IO Reference: NEVER LW-1), RULE 3 (Accused Identification with full back-fill), RULE 4 (Offence Classification from BNS sections — never invent "Accident and Injury", look up what each section represents), RULE 5 (Injury Classification: fractures = grievous), RULE 6 (Missing Data — `""` in JSON, never `NOT FOUND IN DOCUMENTS` in narrative; the literal phrase is allowed ONLY in `extraction_report.not_found_fields`), RULE 7 (Internal Consistency — 10-point checklist run before returning).
  - **Phase 3 — Mandatory Verification Report**: `extraction_report` JSON now includes `total_persons_extracted`, `io_identified_as` (with LW number), `lw_consistency_check`, `io_number_consistency_check`, `bns_bnss_correct_usage_check` (all `"PASS"`/`"FAIL"`). LLM must FIX any FAIL before returning.
- ✅ **Verified end-to-end on FIR 100/2025** (post-prompt update):
  ```
  io_identified_as: "LW-8, K Lal Singh"    ← Phase 1 Q1 answered
  lw_consistency_check: "PASS"             ← RULE 7
  io_number_consistency_check: "PASS"      ← RULE 2
  bns_bnss_correct_usage_check: "PASS"     ← RULE 7
  total_persons_extracted: 15
  total_accused: 6, total_witnesses: 9
  not_found_fields: []                     ← cross-reference back-fill worked
  confidence: "High"
  NOT FOUND occurrences in rendered DOCX: 0
  ```
- ✅ Sample available at: https://legal-fusion-queue.preview.emergentagent.com/test-docs/FIR_100-2025_ChargeSheet_V4_Phase123.docx
- ✅ Tests: 36/36 pass · 7 new V4.0-specific tests now also assert the Phase 1/2/3 structure + 10 RULE titles are present in the prompt.

### 2026-06-10: V4.0 — Agnostic Cross-Reference Extraction Layer
- ✅ **STRICT PLACEHOLDER BAN enforced**: V4.0 mandate rewrites the SYSTEM_PROMPT for all three LLM services (`intelligent_charge_sheet.py`, `intelligent_case_diary.py`, `intelligent_remand_report.py`). The literal strings `"NOT FOUND IN DOCUMENTS"`, `"NOT FOUND"`, `"N/A"`, `"—"`, `"?"`, `"TBD"` are now FORBIDDEN in the LLM output. If a field is truly missing across all files, the LLM emits empty string `""` and the renderer prints a short underscore line `____________` (police-form convention).
- ✅ **Unified Data Pool + Cross-Document Field Back-Filling**: explicit prompt rules now instruct the LLM to scan the FULL unified `documents_corpus` for each entity (Accused profile = parentage + age + caste + occupation + address + phone + S.35(3) BNSS dates) by cross-examining FIR + bail papers + panchanama + S.180 BNSS statements + Aadhaar/ID files — not just one source file per field.
- ✅ **Dynamic Witness Compilation**: prompt now iterates every "Statement of..." block in the unified corpus and emits ALL of them as LW-1..LW-N, never truncating at LW-2. Verified end-to-end: 9 witnesses extracted for FIR 100/2025.
- ✅ **Procedural + Medical Extraction**: prompt explicitly links injury findings / medical-officer names by scanning ANY medical requisition / MLC / hospital report in the corpus, and chronologically matches notice issuance dates across panchanama + statement files + arrest memos.
- ✅ **Defensive scrubber `_scrub_v4_placeholders(payload)`** (recursive on dict/list/str) wipes any "NOT FOUND IN DOCUMENTS" / "NOT FOUND" / "[NOT FOUND]" tokens that may leak through despite the prompt. Applied to all 6 LLM-render call sites (3 generate + 3 regenerate endpoints) so the output is provably free of placeholders.
- ✅ **Renderer `BLANK` constant** changed from `"NOT FOUND IN DOCUMENTS"` → `"____________"` (police-form blank line) in `fixed_layout_renderer.py`.
- ✅ **Cache-wipe endpoints**:
  - `POST /api/staging/wipe-extraction-cache/{case_id}` (single case)
  - `POST /api/staging/wipe-extraction-cache` (all cases owned by the calling officer)
  Both clear `intelligent_chargesheets` + `intelligent_case_diaries` + `intelligent_remand_reports` + `document_cache` collections + on-disk DOCX files in the case folder. Forces a fresh V4.0 LLM run on the next Generate.
- ✅ **Verified end-to-end** against FIR 100/2025: wiped cache → re-ran all 3 V4.0 generators → counted `"NOT FOUND"` occurrences in each rendered DOCX → **ALL THREE FILES = 0 occurrences**. The remaining `____________` blanks are exactly the fields genuinely missing from every source file (LW-3 phone, doctor's personal address, IO's caste — none of these exist anywhere in the 23 uploaded files).
- ✅ **Tests**: 7/7 new in `/app/backend/tests/test_v4_agnostic_extraction.py` (scrubber recursion + non-string preservation + empty inputs + BLANK constant + V4.0 rules present in all 3 prompts). **36/36 total** across V4 + V3 + fixed-layout + narration suites, **zero regressions**.

### 2026-06-10: V3.0 Master IO treatment for Case Diary Part-I + Remand Report + CCTNS Autofill
- ✅ **HOTFIX (user-reported)**: Auto-resume was locking the user into the previous case with no escape. Added two "+ Start New Case" buttons:
  - Prominent **orange pill** at the top of the Triple Fusion Complete card (right side)
  - Compact **+ NEW CASE** badge next to the "🟢 LOCKED" indicator on the manual-input form header
  Both clear `localStorage.np_active_case_id`, reset all 15 manual fields + fusion state, and unlock the form so a fresh FIR can be typed. Verified end-to-end via screenshot: clicking the button transitions the page from "FIR 100/2025 + Locked" → "Ready to Generate + editable form" with a success toast.
- ✅ **HOTFIX (user-reported via 2nd video — "first it generated only once, now again shows this error")**: Intelligent Charge Sheet endpoint converted to ASYNC background-job pattern (same proven pattern as Triple Fusion). Root cause was the K8s ingress 60s timeout — 23-file cases were taking 40-70s. Backend completed but Cloudflare killed the connection, frontend saw HTTP 502 + showed "Intelligent generation failed". Now:
  - `POST /staging/generate-intelligent-charge-sheet/{case_id}` returns in <1s with `{status:'processing', stage, progress}`. Heavy work runs in `asyncio.create_task(_process_icgs_background(...))`.
  - Background task saves the rendered DOCX to `staging/{officer}/{case}/intelligent_charge_sheet.docx` and updates `intelligent_chargesheets.{status, stage, progress, error}` as it advances (queued → llm_composing 35% → rendering_docx 85% → completed 100%).
  - Frontend `downloadSmartChargeSheet` now polls `GET /staging/intelligent-chargesheet/{case_id}` every 5s, then on `status=='completed'` GETs the new `/staging/intelligent-chargesheet/{case_id}/download` endpoint to stream the saved DOCX.
  - Verified end-to-end via public Cloudflare ingress for FIR 100/2025: POST in 700ms, 5 polls × 5s = 25s wait, then HTTP/2 200 download in <1s. Zero 502s.
- ✅ **UI fix (user-reported via 1st video)**: Edit & Regenerate panel moved to RIGHT AFTER the Charge Sheet card (was below CCTNS — required scrolling past 3 cards). Now first thing visible once the chargesheet is generated. (`/app/frontend/src/pages/ChargeSheetFusion.js`)
- ✅ **UI fix (user-reported via video)**: webpack-dev-server runtime-error overlay disabled in `craco.config.js` (was hiding the entire UI on mobile when any cross-origin "Script error" fired). Real errors still hit `window.onerror` + browser devtools console.
- ✅ **UI fix (user-reported via video)**: Active case auto-resumes on page reload. `localStorage.np_active_case_id` is persisted whenever a case is opened; on mount, `ChargeSheetFusion` re-fetches `/staging/fusion/{case_id}` + `/staging/case/{case_id}` and re-hydrates the 15-field manual input form + fusion status + extraction summary. A toast tells the user "Resumed case X — Edit & Regenerate is ready below." `FusionCompletedView` auto-detects whether a Case Diary / Remand Report has been generated for the resumed case (parallel GET requests) so the Edit & Regen panel's "Case Diary Part-I" + "Remand Report" tabs are enabled instantly.
- ✅ Created `services/intelligent_remand_report.py` (NEW) — V3.0 Master IO persona for the formal remand letter (10 numbered fields + Brief Facts + Investigation Done So Far + Grounds of Arrest + standard prayer + enclosures + escort). Output maps to `fixed_layout_renderer.render_remand_report`
- ✅ New endpoints:
  - `POST /api/staging/generate-intelligent-case-diary/{case_id}` — 2 credits (rewrites the old endpoint that was using legacy renderer)
  - `POST /api/staging/regenerate-case-diary/{case_id}` — 0 credits, cascading corrections
  - `GET /api/staging/intelligent-case-diary/{case_id}` — metadata + structured_data
  - `POST /api/staging/generate-intelligent-remand-report/{case_id}` — 2 credits
  - `POST /api/staging/regenerate-remand-report/{case_id}` — 0 credits
  - `GET /api/staging/intelligent-remand-report/{case_id}` — metadata + structured_data
  - `GET /api/staging/cctns-autofill/{case_id}` — flat JSON for CCTNS portal
- ✅ Helper `_assemble_subdoc_raw_data()` re-uses the same OCR-corpus assembly + manual_input override pattern as ICGS
- ✅ Adapter helpers `_adapt_case_diary_for_fixed_layout()` + `_adapt_remand_for_fixed_layout()` translate V3.0 LLM JSON → fixed_layout_renderer schema
- ✅ **Regenerate FAST-PATH**: regenerate-* endpoints now trim documents_corpus to 8K chars since the LLM has the full previous_payload as ground truth. Brings regenerate calls from ~75s to ~22s (verified end-to-end via public Cloudflare ingress — HTTP/2 200 in 20.5s, was previously hitting the 60s timeout)
- ✅ Frontend `ChargeSheetFusion.js`:
  - New "Generate Remand Report" button (orange) — disabled until charge sheet is generated
  - New "CCTNS Autofill JSON" card with "Copy JSON to Clipboard" + "Download .json" buttons
  - `EditAndRegeneratePanel` extended with doc-type tabs (Charge Sheet / Case Diary / Remand Report) — picks the correct backend endpoint based on selection
  - Field-options dropdowns are per-doc-type so corrections make sense for each layout
- ✅ E2E verified against FIR 100/2025 (Makthal PS, Jingiti Aruna case):
  - Charge Sheet: 6 accused, 9 witnesses (LW-1 to LW-9), Brief Facts ¶1 mentions "Wrongful Restraint, Criminal Intimidation, and Simple Hurt" + 23.04.2025 + 12:30 + Yellammakunta, ¶2 includes full FIR narrative (death ceremony of Chinna Thayappa, sister-in-laws, hands+stones, throat, Neerati Narasimha intervening), medical paragraph mentions "Dr. A. Mahesh Raj, CAS, CHC Makthal" with "simple in nature" verbatim, IO Field 08 = "Sri. K. Lal Singh, HC 248, PS Makthal", court header = "AT MAKTHAL", S/o vs W/o correctly assigned to each accused
  - Case Diary: 7 chronological steps, header strip + 8 fields + brief facts + steps + closing line + signature block all populated correctly
  - Remand Report: 10 fields + 4-section narrative + standard prayer clause + 7 enclosures + escort line, "judicial" remand type
  - CCTNS Autofill: flat JSON with all a1..a6 + lw1..lw9 blocks + complainant block + sections_list array + total_accused/witnesses counts
- ✅ Tests: 12/12 in `/app/backend/tests/test_v3_subdocs.py` (adapter + prompt builders + CCTNS shape + JSON-fence stripping). 29/29 total across V3 + fixed-layout + narration suites with zero regressions. Testing agent ran iteration 19 — 14/14 functional pass

### 2026-05-06: V3.0 Master IO — Charge Sheet
- ✅ Direct OpenAI integration via `llm_compat.py` (bypasses Emergent proxy)
- ✅ 15-field manual input form on frontend, persisted to `metadata.manual_input`
- ✅ Master IO V3.0 system prompt — 11 mandatory Brief Facts paragraphs, "skip missing details gracefully" rule, no S/o W/o combos, Telugu name order preserved, sections sub-numbers preserved
- ✅ `_adapt_llm_schema_to_fixed_layout()` translates LLM JSON → fixed_layout_renderer 18-section Telangana template
- ✅ V3.0 Phase-1 RE-LOCK applies manual values verbatim after LLM call (LLM cannot drift court name, IO, sections, etc.)
- ✅ Edit & Regenerate panel (Section G) — pick a field, type a correction, AI cascades the fix through all dependent paragraphs

### 2026-04-27: Narration Generator ("Wing 1")
- ✅ Curated 113-phrase KEYWORD_BANK across 10 station-writer categories
- ✅ Deterministic stitcher (no LLM) joins selected phrases with FIR/PS/IO/complainant intro and accused+sections outro
- ✅ Frontend `/narration-generator` 3-column page with click-to-toggle, reorder, copy-to-clipboard

### 2026-04-27: Encrypted Translation/Petition Cache (At-Rest Encryption)
- ✅ Petition/complaint translation + entity-extraction results cached in MongoDB `document_cache` collection are now **encrypted at rest** with AES-128-CBC + HMAC-SHA256 (Fernet)
- ✅ Per-record DEK derived via HKDF-SHA256 from a master `CACHE_ENCRYPTION_KEY`
- ✅ `cache_crypto.py` + updated `document_cache.py`; tampered ciphertext fails HMAC = cache miss
- ✅ Admin Dashboard exposes encryption status; 6/6 tests pass

### 2026-04-19: Triple Fusion — DB-Backed Async Job Queue (P0 FIX) — RESOLVED
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

### 2026-04-27: Fixed-Layout DOCX Generation — REWRITTEN to match real Telangana samples
**Initial release** (2026-04-27):
- Service `/app/backend/services/fixed_layout_renderer.py` — strict deterministic templates for Charge Sheet, Case Diary Part-I, Remand Report
- Endpoint `GET /api/staging/render-fixed/{doc_type}/{case_id}` — auth-required, returns DOCX directly, 0 credits
- Frontend `ChargeSheetFusion.js` wired in idle and completed views

**REWRITE** (2026-04-27 — same day, after user feedback):
- ❌ User feedback: "Three layer fusion is completely wrong... layout should be fixed and wen I upload details you should fill the details and generate the exact human made doc"
- ✅ Re-extracted EXACT layouts from user's real samples (`57-26 Chargesheet.pdf`, `57-26 CD 1.pdf`, `236 remand.pdf`) via `extract_file_tool`
- ✅ Charge sheet now reproduces the authentic Telangana Form-VII layout:
  - Title: "CHARGE-SHEET" + "(UNDER SECTION 193 BNSS.)" + "IN THE COURT OF JUDICIAL FIRST CLASS MAGISTRATE AT MAKTHAL"
  - 18-numbered-row 2-column table (1. Dist/PS/FIR/Date strip, 2-13 fields, 14-16 brief facts paragraphs, 17-18 ack/dispatch)
  - Person blocks formatted in station style: "Sri. <Name> S/o <Father>, Age: N years, Caste: X, Occ: Y, R/o <Address>, Ph.<phone>, Aadhaar: 1234 5678 9012"
  - Witness sub-table: LW-#, Name & Address, Role columns
  - "Hence charge sheet." + "Submitting charge-sheet." signature block
- ✅ Case Diary Part-I now reproduces the authentic format:
  - Header strip: PS, Dist, F.I.R No., Date/Time/Place of occurrence, CD Dt., Offence U/s
  - 8 numbered fields (1. Date and time of report ... 8. Witnesses examined)
  - Brief Facts + Steps Taken paragraphs
  - "Closed the CD for the day; further progress follows." + "Copy submitted to the SDPO ... f.f.i."
- ✅ Remand Case Diary now reproduces the authentic letter format:
  - "REMAND CASE DIARY" + "Part-I" + "IN THE COURT OF JUDICIAL MAGISTRATE OF FIRST CLASS AT [DIST]"
  - "Honoured Sir," opener
  - 10 numbered fields + Brief Facts + Investigation Done So Far + "Reasons for arrest:"
  - "Hence the remand report." + verbatim prayer clause "The arrested accused person(s) A1 to AN herewith produced before the Hon'ble Court under proper escort with a pray to send {them|him/her} for {police|judicial} remand custody as the court deems fit."
  - Encl: list + Escort: line
- ✅ Aadhaar auto-extraction improved:
  - `_AADHAAR_NAME_BLOCKLIST` filters out OCR header garbage like "Government Of India" / "Unique Identification Authority of India" so they don't get picked as the accused's name
  - Extracted aadhaar_number is now displayed in the A1 person block as "Aadhaar: 1234 5678 9012" (formatted with spaces for readability)
  - DOB stored separately (no longer poisoning the Age cell)
- ✅ Tests: `test_fixed_layout.py` 6/6 unit tests pass with new layout-string assertions; `test_fixed_layout_endpoint.py` 8/8 integration tests pass; end-to-end Aadhaar flow verified manually (number + name appear in rendered DOCX, header garbage absent)

### 2026-04-27: Narration Generator — "Wing 1" Tool (NEW)
- ✅ User reported: "I don't see a narrative generator tool anywhere"
- ✅ Backend service `/app/backend/services/narration_generator.py`:
  - Curated `KEYWORD_BANK` with 113 station-style phrases across 10 categories: Offence Registration, Scene of Offence, Witness Examination, Medical Examination, Accused Handling, Property/Recovery, Investigation Steps, Brief Facts Phrases, Section-Specific Phrases (BNS), Closing Phrases
  - `compose_narration()` deterministic stitcher (NO LLM) that joins selected phrases with a station-style intro (FIR/PS/IO/complainant) and outro (accused names, sections)
- ✅ Backend router `/app/backend/routers/narration.py` (under `/api/narration`):
  - `GET /categories` — returns 10 categories + total count
  - `GET /keywords?category=&q=` — filterable keyword list
  - `POST /compose` — returns `{narration, word_count}`
  - All endpoints auth-required (HTTPBearer JWT)
- ✅ Frontend page `/app/frontend/src/pages/NarrationGenerator.js`:
  - 3-column desktop grid: search + categories (left) | phrase library (middle) | selected phrases + compose + output (right)
  - Real-time keyword filter (case-insensitive, debounced 200ms)
  - Click-to-toggle phrase selection with up/down reordering and remove
  - Optional case-meta panel (FIR/PS/IO/Complainant/Accused/Sections/Occurrence/Custom intro)
  - Composed narration shown in editable Textarea with Copy-to-clipboard button
- ✅ Sidebar nav item with `PenTool` icon + NEW badge, route `/narration-generator` (Layout component AND homepage Dashboard Command Center)
- ✅ Backend tests: 9/9 in `/app/backend/tests/test_narration.py` (auth, categories, keyword search, compose, accused-names join, no-LLM determinism)

### 2026-04-27 (REWRITE-2 — section-by-section verbatim match)
- ❌ User: "The charge sheet layout must follow exactly 18 fixed points/sections as per the sample file I uploaded (156.2025...CS.docx and 13.2025...CS.docx). Open that samples, identify all 18 sections, and hard-code them as fixed template placeholders."
- ✅ Downloaded both reference DOCX files to `/app/backend/reference_samples/`, parsed every paragraph and table cell with python-docx
- ✅ Identified the EXACT 18 sections + sub-rows + verbatim phrasing:
  - 01 Dist/PS/FIR/Date (compound row), 02 Charge Sheet No., 03 Date of Charge, 04 Act and Section of Law, 05 Type of the final report, 06 If final report is un-occurred, 07 If charge sheet is original or supplementary., 08 Name and rank of the I.O (s), 09 Name and Address of the complainant or informant, 10 Details of property seized during the course of investigation., 11 Particulars of accused persons charge sheeted (+a/b/c/d sub-rows), 12 Particulars of the accused persons not charge sheeted, 13 Particulars of witnesses to be examined: - Noted Below (heading + sub-table), 14 If F.R. is false, indicate action taken or proposed to be taken U/S 217/238 BNS, 15 Result of Laboratory Analysis, 16 Brief facts of the case (heading + "Honoured Sir," narrative), 17 Is ack. copy of notice to complainant is enclosed, 18 Dispatched on
- ✅ Fully rewrote `render_charge_sheet()` in `fixed_layout_renderer.py`:
  - Title now reads `C H A R G E – S H E E T` (spaced, matches sample byte-for-byte)
  - 5-column body table (Sno | Field name | : | Value | Value-merge)
  - Witness sub-table 4 columns (LW-N | Name & Address | : | Role)
  - Second table for 14/15/16 (3 cols)
  - Narrative paragraphs prefixed with "Honoured Sir,"
  - Closer: "Hence the charge sheet." (note: "the" added per sample)
  - Signature: "Submitting chargesheet" (one word, per sample) → IO name → rank → "PS <X>."
- ✅ Aadhaar from real PDF (`57-26 A1 Adhaar.pdf`) verified to extract:
  - Name "Poojari Nandakishor Subhash" (correctly skips "Government of India" / "Unique Identification Authority of India" headers)
  - Number "6958 8624 3728" (formatted with spaces)
  - DOB stored separately, MALE gender detected
- ✅ Three alias endpoints added in `staged_upload.py` (1-to-1 mapping for clearer URLs):
  - `GET /api/staging/generate-fixed-charge-sheet/{case_id}`
  - `GET /api/staging/generate-fixed-case-diary/{case_id}`
  - `GET /api/staging/generate-fixed-remand/{case_id}`
  - Plus the original unified endpoint `GET /api/staging/render-fixed/{doc_type}/{case_id}`
- ✅ Unit tests `test_fixed_layout.py` (6/6) updated to assert verbatim sample strings: "C H A R G E – S H E E T", all 18 section labels, "Hence the charge sheet.", "Submitting chargesheet"
- ✅ Section-by-section verification: rendered DOCX (39,560 bytes) contains all **29 mandatory section/structural strings**, Aadhaar data populated, no OCR header garbage leaked
- ✅ Integration tests 8/8 + narration tests 9/9 still pass

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
