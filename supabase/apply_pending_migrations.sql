-- ============================================================================
-- PENDING MIGRATIONS — consolidated for one-shot execution
-- Generated 2026-08-23. Applies Phases 3E → 3G-D to a database where
-- only the first three migrations (initial_schema, rls_policies,
-- daily_learning_entries) have been run.
-- Paste this ENTIRE file into Supabase Dashboard → SQL Editor → Run.
-- ============================================================================


-- ############################################################################
-- >>> FILE: 20260817300000_generated_posts.sql
-- ############################################################################
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


-- ############################################################################
-- >>> FILE: 20260817400000_media_assets.sql
-- ############################################################################
-- ============================================================================
-- Phase 3E — Media Assets
-- ============================================================================
-- Creates the media_assets table for storing generated image metadata.
-- SVG files are stored in Supabase Storage; this table tracks metadata.
--
-- Design decisions:
--   - References profiles(id) and generated_posts(id) with CASCADE deletes.
--   - One media asset per generated post (replaced on regeneration).
--   - storage_path follows: {profile_id}/{post_id}/image.svg
--   - RLS enforces owner-only access (same pattern as other tables).
--   - Enables controlled server-side uploads without exposing storage
--     credentials to the client.
-- ============================================================================

-- ─── media_assets ───────────────────────────────────────────────────────────

