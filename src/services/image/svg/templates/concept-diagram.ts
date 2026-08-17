import type { ImageGenerationInput } from "@/types/image";
import { brand } from "@/config/brand";
import {
  renderScaffold,
  closeScaffold,
  renderDayNumber,
  renderTopic,
  renderKeywords,
} from "../render";

// ─── Template: CONCEPT_DIAGRAM ──────────────────────────────────────────────
// Simple geometric shapes and connectors for concept-heavy topics.

export function renderConceptDiagram(input: ImageGenerationInput): string {
  const c = brand.colors;
  const cx = brand.image.width / 2;
  const cy = brand.image.height / 2;

  const diagram = `
    <g opacity="0.2">
      <rect x="${cx - 200}" y="${cy - 200}" width="100" height="100" rx="12"
            fill="none" stroke="${c.cyan}" stroke-width="2" />
      <rect x="${cx + 100}" y="${cy - 200}" width="100" height="100" rx="12"
            fill="none" stroke="${c.cyan}" stroke-width="2" />
      <rect x="${cx - 50}" y="${cy - 60}" width="100" height="100" rx="12"
            fill="none" stroke="${c.cyan}" stroke-width="2" />
      <line x1="${cx - 100}" y1="${cy - 100}" x2="${cx}" y2="${cy - 60}"
            stroke="${c.cyan}" stroke-width="1.5" />
      <line x1="${cx + 100}" y1="${cy - 100}" x2="${cx}" y2="${cy - 60}"
            stroke="${c.cyan}" stroke-width="1.5" />
      <circle cx="${cx - 150}" cy="${cy - 150}" r="8" fill="${c.cyan}" />
      <circle cx="${cx + 150}" cy="${cy - 150}" r="8" fill="${c.cyan}" />
      <circle cx="${cx}" cy="${cy - 10}" r="8" fill="${c.cyan}" />
    </g>`;

  const content = [
    diagram,
    renderDayNumber(input.dayNumber),
    renderTopic(input.headline || input.topic, cy + 170),
    renderKeywords(input.keywords, cy + 230),
  ].join("");

  return renderScaffold() + content + closeScaffold();
}
