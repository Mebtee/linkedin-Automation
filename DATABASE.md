# DATABASE.md — Schema Documentation

Supabase (PostgreSQL) schema for the 105-Day Full-Stack Learning Journey system.

---

## Tables

### `profiles`

One row per authenticated user. Created on first sign-up via Supabase Auth.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | **PK**, FK → `auth.users(id)` ON DELETE CASCADE | User ID from Supabase Auth |
| `display_name` | `text` | nullable | User's display name |
| `timezone` | `text` | NOT NULL, default `'UTC'` | IANA timezone (e.g. `America/New_York`) |
| `journey_start_date` | `date` | nullable | Date the user began their 105-day journey |
| `current_day` | `integer` | NOT NULL, default `1`, CHECK `1–105` | Current day in the journey |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Row creation time |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Auto-updated via trigger |

**Relationships:**
- `profiles.id` → `auth.users.id` (1:1, cascade delete)

---

### `modules`

Major curriculum modules (e.g. "HTML & CSS Foundations", "React Basics").

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | **PK**, default `gen_random_uuid()` | Module ID |
| `module_number` | `integer` | **UNIQUE**, NOT NULL | Sequential module number (1-based) |
| `title` | `text` | NOT NULL | Module title |
| `description` | `text` | nullable | Module description |
| `weeks` | `integer` | nullable | Number of weeks |
| `days` | `integer` | nullable | Number of days |
| `hours` | `numeric(5,1)` | nullable | Estimated total hours (e.g. `12.5`) |
| `start_day` | `integer` | NOT NULL, CHECK `1–105` | First day in the 105-day journey |
| `end_day` | `integer` | NOT NULL, CHECK `1–105` | Last day in the 105-day journey |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Row creation time |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Auto-updated via trigger |

**Constraints:**
- `start_day <= end_day` (day range must be valid)

**Indexes:**
- `idx_modules_module_number` on `(module_number)`
- `idx_modules_start_day` on `(start_day)`
- `idx_modules_end_day` on `(end_day)`

---

### `curriculum_days`

Each of the 105 individual learning days. Queryable by day number.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | **PK**, default `gen_random_uuid()` | Day ID |
| `day_number` | `integer` | **UNIQUE**, NOT NULL, CHECK `1–105` | 1-based day number |
| `module_id` | `uuid` | NOT NULL, FK → `modules(id)` ON DELETE RESTRICT | Parent module |
| `week_number` | `integer` | nullable | Week number within the journey (1-based) |
| `topic` | `text` | NOT NULL | Main topic for this day |
| `content` | `text` | nullable | Detailed content / learning material |
| `subtopics` | `text[]` | nullable | Array of subtopic strings |
| `project_information` | `text` | nullable | Hands-on project description |
| `assessment_information` | `text` | nullable | Assessment / quiz details |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Row creation time |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Auto-updated via trigger |

**Constraints:**
- `day_number` must be `UNIQUE` and between `1` and `105`
- `module_id` FK uses `ON DELETE RESTRICT` — a module cannot be deleted if days reference it

**Indexes:**
- `idx_curriculum_days_day_number` on `(day_number)` — fast single-day lookups
- `idx_curriculum_days_module_id` on `(module_id)` — filter all days by module
- `idx_curriculum_days_week` on `(week_number)` — filter by week

---

### `daily_learning_entries` (Phase 2A)

Daily learning journal entries — the source of truth for AI content generation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | **PK**, default `gen_random_uuid()` | Entry ID |
| `profile_id` | `uuid` | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Owner user |
| `day_number` | `integer` | NOT NULL, FK → `curriculum_days(day_number)` ON DELETE RESTRICT | Curriculum day |
| `status` | `journal_status` | NOT NULL, default `'draft'` | Lifecycle status |
| `what_i_learned` | `text` | nullable | Main concepts learned |
| `what_i_practiced` | `text` | nullable | Skills practiced |
| `what_i_built` | `text` | nullable | Projects or code created |
| `challenge` | `text` | nullable | Hardest part of the day |
| `how_i_solved_it` | `text` | nullable | How the challenge was overcome |
| `key_takeaway` | `text` | nullable | Most important insight |
| `tomorrow_focus` | `text` | nullable | What to focus on next |
| `project_name` | `text` | nullable | Name of the project worked on |
| `project_description` | `text` | nullable | Description of the project |
| `code_reference` | `text` | nullable | Links or references to code |
| `resources_used` | `text` | nullable | Tutorials, docs, articles used |
| `confidence_level` | `integer` | nullable, CHECK `1–5` | Self-rated confidence |
| `additional_notes` | `text` | nullable | Any other notes |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Row creation time |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Auto-updated via trigger |

**Constraints:**
- `(profile_id, day_number)` is **UNIQUE** — one entry per user per day
- `day_number` FK references `curriculum_days(day_number)` — must be a valid day (1–105)
- `profile_id` FK references `profiles(id)` — cascade delete when profile is removed
- `confidence_level` must be between 1 and 5
- `status` is a controlled enum: `draft`, `submitted`, `used`

**Indexes:**
- `idx_dle_profile_id` on `(profile_id)` — all entries for a user
- `idx_dle_day_number` on `(day_number)` — all entries for a curriculum day
- `idx_dle_profile_day` on `(profile_id, day_number)` — fast user+day lookup
- `idx_dle_profile_status` on `(profile_id, status)` — filter by status

