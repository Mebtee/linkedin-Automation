import type { VisualBrief, VisualComposition, VisualKeyPoint } from "@/types/image";
import { brand } from "@/config/brand";
import { renderScaffold, closeScaffold } from "../../svg/render";
import { escapeXml } from "../../svg/escape";
import type { LogoEmbed } from "../../logo";
import { LIGHT_LEFT, LIGHT_RIGHT, LIGHT_CX } from "../../theme/geometry";
import {
  drawDayFeather,
  drawSignalTag,
} from "../../theme/primitives";
import {
  drawNode,
  drawArrow,
  drawCard,
  drawPill,
  drawHeadlineLeft,
  drawSubheadlineLeft,
  drawPrimaryTagLeft,
} from "./draw";
import { clampKeyPoints } from "../themes";
import { SVG_FONT_FAMILY } from "../../fonts";

// ─── Landscape canvas (`brand.image` = 1600×900, LinkedIn 16:9 feed ratio) ───
// A professional personal-brand editorial layout (Phase 5I). The branded
// background splits the canvas diagonally into a white content zone (left) and a
// navy branding zone (right). All content lives in the light zone:
//
//   x ∈ [LIGHT_LEFT, LIGHT_RIGHT] = [100, 940]   (≥80px horizontal safe margin)
//   TOP      → concept tag + headline + subheadline (reads first), left-aligned
//   MIDDLE   → the main technical visual (concept / nodes / cards / flow)
//   BOTTOM   → day badge / footer mark (light zone)
//   NAVY     → TB logo (lower-right) + optional skill signal (top-right)
//
// Text density is deliberately low: the image is a visual SUMMARY of the post —
// one main concept, a small number of supporting points, tags. The detailed
// explanation lives in the LinkedIn caption. Every coordinate derives from the
// theme geometry constants; nothing hard-codes a raw pixel.

const H = brand.image.height;

const HEAD_X = LIGHT_LEFT;
const TAG_Y = 124;
const HEAD_Y = 232;
const SUB_Y = 300;
const ACCENT_Y = 336;
const VISUAL_Y = 376;
const FOOTER_Y = H - 64;
const PILLS_Y = 660;

const VISUAL_MAX_X = LIGHT_RIGHT - 80;

/** Technology pills band, centered in the light zone. */
function fitPills(technologies: readonly string[], y: number): string {
  const pills = technologies.slice(0, 4);
  if (!pills.length) return "";
  const widths = pills.map((t) => Math.min(t.length * 11 + 44, 220));
  const total = widths.reduce((a, b) => a + b, 0) + (pills.length - 1) * 16;
  let x = LIGHT_CX - total / 2;
  return pills.map((t, i) => {
    const out = drawPill(x + widths[i]! / 2, y, t);
    x += widths[i]! + 16;
    return out;
  }).join("");
}

/** Left-aligned header block: concept tag → headline → subheadline → accent rule. */
function header(brief: VisualBrief): string {
  return [
    drawPrimaryTagLeft(HEAD_X, TAG_Y, brief.primaryConcept || ""),
    drawHeadlineLeft(HEAD_X, HEAD_Y, brief.headline || brief.concept),
    drawSubheadlineLeft(HEAD_X, SUB_Y, brief.subheadline),
    `<line x1="${HEAD_X}" y1="${ACCENT_Y}" x2="${HEAD_X + 240}" y2="${ACCENT_Y}" stroke="${brand.colors.blue}" stroke-width="3" stroke-linecap="round" opacity="0.55" />`,
  ].join("");
}

/** Small recruiter-relevant skill signal in the top-right navy area (spec §8). */
function signalTag(brief: VisualBrief): string {
  return drawSignalTag(brief.recruiterSignal || undefined);
}

/** Day feather at the top-right of the light zone. */
function dayFeather(brief: VisualBrief): string {
  return drawDayFeather(LIGHT_RIGHT - 20, TAG_Y, brief.dayNumber);
}

function footerBadge(brief: VisualBrief): string {
  return drawDayBadgeCd(LIGHT_CX, FOOTER_Y, brief.dayNumber, brief.module);
}

function drawDayBadgeCd(x: number, y: number, dayNumber?: number, module?: string): string {
  const parts: string[] = [];
  if (dayNumber) parts.push(`DAY ${dayNumber} / 105`);
  if (module) parts.push(module.toUpperCase());
  const label = parts.join("  ·  ");
  if (!label) return "";
  return `
    <rect x="${x - 140}" y="${y - 20}" width="280" height="40" rx="20"
          fill="none" stroke="${brand.colors.blue}" stroke-width="1" opacity="0.4" />
    <text x="${x}" y="${y + 6}" text-anchor="middle" font-family="${SVG_FONT_FAMILY}" font-size="15" font-weight="600" letter-spacing="2" fill="${brand.colors.muted}">${escapeXml(label)}</text>`;
}

