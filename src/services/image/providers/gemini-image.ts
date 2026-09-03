import type {
  ImageGenerationInput,
  ImageGenerationProvider,
  ImageProviderResult,
  VisualBrief,
} from "@/types/image";
import { brand } from "@/config/brand";
import { serverEnv } from "@/config/env.server";
import { validateVisualBrief } from "../validation";
import { composeBrandedImage } from "../compositor";
import { loadLogoEmbed } from "../logo";
import { hashSeed } from "../theme/seeded";
import { BrandedSvgProvider } from "./branded-svg";

// ─── Gemini Image Provider (Phase 5K+) ──────────────────────────────────────
// Optional AI-image provider that calls the Gemini multimodal image model to
// produce a creative visual, then composites the permanent TB branding (navy
// diagonal, blue accent line, TB logo, footer mark, KEY TAKEAWAYS panel) on top
// using Sharp, so the output still reads as part of the branded 105-day series.
//
// Degradation ladder (never breaks the feed):
//   1. If Gemini returns a valid PNG and compositing succeeds → branded PNG.
//   2. If the request fails (437/quota/billing/network) or compositing throws
//      → fall back to the $0 BrandedSvgProvider so the user always gets an image.
//
// Anti-hallucination: the prompt is built ONLY from the evidence-safe VisualBrief
// (headline, subheadline, concept, technologies, key points, theme) — never from
// raw post text, personal claims, statistics, or internal reasoning.

const GEMINI_IMAGE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent";

const REQUEST_TIMEOUT_MS = 90_000;

// ─── Types ─────────────────────────────────────────────────────────────────

interface GeminiImageRequest {
  readonly contents: Array<{
    readonly parts: Array<{ readonly text: string }>;
  }>;
  readonly generationConfig: {
    readonly responseModalities: readonly string[];
    readonly imageConfig: {
      readonly aspectRatio: string;
      readonly imageSize: string;
    };
  };
}

interface GeminiInlineData {
  readonly mimeType?: string;
  readonly data?: string;
}

interface GeminiImageResponse {
  readonly candidates?: Array<{
    readonly content?: {
      readonly parts?: Array<{
        readonly text?: string;
        readonly inlineData?: GeminiInlineData;
      }>;
    };
  }>;
  readonly error?: {
    readonly code: number;
    readonly message: string;
  };
}

// ─── Provider ───────────────────────────────────────────────────────────────

export class GeminiImageProvider implements ImageGenerationProvider {
  private readonly fallback = new BrandedSvgProvider();

  async generateImage(input: ImageGenerationInput): Promise<ImageProviderResult> {
    const apiKey = serverEnv.geminiApiKey;
    const brief = this.usableBrief(input);

    // If there is no valid brief (nothing safe to prompt from) or no API key,
    // degrade to the branded SVG provider immediately.
    if (!brief || !apiKey) {
      return this.fallback.generateImage(input);
    }

    try {
      const prompt = buildImagePrompt(brief);
      const bytes = await this.callGemini(prompt, apiKey);

      const composited = await composeBrandedImage({
        basePng: bytes,
        brief,
        width: brand.image.width,
        height: brand.image.height,
        logo: await loadLogoEmbed(),
        seed: hashSeed(`gemini:${brief.concept}:${brief.dayNumber ?? 0}`).toString(),
      });

      return {
        png: composited,
        mimeType: "image/png",
        width: brand.image.width,
        height: brand.image.height,
        template: "gemini-image",
      };
    } catch {
      // Graceful degradation: never surface a broken image — fall back to $0 SVG.
      return this.fallback.generateImage(input);
    }
  }

  /** Returns a validated VisualBrief, or null when it cannot be safely used. */
  private usableBrief(input: ImageGenerationInput): VisualBrief | null {
    if (!input.visualBrief) return null;
    if (validateVisualBrief(input.visualBrief).length > 0) return null;
    return input.visualBrief;
  }

  private async callGemini(prompt: string, apiKey: string): Promise<Uint8Array> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const requestBody: GeminiImageRequest = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K",
          },
        },
      };

      const url = new URL(GEMINI_IMAGE_URL);
      url.searchParams.set("key", apiKey);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Gemini image API returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as GeminiImageResponse;
      const inline = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      const base64 = inline?.inlineData?.data;
      const mime = inline?.inlineData?.mimeType ?? "image/png";

      if (!base64) {
        throw new Error("Gemini image response contained no inline image data");
      }

      const bytes = Buffer.from(base64, "base64");
      if (mime === "image/webp" || mime === "image/png" || mime === "image/jpeg") {
        return new Uint8Array(bytes);
      }
      throw new Error(`Unexpected Gemini image MIME type: ${mime}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ─── Prompt Builder ─────────────────────────────────────────────────────────
// Builds an evidence-safe visual prompt from the VisualBrief. Uses only words
// that already appear in the post/curriculum. No statistics, no invented claims.

/** Maps the internal theme to a plain-English style/art-direction hint. */
function themeStyleHint(theme: string): string {
  switch (theme) {
    case "learning-concept":
      return "clean technical concept illustration with clear step labels";
    case "project-build":
      return "modern product/engineering illustration showing a workflow";
    case "problem-solving":
      return "problem → process → solution visual narrative";
    case "technical-explanation":
      return "precise technical diagram / infographic style";
    case "security":
      return "secure, locked-down, protective visual metaphor";
    case "career-growth":
      return "ascending growth / progress mountain visual";
    case "reflection":
      return "calm, introspective, minimal reflective scene";
    case "achievement":
      return "triumphant milestone / flag-on-summit visual";
    default:
      return "clean, modern editorial illustration";
  }
}

/** Concise evidence-safe summary for the prompt. */
function concat(keyPoints: readonly { label: string; detail: string }[]): string {
  return keyPoints
    .slice(0, 3)
    .map((kp) => `${kp.label}: ${kp.detail}`)
    .join("; ");
}

function buildImagePrompt(brief: VisualBrief): string {
  const parts: string[] = [];

  parts.push(
    `Create a professional LinkedIn post cover illustration for a developer's daily learning journey.`,
    `Theme: ${themeStyleHint(brief.theme)}.`,
    `Day covered: DAY ${brief.dayNumber ?? ""}/105${brief.module ? ` · Module: ${brief.module}` : ""}.`,
  );

  if (brief.concept) parts.push(`Core concept: ${brief.concept}.`);
  if (brief.headline) parts.push(`Main heading idea: ${brief.headline}.`);
  if (brief.subheadline) parts.push(`Supporting line: ${brief.subheadline}.`);
  if (brief.visualMetaphor && brief.visualMetaphor !== brief.concept) {
    parts.push(`Visual flow: ${brief.visualMetaphor}.`);
  }
  if (brief.keyPoints && brief.keyPoints.length > 0) {
    parts.push(`Key points: ${concat(brief.keyPoints)}.`);
  }
  if (brief.technologies && brief.technologies.length > 0) {
    parts.push(`Technologies shown: ${brief.technologies.slice(0, 4).join(", ")}.`);
  }

  parts.push(
    `Color palette: deep navy (#061A3A), electric blue (#1769FF), white (#FFFFFF) — professional, modern, minimal.`,
    `Format: wide 16:9 landscape.`,
    `Important: Do NOT render any legible English text or words in the image.`,
    `Style: clean, flat, minimal, high contrast, suitable for a LinkedIn feed.`,
  );

  return parts.join(" ");
}

// ─── Documentation / Config help (exported for clarity, not used at runtime) ─

export const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
export const GEMINI_IMAGE_ENABLED_VAR = "AI_IMAGE_PROVIDER=gemini-image";
