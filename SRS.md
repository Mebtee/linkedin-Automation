# Software Requirements Specification (SRS)
## 105-Day Learning Journey — LinkedIn Content Automation System

**Version:** 1.0
**Date:** August 28, 2026
**Status:** Draft

---

## 1. Introduction

### 1.1 Purpose

This document specifies the software requirements for the LinkedIn Content Automation System — a personal AI-powered platform that automates LinkedIn content creation and publishing throughout a 105-day full-stack learning journey.

### 1.2 Scope

The system enables a single user (the learner) to:

- Track daily progress through a structured 105-day full-stack curriculum
- Write daily learning journals
- Generate AI-powered LinkedIn posts from journal entries
- Generate branded images for posts
- Schedule and auto-publish posts to LinkedIn
- Upload and process course PDF materials

### 1.3 Definitions

| Term | Definition |
|------|------------|
| Journey | The 105-day full-stack learning plan |
| Module | A major curriculum section (e.g., "Frontend: React & Next.js") |
| Curriculum Day | A single day within the 105-day journey |
| Journal Entry | A user-written daily learning log |
| Generated Post | An AI-created LinkedIn post derived from a journal entry |
| Media Asset | A generated image (SVG) attached to a post |
| Course Material | An uploaded PDF containing learning content |

### 1.4 Technology Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend:** Next.js Server Actions, API Routes
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **AI:** Gemini API (text), branded SVG (images)
- **Hosting:** Vercel
- **Package Manager:** pnpm

---

## 2. Overall Description

### 2.1 Product Perspective

A standalone web application, not a module of a larger system. It operates as a single-user personal tool with no multi-tenancy requirements.

### 2.2 User Characteristics

- **Primary User:** The learner (single user, developer)
- **Technical Level:** Developer — comfortable with CLI, Git, terminal
- **No** multi-user, admin, or role-based access requirements

### 2.3 Constraints

- $0 required operating cost (free-tier compatible)
- LinkedIn API rate limits apply
- Gemini API free-tier limits apply
- Must run on Vercel (Next.js hosting)
- Supabase free-tier limits apply

### 2.4 Assumptions

- User has a LinkedIn account
- User has a Supabase project
- User has a Google AI Studio API key (for Gemini)
- User has a LinkedIn Developer App (for OAuth)

---

## 3. Functional Requirements

### 3.1 Authentication & User Management

#### FR-AUTH-001: User Registration/Login
- **Description:** User authenticates via Supabase Auth (email/password or OAuth)
- **Priority:** High
- **Status:** Not implemented

#### FR-AUTH-002: Profile Management
- **Description:** System creates a profile on first sign-up with display name, timezone, journey start date, and current day (1–105)
- **Priority:** High
- **Status:** Schema ready, UI not implemented

#### FR-AUTH-003: Session Management
- **Description:** Supabase handles session tokens; middleware protects routes
- **Priority:** High
- **Status:** Not implemented

---

### 3.2 Curriculum Management

#### FR-CURR-001: Curriculum Data Seeding
- **Description:** System loads 105 days across 8 modules from seed script into Supabase
- **Priority:** High
- **Status:** Implemented (seed script, schema, validation)

#### FR-CURR-002: Curriculum Viewing
- **Description:** User can browse modules and individual days, viewing topics, subtopics, content, projects, and assessments
- **Priority:** High
- **Status:** UI not implemented

#### FR-CURR-003: Progress Tracking
- **Description:** System tracks `current_day` on profile; user can advance through the journey
- **Priority:** Medium
- **Status:** Schema ready, UI not implemented

---

### 3.3 Daily Learning Journal

#### FR-JRN-001: Journal Entry Creation
- **Description:** User writes daily journal entries with fields: what I learned, practiced, built, challenges, solutions, key takeaway, tomorrow's focus, project details, confidence level (1–5), and additional notes
- **Priority:** High
- **Status:** Schema ready, UI not implemented

#### FR-JRN-002: Journal Entry Editing
- **Description:** User can edit draft journal entries before submission
- **Priority:** High
- **Status:** Not implemented

#### FR-JRN-003: Journal Status Lifecycle
- **Description:** Entries follow lifecycle: draft → submitted → used (when post is generated)
- **Priority:** Medium
- **Status:** Schema ready

#### FR-JRN-004: One Entry Per Day
- **Description:** System enforces one journal entry per user per curriculum day (UNIQUE constraint)
- **Priority:** High
- **Status:** Schema ready

---

### 3.4 AI Content Generation

#### FR-AI-001: LinkedIn Post Generation
- **Description:** System generates LinkedIn posts from journal entries using Gemini API. Posts include: format, opening hook, body, takeaway, next step, and hashtags
- **Priority:** High
- **Status:** Not implemented

#### FR-AI-002: Template Fallback
- **Description:** When Gemini API is unavailable, system falls back to template-based post generation ($0 cost)
- **Priority:** Medium
- **Status:** Not implemented

