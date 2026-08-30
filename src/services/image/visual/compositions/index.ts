import type { VisualBrief, VisualComposition, VisualKeyPoint } from "@/types/image";
import { brand } from "@/config/brand";
import { renderScaffold } from "../../svg/render";
import { escapeXml } from "../../svg/escape";
import {
  drawNode,
  drawArrow,
  drawCard,
  drawPill,
  drawDayBadge,
  drawHeadlineLeft,
  drawSubheadlineLeft,
  drawPrimaryTagLeft,
} from "./draw";
import { clampKeyPoints } from "../themes";

// ─── Landscape canvas (`brand.image` = 1200×675, LinkedIn 16:9 feed ratio) ───
// A compact, professional landscape layout. Horizontal hierarchy:
//   LEFT   → concept tag + headline + subheadline (reads first)
//   CENTER → the main technical visual (concept chain / nodes / cards/flow)
//   RIGHT  → supporting concepts/technologies + a small recruiter-relevant
//            signal when genuinely supported
// A thin secondary band (technologies / supporting key points) sits beneath the
// main visual; the day/module badge anchors the bottom. Every coordinate derives
// from the canvas dims. Safe area: ≥60px horizontal, ≥40px vertical.
//
// Text density is deliberately low: the image is a visual SUMMARY of the post —
// one main concept, a small number of supporting points, tags. The detailed
// explanation lives in the LinkedIn caption.

const W = brand.image.width;
const H = brand.image.height;
const Cx = W / 2;

const EDGE = 70;           // left content x (≥60px horizontal safe margin)
const RIGHT_EDGE = 1140;   // right content boundary (≤ 1200-60)
const TAG_Y = 112;
const HEAD_Y = 172;
const SUB_Y = 238;
const ACCENT_Y = 266;
const PILLS_Y = 505;
const FOOTER_Y = H - 64;

/** Technologies pills — a compact secondary band under the main visual. */
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

/**
 * Left-aligned header block: concept tag → headline → subheadline → accent rule.
 * Anchored left so the main concept is the first thing a viewer reads.
 */
function header(brief: VisualBrief): string {
  return [
    drawPrimaryTagLeft(EDGE, TAG_Y, brief.primaryConcept || ""),
    drawHeadlineLeft(EDGE, HEAD_Y, brief.headline || brief.concept),
    drawSubheadlineLeft(EDGE, SUB_Y, brief.subheadline),
    `<line x1="${EDGE}" y1="${ACCENT_Y}" x2="${EDGE + 240}" y2="${ACCENT_Y}" stroke="${brand.colors.blue}" stroke-width="3" stroke-linecap="round" opacity="0.55" />`,
  ].join("");
}

/**
 * Small, subtle recruiter-relevant signal in the top-right corner. Rendered only
 * when the content genuinely supports it (Phase 5H flags). It states a skill
 * ("PROBLEM SOLVING", "SECURITY AWARENESS") — never a hiring message.
 */
