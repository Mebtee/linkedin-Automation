# 105-Day Learning Journey

A personal AI-powered LinkedIn content automation system tracking a 105-day
full-stack learning journey. Built with Next.js (App Router), TypeScript and
Supabase, designed to operate with $0 required cost.

> **Current phase: 1C — Environment & Configuration.** The technical foundation
> and the environment/configuration system are in place. LinkedIn, AI generation,
> image generation, scheduling, automation, journaling and publishing are
> **not implemented**.

## Stack

- Next.js 16 (App Router, server components by default)
- React 19
- TypeScript (strict) + Tailwind CSS v4
- pnpm

## Project structure

```
src/
  app/              # Routes (dashboard, curriculum, journal, posts, schedule, settings, api/health)
  components/       # UI components; client components only where interaction requires it
  services/         # Service-oriented layer (business logic lives here, not in components)
  lib/              # Low-level helpers (errors, future supabase/auth/security)
  types/            # Shared domain types
  config/           # app, brand, content + typed env (env.ts public, env.server.ts server-only)
supabase/migrations/  # Future Supabase migrations
scripts/seed-curriculum/  # Future curriculum seeding scripts
```

## Environment

See [ENVIRONMENT.md](./ENVIRONMENT.md) for the full documentation of every
variable, its scope and when it becomes required.

- `.env.example` is the committed template — copy it to `.env.local`.
- Public variables use the `NEXT_PUBLIC_` prefix; secrets are server-only.
- No variables are required in this phase; secrets are never committed and are
  never exposed by the API.

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
