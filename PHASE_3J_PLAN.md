# Phase 3J Implementation Plan

## Overview
Improve the existing Phase 3I PDF → Journal → AI Post workflow with better UX,
traceability, duplicate detection, reprocessing, multi-day support, and
comprehensive testing. All existing architecture, anti-hallucination protections,
and pipeline behavior are preserved.

---

## 1. Database Migration

**File:** `supabase/migrations/20260826000000_course_materials_3j.sql`

Add to `course_materials`:
- `content_hash text` — SHA-256 of PDF bytes for duplicate detection
- `multi_day_sections jsonb` — Array of detected day sections (when multi-day detected)
- Index on `content_hash` for fast duplicate lookups

No new tables needed. All existing tables and RLS remain unchanged.

---

## 2. Types

**File:** `src/types/course-material.ts` — extend existing types

- Add `content_hash` to `CourseMaterialRow`
- Add `multi_day_sections` to `CourseMaterialRow`
- Add `MultiDaySection` type: `{ dayNumber: number; startPage: number; endPage: number; confidence: MatchConfidence }`
- Add `ProcessingStage` type for status tracking: `"uploading" | "validating" | "extracting" | "matching" | "building" | "enhancing" | "ready"`
- Keep all existing evidence types unchanged

---

## 3. Service Layer Changes

### 3a. Content Hash — `src/services/course-materials/validation.ts`
- Add `computeContentHash(bytes: Uint8Array): string` — SHA-256 via Web Crypto API

### 3b. Duplicate Detection — `src/services/course-materials/persistence.ts`
- In `ingestCourseMaterial()`: compute hash before processing, check for existing material with same `profile_id` + `content_hash`
- If duplicate found: throw `AppError` with code `PDF_DUPLICATE`
- On completion: store `content_hash` on the record

### 3c. Multi-Day Detection — `src/services/course-materials/matching.ts`
- Add `detectDaySections(doc, structures, source, totalDays)` — scans for explicit "Day N" headers in page headings
- Returns `MultiDaySection[]` with page ranges
- Only uses explicit "Day N" patterns (not topic-based)
- If multiple days detected, returns sections with page boundaries
- If no multi-day patterns found, returns empty array

### 3d. Reprocessing — `src/services/course-materials/persistence.ts`
- Add `reprocessCourseMaterial(documentId: string)` function
- Loads existing material, re-reads extracted pages from DB
- Re-runs curriculum matching and journal building
- Does NOT re-extract PDF (uses stored page text)
- Checks for USER_CONFIRMED fields in existing proposal
- Preserves USER_CONFIRMED fields in regenerated proposal
- Returns new proposal

### 3e. Enhanced Delete — `src/services/course-materials/persistence.ts`
- Improve `deleteOwnCourseMaterial()` to also delete `course_material_pages` rows (CASCADE handles this but verify)
- Verify RLS enforcement (already exists)

### 3f. UI Status Types — `src/types/course-material.ts`
- Add `CourseMaterialUiStatus` type with all display statuses:
  `"uploading" | "validating" | "extracting" | "matching" | "building" | "enhancing" | "ready" | "needs_review" | "failed"`

---

## 4. Server Actions

**File:** `src/app/actions/course-materials.ts`

- Add `listCourseMaterials()` — calls `listOwnCourseMaterials()`, returns safe data (no storage_path)
- Add `reprocessCourseMaterial(documentId: string)` — calls reprocess service
- Add `checkDuplicatePdf(formData: FormData)` — computes hash, checks for duplicate before full upload
- Update `uploadCourseMaterial` to return `processingStatus` for progressive UI updates
- Add `getPageText(documentId: string, pageNumber: number)` — returns extracted text for a page

---

## 5. UI Components

### 5a. Course Materials Dashboard — `src/components/course-materials/course-materials-client.tsx`
Major rewrite of the existing component into a multi-phase UI:

**Phase: Dashboard (idle state)**
- List of uploaded course materials (filename, date, size, page count, status)
- Upload button + drag-and-drop zone
- Each material shows: status badge, matched day, actions (View, Review, Delete, Reprocess)
- Processing status with clear stage messages

