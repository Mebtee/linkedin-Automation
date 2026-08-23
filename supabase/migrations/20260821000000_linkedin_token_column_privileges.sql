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
