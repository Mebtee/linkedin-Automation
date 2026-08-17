# Generated Posts — Phase 3B

## Purpose

The `generated_posts` table stores AI-generated LinkedIn content derived from a user's journal entries. Each post is created by an AI provider (or the fallback template) and persisted for later editing, approval, and publishing.

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
Future: Post Editor → Approval → LinkedIn Publishing
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
- ❌ LinkedIn publishing
- ❌ Post scheduling
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

### Server Actions

`src/app/actions/generated-posts.ts`:

| Action | Description |
|--------|-------------|
| `getPost(postId)` | Load a single post |
| `getPostHistory()` | Load all user posts |
| `updatePost(postId, input)` | Save content edits |
| `approvePost(postId)` | Transition draft → approved |
| `deletePost(postId)` | Delete draft/failed posts |
| `regeneratePost(dayNumber, format?)` | Generate new post for same day |

### Editor Behavior

- **Draft/Failed posts**: Editable — all fields can be modified
- **Approved posts**: Read-only — no editing allowed
- **Published posts**: Read-only — fully protected
- **Saving**: Only updates content, never changes status
- **Approval**: Requires explicit confirmation dialog
- **Regeneration**: Creates a new post, preserves old until new succeeds
- **Deletion**: Only draft/failed posts, requires confirmation

### Status-Based Actions

| Status | Edit | Save | Approve | Regenerate | Delete |
|--------|------|------|---------|------------|--------|
| Draft | Yes | Yes | Yes | Yes | Yes |
| Failed | Yes | Yes | No | Yes | Yes |
| Approved | No | No | No | No | No |
| Published | No | No | No | No | No |

### Image Section

The editor sidebar includes an `ImageSection` component that provides:
- Image preview (rendered SVG)
- Template selector (auto-select or manual choice)
- Generate image button (for posts without images)
- Regenerate button (for posts with existing images)
- Download SVG button
- Image generation status and template display

Image concerns are completely separate from text editing. Editing post text does not regenerate the image.

### Image Actions

| Action | Description |
|--------|-------------|
| `generatePostImageAction(postId)` | Generate a new branded image |
| `regeneratePostImageAction(postId, template?)` | Regenerate with optional template override |
| `getPostImageAction(postId)` | Get existing image metadata |

### Testing

113 new tests covering:
- Server Actions (getPost, updatePost, approvePost, deletePost, regeneratePost)
- Component rendering (status badges, cards, previews, metadata)
- User interactions (filtering, search, save, approve, delete, regenerate)
- Dialog behavior (open, close, confirm, cancel)
- Accessibility (roles, aria attributes)
- Loading/disabled states
- Error handling
