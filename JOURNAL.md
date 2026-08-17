# JOURNAL.md — Daily Learning Journal

The daily learning journal captures what you actually learn each day. It is the **source of truth** that future AI content generation will use.

---

## Why the Journal Exists

When AI generates LinkedIn posts, it needs three inputs:

1. **Curriculum day** — what was planned to be learned
2. **Your actual journal** — what you really learned, struggled with, and built
3. **Post format + writing style** — how the content should be presented

Without the journal, AI would only know the curriculum topic. With it, AI can generate authentic, personal posts based on your real experience.

---

## Journal Route

Navigate to `/journal` to open the daily journal.

- The page requires authentication
- On load, it determines the current learning day from your profile
- It fetches the curriculum data and any existing journal entry for that day
- You can navigate to other days using the Previous/Next buttons

### Day Navigation

Use `?day=N` query parameter to view a specific day:

```
/journal          → Today's day
/journal?day=18   → Day 18
/journal?day=1    → Day 1
```

Navigation boundaries:
- Previous Day is disabled on Day 1
- Next Day is disabled on Day 105

---

## Page Structure

The journal page has these sections:

### Header

- Series title: "105 DAYS OF FULL-STACK DEVELOPMENT"
- Current day: "DAY X / 105"
- Progress bar showing completion percentage

### Today's Learning

Displays the real curriculum data loaded from the database:
- Day number badge
- Module badge
- Topic title
- Curriculum content
- Subtopics as tags
- Project information (if available)
- Assessment information (if available)

### My Learning Journal

The journal form is organized into logical sections:

**Today's Lesson**
- What did I learn?
- What did I practice?

**My Work**
- What did I build?
- Project name
- Project description

**Challenge**
- What was difficult?
- How did I solve it?

**Reflection**
- Key takeaway
- Tomorrow's focus

**Optional Details**
- Code reference
- Resources used
- Confidence level (1–5 selector)
- Additional notes

---

## Form Fields

Each field has clear labels and helper text:

| Field | Helper Text |
|-------|-------------|
| What did I learn? | Write the main things you learned today. |
| What did I practice? | Write what you practiced with code or exercises. |
| What did I build? | Did you build something today? Tell me what it was. |
| What was difficult? | Write one problem or idea that was hard for you. |
| How did I solve it? | Explain what you tried and what worked. |
| Key takeaway | What is the most important thing you learned today? |
| Tomorrow's focus | What do you want to understand or practice next? |

### Character Limits

All text fields have a 5,000-character maximum. A subtle character count shows `X / 5,000` when you're typing. The count turns amber when you exceed 90% of the limit.

### Confidence Level

Select how confident you feel:
- 🔴 1 — Need more practice
- 🟠 2 — Still learning
- 🟡 3 — Getting comfortable
- 🟢 4 — Good understanding
- ✅ 5 — Very confident

Click the same level again to deselect.

---

## Status Display

Each journal entry shows its current status:

| Status | Badge | Description |
|--------|-------|-------------|
| Draft | Grey | You can keep editing. |
| Submitted | Blue | Your learning record is saved. |
| Used | Cyan | Used by content generation. |

---

## Draft Workflow

1. Open `/journal` — the page loads today's curriculum and any existing entry
2. If no entry exists, an empty form appears
3. Write in any fields you want — most are optional
4. Click **Save Draft** to save your progress
5. Your content stays visible after saving
6. A success message appears: "Your journal was saved."

### Creating vs Updating

- First save: Creates a new draft entry
- Subsequent saves: Updates the existing entry
- No duplicate entries are created

---

## Submit Workflow

1. Write enough content (at least one of: what you learned, what you practiced, what you built, or key takeaway)
2. Click **Submit Journal**
3. A confirmation dialog appears: "Ready to submit today's journal?"
4. Confirm to submit
5. A success message appears: "Your journal was submitted."

### Submission Rules

- The **Submit Journal** button is disabled if no learning fields are filled
- If you try to submit an empty journal via the service, you'll see: "Add a little more about what you learned before submitting."
- After submission, the form becomes read-only
- You cannot edit a submitted journal

### Status Transitions

- Draft → Submitted: Allowed
- Submitted → Draft: Allowed (reopen for editing)
- Any → Used: Not possible (reserved for future AI pipeline)

---

## Navigation

The journal page provides these navigation options:

- **← Previous Day** — Go to the previous curriculum day (disabled on Day 1)
- **Next Day →** — Go to the next curriculum day (disabled on Day 105)
- **Back to Dashboard** — Return to the main dashboard
- **View Curriculum** — Open the full curriculum page

