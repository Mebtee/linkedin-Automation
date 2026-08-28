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

### `generated_posts` (Phase 3B)

AI-generated LinkedIn content derived from journal entries. Each post is created by an AI provider and persisted for later editing, approval, and publishing.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | **PK**, default `gen_random_uuid()` | Entry ID |
| `profile_id` | `uuid` | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Owner user |
| `journal_entry_id` | `uuid` | NOT NULL, FK → `daily_learning_entries(id)` ON DELETE CASCADE | Source journal entry |
| `day_number` | `integer` | NOT NULL, FK → `curriculum_days(day_number)` ON DELETE RESTRICT | Curriculum day |
| `status` | `post_status` | NOT NULL, default `'draft'` | Lifecycle status |
| `format` | `text` | NOT NULL | Post format (PostFormat type) |
| `opening` | `text` | NOT NULL | Opening hook line |
| `body` | `text` | NOT NULL | Main content body |
| `takeaway` | `text` | NOT NULL | Key takeaway |
| `next_step` | `text` | NOT NULL | Next step/focus |
| `hashtags` | `text[]` | NOT NULL, default `'{}'` | Hashtag strings |
| `image_headline` | `text` | nullable | Image headline (future) |
| `image_subheadline` | `text` | nullable | Image subheadline (future) |
| `image_keywords` | `text[]` | nullable | Image keywords (future) |
| `image_visual_concept` | `text` | nullable | Visual concept (future) |
| `image_template` | `text` | nullable | Template ID (future) |
| `provider` | `text` | NOT NULL | AI provider name |
| `model` | `text` | NOT NULL | AI model name |
| `tokens_used` | `integer` | nullable | Token count (if available) |
| `content_hash` | `text` | NOT NULL | SHA-256 hash for duplicate detection |
| `opportunity_id` | `uuid` | nullable, FK → `content_opportunities(id)` ON DELETE SET NULL | Source content opportunity (Phase 5C) |
| `recruiter_quality_score` | `integer` | nullable, check 0..100 | Deterministic post-quality score (Phase 5D) |
| `recruiter_quality_report` | `jsonb` | nullable | Safe post-quality report (Phase 5D) |
| `linkedin_post_id` | `text` | nullable | LinkedIn-assigned identifier (`urn:li:share:…`) after a successful publish (Phase 5E) |
| `published_at` | `timestamptz` | nullable | Timestamp of the successful manual/scheduled publish (Phase 5E) |
| `publish_error` | `text` | nullable | Display-safe error message from the last failed publish; cleared on success (Phase 5E) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Row creation time |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Auto-updated via trigger |

**Constraints:**
- `(profile_id, day_number, format, content_hash)` is **UNIQUE** — prevents duplicate content per user/day/format
- Allows multiple different drafts per day (different content)
- `day_number` FK references `curriculum_days(day_number)` — must be a valid day (1–105)
- `journal_entry_id` FK references `daily_learning_entries(id)` — must be a valid journal entry
- `profile_id` FK references `profiles(id)` — cascade delete when profile is removed
- `opportunity_id` (Phase 5C) is nullable so legacy posts are untouched; deleting an
  opportunity nulls the link via `ON DELETE SET NULL`. The `gp_opportunity_ownership`
  trigger enforces that an attached opportunity belongs to the same profile as the post.
- `recruiter_quality_score` / `recruiter_quality_report` (Phase 5D) are nullable and
  written only by the server-side `annotateGeneratedPostQuality`; the approve gate
  re-evaluates server-side before approving.
- `linkedin_post_id` / `published_at` / `publish_error` (Phase 5E) are written only by
  the server-side `publishPost` / scheduled publisher. `publish_error` stores a
  display-safe mapped message (never a raw provider response) and is cleared on a
  successful publish. Publishing is **manual and idempotent** — an already-published
  post is never re-posted.

**Indexes:**
- `idx_gp_profile_id` on `(profile_id)` — all posts for a user
- `idx_gp_day_number` on `(day_number)` — all posts for a curriculum day
- `idx_gp_profile_day` on `(profile_id, day_number)` — fast user+day lookup
- `idx_gp_profile_status` on `(profile_id, status)` — filter by status
- `idx_gp_journal_entry_id` on `(journal_entry_id)` — posts from a journal entry
- `idx_gp_content_hash` on `(content_hash)` — duplicate detection
- `idx_gp_opportunity_id` on `(opportunity_id)` — look up posts by opportunity
- `idx_gp_linkedin_post_id` on `(linkedin_post_id)` (partial, non-null) — published-post lookups

