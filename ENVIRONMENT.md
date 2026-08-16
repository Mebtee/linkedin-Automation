# Environment Configuration

This document describes every environment variable used by the application,
its scope, and when it becomes required. It is the source of truth for the
`.env.example` template and the typed modules in `src/config/`.

## Scope rules

- **Public** — prefixed `NEXT_PUBLIC_`. Inlined into the client bundle at build
  time and readable by browsers. **Never** use these for secrets.
- **Server-only** — anything else. Read only on the server. Guarded by the
  `server-only` module (`src/config/env.server.ts`), so importing them from a
  client component fails the build.

| Variable | Scope | Required | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Public | When links to the app are generated | Canonical base URL of the app (e.g. `http://localhost:3000` in development). |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | When Supabase is integrated | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | When Supabase is integrated | Supabase anon/public key (safe for the browser under RLS). |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | When privileged server ops are added | Supabase service-role key. Bypasses RLS; server-only, never exposed to the client. |

## Reserved (future phases, not yet configured)

| Variable | Scope | When |
| --- | --- | --- |
| `LINKEDIN_CLIENT_ID` | Server-only | LinkedIn publishing phase |
| `LINKEDIN_CLIENT_SECRET` | Server-only | LinkedIn publishing phase |
| `LINKEDIN_ACCESS_TOKEN` | Server-only | LinkedIn publishing phase |
| `AI_API_KEY` | Server-only | AI generation phase |
| `AUTOMATION_SECRET` | Server-only | Automation phase |

## How configuration is read

All reads go through typed modules under `src/config/`:

- `src/config/env.ts` — **public** variables. Importable from client and server
  components. Values are accessed with literal `process.env.NEXT_PUBLIC_*`
  member syntax so Next.js can statically inline them.
- `src/config/env.server.ts` — **server-only** variables. Imports `server-only`;
  importing it from a client component fails the build. Secrets are never
  shipped to the browser.
- `src/config/app.ts`, `src/config/brand.ts`, `src/config/content.ts` —
  centralized application, branding and content configuration.

### Fail-fast behavior

Optional reads (`publicEnv`, `serverEnv`) return `string | undefined`. When a
variable is genuinely required for an operation, call `requirePublicEnv(key)` /
`requireServerEnv(key)` — these throw a clear `AppError` (code
`MISSING_ENV_VAR`) naming the missing variable instead of silently using
`undefined`.

## Security rules

1. Never commit real secrets. `.gitignore` ignores `.env`, `.env.*` and
   `.env.*.local`; only `.env.example` (names and placeholders) is committed.
2. Never put secrets in `NEXT_PUBLIC_*` variables — they are shipped to browsers.
3. Server-only modules must not be imported by client components; the
   `server-only` package enforces this at build time.
4. API routes must never echo environment values to clients.

## Setup

```bash
cp .env.example .env.local
```

Values marked `Required: When ...` are only needed once that feature is
integrated; the application runs without them today.