When navigating between days, the page reloads with the new day's data via URL search params.

---

## Loading States

The page shows loading indicators during:
- Saving a draft: Button shows "Saving..."
- Submitting: Button shows "Submitting..."
- Dialog confirm button shows "Submitting..."

---

## Error States

User-friendly error messages appear for:
- Authentication failure: Redirects to `/login`
- Curriculum day unavailable: Shows "Curriculum data for Day X is not available yet."
- Save failure: Shows the error message from the service
- Submit failure: Shows a friendly message explaining what's missing
- Empty submission: "Add a little more about what you learned before submitting."

Errors never expose:
- SQL errors
- Database internals
- Service-role information
- Stack traces
- Secrets

---

## Architecture

```
Journal UI (src/app/journal/page.tsx — Server Component)
    ↓ fetches data via Supabase
JournalForm (src/components/journal/journal-form.tsx — Client Component)
    ↓ calls
Server Actions (src/app/actions/journal.ts)
    ↓ uses
Journal Service (src/services/journal/index.ts)
    ↓ queries
Supabase (daily_learning_entries + curriculum_days tables)
```

### Server Components
- `src/app/journal/page.tsx` — Fetches curriculum data, journal entry, and profile

### Client Components
- `src/components/journal/journal-form.tsx` — Main form with all field groups
- `src/components/journal/textarea-field.tsx` — Reusable textarea with label, helper text, character count
- `src/components/journal/confidence-selector.tsx` — Standalone confidence level selector
- `src/components/journal/status-badge.tsx` — Status display badge (Server Component)
- `src/components/journal/confirm-dialog.tsx` — Confirmation modal dialog
- `src/components/journal/day-navigation.tsx` — Previous/Next day buttons
- `src/components/journal/curriculum-display.tsx` — Curriculum data display (Server Component)

### Server Actions
- `saveJournal(input)` — Creates or updates a journal entry
- `submitJournal(input)` — Submits an existing entry
- `deleteJournal(input)` — Deletes a journal entry
- `fetchJournalEntry(dayNumber)` — Fetches entry data for navigation

---

## Service Layer

Journal operations are in `src/services/journal/`:

| Function | Description |
|----------|-------------|
| `getJournalEntry(dayNumber)` | Get your entry for a specific day |
| `getJournalEntryWithCurriculum(dayNumber)` | Get entry with curriculum data joined |
| `createJournalEntry(input)` | Create a new draft entry |
| `updateJournalEntry(id, input)` | Update an existing entry |
| `submitJournalEntry(id)` | Mark entry as submitted |
| `getJournalHistory(status?)` | Get all your entries, optionally filtered |
| `deleteJournalEntry(id)` | Delete your entry |

### Validation Layer

`src/services/journal/validation.ts` provides:

| Function | Purpose |
|----------|---------|
| `validateDayNumber(value)` | Ensures day is 1–105 |
| `validateJournalInput(input)` | Sanitizes text fields, validates confidence_level |
| `validateSubmission(entry)` | Checks minimum content for submission |
| `validateStatusTransition(from, to)` | Enforces allowed status changes |

### Error Codes

| Code | Meaning |
|------|---------|
| `AUTH_REQUIRED` | User must be authenticated |
| `JOURNAL_NOT_FOUND` | Entry doesn't exist or not owned by user |
| `CURRICULUM_DAY_NOT_FOUND` | Day number doesn't exist in curriculum_days |
| `DUPLICATE_JOURNAL` | Entry already exists for this user+day |
| `VALIDATION_ERROR` | Input failed validation |
| `INVALID_STATUS` | Status transition not allowed |
| `DATABASE_ERROR` | Unexpected database error |

---

## Curriculum Referencing (Not Duplicating)

The journal references curriculum data through a foreign key:

```
daily_learning_entries.day_number → curriculum_days.day_number
```

This means:
- The journal does **not** store curriculum topics, content, or subtopics
- Curriculum data lives in one place (`curriculum_days`)
- If curriculum is updated, journal entries automatically reflect the correct day
- The journal only stores **your experience** of the curriculum day

---

## Curriculum ↔ Journal Integration (Phase 2E)

The curriculum and journal are connected into one clear learning workflow:

```
CURRICULUM DAY
      ↓
TODAY'S TOPIC
      ↓
MY JOURNAL
      ↓
JOURNAL STATUS
      ↓
PROGRESS
```

### Day Status Rules

