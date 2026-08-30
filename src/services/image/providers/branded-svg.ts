import type {
  ImageGenerationInput,
  ImageGenerationProvider,
  ImageProviderResult,
} from "@/types/image";
import { brand } from "@/config/brand";
import { renderTemplate } from "../svg/templates";
import { generateFallbackSvg } from "../svg/fallback";
import { checkSvgSafety } from "../svg/escape";
import { renderVisualBrief } from "../visual/compositions";
import { validateVisualBrief } from "../validation";

// ─── Branded SVG Provider ───────────────────────────────────────────────────
// Generates branded SVG images for LinkedIn posts.
// Uses programmatic SVG generation — no external APIs, $0 cost.
// When a structured VisualBrief is available (Phase 5G), it renders a
// content-driven composition that communicates the post's idea; otherwise it
// falls back to the classic template renderer. Both paths are deterministic.

export class BrandedSvgProvider implements ImageGenerationProvider {
  async generateImage(input: ImageGenerationInput): Promise<ImageProviderResult> {
    let svg: string;

    try {
      // Prefer the content-driven composition when a valid VisualBrief exists.
      // If the brief fails mobile-safe/anti-hallucination validation, degrade to
      // the classic template rather than rendering an unsafe/overflowing image.
      if (input.visualBrief && validateVisualBrief(input.visualBrief).length === 0) {
        svg = renderVisualBrief(input.visualBrief);
      } else {
        svg = renderTemplate(input.template, input);
      }
    } catch {
      // Fallback: generate minimal branded SVG
      svg = generateFallbackSvg({
        dayNumber: input.dayNumber,
        topic: input.topic,
      });
    }

    // Safety check
    const safetyIssue = checkSvgSafety(svg);
    if (safetyIssue) {
      // If generated SVG is unsafe, use fallback
      svg = generateFallbackSvg({
        dayNumber: input.dayNumber,
        topic: input.topic,
      });
    }

    return {
      svg,
      width: brand.image.width,
      height: brand.image.height,
      template: input.template,
    };
  }
}
