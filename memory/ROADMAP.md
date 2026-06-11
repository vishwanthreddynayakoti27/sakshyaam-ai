# Nyaya Prahari — Roadmap

Prioritized backlog. P0 = next session priority. P1 = soon. P2 = nice-to-have.

---

## P0 — Per-Person Upload Architecture ("Accurate Mode")

**Origin**: Writer feedback (2026-06-13). Real problem: when all documents
are uploaded together, the AI sometimes copies one person's phone to others,
misses witnesses, or confuses roles. Per-person upload slots remove the
cross-contamination by giving each person their own extraction context.

**Scope (multi-day, dedicated session):**

### New UI: 6 named upload sections

1. **COMPLAINANT** — One upload slot for the complaint petition.
   Extracts complainant → LW-1 only. Phone/address/caste from THIS file only.

2. **WITNESS STATEMENTS** (dynamic, with `+ Add Witness` button) —
   Each click adds a new slot. Each uploaded statement reads
   independently and becomes LW-2, LW-3, LW-4… in upload order. Each
   extraction is scoped to a single document — never picks up details
   from sibling statements.

3. **PANCH WITNESSES** — One upload slot for the Crime Detail Form
   (CDF). Reads ONLY the back side per the CDF DETECTION RULE
   (already in V4.0 prompt — heading "Crime Detail Form" + structured
   2-3 person list, NOT keyword match). Extracts panches → Scene-of-
   Offence LWs (or "Panch for inquest" if `is_death_case`).

4. **MEDICAL** — One upload slot for the medical / wound certificate.
   Extracts doctor name + injury opinion → Medical Officer LW.

5. **ACCUSED** (dynamic, with `+ Add Accused` button) — Each click
   adds a slot for one accused's notice / Aadhaar / address proof.
   Each read independently → A1, A2, A3… in upload order.

6. **IO / CASE** — One upload slot for the FIR + endorsement page.
   Becomes the Step 0 + Step 0.5 flow folded into one (already shipped).

### New backend endpoints

- `POST /api/staging/extract-person/{role}/{case_id}` — accepts ONE
  document + a role tag (complainant | witness | panch | medical |
  accused | io). Routes to a role-specific prompt (smaller, faster
  than the monolithic SYSTEM_PROMPT). Returns just THAT person's
  extracted data + confidence map.
- Per-person results persist to MongoDB
  `staging_per_person_extractions: { case_id, role, slot_index,
  person_data, confidence, source_file }`. The chargesheet generator
  reads these and assembles them into the final JSON without any
  re-extraction.

### Mode toggle

- **Quick Mode** (default — current bulk-upload + monolithic LLM call,
  unchanged): faster, fewer LLM calls, may mix details for messy uploads.
- **Accurate Mode** (NEW — per-person slots): more LLM calls (one per
  person), tighter accuracy, slower. Writer chooses upfront.

### Extraction rules (per the writer's spec)

- Each uploaded document belongs to ONE person only.
- Extract that person's details only from their own document.
- Never copy phone/address/caste from one slot to another.
- If a detail is missing in THIS person's document, leave it `--`
  — never fill it from another person's data.
- LW / A numbering follows upload order automatically.

### Estimated effort

~2-3 days, broken into:
- Day 1: Backend per-person extractor prompts + endpoint + persistence
  + role-aware role-tag dispatcher in `_process_icgs_background`.
- Day 2: Frontend dynamic slot UI with `+ Add Witness` / `+ Add
  Accused` + Quick/Accurate mode toggle. 6 separately-styled cards.
- Day 3: Testing — unit tests per role + e2e Playwright with multiple
  witnesses + accused.

---

## P1 — Tools the writer already has working but wants improved

- **Revision history dropdown** in the Edit & Regenerate panel
  (rollback applied corrections one step at a time).
- **Inline diff viewer** below the cascade summary in Edit & Regenerate
  (currently only shows the cascade in text — would be clearer as a
  per-paragraph green-additions / red-deletions diff).
- **IMEI Identity Linkage + Location Mapping** enhancements in CDR
  Analyzer (link IMEI ↔ accused identity, plot tower locations on a
  map).
- **Real deepfake detection model integration** for Media Forensic
  (current pipeline returns placeholder confidence; needs an actual
  detection model — explore https://github.com/ondyari/FaceForensics
  or a hosted API).

---

## P2 — Nice-to-have, deferred

- **Upgrade Phase-3 Careful mode → Option B** (full two-phase split
  with separate `extract-only` + `render-only` endpoints; saves LLM
  credits when writers edit a lot). Trigger this when paying-station
  volume makes credit cost a real factor.
- **"Defaults preset" dropdown** on the manual form (e.g., "PS
  Makthal" pre-fills district + station + standard court).
- **Case Timeline visualization** — single-page chronological view
  of every event the chargesheet references.
- **Saved Court Profiles per Station** — lift the `+ Save` localStorage
  list to MongoDB `users.saved_courts` so writers' lists follow them
  across devices.
- **Refactor `ChargeSheetFusion.js`** — currently 3000+ lines after
  Step 0.5. Split into `components/chargesheet/{Step0FirPrefillCard,
  Step05Part2PrefillCard, ManualInputForm, QualityReviewPanel,
  FusionCompletedView, EditAndRegeneratePanel, ReviewAndEditModal}.jsx`.
- **Tighten `chargesheet_no` extraction in FIR pre-fill prompt** to
  forbid derivation from BNS section numbers (carry-over minor from
  iteration 22).
- **Model training for specific legal document formats** — once we
  have ~500 real chargesheets to train on.

---

## Done (latest first)

Tracked in PRD.md "Completed Features" section.
