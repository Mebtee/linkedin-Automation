-- ============================================================================
-- Initial Schema — 105-Day Learning Journey Core Tables
-- ============================================================================
-- Creates the foundation tables for the curriculum system:
--   profiles, modules, curriculum_days
--
-- Design decisions:
--   - profiles.id references auth.users(id) so Supabase Auth can own rows.
--   - modules are ordered by module_number; start_day/end_day define range.
--   - curriculum_days stores each of the 105 days with full content fields.
--   - updated_at is auto-managed via triggers (DRY, no app-level forgetting).
--   - RLS is enabled with permissive policies; tightened when auth lands.
-- ============================================================================

-- ─── Helper: auto-update updated_at ──────────────────────────────────────────

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── profiles ────────────────────────────────────────────────────────────────
-- One row per authenticated user. Created automatically on first sign-up
-- via a database trigger (defined after the table).

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  timezone        text not null default 'UTC',
  journey_start_date date,
  current_day     integer not null default 1
                    check (current_day >= 1 and current_day <= 105),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table  public.profiles              is 'User profile linked to Supabase Auth.';
comment on column public.profiles.id           is 'References auth.users.id — owned by Supabase Auth.';
comment on column public.profiles.timezone     is 'IANA timezone string (e.g. America/New_York).';
comment on column public.profiles.journey_start_date is 'Date the user started their 105-day journey.';
comment on column public.profiles.current_day  is 'Current day in the journey (1–105).';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

alter table public.profiles enable row level security;

-- Permissive policies (auth not implemented yet). Tighten when auth lands.
create policy "profiles_select_all" on public.profiles
  for select using (true);

create policy "profiles_insert_all" on public.profiles
  for insert with check (true);

create policy "profiles_update_all" on public.profiles
  for update using (true);

create policy "profiles_delete_all" on public.profiles
  for delete using (true);

-- ─── modules ─────────────────────────────────────────────────────────────────
-- Major curriculum modules (e.g. "HTML & CSS Foundations", "React Basics").
-- Ordered by module_number; start_day/end_day define the day range within 1–105.

create table public.modules (
  id              uuid primary key default gen_random_uuid(),
  module_number   integer not null unique,
  title           text not null,
  description     text,
  weeks           integer,
  days            integer,
  hours           numeric(5,1),
  start_day       integer not null check (start_day >= 1 and start_day <= 105),
  end_day         integer not null check (end_day >= 1 and end_day <= 105),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint modules_day_range check (start_day <= end_day)
);

comment on table  public.modules              is 'Major curriculum modules for the 105-day journey.';
comment on column public.modules.module_number is 'Sequential module number (1-based).';
comment on column public.modules.start_day    is 'First day of this module in the 105-day journey.';
comment on column public.modules.end_day      is 'Last day of this module in the 105-day journey.';
comment on column public.modules.hours        is 'Estimated total hours (supports decimals, e.g. 12.5).';

create trigger modules_set_updated_at
  before update on public.modules
  for each row execute function public.handle_updated_at();

create index idx_modules_module_number on public.modules (module_number);
create index idx_modules_start_day     on public.modules (start_day);
create index idx_modules_end_day       on public.modules (end_day);

alter table public.modules enable row level security;

create policy "modules_select_all" on public.modules
  for select using (true);

create policy "modules_insert_all" on public.modules
  for insert with check (true);

create policy "modules_update_all" on public.modules
  for update using (true);

create policy "modules_delete_all" on public.modules
  for delete using (true);

-- ─── curriculum_days ─────────────────────────────────────────────────────────
-- Each of the 105 individual learning days. Queryable by day_number for
-- fast lookups. Content fields are typed, not JSON, so the data is always
-- structured and searchable.

create table public.curriculum_days (
  id                    uuid primary key default gen_random_uuid(),
  day_number            integer not null unique
                          check (day_number >= 1 and day_number <= 105),
  module_id             uuid not null references public.modules(id) on delete restrict,
  week_number           integer,
  topic                 text not null,
  content               text,
  subtopics             text[],
  project_information   text,
  assessment_information text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table  public.curriculum_days                is 'Individual learning days (1–105) for the full-stack journey.';
comment on column public.curriculum_days.day_number     is 'Unique 1-based day number within the 105-day journey.';
comment on column public.curriculum_days.module_id      is 'Foreign key to the module this day belongs to.';
comment on column public.curriculum_days.week_number    is 'Week number within the journey (1-based).';
comment on column public.curriculum_days.subtopics      is 'Array of subtopic strings for this day.';
comment on column public.curriculum_days.project_information   is 'Description of the hands-on project for this day.';
comment on column public.curriculum_days.assessment_information is 'Assessment or quiz details for this day.';

create trigger curriculum_days_set_updated_at
  before update on public.curriculum_days
  for each row execute function public.handle_updated_at();

-- Indexes for the most common query patterns:
--   1. Look up a single day by number (e.g. "show me day 42")
--   2. Filter all days belonging to a module (e.g. "show module 3 curriculum")
--   3. Filter by week (e.g. "show me week 5")
create index idx_curriculum_days_day_number on public.curriculum_days (day_number);
create index idx_curriculum_days_module_id  on public.curriculum_days (module_id);
create index idx_curriculum_days_week       on public.curriculum_days (week_number);

alter table public.curriculum_days enable row level security;

create policy "curriculum_days_select_all" on public.curriculum_days
  for select using (true);

create policy "curriculum_days_insert_all" on public.curriculum_days
  for insert with check (true);

create policy "curriculum_days_update_all" on public.curriculum_days
  for update using (true);

create policy "curriculum_days_delete_all" on public.curriculum_days
  for delete using (true);
