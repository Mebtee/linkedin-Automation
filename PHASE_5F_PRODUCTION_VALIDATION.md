# Phase 5F — Production Validation & Real-World LinkedIn Recruiter Workflow

> Status per section: **PASS** / **FAIL** / **BLOCKED** / **NOT TESTED**.
> This report contains **no secrets** — only variable NAMES, statuses, and effects.
> Read in conjunction with `DEPLOYMENT.md`, `SECURITY.md`, and `DATABASE.md`.

---

## 1. Production URL

| Item | Value |
|---|---|
| Validated production origin | `https://linkedin-automation-delta-seven.vercel.app` |
| Application identity | `105-day-learning-journey` (matrix: `/api/health`) |
| Result | **PASS** — reachable from this machine (HTTP 200 on `/`, `/login`). |

> Note: confirmed this origin serves this app and its production environment. Whether a
> custom production domain is aliased on top of this `.vercel.app` URL could not be
> confirmed without Vercel API access (see §24 manual actions).

## 2. Deployment commit

| Item | Value |
|---|---|
| Repository HEAD | `698763e` — Phase 5E |
| Working-tree delta | Uncommitted Phase 5F hardening fix (adds `/opportunities` to middleware protected routes) |
| Vercel production effective commit | **Unknown / STALE** — production predates Phase 5C |
| Result | **FAIL (blocker for the recruiter flow)** |

The deployed bundle does **not** contain the recruiter content phases:

- `GET /opportunities` returns a **not-found page** (route exists in the current code but is absent from the deployed bundle), so the production bundle predates Phase 5C.
- The deployed bundle does include middleware (auth redirects work), `/api/health`, `/api/scheduler/publish`, `/api/linkedin/*`, `/journal`, `/course-materials`, `/schedule`, `/settings` — bracketing the build to somewhere between Phase 3I/3J and Phase 5B.
- Therefore the Phase 5C/5D/5E recruiter workflow **cannot yet be validated in production** as designed. The exact deployed commit is unreachable without Vercel API/token access.

## 3. Validation timestamp

`2026-08-28 22:50–23:12 UTC`. (Server-render times observed in `/api/health` `timestamp` field are consistent with production UTC.)

## 4. Environment variable NAME audit

Audited **by name only**. No values were printed or recorded.