create table public.media_assets (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  generated_post_id     uuid not null references public.generated_posts(id) on delete cascade,
  storage_path          text not null,
  storage_url           text not null,
  mime_type             text not null default 'image/svg+xml',
  width                 integer not null,
  height                integer not null,
  template              text not null,
  alt_text              text not null,
  metadata              jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table  public.media_assets                    is 'Generated media assets (images) for LinkedIn posts.';
comment on column public.media_assets.profile_id         is 'References profiles(id) — the user who owns this asset.';
comment on column public.media_assets.generated_post_id  is 'References generated_posts(id) — the post this asset is for.';
comment on column public.media_assets.storage_path       is 'Storage path in Supabase Storage (profile_id/post_id/image.svg).';
comment on column public.media_assets.storage_url        is 'Public or signed URL for accessing the asset.';
comment on column public.media_assets.mime_type          is 'MIME type of the asset (image/svg+xml).';
comment on column public.media_assets.width              is 'Image width in pixels.';
comment on column public.media_assets.height             is 'Image height in pixels.';
comment on column public.media_assets.template           is 'Image template used for generation.';
comment on column public.media_assets.alt_text           is 'Accessible alt text for the image.';
comment on column public.media_assets.metadata           is 'Additional metadata as JSONB.';

-- ─── Constraints ─────────────────────────────────────────────────────────────

-- One media asset per generated post (enforced via unique constraint).
-- On regeneration, the old asset is replaced.
alter table public.media_assets
  add constraint media_assets_post_unique
  unique (generated_post_id);

-- ─── Trigger ─────────────────────────────────────────────────────────────────

create trigger media_assets_set_updated_at
  before update on public.media_assets
  for each row execute function public.handle_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index idx_ma_profile_id         on public.media_assets (profile_id);
create index idx_ma_generated_post_id  on public.media_assets (generated_post_id);
create index idx_ma_storage_path       on public.media_assets (storage_path);

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table public.media_assets enable row level security;

-- Owner-only access: a user can only see and manage their own media assets.
create policy "ma_select_own"
  on public.media_assets for select
  using (auth.uid() = profile_id);

create policy "ma_insert_own"
  on public.media_assets for insert
  with check (auth.uid() = profile_id);

create policy "ma_update_own"
  on public.media_assets for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "ma_delete_own"
  on public.media_assets for delete
  using (auth.uid() = profile_id);

-- No INSERT / UPDATE / DELETE policies for anon → denied by default.


-- ############################################################################
-- >>> FILE: 20260817410000_post_images_storage.sql
-- ############################################################################
-- ============================================================================
-- Phase 3E Security Fix — Storage Bucket & Access Policies
-- ============================================================================
-- Creates the post-images storage bucket as PUBLIC with proper access policies.
--
-- Why PUBLIC:
--   These images are for LinkedIn posts that will be published publicly.
--   Using getPublicUrl() is correct for public buckets.
--   The media_assets table RLS controls who can see/manage metadata.
--
-- Access policies:
--   - Anyone can READ (view images) — needed for LinkedIn post display
--   - Authenticated users can UPLOAD — only to their own path prefix
--   - Authenticated users can DELETE — only their own files
--   - No UPDATE policy needed (files are replaced via upsert + delete)
--
-- Path convention: {profile_id}/{post_id}/image.svg
-- This prevents users from overwriting each other's files.
-- ============================================================================

-- ─── Storage Bucket ─────────────────────────────────────────────────────────

-- Create the bucket as public (images will be published to LinkedIn)
insert into storage.buckets (id, name, public)
  values ('post-images', 'post-images', true)
  on conflict (id) do nothing;

-- ─── Storage Access Policies ─────────────────────────────────────────────────

-- Anyone can view images (public bucket)
create policy "post_images_select_public"
  on storage.objects for select
  using (bucket_id = 'post-images');

-- Authenticated users can upload to their own path prefix
create policy "post_images_insert_authenticated"
  on storage.objects for insert
  with check (
    bucket_id = 'post-images'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete their own files
create policy "post_images_delete_authenticated"
  on storage.objects for delete
  using (
    bucket_id = 'post-images'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ############################################################################
-- >>> FILE: 20260820000000_linkedin_connections.sql
-- ############################################################################
-- ============================================================================
-- Phase 3G-A — LinkedIn Connections (OAuth / Account Connection)
-- ============================================================================
-- Stores the LinkedIn OAuth connection per user. Each user may have at most
-- one active LinkedIn connection (enforced by the UNIQUE constraint on
-- profile_id).
--
-- Design decisions:
--   - access_token is stored server-side only. Supabase transparently
--     encrypts columns; the anon/RLS policies prevent client reads.
--   - linkedin_sub is the OpenID Connect subject identifier (unique per
--     LinkedIn user) used for identity verification.
--   - expires_at tracks token lifetime so the UI can show "expired" status.
--   - scope records the granted scopes for auditing.
--   - RLS enforces owner-only access (same pattern as other tables).
-- ============================================================================

-- ─── linkedin_connections ────────────────────────────────────────────────────

create table public.linkedin_connections (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null unique references public.profiles(id) on delete cascade,
  linkedin_sub      text not null,
  access_token      text not null,
  token_type        text not null default 'bearer',
  expires_at        timestamptz,
  scope             text not null default 'openid profile email',
  linkedin_name     text,
  linkedin_email    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table  public.linkedin_connections                    is 'LinkedIn OAuth connections — one per user. Stores access tokens server-side.';
comment on column public.linkedin_connections.profile_id         is 'References profiles(id) — the user who owns this connection.';
comment on column public.linkedin_connections.linkedin_sub       is 'OpenID Connect subject identifier from LinkedIn.';
comment on column public.linkedin_connections.access_token       is 'OAuth 2.0 access token — never exposed to the browser.';
comment on column public.linkedin_connections.token_type         is 'Token type (typically "bearer").';
comment on column public.linkedin_connections.expires_at         is 'When the access token expires (null = unknown).';
comment on column public.linkedin_connections.scope              is 'Granted OAuth scopes.';
comment on column public.linkedin_connections.linkedin_name      is 'Display name from the LinkedIn profile.';
comment on column public.linkedin_connections.linkedin_email     is 'Primary email from the LinkedIn profile.';

-- ─── Trigger ─────────────────────────────────────────────────────────────────

create trigger linkedin_connections_set_updated_at
  before update on public.linkedin_connections
  for each row execute function public.handle_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index idx_lc_profile_id on public.linkedin_connections (profile_id);
create index idx_lc_linkedin_sub on public.linkedin_connections (linkedin_sub);

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table public.linkedin_connections enable row level security;

-- Owner-only access: a user can only see and manage their own LinkedIn connection.
create policy "lc_select_own"
  on public.linkedin_connections for select
  using (auth.uid() = profile_id);

create policy "lc_insert_own"
  on public.linkedin_connections for insert
  with check (auth.uid() = profile_id);

create policy "lc_update_own"
  on public.linkedin_connections for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "lc_delete_own"
  on public.linkedin_connections for delete
  using (auth.uid() = profile_id);

-- No INSERT / UPDATE / DELETE policies for anon → denied by default.


-- ############################################################################
-- >>> FILE: 20260820100000_publish_state.sql
-- ############################################################################
-- ============================================================================
-- Phase 3G-B — Publish State
-- ============================================================================
-- Adds publishing metadata columns to generated_posts for tracking
-- LinkedIn publication status, post ID, and error information.
--
-- Design decisions:
--   - linkedin_post_id stores the LinkedIn-assigned post identifier after
--     successful publication. Null until published.
--   - published_at records the exact publication timestamp.
--   - publish_error stores error details from failed publishing attempts
--     for diagnosis without exposing secrets.
--   - All columns are nullable — only populated during/after publishing.
--   - No RLS changes needed — existing owner-only policies already cover
--     these columns via SELECT/UPDATE on generated_posts.
-- ============================================================================

-- ─── Publish state columns ──────────────────────────────────────────────────

alter table public.generated_posts
  add column linkedin_post_id text,
  add column published_at     timestamptz,
  add column publish_error    text;

comment on column public.generated_posts.linkedin_post_id is 'LinkedIn-assigned post identifier (urn:li:share:...) after successful publication. Null until published.';
comment on column public.generated_posts.published_at     is 'Timestamp when the post was successfully published to LinkedIn. Null until published.';
comment on column public.generated_posts.publish_error    is 'Error details from a failed publishing attempt. Cleared on successful re-publish.';

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index idx_gp_linkedin_post_id on public.generated_posts (linkedin_post_id) where linkedin_post_id is not null;


-- ############################################################################
-- >>> FILE: 20260820200000_scheduled_posts.sql
-- ############################################################################
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


-- ############################################################################
-- >>> FILE: 20260821000000_linkedin_token_column_privileges.sql
-- ############################################################################
-- ============================================================================
-- Phase 3G-D — Hide linkedin_connections.access_token from client sessions
-- ============================================================================
-- Defense-in-depth hardening of the LinkedIn connection storage.
--
-- Problem:
--   Supabase's default privileges grant ALL on public tables to `authenticated`.
--   Combined with the owner-only RLS policy ("lc_select_own"), this means a
--   signed-in user can read their own row — INCLUDING access_token — through
--   direct Supabase REST calls (bypassing the Next.js server entirely).
--   The application never exposes the token, but the database did.
--
-- Fix:
--   Revoke table-level SELECT from `authenticated`, then grant column-level
--   SELECT on every column EXCEPT access_token. Owner sessions keep reading
--   connection status fields (getConnectionStatus selects only these), and
--   keep INSERT / UPDATE / DELETE privileges (OAuth callback upsert and
--   disconnect both run under the user's session). The service_role role is
--   untouched and retains full access for server-side publishing.
--
--   Result: `select access_token ...` over the REST API now fails with a
--   permission error instead of returning the secret.
-- ============================================================================

-- ─── Column-level SELECT for authenticated (everything except access_token) ──

revoke select on table public.linkedin_connections from authenticated;

grant select (
  id,
  profile_id,
  linkedin_sub,
  token_type,
  expires_at,
  scope,
  linkedin_name,
  linkedin_email,
  created_at,
  updated_at
) on table public.linkedin_connections to authenticated;

-- ─── Documentation ───────────────────────────────────────────────────────────

comment on column public.linkedin_connections.access_token is
  'OAuth 2.0 access token — server-only. Table-level SELECT is revoked from authenticated; only service_role can read this column.';

