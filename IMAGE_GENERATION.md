# Image Generation — Phase 3E

## Purpose

Generates branded SVG images for LinkedIn posts. The system produces recognizable, consistent visuals for every generated post at $0 cost using programmatic SVG generation.

## Architecture

```
Post Editor UI
    ↓
Server Action (post-images.ts)
    ↓
Image Generation Service (service.ts)
    ↓
ImageGenerationProvider (interface)
    ↓
BrandedSvgProvider (providers/branded-svg.ts)
    ↓
Template Selector → Template Renderer
    ↓
SVG Validation + Sanitization
    ↓
Supabase Storage (post-images bucket)
    ↓
media_assets table
```

## Provider Interface

```typescript
interface ImageGenerationProvider {
  generateImage(input: ImageGenerationInput): Promise<ImageProviderResult>;
}
```

Application code depends on the interface, not directly on `BrandedSvgProvider`.
A new image provider can be added by implementing this interface and registering it in the provider factory.

## Provider Factory

`src/services/image/index.ts`

- Environment variable: `AI_IMAGE_PROVIDER`
- Default: `branded-svg`
- Registry pattern (same as text generation providers)

## Brand System

All images share a consistent identity:

| Element | Value |
|---------|-------|
| Series Title | "105 DAYS OF FULL-STACK DEVELOPMENT" |
| Day Display | "DAY X / 105" |
| Brand Mark | "105 DLJ" (text-based) |
| Canvas | 1200 × 1200 (square) |
| Fonts | Arial, Helvetica, sans-serif (system fonts) |

### Colors

| Name | Hex |
|------|-----|
| Navy | #0F172A |
| Blue | #2563EB |
| Cyan | #06B6D4 |
| Background | #F8FAFC |
| Text | #111827 |

The template changes the layout, NOT the identity.

## Templates

### 1. LARGE_NUMBER
Very large day number as focal point. Topic and keywords below.
Best for: General learning days.

### 2. CODE_VISUAL
Code-like visual blocks. Syntax-themed decorative elements.
Best for: Programming topics (HTML, CSS, JavaScript, Python, etc.).

### 3. CONCEPT_DIAGRAM
Simple geometric shapes and connectors.
Best for: OOP, SOLID, design patterns, architecture, recursion.

### 4. PROJECT_FOCUSED
Project frame with topic emphasis.
Best for: Project-related days, project format posts.

### 5. PROGRESS
Progress bar with percentage. Achievement-focused.
Best for: Milestone days (every 25th day).

### 6. FINAL_MILESTONE
Star burst with "JOURNEY COMPLETE". Reserved for Day 105.

## Template Selection

Deterministic — no randomness.

Priority:
1. Explicit template from post metadata (if valid)
2. Day 105 → FINAL_MILESTONE
3. Project format/topic → PROJECT_FOCUSED
4. Concept topics (OOP, SOLID, recursion) → CONCEPT_DIAGRAM
5. Technical topics (HTML, JS, Python, React) → CODE_VISUAL
6. Milestone days (25, 50, 75) → PROGRESS
7. Default → LARGE_NUMBER

## Topic → Visual Mapping

Configurable mapping in `topic-visuals.ts`. Maps common curriculum topics to visual metadata (label + icon type). Used by templates to render topic-appropriate decorative elements.

## SVG Safety

### Text Escaping

