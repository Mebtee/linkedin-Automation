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
    case when exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles_delete_own' and qual = '(auth.uid() = id)') then 'PASS' else 'FAIL' end),

  -- Scheduled posts (Phase 3G-C): RLS enabled + owner-only
  ('19. scheduled_posts has RLS enabled',
    case when (select relrowsecurity from pg_class where relname = 'scheduled_posts' and relnamespace = 'public'::regnamespace) then 'PASS' else 'FAIL' end),
  ('20. scheduled_posts SELECT is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'scheduled_posts' and policyname = 'sp_select_own' and qual = '(auth.uid() = profile_id)') then 'PASS' else 'FAIL' end),
  ('21. scheduled_posts INSERT is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'scheduled_posts' and policyname = 'sp_insert_own' and with_check = '(auth.uid() = profile_id)') then 'PASS' else 'FAIL' end),
  ('22. scheduled_posts UPDATE is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'scheduled_posts' and policyname = 'sp_update_own' and qual = '(auth.uid() = profile_id)' and with_check = '(auth.uid() = profile_id)') then 'PASS' else 'FAIL' end),
  ('23. scheduled_posts DELETE is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'scheduled_posts' and policyname = 'sp_delete_own' and qual = '(auth.uid() = profile_id)') then 'PASS' else 'FAIL' end),
  ('24. No anon SELECT on scheduled_posts',
    case when not exists (select 1 from pg_policies where tablename = 'scheduled_posts' and cmd = 'SELECT' and 'anon' = any(roles)) then 'PASS' else 'FAIL' end),

  -- Generated posts (Phase 3E): owner-only
  ('25. generated_posts has RLS enabled',
    case when (select relrowsecurity from pg_class where relname = 'generated_posts' and relnamespace = 'public'::regnamespace) then 'PASS' else 'FAIL' end),
  ('26. generated_posts SELECT is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'generated_posts' and policyname = 'gp_select_own' and qual = '(auth.uid() = profile_id)') then 'PASS' else 'FAIL' end),
  ('27. generated_posts INSERT is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'generated_posts' and policyname = 'gp_insert_own' and with_check = '(auth.uid() = profile_id)') then 'PASS' else 'FAIL' end),
  ('28. generated_posts UPDATE is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'generated_posts' and policyname = 'gp_update_own' and qual = '(auth.uid() = profile_id)' and with_check = '(auth.uid() = profile_id)') then 'PASS' else 'FAIL' end),
  ('29. generated_posts DELETE is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'generated_posts' and policyname = 'gp_delete_own' and qual = '(auth.uid() = profile_id)') then 'PASS' else 'FAIL' end),

  -- Media assets (Phase 3F): owner-only
  ('30. media_assets has RLS enabled',
    case when (select relrowsecurity from pg_class where relname = 'media_assets' and relnamespace = 'public'::regnamespace) then 'PASS' else 'FAIL' end),
  ('31. media_assets SELECT is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'media_assets' and policyname = 'ma_select_own' and qual = '(auth.uid() = profile_id)') then 'PASS' else 'FAIL' end),
  ('32. media_assets INSERT is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'media_assets' and policyname = 'ma_insert_own' and with_check = '(auth.uid() = profile_id)') then 'PASS' else 'FAIL' end),
  ('33. media_assets DELETE is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'media_assets' and policyname = 'ma_delete_own' and qual = '(auth.uid() = profile_id)') then 'PASS' else 'FAIL' end),

  -- LinkedIn connections (Phase 3G-A): owner-only + token column protection
  ('34. linkedin_connections has RLS enabled',
    case when (select relrowsecurity from pg_class where relname = 'linkedin_connections' and relnamespace = 'public'::regnamespace) then 'PASS' else 'FAIL' end),
  ('35. linkedin_connections SELECT is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'linkedin_connections' and policyname = 'lc_select_own' and qual = '(auth.uid() = profile_id)') then 'PASS' else 'FAIL' end),
  ('36. linkedin_connections INSERT is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'linkedin_connections' and policyname = 'lc_insert_own' and with_check = '(auth.uid() = profile_id)') then 'PASS' else 'FAIL' end),
  ('37. linkedin_connections UPDATE is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'linkedin_connections' and policyname = 'lc_update_own' and qual = '(auth.uid() = profile_id)' and with_check = '(auth.uid() = profile_id)') then 'PASS' else 'FAIL' end),
  ('38. linkedin_connections DELETE is owner-only',
    case when exists (select 1 from pg_policies where tablename = 'linkedin_connections' and policyname = 'lc_delete_own' and qual = '(auth.uid() = profile_id)') then 'PASS' else 'FAIL' end),
  ('39. access_token hidden from authenticated SELECTs (column privileges)',
    case when not exists (
      select 1
      from information_schema.column_privileges
      where table_schema = 'public'
        and table_name = 'linkedin_connections'
        and column_name = 'access_token'
        and grantee = 'authenticated'
        and privilege_type = 'SELECT'
    ) then 'PASS' else 'FAIL' end),
  ('40. non-token columns still readable by authenticated',
    case when (
      select count(*)
      from information_schema.column_privileges
      where table_schema = 'public'
        and table_name = 'linkedin_connections'
        and grantee = 'authenticated'
        and privilege_type = 'SELECT'
        and column_name in ('id','profile_id','linkedin_sub','token_type','expires_at','scope','linkedin_name','linkedin_email','created_at','updated_at')
    ) = 10 then 'PASS' else 'FAIL' end),

  -- post-images storage bucket (Phase 3F): user-prefix policies
  ('41. post-images bucket exists and is public-read',
    case when exists (select 1 from storage.buckets where id = 'post-images' and public = true) then 'PASS' else 'FAIL' end),
  ('42. post-images upload restricted to own prefix',
    case when exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'post_images_insert_authenticated'
        and with_check like '%storage.foldername(name)%'
        and with_check like '%auth.uid()%'
    ) then 'PASS' else 'FAIL' end)
) as t(test, status);

-- ─── Cleanup ────────────────────────────────────────────────────────────────

delete from public.modules where module_number = 99;
