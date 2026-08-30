import type { VisualBrief, VisualComposition } from "@/types/image";
import { brand } from "@/config/brand";
import { renderScaffold, closeScaffold } from "../../svg/render";
import {
  drawNode,
  drawArrow,
  drawDownArrow,
  drawCard,
  drawPill,
  drawDayBadge,
  drawHeadline,
  drawSubheadline,
  drawPrimaryTag,
} from "./draw";
import { clampKeyPoints } from "../themes";

const W = brand.image.width;
const Cx = W / 2;

export interface CompositionRenderContext {
  readonly brief: VisualBrief;
}

// ─── Layout constants ───────────────────────────────────────────────────────
// Mobile-safe: everything critical stays inside a ~90px safe margin on a square
// 1200×1200 canvas. Series title at y=80; header block spans ~98–230.

const TOP = 160;

/** Pixel space occupied by one glyph at a given font size. */
function fitPills(technologies: readonly string[], y: number): string {
  const pills = technologies.slice(0, 5);
  const total = pills.length * 170 + (pills.length - 1) * 12;
  let x = Cx - total / 2 + 85;
  return pills.map((t) => {
    const out = drawPill(x, y, t);
    x += 182;
    return out;
  }).join("");
}

function header(brief: VisualBrief, y: number, subY: number): string {
  const parts = [
    // Level 1 — the single dominant idea, framed small so it never competes
    // with the headline but makes the "one message" explicit.
    drawPrimaryTag(Cx, y - 40, brief.primaryConcept || ""),
    drawHeadline(Cx, y, brief.headline || brief.concept),
    drawSubheadline(Cx, subY, brief.subheadline),
  ];
  return parts.join("");
}

function footerBadge(brief: VisualBrief): string {
  return drawDayBadge(Cx, 1060, brief.dayNumber, brief.module);
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
// Headline + horizontal chain of concept nodes connected by arrows.

function renderConceptFlow(brief: VisualBrief): string {
  const chain = brief.visualMetaphor.split(" → ").map((s) => s.trim()).filter(Boolean);
  const nodes = chain.length >= 2 ? chain : brief.keyPoints.map((p) => p.label);
  const shown = nodes.slice(0, 4);

  const n = shown.length;
  const boxW = Math.min(170, (W - 360) / n);
  const gap = 40;
  const totalW = n * boxW + (n - 1) * gap;
  const startX = Cx - totalW / 2;
  const y = 420;
  const boxH = 110;

  let nodesSvg = "";
  shown.forEach((label, i) => {
    const lines = nodeLines(label);
    const x = startX + i * (boxW + gap);
    nodesSvg += drawNode(x, y, boxW, boxH, lines[0] || "", {
      accent: i === n - 1,
      sub: lines[1],
    });
    if (i < n - 1) {
      nodesSvg += drawArrow(x + boxW + 2, y + boxH / 2, x + boxW + gap - 2, y + boxH / 2);
    }
  });

  const pills = brief.technologies.length ? fitPills(brief.technologies, 640) : "";

  return [
    header(brief, TOP, TOP + 44),
    nodesSvg,
    pills,
    footerBadge(brief),
  ].join("");
}

// ─── Composition: PROBLEM_SOLUTION ──────────────────────────────────────────
// Two-stage horizontal problem → solution flow with supporting points.

function renderProblemSolution(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 3);
  const boxW = 300;
  const boxH = 120;
  const y = 380;
  const leftX = 160;
  const rightX = W - 160 - boxW;
  const midX = Cx;

  const pills = brief.technologies.length ? fitPills(brief.technologies, 700) : "";

  const cards = points.map((p, i) =>
    drawCard(340, 520 + i * 130, 520, 110, p.label, p.detail, i),
  ).join("");

  return [
    header(brief, TOP, TOP + 44),
    drawNode(leftX, y, boxW, boxH, "PROBLEM", { sub: points[0]?.label || brief.concept }),
    drawArrow(leftX + boxW + 10, y + boxH / 2, midX - 14, y + boxH / 2),
    drawNode(midX, y, boxW, boxH, "SOLUTION", { accent: true, sub: points[1]?.label || "" }),
    drawArrow(midX + boxW + 10, y + boxH / 2, rightX - 14, y + boxH / 2),
    drawNode(rightX, y, boxW, boxH, "RESULT", { sub: points[2]?.label || "" }),
    cards,
    pills,
    footerBadge(brief),
  ].join("");
}

// ─── Composition: THREE_IDEAS ───────────────────────────────────────────────
// Headline + three key idea cards (concept / explanation layout).

function renderThreeIdeas(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 3);
  while (points.length < 3) points.push({ label: "", detail: "" });

  const cards = points.map((p, i) =>
    drawCard(210, 360 + i * 190, 780, 170, p.label || " ", p.detail, i),
  ).join("");

  const pills = brief.technologies.length ? fitPills(brief.technologies, 990) : "";

  return [
    header(brief, TOP, TOP + 44),
    cards,
    pills,
    footerBadge(brief),
  ].join("");
}

// ─── Composition: ARCHITECTURE_FLOW ─────────────────────────────────────────
// Layered architecture / system components descending into one output.

