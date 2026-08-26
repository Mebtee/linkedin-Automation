-- ============================================================================
-- Phase 3J — Course Material UX, Duplicate Detection, Multi-Day Support
-- ============================================================================
-- Adds:
--   - content_hash (text) — SHA-256 of raw PDF bytes for duplicate detection
--   - multi_day_sections (jsonb) — Detected day sections for multi-day PDFs
--
-- Security model unchanged: all existing RLS policies and storage policies
-- remain in effect. No new tables or policies are created.
-- ============================================================================

-- ─── content_hash column ────────────────────────────────────────────────────
-- Stores a SHA-256 hex digest of the raw PDF bytes. Used for deterministic
-- duplicate detection: same user + same hash = duplicate upload.

alter table public.course_materials
  add column content_hash text;

comment on column public.course_materials.content_hash
  is 'SHA-256 hex digest of the uploaded PDF bytes. Used for duplicate detection.';

-- Index for fast duplicate lookups: profile_id + content_hash.
create index idx_cm_content_hash
  on public.course_materials (profile_id, content_hash)
  where content_hash is not null;

-- ─── multi_day_sections column ──────────────────────────────────────────────
-- When a PDF contains material for multiple curriculum days, this stores
-- the detected sections as a JSON array of objects:
--   [{ "dayNumber": 3, "startPage": 1, "endPage": 5, "confidence": "EXACT" }]
--
-- Null when the PDF maps to a single day (the common case).

alter table public.course_materials
  add column multi_day_sections jsonb;

comment on column public.course_materials.multi_day_sections
  is 'Detected day sections for multi-day PDFs. Null for single-day PDFs.';
