# Generated Posts — Phases 3B & 5E

## Purpose

The `generated_posts` table stores AI-generated LinkedIn content derived from a user's journal entries. Each post is created by an AI provider (or the fallback template) and persisted for later editing, approval, and publishing.

Journal entries can originate two ways: typed manually on `/journal`, or
pre-filled automatically from an uploaded course PDF via the Phase 3I/3J pipeline
(`/course-materials` — see [COURSE_PDF_INGESTION.md](COURSE_PDF_INGESTION.md)).
Both paths converge on the same `submitJournal()` → generation flow; nothing in
this document's pipeline changed.

> **Phase 5B/5C (recruiter content opportunities)** adds a *selection layer* **before**
> post generation. Phase 5B deterministically builds candidates (12 post types,
> scored 0–100) from confirmed evidence into the `content_opportunities` table
> (`candidate` status). Phase 5C generates a draft from a **selected** opportunity
> through this same single `generated_posts` pipeline: the adapter builds a
> recruiter-aware `PostGenerationInput` (opportunity + evidence ground truth, via
> `src/services/recruiter/generation.ts` → `src/services/ai/generation.ts`), and the
> persisted post stores `opportunity_id`. Generation never approves or publishes.
> See [RECRUITER_CONTENT.md](RECRUITER_CONTENT.md).

> **Phase 5E (workflow, approval UX & manual LinkedIn publishing)** completes the
> journey: a polished `/opportunities` dashboard ("Recommended for You", state-driven
> per-step cards), a deterministic post-quality review in the editor
> (`PostPreview` shows a "Draft — Not Published" badge), a manual Publish dialog on
> approved posts, idempotent publishing with safe error mapping, and automatic
> opportunity status sync (`approved` on approval, `published` on publish).
> Publishing is **never automatic** — only the user's explicit action publishes.

## Architecture

```
Journal Entry
     ↓
PostGenerationInput (Phase 3A)
     ↓
AI Provider (Phase 3A interface)
     ↓
ProviderResult (post + image metadata)
     ↓
generated_posts (Phase 3B persistence)
     ↓
Post Editor → Approval → Manual LinkedIn Publishing (Phases 3D/5E)
```

## Database Schema

### Table: `generated_posts`

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
| `opportunity_id` | `uuid` | nullable, FK → `content_opportunities(id)` ON DELETE SET NULL | Linked Phase 5B/5C content opportunity |
| `recruiter_quality_score` | `integer` | nullable, check 0..100 | Deterministic post-quality score (Phase 5D) |
| `recruiter_quality_report` | `jsonb` | nullable | Safe post-quality report (Phase 5D) |
| `linkedin_post_id` | `text` | nullable | LinkedIn-assigned identifier (`urn:li:share:…`) after a successful publish |
| `published_at` | `timestamptz` | nullable | Timestamp of the successful manual/scheduled publish |
| `publish_error` | `text` | nullable | Display-safe error details from the last failed publish (cleared on success) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Last update timestamp |

### Enum: `post_status`

```sql
create type public.post_status as enum ('draft', 'approved', 'published', 'failed');
```

### Constraints

- `generated_posts_user_day_format_hash_unique` — UNIQUE on `(profile_id, day_number, format, content_hash)`

This allows multiple different drafts per day (different content) but prevents exact duplicate content.

### Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_gp_profile_id` | `profile_id` | User's posts |
| `idx_gp_day_number` | `day_number` | Day lookup |
| `idx_gp_profile_day` | `profile_id, day_number` | User's posts for a day |
| `idx_gp_profile_status` | `profile_id, status` | User's posts by status |
| `idx_gp_journal_entry_id` | `journal_entry_id` | Posts from a journal entry |
| `idx_gp_content_hash` | `content_hash` | Duplicate detection |

## Relationships

```
profiles
  └── 1:N (profile_id)
        ▼
  generated_posts
        │
        ├── N:1 (journal_entry_id → daily_learning_entries.id) ON DELETE CASCADE
        │
        └── N:1 (day_number → curriculum_days.day_number) ON DELETE RESTRICT
```

**ON DELETE decisions:**
- `profile_id → profiles(id)`: CASCADE — deleting a user removes their posts
- `journal_entry_id → daily_learning_entries(id)`: CASCADE — deleting a journal entry removes its posts
- `day_number → curriculum_days(day_number)`: RESTRICT — cannot delete curriculum data that has generated posts

## Status Lifecycle

```
draft → approved → published
draft → failed
```