**Status lifecycle:**
- `draft` → `approved` → `published`
- `draft` → `failed`
- `published` and `failed` are terminal states
- For opportunity-backed posts, approving/publishing also advances the linked
  `content_opportunities` row (`approved` / `published`) — enforced server-side in
  `approvePost` / `publishPost` (Phase 5E).

---

### `media_assets`

Stores metadata for generated images. SVG files live in Supabase Storage; this table tracks metadata.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | **PK**, default `gen_random_uuid()` | Asset ID |
| `profile_id` | `uuid` | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Owner user |
| `generated_post_id` | `uuid` | NOT NULL, FK → `generated_posts(id)` ON DELETE CASCADE, UNIQUE | Source post |
| `storage_path` | `text` | NOT NULL | Supabase Storage path (`{profileId}/{postId}/image.svg`) |
| `storage_url` | `text` | NOT NULL | Public URL for accessing the asset |
| `mime_type` | `text` | NOT NULL, default `'image/svg+xml'` | MIME type |
| `width` | `integer` | NOT NULL | Image width in pixels |
| `height` | `integer` | NOT NULL | Image height in pixels |
| `template` | `text` | NOT NULL | Image template used for generation |
| `alt_text` | `text` | NOT NULL | Accessible alt text |
| `metadata` | `jsonb` | nullable | Additional metadata |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Last update timestamp |

**Indexes:**
- `idx_ma_profile_id` on `(profile_id)` — user's assets
- `idx_ma_generated_post_id` on `(generated_post_id)` — asset for a post
- `idx_ma_storage_path` on `(storage_path)` — storage lookup

**Constraints:**
- UNIQUE on `generated_post_id` — one image per generated post (replaced on regeneration)

---

### `linkedin_connections`

One row per authenticated user who has connected their LinkedIn account via OAuth. Stores access tokens server-side only — never exposed to the browser.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | **PK**, default `gen_random_uuid()` | Row ID |
| `profile_id` | `uuid` | NOT NULL, **UNIQUE**, FK → `profiles(id)` ON DELETE CASCADE | One active connection per user |
| `linkedin_sub` | `text` | NOT NULL | OpenID Connect subject identifier from LinkedIn |
| `access_token` | `text` | NOT NULL | OAuth 2.0 access token — server-side only |
| `token_type` | `text` | NOT NULL, default `'bearer'` | Token type |
| `expires_at` | `timestamptz` | nullable | Token expiration timestamp |
| `scope` | `text` | NOT NULL, default `'openid profile email'` | Granted OAuth scopes |
| `linkedin_name` | `text` | nullable | Display name from LinkedIn profile |
| `linkedin_email` | `text` | nullable | Primary email from LinkedIn profile |
| `created_at` / `updated_at` | `timestamptz` | NOT NULL, defaults / trigger | Timestamps |

**Constraints:**
- `profile_id` is **UNIQUE** — at most one active LinkedIn connection per user.

**Indexes:** `idx_lc_profile_id`, `idx_lc_linkedin_sub`.

---

### `scheduled_posts`

Tracks scheduled future LinkedIn publications. Lifecycle is independent from post content — a post can be edited/republished after initial scheduling.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | **PK**, default `gen_random_uuid()` | Row ID |
| `post_id` | `uuid` | NOT NULL, FK → `generated_posts(id)` ON DELETE CASCADE | Post to publish |
| `profile_id` | `uuid` | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Owner user |
| `scheduled_at` | `timestamptz` | NOT NULL | Target publication time (UTC) |
| `status` | `schedule_status` | NOT NULL, default `'scheduled'` | See lifecycle below |
| `published_at` | `timestamptz` | nullable | Actual publication timestamp |
| `linkedin_post_id` | `text` | nullable | LinkedIn post ID after successful publish |
| `last_error` | `text` | nullable | Error message from last failed attempt |
| `attempt_count` | `integer` | NOT NULL, default `0` | Publishing attempts made |
| `created_at` / `updated_at` | `timestamptz` | NOT NULL, defaults / trigger | Timestamps |

