# 105-Day Learning Journey

A personal AI-powered LinkedIn content automation system tracking a 105-day
full-stack learning journey. Built with Next.js (App Router), TypeScript and
Supabase, designed to operate with $0 required cost.

> **Current phase: 1B — Application Foundation.** Only the technical foundation
> exists. LinkedIn, AI generation, image generation, scheduling, automation,
> journaling and publishing are **not implemented**.

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
  config/           # Application, branding, content rules, environment config
supabase/migrations/  # Future Supabase migrations
scripts/seed-curriculum/  # Future curriculum seeding scripts
```

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

## Environment

Copy `.env.example` to `.env.local` when environment variables are introduced.
No variables are required in this phase. Secrets are never committed and are
never exposed by the API.

## Path alias

`@/*` maps to `src/*` (e.g. `@/config/application`, `@/components/ui/...`).
