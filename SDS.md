# Software Design Specification (SDS)
## 105-Day Learning Journey — LinkedIn Content Automation System

**Version:** 1.0
**Date:** August 28, 2026
**Status:** Draft

---

## 1. Architecture Overview

### 1.1 Architecture Pattern

**Service-Oriented Architecture (SOA)** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  React Components (Client/Server) + Tailwind CSS                │
│  Pages: Dashboard, Curriculum, Journal, Posts, Schedule, Settings│
└─────────────────────────┬───────────────────────────────────────┘
                          │ Server Actions / API Routes
┌─────────────────────────▼───────────────────────────────────────┐
│                      SERVICE LAYER                              │
│  ai/ image/ linkedin/ scheduling/ curriculum/ journal/          │
│  generated-posts/ course-materials/ validation/                  │
│  Business logic lives HERE — not in components                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                     DATA LAYER                                  │
│  Supabase Client (RLS enforced)                                 │
│  Tables: profiles, modules, curriculum_days, daily_learning_    │
│  entries, generated_posts, media_assets, linkedin_connections,  │
│  scheduled_posts, course_materials, course_material_pages       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                   EXTERNAL SERVICES                             │
│  Supabase Auth │ Gemini API │ LinkedIn API │ Supabase Storage   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
User writes Journal → Submits → AI generates Post → User approves →
Schedules Post → Cron publishes to LinkedIn → Post appears on LinkedIn
```

### 1.3 Key Design Principles

1. **Server Components by Default** — React Server Components render without client JS; `"use client"` only when interactivity is needed
2. **Service Layer Separation** — All business logic in `src/services/`; components only render state
3. **Typed Environment** — Config modules in `src/config/` with fail-fast validation
4. **RLS-First Security** — Database enforces access; services assume RLS is active
5. **Idempotent Operations** — Seed scripts and schedulers are safe to re-run

---

## 2. Directory Structure

```
linkedin-Automation/
├── src/
│   ├── app/                    # Next.js App Router routes
│   │   ├── actions/            # Server Actions (form submissions)
│   │   ├── api/                # API Routes (external-facing)
│   │   │   ├── health/         # Health check endpoint
│   │   │   ├── linkedin/       # LinkedIn OAuth callbacks
│   │   │   ├── media/          # Image serving
│   │   │   └── scheduler/      # Cron-triggered publishing
│   │   ├── auth/               # Auth callbacks
│   │   ├── course-materials/   # PDF upload & management
│   │   ├── curriculum/         # Curriculum browsing
│   │   ├── dashboard/          # Main dashboard
│   │   ├── journal/            # Daily learning entries
│   │   ├── login/              # Login page
│   │   ├── posts/              # Generated posts management
│   │   ├── schedule/           # Scheduling view
│   │   ├── settings/           # User settings
│   │   ├── error.tsx           # Route-level error boundary
│   │   ├── global-error.tsx    # Root error boundary
│   │   ├── layout.tsx          # Root layout
│   │   ├── loading.tsx         # Root loading state
│   │   ├── not-found.tsx       # 404 page
│   │   └── page.tsx            # Root redirect
│   ├── components/             # UI Components
│   │   ├── course-materials/
│   │   ├── curriculum/
│   │   ├── dashboard/
│   │   ├── journal/
│   │   ├── posts/
│   │   ├── settings/
│   │   └── ui/                 # Shared UI primitives
│   ├── config/                 # Typed configuration
│   │   ├── app.ts              # Application config
│   │   ├── brand.ts            # Brand/identity config
│   │   ├── content.ts          # Content config
│   │   ├── env.ts              # Public env vars
│   │   ├── env.server.ts       # Server-only env vars
│   │   └── index.ts            # Barrel export
│   ├── lib/                    # Low-level helpers
│   │   ├── utils/              # Error handling, helpers
│   │   └── supabase/           # Supabase client creators
│   │       ├── server.ts       # Server-side client
│   │       ├── client.ts       # Browser client
│   │       └── middleware.ts   # Middleware client
│   ├── services/               # Business logic layer
│   │   ├── ai/                 # AI text generation
│   │   ├── course-materials/   # PDF processing
│   │   ├── curriculum/         # Curriculum queries
│   │   ├── generated-posts/    # Post CRUD & hashing
│   │   ├── image/              # Image generation
│   │   ├── journal/            # Journal CRUD
│   │   ├── linkedin/           # LinkedIn API client
│   │   ├── scheduling/         # Schedule management
│   │   └── validation/         # Shared validators
│   ├── tests/                  # Test utilities
│   ├── types/                  # Shared TypeScript types
│   └── middleware.ts           # Next.js middleware (auth)
├── supabase/
│   └── migrations/             # SQL migrations
├── seed/                       # Curriculum seed data
├── scripts/                    # Build/utility scripts
└── public/                     # Static assets
```

---

## 3. Component Design

### 3.1 Route Architecture

| Route | Type | Auth | Description |
|-------|------|------|-------------|
| `/` | Page | No | Redirect to `/dashboard` |
| `/login` | Page | No | Login form |
| `/auth/callback` | Route | No | Supabase auth callback |
| `/dashboard` | Page | Yes | Journey overview, current day |
| `/curriculum` | Page | Yes | Browse modules and days |
| `/curriculum/[day]` | Page | Yes | Single day detail view |
| `/journal` | Page | Yes | List journal entries |
| `/journal/[day]` | Page | Yes | Create/edit journal entry |
| `/posts` | Page | Yes | Generated posts list |
| `/posts/[id]` | Page | Yes | Single post view/edit |
| `/schedule` | Page | Yes | Scheduled posts timeline |
| `/course-materials` | Page | Yes | PDF upload & list |
| `/settings` | Page | Yes | Profile, LinkedIn, AI config |
| `/api/health` | API | No | Health check |
| `/api/scheduler/publish` | API | Cron | Publish due posts |
| `/api/linkedin/*` | API | OAuth | LinkedIn callbacks |
| `/api/media/*` | API | Yes | Serve media assets |

### 3.2 Server Actions

Server Actions handle form submissions from client components:

```typescript
// src/app/actions/journal.ts
"use server"

export async function saveJournalEntry(input: JournalInput): Promise<JournalEntry> {
  // 1. Auth check
  // 2. Validate input
  // 3. Upsert into daily_learning_entries
  // 4. Return saved entry
}

export async function submitJournalEntry(dayNumber: number): Promise<JournalEntry> {
  // 1. Auth check
  // 2. Load entry (must be draft)
  // 3. Update status to 'submitted'
  // 4. Return updated entry
}
```

### 3.3 Client Components

Client components (`"use client"`) are used only when:
- User interaction is required (forms, buttons, modals)
- Real-time updates are needed
- Browser APIs are used

**Pattern:**
```typescript
"use client"

import { useState } from "react"
import { saveJournalEntry } from "@/app/actions/journal"

export function JournalForm({ dayNumber }: { dayNumber: number }) {
  const [saving, setSaving] = useState(false)

  async function handleSubmit(formData: FormData) {
    setSaving(true)
    await saveJournalEntry({ dayNumber, ... })
    setSaving(false)
  }

  return <form action={handleSubmit}>...</form>
}
```

---

## 4. Service Layer Design

### 4.1 Service Module Structure

Each service module follows this pattern:

```
src/services/{domain}/
├── index.ts          # Public API (exports functions)
├── {function}.ts     # Implementation
├── {function}.test.ts # Tests
└── types.ts          # Domain-specific types (if needed)
```

### 4.2 AI Service (`src/services/ai/`)

**Responsibility:** Generate LinkedIn posts from journal entries.

```
ai/
├── index.ts              # Provider selection
├── generation.ts         # Main generation orchestration
├── generation.test.ts
├── input-builder.ts      # Build PostGenerationInput
├── input-builder.test.ts
├── validation.ts         # Validate provider output
├── ai.test.ts
└── providers/
    ├── index.ts          # Provider interface
    ├── gemini.ts         # Gemini API provider
    └── template.ts       # Template fallback provider
```

**Provider Interface:**
```typescript
interface TextGenerationProvider {
  generatePost(input: PostGenerationInput): Promise<GenerationResult>
}

type GenerationResult = {
  payload: GeneratedPostPayload
  metadata: {
    provider: string
    model: string
    tokensUsed?: number
  }
}
```

**Generation Flow:**
```
1. Authenticate user
2. Validate day number (1-105)
3. Load curriculum day + module
4. Load journal entry (must be 'submitted')
5. Build PostGenerationInput
6. Select post format (or use default)
7. Call AI provider (Gemini or template fallback)
8. Validate provider output
9. Calculate SHA-256 content hash
10. Check for duplicate posts
11. Persist generated_post
12. Return saved post
```

### 4.3 LinkedIn Service (`src/services/linkedin/`)

**Responsibility:** OAuth flow + LinkedIn API interactions.

```
linkedin/
├── index.ts              # Public API
├── oauth.ts              # OAuth URL generation + token exchange
├── oauth.test.ts
├── connection.ts         # Connection CRUD
├── connection.test.ts
├── publish.ts            # Publish to LinkedIn UGC API
├── publish.test.ts
├── api.test.ts
└── api.ts                # LinkedIn API client
```

**OAuth Flow:**
```
1. Generate state token (HMAC-signed)
2. Redirect to LinkedIn OAuth URL
3. LinkedIn redirects back with code
4. Exchange code for access token
5. Store token in linkedin_connections (server-side only)
6. Fetch LinkedIn profile info
7. Update connection record
```

**Publishing Flow:**
```
1. Load scheduled post
2. Load LinkedIn connection for user
3. Format post text (opening + body + takeaway + hashtags)
4. Truncate to 3000 chars (LinkedIn limit)
5. POST to LinkedIn UGC Posts API
6. Handle rate limits / errors
7. Return LinkedIn post ID
```

### 4.4 Scheduling Service (`src/services/scheduling/`)

**Responsibility:** Schedule, cancel, reschedule, and publish posts.

**User Operations:**
```typescript
schedulePost(input: CreateScheduleInput): Promise<ScheduledPostRow>
cancelSchedule(scheduleId: string): Promise<ScheduledPostRow>
reschedulePost(scheduleId: string, newTime: string): Promise<ScheduledPostRow>
getActiveSchedule(postId: string): Promise<ScheduledPostRow | null>
```

**Cron Operations (Admin):**
```typescript
findDueScheduledPosts(admin: SupabaseClient, batchSize?: number): Promise<ScheduledPostRow[]>
claimScheduledPost(admin: SupabaseClient, scheduleId: string): Promise<ScheduledPostRow | null>
markSchedulePublished(admin: SupabaseClient, scheduleId: string, linkedinPostId: string): Promise<void>
markScheduleFailed(admin: SupabaseClient, scheduleId: string, errorMessage: string): Promise<void>
loadPostForPublishing(admin: SupabaseClient, postId: string, ownerProfileId: string): Promise<GeneratedPostRow | null>
```

**Status Transitions:**
```
scheduled → publishing → published
scheduled → publishing → failed
scheduled → cancelled
```

**Race Condition Handling:**
- All status changes use conditional UPDATE (`WHERE status = 'expected'`)
- Concurrent cron runs: only one UPDATE matches; loser gets 0 rows
- Reschedule: cancel must match exactly 1 row; 0 rows = conflict

### 4.5 Curriculum Service (`src/services/curriculum/`)

**Responsibility:** Read-only queries for curriculum data.

```typescript
getModules(): Promise<ModuleRow[]>
getModuleById(id: string): Promise<ModuleRow>
getCurriculumDays(moduleId?: string): Promise<CurriculumDayRow[]>
getCurriculumDay(dayNumber: number): Promise<CurriculumDayRow>
getDayProgress(userId: string): Promise<DayProgress>
```

### 4.6 Journal Service (`src/services/journal/`)

**Responsibility:** CRUD for daily learning entries.

```typescript
getJournalEntry(userId: string, dayNumber: number): Promise<JournalEntry | null>
getUserJournalEntries(userId: string): Promise<JournalEntry[]>
saveJournalEntry(input: JournalInput): Promise<JournalEntry>
submitJournalEntry(userId: string, dayNumber: number): Promise<JournalEntry>
```

### 4.7 Generated Posts Service (`src/services/generated-posts/`)

**Responsibility:** CRUD for AI-generated posts.

```typescript
getGeneratedPost(id: string): Promise<GeneratedPostRow | null>
getUserPosts(userId: string, status?: PostStatus): Promise<GeneratedPostRow[]>
createGeneratedPost(input: CreateGeneratedPostInput): Promise<GeneratedPostRow>
updatePostStatus(postId: string, status: PostStatus): Promise<GeneratedPostRow>
checkDuplicatePost(userId: string, dayNumber: number, format: string, hash: string): Promise<boolean>
```

### 4.8 Image Service (`src/services/image/`)

**Responsibility:** Generate branded SVG images.

```typescript
generateImage(post: GeneratedPostRow): Promise<GeneratedImageResult>
uploadImage(userId: string, postId: string, svg: string): Promise<MediaAsset>
```

### 4.9 Course Materials Service (`src/services/course-materials/`)

**Responsibility:** PDF upload, text extraction, journal proposal generation.

```typescript
uploadCourseMaterial(userId: string, file: File): Promise<CourseMaterial>
processCourseMaterial(materialId: string): Promise<CourseMaterial>
getCourseMaterial(id: string): Promise<CourseMaterial | null>
getUserCourseMaterials(userId: string): Promise<CourseMaterial[]>
```

---

## 5. Data Layer Design

### 5.1 Supabase Client Creation

Three client variants:

```typescript
// src/lib/supabase/server.ts — Server Components & Server Actions
import { createServerClient } from "@supabase/ssr"

export async function createClient() {
  // Uses cookies() for session management
}

// src/lib/supabase/client.ts — Client Components
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  // Uses NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
}

// src/lib/supabase/middleware.ts — Middleware
export function createClient(request: NextRequest, response: NextResponse) {
  // Updates cookies on response
}
```

### 5.2 RLS Policy Strategy

All tables use **restrictive policies** with owner-based access:

```sql
-- Example: daily_learning_entries
CREATE POLICY "Users can manage own entries"
  ON daily_learning_entries
  FOR ALL
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);
```

**Policy Matrix:**

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | owner | owner | owner | owner |
| `modules` | authenticated | none | none | none |
| `curriculum_days` | authenticated | none | none | none |
| `daily_learning_entries` | owner | owner | owner | owner |
| `generated_posts` | owner | owner | owner | owner |
| `media_assets` | owner | owner | owner | owner |
| `linkedin_connections` | owner | owner | owner | owner |
| `scheduled_posts` | owner | owner | owner | owner |
| `course_materials` | owner | owner | owner | owner |
| `course_material_pages` | owner (via join) | owner (via join) | owner (via join) | owner (via join) |

**Service-role:** Bypasses all RLS (used by seed scripts and cron publisher).

### 5.3 Database Indexes

Key indexes for common query patterns:

| Table | Index | Purpose |
|-------|-------|---------|
| `modules` | `module_number` | Sequential module lookup |
| `modules` | `start_day`, `end_day` | Day range queries |
| `curriculum_days` | `day_number` | Single day lookup |
| `curriculum_days` | `module_id` | Filter by module |
| `curriculum_days` | `week_number` | Filter by week |
| `daily_learning_entries` | `profile_id` | User's entries |
| `daily_learning_entries` | `profile_id, day_number` | User+day lookup |
| `generated_posts` | `profile_id, day_number` | User+day posts |
| `generated_posts` | `content_hash` | Duplicate detection |
| `scheduled_posts` | `status, scheduled_at` (partial) | Cron publisher query |
| `course_materials` | `profile_id, content_hash` | Duplicate detection |

---

## 6. Security Design

### 6.1 Authentication Flow

```
1. User visits protected route → middleware checks session
2. No session → redirect to /login
3. User submits login → Supabase Auth
4. Session cookie set → middleware allows access
5. Session expires → middleware redirects to /login
```

### 6.2 Route Protection

```typescript
// src/middleware.ts
const protectedRoutes = [
  "/dashboard", "/curriculum", "/journal",
  "/course-materials", "/posts", "/schedule", "/settings"
]

const authRoutes = ["/login", "/auth"]
```

### 6.3 Secret Management

| Secret | Location | Exposure |
|--------|----------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server env only | Never in client bundle |
| `LINKEDIN_CLIENT_SECRET` | Server env only | Never in client bundle |
| `LINKEDIN_OAUTH_STATE_SECRET` | Server env only | Never in client bundle |
| `SCHEDULER_SECRET` | Server env + GitHub Actions secret | Never in client bundle |
| `GEMINI_API_KEY` | Server env only | Never in client bundle |
| LinkedIn access tokens | `linkedin_connections` table | Server-side only (RLS blocks client reads) |

### 6.4 OAuth CSRF Protection

```typescript
// State token = HMAC-SHA256(random nonce, LINKEDIN_OAUTH_STATE_SECRET)
// On callback: verify HMAC signature before exchanging code
```

### 6.5 Cron Publisher Security

```typescript
// /api/scheduler/publish
// Requires: Authorization: Bearer <SCHEDULER_SECRET>
// SCHEDULER_SECRET is never sent to browsers or logged
```

---

## 7. API Design

### 7.1 Health Check

```
GET /api/health
Response: { status: "ok", timestamp: string }
```

### 7.2 LinkedIn OAuth

```
GET /api/linkedin/connect
  → Redirect to LinkedIn OAuth URL

GET /api/linkedin/callback?code=...&state=...
  → Exchange code, store token, redirect to /settings
```

### 7.3 Scheduler (Cron)

```
POST /api/scheduler/publish
  Header: Authorization: Bearer <SCHEDULER_SECRET>
  Body: { batchSize?: number }
  Response: { published: number, failed: number, skipped: number }
```

### 7.4 Media

```
GET /api/media/:postId
  → Serve SVG image for a post (authenticated)
```

---

## 8. Type System

### 8.1 Domain Types (`src/types/`)

```typescript
// types/curriculum.ts
type Module = {
  id: string
  module_number: number
  title: string
  description: string | null
  weeks: number | null
  days: number | null
  hours: number | null
  start_day: number
  end_day: number
}

type CurriculumDay = {
  id: string
  day_number: number
  module_id: string
  week_number: number | null
  topic: string
  content: string | null
  subtopics: string[] | null
  project_information: string | null
  assessment_information: string | null
}

// types/journal.ts
type JournalStatus = "draft" | "submitted" | "used"

type JournalEntry = {
  id: string
  profile_id: string
  day_number: number
  status: JournalStatus
  what_i_learned: string | null
  what_i_practiced: string | null
  what_i_built: string | null
  challenge: string | null
  how_i_solved_it: string | null
  key_takeaway: string | null
  tomorrow_focus: string | null
  project_name: string | null
  project_description: string | null
  code_reference: string | null
  resources_used: string | null
  confidence_level: number | null
  additional_notes: string | null
}

// types/generated-post.ts
type PostStatus = "draft" | "approved" | "published" | "failed"
type PostFormat = "story" | "lesson" | "insight" | "journey"

type GeneratedPostRow = {
  id: string
  profile_id: string
  journal_entry_id: string
  day_number: number
  status: PostStatus
  format: PostFormat
  opening: string
  body: string
  takeaway: string
  next_step: string
  hashtags: string[]
  image_headline: string | null
  image_subheadline: string | null
  image_keywords: string[] | null
  image_visual_concept: string | null
  image_template: string | null
  provider: string
  model: string
  tokens_used: number | null
  content_hash: string
}

// types/schedule.ts
type ScheduleStatus = "scheduled" | "publishing" | "published" | "failed" | "cancelled"

type ScheduledPostRow = {
  id: string
  post_id: string
  profile_id: string
  scheduled_at: string
  status: ScheduleStatus
  published_at: string | null
  linkedin_post_id: string | null
  last_error: string | null
  attempt_count: number
}
```

### 8.2 Type Exports

```typescript
// types/index.ts — barrel export
export type { Module, CurriculumDay } from "./curriculum"
export type { JournalEntry, JournalStatus } from "./journal"
export type { GeneratedPostRow, PostStatus, PostFormat } from "./generated-post"
export type { ScheduledPostRow, ScheduleStatus } from "./schedule"
export type { MediaAsset } from "./image"
export type { LinkedInConnection } from "./linkedin"
export type { CourseMaterial } from "./course-material"
```

---

## 9. Error Handling

### 9.1 AppError Class

```typescript
// src/lib/utils/errors.ts
class AppError extends Error {
  code: string
  cause?: unknown

  constructor(message: string, options: { code: string; cause?: unknown }) {
    super(message)
    this.code = options.code
    this.cause = options.cause
  }
}
```

### 9.2 Error Codes

| Code | Service | Description |
|------|---------|-------------|
| `MISSING_ENV_VAR` | Config | Required env var not set |
| `GENERATION_UNAUTHORIZED` | AI | User not authenticated |
| `GENERATION_FAILED` | AI | AI provider error |
| `GENERATION_DUPLICATE` | AI | Duplicate content detected |
| `CURRICULUM_NOT_FOUND` | Curriculum | Day/module not found |
| `JOURNAL_NOT_FOUND` | Journal | No entry for day |
| `JOURNAL_NOT_SUBMITTED` | Journal | Entry not submitted |
| `POST_NOT_FOUND` | Posts | Post not found |
| `INVALID_STATUS` | Scheduling | Invalid status transition |
| `ALREADY_SCHEDULED` | Scheduling | Post already scheduled |
| `SCHEDULE_NOT_FOUND` | Scheduling | Schedule not found |
| `SCHEDULE_CONFLICT` | Scheduling | Race condition detected |
| `DATABASE_ERROR` | All | Database operation failed |
| `VALIDATION_ERROR` | All | Input validation failed |

### 9.3 Error Boundaries

```typescript
// src/app/error.tsx — Route-level error boundary
// src/app/global-error.tsx — Root error boundary
// src/app/not-found.tsx — 404 page
```

Error boundaries catch rendering errors and display user-friendly fallback UI.

---

## 10. Testing Strategy

### 10.1 Test Framework

- **Unit/Integration:** Vitest
- **Component Testing:** @testing-library/react + @testing-library/user-event
- **DOM Simulation:** jsdom

### 10.2 Test Categories

| Category | Location | Coverage |
|----------|----------|----------|
| Service unit tests | `src/services/**/*.test.ts` | Business logic |
| Component tests | `src/components/**/*.test.tsx` | UI rendering |
| API route tests | `src/app/api/**/*.test.ts` | Endpoint behavior |
| Validation tests | `src/services/validation/**/*.test.ts` | Input validation |
| Type tests | `src/types/**/*.test.ts` | Type guards |

### 10.3 Test Commands

```bash
pnpm test          # Run all tests
pnpm test:watch    # Watch mode
```

### 10.4 Test Patterns

```typescript
// Service test example
describe("generatePostForDay", () => {
  it("throws JOURNAL_NOT_SUBMITTED when journal is draft", async () => {
    // Mock Supabase client
    // Mock journal entry with status 'draft'
    // Expect AppError with code JOURNAL_NOT_SUBMITTED
  })
})