| Database Status | UI Display | Meaning |
|----------------|------------|---------|
| No entry | **Not started** | No journal exists for this day |
| `draft` | **Draft** | Journal exists but not submitted |
| `submitted` | **Completed** | Journal submitted successfully |
| `used` | **Completed** | AI has consumed this entry (future) |

### Progress Calculation

Progress is based on **submitted journal entries**, not dates:

```
completed_days = count of submitted/used journal entries
percentage = (completed_days / 105) × 100
```

This means:
- Paused journeys show accurate progress
- Future days don't count as completed
- Only submitted journals count toward completion

### Module Progress

A module is complete when **all its days** have submitted journals:

```
Module 1: Days 1–10
  10/10 submitted → ✓ Module Complete
  8/10 submitted → 8/10 complete
```

Drafts do NOT count as completed.

### Curriculum Page (`/curriculum`)

The curriculum page shows:
- Overall progress bar with completion count
- Module progress cards with completion status
- All 105 days grouped by module
- Journal status for each day (Not started / Draft / Completed)
- Action button for each day (Start Journal / Continue Journal / View Journal)
- Current day highlighted with "TODAY" badge

### Dashboard Integration

The dashboard shows:
- Journal-based completion count (not date-based)
- Today's learning with journal status
- Dynamic action button (Start/Continue/View Journal)
- Progress bar reflecting actual submissions

### Navigation

| From | To | How |
|------|-----|-----|
| Curriculum day | Journal | Click Start/Continue/View Journal |
| Dashboard today | Journal | Click action button |
| Journal | Curriculum | Back to Curriculum link |
| Journal | Dashboard | Back to Dashboard link |

### Data Loading

Journal status is loaded efficiently:
- One query fetches ALL user journal entries
- An in-memory map is built: `day_number → status`
- No N+1 query pattern (not 105 separate queries)

### User Data Isolation

Each user only sees their own journal status:
- User A's submitted Day 20 shows as "Completed" for User A
- User B's same Day 20 shows as "Not started" for User B
- RLS enforces this at the database level

### Service Layer

Integration functions are in `src/services/curriculum/integration.ts`:

| Function | Purpose |
|----------|---------|
| `buildJournalStatusMap(entries)` | Creates day→status map from journal entries |
| `enrichCurriculumDays(days, modules, map, current)` | Adds journal status to curriculum days |
| `calculateCurriculumProgress(submitted, current)` | Overall progress calculation |
| `calculateModuleProgress(module, map, current)` | Per-module progress |
| `dayStatusLabel(status)` | User-friendly status label |
| `journalActionLabel(status)` | Action button label |

Types are in `src/types/curriculum.ts`:

| Type | Description |
|------|-------------|
| `DayStatus` | `"not_started" \| "draft" \| "completed"` |
| `CurriculumDayWithStatus` | Curriculum day enriched with journal status |
| `ModuleProgress` | Module progress summary |
| `CurriculumProgress` | Overall progress |
| `TodayLearning` | Dashboard today card data |

---

## Journal History & Review (Phase 2F)

A dedicated history page for reviewing your 105-day learning journey.

### Route

Navigate to `/journal/history` to view journal history.

- Requires authentication
- Only shows entries belonging to the authenticated user
- Accessible via "View Journal History" link on the `/journal` page

### Summary Header

At the top of the history page, a summary shows:

```
YOUR LEARNING JOURNEY
12 / 105    3    90
completed   drafts   days remaining
[████████░░░░░░░░░░░░] 11%
```

Progress is calculated using the same `calculateHistorySummary` as the curriculum and dashboard pages — one source of truth.

### Entry List

Each journal entry in the history shows:

| Field | Description |
|-------|-------------|
| Day number | `Day X / 105` |
| Topic | From curriculum data |
| Module | Module number and title |
| Status | Draft or Completed badge |
| Date | Human-readable (e.g., Aug 20, 2026) |
| Preview | Truncated preview of key fields |
| Confidence | 1–5 or "Not recorded" if null |
| Action | View Journal / Continue Journal |

### Status Behavior

| Database Status | History Display | Action Button |
|----------------|-----------------|---------------|
| `draft` | Draft | Continue Journal |
| `submitted` | Completed | View Journal |
| `used` | Completed | View Journal |
| No entry | Not in list | N/A |

### Filters

| Filter | Behavior |
|--------|----------|
| All | Shows all journal entries |
| Completed | Shows submitted/used entries only |
| Drafts | Shows draft entries only |

The "Not Started" filter is intentionally omitted to avoid complexity. Days without journal entries are calculated from the summary (105 − completed − drafts).

### Sorting

