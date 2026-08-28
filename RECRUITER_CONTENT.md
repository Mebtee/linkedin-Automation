# Recruiter Content System — Phases 5A, 5B, 5C, 5D & 5E

Deterministic, evidence-grounded LinkedIn content for recruiters.

## Status

- **5A — Taxonomy & scoring (complete)**: 12 post types, 6 content goals, 8 scoring
  dimensions, deterministic 0–100 scorer, diversity-aware selection.
- **5B — Evidence → content opportunities (complete)**: converts confirmed
  journal / course-material evidence into scored, persisted, deduplicated
  `content_opportunities` rows (owner-scoped RLS).
- **5C — Opportunity → post draft (complete)**: generating a draft from a
  selected opportunity through the **existing** shared generation pipeline. The
  opportunity advances to `generated` only after the post is persisted; nothing
  is approved or published automatically.
- **5D — Deterministic post-quality review (complete, this doc)**: a pure,
  evidence-safe 0–100 review of a generated post against its opportunity
  (recruiter relevance, evidence strength, technical depth, practical
  experience, problem solving, clarity, authenticity, learning & growth), a
  review-panel UI, and an approve-time gate that always re-evaluates
  server-side. `needs_review` asks for explicit confirmation; <55 or a critical
  safety finding blocks approval outright.
- **5E — Dashboard, approval UX & manual LinkedIn publishing (complete, this doc)**:
  a polished `/opportunities` dashboard ("Recommended for You", state-driven
  per-step cards, progress stepper, strategy panel), a Publish dialog on approved
  posts, idempotent `publishPost` with display-safe error mapping, and automatic
  opportunity status sync (`approve → approved`, `publish → published`).
  Publishing is **never automatic** — only the user's explicit action publishes.

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
                                                /posts/[id] editor (draft) ──► approve ──► Publish dialog ──► publishPost (idempotent)
                                                          │                     │                              │
                                                    (quality gate 5D)          ▼                              ▼
                                                        approve ──────► approved                      published + opportunity sync
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
  deterministic evidence-safe opportunity posts/images. Gemini also receives a
  deterministic **content brief** (see Phase 5D) injected into the input.
- `src/app/actions/content-opportunities.ts` — thin "use server" wrappers
  (plain result objects, no tokens / chain-of-thought), incl.
  `generatePostFromOpportunityAction` and `getPostQualityForOpportunityAction`.
- `src/app/actions/generated-posts.ts` — post actions incl. the Phase 5D
  approve gate (`approvePost`), `regenerateOpportunityPost`, and the Phase 5E
  idempotent `publishPost`.
- `src/components/opportunities/` — Phase 5E dashboard: `opportunities-client.tsx`
  (Recommended for You + grouped by status), `opportunity-card.tsx` (per-state
  step card + "Publish" link), `opportunity-generate-card.tsx` (featured selection
  with topic/module badges), `opportunity-progress.tsx` (stepper),
  `recruiter-strategy-panel.tsx`.
- `src/components/posts/publish-dialog.tsx`, `post-preview.tsx` — Publish dialog
  and "Draft — Not Published" badge on approved posts.

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

## Post-quality review (Phase 5D)

### Evaluator (pure & deterministic)

`src/services/recruiter/quality.ts` scores a post on 8 dimensions whose weights sum
to 100:

| Dimension | Weight |
|---|---|
| recruiterRelevance | 20 |
| evidenceStrength | 20 |
| technicalDepth | 15 |
| practicalExperience | 15 |
| problemSolving | 10 |
| clarity | 10 |
| authenticity | 5 |
| learningGrowth | 5 |

It reads ONLY the post text + the enriched `RecruiterPostGenerationContext`
(evidence + journal) — no provider, no tokens, no chain-of-thought. The same
input always produces the same output.

- **Evidence ranking**: `USER_CONFIRMED` → `SUPPORTED_BY_PDF` →
  `INFERRED_FROM_STRUCTURE` → `MISSING`. Evidence strength rises only when the
  post's first-person claims are backed by the matching confirmed field
  (`hasConfirmedEvidence`); `MISSING` evidence never earns the top band.