**Status lifecycle** (`schedule_status` enum):
- `scheduled` → `publishing` → `published` | `failed`
- `scheduled` → `cancelled`

**Partial unique index:** `idx_sp_one_active_per_post` — at most one row with `status = 'scheduled'` per `post_id`.

**Indexes:** `idx_sp_status_scheduled_at` (partial, for cron publisher), `idx_sp_profile_id`, `idx_sp_post_id`.

---

### `course_materials`

One row per uploaded course PDF (Phase 3I/3J). Tracks processing state and holds the
final journal proposal. See [COURSE_PDF_INGESTION.md](COURSE_PDF_INGESTION.md).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | **PK**, default `gen_random_uuid()` | Document ID |
| `profile_id` | `uuid` | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Owner user |
| `file_name` | `text` | NOT NULL | Sanitized original filename |
| `storage_path` | `text` | NOT NULL, default `''` | Private storage path (`{profileId}/{docId}/{fileName}`) |
| `page_count` | `integer` | NOT NULL, default `0`, CHECK ≥ 0 | Extracted page count |
| `processing_status` | `text` | NOT NULL, default `'processing'`, CHECK in (`processing`,`completed`,`failed`) | Ingestion lifecycle |
| `error_code` | `text` | nullable | AppError code when `failed` (e.g. `PDF_EXTRACTION_FAILED`) |
| `journal_proposal` | `jsonb` | nullable | Full `CourseJournalProposal` (fields + evidence + candidates) |
| **`content_hash`** | `text` | nullable | SHA-256 hash of raw PDF bytes for duplicate detection |
| **`multi_day_sections`** | `jsonb` | nullable | Array of `{dayNumber, startPage, endPage, confidence}` for multi-day PDFs |
| `created_at` / `updated_at` | `timestamptz` | NOT NULL, defaults / trigger | Timestamps |

**Indexes:** `idx_cm_profile_id`, `idx_cm_status`, `idx_cm_created_at`, **`idx_cm_content_hash`** on `(profile_id, content_hash)`.

---

### `course_material_pages`

Extracted text per PDF page; enables page-precise evidence citations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | **PK**, default `gen_random_uuid()` | Page row ID |
| `course_material_id` | `uuid` | NOT NULL, FK → `course_materials(id)` ON DELETE CASCADE | Parent document |
| `page_number` | `integer` | NOT NULL, CHECK ≥ 1 | 1-based page index |
| `extracted_text` | `text` | NOT NULL | Text extracted from the page |

**Indexes:** `idx_cmp_material_page` on `(course_material_id, page_number)` — UNIQUE.

---

### `content_opportunities` (Phase 5B)

Recruiter-focused content opportunities derived from **confirmed** evidence. Rows are
deterministic candidates (`candidate` → `selected` → later phases generate the actual
post text into `generated_posts`). Creating a row here **never** publishes anything.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | **PK**, default `gen_random_uuid()` | Row ID |
| `profile_id` | `uuid` | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Owner user |
| `source_type` | `text` | NOT NULL, CHECK in (`course-material`,`journal`,`project-evidence`) | Where the evidence came from |
| `source_id` | `uuid` | nullable | Source journal entry / course material id (no FK — sources vary) |
| `day_number` | `integer` | nullable, CHECK `1–105` | Curriculum day the evidence belongs to |
| `module_number` | `integer` | nullable | Curriculum module number |
| `post_type` | `text` | NOT NULL, CHECK in the 12 Phase 5A post types | `PROJECT_SHOWCASE`, `PROBLEM_SOLUTION`, … `CAREER_PROGRESS` |
| `content_goal` | `text` | NOT NULL, default `'GET_RECRUITER_ATTENTION'`, CHECK in the 6 goals | Goal the row was scored against |
| `title` | `text` | NOT NULL | Concise opportunity title |
| `summary` | `text` | nullable | Short evidence-backed summary |
| `evidence` | `jsonb` | NOT NULL, default `'[]'` | `[{ field, pageNumbers, confidence }]` references — no hashes, no secrets |
| `recruiter_score` | `numeric` | NOT NULL, default `0`, CHECK `0–100` | Deterministic Phase 5A score |
| `recruiter_score_breakdown` | `jsonb` | NOT NULL, default `'{}'` | Stored `RecruiterScore` — never chain-of-thought |
| `selection_reason` | `text` | nullable | Concise public reason set when selected as best |
| `status` | `text` | NOT NULL, default `'candidate'`, CHECK in the 6 statuses | Lifecycle |
| `dedup_key` | `text` | nullable | Deterministic key; upserts skip existing `(profile_id, dedup_key)` |

