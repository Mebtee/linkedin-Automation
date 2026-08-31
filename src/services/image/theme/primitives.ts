import { brand } from "@/config/brand";
import { escapeXml } from "../svg/escape";
import { truncate } from "../visual/themes";
import { SIGNAL_TAG_X, SIGNAL_TAG_Y } from "./geometry";
import { SVG_FONT_FAMILY } from "../fonts";

// ─── Theme Primitives (Phase 5I professional redesign) ───────────────────────
// Reusable building blocks layered on the branded background:
//   BACKGROUND  → theme/background.ts (white + navy diagonal split)
//   CONTENT     → theme/primitives.ts (typography + technical shapes, light zone)
//   BRANDING    → theme/branding.ts (TB logo + footer mark)
// One portable font stack; colors from the professional TB palette; no glow, no
// dashboard-style cards, minimal decoration. All text is XML-escaped.

const c = brand.colors;
const FONT = SVG_FONT_FAMILY;

// ─── Text wrapping ───────────────────────────────────────────────────────────

/** Approximate per-line char budget for a wrapped paragraph. */
function wrapInfo(maxWidth: number, fontSize: number, maxLines: number) {
  const maxChars = Math.max(4, Math.floor(maxWidth / (fontSize * 0.6)));
  return { maxChars, maxLines };
}

/** Word-wraps `text` into at most `maxLines` lines fitting `maxWidth`. */
function wrapText(text: string, maxWidth: number, fontSize: number, maxLines: number): string[] {
  const { maxChars, maxLines: limit } = wrapInfo(maxWidth, fontSize, maxLines);
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = (current ? current + " " + w : w).trim();
    if (candidate.length > maxChars && current) {
      lines.push(current.trim());
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current.trim());
  return lines.slice(0, limit);
}

/** Centered multi-line text (used by templates). */
function wrapCentered(text: string, maxWidth: number, fontSize: number, maxLines: number): string[] {
  return wrapText(text, maxWidth, fontSize, maxLines);
}

// ─── Topic label ─────────────────────────────────────────────────────────────

/** Small uppercase concept tag, left-anchored (content zone). */
export function drawPrimaryTagLeft(x: number, y: number, text: string): string {
  if (!text) return "";
  const label = truncate(text.toUpperCase(), 34);
  const w = Math.min(label.length * 12.5 + 44, 620);
  return `
    <rect x="${x}" y="${y - 21}" width="${w}" height="42" rx="21"
          fill="#EDF2FF" stroke="${c.blue}" stroke-width="1.2" />
    <text x="${x + w / 2}" y="${y + 7}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="700" letter-spacing="2.6" fill="${c.blue}">${escapeXml(label)}</text>`;
}

/** Small centered tag (template layout). */
export function drawPrimaryTag(x: number, y: number, text: string): string {
  if (!text) return "";
  const label = truncate(text.toUpperCase(), 34);
  const w = Math.min(label.length * 12.5 + 44, 620);
  return `
    <rect x="${x - w / 2}" y="${y - 21}" width="${w}" height="42" rx="21"
          fill="#EDF2FF" stroke="${c.blue}" stroke-width="1.2" />
    <text x="${x}" y="${y + 7}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="700" letter-spacing="2.6" fill="${c.blue}">${escapeXml(label)}</text>`;
}

// ─── Headline / subheadline ──────────────────────────────────────────────────

/** Large navy headline, left-anchored, wraps to ≤2 lines in the content zone. */
export function drawHeadlineLeft(x: number, y: number, text: string): string {
  if (!text) return "";
  const lines = wrapCentered(truncate(text, 58), 900, 54, 2);
  const lineH = 64;
  const start = y - ((lines.length - 1) * lineH) / 2;
  return lines.map((line, i) =>
    `<text x="${x}" y="${Number((start + i * lineH).toFixed(1))}" text-anchor="start" font-family="${FONT}" font-size="54" font-weight="800" fill="${c.text}">${escapeXml(line)}</text>`
  ).join("");
}

/** Large navy headline, centered (template layout). */
export function drawHeadline(x: number, y: number, text: string): string {
  if (!text) return "";
  const lines = wrapCentered(truncate(text, 58), 940, 56, 2);
  const lineH = 66;
  const start = y - ((lines.length - 1) * lineH) / 2;
  return lines.map((line, i) =>
    `<text x="${x}" y="${Number((start + i * lineH).toFixed(1))}" text-anchor="middle" font-family="${FONT}" font-size="56" font-weight="800" fill="${c.text}">${escapeXml(line)}</text>`
  ).join("");
}

/** Muted supporting line, left-anchored, wraps to ≤2 lines. */
export function drawSubheadlineLeft(x: number, y: number, text: string): string {
  if (!text) return "";
  const lines = wrapCentered(truncate(text, 100), 860, 24, 2);
  const lineH = 32;
  const start = y - ((lines.length - 1) * lineH) / 2;
  return lines.map((line, i) =>
    `<text x="${x}" y="${Number((start + i * lineH).toFixed(1))}" text-anchor="start" font-family="${FONT}" font-size="24" font-weight="400" fill="${c.muted}">${escapeXml(line)}</text>`
  ).join("");
}

/** Muted supporting line, centered (template layout). */
export function drawSubheadline(x: number, y: number, text: string): string {
  if (!text) return "";
  const lines = wrapCentered(truncate(text, 100), 900, 24, 2);
  const lineH = 32;
  const start = y - ((lines.length - 1) * lineH) / 2;
  return lines.map((line, i) =>
    `<text x="${x}" y="${Number((start + i * lineH).toFixed(1))}" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="400" fill="${c.muted}">${escapeXml(line)}</text>`
  ).join("");
}