All user/AI-controlled text is escaped before insertion into SVG XML:
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&apos;`

### Forbidden Elements

SVG validation rejects any content containing:
- `<script>`, `</script>`
- `<foreignObject>`
- `<iframe>`, `<object>`, `<embed>`
- `<link>`, `<meta>`
- `javascript:` protocol
- External URLs in `href`, `src`, `xlink:href`
- `data:text/html`

### Design Rule

The AI never returns raw SVG markup. It only provides structured data (headline, keywords, template). The application constructs the SVG.

## Fallback

If `BrandedSvgProvider` throws or produces unsafe SVG:
- `generateFallbackSvg()` produces a minimal branded SVG
- Contains: series title, day number, topic, brand colors, brand mark
- No external dependencies
- Always succeeds

## Database

### Table: `media_assets`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `profile_id` | `uuid` | FK → profiles(id) |
| `generated_post_id` | `uuid` | FK → generated_posts(id), UNIQUE |
| `storage_path` | `text` | Supabase Storage path |
| `storage_url` | `text` | Public URL |
| `mime_type` | `text` | Always `image/svg+xml` |
| `width` | `integer` | Image width (1200) |
| `height` | `integer` | Image height (1200) |
| `template` | `text` | Template used |
| `alt_text` | `text` | Accessible alt text |
| `metadata` | `jsonb` | Additional metadata |
| `created_at` | `timestamptz` | Creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

### Constraints
- UNIQUE on `generated_post_id` (one image per post)
- RLS enabled with owner-only policies

## Storage

- Bucket: `post-images` (**private** since Phase 3H — publishing is text-only, so world-readable images served no purpose)
- Path: `{profile_id}/{post_id}/image.svg`
- Server-side uploads only (via `createClient()` with auth)
- Images are served to their owner through the authenticated route
  `/api/media/[postId]/image` (session-authenticated, RLS-checked); the
  `media_assets.storage_url` column stores this route path
- RLS on `media_assets` table controls metadata access (owner-only)
- Storage policies: only the owner can read/upload/delete within their
  `{auth.uid()}` path prefix — another user's files are inaccessible

## Regeneration

Regenerating an image:
1. Preserves post text
2. Deletes existing media asset record
3. Removes old storage file
4. Generates new SVG
5. Uploads to storage
6. Creates new media asset record
7. No orphaned records

## Download

SVG download via client-side blob:
1. Fetch SVG content from storage URL
2. Create Blob with `image/svg+xml` type
3. Create temporary download link
4. Trigger click
5. Clean up

No paid PNG conversion required.

## Alt Text

Format: `"Day {X} of 105 DAYS OF FULL-STACK DEVELOPMENT: {topic}"`

## Cost

$0 — all programmatic SVG generation. No external APIs, no paid services.

## Visual Brief System (Phase 5G / 5H)

On top of the classic templates, the provider renders a **visual brief** — a
structured description of the post's content — when it is available and passes
validation. This produces post-aware, concept-priority visuals rather than a
generic template.

### Concept-Priority Pipelines

Built from the final post text (not the AI prompt), so nothing is invented:

1. **Smart text extraction** (`visual/brief.ts`)
   - `cleanVisualText()` strips hashtags, emojis, URLs, `@handles`, and filler
     phrases ("today i", "i learned", "let me share").
   - Key points are extracted from detected concept-chain nodes, never
     fabricated.
2. **Concept chains** (`visual/concept-chains.ts`)
   - Deterministic, first-match-wins mappings from curriculum/post text to
     technical concepts (e.g. RLS → "Row-Level Security", `index` → "Database
     Index", REST API, auth, git, debugging, engineering tradeoffs, deployment).
   - `detectTopConcepts(text, topic)` returns `{ primary, secondary, optional }`
     — one strong idea per image.
   - No `Math.random()`; all selection is deterministic.
3. **Themes & composition** (`visual/themes.ts`)
   - `selectComposition()` picks a composition from post type + content shape.
     Learning/process-like text maps to `input-process-output`; engineering
     decisions → `comparison`; AI engineering → `three-ideas`; deployments →
     `architecture-flow`; milestones → `skill-progression`.
   - `selectEmphasis()` returns a `RecruiterEmphasis` (`problem-solve`,
     `architecture`, `concept-explanation`, `security-flow`, `simple`).

### Anti-Hallucination

- `visual/validation.ts` `validateVisualBrief()` blocks unsupported claims
  (metric tokens such as "users", "million", "10,000", "certified",
  "years of experience", etc.) and enforces length caps.
- The provider **only** renders the composition path when the brief passes
  validation cleanly; otherwise it falls back to the classic template (which
  itself falls back to the minimal fallback SVG if needed).
- Only exact post/curriculum concepts and verified metadata are ever shown.
- Internal quality scores/evidence are never exposed to the viewer.

### Recruiter-Aware Design

- `RecruiterEmphasis` only surfaces recruiter-relevant signals (problem solving,
  architecture, concept depth, security flow) when the content genuinely
  supports them.
- The primary concept is rendered as a Level-1 uppercase tag pill; a wrapped
  headline (≤2 lines) sits below; subheadline wraps to ≤2 lines.

### Mobile-Safe Layout

- Canvas: 1200×1200 with 70–90px safe margins on every edge.
- Content is centered and sized for legibility at preview scale.
- Caps: headline ≤60 chars, subheadline ≤110, key-point labels ≤30, metaphor
  nodes ≤24 chars.

### Compositions (8)

`concept-flow`, `problem-solution`, `comparison`, `three-ideas`, `pros-cons`,
`architecture-flow`, `skill-progression`, and `input-process-output` (added in
5H: three INPUT/PROCESS/OUTPUT stages with arrows and caption pills).

Each composition reuses shared primitives in `visual/compositions/draw.ts`
(headline wrapping, tag pills, safe margins) from
`visual/compositions/index.ts` (`renderVisualBrief`).

## Testing

Tests cover:
- SVG text escaping and safety validation
- Template selection (all branches)
- Topic visual mapping
- Each template rendering (dimensions, brand text, colors)
- Fallback generation
- Provider interface behavior
- Provider factory
- Input/output validation
- Server action error handling
- Image section component rendering
- Post metadata integration

## Files

| File | Purpose |
|------|---------|
| `src/types/image.ts` | Types and interfaces |
| `src/services/image/index.ts` | Provider factory |
| `src/services/image/providers/branded-svg.ts` | SVG provider |
| `src/services/image/validation.ts` | Input/output validation |
| `src/services/image/service.ts` | Image generation service |
| `src/services/image/svg/escape.ts` | XML escaping + safety |
| `src/services/image/svg/render.ts` | SVG scaffold |
| `src/services/image/svg/templates/` | 6 template renderers |
| `src/services/image/svg/template-selector.ts` | Template selection |
| `src/services/image/svg/topic-visuals.ts` | Topic mapping |
| `src/services/image/svg/fallback.ts` | Fallback SVG |
| `src/services/image/visual/brief.ts` | Visual brief builder (concept priority, text extraction, emphasis) |
| `src/services/image/visual/themes.ts` | Theme/emphasis/composition selection |
| `src/services/image/visual/concept-chains.ts` | Concept chain detection + `detectTopConcepts` |
| `src/services/image/visual/compositions/` | 8 composition renderers + shared `draw` primitives |
| `src/services/image/validation.ts` | Input/output + `validateVisualBrief` |
| `src/app/actions/post-images.ts` | Server actions |
| `src/components/posts/image-section.tsx` | Editor image UI |
| `supabase/migrations/20260817400000_media_assets.sql` | DB migration |