**Constraints:**
- `(profile_id, dedup_key)` is **UNIQUE** — re-generating a day never duplicates rows.
- `status` lifecycle: `candidate` → `selected` → `generated` → `approved` → `published`; any non-published state may be `rejected`. Enforced in the service layer (`ALLOWED_OPPORTUNITY_STATUS_TRANSITIONS`).

**Indexes:**
- `idx_co_profile_id`, `idx_co_profile_status` on `(profile_id, status)`, `idx_co_profile_score` on `(profile_id, recruiter_score)`, `idx_co_source_id`, `idx_co_day_number`.

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
  ├── 1:N (profile_id FK)
  │   ▼
  │ daily_learning_entries
  │   │
  │   └── N:1 (day_number FK → curriculum_days)
  │
  ├── 1:N (profile_id FK)
  │   ▼
  │ generated_posts
  │   │
  │   ├── N:1 (journal_entry_id → daily_learning_entries.id) ON DELETE CASCADE
  │   ├── N:1 (day_number → curriculum_days.day_number) ON DELETE RESTRICT
  │   ├── 1:0..1 (generated_post_id → media_assets)
  │   └── 1:0..N (post_id → scheduled_posts)
  │
  ├── 1:N (profile_id FK)
  │   ▼
  │ linkedin_connections
  │
  ├── 1:N (profile_id FK)
  │   ▼
  │ scheduled_posts
  │   └── N:1 (post_id → generated_posts.id) ON DELETE CASCADE
  │
  ├── 1:N (profile_id FK)
  │   ▼
  │ media_assets
  │   └── N:1 (generated_post_id → generated_posts.id) ON DELETE CASCADE
  │
  └── 1:N (profile_id FK)
      ▼
    course_materials
      │
      ├── 1:N (course_material_id FK) ON DELETE CASCADE
      │   ▼
      │ course_material_pages
      │
      └── journal_proposal → feeds daily_learning_entries via existing
          saveJournal()/submitJournal() actions (no FK — proposals are data)

profiles ── 1:N (profile_id FK) ──► content_opportunities
  ├── source: daily_learning_entries (journal path, confirmed)
  ├── source: course_materials (proposal path, unconfirmed → learning-only)
  └── feeds: generated_posts via generated_posts.opportunity_id (Phase 5C)
