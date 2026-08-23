-- ============================================================================
-- Phase 3G-C — Post Scheduling
-- ============================================================================
-- Adds a scheduled_posts table for scheduling future LinkedIn publication.
--
-- Design decisions:
--   - Separate table (not columns on generated_posts) to cleanly track
--     scheduling lifecycle independently from post content lifecycle.
--   - schedule_status enum controls the scheduling state machine:
--     scheduled → publishing → published | failed
--     scheduled → cancelled
--   - Partial unique index enforces one active schedule per post.
--   - RLS owner-only for user operations; admin client bypasses for cron.
-- ============================================================================

-- ─── Schedule status enum ──────────────────────────────────────────────────

create type public.schedule_status as enum (
  'scheduled',
  'publishing',
  'published',
  'failed',
  'cancelled'
);

comment on type public.schedule_status
  is 'Lifecycle status of a scheduled post: scheduled → publishing → published/failed, or scheduled → cancelled.';

-- ─── scheduled_posts ────────────────────────────────────────────────────────

create table public.scheduled_posts (
  id                  uuid primary key default gen_random_uuid(),
  post_id             uuid not null references public.generated_posts(id) on delete cascade,
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  scheduled_at        timestamptz not null,
  status              public.schedule_status not null default 'scheduled',
  published_at        timestamptz,
  linkedin_post_id    text,
  last_error          text,
  attempt_count       integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table  public.scheduled_posts                      is 'Scheduled future LinkedIn publications for generated posts.';
comment on column public.scheduled_posts.post_id              is 'References generated_posts(id) — the post to publish.';
comment on column public.scheduled_posts.profile_id           is 'References profiles(id) — the user who owns this schedule.';
comment on column public.scheduled_posts.scheduled_at         is 'Target publication time in UTC.';
comment on column public.scheduled_posts.status               is 'Schedule lifecycle: scheduled → publishing → published/failed, or → cancelled.';
comment on column public.scheduled_posts.published_at         is 'Actual publication timestamp (set on successful publish).';
comment on column public.scheduled_posts.linkedin_post_id     is 'LinkedIn post ID after successful publication.';
comment on column public.scheduled_posts.last_error           is 'Error message from the last failed publishing attempt.';
comment on column public.scheduled_posts.attempt_count        is 'Number of publishing attempts made.';

-- ─── Constraints ─────────────────────────────────────────────────────────────

-- One active schedule per post at a time
-- Prevents duplicate scheduling and double-publishing.
create unique index idx_sp_one_active_per_post
  on public.scheduled_posts (post_id)
  where status = 'scheduled';

-- ─── Trigger ─────────────────────────────────────────────────────────────────

create trigger scheduled_posts_set_updated_at
  before update on public.scheduled_posts
  for each row execute function public.handle_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- Used by the cron publisher to find due posts
create index idx_sp_status_scheduled_at
  on public.scheduled_posts (status, scheduled_at)
  where status = 'scheduled';

-- User lookups
create index idx_sp_profile_id
  on public.scheduled_posts (profile_id);

create index idx_sp_post_id
  on public.scheduled_posts (post_id);

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table public.scheduled_posts enable row level security;

-- Owner-only access: a user can only see and manage their own schedules.
create policy "sp_select_own"
  on public.scheduled_posts for select
  using (auth.uid() = profile_id);

create policy "sp_insert_own"
  on public.scheduled_posts for insert
  with check (auth.uid() = profile_id);

create policy "sp_update_own"
  on public.scheduled_posts for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "sp_delete_own"
  on public.scheduled_posts for delete
  using (auth.uid() = profile_id);

-- Service-role (admin client) bypasses RLS — used by the cron publisher.
-- No anon policies → denied by default.
