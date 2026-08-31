import type { ImageGenerationInput } from "@/types/image";
import { brand } from "@/config/brand";
import { renderScaffold, closeScaffold } from "../render";
import type { LogoEmbed } from "../../logo";
import { LIGHT_CX } from "../../theme/geometry";
import { takeawaysFromInput } from "../../theme/takeaways";
import { drawHeadline, drawPrimaryTag, drawSubheadline, drawPill } from "../../theme/primitives";
import { SVG_FONT_FAMILY } from "../../fonts";

// ─── Template: LARGE_NUMBER ─────────────────────────────────────────────────
// Editorial milestone image: day tag, big headline, supporting line, keyword
// chips, faint ghost day number. Rendered on the new branded background.

export function renderLargeNumber(input: ImageGenerationInput, logo: LogoEmbed | null): string {
  const cx = LIGHT_CX;
  const dayLabel = `DAY ${input.dayNumber} / ${brand.totalDays}`;

  const ghost = `
    <text x="${cx}" y="300" text-anchor="middle" font-family="${SVG_FONT_FAMILY}"
          font-size="230" font-weight="900" fill="${brand.colors.navy}" opacity="0.06">
      ${input.dayNumber}
    </text>`;

  const keywords = input.keywords.slice(0, 4);
  const widths = keywords.map((k) => Math.min(k.length * 10 + 44, 240));
  const totalW = widths.reduce((a, b) => a + b, 0) + 16 * (keywords.length - 1);
  let startX = cx - totalW / 2;
  const chips = keywords.length
    ? `<g>${keywords.map((k, i) => {
        const x = startX + widths[i]! / 2;
        startX += widths[i]! + 16;
        return drawPill(x, 560, k);
      }).join("")}</g>`
    : "";

  const content = [
    drawPrimaryTag(cx, 168, dayLabel),
    ghost,
    drawHeadline(cx, 262, input.headline || input.topic),
    drawSubheadline(cx, 320, input.subheadline),
    chips,
  ].join("");

  return renderScaffold(`template:${input.topic}:${input.dayNumber}`) + content + closeScaffold(logo, takeawaysFromInput(input));
}