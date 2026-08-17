-- ============================================================================
-- Phase 2A — Daily Learning Journal
-- ============================================================================
-- Creates the daily_learning_entries table for recording what the user
-- actually learns each day. This is the source of truth that future AI
-- content generation will use.
--
-- Design decisions:
--   - References profiles(id) and curriculum_days(day_number) — does not
--     duplicate curriculum data.
--   - Unique constraint on (profile_id, day_number) prevents accidental
--     duplicate entries for the same day.
--   - Status uses a controlled enum type (draft → submitted → used).
--   - All optional fields are nullable — the user fills what they want.
--   - RLS enforces owner-only access (same pattern as profiles).
-- ============================================================================

-- ─── Status enum ─────────────────────────────────────────────────────────────

create type public.journal_status as enum ('draft', 'submitted', 'used');

comment on type public.journal_status is 'Lifecycle status of a daily learning entry: draft (editing), submitted (complete), used (consumed by AI generation).';

-- ─── daily_learning_entries ──────────────────────────────────────────────────

create table public.daily_learning_entries (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  day_number            integer not null references public.curriculum_days(day_number) on delete restrict,
  status                public.journal_status not null default 'draft',

  -- Learning fields
  what_i_learned        text,
  what_i_practiced      text,
  what_i_built          text,
  challenge             text,
  how_i_solved_it       text,
  key_takeaway          text,
  tomorrow_focus        text,

  -- Optional fields
  project_name          text,
  project_description   text,
  code_reference        text,
  resources_used        text,
  confidence_level      integer check (confidence_level >= 1 and confidence_level <= 5),
  additional_notes      text,

  -- Timestamps
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- One entry per user per day
  constraint daily_learning_entries_profile_day_unique unique (profile_id, day_number)
);

comment on table  public.daily_learning_entries                  is 'Daily learning journal entries — the source of truth for AI content generation.';
comment on column public.daily_learning_entries.profile_id       is 'References profiles(id) — the user who created this entry.';
comment on column public.daily_learning_entries.day_number       is 'References curriculum_days(day_number) — the curriculum day this entry documents.';
comment on column public.daily_learning_entries.status           is 'Lifecycle: draft → submitted → used.';
comment on column public.daily_learning_entries.what_i_learned   is 'Main concepts or topics learned today.';
comment on column public.daily_learning_entries.what_i_practiced is 'Skills or exercises practiced.';
comment on column public.daily_learning_entries.what_i_built     is 'Projects, code, or artifacts created.';
comment on column public.daily_learning_entries.challenge        is 'Hardest part of today''s learning.';
comment on column public.daily_learning_entries.how_i_solved_it  is 'How the challenge was overcome.';
comment on column public.daily_learning_entries.key_takeaway     is 'The single most important insight from today.';
comment on column public.daily_learning_entries.tomorrow_focus   is 'What to focus on next.';
comment on column public.daily_learning_entries.confidence_level is 'Self-rated confidence 1–5 (1 = struggled, 5 = confident).';

-- ─── Trigger ─────────────────────────────────────────────────────────────────

create trigger daily_learning_entries_set_updated_at
  before update on public.daily_learning_entries
  for each row execute function public.handle_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- Common queries:
--   1. Get all entries for a user: WHERE profile_id = ?
--   2. Get a user's entry for a specific day: WHERE profile_id = ? AND day_number = ?
--   3. List entries by status for a user: WHERE profile_id = ? AND status = ?
create index idx_dle_profile_id          on public.daily_learning_entries (profile_id);
create index idx_dle_day_number          on public.daily_learning_entries (day_number);
create index idx_dle_profile_day         on public.daily_learning_entries (profile_id, day_number);
create index idx_dle_profile_status      on public.daily_learning_entries (profile_id, status);

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table public.daily_learning_entries enable row level security;

-- Owner-only access: a user can only see and manage their own journal entries.
create policy "dle_select_own"
  on public.daily_learning_entries for select
  using (auth.uid() = profile_id);

create policy "dle_insert_own"
  on public.daily_learning_entries for insert
  with check (auth.uid() = profile_id);

create policy "dle_update_own"
  on public.daily_learning_entries for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "dle_delete_own"
  on public.daily_learning_entries for delete
  using (auth.uid() = profile_id);

-- No INSERT / UPDATE / DELETE policies for anon → denied by default.
