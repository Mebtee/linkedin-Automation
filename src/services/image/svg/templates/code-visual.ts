import type { ImageGenerationInput } from "@/types/image";
import { renderScaffold, closeScaffold } from "../render";
import type { LogoEmbed } from "../../logo";
import { LIGHT_CX } from "../../theme/geometry";
import { drawHeadline, drawPrimaryTag, drawSubheadline } from "../../theme/primitives";

// ─── Template: CODE_VISUAL ───────────────────────────────────────────────────
// A clean pseudo-code panel (bars only — no invented code) under the headline.
// Professional and abstract: grey "lines" with a blue/cyan accent bar.

export function renderCodeVisual(input: ImageGenerationInput, logo: LogoEmbed | null): string {
  const cx = LIGHT_CX;
  const panel = { x: cx - 330, y: 420, w: 660, h: 150 };
  const bars = [
    { w: 380, accent: false },
    { w: 300, accent: true },
    { w: 340, accent: false },
    { w: 240, accent: false },
    { w: 300, accent: true },
  ];
  const barSvg = bars.map((b, i) => {
    const bw = b.w * 0.6;
    const bx = panel.x + 40;
    const by = panel.y + 28 + i * 24;
    const fill = b.accent ? "#1769FF" : "#D3DCEC";
    return `<rect x="${bx}" y="${by}" width="${bw}" height="10" rx="3" fill="${fill}" opacity="${b.accent ? 0.9 : 0.8}" />`;
  }).join("");

  const content = [
    drawPrimaryTag(cx, 168, `DAY ${input.dayNumber} / 105`),
    drawHeadline(cx, 262, input.headline || input.topic),
    drawSubheadline(cx, 320, input.subheadline),
    `<rect x="${panel.x}" y="${panel.y}" width="${panel.w}" height="${panel.h}" rx="16" fill="#F6F8FB" stroke="#DCE4F1" stroke-width="1" />`,
    barSvg,
  ].join("");

  return renderScaffold(`code:${input.topic}:${input.dayNumber}`) + content + closeScaffold(logo);
}