| Variable | Category | Status |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | PUBLIC | **PASS (indirect)** — redirects/auth behave correctly; value used only server-side |
| `NEXT_PUBLIC_SUPABASE_URL` | PUBLIC | **PASS (indirect)** — middleware works (no `MIDDLEWARE_INVOCATION_FAILED`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | PUBLIC | **PASS (indirect)** — inlined at build for a working build |
| `SUPABASE_SERVICE_ROLE_KEY` | SERVER | **PASS (indirect)** — `/api/health` reports `database:"connected"`, which requires it |
| `LINKEDIN_CLIENT_ID` | SERVER | **PASS (indirect)** — LinkedIn OAuth callback route is live and fail-closes |
| `LINKEDIN_CLIENT_SECRET` | SERVER | **NOT VERIFIED** — cannot be observed remotely |
| `LINKEDIN_OAUTH_STATE_SECRET` | SERVER | **NOT VERIFIED** — cannot be observed remotely |
| `SCHEDULER_SECRET` | SERVER | **PASS (indirect)** — unauthorized scheduler POSTs return 401 |
| `AI_TEXT_PROVIDER` | SERVER | **NOT VERIFIED** — requires an authenticated generation attempt |
| `GEMINI_API_KEY` | SERVER | **NOT VERIFIED** — cannot be observed remotely |
| `MAX_PDF_SIZE_MB` | PDF | **NOT VERIFIED** — cannot be observed remotely |

**No secret under `NEXT_PUBLIC_`:** the application source references exactly three
`NEXT_PUBLIC_` variables — `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` — and no `NEXT_PUBLIC_` key is treated as a secret
anywhere. The deployed client bundle was scanned: **zero** secret-looking strings
(JWT service-role patterns, `sb_secret_`, bearer tokens) and zero Supabase
credentials of any kind are embedded in client JS. **PASS.**

> Full server-side NAME audit against the Vercel project environment is **BLOCKED**
> (no Vercel CLI/API token available). Manual command: `vercel env ls`.

## 5. Vercel deployment validation

| Check | Result |
|---|---|
| `/` (homepage) | **PASS** — 200 |
| `/login` | **PASS** — 200 (public) |
| `/settings` (anon) | **PASS** — 307 → `/login?redirect=%2Fsettings` |
| `/journal` (anon) | **PASS** — 307 → `/login?redirect=%2Fjournal` |
| `/course-materials` (anon) | **PASS** — 307 → `/login?redirect=%2Fcourse-materials` |
| `/dashboard` (anon) | **PASS** — 307 → `/login?redirect=%2Fdashboard` |
| `/opportunities` | **FAIL** — not-found body (stale bundle; route absent) |
| `/api/health` | **PASS** — `{"status":"ok","application":"105-day-learning-journey","database":"connected",…}` — no internals leaked |
| Middleware | **PASS** — no `MIDDLEWARE_INVOCATION_FAILED` anywhere |
| Auth redirect logic | **PASS** — protected routes redirect, auth routes behave |
| Server exceptions exposed | **PASS** — bogus paths return clean 404s; no stack traces |

**Classification:** the failure on `/opportunities` is **A/B — deployment/configuration**
(stale production build), **not** a code defect in the current repo. The current code
builds the route successfully (verified locally, see §20).

## 6. Supabase production validation

**Schema/RLS audit (from the applied migrations; read-only):**

| Table | RLS enabled | Owner-only policy | Result |
|---|---|---|---|
| `profiles` | yes | yes | **PASS** |
| `modules` / `curriculum_days` | yes | authenticated SELECT only | **PASS** |
| `daily_learning_entries` | yes | yes | **PASS** |
| `generated_posts` | yes | yes | **PASS** |
| `media_assets` | yes | yes | **PASS** |
| `linkedin_connections` | yes | yes (+SELECT revoked) | **PASS** |
| `scheduled_posts` | yes | yes | **PASS** |
| `course_materials` / `course_material_pages` | yes | yes (join-based) | **PASS** |
| `content_opportunities` | yes | yes | **PASS** |

**Key security invariants (migration-verified):**

- `linkedin_connections.access_token`: migration `20260821000000_linkedin_token_column_privileges.sql`
  **revokes table-level SELECT from `authenticated`** — token is readable only by
  `service_role` (server-side). **PASS.**
- Storage: `post-images` flipped to **private** (`20260822000000_post_images_private.sql`);
  `course-materials` created **private** with owner path prefix. **PASS.**

**Live gateway probes (no credentials, production Supabase REST/Auth/Storage):**

| Probe | Expected | Result |
|---|---|---|
| `GET /rest/v1/profiles` — no key | rejected | **PASS** — 401 |
| `GET /rest/v1/profiles` — bogus key | rejected | **PASS** — 401 |
| `GET /storage/v1/bucket` — no key | rejected | **PASS** — 400 (no data) |
| `GET /auth/v1/health` — no key | rejected | **PASS** — 401 |

**Not live-verifiable here:** authenticated cross-user isolation, per-row RLS with a
signed-in session, and storage object-path enforcement require a real signed-in
browser session / test account. **BLOCKED / NOT TESTED** (see §24). No data was
modified, created, or deleted during validation.

## 7. PDF ingestion result

**NOT TESTED** in production — requires a signed-in browser session *and* the
current build (production is stale). Statically verified that `/course-materials`
exists and is middleware-protected (307 → login), so the route is deployed.

## 8. Journal proposal result

**NOT TESTED** in production — same blocker as §7 (signed-in session + current build).

## 9. Opportunity result

**BLOCKED** — `/opportunities` is absent from the production bundle (stale deployment).
Opportunity generation/scoring/selection logic is covered by the local suite
(§20) but no production validation is possible until redeploy.

## 10. Post-generation result

**BLOCKED** — requires the deployed branches + valid `GEMINI_API_KEY` +
`AI_TEXT_PROVIDER=gemini` + a signed-in session. Provider identity
(`provider`/`model` in `ProviderResult`) cannot be inspected without a real
generation. Fallback behavior is covered by the local suite.

## 11. Recruiter-quality result

**BLOCKED** in production (stale build). Cases A–D from the brief are covered by the
local suite: A strong/(ready/needs_review/do_not_publish) thresholds, B unsupported
personal claim → `do_not_publish`, C missing required section → blocked, D
"I mastered…" → non-critical warning. **Code evidence (PASS, local):** a critical
finding cannot be outvoted by a high score (base floored; `score` never overrides a
safety block).

## 12. Approval result

**BLOCKED** in production (stale build). Approval gate logic is locally verified:
`strong/ready` allowed; `needs_review` requires dialog confirmation; `do_not_publish`
→ `QUALITY_GATE_BLOCKED` with no status change and no LinkedIn call; stored/tampered
reports are always re-evaluated server-side.

## 13. LinkedIn OAuth result

Infrastructure (deployed build):

| Check | Result |
|---|---|
| `GET /api/linkedin/callback` (no `code`/`state`) | **PASS** — fail-closed redirect to `/settings?linkedin=…`; anonymous then → `/login`; no secrets in the redirect |
| Callback route liveness | **PASS** |
| OAuth state generation/signing/expiry, token storage | **NOT TESTED** live; implemented in server code, callback covered by local tests |

Full round-trip (real LinkedIn account, real user session) is **BLOCKED / NOT TESTED**
— requires a signed-in browser and a LinkedIn account. Code audit confirms the stored
OpenID `linkedin_sub` is used to build `urn:li:person:<linkedin_sub>` (never the
internal profile UUID) in `buildMemberUrn`.

## 14. LinkedIn scope result

Scope enforcement exists in server code (publish requires `w_member_social`;
otherwise `INSUFFICIENT_SCOPE` + reconnect guidance, no UGC call). **Live w_member_social
verification is BLOCKED/NOT TESTED** — depends on the real OAuth round-trip being
recorded (would need a re-auth in Settings). The challenge generation flow itself
cannot be probed without credentials.

## 15. Real manual LinkedIn publish

**NOT PERFORMED / BLOCKED** — this was not run because (a) the production bundle
predates Phase 5E so the Publish flow/dialog is not deployed, and (b) it requires a
real signed-in user + real LinkedIn connection + `w_member_social`. **Zero real posts
were published** (per the data-safety rules). The publish path
(`publishPost`: approved-only, idempotent, gate re-check, scope check, safe error
mapping, `published_at`/`linkedin_post_id`/`publish_error`) is fully covered by the
local suite; **no unnecessary test posts exist**.

## 16. Idempotency result

**PASS (local suite)** — `publishPost` on an already-published post returns the stored
result and issues **no second LinkedIn request** (asserted in
`generated-posts.test.ts` and the E2E journey, which counts UGC fetch calls and
confirms exactly one). **NOT TESTED live** (blocked as §15).

## 17. Scheduler verification

| Check | Result |
|---|---|
| Manual publishing independence | **PASS (code + local tests)** — manual `publishPost` is separate from the cron route |
| Scheduled publishing route | **PASS** — `/api/scheduler/publish` is live in production |
| Secret required | **PASS (live)** — `POST` with **no** `Authorization` header → **401** |
| Unauthorized rejected | **PASS (live)** — `POST` with a wrong bearer token → **401** |
| Secrets exposed | **PASS** — 401 body is not shown; workflow step never echoes the secret |
| Duplicate-claim protection / no re-publish of already-published posts | **PASS (local suite)** — partial-unique-index + publish-idempotency tests |
| New cron/GHA changes | **None made** — schedule untouched (`*/5 * * * *`, workflow dispatch unchanged) |

## 18. Mobile / responsive UX result

**NOT TESTED live** (no browser automation available in this environment).
Static screen-ratio review of the Phase 5E components found no fixed-pixel widths
that force horizontal overflow (`max-w-[220px]` in the Publish dialog is a
max-width, safe). Genuine responsive verification must be run after the redeploy
on a narrow viewport per the checklist (§24). No responsive **code fix** was
warranted from static review.

## 19. Error-message security audit

| Trigger | Result |
|---|---|
| Unauthorized API access (REST/Storage/Auth gateways) | **PASS (live)** — 401/400, no data, no keys in responses |
| Unauthorized scheduler call | **PASS (live)** — 401 |
| Missing page / API route | **PASS (live)** — clean 404, no stack traces |
| Media for another user | **PASS (live)** — `/api/media/nonexistent/image` → 401 |
| LinkedIn status for anon | **PASS (live)** — 401 |
| OAuth callback abuse (missing params) | **PASS (live)** — fail-closed redirect |
| Provider error leakage | **PASS (code)** — every provider error passes through display-safe mapping (`mapLinkedInFailure`, generation error masking); only mapped messages reach clients/`publish_error` |

Never exposed anywhere in this phase: API keys, OAuth tokens, service-role keys,
scheduler secret, OAuth state, raw LinkedIn/Gemini responses, stack traces, DB
credentials. No such strings were printed or persisted.

## 20. Test / typecheck / lint / build results

| Gate | Result |
|---|---|
| `pnpm test` | **PASS** — **80 files / 1064 tests** |
| `pnpm typecheck` | **PASS** (0 errors) |
| `pnpm lint` | **PASS** (0 errors) |
| `pnpm build` | **PASS** — compiled; route table includes `ƒ /opportunities` |

Baseline comparison vs Phase 5E (**79 files / 1061 tests**): exactly **+1 file / +3
tests**, all from the single Phase 5F regression test (`src/config/protected-routes.test.ts`,
3 assertions). No existing tests were modified, deleted, or weakened. The local build
contains `/opportunities` (so the production failure is demonstrably a stale
deployment, not a build/code failure).

## 21. Problems found

1. **Stale production deployment (blocker).** Vercel production does not contain
   Phase 5C/5D/5E; `/opportunities` returns a not-found body. The full recruiter
   workflow cannot be production-validated until redeployed. Cause is deployment
   state / automation configuration (Vercel), not app code.
2. **`/opportunities` missing from middleware `protectedRoutes` (code).** All other
   private routes get a middleware redirect with `?redirect=…`; the opportunities
   workspace relied solely on its own server-side guard. No data exposure (the page
   self-guards), but inconsistent with the route-protection contract.
3. **Not-found status semantics (informational).** `GET /opportunities` on the stale
   bundle returned HTTP **200** with a not-found body, while other unknown paths
   returned 404. No data exposure; noted only to explain the probe results.
4. **Production env audit gap (tooling).** No Vercel CLI/API token available, so the
   full server-variable NAME audit and the exact deployed-commit mapping are manual.

## 22. Fixes made

1. **Middleware route protection (Phase 5F hardening fix; uncommitted).** Moved the
   route lists into `src/config/protected-routes.ts`, added `/opportunities` to
   `PROTECTED_ROUTES`, and wired `middleware.ts` to import them. Minimal, no behavior
   change for existing routes.
2. **Regression test.** `src/config/protected-routes.test.ts` (3 assertions) covers
   the full protected set, auth-route exclusion, and the prefix-matching semantics.
3. No database migrations, no environment changes, no scheduler changes.

## 23. Remaining limitations

- No browser automation → no live mobile/visual validation and no end-to-end
  production journey with a real session.
- No production user credentials / real LinkedIn account / real Gemini verification.
- No Vercel API token → cannot audit env vars or the deployed commit, or trigger a
  redeploy.
- Production data rules were respected: **no rows created/modified/deleted**,
  **no real LinkedIn posts published**, no secrets printed.
- DB-password-less environment → live `psql` policy inspection not performed; RLS
  audit is from the applied migration set + gateway probes.

## 24. Manual actions still required

1. **Deploy the latest commit to Vercel Production** (HEAD `698763e` + the uncommitted
   middleware fix once committed): via the Vercel dashboard “Redeploy” / Git
   integration, or `vercel --prod` with an authenticated CLI.
2. **Confirm the canonical production domain** — whether a custom domain is aliased
   over `.vercel.app`.
3. **`vercel env ls`** (or dashboard) to confirm the server env var NAMES from §4
   exist in Production; confirm `AI_TEXT_PROVIDER=gemini` and a valid `GEMINI_API_KEY`.
4. **After redeploy**, run the real-user journey in a signed-in browser:
   PDF upload → proposal review → submit → opportunities → select → generate
   (confirm `provider: gemini` metadata) → quality panel → edit/approve →
   connect LinkedIn → OAuth re-auth (records `w_member_social`) → Publish one post →
   confirm `linkedin_post_id`/`published_at`/opportunity `published` → republish
   (idempotent) → verify exactly one LinkedIn post.
5. **Mobile pass** on a narrow viewport covering the §18 checklist.
6. **Log check** after a real publish: Vercel logs must show only the safe fields
   documented in `src/lib/logger.ts`.
7. Commit the Phase 5F middleware fix (currently uncommitted) and, when desired,
   push + redeploy.

---

**Overall Phase 5F result:** production reachable, middleware/auth/API guards/scheduler
401s/RLS-schema/storage privacy verified (**PASS**); all gates green (**PASS**); the
real-world recruiter publish journey is **BLOCKED until the production redeploy +
manual browser run** are performed. No blockers found in the application code beyond
the one hardening fix above.