**Legal transitions:**
- `draft` → `approved` (post approved for publishing)
- `draft` → `failed` (generation/persistence error)
- `approved` → `published` (published to LinkedIn)

**Terminal states:**
- `published` — no further transitions allowed
- `failed` — no further transitions allowed

## Duplicate Strategy

**Same user + same day + same format + same content → BLOCKED**
**Same user + same day + same format + different content → ALLOWED**

This means:
- A user can generate multiple drafts for the same day if the content differs
- Exact duplicate content is prevented by the unique constraint on `(profile_id, day_number, format, content_hash)`
- The `content_hash` is a SHA-256 hash of normalized post content

## Content Hashing

The content hash is deterministic:

```
normalizePostContent() → SHA-256 → hex string
```

**Normalization:**
1. Trim whitespace from each text field
2. Lowercase all text
3. Sort hashtags alphabetically
4. Concatenate with `|||` separator

**Hashed fields:** `opening`, `body`, `takeaway`, `nextStep`, `hashtags`
**NOT hashed:** timestamps, provider metadata, random IDs

## Journal Relationship

Each generated post references a specific journal entry. When creating a post:

1. The journal entry must exist
2. The journal entry must belong to the authenticated user
3. The journal entry's day must match the requested day number
4. The curriculum day must exist

Generated posts are **derived data** — they do not modify journal entries.

## RLS Policies

| Policy | Operation | Rule |
|--------|-----------|------|
| `gp_select_own` | SELECT | `auth.uid() = profile_id` |
| `gp_insert_own` | INSERT | `auth.uid() = profile_id` |
| `gp_update_own` | UPDATE | `auth.uid() = profile_id` (using + with check) |
| `gp_delete_own` | DELETE | `auth.uid() = profile_id` |

Anonymous access: denied by default.

## Service Layer

Located at `src/services/generated-posts/`:

| File | Purpose |
|------|---------|
| `index.ts` | Service functions (CRUD, auth, ownership) |
| `validation.ts` | Input validation, status transitions |
| `hashing.ts` | Deterministic content hashing |
| `posts.test.ts` | Unit tests |

### Operations

| Function | Auth | Description |
|----------|------|-------------|
| `createGeneratedPost(input)` | Required | Create a new generated post |
| `getGeneratedPost(postId)` | Required | Get a single post by ID |
| `getGeneratedPostsForDay(dayNumber)` | Required | Get all posts for a day |
| `getGeneratedPostHistory()` | Required | Get all user's posts |
| `updateGeneratedPost(postId, input)` | Required | Update post fields |
| `changeGeneratedPostStatus(postId, status)` | Required | Change post status |
| `deleteGeneratedPost(postId)` | Required | Delete a draft/failed post |
| `checkDuplicatePost(userId, day, format, hash)` | System | Check for duplicate content |

### Delete Rules

Only `draft` and `failed` posts can be deleted. `published` posts cannot be deleted.

## Validation

- Day number: 1–105 (uses `brand.totalDays`)
- Post format: must be a valid `PostFormat` value
- Status: must be a valid `GeneratedPostStatus` value
- Status transitions: enforced by `ALLOWED_POST_STATUS_TRANSITIONS`
- Required fields: opening, body, takeaway, next_step, hashtags, provider, model, content_hash
- Journal entry: must exist, must belong to user, must match day number

## AI Generation Flow (Phase 3C)

```
1. User submits journal entry
2. User calls generatePost({ dayNumber })
3. Server Action authenticates user
4. Generation Service loads curriculum day + module
5. Generation Service loads journal entry (must be submitted)
6. Input Builder maps data to PostGenerationInput
7. Provider generates post content
8. Validation Service validates output
9. Content hash calculated (SHA-256)
10. Duplicate check (user + day + format + hash)
11. Post persisted to generated_posts (status: draft)
12. User reviews/edits in Post Editor (future)
13. User approves post (future)
14. System publishes to LinkedIn (future)
```

### Generation Service

`src/services/ai/generation.ts` — orchestrates the full workflow:

- Requires authenticated user
- Requires submitted journal entry
- Uses deterministic format rotation unless explicit format provided
- Validates all provider output
- Prevents duplicate content
- Returns saved `GeneratedPostRow` with `draft` status

### Server Action

`src/app/actions/post-generation.ts` — thin wrapper:

```typescript
const result = await generatePost({ dayNumber: 1 });
// { success: true, post: GeneratedPostRow }
// { success: false, error: { code: string, message: string } }
```

