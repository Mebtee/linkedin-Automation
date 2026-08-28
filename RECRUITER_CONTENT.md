# Recruiter Content System — Phases 5A & 5B

Deterministic, evidence-grounded LinkedIn content for recruiters.

## Status

- **5A — Taxonomy & scoring (complete)**: 12 post types, 6 content goals, 8 scoring
  dimensions, deterministic 0–100 scorer, diversity-aware selection.
- **5B — Evidence → content opportunities (complete, this doc)**: converts confirmed
  journal / course-material evidence into scored, persisted, deduplicated
  `content_opportunities` rows. **Nothing is generated or published.**
- 5C+ (generation, approval, scheduling, dashboard, CTA, hashtags) are planned.

## Anti-hallucination contract (never weakened)

| Evidence | Allowed post types |
|---|---|
| `USER_CONFIRMED` (submitted journal) | any (incl. personal: project, debugging, security, deployment…) |
| `SUPPORTED_BY_PDF` / `INFERRED_FROM_STRUCTURE` (course proposal) | learning only (`TECHNICAL_LESSON`, `LEARNING_MILESTONE`) |
| `MISSING` | nothing |

Personal post types are **only** built from confirmed first-person fields; scanning
"Students will build a REST API" in a PDF never becomes "I built a REST API."

## Pipeline (all deterministic, zero LLM)

```
journal_daily_learning_entries (submitted) ──┐
                                            ├──► buildContentOpportunities ──► scoreDrafts
course_materials.journal_proposal (unconfirmed)─┘        │  (Phase 5A scorer)
                                                          ▼
                                            content_opportunities (upsert by dedup_key, status=candidate)
                                                          │
                                            selectBestContentOpportunity (stored scores)
                                                          ▼
                                              selected (human review in later phases)
```

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
  `generateContentOpportunitiesForCourseMaterial`, `selectBestContentOpportunity`.
- `src/app/actions/content-opportunities.ts` — thin "use server" wrappers
  (plain result objects, no tokens / chain-of-thought).

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

## Tests

- `src/services/recruiter/scoring.test.ts` (Phase 5A)
- `src/services/recruiter/opportunities.test.ts` — confirmed → personal +
  learning; course proposal → learning-only; INFERRED never personal; determinism;
  Phase 5A reuse.
- `src/services/recruiter/persistence.test.ts` — owner-scoped CRUD, status
  transitions, upsert idempotence, anonymous denial, learning-only for proposals,
  stored-score selection.
- `src/app/actions/content-opportunities.test.ts` — action wrappers return plain
  results and never throw.

Gates: `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm build`.

## What Phase 5B explicitly did NOT do

- No post generation, no AI providers, no publishing, no scheduling changes.
- No changes to journal submission, course-material ingestion, or OAuth.
- No tokens, secrets, or raw evidence text persisted (references only).