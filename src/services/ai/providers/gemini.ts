import type {
  TextGenerationProvider,
  PostGenerationInput,
  ProviderResult,
  GeneratedPostPayload,
} from "@/types/ai";
import { AIError } from "@/types/ai";
import { validateGeneratedPostPayload } from "@/services/ai/validation";
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

    const journalSection = this.buildJournalSection(journal);
    const curriculumSection = this.buildCurriculumSection(curriculum);
    const formatSection = this.buildFormatSection(format);

    return `You are generating a LinkedIn post for someone on Day ${curriculum.dayNumber} of a 105-day full-stack development learning journey.

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

## Curriculum Context
${curriculumSection}

## Journal Entry
${journalSection}

## Post Format
${formatSection}

## Important Guidelines
- Write in first-person beginner voice ("I learned...", "I practiced...")
- Never claim mastery or expertise
- Never invent information not present in the journal or curriculum
- Be authentic and honest about the learning experience
- Use short, simple sentences
- Sound like a real person documenting their daily progress

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

## Hashtag Requirements
- MUST include #105DaysOfCode
- MUST include #FullStackDevelopment
- Add 1–3 additional topic-relevant hashtags
- Maximum ${rules.maxHashtags} hashtags total
- Each hashtag must start with #

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
