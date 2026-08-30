import type { ImageGenerationInput } from "@/types/image";
import { renderScaffold, closeScaffold } from "../render";
import type { LogoEmbed } from "../../logo";
import { LIGHT_CX } from "../../theme/geometry";
import { drawHeadline, drawPill, drawPrimaryTag, drawSubheadline } from "../../theme/primitives";

// ─── Template: PROJECT_FOCUSED ───────────────────────────────────────────────
// Project-forward editorial layout: a light "project" panel frames the keyword
// chips beneath the headline. No decorative overdraw.

export function renderProjectFocused(input: ImageGenerationInput, logo: LogoEmbed | null): string {
  const cx = LIGHT_CX;
  const panel = { x: cx - 300, y: 415, w: 600, h: 160 };

  const keywords = input.keywords.slice(0, 4);
  const widths = keywords.map((k) => Math.min(k.length * 10 + 44, 220));
  const totalW = widths.reduce((a, b) => a + b, 0) + 16 * (keywords.length - 1);
  let startX = cx - totalW / 2;
  const chips = keywords.length
    ? `<g>${keywords.map((k, i) => {
        const x = startX + widths[i]! / 2;
        startX += widths[i]! + 16;
        return drawPill(x, panel.y + 92, k);
      }).join("")}</g>`
    : "";

  const content = [
    drawPrimaryTag(cx, 168, `PROJECT · DAY ${input.dayNumber}`),
    drawHeadline(cx, 262, input.headline || input.topic),
    drawSubheadline(cx, 320, input.subheadline),
    `<rect x="${panel.x}" y="${panel.y}" width="${panel.w}" height="${panel.h}" rx="16" fill="#F6F8FB" stroke="#DCE4F1" stroke-width="1" />`,
    `<text x="${cx}" y="${panel.y + 42}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" letter-spacing="3" fill="#5B677A">BUILD IN PROGRESS</text>`,
    chips,
  ].join("");

  return renderScaffold(`project:${input.topic}:${input.dayNumber}`) + content + closeScaffold(logo);
}