import type {
  TextGenerationProvider,
  PostGenerationInput,
  ProviderResult,
  GeneratedPostPayload,
} from "@/types/ai";
import { AIError } from "@/types/ai";
import type { RecruiterPostGenerationContext } from "@/types/content-opportunity";
import { validateGeneratedPostPayload } from "@/services/ai/validation";
import { POST_TYPE_META } from "@/config/recruiter";
import { TemplateFallbackProvider } from "./fallback";

// ─── Constants ─────────────────────────────────────────────────────────────

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

const REQUEST_TIMEOUT_MS = 30_000;

const GEMINI_MODEL = "gemini-3.6-flash";

// ─── Types ─────────────────────────────────────────────────────────────────

interface GeminiRequest {
  readonly contents: Array<{
    readonly parts: Array<{ readonly text: string }>;
  }>;
  readonly generationConfig: {
    readonly responseMimeType: string;
    readonly temperature: number;
  };
}

interface GeminiResponse {
  readonly candidates?: Array<{
    readonly content?: {
      readonly parts?: Array<{ readonly text?: string }>;
    };
  }>;
  readonly error?: {
    readonly code: number;
    readonly message: string;
  };
}

interface GeminiJsonOutput {
  readonly post: {
    readonly opening: string;
    readonly body: string;
    readonly takeaway: string;
    readonly nextStep: string;
    readonly hashtags: string[];
  };
  readonly image: {
    readonly headline: string;
    readonly subheadline: string;
    readonly keywords: string[];
    readonly visualConcept: string;
    readonly template: string;
  };
}

// ─── GeminiTextProvider ────────────────────────────────────────────────────

/**
 * GeminiTextProvider — generates LinkedIn posts using the Gemini 2.0 Flash API.
 *
 * On any Gemini failure (network, auth, invalid output, timeout, etc.),
 * transparently falls back to TemplateFallbackProvider.
 */
export class GeminiTextProvider implements TextGenerationProvider {
  private readonly fallback = new TemplateFallbackProvider();

  // ─── Course Material Structuring (Phase 3I) ─────────────────────────────
  //
  // Optional capability used by the course-PDF ingestion workflow. Reuses the
  // same API plumbing as generatePost — no second provider architecture.
  // Returns a parsed JSON object on success, or null when the provider is
  // unavailable/misconfigured — callers must degrade to deterministic logic.

