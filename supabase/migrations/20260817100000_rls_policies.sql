-- ============================================================================
-- Phase 1F — Row Level Security Policies
-- ============================================================================
-- Replaces the permissive "allow all" policies from the initial schema with
-- intentional, restrictive policies that enforce the security model:
--
--   profiles     → owner-only access (auth.uid() = id)
--   modules      → read for authenticated users, write restricted to service-role
--   curriculum_days → read for authenticated users, write restricted to service-role
--
-- Service-role bypasses all RLS by design. The service-role key never leaves
-- the server.
-- ============================================================================

-- ─── Drop permissive policies ────────────────────────────────────────────────

-- profiles
drop policy if exists "profiles_select_all"  on public.profiles;
drop policy if exists "profiles_insert_all"  on public.profiles;
drop policy if exists "profiles_update_all"  on public.profiles;
drop policy if exists "profiles_delete_all"  on public.profiles;

-- modules
drop policy if exists "modules_select_all"   on public.modules;
drop policy if exists "modules_insert_all"   on public.modules;
drop policy if exists "modules_update_all"   on public.modules;
drop policy if exists "modules_delete_all"   on public.modules;

-- curriculum_days
drop policy if exists "curriculum_days_select_all"  on public.curriculum_days;
drop policy if exists "curriculum_days_insert_all"  on public.curriculum_days;
drop policy if exists "curriculum_days_update_all"  on public.curriculum_days;
drop policy if exists "curriculum_days_delete_all"  on public.curriculum_days;

-- ─── profiles — owner-only access ───────────────────────────────────────────
-- A user can only see and manage their own profile. The profile ID is the
-- same as auth.users.id, so auth.uid() provides the ownership check.

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = id);

-- ─── modules — read for authenticated users ──────────────────────────────────
-- Curriculum modules are application data. Authenticated users can read them.
-- No direct write access — modules are managed via service-role (seeding,
-- admin operations). Anonymous users have no access.

create policy "modules_select_authenticated"
  on public.modules for select
  to authenticated
  using (true);

-- No INSERT / UPDATE / DELETE policies → denied by default when RLS is on.

-- ─── curriculum_days — read for authenticated users ──────────────────────────
-- Individual learning days are read by authenticated users to display
-- curriculum content. No direct write access — managed via service-role.
-- Anonymous users have no access.

create policy "curriculum_days_select_authenticated"
  on public.curriculum_days for select
  to authenticated
  using (true);

-- No INSERT / UPDATE / DELETE policies → denied by default when RLS is on.