/** Horizontal chain of nodes connected by left→right arrows, centered in zone. */
function chainRowCentered(
  nodes: readonly string[],
  y: number,
  boxH: number,
  gap: number,
  boxW?: number,
): string {
  const shown = nodes.slice(0, 4);
  const n = shown.length;
  if (!n) return "";
  const bw = boxW ?? Math.min(200, (VISUAL_MAX_X - LIGHT_LEFT) / n);
  const totalW = n * bw + (n - 1) * gap;
  const startX = LIGHT_CX - totalW / 2;
  // Ensure the row starts within the light zone.
  const safeStart = Math.max(LIGHT_LEFT, startX);
  let svg = "";
  shown.forEach((label, i) => {
    const x = safeStart + i * (bw + gap);
    const lines = nodeLines(label);
    svg += drawNode(x, y, bw, boxH, lines[0] || "", {
      accent: i === n - 1,
      sub: lines[1],
    });
    if (i < n - 1) {
      svg += drawArrow(x + bw + 2, y + boxH / 2, x + bw + gap - 2, y + boxH / 2);
    }
  });
  return svg;
}

/** Horizontal row of cards centered in the light zone. */
function cardRowCentered(
  points: readonly VisualKeyPoint[],
  y: number,
  w: number,
  h: number,
  gap: number,
): string {
  const shown = points.slice(0, 4);
  const n = shown.length;
  if (!n) return "";
  const totalW = n * w + (n - 1) * gap;
  const startX = Math.max(LIGHT_LEFT, LIGHT_CX - totalW / 2);
  return shown.map((p, i) => drawCard(startX + i * (w + gap), y, w, h, p.label || " ", p.detail, i)).join("");
}

