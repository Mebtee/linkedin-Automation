-- ============================================================================
-- Phase 5D — Recruiter post quality report on generated_posts
-- ============================================================================
-- Persists the deterministic post-quality evaluation (Phase 5D) so the review
-- UI and approval gate can read a stored report. The stored score/report are an
-- AUTHENTICATED user's own post data (owner-only RLS already covers the table);
-- the approve gate re-evaluates server-side before approving, so a tampered
-- stored value can never bypass the quality gate.
--
-- Safety guarantees:
--   - ADDITIVE ONLY: adds two nullable columns. No drops, no data changes, no
--     RLS changes, no trigger changes. Existing posts remain NULL (evaluated
--     on demand when viewed/approved).
--   - `recruiter_quality_report` is jsonb holding only the PUBLIC report shape
--     (score, recommendation, dimension scores, pre-authored strengths /
--     improvements / warnings). It never contains prompts or hidden reasoning.
-- ============================================================================

-- ─── Columns ─────────────────────────────────────────────────────────────────

alter table public.generated_posts
  add column recruiter_quality_score integer
    check (recruiter_quality_score is null or (recruiter_quality_score >= 0 and recruiter_quality_score <= 100));

alter table public.generated_posts
  add column recruiter_quality_report jsonb;

comment on column public.generated_posts.recruiter_quality_score is
  '0–100 deterministic post-quality score (Phase 5D). NULL when the post has not been assessed (journal-only posts are never assessed).';

comment on column public.generated_posts.recruiter_quality_report is
  'Public, safe post-quality report (score, recommendation, dimension scores, strengths, improvements, warnings). Contains no prompts, no evidence dumps, and no hidden reasoning.';