---

## Relationships

```
auth.users (Supabase Auth)
  │
  │ 1:1
  ▼
profiles
  │
  ├── 1:N (implicit via module ordering)
  │   ▼
  │   modules
  │     │
  │     │ 1:N (module_id FK)
  │     ▼
  │   curriculum_days
  │
  └── 1:N (profile_id FK)
      ▼
    daily_learning_entries
      │
      └── N:1 (day_number FK → curriculum_days)
```

- A **profile** belongs to one `auth.users` row (owned by Supabase Auth).
- A **module** contains many **curriculum_days** (via `module_id` FK).
- A **profile** has many **daily_learning_entries** (via `profile_id` FK).
- A **daily_learning_entry** references one **curriculum_day** (via `day_number` FK).
- `ON DELETE RESTRICT` on `curriculum_days.module_id` prevents deleting a module that still has days.
- `ON DELETE RESTRICT` on `daily_learning_entries.day_number` prevents deleting a curriculum day that has journal entries.

---

## Triggers

| Trigger | Table | Function | Description |
|---------|-------|----------|-------------|
| `profiles_set_updated_at` | `profiles` | `handle_updated_at()` | Auto-sets `updated_at` on UPDATE |
| `modules_set_updated_at` | `modules` | `handle_updated_at()` | Auto-sets `updated_at` on UPDATE |
| `curriculum_days_set_updated_at` | `curriculum_days` | `handle_updated_at()` | Auto-sets `updated_at` on UPDATE |
| `daily_learning_entries_set_updated_at` | `daily_learning_entries` | `handle_updated_at()` | Auto-sets `updated_at` on UPDATE |

The `handle_updated_at()` function sets `NEW.updated_at = now()` before each UPDATE.

---

## Row Level Security (RLS)

All four tables have RLS **enabled** with restrictive policies:

- **`profiles`**: Owner-only access (`auth.uid() = id`) for all operations.
- **`modules`**: SELECT for authenticated users only; no write access for users.
- **`curriculum_days`**: SELECT for authenticated users only; no write access for users.
- **`daily_learning_entries`**: Owner-only access (`auth.uid() = profile_id`) for all operations.
- **Anonymous users**: No access to any table.
- **Service-role**: Bypasses all RLS (server-side only).

---

## Design Decisions

1. **`profiles.id` references `auth.users(id)`** — profiles are owned by Supabase Auth. When auth is implemented, Supabase automatically provides the user ID via `auth.uid()`.

2. **`day_number` is UNIQUE and CHECK-constrained** — prevents duplicate days and out-of-range values. This is the primary lookup key for the curriculum.

3. **`module_id` uses `ON DELETE RESTRICT`** — prevents accidental deletion of a module that still has curriculum days. Must remove days first.

4. **Content fields are typed, not JSON** — `subtopics` is `text[]`, `content` is `text`. This ensures data is always structured, queryable, and doesn't require parsing.

5. **`current_day` on profiles** — tracks the user's progress through the journey (1–105). Updated by the application as the user completes days.

6. **`journey_start_date` is a `date`** — not `timestamptz`, since the user picks a calendar date to start. Combined with `current_day`, the system can calculate which day the user is on.

7. **`hours` is `numeric(5,1)`** — supports decimal hours (e.g. `12.5` hours) for accurate time tracking.

8. **Indexes on common queries** — `day_number`, `module_id`, `week_number` are indexed for the most frequent access patterns (look up a day, filter by module, filter by week).

9. **Restrictive RLS** — policies enforce least-privilege access:
   - `profiles`: owner-only (auth.uid() = id) for all operations
   - `modules` / `curriculum_days`: SELECT for authenticated users only; no write access
   - `daily_learning_entries`: owner-only (auth.uid() = profile_id) for all operations
   - Anonymous users have no access to any table
   - Service-role bypasses all RLS (server-side only)
   See [SECURITY.md](./SECURITY.md) for full policy documentation.

10. **Journal references curriculum, doesn't duplicate** — `daily_learning_entries.day_number` FK references `curriculum_days(day_number)`. The journal stores the user's experience, not a copy of the curriculum.

11. **Unique user+day constraint** — `(profile_id, day_number)` UNIQUE prevents accidental duplicate entries for the same curriculum day.

12. **Controlled status enum** — `journal_status` (`draft` → `submitted` → `used`) provides a clear lifecycle without requiring a separate status table.

---

## Running Migrations

### Via Supabase CLI (local / CI)

```bash
supabase db push          # Apply to hosted Supabase project
supabase migration up     # Apply locally (requires supabase start)
```

### Via Supabase Dashboard

Copy the contents of `supabase/migrations/20260817000000_initial_schema.sql` into the SQL Editor at [app.supabase.com](https://app.supabase.com) → your project → SQL Editor → Run.

---

## Seeding Curriculum Data

Curriculum data is **never hardcoded in React components**. It is loaded from the database via Supabase queries.

To seed the 105-day curriculum:
1. Create a seed script in `scripts/seed-curriculum/`
2. The script inserts rows into `modules` and `curriculum_days`
3. Run via `supabase db seed` or a dedicated script

See `scripts/seed-curriculum/README.md` for details.