/** Word-wrap a long label into lines for a node. */
function nodeLines(label: string): string[] {
  if (label.length <= 12) return [label];
  const words = label.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > 12) {
      if (current) lines.push(current.trim());
      current = w;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

// ─── Composition: CONCEPT_FLOW ──────────────────────────────────────────────
function renderConceptFlow(brief: VisualBrief): string {
  const chain = brief.visualMetaphor.split(" → ").map((s) => s.trim()).filter(Boolean);
  const nodes = chain.length >= 2 ? chain : brief.keyPoints.map((p) => p.label);
  return [
    header(brief),
    signalTag(brief),
    dayFeather(brief),
    chainRowCentered(nodes, VISUAL_Y, 108, 32),
    fitPills(brief.technologies, PILLS_Y),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: PROBLEM_SOLUTION ──────────────────────────────────────────
function renderProblemSolution(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 3);
  const boxW = 200;
  const boxH = 96;
  const y = VISUAL_Y;
  const gap = 26;
  const totalW = 3 * boxW + 2 * gap;
  const startX = LIGHT_CX - totalW / 2;

  const captions = ["PROBLEM", "SOLUTION", "RESULT"];
  const boxes = captions.map((cap, i) =>
    drawNode(startX + i * (boxW + gap), y, boxW, boxH, cap, {
      accent: cap === "SOLUTION",
      sub: points[i]?.label || "",
    }),
  ).join("");
  const arrows =
    drawArrow(startX + boxW + 2, y + boxH / 2, startX + boxW + gap - 2, y + boxH / 2) +
    drawArrow(startX + (boxW + gap) * 2 + 2, y + boxH / 2, startX + (boxW + gap) * 2 + gap - 2, y + boxH / 2);

  const cards = cardRowCentered(points, y + boxH + 34, 180, 56, 24);

  return [
    header(brief),
    signalTag(brief),
    dayFeather(brief),
    boxes,
    arrows,
    cards,
    footerBadge(brief),
  ].join("");
}

// ─── Composition: THREE_IDEAS ───────────────────────────────────────────────
function renderThreeIdeas(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 3);
  const w = 240;
  const gap = 18;
  const y = VISUAL_Y;
  const h = 150;

  const totalW = 3 * w + 2 * gap;
  const startX = LIGHT_CX - totalW / 2;
  const cards = points.map((p, i) =>
    drawCard(startX + i * (w + gap), y, w, h, p.label || " ", p.detail, i),
  ).join("");

  return [
    header(brief),
    signalTag(brief),
    dayFeather(brief),
    cards,
    fitPills(brief.technologies, PILLS_Y),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: ARCHITECTURE_FLOW ─────────────────────────────────────────
function renderArchitectureFlow(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 4);
  const nodes = points.length ? points.map((p) => p.label) : [brief.concept || "System", "", "", ""];
  return [
    header(brief),
    signalTag(brief),
    dayFeather(brief),
    chainRowCentered(nodes, VISUAL_Y, 108, 32),
    fitPills(brief.technologies, PILLS_Y),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: BEFORE_AFTER ──────────────────────────────────────────────
function renderBeforeAfter(brief: VisualBrief): string {
  const contrastParts = brief.visualMetaphor.split(" → ").map((s) => s.trim()).filter(Boolean);
  const contrast: [string, string] = contrastParts.length >= 2
    ? [contrastParts[0]!, contrastParts[contrastParts.length - 1]!]
    : ["BEFORE", "AFTER"];
  const points = clampKeyPoints(brief.keyPoints, 2);
  const boxW = 280;
  const boxH = 140;
  const y = VISUAL_Y;
  const gap = 40;
  const totalW = 2 * boxW + gap;
  const startX = LIGHT_CX - totalW / 2;

  const leftDetail = points[0]?.detail || "";
  const rightDetail = points[1]?.detail || brief.visualMetaphor;

  return [
    header(brief),
    signalTag(brief),
    dayFeather(brief),
    drawNode(startX, y, boxW, boxH, contrast[0], { sub: leftDetail }),
    drawArrow(startX + boxW + 6, y + boxH / 2, startX + boxW + gap - 6, y + boxH / 2),
    drawNode(startX + boxW + gap, y, boxW, boxH, contrast[1], { accent: true, sub: rightDetail }),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: SKILL_PROGRESSION ─────────────────────────────────────────
function renderSkillProgression(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 4);
  const nodes = points.length ? points.map((p) => p.label) : [brief.concept || "Learn", "", "", ""];
  return [
    header(brief),
    signalTag(brief),
    dayFeather(brief),
    chainRowCentered(nodes, VISUAL_Y, 96, 30),
    cardRowCentered(points, VISUAL_Y + 122, 210, 60, 20),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: COMPARISON ────────────────────────────────────────────────
function renderComparison(brief: VisualBrief): string {
  const parts = brief.visualMetaphor.split(" → ").map((s) => s.trim()).filter(Boolean);
  const left = parts[0] || "A";
  const right = (parts.length > 1 ? parts[1] : undefined) || "B";
  const points = clampKeyPoints(brief.keyPoints, 2);
  const boxW = 300;
  const boxH = 140;
  const y = VISUAL_Y;
  const gap = 36;
  const totalW = 2 * boxW + gap;
  const startX = LIGHT_CX - totalW / 2;
  const midY = y + boxH / 2;

  return [
    header(brief),
    signalTag(brief),
    dayFeather(brief),
    drawNode(startX, y, boxW, boxH, left, { sub: points[0]?.detail || "" }),
    drawArrow(startX + boxW + 8, midY, startX + boxW + gap - 8, midY),
    drawNode(startX + boxW + gap, y, boxW, boxH, right, { accent: true, sub: points[1]?.detail || brief.concept }),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: INPUT_PROCESS_OUTPUT ──────────────────────────────────────
function renderInputProcessOutput(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 3);
  const captions = ["INPUT", "PROCESS", "OUTPUT"];
  const boxW = 180;
  const boxH = 96;
  const gap = 30;
  const totalW = 3 * boxW + 2 * gap;
  const startX = LIGHT_CX - totalW / 2;
  const y = VISUAL_Y;
  const stageAccents = [false, true, false];

  let svg = header(brief);
  svg += signalTag(brief);
  svg += dayFeather(brief);
  captions.forEach((caption, i) => {
    const x = startX + i * (boxW + gap);
    svg += `<text x="${x + boxW / 2}" y="${y - 24}" text-anchor="middle" font-family="${SVG_FONT_FAMILY}" font-size="15" font-weight="700" letter-spacing="2" fill="${brand.colors.muted}">${escapeXml(caption)}</text>`;
    svg += drawNode(x, y, boxW, boxH, points[i]?.label || caption, { accent: stageAccents[i], sub: points[i]?.detail });
    if (i < 2) {
      svg += drawArrow(x + boxW + 4, y + boxH / 2, x + boxW + gap - 4, y + boxH / 2);
    }
  });

  svg += footerBadge(brief);
  return svg;
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

const RENDERERS: Record<VisualComposition, (b: VisualBrief) => string> = {
  "concept-flow": renderConceptFlow,
  "problem-solution": renderProblemSolution,
  "three-ideas": renderThreeIdeas,
  "architecture-flow": renderArchitectureFlow,
  "before-after": renderBeforeAfter,
  "skill-progression": renderSkillProgression,
  "comparison": renderComparison,
  "input-process-output": renderInputProcessOutput,
};

/**
 * Renders a full branded SVG for a VisualBrief using its chosen composition.
 * Canvas is the landscape `brand.image` (1600×900); purely programmatic,
 * deterministic, and limited to the brand palette.
 */
export function renderVisualBrief(brief: VisualBrief, logo: LogoEmbed | null = null): string {
  const renderer = RENDERERS[brief.composition] ?? renderConceptFlow;
  const content = renderer(brief);
  // The shared scaffold opens the branded background and closes with the
  // branding layer (navy KEY TAKEAWAYS panel + TB logo + footer mark).
  return renderScaffold(`brief:${brief.composition}:${brief.concept}`) + content + closeScaffold(logo, brief.keyTakeaways);
}