```

- A **profile** belongs to one `auth.users` row (owned by Supabase Auth).
- A **module** contains many **curriculum_days** (via `module_id` FK).
- A **profile** has many **daily_learning_entries** (via `profile_id` FK).
- A **daily_learning_entry** references one **curriculum_day** (via `day_number` FK).
- A **profile** has many **generated_posts** (via `profile_id` FK).
- A **generated_post** references one **daily_learning_entry** (via `journal_entry_id` FK).
- A **generated_post** references one **curriculum_day** (via `day_number` FK).
- A **generated_post** has zero or one **media_asset** (via `generated_post_id` FK, UNIQUE).
- A **generated_post** has zero or more **scheduled_posts** (via `post_id` FK).
- A **profile** has zero or one **linkedin_connection** (via `profile_id` FK, UNIQUE).
- A **media_asset** references one **generated_post** (via `generated_post_id` FK) and one **profile** (via `profile_id` FK).
- A **scheduled_post** references one **generated_post** (via `post_id` FK) and one **profile** (via `profile_id` FK).
- A **profile** has many **course_materials** (via `profile_id` FK); a course material has many **course_material_pages** (via `course_material_id` FK).
- A **profile** has many **content_opportunities** (via `profile_id` FK), sourced from `daily_learning_entries` (journal path) or `course_materials` (proposal path).
- A **generated_post** references zero or one **content_opportunity** (via `opportunity_id` FK, `ON DELETE SET NULL`, Phase 5C).
- `ON DELETE RESTRICT` on `curriculum_days.module_id` prevents deleting a module that still has days.
- `ON DELETE RESTRICT` on `daily_learning_entries.day_number` prevents deleting a curriculum day that has journal entries.
- `ON DELETE RESTRICT` on `generated_posts.day_number` prevents deleting a curriculum day that has generated posts.
- `ON DELETE CASCADE` on `generated_posts.journal_entry_id` removes posts when their source journal entry is deleted.
- `ON DELETE SET NULL` on `generated_posts.opportunity_id` keeps posts when their source opportunity is deleted (Phase 5C).

---

## Triggers

| Trigger | Table | Function | Description |
|---------|-------|----------|-------------|
| `profiles_set_updated_at` | `profiles` | `handle_updated_at()` | Auto-sets `updated_at` on UPDATE |
| `modules_set_updated_at` | `modules` | `handle_updated_at()` | Auto-sets `updated_at` on UPDATE |
| `curriculum_days_set_updated_at` | `curriculum_days` | `handle_updated_at()` | Auto-sets `updated_at` on UPDATE |
| `daily_learning_entries_set_updated_at` | `daily_learning_entries` | `handle_updated_at()` | Auto-sets `updated_at` on UPDATE |
| `generated_posts_set_updated_at` | `generated_posts` | `handle_updated_at()` | Auto-sets `updated_at` on UPDATE |
| `media_assets_set_updated_at` | `media_assets` | `handle_updated_at()` | Auto-sets `updated_at` on UPDATE |
| `linkedin_connections_set_updated_at` | `linkedin_connections` | `handle_updated_at()` | Auto-sets `updated_at` on UPDATE |
| `scheduled_posts_set_updated_at` | `scheduled_posts` | `handle_updated_at()` | Auto-sets `updated_at` on UPDATE |
| `course_materials_set_updated_at` | `course_materials` | `handle_updated_at()` | Auto-sets `updated_at` on UPDATE |
| `content_opportunities_set_updated_at` | `content_opportunities` | `handle_updated_at()` | Auto-sets `updated_at` on UPDATE |
| `gp_opportunity_ownership` | `generated_posts` | `gp_check_opportunity_ownership()` | Phase 5C: rejects INSERT/UPDATE when an attached `opportunity_id` belongs to a different profile than the post |

The `handle_updated_at()` function sets `NEW.updated_at = now()` before each UPDATE.

---

## Row Level Security (RLS)

All ten tables have RLS **enabled** with restrictive policies:

- **`profiles`**: Owner-only access (`auth.uid() = id`) for all operations.
- **`modules`**: SELECT for authenticated users only; no write access for users.
- **`curriculum_days`**: SELECT for authenticated users only; no write access for users.
- **`daily_learning_entries`**: Owner-only access (`auth.uid() = profile_id`) for all operations.
- **`generated_posts`**: Owner-only access (`auth.uid() = profile_id`) for all operations.
- **`media_assets`**: Owner-only access (`auth.uid() = profile_id`) for all operations.
- **`linkedin_connections`**: Owner-only access (`auth.uid() = profile_id`) for all operations. At most one row per user (UNIQUE on `profile_id`).
- **`scheduled_posts`**: Owner-only access (`auth.uid() = profile_id`) for all operations. The cron publisher uses the service-role key to bypass RLS.
- **`course_materials`**: Owner-only access (`auth.uid() = profile_id`) for all operations.
- **`course_material_pages`**: Owner-only via join (`EXISTS (SELECT 1 FROM course_materials cm WHERE cm.id = course_material_id AND cm.profile_id = auth.uid())`) for SELECT/INSERT/UPDATE/DELETE.
- **`content_opportunities`**: Owner-only access (`auth.uid() = profile_id`) for all operations (`co_select_own` / `co_insert_own` / `co_update_own` / `co_delete_own`).
- **Storage buckets**: `post-images` and `course-materials` are **private**; access goes through authenticated server routes. The `course-materials` bucket additionally restricts object paths to `{profile_id}/…` prefixes.
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

13. **Generated posts use content hash for duplicate detection** — `content_hash` is a SHA-256 hash of normalized post content. The unique constraint on `(profile_id, day_number, format, content_hash)` prevents exact duplicate content while allowing multiple different drafts per day.

14. **Generated posts reference journal entries** — `journal_entry_id` FK links each generated post to its source journal entry. CASCADE delete ensures posts are removed when their journal entry is deleted.

15. **Generated posts use RESTRICT on day_number** — prevents deleting curriculum days that have generated posts, maintaining data integrity.

16. **Image metadata preserved but not generated** — `image_headline`, `image_subheadline`, `image_keywords`, `image_visual_concept`, `image_template` columns store structured image data for future image-generation phases without requiring a schema redesign.

17. **Post status lifecycle is minimal** — `draft` → `approved` → `published` (with `failed` for errors). No unnecessary states. Terminal states (`published`, `failed`) cannot be reverted.

18. **Media assets use UNIQUE on generated_post_id** — one image per generated post. On regeneration, the old asset is replaced (delete + insert) rather than creating uncontrolled duplicates.

19. **Media assets reference both profile and post** — `profile_id` for RLS ownership, `generated_post_id` for the associated post. CASCADE delete ensures assets are removed when their post is deleted.

20. **Storage path prevents collisions** — `{profile_id}/{post_id}/image.svg` ensures users cannot accidentally overwrite each other's files.

21. **Media assets store metadata separately from storage** — the `media_assets` table tracks dimensions, template, alt text, and metadata. The actual SVG lives in Supabase Storage.

22. **linkedin_connections uses UNIQUE on profile_id** — one active LinkedIn connection per user. Tokens are stored server-side only; anon/RLS policies prevent client reads.

23. **scheduled_posts uses a partial unique index** — only `status = 'scheduled'` rows are unique per `post_id`, allowing a post to be rescheduled after cancellation or failure.

24. **schedule_status enum** — typed lifecycle (`scheduled` → `publishing` → `published` | `failed`, or `scheduled` → `cancelled`) keeps the state machine explicit at the database level.

25. **Content opportunities are evidence-traceable, never fabricated** — every `content_opportunities` row stores `evidence` references (`field` + PDF `pageNumbers` + `confidence`). Personal post types are only built from `USER_CONFIRMED` journal evidence; course proposals can only produce learning post types (`TECHNICAL_LESSON` / `LEARNING_MILESTONE`).

26. **Deterministic scoring, stored once** — `recruiter_score` / `recruiter_score_breakdown` are written at creation time from Phase 5A's deterministic scorer. Re-selection ranks stored scores; it never re-runs the scorer and never stores chain-of-thought.

27. **Idempotent regeneration via `dedup_key`** — the builder derives a stable hash (`source_type::day::post_type::slug(title)`) and upserts with `ignoreDuplicates`, so generating a day twice never duplicates rows.

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

---

## Backup & Recovery

### Supabase-managed backups

Hosted Supabase projects enable **automatic daily backups** by default (retain
the project's plan and restore window). You can also take an on-demand backup
from the Dashboard: **Project → Database → Backups → Create a backup**.

Verify backups are healthy periodically (a backup you never test is not a
backup). Test a restore in a throwaway project at least once per release cycle.

### Logical dumps (portable, for staging / local)

SQL dumps capture schema + data in plain SQL and can be restored into any
Postgres-backed environment (local, staging, new project). They do **not**
include storage objects.

```bash
# Dump
supabase db dump --data-only > backup_$(date +%Y%m%d_%H%M).sql