#### FR-AI-003: Content Deduplication
- **Description:** System uses SHA-256 content hashes to prevent duplicate posts per user/day/format
- **Priority:** Medium
- **Status:** Schema ready

#### FR-AI-004: Post Status Lifecycle
- **Description:** Posts follow: draft → approved → published (or failed). Terminal states cannot revert
- **Priority:** Medium
- **Status:** Schema ready

---

### 3.5 Image Generation

#### FR-IMG-001: Branded SVG Generation
- **Description:** System generates branded SVG images for LinkedIn posts with headline, subheadline, keywords, and visual concept
- **Priority:** Medium
- **Status:** Not implemented

#### FR-IMG-002: Image Storage
- **Description:** Generated SVGs stored in Supabase Storage (private bucket `post-images`); metadata in `media_assets` table
- **Priority:** Medium
- **Status:** Schema ready

#### FR-IMG-003: One Image Per Post
- **Description:** Each generated post has at most one image; regeneration replaces the existing asset
- **Priority:** Low
- **Status:** Schema ready

---

### 3.6 LinkedIn Integration

#### FR-LI-001: LinkedIn OAuth Connection
- **Description:** User connects LinkedIn account via OAuth 2.0; tokens stored server-side only
- **Priority:** High
- **Status:** Not implemented

#### FR-LI-002: Token Management
- **Description:** System stores access tokens, token type, expiration, and scope in `linkedin_connections` table
- **Priority:** High
- **Status:** Schema ready

#### FR-LI-003: Reauthorization
- **Description:** User can reauthorize LinkedIn connection from Settings
- **Priority:** Medium
- **Status:** Not implemented

#### FR-LI-004: Post Publishing
- **Description:** System publishes approved posts to LinkedIn via API
- **Priority:** High
- **Status:** Not implemented

---

### 3.7 Scheduling & Automation

#### FR-SCH-001: Post Scheduling
- **Description:** User schedules posts for future publication with a target UTC timestamp
- **Priority:** High
- **Status:** Not implemented

#### FR-SCH-002: Automated Publishing (Cron)
- **Description:** GitHub Actions workflow runs every 5 minutes, triggering `/api/scheduler/publish` to publish due posts
- **Priority:** High
- **Status:** Schema ready, workflow not implemented

#### FR-SCH-003: Schedule Status Lifecycle
- **Description:** Scheduled posts follow: scheduled → publishing → published/failed, or scheduled → cancelled
- **Priority:** Medium
- **Status:** Schema ready

#### FR-SCH-004: Retry Handling
- **Description:** System tracks attempt count and last error for failed publications
- **Priority:** Low
- **Status:** Schema ready

---

### 3.8 Course Material Ingestion

#### FR-CM-001: PDF Upload
- **Description:** User uploads course PDFs; system stores in private Supabase Storage bucket
- **Priority:** Medium
- **Status:** Not implemented

#### FR-CM-002: PDF Text Extraction
- **Description:** System extracts text from each PDF page using `unpdf`
- **Priority:** Medium
- **Status:** Not implemented

#### FR-CM-003: AI Journal Proposal
- **Description:** System analyzes extracted text and proposes journal entry fields with evidence citations
- **Priority:** Medium
- **Status:** Not implemented

#### FR-CM-004: Duplicate Detection
- **Description:** System uses content hash to detect duplicate PDF uploads per user
- **Priority:** Low
- **Status:** Schema ready

---

### 3.9 Dashboard & UI

#### FR-UI-001: Dashboard
- **Description:** Main dashboard shows journey overview, current day, recent entries, and quick actions
- **Priority:** High
- **Status:** Not implemented

#### FR-UI-002: Curriculum View
- **Description:** Browse modules and days with progress indicators
- **Priority:** High
- **Status:** Not implemented

#### FR-UI-003: Journal View
- **Description:** Create, edit, and view daily learning entries
- **Priority:** High
- **Status:** Not implemented

#### FR-UI-004: Posts View
- **Description:** View generated posts, edit, approve, and manage publication
- **Priority:** High
- **Status:** Not implemented

#### FR-UI-005: Schedule View
- **Description:** View and manage scheduled posts with timeline
- **Priority:** Medium
- **Status:** Not implemented

#### FR-UI-006: Settings View
- **Description:** Manage profile, LinkedIn connection, AI provider settings
- **Priority:** Medium
- **Status:** Not implemented

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-PERF-001 | Page load time | < 2s (initial), < 500ms (navigation) |
| NFR-PERF-002 | AI post generation | < 30s end-to-end |
| NFR-PERF-003 | Image generation | < 5s |
| NFR-PERF-004 | Database queries | < 200ms (p95) |

### 4.2 Security

