import type { ImageGenerationInput } from "@/types/image";
import { brand } from "@/config/brand";
import {
  renderScaffold,
  closeScaffold,
  renderDayNumber,
  renderTopic,
  renderKeywords,
} from "../render";

// ─── Template: PROJECT_FOCUSED ──────────────────────────────────────────────
// Emphasizes project/topic. Includes day number and branding.

export function renderProjectFocused(input: ImageGenerationInput): string {
  const c = brand.colors;
  const cx = brand.image.width / 2;
  const cy = brand.image.height / 2;

  const projectFrame = `
    <rect x="${cx - 280}" y="${cy - 220}" width="560" height="140" rx="16"
          fill="none" stroke="${c.cyan}" stroke-width="2" opacity="0.2" />
    <rect x="${cx - 260}" y="${cy - 200}" width="520" height="100" rx="10"
          fill="white" opacity="0.05" />`;

  const content = [
    projectFrame,
    renderDayNumber(input.dayNumber),
    renderTopic(input.headline || input.topic, cy - 140),
    renderKeywords(input.keywords, cy - 80),
  ].join("");

  return renderScaffold() + content + closeScaffold();
}