- **Newest first** (default): Day 105 first, Day 1 last
- **Oldest first**: Day 1 first, Day 105 last

### Search

Search by day number, topic, or module title:

- `"5"` → shows Day 5
- `"Hooks"` → shows entries with "Hooks" in topic
- `"Foundations"` → shows entries from that module

### Preview

Each entry shows a truncated preview (120 characters) of:
- What I Learned
- Key Takeaway
- What I Built

Full content is available on `/journal?day=X`.

### Navigation

| From | To | How |
|------|-----|-----|
| Journal | History | "View Journal History" link |
| History | Journal | "View Journal" / "Continue Journal" button |
| History | Journal | Breadcrumb "Journal / History" link |

### Empty State

When no journal entries exist:

```
"Your learning history is empty."
"Start your first journal to build your 105-day learning record."
[Start Today's Journal]
```

### Architecture

```
Journal History Page (src/app/journal/history/page.tsx — Server Component)
    ↓ fetches data via
History Service (src/services/journal/history.ts)
    ↓ queries
Supabase (daily_learning_entries + curriculum_days + curriculum_modules)
    ↓ renders
Journal History List (src/components/journal/journal-history-list.tsx — Client Component)
```

### Types

Types are in `src/types/journal-history.ts`:

| Type | Description |
|------|-------------|
| `JournalHistoryItem` | Enriched journal entry for history view |
| `JournalHistorySummary` | Summary statistics |
| `HistoryFilter` | Filter option: `"all" \| "completed" \| "draft" \| "not_started"` |
| `HistorySort` | Sort option: `"newest" \| "oldest"` |

### Service Layer

Functions are in `src/services/journal/history.ts`:

| Function | Purpose |
|----------|---------|
| `getJournalHistoryItems()` | Fetches journal entries with curriculum data (2 queries, no N+1) |
| `calculateHistorySummary(items)` | Calculates completion stats (re-exported from types) |

Utility functions are in `src/types/journal-history.ts`:

| Function | Purpose |
|----------|---------|
| `toHistoryStatus(status)` | Maps database status to display status |
| `formatHistoryDate(iso)` | Formats timestamp to readable date |
| `truncateText(text, max)` | Truncates text with ellipsis |
| `calculateHistorySummary(items)` | Calculates progress summary |

### Performance

- 2 queries total: one for journal entries, one for modules (8 rows)
- No N+1 pattern — all processing done in-memory
- Curriculum module data fetched once and cached in a Map
- 105 rows is small enough for client-side filtering

### Security

- User authentication required (redirects to `/login` if not authenticated)
- `profile_id` filter enforced server-side (never from client)
- RLS ensures data isolation at database level
- User A never sees User B's journal history

---

## Persistence Workflow (Phase 2D)

### Complete Lifecycle

1. Open `/journal` → see today's curriculum
2. Write notes in any fields
3. Click **Save Draft** → entry created in database
4. Leave the page
5. Return later → saved content loads automatically
6. Edit and save again → same entry updated (no duplicates)
7. Click **Submit Journal** → status changes to "submitted"
8. Return later → submitted journal loads as read-only

### Duplicate Protection

- Database has UNIQUE constraint on `(profile_id, day_number)`
- Service layer catches duplicate creation errors (code 23505)
- UI tracks entry ID after first save to prevent re-creation
- Two rapid saves are handled gracefully (button disabled while saving)

### Data Preservation

- All 13 journal fields persist correctly
- Empty optional fields are preserved as `null`
- Special characters (apostrophes, quotes, line breaks) are preserved
- Technical terms are preserved without modification
- Confidence level can be set and cleared (deselect to clear)

### Timestamps

- `created_at` is set once when the entry is created
- `updated_at` changes on every save
- Timestamps are managed by the database, not the client

### Unsaved Changes Protection

- Browser shows "Leave page?" warning if you have unsaved changes
- Changes are tracked by comparing form state hash with last saved state
- Warning is removed after successful save
- Read-only entries (submitted/used) do not trigger the warning

### Day Navigation

- Previous/Next buttons navigate between days
- Boundaries enforced: Day 1 (no previous), Day 105 (no next)
- Invalid days (0, 106, negative, non-numeric) fall back to today's day
- Each day has its own independent journal entry
- No data mixing between days

### Read-Only Behavior

When a journal is submitted:
- All form fields become disabled
- Save Draft button is hidden
- Submit Journal button is hidden
- Status badge shows "Submitted"
- Content is fully preserved and visible

---

## Testing

Run all journal tests:

```bash
pnpm test
```

### Test Coverage