**Phase: Upload + Processing**
- Upload progress indicator
- Stage-by-stage status messages:
  - "Uploading PDF…"
  - "Validating file…"
  - "Extracting text…"
  - "Matching curriculum…"
  - "Building journal proposal…"
  - "Enhancing with AI…"
  - "Ready for review"
- Never appears frozen

**Phase: Review (proposal review)**
- Split layout: left panel (metadata + curriculum match + evidence + page preview), right panel (editable journal fields)
- Each field shows: label, proposed value, evidence badge, source info, edit control
- MISSING fields show: "Not found in the course material. Please provide this yourself."
- Evidence panel (expandable) per field: status, source page, reasoning category
- Curriculum matching panel: Day, Module, Topic, Match method, Confidence
- LOW/UNKNOWN confidence: manual day selector, no auto-assignment
- Page preview panel: extracted text per page, navigate between pages
- Warnings section preserved
- Confidence level picker preserved
- Save Draft / Submit buttons preserved
- Generate Post preview after submission

**Phase: Post-Submission Confirmation**
- After successful submit: show confirmation with Day, Topic, Journal summary
- "Generate Post" button that calls existing `generatePostForDay()`
- Uses existing post generation pipeline

### 5b. Evidence Panel Component — `src/components/course-materials/evidence-panel.tsx`
New component:
- Expandable/collapsible per field
- Shows: evidence status badge, source page numbers, source type (pdf/curriculum/user/ai/missing)
- Color-coded: green (SUPPORTED_BY_PDF), blue (INFERRED_FROM_STRUCTURE), amber (USER_CONFIRMED), gray (MISSING)
- No chain-of-thought or hidden reasoning exposed

### 5c. Page Preview Component — `src/components/course-materials/page-preview.tsx`
New component:
- Shows total page count
- Page navigation (prev/next)
- Displays extracted text for selected page
- Highlights page when evidence references it
- Lightweight — no external PDF viewer dependency

### 5d. Curriculum Match Panel — `src/components/course-materials/curriculum-match-panel.tsx`
New component:
- Shows: Day X / 105, Module X — title, Topic, Match method
- Confidence badge
- When LOW/UNKNOWN: "Could not confidently determine the curriculum day" + manual selector
- Manual selection stored as USER_CONFIRMED

---

## 6. Key Implementation Details

### USER_CONFIRMED Priority (§10)
- Enforced in `reprocessCourseMaterial()`: before rebuilding proposal, read existing proposal's evidence entries
- Any field with `confidence: "USER_CONFIRMED"` in existing proposal is preserved in new proposal
- Evidence for preserved fields remains USER_CONFIRMED
- This prevents reprocessing from overwriting user work

### Duplicate Detection (§8)
- `computeContentHash()` uses SHA-256 of raw PDF bytes
- Checked server-side in `ingestCourseMaterial()` before processing
- Duplicate found → throw `AppError("PDF_DUPLICATE")` with message "This course material has already been uploaded."
- UI shows [View Existing] action for duplicates
- No raw hashes exposed in UI

### Multi-Day Detection (§7, §14)
- `detectDaySections()` scans page headings/text for "Day N" patterns
- Returns array of `{ dayNumber, startPage, endPage, confidence }`
- If multiple days found: creates separate proposals per section
- If ambiguous boundaries: asks user to select
- If PDF cannot be confidently split: single-day mode (existing behavior)
- Page-level evidence preserved per section

### Reprocessing (§9)
- Reuses stored extracted pages (no PDF re-read)
- Re-runs curriculum matching and journal building
- Preserves USER_CONFIRMED fields from existing proposal
- Preserves original document record (id, profile_id, storage_path)
- Does not create duplicate records

### Journal Field Priority (§10)
- USER_CONFIRMED > SUPPORTED_BY_PDF > INFERRED_FROM_STRUCTURE > MISSING
- Never overwrite USER_CONFIRMED with PDF/AI/curriculum data
- Enforced in proposal rebuilding and AI enhancement

### Gemini Safety (§11)
- No changes to existing AI enhancement
- Maintains prompt-injection defense
- Maintains personal-claim protection
- Deterministic fallback always valid
- Only enhances whatILearned and keyTakeaway