| ID | Requirement |
|----|-------------|
| NFR-SEC-001 | All secrets server-side only (never in client bundle) |
| NFR-SEC-002 | Row Level Security (RLS) on all tables |
| NFR-SEC-003 | LinkedIn tokens stored server-side only |
| NFR-SEC-004 | OAuth state tokens signed with HMAC (CSRF protection) |
| NFR-SEC-005 | Private storage buckets with authenticated access only |
| NFR-SEC-006 | API routes never echo environment values |
| NFR-SEC-007 | `.env` files never committed to git |

### 4.3 Reliability

| ID | Requirement |
|----|-------------|
| NFR-REL-001 | Graceful degradation when AI provider is unavailable |
| NFR-REL-002 | Automatic fallback to template-based post generation |
| NFR-REL-003 | Idempotent seed operations (safe to re-run) |
| NFR-REL-004 | Scheduled posts never lost by cron delays |

### 4.4 Maintainability

| ID | Requirement |
|----|-------------|
| NFR-MNT-001 | TypeScript strict mode |
| NFR-MNT-002 | Service layer separates business logic from UI |
| NFR-MNT-003 | Typed environment configuration |
| NFR-MNT-004 | ESLint + Prettier code quality |
| NFR-MNT-005 | Vitest for unit/integration testing |

### 4.5 Usability

| ID | Requirement |
|----|-------------|
| NFR-USE-001 | Responsive design (mobile + desktop) |
| NFR-USE-002 | Accessible UI (ARIA labels, keyboard navigation) |
| NFR-USE-003 | Dark/light theme support |
| NFR-USE-004 | Loading states for all async operations |
| NFR-USE-005 | Error boundaries with user-friendly messages |

---

## 5. Data Requirements

### 5.1 Database Schema

See [DATABASE.md](./DATABASE.md) for complete schema documentation.

**Tables:**

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (1:1 with auth.users) |
| `modules` | 8 curriculum modules |
| `curriculum_days` | 105 individual learning days |
| `daily_learning_entries` | User journal entries |
| `generated_posts` | AI-generated LinkedIn posts |
| `media_assets` | Generated image metadata |
| `linkedin_connections` | LinkedIn OAuth tokens |
| `scheduled_posts` | Scheduled publication queue |
| `course_materials` | Uploaded PDFs and processing state |
| `course_material_pages` | Extracted text per PDF page |

### 5.2 Data Retention

- All user data retained until account deletion (cascade delete)
- LinkedIn tokens: server-side only, re-authorized on expiry
- Curriculum data: shared across users (read-only)

---

## 6. External Interfaces

### 6.1 LinkedIn API

- **Type:** REST API (OAuth 2.0)
- **Authentication:** Bearer token
- **Operations:** Publish posts, manage profile
- **Rate Limits:** Platform-dependent

### 6.2 Gemini API

- **Type:** REST API
- **Authentication:** API key
- **Operations:** Text generation (post creation)
- **Rate Limits:** Free-tier limits apply

### 6.3 Supabase

- **Type:** REST + WebSocket
- **Authentication:** Anon key (client), Service-role key (server)
- **Operations:** CRUD, Auth, Storage, Realtime

---

## 7. Implementation Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1A | Project scaffolding & Next.js setup | Done |
| 1B | Supabase schema & migrations | Done |
| 1C | Environment & configuration | Done |
| 1D | UI component library | Partial |
| 1E | Database seeding | Done |
| 2A | Journal CRUD | Schema ready |
| 2B | Curriculum UI | Not started |
| 3A | AI text generation | Not started |
| 3B | Post generation | Schema ready |
| 3C | Post editing & approval | Not started |
| 3F | AI image generation | Not started |
| 3G | LinkedIn OAuth & publishing | Not started |
| 3H | Deployment & CI/CD | Partial |
| 3I | Course PDF ingestion | Schema ready |
| 3J | Course material processing | Not started |

---

## 8. Acceptance Criteria

### 8.1 MVP Acceptance

The system is considered MVP-ready when:

1. User can register/login via Supabase Auth
2. User can view curriculum and track progress
3. User can create and submit daily journal entries
4. System generates LinkedIn posts from journal entries
5. User can approve and schedule posts
6. Posts auto-publish to LinkedIn via cron
7. User can upload course PDFs and generate journal proposals

### 8.2 Quality Gates

- All TypeScript compilation errors resolved (`pnpm typecheck`)
- All ESLint warnings resolved (`pnpm lint`)
- Production build succeeds (`pnpm build`)
- All tests pass (`pnpm test`)
- No secrets exposed in client bundle
- RLS policies verified

---

## 9. Appendix

### 9.1 Environment Variables

See [ENVIRONMENT.md](./ENVIRONMENT.md) for complete variable documentation.

### 9.2 Database Schema

See [DATABASE.md](./DATABASE.md) for complete schema documentation.

### 9.3 Curriculum Data

See [CURRICULUM.md](./CURRICULUM.md) for the 105-day curriculum structure.
