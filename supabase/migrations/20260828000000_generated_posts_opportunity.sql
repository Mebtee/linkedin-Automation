-- ============================================================================
-- Phase 5C — Generated Posts ↔ Content Opportunities
-- ============================================================================
-- Adds a traceable, optional link from a generated post back to the content
-- opportunity that produced it.
--
-- Safety guarantees:
--   - ADDITIVE ONLY: adds one nullable column + one index. No drops, no data
--     changes, no RLS changes. Existing generated posts remain unchanged
--     (opportunity_id is NULL for them).
--   - opportunity_id is nullable and ON DELETE SET NULL — deleting an
--     opportunity never deletes the generated post text.
--   - A BEFORE INSERT/UPDATE trigger enforces that a generated post can only
--     point at a content opportunity owned by the SAME profile. This prevents
--     cross-user opportunity linkage through generated_posts (defense in depth
--     on top of the existing owner-only RLS policies).
-- ============================================================================

-- ─── Column ─────────────────────────────────────────────────────────────────

alter table public.generated_posts
  add column opportunity_id uuid references public.content_opportunities(id)
    on delete set null;

comment on column public.generated_posts.opportunity_id is
  'Optional link to the content opportunity (Phase 5B/5C) that produced this post. NULL for journal-only generated posts. Enables future analytics (which opportunities produce posts, which are published) without changing existing rows.';

-- ─── Index ──────────────────────────────────────────────────────────────────

-- Fast lookups: "does this opportunity already have a generated post?" and
-- "which posts came from opportunities?".
create index idx_gp_opportunity_id on public.generated_posts (opportunity_id);

-- ─── Ownership trigger ───────────────────────────────────────────────────────
-- A user must never attach their generated post to another user's opportunity.
-- The trigger runs as the table owner (bypasses RLS) so it can verify the
-- target opportunity's profile_id regardless of caller privileges.

create or replace function public.gp_check_opportunity_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.opportunity_id is not null then
    if not exists (
      select 1
      from public.content_opportunities co
      where co.id = new.opportunity_id
        and co.profile_id = new.profile_id
    ) then
      raise exception 'content opportunity % does not belong to profile %', new.opportunity_id, new.profile_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger gp_opportunity_ownership
  before insert or update on public.generated_posts
  for each row execute function public.gp_check_opportunity_ownership();

comment on trigger gp_opportunity_ownership on public.generated_posts is
  'Ensures generated_posts.opportunity_id always points to a content opportunity owned by the same profile.';