- **Critical findings** (output `do_not_publish`): a personal achievement claim
  ("I built…") not supported by confirmed evidence; a missing required post
  section. **A critical finding cannot be outvoted by a high total score** —
  the base is floored so the result can never exceed `needs_review`.
- **Non-critical warnings**: e.g. "I mastered…/mastering…" (flagged for tone;
  "expert/expertise" are never flagged). Clarify rules: it handles "model", a
  missing section means "<60 characters in the section", and fuzzy-match detection
  works on "handle"/"first-hand"; "the framework is built this way" is NOT a claim.
- **Never invents**: unknown stop-words / hashtags / sentences are ignored; the
  context's null evidence yields null practical/problem-solving focus.

### Persistence & service

- `recruiter_quality_score int` (check 0..100, nullable) +
  `recruiter_quality_report jsonb` (safe public shape: `score`,
  `recommendation`, `dimensions`, `strengths`, `improvements`, `warnings`,
  `evaluatedAt`) — migration `20260829000000_recruiter_quality.sql`, additive
  only, existing posts stay NULL (evaluated on demand).
- The columns are written ONLY by the server-side
  `annotateGeneratedPostQuality`; they are not part of public create/update
  inputs.
- `src/services/recruiter/quality-service.ts#evaluateRecruiterPostForSavedPost`
  loads the owner-scoped post + opportunity, builds the context (tolerating a
  missing journal / curriculum day with honest null-based scores), recomputes the
  report, persists it, and returns `{ post, report }`.

### Review UI

- `/posts/[id]` server-side evaluates and passes the report to the editor.
- `RecruiterQualityPanel` renders the score, recommendation badge, per-dimension
  bars, and the report's strengths / improvements / warnings (no prompts or
  hidden reasoning).
- `OpportunitySummaryPanel` shows the stored opportunity as recorded in 5B
  (post type, goal, opportunity score, day, status, why-selected); it never
  recomputes the 5B score on screen.
- `opportunity-generate-card` for a `generated`/`approved`/`published`
  opportunity shows the linked post's quality badge + "Open Draft" link.

### Approval gate

`approvePost` **always re-evaluates** (`evaluateRecruiterPostForSavedPost`) so a
tampered stored report can never bypass the gate:

- `strong` / `ready` → approve.
- `needs_review` → approve only after explicit confirmation in the dialog.
- `do_not_publish` → blocked with `QUALITY_GATE_BLOCKED`; the status never changes.

`updatePost` re-evaluates and returns the fresh report; `regenerateOpportunityPost`
re-runs the 5C generator (user-triggered, exempt from the duplicate-return
shortcut) and returns the regenerated post's report.

### Content brief

`buildRecruiterContentBrief(context)` builds a deterministic, evidence-safe brief
injected into the generation input (`PostGenerationInput.recruiterBrief`) and into
the Gemini prompt. It names the strongest confirmed evidence, practical /
problem-solving / growth focus derived from confirmed fields only, a technical
focus from the topic + post-type hashtags, and forbidden claims (never invent
production/outcome claims not present in the evidence; never claim mastery).

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
- `src/services/recruiter/quality.test.ts` — Phase 5D evaluator: determinism,
  bounds, safe report shape, evidence ranking, critical finding
  (do-not-publish) vs supported claims, "framework is built" non-flag, "I
  mastered…" non-critical warning, score-never-overrides-safety, per-dimension
  signals, threshold mapping, approve-gate decisions.
- `src/services/recruiter/quality-service.test.ts` — saved-post evaluation:
  anonymous denial, missing post / non-opportunity post → null, journal/topic
  fallbacks, persistence + failure tolerance.
- `src/services/recruiter/brief.test.ts` — content brief: goal label mapping,
  strongest-evidence naming, learning-only fallback, confirmed-fields-only
  focus, forbidden-claim rules, deterministic technical focus.
- `src/components/{posts/recruiter-quality-panel,posts/opportunity-summary-panel,opportunities/opportunity-generate-card}.test.tsx`
  — Phase 5D UI rendering, gating props, quality badge + Open Draft link.