function signalTag(brief: VisualBrief): string {
  if (!brief.recruiterSignal) return "";
  return `
    <text x="${RIGHT_EDGE}" y="118" text-anchor="end"
          font-family="Arial, Helvetica, sans-serif" font-size="15"
          font-weight="600" letter-spacing="2" fill="${brand.colors.cyan}" opacity="0.85">
      ${escapeXml(brief.recruiterSignal.toUpperCase())}
    </text>`;
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

/** Horizontal chain of nodes connected by left→right arrows (landscape). */
function chainRow(nodes: readonly string[], y: number, boxH: number, gap: number): string {
  const shown = nodes.slice(0, 4);
  const n = shown.length;
  if (!n) return "";
  const boxW = Math.min(220, (W - 260) / n);
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

// ─── Composition: CONCEPT_FLOW ──────────────────────────────────────────────
// Left header + a main horizontal chain of concept nodes + technology band.

function renderConceptFlow(brief: VisualBrief): string {
  const chain = brief.visualMetaphor.split(" → ").map((s) => s.trim()).filter(Boolean);
  const nodes = chain.length >= 2 ? chain : brief.keyPoints.map((p) => p.label);

  return [
    header(brief),
    signalTag(brief),
    chainRow(nodes, 302, 112, 40),
    fitPills(brief.technologies, PILLS_Y),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: PROBLEM_SOLUTION ──────────────────────────────────────────
// Three aligned columns — PROBLEM → SOLUTION → RESULT — with a supporting card
// beneath, laid out for the landscape canvas.

function renderProblemSolution(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 3);
  const boxW = 300;
  const boxH = 112;
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

  const cards = cardRow(points, 440, boxW, 64, gap);

  return [
    header(brief),
    signalTag(brief),
    boxes,
    arrows,
    cards,
    footerBadge(brief),
  ].join("");
}

// ─── Composition: THREE_IDEAS ───────────────────────────────────────────────
// Left header + three descriptive idea cards across the width + technology band.

function renderThreeIdeas(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 3);
  const w = 340;
  const gap = 16;
  const y = 285;
  const h = 148;

  const cards = points.map((p, i) =>
    drawCard(Cx - (3 * w + 2 * gap) / 2 + i * (w + gap), y, w, h, p.label || " ", p.detail, i),
  ).join("");

  return [
    header(brief),
    signalTag(brief),
    cards,
    fitPills(brief.technologies, PILLS_Y),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: ARCHITECTURE_FLOW ─────────────────────────────────────────
// Layered system tiers shown as a main horizontal pipeline + technology band.

function renderArchitectureFlow(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 4);
  const nodes = points.length ? points.map((p) => p.label) : [brief.concept || "System", "", "", ""];

  return [
    header(brief),
    signalTag(brief),
    chainRow(nodes, 302, 112, 40),
    fitPills(brief.technologies, PILLS_Y),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: BEFORE_AFTER ──────────────────────────────────────────────
// Side-by-side before / after contrast with a connecting arrow.

function renderBeforeAfter(brief: VisualBrief): string {
  const contrastParts = brief.visualMetaphor.split(" → ").map((s) => s.trim()).filter(Boolean);
  const contrast: [string, string] = contrastParts.length >= 2
    ? [contrastParts[0]!, contrastParts[contrastParts.length - 1]!]
    : ["BEFORE", "AFTER"];
  const points = clampKeyPoints(brief.keyPoints, 2);
  const boxW = 400;
  const boxH = 180;
  const y = 290;
  const leftX = 110;
  const rightX = W - 110 - boxW;

  const leftDetail = points[0]?.detail || "";
  const rightDetail = points[1]?.detail || brief.visualMetaphor;

  return [
    header(brief),
    signalTag(brief),
    drawNode(leftX, y, boxW, boxH, contrast[0], { sub: leftDetail }),
    drawArrow(leftX + boxW + 14, y + boxH / 2, rightX - 14, y + boxH / 2),
    drawNode(rightX, y, boxW, boxH, contrast[1], { accent: true, sub: rightDetail }),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: SKILL_PROGRESSION ─────────────────────────────────────────
// Progression steps as a main chain, with a supporting compact card row.

function renderSkillProgression(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 4);
  const nodes = points.length ? points.map((p) => p.label) : [brief.concept || "Learn", "", "", ""];

  return [
    header(brief),
    signalTag(brief),
    chainRow(nodes, 296, 100, 40),
    cardRow(points, 435, 250, 62, 24),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: COMPARISON ────────────────────────────────────────────────
// Two-column comparison of two concepts/approaches.

function renderComparison(brief: VisualBrief): string {
  const parts = brief.visualMetaphor.split(" → ").map((s) => s.trim()).filter(Boolean);
  const left = parts[0] || "A";
  const right = (parts.length > 1 ? parts[1] : undefined) || "B";
  const points = clampKeyPoints(brief.keyPoints, 2);
  const boxW = 460;
  const boxH = 178;
  const y = 290;
  const leftX = 110;
  const rightX = W - 110 - boxW;
  const midY = y + boxH / 2;

  return [
    header(brief),
    signalTag(brief),
    drawNode(leftX, y, boxW, boxH, left, { sub: points[0]?.detail || "" }),
    drawArrow(leftX + boxW + 10, midY, rightX - 10, midY),
    drawNode(rightX, y, boxW, boxH, right, { accent: true, sub: points[1]?.detail || brief.concept }),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: INPUT_PROCESS_OUTPUT ──────────────────────────────────────
// Three horizontal stages: INPUT → PROCESS → OUTPUT (kept minimal for the
// compact landscape — no redundant second card row).

function renderInputProcessOutput(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 3);
  const captions = ["INPUT", "PROCESS", "OUTPUT"];
  const boxW = 280;
  const boxH = 112;
  const gap = 66;
  const totalW = 3 * boxW + 2 * gap;
  const startX = Cx - totalW / 2;
  const y = 300;
  const stageAccents = [false, true, false];

  let svg = header(brief);
  svg += signalTag(brief);
  captions.forEach((caption, i) => {
    const x = startX + i * (boxW + gap);
    svg += `<text x="${x + boxW / 2}" y="${y - 26}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" letter-spacing="2" fill="${brand.colors.cyan}">${caption}</text>`;
    svg += drawNode(x, y, boxW, boxH, points[i]?.label || caption, { accent: stageAccents[i], sub: points[i]?.detail });
    if (i < 2) {
      svg += drawArrow(x + boxW + 6, y + boxH / 2, x + boxW + gap - 6, y + boxH / 2);
    }
  });

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
 * Canvas is the landscape `brand.image` (1200×675); purely programmatic,
 * deterministic, and limited to the brand palette.
 */
export function renderVisualBrief(brief: VisualBrief): string {
  const renderer = RENDERERS[brief.composition] ?? renderConceptFlow;
  const content = renderer(brief);
  // Compositions carry their own bottom day/module badge, so the shared
  // scaffold footer mark is omitted here to avoid a redundant mark stacking.
  return renderScaffold() + content + "</svg>";
}