import type { ImageGenerationInput } from "@/types/image";
import { brand } from "@/config/brand";
import {
  renderScaffold,
  closeScaffold,
  renderDayNumber,
  renderTopic,
  renderKeywords,
} from "../render";

// ─── Template: PROGRESS ─────────────────────────────────────────────────────
// Strong day number. Progress visual bar. Same brand system.

export function renderProgress(input: ImageGenerationInput): string {
  const c = brand.colors;
  const cx = brand.image.width / 2;
  const cy = brand.image.height / 2;
  const progressPercent = (input.dayNumber / brand.totalDays) * 100;

  const progressBar = `
    <rect x="${cx - 300}" y="${cy + 130}" width="600" height="12" rx="6"
          fill="white" opacity="0.1" />
    <rect x="${cx - 300}" y="${cy + 130}" width="${600 * (progressPercent / 100)}"
          height="12" rx="6" fill="${c.cyan}" opacity="0.8" />
    <text x="${cx + 320}" y="${cy + 142}" text-anchor="start"
          font-family="Arial, Helvetica, sans-serif" font-size="14"
          font-weight="500" fill="${c.cyan}" opacity="0.8">
      ${Math.round(progressPercent)}%
    </text>`;

  const content = [
    renderDayNumber(input.dayNumber),
    progressBar,
    renderTopic(input.headline || input.topic, cy + 190),
    renderKeywords(input.keywords, cy + 250),
  ].join("");

  return renderScaffold() + content + closeScaffold();
}
