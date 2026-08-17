import type {
  ImageGenerationInput,
  ImageGenerationProvider,
  ImageProviderResult,
} from "@/types/image";
import { brand } from "@/config/brand";
import { renderTemplate } from "../svg/templates";
import { generateFallbackSvg } from "../svg/fallback";
import { checkSvgSafety } from "../svg/escape";

// ─── Branded SVG Provider ───────────────────────────────────────────────────
// Generates branded SVG images for LinkedIn posts.
// Uses programmatic SVG generation — no external APIs, $0 cost.

export class BrandedSvgProvider implements ImageGenerationProvider {
  async generateImage(input: ImageGenerationInput): Promise<ImageProviderResult> {
    let svg: string;

    try {
      svg = renderTemplate(input.template, input);
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
