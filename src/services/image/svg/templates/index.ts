import type { ImageGenerationInput, ImageTemplate } from "@/types/image";
import { renderLargeNumber } from "./large-number";
import { renderCodeVisual } from "./code-visual";
import { renderConceptDiagram } from "./concept-diagram";
import { renderProjectFocused } from "./project-focused";
import { renderProgress } from "./progress";
import { renderFinalMilestone } from "./final-milestone";

// ─── Template Registry ──────────────────────────────────────────────────────
// Maps each template ID to its renderer function.

const templateRenderers: Record<ImageTemplate, (input: ImageGenerationInput) => string> = {
  "large-number": renderLargeNumber,
  "code-visual": renderCodeVisual,
  "concept-diagram": renderConceptDiagram,
  "project-focused": renderProjectFocused,
  "progress": renderProgress,
  "final-milestone": renderFinalMilestone,
};

/**
 * Renders an SVG image using the specified template.
 */
export function renderTemplate(
  template: ImageTemplate,
  input: ImageGenerationInput,
): string {
  const renderer = templateRenderers[template];
  return renderer(input);
}
