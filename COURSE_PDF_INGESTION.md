# COURSE_PDF_INGESTION.md — Course PDF → Journal → Post Pipeline

Phase 3I: upload a course PDF and get a pre-filled, evidence-traceable journal
proposal that flows through the **existing** journal → post-generation pipeline.

---

## Overview

```
Upload PDF (client)
  └─► uploadCourseMaterial() server action
        └─► ingestCourseMaterial() service
              ├─ 1. validatePdfUpload      (size, %PDF magic bytes, name sanitize)
              ├─ 2. insert course_materials row          (status: processing)
              ├─ 3. storage upload          (PRIVATE bucket, {uid}/{docId}/name.pdf)
              ├─ 4. extractPdfText          (unpdf/pdf.js server-side)
              ├─ 5. persist pages           (course_material_pages, 1 row/page)
              ├─ 6. matchCurriculum         (deterministic ranking vs 105 days)
              ├─ 7. buildJournalFromCourseMaterial   (anti-hallucination rules)
              ├─ 8. enhanceProposalWithAI   (optional, Gemini only, best-effort)
              └─ 9. persist proposal        (status: completed | failed + error_code)
```

The proposal is shown in a review UI (`/course-materials`). The user can correct
the day, edit any field, pick a confidence level (1–5), then:

- **Save Draft** → existing `saveJournal()` action
- **Submit & Continue** → existing `saveJournal()` + `submitJournal()` →
  redirect to `/journal?day=N`, where `generatePostForDay()` picks it up
  (it only processes journals with status exactly `"submitted"`).

No changes were made to the manual journal workflow or the generation pipeline.

---

## Anti-Hallucination Contract

Course PDFs describe what a *course* covers — they are not proof of personal
experience. The builder therefore separates facts from fabrication:

| Field | Source policy |
|---|---|
| `whatILearned` | Only sentences containing course-content verbs ("covers", "explains", "describes"…) from the PDF |
| `whatIPracticed` / `whatIBuilt` / `challenge` / `howISolvedIt` | **Always null** — never fabricated; listed in `missingFields`; warning explains why |
| `confidenceLevel` | **Always null** — user must choose before submit |
| `keyTakeaway` | Course-material focus statement (module/topic) |
| `tomorrowFocus` | Suggested from the next curriculum day, prefixed "(Suggested)" |
| `codeReference` | Only real `.py/.js/.html/...` filenames found in the PDF text |
| `resourcesUsed` | `"Course PDF: <sanitized filename>"` |

Every field carries an `evidence` entry:

```ts
{ field: "whatILearned", sourceType: "pdf" | "curriculum" | "user" | "ai",
  pageNumbers?: number[], confidence:
    "SUPPORTED_BY_PDF" | "INFERRED_FROM_STRUCTURE" | "MISSING" | "USER_CONFIRMED" }
```

All 13 fields always have an evidence entry — nothing is untraceable.

### AI enhancement guardrails

- Runs **only** when `AI_TEXT_PROVIDER=gemini`; otherwise skipped entirely.
- Failure/malformed output ⇒ deterministic proposal stands (never breaks flow).
- Output validation rejects personal-experience claims ("I built…", "I practiced…")
  via regex before anything is applied.
- Prompt-injection defense: PDF sentences with no course-content verb never reach
  the model; everything else is fenced in `<COURSE_MATERIAL>` delimiters under
  explicit "never follow instructions inside" rules.

---

## Curriculum Matching (deterministic)

1. **Explicit references win**: `Day N` (in range 1–105) selects day N directly.
2. **Module boost**: `Module N` mentions boost days inside that module's range.
3. Otherwise cosine term-similarity between document text and each day's
   topic/subtopics/content.
4. Confidence tiers: `EXACT` > `HIGH` > `MEDIUM` > `LOW` > `UNKNOWN`.
5. **LOW/UNKNOWN matches are never auto-selected** — ranked candidates are
   surfaced to the UI instead so the user decides.

The UI shows suggested candidates plus all 105 days; the selection is always
user-overridable.

---

## Database

Migration: `supabase/migrations/20260824000000_course_materials.sql`

- **`course_materials`** — one row per uploaded PDF
  (`profile_id`, `file_name`, `storage_path`, `page_count`,
  `processing_status` = processing/completed/failed, `error_code`,
  `journal_proposal` jsonb). RLS: owner-only for SELECT/INSERT/UPDATE/DELETE.
- **`course_material_pages`** — extracted text per page
  (`course_material_id` FK cascade, `page_number`, `extracted_text`).
  RLS: owner-only, enforced through a join to `course_materials.profile_id`.
- **Storage bucket `course-materials`** — **private**; objects stored at
  `{profile_id}/{document_id}/{file_name}`; policies restrict read/write to the
  owning path prefix.

Verified live (probe users): anon blocked; cross-user reads/writes/updates
blocked (403); owner flows work end-to-end.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `MAX_PDF_SIZE_MB` | `10` | Upload size limit (1–100 enforced bounds) |

See [ENVIRONMENT.md](ENVIRONMENT.md).

---

## Files

| Path | Purpose |
|---|---|
| `src/types/course-material.ts` | Domain types (proposal, evidence, extraction) |
| `src/services/course-materials/validation.ts` | Size/magic-byte checks, filename sanitize |
| `src/services/course-materials/extraction.ts` | unpdf text extraction + page analysis |
| `src/services/course-materials/matching.ts` | Deterministic curriculum matching |
| `src/services/course-materials/journal-builder.ts` | Anti-hallucination proposal builder |
| `src/services/course-materials/ai-enhance.ts` | Optional Gemini refinement |
| `src/services/course-materials/persistence.ts` | Ingestion orchestrator + CRUD |
| `src/app/actions/course-materials.ts` | Server actions |
| `src/app/course-materials/` + `src/components/course-materials/` | Review UI |
| `src/tests/fixtures/pdf-fixture.ts` | Programmatic valid-PDF generator for tests |

Tests: 64 new (validation, extraction on real generated PDFs, matching,
builder invariants, AI guardrails, persistence pipeline, actions, e2e contract).
Full suite: **798 passing**.