# Restore into a target database
supabase db reset --db-url "$TARGET_DB_URL" --seed-file ...   # target env specific
```

### What the tables hold (restore implications)

| Data | Location | Restore note |
| --- | --- | --- |
| User profiles, journals, posts, media metadata, LinkedIn connections, schedules | Postgres tables | Restored by a SQL dump. |
| Generated image SVGs (`post-images`) and course PDFs (`course-materials`) | Supabase **Storage** | **Not** in a SQL dump — back these up with the Storage backup / export tooling. |
| Curriculum (`modules`, `curriculum_days`) | Postgres tables | Re-creatable via `pnpm seed:curriculum` if lost. |

### Recovery procedures

- **Point-in-time (PITR) / last-daily-backup**: use the Dashboard's Backup →
  Restore to recover to a specific time before the incident.
- **Storage-only loss**: re-import `post-images` / `course-materials` objects;
  row metadata survives in Postgres.
- **LinkedIn tokens are server-side only**: they are stored in
  `linkedin_connections` and are covered by Postgres dumps. If a dump is lost,
  users re-authorize via Settings (Reauthorize); publish scope is re-requested.

### Backup hygiene

1. Keep dumps outside the git repo (they contain PII and encrypted secrets —
   never commit them).
2. Egress dumps over a trusted channel; treat them as secrets.
3. Add a recurring (e.g. weekly) restore smoke-test to CI or a scheduled task.

