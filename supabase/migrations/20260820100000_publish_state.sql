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
