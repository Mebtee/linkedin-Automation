import { brand } from "@/config/brand";
import { escapeXml } from "../../svg/escape";
import { truncate } from "../themes";
import {
  drawNode as themeNode,
  drawArrow as themeArrow,
  drawCard as themeCard,
  drawPill as themePill,
} from "../../theme/primitives";
import { SVG_FONT_FAMILY } from "../../fonts";

const c = brand.colors;

// ─── Composition drawing primitives (Phase 5I light editorial zone) ─────────
// Thin adapters over the shared theme primitives so the content compositions
// render in the same professional light-zone language as every template. Small
// helpers that are specific to the content-driven compositions live here too.

const FONT = SVG_FONT_FAMILY;

/** Light node panel. */
export function drawNode(x: number, y: number, w: number, h: number, label: string, opts: { accent?: boolean; sub?: string } = {}): string {
  return themeNode(x, y, w, h, label, opts);
}

/** Horizontal arrow (blue, light-zone). */
export function drawArrow(x1: number, y1: number, x2: number, y2: number): string {
  return themeArrow(x1, y1, x2, y2);
}

/** Light key-point card with a numbered chip. */
export function drawCard(x: number, y: number, w: number, h: number, label: string, detail: string, index: number): string {
  return themeCard(x, y, w, h, label, detail, index);
}

/** Light technology pill. */
export function drawPill(x: number, y: number, label: string): string {
  return themePill(x, y, label);
}

/** Centered multi-line headline (light zone, navy text). */
export function drawHeadline(x: number, y: number, text: string): string {
  if (!text) return "";
  const lines = wrapCentered(truncate(text, 60), 940, 52, 2);
  const lineH = 60;
  const start = y - ((lines.length - 1) * lineH) / 2;
  return lines.map((line, i) =>
    `<text x="${x}" y="${start + i * lineH}" text-anchor="middle" font-family="${FONT}" font-size="52" font-weight="800" fill="${c.text}">${escapeXml(line)}</text>`
  ).join("");
}

/** Centered supporting line (light zone, muted). */
export function drawSubheadline(x: number, y: number, text: string): string {
  if (!text) return "";
  const lines = wrapCentered(truncate(text, 100), 860, 22, 2);
  const lineH = 28;
  const start = y - ((lines.length - 1) * lineH) / 2;
  return lines.map((line, i) =>
    `<text x="${x}" y="${start + i * lineH}" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="400" fill="${c.muted}">${escapeXml(line)}</text>`
  ).join("");
}

/** Centered uppercase concept tag (light zone). */
export function drawPrimaryTag(x: number, y: number, text: string): string {
  if (!text) return "";
  const label = truncate(text.toUpperCase(), 34);
  const w = Math.min(label.length * 12.5 + 44, 620);
  return `
    <rect x="${x - w / 2}" y="${y - 21}" width="${w}" height="42" rx="21"
          fill="#EDF2FF" stroke="${c.blue}" stroke-width="1.2" />
    <text x="${x}" y="${y + 7}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="700" letter-spacing="2.6" fill="${c.blue}">${escapeXml(label)}</text>`;
}

/** Small day/module badge (journey branding only). */
export function drawDayBadge(x: number, y: number, dayNumber?: number, module?: string): string {
  const parts: string[] = [];
  if (dayNumber) parts.push(`DAY ${dayNumber} / 105`);
  if (module) parts.push(module.toUpperCase());
  const label = parts.join("  ·  ");
  if (!label) return "";
  return `
    <rect x="${x - 140}" y="${y - 20}" width="280" height="40" rx="20"
          fill="none" stroke="${c.blue}" stroke-width="1" opacity="0.4" />
    <text x="${x}" y="${y + 6}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="600" letter-spacing="2" fill="${c.muted}">${escapeXml(label)}</text>`;
}

// ─── Left-anchored text helpers (light editorial zone) ──────────────────────

/** Left-anchored uppercase concept tag. */
export function drawPrimaryTagLeft(x: number, y: number, text: string): string {
  if (!text) return "";
  const label = truncate(text.toUpperCase(), 34);
  const w = Math.min(label.length * 12.5 + 44, 620);
  return `
    <rect x="${x}" y="${y - 21}" width="${w}" height="42" rx="21"
          fill="#EDF2FF" stroke="${c.blue}" stroke-width="1.2" />
    <text x="${x + w / 2}" y="${y + 7}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="700" letter-spacing="2.6" fill="${c.blue}">${escapeXml(label)}</text>`;
}

/** Left-anchored headline, navy, wrapped to 2 lines. */
export function drawHeadlineLeft(x: number, y: number, text: string): string {
  if (!text) return "";
  const lines = wrapCentered(truncate(text, 60), 760, 52, 2);
  const lineH = 60;
  const start = y - ((lines.length - 1) * lineH) / 2;
  return lines.map((line, i) =>
    `<text x="${x}" y="${start + i * lineH}" text-anchor="start" font-family="${FONT}" font-size="52" font-weight="800" fill="${c.text}">${escapeXml(line)}</text>`
  ).join("");
}

/** Left-anchored supporting line, muted, wrapped to 2 lines. */
export function drawSubheadlineLeft(x: number, y: number, text: string): string {
  if (!text) return "";
  const lines = wrapCentered(truncate(text, 100), 720, 20, 2);
  const lineH = 26;
  const start = y - ((lines.length - 1) * lineH) / 2;
  return lines.map((line, i) =>
    `<text x="${x}" y="${start + i * lineH}" text-anchor="start" font-family="${FONT}" font-size="20" font-weight="400" fill="${c.muted}">${escapeXml(line)}</text>`
  ).join("");
}

/** Wraps text into centered lines that fit a max width at a given font size. */
function wrapCentered(text: string, maxWidth: number, fontSize: number, maxLines: number): string[] {
  const approx = fontSize * 0.58;
  const maxChars = Math.max(4, Math.floor(maxWidth / approx));
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = w;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines.slice(0, maxLines);
}