  async structureCourseMaterial(
    prompt: string,
  ): Promise<Record<string, unknown> | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "") return null;

    try {
      const rawResponse = await this.callGeminiApi(prompt, apiKey);
      const parsed = this.parseResponse(rawResponse);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as unknown as Record<string, unknown>)
        : null;
    } catch {
      // Any failure degrades to the deterministic path — never throws.
      return null;
    }
  }

  async generatePost(input: PostGenerationInput): Promise<ProviderResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      return this.withFallback(input, new AIError("Gemini API key is not configured", { code: "AUTHENTICATION_ERROR" }));
    }

    try {
      const prompt = this.buildPrompt(input);
      const rawResponse = await this.callGeminiApi(prompt, apiKey);
      const parsed = this.parseResponse(rawResponse);
      const validated = this.validateOutput(parsed);

      return {
        payload: validated,
        metadata: {
          provider: "gemini",
          model: GEMINI_MODEL,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      const mapped = error instanceof AIError ? error : this.mapError(error);
      return this.withFallback(input, mapped);
    }
  }

  // ─── Prompt Construction ────────────────────────────────────────────────

  buildPrompt(input: PostGenerationInput): string {
    const { curriculum, journal, brandVoice, format, rules } = input;
    const recruiter = input.recruiter;

    const audience = recruiter
      ? "You are writing a LinkedIn post for a junior/full-stack developer who is building a public portfolio and wants their profile to be useful to recruiters.\nThe purpose is not to sound like an expert.\nThe purpose is to clearly demonstrate: real work, technical growth, problem solving, consistency, practical understanding, and honest learning."
      : `You are generating a LinkedIn post for someone on Day ${curriculum.dayNumber} of a 105-day full-stack development learning journey.`;

    const journalSection = this.buildJournalSection(journal);
    const curriculumSection = this.buildCurriculumSection(curriculum);
    const formatSection = recruiter
      ? this.buildRecruiterFormatSection(recruiter)
      : this.buildFormatSection(format);
    const recruiterSection = recruiter
      ? this.buildRecruiterSection(recruiter)
      : "";
    const guidelines = recruiter
      ? this.buildRecruiterGuidelines()
      : `- Write in first-person beginner voice ("I learned...", "I practiced...")
- Never claim mastery or expertise
- Never invent information not present in the journal or curriculum
- Be authentic and honest about the learning experience
- Use short, simple sentences
- Sound like a real person documenting their daily progress`;
    const hashtagSection = recruiter
      ? this.buildRecruiterHashtagRequirements(recruiter, rules.maxHashtags)
      : `## Hashtag Requirements
- MUST include #105DaysOfCode
- MUST include #FullStackDevelopment
- Add 1–3 additional topic-relevant hashtags
- Maximum ${rules.maxHashtags} hashtags total
- Each hashtag must start with #`;

    return `${audience}

## Brand Voice
- Tone: ${brandVoice.tone.join(", ")}
- Avoid these words: ${brandVoice.avoid.join(", ")}
- Style: ${brandVoice.style.join(", ")}

## Content Rules
- Target word count: ${rules.targetWordCount.min}–${rules.targetWordCount.max} words
- Maximum hashtags: ${rules.maxHashtags}
- Short paragraphs (1–3 sentences)
- No emojis
- Simple vocabulary (no complex words)
- No unsupported claims
- Never invent project results, technologies, problems, or achievements
- Never claim mastery or expertise — this is a beginner learning journey
${recruiterSection}

## Curriculum Context
${curriculumSection}

## Journal Entry
${journalSection}

## Post Format
${formatSection}

## Important Guidelines
${guidelines}

## Required JSON Output
Return ONLY valid JSON matching this exact structure — no markdown, no code fences, no extra text:

{
  "post": {
    "opening": "Hook line for the post",
    "body": "Main content in 1–3 short paragraphs (100–220 words total)",
    "takeaway": "Key insight from today's learning",
    "nextStep": "What comes next tomorrow",
    "hashtags": ["#105DaysOfCode", "#FullStackDevelopment", "#RelevantTopic"]
  },
  "image": {
    "headline": "Short headline for image",
    "subheadline": "Supporting subtitle",
    "keywords": ["keyword1", "keyword2"],
    "visualConcept": "Brief description of the visual concept",
    "template": "one of: learner-progress, code-visual, concept-diagram, project-focused, large-number, progress, final-milestone"
  }
}

${hashtagSection}

## Image Template Selection
Choose the most appropriate template based on the content:
- "learner-progress" — default for general learning posts
- "code-visual" — when code/terminal is a key focus
- "concept-diagram" — when explaining a theoretical concept
- "project-focused" — when showcasing a project
- "large-number" — for milestone day numbers
- "progress" — for milestone checkpoints (day 25, 50, 75)
- "final-milestone" — only for day 105`;
  }

  // ─── Recruiter-Aware Output Enhancements (Phase 5C) ──────────────────────

  /**
   * Builds the "Selected Content Opportunity + Evidence" prompt section for a
   * recruiter-driven generation. The selected opportunity is the primary
   * content direction; the evidence is the ONLY allowed ground truth.
   */
  private buildRecruiterSection(recruiter: RecruiterPostGenerationContext): string {
    const meta = POST_TYPE_META[recruiter.postType];
    const parts: string[] = [
      "## Selected Content Opportunity",
      `- Post type: ${recruiter.postType} (${meta.label})`,
      `- Title: ${recruiter.title}`,
      `- Content goal: ${recruiter.contentGoal}`,
      `- Recruiter score: ${recruiter.recruiterScore}/100`,
      `- Selection reason: ${recruiter.selectionReason ?? "—"}`,
      `- Evidence strength: ${recruiter.evidenceStrength}`,
      `- Personal-experience claims allowed: ${
        recruiter.personalExperience
          ? "YES but ONLY from USER_CONFIRMED evidence"
          : "NO — learning content only"
      }`,
      "",
      "This selected opportunity is the ONLY story to write about. Do not change the topic and do not drift into another subject.",
      "",
      "## Evidence (ground truth — never fabricate anything beyond this)",
      "For each evidence field below, the exact user-provided text and its confidence level:",
    ];

    for (const entry of recruiter.evidence) {
      const pages =
        entry.pageNumbers.length > 0
          ? ` (PDF pages: ${entry.pageNumbers.join(", ")})`
          : "";
      parts.push(
        `- ${entry.field}: "${entry.value ?? "(no text)"}" — confidence: ${entry.confidence}${pages}`,
      );
    }
    if (recruiter.evidence.length === 0) {
      parts.push("- (No evidence references — learning content only, describe the topic without claiming personal work)");
    }

    parts.push(
      "",
      "Claim rules by confidence level:",
      "- USER_CONFIRMED: may support first-person personal experience (\"I built\", \"I solved\", \"I deployed\").",
      "- SUPPORTED_BY_PDF: describes what the course/material teaches. It must NOT automatically become a claim that the user personally completed or built it.",
      "- INFERRED_FROM_STRUCTURE: provides contextual learning information only. Can never support a personal achievement claim.",
      "- MISSING: cannot support a factual personal claim.",
    );

    return parts.join("\n");
  }

  private buildRecruiterFormatSection(recruiter: RecruiterPostGenerationContext): string {
    const meta = POST_TYPE_META[recruiter.postType];
    const steps = meta.structure.map((step, i) => `${i + 1}. ${step}`).join("\n");
    return `Follow this ${meta.label} post structure exactly:\n${steps}`;
  }

  private buildRecruiterGuidelines(): string {
    return `- Write in an authentic first-person beginner/developer voice
- The selected opportunity is the ONLY content direction; never switch to a generic topic
- Never exaggerate experience
- Never claim mastery
- Never invent projects
- Never invent technologies
- Never invent results
- Never invent metrics
- Never invent deployment
- Never invent users
- Never invent performance improvements
- Never invent problems or solutions
- Use only information supported by the supplied evidence and journal
- When evidence is insufficient for a personal claim, describe the topic as learning rather than personal achievement
- Use short, simple sentences
- Sound like a real developer learning in public`;
  }

  private buildRecruiterHashtagRequirements(
    recruiter: RecruiterPostGenerationContext,
    maxHashtags: number,
  ): string {
    const focus = POST_TYPE_META[recruiter.postType].hashtagFocus
      .join(", ");
    return `## Hashtag Requirements
- MUST include #FullStackDevelopment
- MUST include #105DaysOfCode (this post is part of the 105-day learning journey)
- Add 1–3 additional topic-relevant hashtags. Suggested focus: ${focus || "#FullStackDevelopment"}
- Maximum ${maxHashtags} hashtags total
- Do not add irrelevant popular hashtags just to reach more people
- Each hashtag must start with #`;
  }

  private buildCurriculumSection(curriculum: PostGenerationInput["curriculum"]): string {
    const parts: string[] = [
      `Day: ${curriculum.dayNumber} of 105`,
      `Topic: ${curriculum.topic}`,
      `Module ${curriculum.moduleNumber}: ${curriculum.moduleTitle}`,
      `Content: ${curriculum.content}`,
    ];

    if (curriculum.subtopics.length > 0) {
      parts.push(`Subtopics: ${curriculum.subtopics.join(", ")}`);
    }

    if (curriculum.projectInformation) {
      parts.push(`Project: ${curriculum.projectInformation}`);
    }

    if (curriculum.assessmentInformation) {
      parts.push(`Assessment: ${curriculum.assessmentInformation}`);
    }

    return parts.join("\n");
  }

  private buildJournalSection(journal: PostGenerationInput["journal"]): string {
    const parts: string[] = [];

    if (journal.whatILearned) parts.push(`What I learned: ${journal.whatILearned}`);
    if (journal.whatIPracticed) parts.push(`What I practiced: ${journal.whatIPracticed}`);
    if (journal.whatIBuilt) parts.push(`What I built: ${journal.whatIBuilt}`);
    if (journal.challenge) parts.push(`Challenge: ${journal.challenge}`);
    if (journal.howISolvedIt) parts.push(`How I solved it: ${journal.howISolvedIt}`);
    if (journal.keyTakeaway) parts.push(`Key takeaway: ${journal.keyTakeaway}`);
    if (journal.tomorrowFocus) parts.push(`Tomorrow's focus: ${journal.tomorrowFocus}`);
    if (journal.projectName) parts.push(`Project name: ${journal.projectName}`);
    if (journal.projectDescription) parts.push(`Project description: ${journal.projectDescription}`);
    if (journal.codeReference) parts.push(`Code reference: ${journal.codeReference}`);
    if (journal.resourcesUsed) parts.push(`Resources used: ${journal.resourcesUsed}`);
    if (journal.confidenceLevel !== null) parts.push(`Confidence level: ${journal.confidenceLevel}/5`);
    if (journal.additionalNotes) parts.push(`Additional notes: ${journal.additionalNotes}`);

    if (parts.length === 0) {
      parts.push("(No journal entry provided for this day)");
    }

    return parts.join("\n");
  }

  private buildFormatSection(format: PostGenerationInput["format"]): string {
    const formatDescriptions: Record<string, string> = {
      "what-i-learned": "What I Learned — Share the main thing you learned today.",
      challenge: "Challenge — Talk about a challenge you faced and how you solved it.",
      "small-win": "Small Win — Celebrate a small but meaningful progress.",
      project: "Project — Show what you built or worked on.",
      concept: "Concept — Explain a concept you studied today.",
      reflection: "Reflection — Reflect on your learning journey so far.",
      "practical-lesson": "Practical Lesson — Share a practical lesson or tip you discovered.",
    };

    return formatDescriptions[format] ?? format;
  }

  // ─── API Call ───────────────────────────────────────────────────────────

  async callGeminiApi(prompt: string, apiKey: string): Promise<GeminiResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const requestBody: GeminiRequest = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      };

      const url = new URL(GEMINI_API_URL);
      url.searchParams.set("key", apiKey);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorBody: GeminiResponse | undefined;
        try {
          errorBody = await response.json() as GeminiResponse;
        } catch {
          // Response body may not be JSON
        }

        const error = new Error(`Gemini API returned HTTP ${response.status}`) as GeminiApiError;
        error.status = response.status;
        error.errorBody = errorBody;
        throw error;
      }

      return (await response.json()) as GeminiResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ─── Response Parsing & Validation ──────────────────────────────────────

  parseResponse(response: GeminiResponse): GeminiJsonOutput {
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new AIError("Gemini returned empty response", { code: "INVALID_OUTPUT" });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new AIError("Gemini returned malformed JSON", { code: "INVALID_OUTPUT" });
    }

    return parsed as GeminiJsonOutput;
  }

  validateOutput(parsed: GeminiJsonOutput): GeneratedPostPayload {
    try {
      return validateGeneratedPostPayload(parsed);
    } catch (error) {
      throw new AIError(
        `Gemini output failed validation: ${error instanceof Error ? error.message : "Invalid structure"}`,
        { code: "INVALID_OUTPUT", cause: error },
      );
    }
  }

  // ─── Error Mapping ──────────────────────────────────────────────────────

  mapError(error: unknown): AIError {
    if (error instanceof AIError) {
      return error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      return new AIError("Gemini API request timed out", { code: "TIMEOUT" });
    }

    if (error instanceof Error && "status" in error) {
      const status = Number((error as { status: unknown }).status);

      if (status === 400) {
        return new AIError("Gemini API returned invalid input", { code: "INVALID_INPUT" });
      }
      if (status === 401 || status === 403) {
        return new AIError("Gemini API authentication failed", { code: "AUTHENTICATION_ERROR" });
      }
      if (status === 429) {
        return new AIError("Gemini API rate limit exceeded", { code: "RATE_LIMITED" });
      }
      if (status === 500 || status === 502 || status === 503) {
        return new AIError("Gemini API is unavailable", { code: "PROVIDER_UNAVAILABLE" });
      }
    }

    if (error instanceof Error && error.message.includes("fetch failed")) {
      return new AIError("Gemini API network error", { code: "PROVIDER_UNAVAILABLE" });
    }

    return new AIError(
      `Gemini provider error: ${error instanceof Error ? error.message : "Unknown error"}`,
      { code: "UNKNOWN" },
    );
  }

  // ─── Fallback ───────────────────────────────────────────────────────────

  private async withFallback(
    input: PostGenerationInput,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- error kept for future logging/debugging
    geminiError: AIError,
  ): Promise<ProviderResult> {
    const fallbackResult = await this.fallback.generatePost(input);

    return {
      payload: fallbackResult.payload,
      metadata: {
        provider: "fallback",
        model: "template-v1",
        generatedAt: fallbackResult.metadata.generatedAt,
      },
    };
  }
}

// ─── Internal Error Type ───────────────────────────────────────────────────

interface GeminiApiError extends Error {
  status: number;
  errorBody?: GeminiResponse;
}