### Post-Submission Preview (§13)
- After successful journal submission, show confirmation screen
- Display: Day, Topic, Journal summary, Selected post format
- [Generate Post] button calls existing `generatePostForDay()` pipeline
- No second generation implementation created

---

## 7. Test Plan

### New test files:

**`src/services/course-materials/duplicate.test.ts`**
- Content hash computation is deterministic
- Same bytes → same hash
- Different bytes → different hash
- Duplicate detection in ingestion
- Non-duplicate passes through

**`src/services/course-materials/multi-day.test.ts`**
- Single-day PDF returns empty sections
- Multi-day PDF with explicit headers detects sections
- Page ranges are correct
- Ambiguous boundaries return empty (no false splits)
- Explicit "Day N" patterns detected across pages

**`src/services/course-materials/reprocess.test.ts`**
- Reprocessing re-runs matching and building
- USER_CONFIRMED fields are preserved
- Original document record unchanged
- Storage path unchanged
- No duplicate records created

**`src/services/course-materials/field-priority.test.ts`**
- USER_CONFIRMED never overwritten by reprocessing
- SUPPORTED_BY_PDF preserved when no USER_CONFIRMED
- INFERRED_FROM_STRUCTURE preserved
- MISSING fields remain missing after reprocessing

**`src/app/actions/course-materials.test.ts` — extend existing**
- Duplicate upload returns proper error
- Reprocess action works
- List action returns safe data
- Delete removes associated pages

**`src/components/course-materials/*.test.tsx`**
- CourseMaterialsClient renders upload state
- CourseMaterialsClient renders dashboard with materials list
- Evidence panel expands/collapses
- Page preview navigates pages
- Curriculum match panel shows LOW confidence fallback
- Post-submission confirmation shows correctly

### Existing tests that must continue passing:
- `src/services/course-materials/validation.test.ts`
- `src/services/course-materials/extraction.test.ts`
- `src/services/course-materials/matching.test.ts`
- `src/services/course-materials/journal-builder.test.ts`
- `src/services/course-materials/ai-enhance.test.ts`
- `src/services/course-materials/persistence.test.ts`
- `src/tests/course-materials.e2e.test.ts`
- `src/tests/pipeline.e2e.test.ts`

---

## 8. Documentation Updates

- `COURSE_PDF_INGESTION.md` — add duplicate detection, multi-day, reprocessing, evidence statuses
- `DATABASE.md` — document new columns
- `POSTS.md` — document post-submission preview flow

---

## 9. File Change Summary

### Files to Create:
1. `src/services/course-materials/duplicate.test.ts`
2. `src/services/course-materials/multi-day.test.ts`
3. `src/services/course-materials/reprocess.test.ts`
4. `src/services/course-materials/field-priority.test.ts`
5. `src/components/course-materials/evidence-panel.tsx`
6. `src/components/course-materials/evidence-panel.test.tsx`
7. `src/components/course-materials/page-preview.tsx`
8. `src/components/course-materials/page-preview.test.tsx`
9. `src/components/course-materials/curriculum-match-panel.tsx`
10. `src/components/course-materials/curriculum-match-panel.test.tsx`
11. `supabase/migrations/20260826000000_course_materials_3j.sql`

### Files to Modify:
1. `src/types/course-material.ts` — add types
2. `src/services/course-materials/validation.ts` — add hash function
3. `src/services/course-materials/matching.ts` — add multi-day detection
4. `src/services/course-materials/persistence.ts` — add duplicate detection, reprocess
5. `src/services/course-materials/index.ts` — export new functions
6. `src/app/actions/course-materials.ts` — add new actions
7. `src/components/course-materials/course-materials-client.tsx` — major UI rewrite
8. `COURSE_PDF_INGESTION.md` — update docs
9. `DATABASE.md` — update docs
10. `POSTS.md` — update docs

---

## 10. Implementation Order

1. Database migration
2. Types
3. Content hash + duplicate detection service
4. Multi-day detection service
5. Reprocessing service
6. Field priority logic
7. Server actions
8. UI components (evidence panel, page preview, curriculum match panel)
9. Main client component rewrite
10. Tests (all new + regression)
11. Documentation
12. Quality gates (typecheck, lint, build, test)