function renderArchitectureFlow(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 4);
  const tiers = points.length ? points : [{ label: brief.concept || "System", detail: "" }, { label: "", detail: "" }, { label: "", detail: "" }];

  const boxW = 360;
  const boxH = 92;
  const gap = 60;
  const startY = 280;

  let svg = header(brief, TOP, TOP + 44);
  tiers.slice(0, 4).forEach((p, i) => {
    const y = startY + i * (boxH + gap);
    const accent = i === tiers.length - 1 || i === 3;
    const shrink = i > 0;
    const w = shrink ? boxW - i * 24 : boxW;
    svg += drawNode(Cx - w / 2, y, w, boxH, p.label || "…", { accent, sub: p.detail });
    if (i < Math.min(tiers.length, 4) - 1) {
      svg += drawDownArrow(Cx, y + boxH + 4, y + boxH + gap - 4);
    } else if (i < 3) {
      svg += drawDownArrow(Cx, y + boxH + 4, y + boxH + gap - 4);
    }
  });

  svg += footerBadge(brief);
  return svg;
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
  const boxH = 260;
  const y = 380;
  const leftX = 120;
  const rightX = W - 120 - boxW;

  const leftDetail = points[0]?.detail || "";
  const rightDetail = points[1]?.detail || brief.visualMetaphor;

  return [
    header(brief, TOP, TOP + 44),
    drawNode(leftX, y, boxW, boxH, contrast[0], { sub: leftDetail }),
    drawArrow(leftX + boxW + 14, y + boxH / 2, rightX - 14, y + boxH / 2),
    drawNode(rightX, y, boxW, boxH, contrast[1], { accent: true, sub: rightDetail }),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: SKILL_PROGRESSION ─────────────────────────────────────────
// Vertical skill progression steps.

function renderSkillProgression(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 4);
  const steps = points.length ? points : [{ label: brief.concept || "Learn", detail: "" }, { label: "", detail: "" }, { label: "", detail: "" }];
  const tierH = 110;
  const gap = 28;
  const startY = 260;

  let svg = header(brief, TOP, TOP + 44);
  steps.slice(0, 4).forEach((s, i) => {
    const y = startY + i * (tierH + gap);
    const left = 250;
    const w = 700;
    svg += drawCard(left, y, w, tierH, s.label || " ", s.detail, i);
    if (i < Math.min(steps.length, 4) - 1) {
      svg += drawDownArrow(Cx, y + tierH + 2, y + tierH + gap - 2);
    }
  });
  svg += footerBadge(brief);
  return svg;
}

// ─── Composition: COMPARISON ─────────────────────────────────────────────────
// Two-column comparison of two concepts/approaches.

function renderComparison(brief: VisualBrief): string {
  const parts = brief.visualMetaphor.split(" → ").map((s) => s.trim()).filter(Boolean);
  const left = parts[0] || "A";
  const right = (parts.length > 1 ? parts[1] : undefined) || "B";
  const points = clampKeyPoints(brief.keyPoints, 2);
  const boxW = 460;
  const boxH = 300;
  const y = 380;
  const leftX = 110;
  const rightX = W - 110 - boxW;

  return [
    header(brief, TOP, TOP + 44),
    drawNode(leftX, y, boxW, boxH, left, { sub: points[0]?.detail || "" }),
    drawNode(rightX, y, boxW, boxH, right, { accent: true, sub: points[1]?.detail || brief.concept }),
    footerBadge(brief),
  ].join("");
}

// ─── Composition: INPUT_PROCESS_OUTPUT ──────────────────────────────────────
// Three horizontal stages: INPUT → PROCESS → OUTPUT. Great for concept/how-it-
// works, functions and pipelines.

function renderInputProcessOutput(brief: VisualBrief): string {
  const points = clampKeyPoints(brief.keyPoints, 3);
  const captions = ["INPUT", "PROCESS", "OUTPUT"];
  const boxW = 240;
  const boxH = 120;
  const gap = 90;
  const totalW = 3 * boxW + 2 * gap;
  const startX = Cx - totalW / 2;
  const y = 430;

  const stageAccents = [false, true, false];

  let svg = header(brief, TOP, TOP + 44);
  captions.forEach((caption, i) => {
    const x = startX + i * (boxW + gap);
    // Stage caption above the box so the process structure stays obvious even
    // when the node carries real post content.
    svg += `<text x="${x + boxW / 2}" y="${y - 30}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" letter-spacing="2" fill="${brand.colors.cyan}">${caption}</text>`;
    svg += drawNode(x, y, boxW, boxH, points[i]?.label || caption, { accent: stageAccents[i], sub: points[i]?.detail });
    if (i < 2) {
      svg += drawArrow(x + boxW + 6, y + boxH / 2, x + boxW + gap - 6, y + boxH / 2);
    }
  });

  const pills = brief.technologies.length ? fitPills(brief.technologies, 620) : "";
  svg += pills;
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
 * Reuses the existing brand scaffold; purely programmatic — no external assets.
 */
export function renderVisualBrief(brief: VisualBrief): string {
  const renderer = RENDERERS[brief.composition] ?? renderConceptFlow;
  const content = renderer(brief);
  return renderScaffold() + content + closeScaffold();
}
