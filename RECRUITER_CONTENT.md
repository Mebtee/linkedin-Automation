# Recruiter Content System — Phases 5A, 5B & 5C

Deterministic, evidence-grounded LinkedIn content for recruiters.

## Status

- **5A — Taxonomy & scoring (complete)**: 12 post types, 6 content goals, 8 scoring
  dimensions, deterministic 0–100 scorer, diversity-aware selection.
- **5B — Evidence → content opportunities (complete)**: converts confirmed
  journal / course-material evidence into scored, persisted, deduplicated
  `content_opportunities` rows (owner-scoped RLS).
- **5C — Opportunity → post draft (complete, this doc)**: generating a draft from a
  selected opportunity through the **existing** shared generation pipeline. The
  opportunity advances to `generated` only after the post is persisted; nothing
  is approved or published automatically.

## Anti-hallucination contract (never weakened)

| Evidence | Allowed post types |
|---|---|
| `USER_CONFIRMED` (submitted journal) | any (incl. personal: project, debugging, security, deployment…) |
| `SUPPORTED_BY_PDF` / `INFERRED_FROM_STRUCTURE` (course proposal) | learning only (`TECHNICAL_LESSON`, `LEARNING_MILESTONE`) |
| `MISSING` | nothing |

Personal post types are **only** built from confirmed first-person fields; scanning
"Students will build a REST API" in a PDF never becomes "I built a REST API."

## Pipeline (deterministic through scoring; AI only at generation)

```
journal_daily_learning_entries (submitted) ──┐
                                            ├──► buildContentOpportunities ──► scoreDrafts
course_materials.journal_proposal (unconfirmed)─┘        │  (Phase 5A scorer)
                                                          ▼
                                            content_opportunities (upsert by dedup_key, status=candidate)
                                                          │
                                            selectBestContentOpportunity (stored scores)
                                                          ▼
                                              selected ──► generatePostFromOpportunity
                                                          │           │
                                              generated_posts.opportunity_id ◄┘  (shared pipeline; status=generated)
                                                          │
                                                          ▼
                                                /posts/[id] editor (draft) ──► approve ──► publish
```

Generation is handled by the ONE shared core (`generatePostFromPreparedInput`
in `src/services/ai/generation.ts`); a small Phase 5C adapter builds a
recruiter-aware `PostGenerationInput` from the opportunity and its confirmed
evidence, then delegates. Gemini always runs first; `TemplateFallbackProvider`
is the deterministic fallback and is also used for unit tests.

## Modules

- `src/types/content-opportunity.ts` — taxonomy + `ContentOpportunityRow` +
  status transitions (`ALLOWED_OPPORTUNITY_STATUS_TRANSITIONS`).
- `src/config/recruiter.ts` — weights, goal multipliers, `POST_TYPE_META`, hashtags.
- `src/services/recruiter/scoring.ts` — Phase 5A `computeRecruiterScore`,
  `scoreOpportunities`, `selectStrongestOpportunity`.
- `src/services/recruiter/opportunities.ts` — `buildContentOpportunities`
  (deterministic builder), `scoreDrafts`, `draftToOpportunityInput`.
- `src/services/recruiter/validation.ts` — input/status/evidence validators.
- `src/services/recruiter/persistence.ts` — owner-scoped CRUD; bulk upsert on
  `(profile_id, dedup_key)` with `ignoreDuplicates`.
- `src/services/recruiter/index.ts` — `generateContentOpportunitiesForDay`,
  `generateContentOpportunitiesForCourseMaterial`, `selectBestContentOpportunity`,
  `generatePostFromOpportunity` (Phase 5C adapter).
- `src/services/recruiter/generation.ts` — Phase 5C orchestrator:
  `selectFormatForPostType`, `buildRecruiterPostGenerationContext`,
  `journalRowToContext`, `generatePostFromOpportunity`, error masking.
- `src/services/ai/generation.ts` — shared core `generatePostFromPreparedInput`
  (provider → validation → dedupe → persist; optional `opportunityId`).
- `src/services/ai/providers/gemini.ts` / `fallback.ts` — recruiter-aware
  prompts (audience, opportunity + evidence ground truth, format, hashtags) and
  deterministic evidence-safe opportunity posts/images.
- `src/app/actions/content-opportunities.ts` — thin "use server" wrappers
  (plain result objects, no tokens / chain-of-thought), incl.
  `generatePostFromOpportunityAction`.

