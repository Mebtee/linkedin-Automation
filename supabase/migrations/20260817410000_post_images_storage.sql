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