// Component test example
describe("JournalForm", () => {
  it("calls saveJournalEntry on submit", async () => {
    render(<JournalForm dayNumber={1} />)
    await userEvent.click(screen.getByRole("button", { name: /save/i }))
    expect(mockSave).toHaveBeenCalled()
  })
})
```

---

## 11. Deployment Architecture

### 11.1 Hosting

- **Platform:** Vercel
- **Runtime:** Node.js (Next.js)
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage

### 11.2 Environment Configuration

```bash
# Public (client-safe)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Server-only (secrets)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_OAUTH_STATE_SECRET=...
SCHEDULER_SECRET=...
AI_TEXT_PROVIDER=gemini
GEMINI_API_KEY=...
```

### 11.3 GitHub Actions Cron

```yaml
# .github/workflows/publish-scheduled.yml
name: Publish Scheduled Posts
on:
  schedule:
    - cron: "*/5 * * * *"  # Every 5 minutes
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Publish due posts
        run: |
          curl -X POST "${{ secrets.APP_URL }}/api/scheduler/publish" \
            -H "Authorization: Bearer ${{ secrets.SCHEDULER_SECRET }}" \
            -H "Content-Type: application/json"
```

### 11.4 Build & Deploy

```bash
# Local
pnpm install
pnpm dev

