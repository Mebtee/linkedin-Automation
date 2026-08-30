import type { VisualBrief, VisualComposition, VisualKeyPoint } from "@/types/image";
import { brand } from "@/config/brand";
import { renderScaffold } from "../../svg/render";
import {
  drawNode,
  drawArrow,
  drawCard,
  drawPill,
  drawDayBadge,
  drawHeadline,
  drawSubheadline,
  drawPrimaryTag,
} from "./draw";
import { clampKeyPoints } from "../themes";

// ─── Wide-format canvas (`brand.image` = 1200×630, LinkedIn feed ratio) ─────
// Every coordinate is derived from the canvas dims so the layout stays portable
// if the brand canvas changes. The scaffold draws the series title at y≈80; the
// header block (primary tag → headline → subheadline → accent rule) spans
// ~98–228; the content band sits ~290–530; the footer badge at the bottom.
// Everything critical stays inside a safe margin so nothing is clipped in feed
// previews.

const Cx = brand.image.width / 2;
const FOOTER_Y = 560;

const TOP = 160;

/** Pills row — limited to a single compact row that fits the wide canvas. */
function fitPills(technologies: readonly string[], y: number): string {
  const pills = technologies.slice(0, 4);
  if (!pills.length) return "";
  const total = pills.length * 160 + (pills.length - 1) * 16;
  let x = Cx - total / 2 + 80;
  return pills.map((t) => {
    const out = drawPill(x, y, t);
    x += 176;
    return out;
  }).join("");
}

function header(brief: VisualBrief): string {
  const subY = TOP + 44;
  return [
    drawPrimaryTag(Cx, TOP - 40, brief.primaryConcept || ""),
    drawHeadline(Cx, TOP, brief.headline || brief.concept),
    drawSubheadline(Cx, subY, brief.subheadline),
    // Fine brand accent rule under the header block ties the image to the
    // series accent without competing with the content.
    `<line x1="${Cx - 120}" y1="${subY + 22}" x2="${Cx + 120}" y2="${subY + 22}" stroke="${brand.colors.blue}" stroke-width="3" stroke-linecap="round" opacity="0.55" />`,
  ].join("");
}

