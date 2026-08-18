# AI Content Generation — Phase 3F Setup

## Architecture Overview

The AI content generation system uses a **provider-independent architecture**. The application depends on a `TextGenerationProvider` interface, not a specific AI implementation.

```
PostGenerationInput
        ↓
ProviderFactory.getTextGenerationProvider()
        ↓ (selects based on AI_TEXT_PROVIDER env)
TextGenerationProvider.generatePost(input)
        ↓
ProviderResult { payload, metadata }
```

## Provider Interface

Defined in `src/types/ai.ts`:

```typescript
interface TextGenerationProvider {
  generatePost(input: PostGenerationInput): Promise<ProviderResult>;
}
```

All AI interactions go through this interface. The rest of the application never imports a specific provider directly.

## Provider Factory

Defined in `src/services/ai/index.ts`:

```typescript
const provider = getTextGenerationProvider();
const result = await provider.generatePost(input);
```

The factory reads `AI_TEXT_PROVIDER` from environment variables and returns the appropriate provider. Defaults to `"fallback"` if unset.

## Available Providers

| Provider | Status | Description |
|----------|--------|-------------|
| `fallback` | **Active** | Template-based, deterministic, no external AI |
| `gemini` | **Active** | Gemini 2.0 Flash API, automatic fallback to template on failure |
| OpenAI | Planned | Will be added in a later phase |
| Anthropic | Planned | Will be added in a later phase |

## Fallback Provider

`TemplateFallbackProvider` generates structured posts from journal and curriculum data without any external AI.

**Key properties:**
- **Deterministic**: Same input → same output
- **Zero network calls**: No API keys, no external services
- **Never invents**: Only uses data present in the input
- **Always available**: Works offline, in tests, and in CI

The fallback is intentionally simple. Real AI providers in later phases will produce more natural, engaging content.

## Gemini Provider (Phase 3F)

`GeminiTextProvider` generates LinkedIn posts using the Gemini 2.0 Flash API.

### Architecture

```
PostGenerationInput
    ↓
GeminiTextProvider.generatePost(input)
    ↓
buildPrompt(input) → prompt
    ↓
callGeminiApi(prompt, apiKey) → GeminiResponse
    ↓
parseResponse(response) → GeminiJsonOutput
    ↓
validateGeneratedPostPayload(parsed) → ProviderResult
    ↓
success → ProviderResult { metadata.provider: "gemini" }
failure → TemplateFallbackProvider → ProviderResult { metadata.provider: "fallback" }
```

### Gemini API Details

- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`
- **Model**: `gemini-3.6-flash`
- **Auth**: `GEMINI_API_KEY` passed as `key` query parameter
- **Timeout**: 30 seconds (AbortController)
- **Response format**: `application/json` (via `generationConfig.responseMimeType`)
- **Temperature**: 0.7

### Prompt Structure

The prompt sent to Gemini includes:

1. **Context**: Day number, learning journey framing
2. **Brand Voice**: Tone, avoid words, style rules
3. **Content Rules**: Word count, hashtag limits, structural constraints
4. **Curriculum Context**: Topic, module, content, subtopics, project/assessment info
5. **Journal Entry**: All non-null journal fields
6. **Post Format**: Selected format with description
7. **Guidelines**: First-person voice, no mastery claims, no invented info
8. **Output Schema**: Exact JSON structure required
9. **Hashtag Rules**: Mandatory #105DaysOfCode, #FullStackDevelopment, plus 1–3 topic tags
10. **Template Selection**: Guidance for image template selection

### Error Mapping

| Gemini HTTP Status | AI Error Code |
|-------------------|---------------|
| 400 | `INVALID_INPUT` |
| 401, 403 | `AUTHENTICATION_ERROR` |
| 429 | `RATE_LIMITED` |
| 500, 502, 503 | `PROVIDER_UNAVAILABLE` |
| Abort/timeout | `TIMEOUT` |
| Network failure | `PROVIDER_UNAVAILABLE` |
| Malformed JSON | `INVALID_OUTPUT` |
| Invalid structure | `INVALID_OUTPUT` |

### Fallback Behavior

ANY Gemini failure (auth, network, timeout, invalid output, missing API key) automatically invokes `TemplateFallbackProvider`:

- Fallback never throws because Gemini failed
- Fallback preserves deterministic behavior
- Fallback makes zero external calls
- Metadata identifies the provider actually used (`"gemini"` or `"fallback"`)

### Security

- `GEMINI_API_KEY` read from `process.env` at call time (never stored on instance)
- Never logged, never exposed to client code, never in error messages
- Server-only via `server-only` import in env config
- Not accessible via `NEXT_PUBLIC_*` variables

### Response Validation

Gemini output goes through the EXISTING validation layer (`validateGeneratedPostPayload`). Invalid output triggers fallback, never a raw error.

## Gemini Prompt Structure

## Environment Configuration

Add to `.env.local`:

```bash
# AI provider selection (default: "fallback")
AI_TEXT_PROVIDER=fallback

