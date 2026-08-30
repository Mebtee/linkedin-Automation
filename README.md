# LinkedIn Recruiter Content

An AI-powered LinkedIn content automation system that turns a learning journal
and uploaded course materials into evidence-grounded, recruiter-focused content
opportunities. Built with Next.js (App Router), TypeScript and Supabase,
designed to operate with $0 required cost.

The canonical flow: Course PDF → evidence extraction → journal / evidence
confirmation → content opportunities → recruiter scoring → content brief →
post generation → recruiter quality review → visual → review / approve → manual
LinkedIn publish. `/opportunities` is the primary workspace; `/` redirects there.

> For the full recruiter product spec (taxonomy, scoring, evidence safety,
> generation, quality, publishing), see [RECRUITER_CONTENT.md](./RECRUITER_CONTENT.md).

## Stack

- Next.js 16 (App Router, server components by default)
- React 19
- TypeScript (strict) + Tailwind CSS v4
- pnpm

## Project structure

```
src/
  app/              # Routes (opportunities, journal, course-materials, posts, schedule, settings, api/*)
  components/       # UI components; client components only where interaction requires it
  services/         # Service-oriented layer (business logic lives here, not in components)
  lib/              # Low-level helpers (errors, supabase/auth/security)
  types/            # Shared domain types
  config/           # app, brand, content + typed env (env.ts public, env.server.ts server-only)
supabase/migrations/  # Supabase migrations
scripts/seed-curriculum/  # Curriculum seeding scripts
```

## Environment

See [ENVIRONMENT.md](./ENVIRONMENT.md) for the full documentation of every
variable, its scope and when it becomes required.

- `.env.example` is the committed template — copy it to `.env.local`.
- Public variables use the `NEXT_PUBLIC_` prefix; secrets are server-only.
- Secrets are never committed and are never exposed by the API; see
  [SECURITY.md](./SECURITY.md).

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
pnpm typecheck   # TypeScript (tsc --noEmit)
pnpm lint        # ESLint
pnpm build       # Production build
```

## Path alias

`@/*` maps to `src/*` (e.g. `@/config/app`, `@/components/ui/...`).
