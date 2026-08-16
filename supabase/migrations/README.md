# supabase/migrations

Database migrations for the Supabase project go here, one SQL file per migration,
named `YYYYMMDDHHMMSS_name.sql` (created with `supabase migration new <name>`).

Nothing exists yet. Planned migrations (later phases):

- `initial_schema` — curriculum, journal entries, posts, assets, schedule
- Auth-related triggers for `updated_at` timestamps and user ownership

The schema is designed as a single initial migration and then iterated with new
migrations only.