# Gemini API key (required when AI_TEXT_PROVIDER=gemini)
GEMINI_API_KEY=your-gemini-api-key-here
```

Provider selection:

```bash
# Use template fallback (default, no API key needed)
AI_TEXT_PROVIDER=fallback

# Use Gemini 2.0 Flash (requires GEMINI_API_KEY)
AI_TEXT_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key-here
```

**Never commit real API keys.** Use `.env.local` for secrets.
**Never expose `GEMINI_API_KEY` to `NEXT_PUBLIC_*` variables.**

## Input Structure

`PostGenerationInput` contains:

```typescript
{
  curriculum: {
    dayNumber,          // 1–105
    topic,              // "Git and Terminal Basics"
    moduleNumber,       // 1–8
    moduleTitle,        // "Foundation: Git, Terminal, Python, OOP & DSA"
    content,            // Detailed curriculum content
    subtopics,          // ["git init", "git add", ...]
    projectInformation,
    assessmentInformation,
  },
  journal: {
    whatILearned,       // Main concepts learned
    whatIPracticed,     // Skills practiced
    whatIBuilt,         // Projects created
    challenge,          // Hardest part
    howISolvedIt,       // How challenge was overcome
    keyTakeaway,        // Most important insight
    tomorrowFocus,      // Next day's focus
    projectName,
    projectDescription,
    codeReference,
    resourcesUsed,
    confidenceLevel,    // 1–5
    additionalNotes,
  },
  brandVoice: { tone, avoid, style },
  format: "what-i-learned",  // One of 7 formats
  rules: { ... },
}
```

## Output Structure

`ProviderResult` contains:

```typescript
{
  payload: {
    post: {
      opening,          // Hook line
      body,             // Main content
      takeaway,         // Key insight
      nextStep,         // Tomorrow's focus
      hashtags,         // ['#105DaysOfCode', ...]
    },
    image: {
      headline,         // Image headline text
      subheadline,      // Supporting text
      keywords,         // For image generation
      visualConcept,    // Description of visual idea
      template,         // Template identifier
    },
  },
  metadata: {
    provider,           // "fallback" | "gemini" | ...
    model,              // "template-v1" | "gemini-pro" | ...
    tokensUsed?,        // Optional usage tracking
    generatedAt,        // ISO 8601 timestamp
  },
}
```

## Post Formats

Seven content types are supported:

| Format | Description | Primary Journal Fields |
|--------|-------------|----------------------|
| `what-i-learned` | Share what you learned | whatILearned, keyTakeaway |
| `challenge` | Talk about a challenge | challenge, howISolvedIt |
| `small-win` | Celebrate progress | whatILearned, whatIBuilt |
| `project` | Show what you built | whatIBuilt, projectName |
| `concept` | Explain a concept | whatILearned, whatIPracticed |
| `reflection` | Reflect on journey | keyTakeaway, tomorrowFocus |
| `practical-lesson` | Share a practical tip | whatIPracticed, howISolvedIt |

## Brand Voice

Defined in `src/config/content.ts`:

- **Tone**: authentic, beginner-friendly, professional but not corporate
- **Avoid**: mastered, game-changing, revolutionary, expert-level, leverage, utilize
- **Style**: short sentences, short paragraphs, conversational, use "I" not "we"

## Content Rules

- Target word count: 100–220 words
- Maximum hashtags: 5
- Short paragraphs (1–3 sentences)
- Avoid emojis in posts
- Avoid complex vocabulary
- No unsupported claims
- No invented project results, technologies, problems, or achievements

## Error Handling

AI errors use the `AIError` class (extends `AppError`):

```typescript
class AIError extends AppError {
  aiCode: AIErrorCode;
}
```

Error codes:
- `PROVIDER_UNAVAILABLE` — Provider cannot be reached
- `INVALID_INPUT` — Input validation failed
- `INVALID_OUTPUT` — Provider returned invalid structure
- `RATE_LIMITED` — Provider rate limit exceeded
- `AUTHENTICATION_ERROR` — API key invalid or missing
- `TIMEOUT` — Provider did not respond in time
- `UNKNOWN` — Unexpected error

## Generation Service (Phase 3C)

The generation service orchestrates the complete post generation workflow.

```
Server Action (post-generation.ts)
    ↓
