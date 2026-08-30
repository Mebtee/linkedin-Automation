import type { ImageGenerationInput } from "@/types/image";
import { brand } from "@/config/brand";
import { renderScaffold, closeScaffold } from "../render";
import type { LogoEmbed } from "../../logo";
import { LIGHT_CX } from "../../theme/geometry";
import { drawHeadline, drawPrimaryTag, drawSubheadline } from "../../theme/primitives";

// ─── Template: PROGRESS ──────────────────────────────────────────────────────
// Editorial progress: headline + supporting line + a clean progress bar showing
// journey completion. Percent is derived deterministically from the day number.

export function renderProgress(input: ImageGenerationInput, logo: LogoEmbed | null): string {
  const cx = LIGHT_CX;
  const progressPercent = (input.dayNumber / brand.totalDays) * 100;
  const bar = { x: cx - 320, y: 470, w: 640, h: 14 };
  const fillW = bar.w * (progressPercent / 100);

  const content = [
    drawPrimaryTag(cx, 168, `DAY ${input.dayNumber} / ${brand.totalDays}`),
    drawHeadline(cx, 256, input.headline || input.topic),
    drawSubheadline(cx, 318, input.subheadline),
    `<rect x="${bar.x}" y="${bar.y}" width="${bar.w}" height="${bar.h}" rx="7" fill="#E7ECF4" />`,
    `<rect x="${bar.x}" y="${bar.y}" width="${Number(fillW.toFixed(1))}" height="${bar.h}" rx="7" fill="${brand.colors.blue}" opacity="0.9" />`,
    `<text x="${bar.x + bar.w + 14}" y="${bar.y + (bar.h / 2) + 5}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" fill="${brand.colors.blue}">${Math.round(progressPercent)}%</text>`,
    `<text x="${bar.x}" y="${bar.y - 14}" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="600" letter-spacing="2" fill="${brand.colors.muted}">JOURNEY PROGRESS</text>`,
  ].join("");

  return renderScaffold(`progress:${input.topic}:${input.dayNumber}`) + content + closeScaffold(logo);
}