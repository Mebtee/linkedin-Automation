-- ============================================================================
-- Phase 3B — Generated Posts
-- ============================================================================
-- Creates the generated_posts table for persisting AI-generated LinkedIn
-- content. Each post is derived from a user's journal entry for a specific
-- curriculum day.
--
-- Design decisions:
--   - References profiles(id), daily_learning_entries(id), and
--     curriculum_days(day_number) — does not duplicate journal/curriculum data.
--   - content_hash enables duplicate detection without globally unique
--     constraints (multiple different drafts per day are allowed).
--   - Status uses a controlled enum type (draft → approved → published).
--   - Image metadata columns preserve structured output for future
--     image-generation phases without requiring a redesign.
--   - RLS enforces owner-only access (same pattern as profiles/journal).
-- ============================================================================

-- ─── Status enum ─────────────────────────────────────────────────────────────

create type public.post_status as enum ('draft', 'approved', 'published', 'failed');

comment on type public.post_status is 'Lifecycle status of a generated post: draft (initial), approved (ready to publish), published (live on LinkedIn), failed (generation/persistence error).';

-- ─── generated_posts ─────────────────────────────────────────────────────────

create table public.generated_posts (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  journal_entry_id      uuid not null references public.daily_learning_entries(id) on delete cascade,
  day_number            integer not null references public.curriculum_days(day_number) on delete restrict,
  status                public.post_status not null default 'draft',
  format                text not null,

  -- Post content (structured output from AI provider)
  opening               text not null,
  body                  text not null,
  takeaway              text not null,
  next_step             text not null,
  hashtags              text[] not null default '{}',

  -- Image metadata (preserved for future image-generation phases)
  image_headline        text,
  image_subheadline     text,
  image_keywords        text[],
  image_visual_concept  text,
  image_template        text,

  -- Provider metadata
  provider              text not null,
  model                 text not null,
  tokens_used           integer,

  -- Duplicate detection
  content_hash          text not null,

  -- Timestamps
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table  public.generated_posts                            is 'AI-generated LinkedIn posts derived from journal entries.';
comment on column public.generated_posts.profile_id                 is 'References profiles(id) — the user who owns this post.';
comment on column public.generated_posts.journal_entry_id           is 'References daily_learning_entries(id) — the journal entry this post was generated from.';
comment on column public.generated_posts.day_number                 is 'References curriculum_days(day_number) — the curriculum day this post corresponds to.';
comment on column public.generated_posts.status                     is 'Lifecycle: draft → approved → published (or failed).';
comment on column public.generated_posts.format                     is 'Post format matching the PostFormat type (what-i-learned, challenge, etc.).';
comment on column public.generated_posts.opening                    is 'Opening hook line of the generated post.';
comment on column public.generated_posts.body                       is 'Main content body of the generated post.';
comment on column public.generated_posts.takeaway                   is 'Key takeaway from the generated post.';
comment on column public.generated_posts.next_step                  is 'Next step or focus area from the generated post.';
comment on column public.generated_posts.hashtags                   is 'Array of hashtag strings for the post.';
comment on column public.generated_posts.image_headline             is 'Image headline text for future image generation.';
comment on column public.generated_posts.image_subheadline          is 'Image subheadline text for future image generation.';
comment on column public.generated_posts.image_keywords             is 'Keywords for future image generation.';
comment on column public.generated_posts.image_visual_concept       is 'Visual concept description for future image generation.';
comment on column public.generated_posts.image_template             is 'Template identifier for future image generation.';
comment on column public.generated_posts.provider                   is 'AI provider that generated this post (fallback, gemini, etc.).';
comment on column public.generated_posts.model                      is 'AI model used for generation (template-v1, gemini-pro, etc.).';
comment on column public.generated_posts.tokens_used                is 'Number of tokens consumed during generation (if available).';
comment on column public.generated_posts.content_hash               is 'SHA-256 hash of normalized post content for duplicate detection.';

-- ─── Constraints ─────────────────────────────────────────────────────────────

-- Allow multiple different drafts per day, but prevent exact duplicate content
-- for the same user, day, and format.
alter table public.generated_posts
  add constraint generated_posts_user_day_format_hash_unique
  unique (profile_id, day_number, format, content_hash);

-- ─── Trigger ─────────────────────────────────────────────────────────────────

create trigger generated_posts_set_updated_at
  before update on public.generated_posts
  for each row execute function public.handle_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- Common queries:
--   1. Get all posts for a user: WHERE profile_id = ?
--   2. Get posts for a specific day: WHERE profile_id = ? AND day_number = ?
--   3. Get posts by status: WHERE profile_id = ? AND status = ?
--   4. Check for duplicate content: WHERE profile_id = ? AND day_number = ? AND format = ? AND content_hash = ?
--   5. Get posts by journal entry: WHERE journal_entry_id = ?
create index idx_gp_profile_id           on public.generated_posts (profile_id);
create index idx_gp_day_number           on public.generated_posts (day_number);
create index idx_gp_profile_day          on public.generated_posts (profile_id, day_number);
create index idx_gp_profile_status       on public.generated_posts (profile_id, status);
create index idx_gp_journal_entry_id     on public.generated_posts (journal_entry_id);
create index idx_gp_content_hash         on public.generated_posts (content_hash);

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table public.generated_posts enable row level security;

-- Owner-only access: a user can only see and manage their own generated posts.
create policy "gp_select_own"
  on public.generated_posts for select
  using (auth.uid() = profile_id);

create policy "gp_insert_own"
  on public.generated_posts for insert
  with check (auth.uid() = profile_id);

create policy "gp_update_own"
  on public.generated_posts for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "gp_delete_own"
  on public.generated_posts for delete
  using (auth.uid() = profile_id);

-- No INSERT / UPDATE / DELETE policies for anon → denied by default.