generatePostForDay() (generation.ts)
    ↓
1. Authenticate user
2. Validate day number (1–105)
3. Load curriculum day + module
4. Load journal entry (must be submitted)
5. Select format (explicit or deterministic rotation)
6. buildPostGenerationInput() (input-builder.ts)
7. getTextGenerationProvider() → provider.generatePost(input)
8. validateGeneratedPostPayload()
9. createContentHash()
10. checkDuplicatePost()
11. createGeneratedPost()
    ↓
GeneratedPostRow (draft status)
```

### Input Builder

`src/services/ai/input-builder.ts` contains two pure functions:

- **`selectDefaultFormat(dayNumber)`** — deterministic format rotation: `(dayNumber - 1) % 7`
- **`buildPostGenerationInput({ curriculumDay, module, journal, format })`** — maps DB rows to `PostGenerationInput`

The input builder never invents missing data. Null journal fields stay null.

### Format Rotation

| Day | Format |
|-----|--------|
| 1, 8, 15, ... | `what-i-learned` |
| 2, 9, 16, ... | `challenge` |
| 3, 10, 17, ... | `small-win` |
| 4, 11, 18, ... | `project` |
| 5, 12, 19, ... | `concept` |
| 6, 13, 20, ... | `reflection` |
| 7, 14, 21, ... | `practical-lesson` |

An explicit format can override the rotation.

### Server Action

`src/app/actions/post-generation.ts` provides a thin Server Action:

```typescript
const result = await generatePost({ dayNumber: 1, format?: "challenge" });
// result: { success: true, post } | { success: false, error: { code, message } }
```

The action never throws — it always returns a result type.

### Error Codes

| Code | Meaning |
|------|---------|
| `GENERATION_UNAUTHORIZED` | User not authenticated |
| `CURRICULUM_NOT_FOUND` | Day number has no curriculum entry |
| `JOURNAL_NOT_FOUND` | No journal entry for this day |
| `JOURNAL_NOT_SUBMITTED` | Journal entry is not submitted yet |
| `GENERATION_DUPLICATE` | Identical content already generated |
| `GENERATION_FAILED` | Provider or validation error |

## Image Generation (Phase 3E)

The image generation system follows the same provider-abstracted architecture as text generation.

### Provider Interface

```typescript
interface ImageGenerationProvider {
  generateImage(input: ImageGenerationInput): Promise<ImageProviderResult>;
}
```

### Provider Factory

- Environment variable: `AI_IMAGE_PROVIDER`
- Default: `branded-svg`

### SVG Generation

The `BrandedSvgProvider` generates branded SVG images:
- 1200×1200 square format
- 6 deterministic templates (LARGE_NUMBER, CODE_VISUAL, CONCEPT_DIAGRAM, PROJECT_FOCUSED, PROGRESS, FINAL_MILESTONE)
- Consistent brand identity across all templates
- System fonts only (no external font loading)
- All text escaped for XML safety

### Template Selection

Deterministic selection based on:
1. Explicit template from post metadata
2. Day number (105 → FINAL_MILESTONE)
3. Post format (project → PROJECT_FOCUSED)
4. Topic keywords (OOP → CONCEPT_DIAGRAM, etc.)
5. Milestone days (25, 50, 75 → PROGRESS)
6. Default → LARGE_NUMBER

### Safety

- All user/AI text escaped before SVG insertion
- Forbidden elements rejected: `<script>`, `<foreignObject>`, external URLs
- Fallback SVG always available if generation fails

### Image Service Flow

```
Server Action
→ ImageGenerationService
  → Auth + Load Post + Load Curriculum
  → Build ImageGenerationInput
  → Select Template
  → Provider.generateImage()
  → Upload to Supabase Storage
  → Persist to media_assets
  → Return asset