## Key behaviors

- **Journal path**: `generateContentOpportunitiesForDay({ dayNumber, goal? })`.
  `confirmed = status ∈ {submitted, used}`.
- **Course-material path**: `generateContentOpportunitiesForCourseMaterial({ courseMaterialId, goal? })`.
  Always `confirmed = false` → learning-only.
- **Idempotence**: identical evidence produces identical drafts + `dedup_key`
  (`sha256(source_type::day::post_type::slug(title))`); upsert skips existing rows.
- **Selection**: `selectBestContentOpportunity()` ranks stored deterministic
  scores via Phase 5A `selectStrongestOpportunity` (eligible only) and advances
  the winner to `selected` with a concise `selection_reason`. It never re-scores
  and never stores chain-of-thought.
- **Diversity**: passing `recentPostTypes`/`recentTopics` into `draftToOpportunityInput`
  feeds Phase 5A's uniqueness dimension (uniqueness never overrides evidence).

## Generator behaviors (Phase 5C)

- **One pipeline**: `generatePostFromOpportunity(opportunityId)` never invents a
  parallel generator — it loads the curriculum day, module, and journal entry via
  the shared loaders, builds a recruiter-aware `PostGenerationInput`, and calls
  `generatePostFromPreparedInput`. The post is persisted with
  `generated_posts.opportunity_id`, and the opportunity advances to `generated`
  **only after persistence succeeds**. Failed generation never changes status.
- **Status gates**: `candidate` / `selected` / `generated` are eligible; `rejected`
  and `approved` / `published` return `OPPORTUNITY_INELIGIBLE`. An already-
  `generated` opportunity with an existing linked post returns the existing row
  (`ok: true, created: false, duplicate: true`) without re-generating.
- **Evidence gate**: personal post types (`POST_TYPE_META[postType].personalExperience`)
  require `USER_CONFIRMED` evidence, else `INSUFFICIENT_EVIDENCE`; learning post
  types work with `SUPPORTED_BY_PDF`. Evidence entries carry the exact journal text
  (`value` = ground truth, null when empty / non-string); the AI is instructed to
  use only that text. PDF-only evidence becomes learning-framing statements, never
  "I built…".
- **Hashtags**: `#FullStackDevelopment` + `#105DaysOfCode` + 1–3 from
  `POST_TYPE_META.hashtagFocus`, capped at `recruiter.hashtags.max` (5).
- **Format mapping**: see `selectFormatForPostType` (e.g. `PROJECT_SHOWCASE` →
  project, `PROBLEM_SOLUTION` → challenge, `TECHNICAL_LESSON` → concept,
  `SECURITY_LESSON` → practical-lesson, `LEARNING_MILESTONE` → reflection).
- **Secret masking**: unexpected / provider errors are masked to a generic message;
  only codes in `GENERATION_ELIGIBLE_ERROR_CODES` keep their messages.
- **No auto-publish**: the generated result is a `draft` post in the `/posts/[id]`
  editor. Approval and publishing still go through the existing flows.

## Tests

- `src/services/recruiter/scoring.test.ts` (Phase 5A)
- `src/services/recruiter/opportunities.test.ts` — confirmed → personal +
  learning; course proposal → learning-only; INFERRED never personal; determinism;
  Phase 5A reuse.
- `src/services/recruiter/persistence.test.ts` — owner-scoped CRUD, status
  transitions, upsert idempotence, anonymous denial, learning-only for proposals,
  stored-score selection.
- `src/services/recruiter/generation.test.ts` — Phase 5C adapter: context
  building, evidence/status gates, duplicate protection, anti-hallucination,
  format mapping, secret masking, TemplateFallbackProvider behavior.
- `src/app/actions/content-opportunities.test.ts` — action wrappers return plain
  results and never throw (incl. `generatePostFromOpportunityAction`).

Gates: `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm build`.

## What Phase 5C explicitly did NOT do

- No LinkedIn OAuth / publishing changes, scheduling, or analytics.
- No new AI providers — exactly one pipeline (Gemini → TemplateFallbackProvider).
- No tokens, secrets, or raw evidence text persisted (references + exact supported
  text only, in-memory; the session never stores chain-of-thought).
- No auto-approval or auto-publish — generation stops at a draft.