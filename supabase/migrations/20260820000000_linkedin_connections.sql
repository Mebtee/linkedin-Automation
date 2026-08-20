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
