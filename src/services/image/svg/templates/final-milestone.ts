import type { ImageGenerationInput } from "@/types/image";
import { brand } from "@/config/brand";
import { renderScaffold, closeScaffold } from "../render";
import type { LogoEmbed } from "../../logo";
import { LIGHT_CX } from "../../theme/geometry";
import { takeawaysFromInput } from "../../theme/takeaways";
import { drawHeadline, drawPrimaryTag, drawSubheadline } from "../../theme/primitives";

// ─── Template: FINAL_MILESTONE ───────────────────────────────────────────────
// Capstone editorial layout: a centred completion message with a confirmation
// check inside the navy identity block, plus a milestone progress bar.
// One clear call-to-action, nothing more.

export function renderFinalMilestone(input: ImageGenerationInput, logo: LogoEmbed | null): string {
  const cx = LIGHT_CX;
  const check = {
    x: cx - 58,
    y: 428,
    r: 58,
  };
  const bar = { x: cx - 320, y: 600, w: 640, h: 14 };
  const fillW = bar.w;

  const content = [
    drawPrimaryTag(cx, 168, `${brand.series}`),
    drawHeadline(cx, 262, input.headline || input.topic),
    drawSubheadline(cx, 318, input.subheadline),
    `<circle cx="${check.x}" cy="${check.y}" r="${check.r}" fill="${brand.colors.blue}" opacity="0.92" />`,
    `<path d="M ${check.x - 26} ${check.y} l 17 17 l 34 -34" fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />`,
    `<rect x="${bar.x}" y="${bar.y}" width="${bar.w}" height="${bar.h}" rx="7" fill="#E7ECF4" />`,
    `<rect x="${bar.x}" y="${bar.y}" width="${Number(fillW.toFixed(1))}" height="${bar.h}" rx="7" fill="${brand.colors.cyan}" opacity="0.9" />`,
    `<text x="${bar.x}" y="${bar.y - 14}" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="600" letter-spacing="2" fill="${brand.colors.muted}">JOURNEY COMPLETE</text>`,
  ].join("");

  return renderScaffold(`milestone:${input.topic}:${input.dayNumber}`) + content + closeScaffold(logo, takeawaysFromInput(input));
}