-- ============================================================================
-- Phase 5B — Recruiter Content Opportunities
-- ============================================================================
-- Deterministically built, scored content opportunities derived from
-- confirmed journal / course-material evidence.
--
-- What this table is NOT:
--   - It never stores generated post text (that stays in generated_posts).
--   - It never stores tokens, keys, or secrets.
--   - Creating a row here publishes nothing — a row is a *candidate* that a
--     human reviews before any LinkedIn post is generated (Phase 5C+).
--
-- Every row is owner-scoped (RLS: auth.uid() = profile_id), matching the
-- existing owner-only policy pattern used across the application.
-- ============================================================================

create table public.content_opportunities (
  id                        uuid primary key default gen_random_uuid(),
  profile_id                uuid not null references public.profiles(id) on delete cascade,

  -- Source tracing
  source_type               text not null
                            check (source_type in ('course-material','journal','project-evidence')),
  source_id                 uuid,
  day_number                integer check (day_number >= 1 and day_number <= 105),
  module_number             integer,

  -- Taxonomy (Phase 5A)
  post_type                 text not null
                            check (post_type in (
                              'PROJECT_SHOWCASE','PROBLEM_SOLUTION','DEBUGGING_STORY',
                              'TECHNICAL_LESSON','SECURITY_LESSON','DEPLOYMENT_STORY',
                              'API_INTEGRATION','DATABASE_ENGINEERING','AI_ENGINEERING',
                              'LEARNING_MILESTONE','ENGINEERING_DECISION','CAREER_PROGRESS'
                            )),
  content_goal              text not null default 'GET_RECRUITER_ATTENTION'
                            check (content_goal in (
                              'GET_RECRUITER_ATTENTION','BUILD_TECHNICAL_CREDIBILITY',
                              'SHOW_PROJECTS','SHOW_PROBLEM_SOLVING','DOCUMENT_LEARNING','BALANCED'
                            )),

  -- Opportunity content
  title                     text not null,
  summary                   text,

  -- Evidence references (JSONB array of { field, pageNumbers, confidence }).
  -- Never stores raw hashes or internal security data — see src/types/content-opportunity.ts.
  evidence                  jsonb not null default '[]'::jsonb,

  -- Phase 5A deterministic scoring results
  recruiter_score           numeric not null default 0
                            check (recruiter_score >= 0 and recruiter_score <= 100),
  recruiter_score_breakdown jsonb not null default '{}'::jsonb,
  selection_reason          text,

  -- Lifecycle: candidate → selected → generated → approved → published.
  status                    text not null default 'candidate'
                            check (status in ('candidate','selected','generated','approved','published','rejected')),

  -- Deterministic de-duplication key produced by the opportunity builder.
  -- Upserts skip rows that already exist for the same (profile_id, dedup_key).
  dedup_key                 text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint content_opportunities_profile_dedup_unique unique (profile_id, dedup_key)
);

comment on table  public.content_opportunities is 'Recruiter-focused content opportunities derived from confirmed evidence. Nothing is published here; rows feed human review and later post generation.';
comment on column public.content_opportunities.source_type is 'Where the opportunity came from: course-material, journal, or project-evidence.';
comment on column public.content_opportunities.post_type is 'Phase 5A taxonomy post type (12 options).';
comment on column public.content_opportunities.content_goal is 'Content goal the opportunity was scored against.';
comment on column public.content_opportunities.evidence is 'Traceable evidence references (field keys + PDF pages + confidence). No hashes or secrets.';
comment on column public.content_opportunities.recruiter_score is 'Deterministic recruiter relevance score, 0–100.';
comment on column public.content_opportunities.recruiter_score_breakdown is 'Phase 5A RecruiterScore (total, per-dimension points, eligibility, flags). Never chain-of-thought.';
comment on column public.content_opportunities.selection_reason is 'Concise, dimension-based public explanation set when selected as best.';
comment on column public.content_opportunities.status is 'Lifecycle: candidate → selected → generated → approved → published (or rejected).';
comment on column public.content_opportunities.dedup_key is 'Deterministic key used to skip re-inserting identical opportunities.';

-- ─── Trigger ─────────────────────────────────────────────────────────────────

create trigger content_opportunities_set_updated_at
  before update on public.content_opportunities
  for each row execute function public.handle_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index idx_co_profile_id      on public.content_opportunities (profile_id);
create index idx_co_profile_status  on public.content_opportunities (profile_id, status);
create index idx_co_profile_score   on public.content_opportunities (profile_id, recruiter_score);
create index idx_co_source_id       on public.content_opportunities (source_id);
create index idx_co_day_number      on public.content_opportunities (day_number);

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table public.content_opportunities enable row level security;

-- Owner-only access: a user can only see and manage their own opportunities.
create policy "co_select_own"
  on public.content_opportunities for select
  using (auth.uid() = profile_id);

create policy "co_insert_own"
  on public.content_opportunities for insert
  with check (auth.uid() = profile_id);

create policy "co_update_own"
  on public.content_opportunities for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "co_delete_own"
  on public.content_opportunities for delete
  using (auth.uid() = profile_id);

-- No INSERT / UPDATE / DELETE policies for anon → denied by default.