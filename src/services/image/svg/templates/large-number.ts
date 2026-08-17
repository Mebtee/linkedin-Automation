import type { ImageGenerationInput } from "@/types/image";
import {
  renderScaffold,
  closeScaffold,
  renderDayNumber,
  renderTopic,
  renderKeywords,
} from "../render";

// ─── Template: LARGE_NUMBER ─────────────────────────────────────────────────
// Very large day number as focal point. Topic and keywords below.
// Strong series branding.

export function renderLargeNumber(input: ImageGenerationInput): string {
  const content = [
    renderDayNumber(input.dayNumber),
    renderTopic(input.headline || input.topic),
    renderKeywords(input.keywords),
  ].join("");

  return renderScaffold() + content + closeScaffold();
}
