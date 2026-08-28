# supabase/migrations

Database migrations for the Supabase project go here, one SQL file per migration,
named `YYYYMMDDHHMMSS_name.sql` (created with `supabase migration new <name>`).

## Migrations

| File | Description |
|------|-------------|
| `20260817000000_initial_schema.sql` | Core tables: `profiles`, `modules`, `curriculum_days` + triggers, indexes |
| `20260817100000_rls_policies.sql` | Row Level Security: owner-only profiles, read-only curriculum for auth users |
| `20260827000000_content_opportunities.sql` | Phase 5B: `content_opportunities` — scored, deduplicated evidence-derived content candidates (owner-only RLS) |
| `20260828000000_generated_posts_opportunity.sql` | Phase 5C: `generated_posts.opportunity_id` (nullable FK → `content_opportunities`, `ON DELETE SET NULL`), index, ownership trigger |
| `20260829000000_recruiter_quality.sql` | Phase 5D: additive-only `recruiter_quality_score` (0–100 check) + `recruiter_quality_report` (safe jsonb) on `generated_posts` |

## Applying Migrations

**Via Supabase CLI:**
```bash
supabase db push          # Apply to hosted project
supabase migration up     # Apply locally
```

**Via Dashboard:**
Copy the SQL into the Supabase SQL Editor and run.

## Design

The schema is designed as a single initial migration and then iterated with new
migrations only. See [DATABASE.md](../../DATABASE.md) for full documentation.