```

## File Structure

```
src/
  types/
    ai.ts                    ← All AI types, interfaces, AIError class
    image.ts                 ← Image generation types, ImageGenerationProvider
  services/
    ai/
      index.ts               ← Provider factory
      providers/
        fallback.ts          ← TemplateFallbackProvider
        gemini.ts            ← GeminiTextProvider (Gemini 2.0 Flash)
        gemini.test.ts       ← Gemini provider tests (62 tests)
      validation.ts          ← Input/output validation
      input-builder.ts       ← Journal+curriculum → PostGenerationInput
      generation.ts          ← Post generation orchestrator
      ai.test.ts             ← Foundation unit tests
      input-builder.test.ts  ← Input builder tests
      generation.test.ts     ← Generation service tests
    image/
      index.ts               ← Image provider factory
      providers/
        branded-svg.ts       ← BrandedSvgProvider
      validation.ts          ← Image input/output validation
      service.ts             ← Image generation service
      svg/
        escape.ts            ← XML text escaping + safety
        render.ts            ← SVG scaffold
        fallback.ts          ← Fallback SVG generator
        template-selector.ts ← Deterministic template selection
        topic-visuals.ts     ← Topic → visual mapping
        templates/
          index.ts           ← Template registry
          large-number.ts    ← LARGE_NUMBER template
          code-visual.ts     ← CODE_VISUAL template
          concept-diagram.ts ← CONCEPT_DIAGRAM template
          project-focused.ts ← PROJECT_FOCUSED template
          progress.ts        ← PROGRESS template
          final-milestone.ts ← FINAL_MILESTONE template
  app/
    actions/
      post-generation.ts     ← Server Action
      post-generation.test.ts ← Server Action tests
      post-images.ts         ← Image Server Actions
  config/
    content.ts               ← Brand voice, rules, post formats
```

## Testing

Run AI tests:

```bash
pnpm test -- src/services/ai
```

Run Gemini provider tests only:

```bash
pnpm test -- src/services/ai/providers/gemini.test.ts
```

Both providers are fully testable without any real API keys or network access. All fetch calls are mocked.

## What's NOT Implemented Yet

Phase 3A–3F establish the foundation, generation workflow, and Gemini integration. These will be added in later phases:

- ✅ Gemini API integration (Phase 3F)
- ✅ Image generation (Phase 3E — programmatic SVG)
- ❌ OpenAI / Anthropic API integration
- ❌ LinkedIn publishing
- ❌ Post scheduling
- ❌ Post editor UI
- ❌ Post approval UI
- ❌ AI regeneration UI
- ❌ Content analytics
