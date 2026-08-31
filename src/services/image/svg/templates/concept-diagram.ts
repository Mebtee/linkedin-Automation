import type { ImageGenerationInput } from "@/types/image";
import { renderScaffold, closeScaffold } from "../render";
import type { LogoEmbed } from "../../logo";
import { LIGHT_CX } from "../../theme/geometry";
import { takeawaysFromInput } from "../../theme/takeaways";
import {
  drawArrow,
  drawHeadline,
  drawNode,
  drawPrimaryTag,
  drawSubheadline,
} from "../../theme/primitives";

// ─── Template: CONCEPT_DIAGRAM ───────────────────────────────────────────────
// A simple technical relationship: three connected nodes. Labels come from the
// post keywords when present; otherwise the diagram is intentionally generic
// (CONCEPT / CONNECTION / RESULT) and never invents technical claims.

export function renderConceptDiagram(input: ImageGenerationInput, logo: LogoEmbed | null): string {
  const cx = LIGHT_CX;
  const labels = input.keywords.slice(0, 3);
  const nodes = labels.length === 3 ? labels : ["CONCEPT", "CONNECTION", "RESULT"];
  const panel = { w: 210, h: 116, y: 430 };
  const gap = 62;
  const totalW = 3 * panel.w + 2 * gap;
  const startX = cx - totalW / 2;

  const cols = nodes.map((label, i) => {
    const x = startX + i * (panel.w + gap);
    const node = drawNode(x, panel.y, panel.w, panel.h, label, { accent: i === 1 });
    const arrow = i < 2 ? drawArrow(x + panel.w + 6, panel.y + panel.h / 2, x + panel.w + gap - 6, panel.y + panel.h / 2) : "";
    return node + arrow;
  }).join("");

  const content = [
    drawPrimaryTag(cx, 168, `DAY ${input.dayNumber} / 105`),
    drawHeadline(cx, 262, input.headline || input.topic),
    drawSubheadline(cx, 320, input.subheadline),
    cols,
  ].join("");

  return renderScaffold(`diagram:${input.topic}:${input.dayNumber}`) + content + closeScaffold(logo, takeawaysFromInput(input));
}