# Production build
pnpm build
pnpm start

# Quality checks
pnpm typecheck
pnpm lint
pnpm test
```

---

## 12. Performance Considerations

### 12.1 Server Components

- Default rendering is server-side (no client JS)
- Only interactive components use `"use client"`
- Reduces bundle size and improves initial load

### 12.2 Data Fetching

- Server components fetch data directly (no API overhead)
- Client components use Server Actions (not API routes)
- Supabase queries use indexed columns

### 12.3 Caching

- Next.js built-in caching for static data
- Supabase real-time for live updates (future)
- Content hash for duplicate detection (avoids redundant AI calls)

### 12.4 Image Optimization

- SVG images (vector, small file size)
- Next.js Image component for any raster images
- Lazy loading for non-critical images

---

## 13. Future Considerations

### 13.1 Scalability

- Currently single-user; multi-user would require:
  - Admin dashboard
  - User management
  - Rate limiting per user
  - Shared curriculum (read-only)

### 13.2 Extensibility

- New AI providers: implement `TextGenerationProvider` interface
- New post formats: add to `PostFormat` type
- New image templates: add to image service
- New publishing targets: implement similar to LinkedIn service

### 13.3 Monitoring

- Health check endpoint for uptime monitoring
- Structured logging (future)
- Error tracking integration (Sentry, etc.)

---

## 14. Appendix

### 14.1 References

- [SRS.md](./SRS.md) — Software Requirements Specification
- [DATABASE.md](./DATABASE.md) — Database schema documentation
- [ENVIRONMENT.md](./ENVIRONMENT.md) — Environment variables
- [CURRICULUM.md](./CURRICULUM.md) — 105-day curriculum
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Deployment guide
- [SECURITY.md](./SECURITY.md) — Security documentation

### 14.2 Glossary

See SRS Section 1.3 for definitions.