// ─── Divider / accent bar ────────────────────────────────────────────────────

/** Short electric-blue accent bar (divider under the header). */
export function drawDivider(x: number, y: number, width = 64): string {
  return `<rect x="${x}" y="${y - 2.5}" width="${width}" height="5" rx="2.5" fill="${c.blue}" opacity="0.9" />`;
}

// ─── Technical nodes / arrows / cards / pills ────────────────────────────────

/** Word-wrap a label to fit a node box. */
function wrapLabel(label: string, maxWidth: number, fontSize: number): string[] {
  return wrapText(truncate(label, 34), maxWidth, fontSize, 2);
}

/** A clean technical node panel (light zone), label navy · sub muted. */
export function drawNode(
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  opts: { accent?: boolean; sub?: string } = {},
): string {
  const lines = wrapLabel(label, w - 24, 22);
  const lineH = 27;
  const blockTop = y + h / 2 - (lines.length * lineH) / 2;
  const accentBar = opts.accent
    ? `<rect x="${x + 8}" y="${y + 8}" width="34" height="4" rx="2" fill="${c.blue}" />`
    : "";
  const labelLines = lines.map((line, i) =>
    `<text x="${x + w / 2}" y="${Number((blockTop + i * lineH).toFixed(1))}" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="700" fill="${c.text}">${escapeXml(line)}</text>`
  ).join("");
  const sub = opts.sub
    ? `<text x="${x + w / 2}" y="${y + h - 22}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="400" fill="${c.muted}">${escapeXml(truncate(opts.sub, Math.max(10, Math.floor(w / 10))))}</text>`
    : "";
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14"
          fill="${c.lightGray}" stroke="#DCE4F1" stroke-width="1" />
    ${accentBar}
    ${labelLines}
    ${sub}`;
}

/** A clean straight connector arrow (blue, no glow). */
export function drawArrow(x1: number, y1: number, x2: number, y2: number): string {
  const head = 11;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const hx = Math.cos(angle) * head;
  const hy = Math.sin(angle) * head;
  return `
    <line x1="${Number(x1.toFixed(1))}" y1="${Number(y1.toFixed(1))}" x2="${Number((x2 - hx / 2).toFixed(1))}" y2="${Number((y2 - hy / 2).toFixed(1))}" stroke="${c.blue}" stroke-width="3" opacity="0.85" />
    <polygon points="${Number(x2.toFixed(1))},${Number(y2.toFixed(1))} ${Number((x2 - hx - hy * 0.35).toFixed(1))},${Number((y2 - hy + hx * 0.35).toFixed(1))} ${Number((x2 - hx + hy * 0.35).toFixed(1))},${Number((y2 - hy - hx * 0.35).toFixed(1))}" fill="${c.blue}" opacity="0.85" />`;
}

/** Light key-point card with a numbered chip. */
export function drawCard(
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  detail: string,
  index: number,
): string {
  const labelLines = wrapText(truncate(label, 28), w - 90, 21, 2);
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14"
          fill="${c.lightGray}" stroke="#DCE4F1" stroke-width="1" />
    <rect x="${x + 22}" y="${y + 24}" width="36" height="36" rx="9" fill="${c.blue}" />
    <text x="${x + 40}" y="${y + 49}" text-anchor="middle" font-family="${FONT}" font-size="18" font-weight="700" fill="#FFFFFF">${index + 1}</text>
    ${labelLines.map((line, i) => `<text x="${x + 70}" y="${Number((y + 36 + i * 25).toFixed(1))}" font-family="${FONT}" font-size="21" font-weight="700" fill="${c.text}">${escapeXml(line)}</text>`).join("")}
    ${detail ? `<text x="${x + 70}" y="${y + h - 26}" font-family="${FONT}" font-size="15" font-weight="400" fill="${c.muted}">${escapeXml(truncate(detail, 44))}</text>` : ""}`;
}

/** Small subdued technology pill (light zone). */
export function drawPill(x: number, y: number, label: string): string {
  const w = Math.min(label.length * 10 + 44, 240);
  return `
    <rect x="${Number((x - w / 2).toFixed(1))}" y="${y - 17}" width="${w}" height="34" rx="17"
          fill="#EDF1F8" stroke="#DAE2EE" stroke-width="1" />
    <text x="${x}" y="${y + 5}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="600" fill="${c.text}">${escapeXml(label)}</text>`;
}

// ─── Day feather (series context) ────────────────────────────────────────────

/** Small "DAY X / 105" label at the top-right of the content zone. */
export function drawDayFeather(x: number, y: number, dayNumber?: number): string {
  if (!dayNumber) return "";
  return `
    <text x="${x}" y="${y}" text-anchor="end" font-family="${FONT}" font-size="16" font-weight="600" letter-spacing="2.4" fill="${c.muted}">DAY ${dayNumber} / ${brand.totalDays}</text>`;
}

// ─── Recruiter-aware skill signal (navy region, spec §8) ─────────────────────

/** Small cyan skill label in the top-right navy area. Never a hiring message. */
export function drawSignalTag(label?: string): string {
  if (!label) return "";
  return `
    <text x="${SIGNAL_TAG_X}" y="${SIGNAL_TAG_Y}" text-anchor="end" font-family="${FONT}" font-size="16" font-weight="700" letter-spacing="3" fill="${c.cyan}" opacity="0.9">${escapeXml(label.toUpperCase())}</text>`;
}