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