### Error Handling

| Error Code | Trigger |
|------------|---------|
| `GENERATION_UNAUTHORIZED` | Not logged in |
| `CURRICULUM_NOT_FOUND` | Day has no curriculum |
| `JOURNAL_NOT_FOUND` | No journal entry for day |
| `JOURNAL_NOT_SUBMITTED` | Journal is still draft |
| `GENERATION_DUPLICATE` | Identical content exists |
| `GENERATION_FAILED` | Provider or validation error |

## What's NOT Implemented Yet

- ✅ AI provider interface (Phase 3A)
- ✅ Post database persistence (Phase 3B)
- ✅ Post generation service (Phase 3C)
- ✅ Post editor UI (Phase 3D)
- ✅ Image generation (Phase 3E)
- ✅ LinkedIn publishing — **manual** (Phase 5E), via `publishPost` + `PublishDialog`
- ✅ Post scheduling (Phase 4, cron publisher)
- ❌ Content analytics

## Post Editor UI (Phase 3D)

### Pages

| Route | Purpose |
|-------|---------|
| `/posts` | List all generated posts with filters, search, and status badges |
| `/posts/[id]` | View and edit a single generated post |

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `PostEditor` | `post-editor.tsx` | Main editor with form fields, preview, metadata, actions |
| `PostList` | `post-list.tsx` | Filterable/searchable post list |
| `PostCard` | `post-card.tsx` | Post card for list view |
| `PostPreview` | `post-preview.tsx` | LinkedIn-style text preview |
| `PostMetadata` | `post-metadata.tsx` | Post info + image metadata |
| `PostStatusBadge` | `post-status-badge.tsx` | Status indicator |
| `PostActions` | `post-actions.tsx` | Action buttons (save, approve, regenerate, delete) |
| `ImageSection` | `image-section.tsx` | Image preview, generate, regenerate, download |
| `ApprovePostDialog` | `approve-post-dialog.tsx` | Approval confirmation |
| `DeletePostDialog` | `delete-post-dialog.tsx` | Deletion confirmation |
| `PublishDialog` | `publish-dialog.tsx` | Manual publication confirmation (Phase 5E), shown when a post is approved |

### Server Actions

`src/app/actions/generated-posts.ts`:

| Action | Description |
|--------|-------------|
| `getPost(postId)` | Load a single post |
| `getPostHistory()` | Load all user posts |
| `updatePost(postId, input)` | Save content edits (re-evaluates recruiter quality when opportunity-backed) |
| `approvePost(postId)` | Transition draft → approved (runs the Phase 5D quality gate for opportunity-backed posts) |
| `regenerateOpportunityPost(opportunityId)` | User-triggered regeneration of an opportunity post (Phase 5D) |
| `deletePost(postId)` | Delete draft/failed posts |
| `regeneratePost(dayNumber, format?)` | Generate new post for same day |
| `publishPost(postId)` | Manually publish an approved post to LinkedIn (Phase 5E) |

### Manual Publishing (Phase 5E)

Publishing an approved post is a deliberate, user-triggered action — there is no
automatic publishing path. `publishPost(postId)` verifies, on the server:

1. The post exists and belongs to the authenticated user.
2. The post is `approved` (an unapproved draft is rejected with `INVALID_STATUS`).
3. An active LinkedIn connection exists for the user (token not expired).
4. The connection grants the publish scope `w_member_social` (`INSUFFICIENT_SCOPE`).
5. The post is **not already published** — publishing again is **idempotent** and
   simply returns the existing published result with no new LinkedIn call.
6. For opportunity-backed posts, the Phase 5D quality gate is **re-checked** at
   publish time; a `do_not_publish` finding blocks with `QUALITY_GATE_BLOCKED`.
7. The LinkedIn UGC API call succeeds; the result stores `linkedin_post_id`,
   `published_at`, and clears `publish_error`.

Failures return a **display-safe, mapped error** (never a raw provider error):

| Code | Meaning |
|------|---------|
| `LINKEDIN_TOKEN_INVALID` | 401 / login failure — "Your LinkedIn connection is no longer valid. Please reconnect." |
| `LINKEDIN_TOKEN_EXPIRED` | Stored token is past `expires_at` — prompt to reconnect. |
| `INSUFFICIENT_SCOPE` | Missing `w_member_social` — reconnect with publishing permissions. |
| `LINKEDIN_RATE_LIMITED` | 429 — retry later. |
| `LINKEDIN_UNAVAILABLE` / `LINKEDIN_UNREACHABLE` | 5xx / network failure. |
| `PUBLISH_FAILED` | Any other failure |