function footerBadge(brief: VisualBrief): string {
  return drawDayBadge(Cx, FOOTER_Y, brief.dayNumber, brief.module);
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

/** Horizontal chain of nodes connected by left→right arrows. */
function chainRow(nodes: readonly string[], y: number, boxH: number, gap: number): string {
  const shown = nodes.slice(0, 4);
  const n = shown.length;
  if (!n) return "";
  const boxW = Math.min(230, (W - 260) / n);
  const totalW = n * boxW + (n - 1) * gap;
  const startX = Cx - totalW / 2;
  let svg = "";
  shown.forEach((label, i) => {
    const lines = nodeLines(label);
    const x = startX + i * (boxW + gap);
    svg += drawNode(x, y, boxW, boxH, lines[0] || "", {
      accent: i === n - 1,
      sub: lines[1],
    });
    if (i < n - 1) {
      svg += drawArrow(x + boxW + 2, y + boxH / 2, x + boxW + gap - 2, y + boxH / 2);
    }
  });
  return svg;
}

/** Horizontal row of cards (used for descriptive key points). */
function cardRow(points: readonly VisualKeyPoint[], y: number, w: number, h: number, gap: number): string {
  const shown = points.slice(0, 4);
  const n = shown.length;
  if (!n) return "";
  const totalW = n * w + (n - 1) * gap;
  const startX = Cx - totalW / 2;
  return shown.map((p, i) => drawCard(startX + i * (w + gap), y, w, h, p.label || " ", p.detail, i)).join("");
}

const W = brand.image.width;

// ─── Composition: CONCEPT_FLOW ──────────────────────────────────────────────
// Headline + horizontal chain of concept nodes connected by arrows, then pills.

function renderConceptFlow(brief: VisualBrief): string {
  const chain = brief.visualMetaphor.split(" → ").map((s) => s.trim()).filter(Boolean);
  const nodes = chain.length >= 2 ? chain : brief.keyPoints.map((p) => p.label);

  return [
    header(brief),
    chainRow(nodes, 310, 120, 44),
    fitPills(brief.technologies, 475),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: PROBLEM_SOLUTION ──────────────────────────────────────────
// Three aligned columns — PROBLEM → SOLUTION → RESULT — each with a descriptive
// supporting card beneath, laid out to use the wide canvas.

function renderProblemSolution(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 3);
  const boxW = 300;
  const boxH = 110;
  const y = 300;
  const leftX = 90;
  const rightX = W - 90 - boxW;
  const midX = Cx - boxW / 2;
  const gap = midX - (leftX + boxW);

  const columns: Array<[number, string, string]> = [
    [leftX, "PROBLEM", points[0]?.label || brief.concept],
    [midX, "SOLUTION", points[1]?.label || ""],
    [rightX, "RESULT", points[2]?.label || ""],
  ];

  const boxes = columns.map(([x, cap, sub]) => drawNode(x, y, boxW, boxH, cap, { accent: cap === "SOLUTION", sub })).join("");
  const arrows =
    drawArrow(leftX + boxW + 6, y + boxH / 2, leftX + boxW + gap - 6, y + boxH / 2) +
    drawArrow(midX + boxW + 6, y + boxH / 2, midX + boxW + gap - 6, y + boxH / 2);

  const cards = cardRow(points, 440, boxW, 90, gap);

  return [
    header(brief),
    boxes,
    arrows,
    cards,
    footerBadge(brief),
  ].join("");
}

// ─── Composition: THREE_IDEAS ───────────────────────────────────────────────
// Headline + three descriptive idea cards across the width + pills.

function renderThreeIdeas(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 3);
  const w = 360;
  const gap = 18;
  const y = 290;
  const h = 180;

  const cards = points.map((p, i) =>
    drawCard(Cx - (3 * w + 2 * gap) / 2 + i * (w + gap), y, w, h, p.label || " ", p.detail, i),
  ).join("");

  return [
    header(brief),
    cards,
    fitPills(brief.technologies, 505),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: ARCHITECTURE_FLOW ─────────────────────────────────────────
// Layered system tiers shown as a horizontal pipeline plus a supporting row.

function renderArchitectureFlow(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 4);
  const nodes = points.length ? points.map((p) => p.label) : [brief.concept || "System", "", "", ""];

  return [
    header(brief),
    chainRow(nodes, 310, 120, 44),
    fitPills(brief.technologies, 475),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: BEFORE_AFTER ───────────────────────────────────────────────
// Side-by-side before / after contrast with a connecting arrow.

function renderBeforeAfter(brief: VisualBrief): string {
  const contrastParts = brief.visualMetaphor.split(" → ").map((s) => s.trim()).filter(Boolean);
  const contrast: [string, string] = contrastParts.length >= 2
    ? [contrastParts[0]!, contrastParts[contrastParts.length - 1]!]
    : ["BEFORE", "AFTER"];
  const points = clampKeyPoints(brief.keyPoints, 2);
  const boxW = 380;
  const boxH = 200;
  const y = 300;
  const leftX = 120;
  const rightX = W - 120 - boxW;

  const leftDetail = points[0]?.detail || "";
  const rightDetail = points[1]?.detail || brief.visualMetaphor;

  return [
    header(brief),
    drawNode(leftX, y, boxW, boxH, contrast[0], { sub: leftDetail }),
    drawArrow(leftX + boxW + 14, y + boxH / 2, rightX - 14, y + boxH / 2),
    drawNode(rightX, y, boxW, boxH, contrast[1], { accent: true, sub: rightDetail }),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: SKILL_PROGRESSION ─────────────────────────────────────────
// Horizontal progression steps across the wide canvas, with a supporting card
// row beneath them.

function renderSkillProgression(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 4);
  const nodes = points.length ? points.map((p) => p.label) : [brief.concept || "Learn", "", "", ""];

  return [
    header(brief),
    chainRow(nodes, 300, 110, 44),
    cardRow(points, 445, 220, 78, 20),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: COMPARISON ─────────────────────────────────────────────────
// Two-column comparison of two concepts/approaches.

function renderComparison(brief: VisualBrief): string {
  const parts = brief.visualMetaphor.split(" → ").map((s) => s.trim()).filter(Boolean);
  const left = parts[0] || "A";
  const right = (parts.length > 1 ? parts[1] : undefined) || "B";
  const points = clampKeyPoints(brief.keyPoints, 2);
  const boxW = 460;
  const boxH = 190;
  const y = 300;
  const leftX = 90;
  const rightX = W - 90 - boxW;
  const midY = y + boxH / 2;

  return [
    header(brief),
    drawNode(leftX, y, boxW, boxH, left, { sub: points[0]?.detail || "" }),
    drawArrow(leftX + boxW + 10, midY, rightX - 10, midY),
    drawNode(rightX, y, boxW, boxH, right, { accent: true, sub: points[1]?.detail || brief.concept }),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: INPUT_PROCESS_OUTPUT ──────────────────────────────────────
// Three horizontal stages: INPUT → PROCESS → OUTPUT with supporting cards.

function renderInputProcessOutput(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 3);
  const captions = ["INPUT", "PROCESS", "OUTPUT"];
  const boxW = 280;
  const boxH = 110;
  const gap = 66;
  const totalW = 3 * boxW + 2 * gap;
  const startX = Cx - totalW / 2;
  const y = 300;
  const stageAccents = [false, true, false];

  let svg = header(brief);
  captions.forEach((caption, i) => {
    const x = startX + i * (boxW + gap);
    svg += `<text x="${x + boxW / 2}" y="${y - 26}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" letter-spacing="2" fill="${brand.colors.cyan}">${caption}</text>`;
    svg += drawNode(x, y, boxW, boxH, points[i]?.label || caption, { accent: stageAccents[i], sub: points[i]?.detail });
    if (i < 2) {
      svg += drawArrow(x + boxW + 6, y + boxH / 2, x + boxW + gap - 6, y + boxH / 2);
    }
  });

  svg += cardRow(points, 445, boxW, 66, gap);
  svg += footerBadge(brief);
  return svg;
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

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
 * Canvas is the wide-format `brand.image` (1200×630); purely programmatic,
 * deterministic, and limited to the brand palette.
 */
export function renderVisualBrief(brief: VisualBrief): string {
  const renderer = RENDERERS[brief.composition] ?? renderConceptFlow;
  const content = renderer(brief);
  // Compositions carry their own bottom day/module badge, so the shared
  // scaffold footer mark is omitted here to avoid a redundant mark stacking.
  return renderScaffold() + content + "</svg>";
}
