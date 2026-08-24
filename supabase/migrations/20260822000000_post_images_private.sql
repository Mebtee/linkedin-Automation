-- ============================================================================
-- Phase 3H — Make post-images bucket private (owner-only access)
-- ============================================================================
-- The bucket was originally created public because generated images were
-- assumed to be attached to public LinkedIn posts. Publishing is text-only,
-- so there is no reason for world-readable images: anyone holding (or
-- guessing) another user's {profile_id}/{post_id} path could view their
-- branded image.
--
-- This migration:
--   1. Flips the bucket to PRIVATE.
--   2. Replaces the public-read policy with an owner-only read policy using
--      the existing path convention ({auth.uid()}/{post_id}/image.svg).
--
-- The app serves images to their owner through the authenticated route
-- /api/media/[postId]/image (session-authenticated, RLS-checked), so no
-- functionality is lost.
-- ============================================================================

-- ─── Flip bucket to private ─────────────────────────────────────────────────

update storage.buckets
set public = false
where id = 'post-images';

-- ─── Replace public read with owner-only read ───────────────────────────────

drop policy if exists "post_images_select_public" on storage.objects;

create policy "post_images_select_own"
  on storage.objects for select
  using (
    bucket_id = 'post-images'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
