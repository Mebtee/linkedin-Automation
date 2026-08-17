import type { ImageGenerationInput } from "@/types/image";
import { brand } from "@/config/brand";
import {
  renderScaffold,
  closeScaffold,
  renderDayNumber,
  renderTopic,
  renderKeywords,
} from "../render";

// ─── Template: CODE_VISUAL ──────────────────────────────────────────────────
// Code-like visual blocks. Suitable for programming topics.

export function renderCodeVisual(input: ImageGenerationInput): string {
  const c = brand.colors;
  const cx = brand.image.width / 2;
  const cy = brand.image.height / 2;

  const codeBlocks = `
    <g opacity="0.15">
      <rect x="${cx - 350}" y="${cy - 180}" width="120" height="16" rx="4" fill="${c.cyan}" />
      <rect x="${cx - 350}" y="${cy - 155}" width="200" height="16" rx="4" fill="white" />
      <rect x="${cx - 350}" y="${cy - 130}" width="160" height="16" rx="4" fill="white" />
      <rect x="${cx - 350}" y="${cy - 105}" width="180" height="16" rx="4" fill="${c.cyan}" />
    </g>
    <g opacity="0.15">
      <rect x="${cx + 230}" y="${cy + 60}" width="120" height="16" rx="4" fill="${c.cyan}" />
      <rect x="${cx + 230}" y="${cy + 85}" width="200" height="16" rx="4" fill="white" />
      <rect x="${cx + 230}" y="${cy + 110}" width="160" height="16" rx="4" fill="white" />
    </g>`;

  const content = [
    codeBlocks,
    renderDayNumber(input.dayNumber),
    renderTopic(input.headline || input.topic, cy + 160),
    renderKeywords(input.keywords, cy + 220),
  ].join("");

  return renderScaffold() + content + closeScaffold();
}