**Service validation tests** (`src/services/journal/validation.test.ts`):
- Day number validation (1–105, rejects invalid values)
- Input sanitization (trimming, max length, null handling)
- Submission validation (minimum content check)
- Status transition rules (draft→submitted, rejects used)

**Server action tests** (`src/app/actions/journal.test.ts`):
- Save journal (create new, update existing, handle errors)
- Submit journal (success, failure messages)
- Fetch journal entry (found, not found, error)

**Persistence workflow tests** (`src/app/actions/journal-persistence.test.ts`):
- Create draft and verify single row creation
- Reload draft and verify content preservation
- Update draft without creating duplicates
- Submit draft and verify status change
- Reload submitted journal and verify read-only
- Day boundaries (1 and 105)
- Invalid day parameters (0, 106, -1)
- Duplicate creation prevention
- All journal fields persist correctly
- Timestamps (created_at unchanged, updated_at updates)
- Rapid save protection
- Day navigation isolation
- Empty optional fields
- Special characters (apostrophes, line breaks, technical terms)

**UI component tests**:
- `status-badge.test.tsx` — Renders all three status states
- `curriculum-display.test.tsx` — Renders topic, content, subtopics, module, unavailable state
- `day-navigation.test.tsx` — Navigation calls, boundary disabling
- `confirm-dialog.test.tsx` — Open/close, confirm/cancel actions

**Journal form tests** (`src/components/journal/journal-form.test.tsx`):
- Populates form fields from existing entry
- Shows empty form when no entry exists
- Shows correct status badge (draft/submitted)
- Makes form read-only for submitted entries
- Hides save/submit buttons for submitted entries
- Shows save/submit buttons for draft entries
- Disables submit when no content
- Enables submit when content exists
- Displays day number and curriculum topic

---

## UX & Quality Hardening (Phase 2G)

The final journal phase focused on consistency, accessibility, and quality.

### Design Consistency

All journal-related pages use the same visual system:

- Colors: Navy `#0F172A`, Blue `#2563EB`, Cyan `#06B6D4`
- Typography, spacing, buttons, cards, badges, borders are consistent
- Progress bars use gradient (`linear-gradient(90deg, #2563EB, #06B6D4)`) everywhere
- Button labels are consistent: "Save Draft", "Submit Journal", "View Journal", "Continue Journal"

### Status Consistency

Status mapping is consistent across all pages:

| Database | Journal Page | History Page | Dashboard | Curriculum |
|----------|-------------|-------------|-----------|-----------|
| `draft` | Draft | Draft | Draft | Draft |
| `submitted` | Submitted | Completed | Completed | Completed |
| `used` | Used | Completed | Completed | Completed |
| No entry | N/A | N/A | Not started | Not started |

### Progress Consistency

Progress is calculated from one source of truth:

- **Dashboard**: `submittedCount / 105` using `calculateCurriculumProgress()`
- **Curriculum**: Same calculation via `calculateCurriculumProgress()`
- **History**: `calculateHistorySummary()` — same completed/total ratio

All pages show the same numbers.

### Accessibility

- Confirm dialog: `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`, focus management, global Escape key handling
- Confidence selector: `role="radiogroup"`, `role="radio"`, `aria-checked`, `focus-visible` ring
- Status badges: `role="status"`, text indicator (checkmark/dot) alongside color
- Textarea: `aria-describedby` links helper text and character count
- Filter buttons: `aria-pressed` for active state
- Search/sort: `aria-label` or `<label>` for screen readers
- All interactive elements: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]`
- Day navigation: `role="navigation"`, `aria-label`, `aria-current="page"`, arrows hidden from screen readers

### Dead Code Removed

- `src/components/journal/confidence-selector.tsx` — removed (was never imported)
- Duplicate summary block removed from `JournalHistoryList` (was showing twice on history page)

### Configuration

- `brand.totalDays` (105) used consistently instead of hardcoded values
- `brand.totalModules` (8) added and used in dashboard instead of hardcoded "8"

---

## Database Schema

See `DATABASE.md` for the full `daily_learning_entries` table schema.

See `supabase/migrations/20260817200000_daily_learning_entries.sql` for the migration.

---

## Types

TypeScript types are in `src/types/journal.ts`:

| Type | Description |
|------|-------------|
| `JournalEntry` | Database row type |
| `JournalEntryStatus` | `"draft" \| "submitted" \| "used"` |
| `CreateJournalEntryInput` | Input for creating entries |
| `UpdateJournalEntryInput` | Input for updating entries |
| `JournalEntryWithCurriculum` | Entry with joined curriculum data |
