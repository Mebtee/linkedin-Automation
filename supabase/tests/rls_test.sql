-- ============================================================================
-- RLS Test Script — Phase 1F (single-result version)
-- ============================================================================

-- ─── Setup ──────────────────────────────────────────────────────────────────

insert into public.modules (module_number, title, start_day, end_day)
values (99, 'Test Module', 100, 105)
on conflict (module_number) do nothing;

-- ─── All tests in one result set ────────────────────────────────────────────

select * from (values
  -- Service-role bypasses RLS
  ('1. Service-role reads modules',
    case when (select count(*) from public.modules) > 0 then 'PASS' else 'FAIL' end),
  ('2. Service-role reads curriculum_days (empty table, no error)',
    case when (select count(*) from public.curriculum_days) >= 0 then 'PASS' else 'FAIL' end),
  ('3. Service-role inserts module',
    case when (select count(*) from public.modules where module_number = 99) > 0 then 'PASS' else 'FAIL' end),

  -- No anon access to any table
  ('4. No anon SELECT on modules',
    case when not exists (select 1 from pg_policies where tablename = 'modules' and cmd = 'SELECT' and 'anon' = any(roles)) then 'PASS' else 'FAIL' end),
  ('5. No anon SELECT on curriculum_days',
    case when not exists (select 1 from pg_policies where tablename = 'curriculum_days' and cmd = 'SELECT' and 'anon' = any(roles)) then 'PASS' else 'FAIL' end),
  ('6. No anon SELECT on profiles',
    case when not exists (select 1 from pg_policies where tablename = 'profiles' and cmd = 'SELECT' and 'anon' = any(roles)) then 'PASS' else 'FAIL' end),

  -- Authenticated can read curriculum
  ('7. Auth SELECT on modules',
    case when exists (select 1 from pg_policies where tablename = 'modules' and cmd = 'SELECT' and 'authenticated' = any(roles)) then 'PASS' else 'FAIL' end),
  ('8. Auth SELECT on curriculum_days',
    case when exists (select 1 from pg_policies where tablename = 'curriculum_days' and cmd = 'SELECT' and 'authenticated' = any(roles)) then 'PASS' else 'FAIL' end),

  -- No auth write on modules
  ('9. No auth INSERT on modules',
    case when not exists (select 1 from pg_policies where tablename = 'modules' and cmd = 'INSERT' and 'authenticated' = any(roles)) then 'PASS' else 'FAIL' end),
  ('10. No auth UPDATE on modules',
    case when not exists (select 1 from pg_policies where tablename = 'modules' and cmd = 'UPDATE' and 'authenticated' = any(roles)) then 'PASS' else 'FAIL' end),
  ('11. No auth DELETE on modules',
    case when not exists (select 1 from pg_policies where tablename = 'modules' and cmd = 'DELETE' and 'authenticated' = any(roles)) then 'PASS' else 'FAIL' end),

  -- No auth write on curriculum_days
  ('12. No auth INSERT on curriculum_days',
    case when not exists (select 1 from pg_policies where tablename = 'curriculum_days' and cmd = 'INSERT' and 'authenticated' = any(roles)) then 'PASS' else 'FAIL' end),
  ('13. No auth UPDATE on curriculum_days',
    case when not exists (select 1 from pg_policies where tablename = 'curriculum_days' and cmd = 'UPDATE' and 'authenticated' = any(roles)) then 'PASS' else 'FAIL' end),
  ('14. No auth DELETE on curriculum_days',
    case when not exists (select 1 from pg_policies where tablename = 'curriculum_days' and cmd = 'DELETE' and 'authenticated' = any(roles)) then 'PASS' else 'FAIL' end),

  -- Profiles: owner-only
  ('15. Profile SELECT is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles_select_own' and qual = '(auth.uid() = id)') then 'PASS' else 'FAIL' end),
  ('16. Profile INSERT is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles_insert_own' and with_check = '(auth.uid() = id)') then 'PASS' else 'FAIL' end),
  ('17. Profile UPDATE is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles_update_own' and qual = '(auth.uid() = id)') then 'PASS' else 'FAIL' end),
  ('18. Profile DELETE is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles_delete_own' and qual = '(auth.uid() = id)') then 'PASS' else 'FAIL' end)
) as t(test, status);

-- ─── Cleanup ────────────────────────────────────────────────────────────────

delete from public.modules where module_number = 99;