- `src/app/actions/generated-posts.test.ts` — Phase 5D approve gate: re-eval +
  confirmation approval, `QUALITY_GATE_BLOCKED`, update re-evaluation.
- `src/app/actions/content-opportunities.test.ts` — action wrappers return plain
  results and never throw (incl. `generatePostFromOpportunityAction`).

Gates: `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm build`.

## What Phase 5C explicitly did NOT do

- No LinkedIn OAuth / publishing changes, scheduling, or analytics.
- No new AI providers — exactly one pipeline (Gemini → TemplateFallbackProvider).
- No tokens, secrets, or raw evidence text persisted (references + exact supported
  text only, in-memory; the session never stores chain-of-thought).
- No auto-approval or auto-publish — generation stops at a draft.

## What Phase 5D explicitly did NOT do

- No changes to the generation pipeline's accepted inputs or state machine.
- No AI scoring — the post-quality review is 100% deterministic pure code.
- No hidden reasoning surfaced — the report only carries the safe public shape.
- No new RLS policies (owner-scoped RLS already covers `generated_posts`).
- No auto-publish — approval still requires the existing approve + publish flow.

## Phase 5E — Dashboard, approval UX & manual publishing

### Dashboard (`/opportunities`)

- `selectBestContentOpportunity` (server-side, write-on-GET described in
  `src/app/opportunities/page.tsx`) ranks eligible candidates by stored Phase 5A
  score and advances only the winner to `selected` with a concise
  `selection_reason`.
- The page groups opportunities by state and renders per-state cards — candidate /
  selected (featured "Generate post" card), generated / approved (linked post
  quality badge + Open Draft), published (LinkedIn preview link). A progress
  stepper shows Candidate → Selected → Generated → Published and a strategy panel
  explains the day's recommended focus.
- The `published` opportunity card shows the linked post's LinkedIn preview and a
  "View on LinkedIn" link (when `linkedin_post_id` is set, shown on the editor).
  Opening a published card is fully read-only.

### Publish readiness

The publish-ineligible path is surfaced, never hidden:

- Opportunity cards for `candidate` / `selected` / `generated` / `approved`
  show *why* publishing is not yet reachable (the state chip + per-step card).
- Approved posts on `/posts` expose a "Publish" affordance that opens
  `PublishDialog`; the dialog explains what will be shared and calls
  `publishPost`. There is **no** automatic publication anywhere.

### Idempotent manual publishing

`publishPost` (in `src/app/actions/generated-posts.ts`) validates on the server:
ownership, `approved` status, active non-expired token, `w_member_social` scope,
and **never** double-publishes (already-published posts simply return the stored
result with no API call). The publish-time quality gate is re-checked for
opportunity-backed posts. See [POSTS.md](POSTS.md) for the full ordered list and
display-safe error mapping (`LINKEDIN_TOKEN_INVALID`, `LINKEDIN_TOKEN_EXPIRED`,
`INSUFFICIENT_SCOPE`, `LINKEDIN_RATE_LIMITED`, `LINKEDIN_UNAVAILABLE`,
`LINKEDIN_UNREACHABLE`, `PUBLISH_FAILED`). Only the mapped message is written to
`publish_error`; raw provider responses are never surfaced.

### Opportunity ↔ post sync

`content_opportunities` status advances in lock-step with the post only on
owner-scoped server actions: `approvePost` → `approved`, `publishPost` →
`published`. The post's `status` is the single source of truth; the opportunity
row's status is best-effort, validated against the enforced transition table in
`src/types/content-opportunity.ts`. Deleting an opportunity severs the link
(`ON DELETE SET NULL`) but never un-publishes a post.

## What Phase 5E explicitly did NOT do

- No automatic scheduling or publishing — `publishPost` is only called by the
  user's explicit Publish action.
- No cron/interval changes and no new background jobs.
- No weakened quality/anti-hallucination/RLS/OAuth gates — publish re-checks them.
- No new DB migration: publish state ships on the existing additive columns
  (`linkedin_post_id`, `published_at`, `publish_error` on `generated_posts`).
- No tokens or raw provider errors written to the client or `publish_error`.