Only the mapped message is stored in `publish_error`. On success the linked
`content_opportunity` is advanced to `published` (best-effort, owner-scoped).

### Status-Based Actions

| Status | Edit | Save | Approve | Publish | Regenerate | Delete |
|--------|------|------|---------|---------|------------|--------|
| Draft | Yes | Yes | Yes | No | Yes | Yes |
| Failed | Yes | Yes | No | No | Yes | Yes |
| Approved | No | No | No | Yes (Publish dialog) | No | No |
| Published | No | No | No | No | No | No |

### Recruiter Quality Gate (Phase 5D)

For opportunity-backed posts (`opportunity_id` set), the editor shows a
`RecruiterQualityPanel` (score, recommendation, dimension bars, strengths,
improvements, warnings) and an `OpportunitySummaryPanel` with the stored Phase 5B
selection. See [RECRUITER_CONTENT.md](RECRUITER_CONTENT.md).

`approvePost` **always re-evaluates** the post server-side before changing
status:

- Strong / Ready → approved.
- Needs review → approved only after explicit confirmation in the approve dialog.
- Below 55 or a critical safety finding (unsupported "I built…" claim, missing
  required section) → blocked with `QUALITY_GATE_BLOCKED`; status never changes.

`updatePost` returns a freshly recomputed report so the panel reflects edits;
`regenerateOpportunityPost` re-runs generation and re-evaluates.

### Editor Behavior

- **Draft/Failed posts**: Editable — all fields can be modified
- **Approved posts**: Read-only — no editing allowed
- **Published posts**: Read-only — fully protected
- **Saving**: Only updates content, never changes status
- **Approval**: Requires explicit confirmation dialog
- **Publishing**: Only from an approved post, via the Publish dialog
- **Regeneration**: Creates a new post, preserves old until new succeeds
- **Deletion**: Only draft/failed posts, requires confirmation

### Image Section

The editor sidebar includes an `ImageSection` component that provides:
- Image preview (rendered SVG)
- Template selector (auto-select or manual choice)
- Generate image button (for posts without images)
- Regenerate button (for posts with existing images)
- Download SVG button
- Image generation status and template display

Image concerns are completely separate from text editing. Editing post text does not regenerate the image.

Since Phase 5H, images generated from the editor are **post-aware**: the renderer
builds a visual brief from the post's final text, picks a concept-priority
composition and a recruiter-aware emphasis, and validates the brief for
unsupported claims before rendering. Regenerating an image reflects the current
(saved) post content. See [IMAGE_GENERATION.md](IMAGE_GENERATION.md#visual-brief-system-phase-5g--5h).

Since Phase 5I images are **landscape 1200×675 (16:9)**: the brand canvas is the
single source of truth for the SVG `viewBox`/size and the rasterized PNG, and
every composition is laid out for the landscape feed (left concept header,
centered main visual, bottom secondary band, safe 60/40px margins). See
[IMAGE_GENERATION.md](IMAGE_GENERATION.md#phase-5i--landscape-1200675-169--post-visual--engagement-quality-upgrades).

The **published text structure** is:
`opening → body → takeaway → portfolio link → CTA → hashtags`. The
call-to-action comes from `src/config/content.ts` (`content.cta`) and is picked
deterministically by post format via `src/services/linkedin/cta.ts`
(`selectCta`); it is appended exactly once at the end — never inside the body and
never repeated. The internal `next_step` remains intentionally unpublished.

### Image Actions

| Action | Description |
|--------|-------------|
| `generatePostImageAction(postId)` | Generate a new branded image |
| `regeneratePostImageAction(postId, template?)` | Regenerate with optional template override |
| `getPostImageAction(postId)` | Get existing image metadata |

### Testing

113+ new tests covering:
- Server Actions (getPost, updatePost, approvePost, deletePost, regeneratePost, publishPost)
- Component rendering (status badges, cards, previews, metadata)
- User interactions (filtering, search, save, approve, delete, regenerate, publish)
- Dialog behavior (open, close, confirm, cancel; publish dialog re-gates + shows safe errors)
- Accessibility (roles, aria attributes)
- Loading/disabled states
- Error handling
- Publish idempotency and error mapping (see `publish-dialog.test.tsx`, `full-journey.e2e.test.ts`)
