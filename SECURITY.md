# SECURITY.md — Row Level Security & Access Control

Database security model for the 105-Day Learning Journey system.

---

## Overview

All foundation tables (`profiles`, `modules`, `curriculum_days`) have **Row Level Security (RLS) enabled**. Policies enforce who can read, insert, update, and delete rows.

- **Service-role** bypasses all RLS. The service-role key never leaves the server.
- **Authenticated users** have limited, intentional access.
- **Anonymous users** have no access to any table.

---

## Access Matrix

| Table | Role | SELECT | INSERT | UPDATE | DELETE |
|-------|------|--------|--------|--------|--------|
| `profiles` | `anon` | Blocked | Blocked | Blocked | Blocked |
| `profiles` | `authenticated` | Own row only | Own row only | Own row only | Own row only |
| `profiles` | `service_role` | All | All | All | All |
| `modules` | `anon` | Blocked | Blocked | Blocked | Blocked |
| `modules` | `authenticated` | All | Blocked | Blocked | Blocked |
| `modules` | `service_role` | All | All | All | All |
| `curriculum_days` | `anon` | Blocked | Blocked | Blocked | Blocked |
| `curriculum_days` | `authenticated` | All | Blocked | Blocked | Blocked |
| `curriculum_days` | `service_role` | All | All | All | All |

---

## Policies

### `profiles`

| Policy | Operation | Rule | Effect |
|--------|-----------|------|--------|
| `profiles_select_own` | SELECT | `auth.uid() = id` | User can only see their own profile |
| `profiles_insert_own` | INSERT | `auth.uid() = id` | User can only create a profile for themselves |
| `profiles_update_own` | UPDATE | `auth.uid() = id` | User can only modify their own profile |
| `profiles_delete_own` | DELETE | `auth.uid() = id` | User can only delete their own profile |

**Why owner-only?** Profile data (timezone, display name, journey progress) is personal. Users should never see or modify another user's profile.

### `modules`

| Policy | Operation | Rule | Effect |
|--------|-----------|------|--------|
| `modules_select_authenticated` | SELECT | `to authenticated` | Any authenticated user can read modules |

**No INSERT/UPDATE/DELETE policies** for authenticated users — denied by default when RLS is on. Curriculum structure is managed exclusively via service-role (database seeding, admin operations).

### `curriculum_days`

| Policy | Operation | Rule | Effect |
|--------|-----------|------|--------|
| `curriculum_days_select_authenticated` | SELECT | `to authenticated` | Any authenticated user can read curriculum days |

**No INSERT/UPDATE/DELETE policies** for authenticated users — denied by default when RLS is on. Same reasoning as `modules`.

---

## Design Decisions

1. **Profiles use `auth.uid() = id`** — The profile primary key is `auth.users.id`, so `auth.uid()` provides a direct ownership check. No joins needed.

2. **Curriculum is read-only for users** — Modules and curriculum days are application data seeded by the system. Users consume this data; they don't create or modify it. This prevents accidental or malicious changes to the curriculum structure.

3. **Service-role bypasses RLS** — The `service_role` key in Supabase bypasses all RLS policies by design. This is used for:
   - Database seeding (loading the 105-day curriculum)
   - Admin operations (managing modules, days)
   - Health checks and server-side queries
   The service-role key is only used in server-side code (behind `import "server-only"`).

4. **No `anon` access** — Anonymous (unauthenticated) users cannot read any table. This prevents information leakage before login.

5. **No "allow all" policies** — Every policy has an explicit condition. The principle of least privilege is applied: users get only what they need.

---

## Service-Role Key Security

The `SUPABASE_SERVICE_ROLE_KEY` is:
- Stored only in `.env.local` (gitignored)
- Accessed only via `src/config/env.server.ts` (imports `server-only`)
- Used only in `src/lib/supabase/admin.ts` (imports `server-only`)
- **Never** imported in client components — Next.js build fails if attempted

---

## Testing

RLS tests are in `supabase/tests/rls_test.sql`. Run via:

```bash
supabase db query --linked -f supabase/tests/rls_test.sql
```

The tests verify:
1. Service-role bypasses RLS (reads/writes work)
2. Anonymous users cannot access any table
3. Authenticated users can read modules and curriculum_days
4. Authenticated users cannot modify modules or curriculum_days
5. Profile policies enforce `auth.uid() = id` ownership
6. No permissive "allow all" policies remain

---

## Future Considerations

- **Admin role**: When admin functionality is needed (e.g. curriculum editing UI), introduce an `admin` role or a `role` column on `profiles`. Admin policies would allow authenticated users with admin status to modify curriculum.
- **Profile creation trigger**: Consider a database trigger on `auth.users` INSERT to auto-create a `profiles` row, removing the need for client-side profile creation.
- **RLS audit**: Periodically review policies as new tables and features are added.
