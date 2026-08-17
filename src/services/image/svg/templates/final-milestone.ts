import type { ImageGenerationInput } from "@/types/image";
import { brand } from "@/config/brand";
import {
  renderScaffold,
  closeScaffold,
  renderTopic,
  renderKeywords,
} from "../render";

// ─── Template: FINAL_MILESTONE ──────────────────────────────────────────────
// Reserved for Day 105 or final milestone. Visually special but same brand system.

export function renderFinalMilestone(input: ImageGenerationInput): string {
  const c = brand.colors;
  const cx = brand.image.width / 2;
  const cy = brand.image.height / 2;

  const starBurst = `
    <g opacity="0.12">
      <polygon points="${cx},${cy - 250} ${cx + 30},${cy - 180} ${cx + 100},${cy - 180} ${cx + 45},${cy - 140} ${cx + 65},${cy - 70} ${cx},${cy - 105} ${cx - 65},${cy - 70} ${cx - 45},${cy - 140} ${cx - 100},${cy - 180} ${cx - 30},${cy - 180}"
             fill="${c.cyan}" />
    </g>`;

  const milestoneText = `
    <text x="${cx}" y="${cy - 100}" text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif" font-size="16"
          font-weight="600" letter-spacing="8" fill="${c.cyan}" opacity="0.8">
      JOURNEY COMPLETE
    </text>
    <text x="${cx}" y="${cy + 40}" text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif" font-size="100"
          font-weight="900" fill="white">
      ${input.dayNumber}
    </text>
    <text x="${cx}" y="${cy + 80}" text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif" font-size="28"
          font-weight="400" fill="${c.cyan}">
      / ${brand.totalDays} DAYS
    </text>`;

  const content = [
    starBurst,
    milestoneText,
    renderTopic(input.headline || input.topic, cy + 140),
    renderKeywords(input.keywords, cy + 200),
  ].join("");

  return renderScaffold() + content + closeScaffold();
}
