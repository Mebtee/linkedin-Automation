# Deployment Guide (Phase 3H)

Step-by-step production deployment, configuration, and smoke-test procedure.
Variable **names** only are documented here — never actual secret values.

## 1. Supabase production setup

The hosted Supabase project doubles as the production database.

1. Apply all migrations in `supabase/migrations/` (ordered by timestamp
   prefix). With the CLI linked: `supabase db push`.
2. Verify `post-images` storage bucket exists and is **private**
   (`public = false`). Owner-only read/insert/delete policies scope access by
   path prefix `{auth.uid()}/{post_id}/image.svg`.
3. Seed curriculum: `pnpm seed:curriculum`.
4. Authentication → URL Configuration: set **Site URL** to the production
   origin and add `<production-origin>/auth/callback` to Redirect URLs.

## 2. LinkedIn app configuration

In the LinkedIn developer portal:

1. Add a redirect URL: `https://<production-domain>/api/linkedin/callback`
   (localhost entries are for development only).
2. Request the "Sign In with LinkedIn using OpenID Connect" product and the
   **"Share on LinkedIn"** product (needed for `w_member_social` publishing).
3. Scopes used by the app (intentionally minimal): `openid profile email`
   for connect, plus `w_member_social` for publish/reauthorization.

## 3. Vercel deployment

1. Import the GitHub repository into Vercel (framework auto-detected:
   Next.js). No build overrides needed.
2. Configure environment variables (Production):

   | Name | Notes |
   | --- | --- |
   | `NEXT_PUBLIC_APP_URL` | `https://<production-domain>` |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server-only; bypasses RLS |
   | `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | From the LinkedIn app |
   | `LINKEDIN_OAUTH_STATE_SECRET` | 32-byte hex random |
   | `SCHEDULER_SECRET` | 32-byte hex random; shared with GitHub Actions |
   | `AI_TEXT_PROVIDER` | `gemini` for real generation |
   | `GEMINI_API_KEY` | Google AI Studio key |

3. Deploy, then set the custom domain if desired.

## 4. GitHub Actions scheduler

Repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `SCHEDULER_SECRET` | Same value as the server's `SCHEDULER_SECRET`. |
| `APP_URL` | `https://<production-domain>` |

The workflow `.github/workflows/publish-scheduled.yml` runs every 5 minutes
and can also be triggered manually from the Actions tab (**workflow_dispatch**)
for testing.

## 5. Smoke-test procedure (run after every deploy)

1. **Health**: `GET https://<domain>/api/health` → `{"status":"ok",...}`.
2. **Auth**: sign up / log in at `/login`; protected routes redirect to login
   when signed out.
3. **Journal**: submit an entry; verify it appears in `/journal/history`.
4. **Generation**: generate a post; metadata shows `provider: "gemini"` when
   configured (falls back to `"fallback"` automatically on Gemini failure).
5. **Image**: generate + regenerate image in the editor; preview renders via
   `/api/media/<postId>/image`; another account must get 404 for that URL.
6. **LinkedIn**: connect account in Settings (OAuth round-trip), approve a
   post, use Publish, confirm the post appears on LinkedIn and
   `linkedin_post_id` is stored with status `published`.
7. **Scheduling**: schedule an approved post ~10 minutes out; wait for the
   cron run; status transitions `scheduled → publishing → published`;
   `attempt_count` is exactly 1.
8. **Scheduler auth**: POST without/wrong secret → 401; valid secret → 200.

## 6. Recovery / reconnect procedures

- **Expired LinkedIn connection** (`status: expired` in Settings): use
  Reauthorize (publish scopes) — no data loss; failed schedules can be
  rescheduled after reconnecting.
- **Gemini outage**: none required — generation silently falls back to the
  template provider and still succeeds.
- **Failed schedule**: shown on `/schedule` with the stored error; fix the
  cause (e.g. reconnect LinkedIn) and reschedule.
- **Rotating `SCHEDULER_SECRET`**: update it in both Vercel env vars and the
  GitHub repository secret at the same time, then redeploy.
