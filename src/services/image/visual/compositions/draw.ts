import { brand } from "@/config/brand";
import { escapeXml } from "../../svg/escape";
import { truncate } from "../themes";

const c = brand.colors;

// ─── Shared drawing primitives for content compositions ────────────────────
// Small, reusable SVG building blocks. All text is XML-escaped. Colors and
// spacing stay consistent with the brand system.

const FONT = "Arial, Helvetica, sans-serif";

/** Wraps a label into lines that fit within a box of the given width. */
function wrapLabel(label: string, maxWidth: number, fontSize: number): string[] {
  const approx = fontSize * 0.6;
  const maxChars = Math.max(4, Math.floor(maxWidth / approx));
  const words = label.split(" ");
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
  return lines;
}

/** A rounded node box with an auto-wrapping label and optional sub text. */
export function drawNode(x: number, y: number, w: number, h: number, label: string, opts: { accent?: boolean; sub?: string } = {}): string {
  const lines = wrapLabel(label, w - 20, 20);
  const lineH = 24;
  const blockTop = y + h / 2 - ((lines.length + (opts.sub ? 0 : 0)) * lineH) / 2;
  const labelLines = lines.map((line, i) =>
    `<text x="${x + w / 2}" y="${blockTop + i * lineH}" text-anchor="middle" font-family="${FONT}" font-size="20" font-weight="700" fill="white">${escapeXml(line)}</text>`
  ).join("");
  const sub = opts.sub ? `<text x="${x + w / 2}" y="${y + h - 18}" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="400" fill="${c.cyan}" opacity="0.9">${escapeXml(truncate(opts.sub, Math.max(10, Math.floor(w / 9))))}</text>` : "";
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14"
          fill="${opts.accent ? c.blue : "#16233B"}" stroke="${c.cyan}" stroke-width="1.5" opacity="${opts.accent ? 0.95 : 0.85}" />
    ${labelLines}
    ${sub}`;
}

/** A horizontal arrow between two points. */
export function drawArrow(x1: number, y1: number, x2: number, y2: number): string {
  const head = 10;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const hx = Math.cos(angle) * head;
  const hy = Math.sin(angle) * head;
  return `
    <line x1="${x1}" y1="${y1}" x2="${x2 - hx / 2}" y2="${y2 - hy / 2}" stroke="${c.cyan}" stroke-width="3" opacity="0.8" />
    <polygon points="${x2},${y2} ${x2 - hx - hy * 0.35},${y2 - hy + hx * 0.35} ${x2 - hx + hy * 0.35},${y2 - hy - hx * 0.35}" fill="${c.cyan}" opacity="0.8" />`;
}

/** A down arrow for stacked layouts. */
export function drawDownArrow(x: number, y1: number, y2: number): string {
  return drawArrow(x, y1, x, y2);
}

/** A key-point card with label + detail lines. */
export function drawCard(x: number, y: number, w: number, h: number, label: string, detail: string, index: number): string {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12"
          fill="#122040" stroke="${c.cyan}" stroke-width="1" opacity="0.7" />
    <circle cx="${x + 28}" cy="${y + 30}" r="15" fill="${c.blue}" opacity="0.9" />
    <text x="${x + 28}" y="${y + 36}" text-anchor="middle" font-family="${FONT}" font-size="16" font-weight="700" fill="white">${index + 1}</text>
    <text x="${x + 50}" y="${y + 26}" font-family="${FONT}" font-size="18" font-weight="700" fill="white">${escapeXml(label)}</text>
    ${detail ? `<text x="${x + 50}" y="${y + 50}" font-family="${FONT}" font-size="15" font-weight="400" fill="#C7D2E6">${escapeXml(truncate(detail, 34))}</text>` : ""}`;
}

/** A pill badge for a technology/label. */
export function drawPill(x: number, y: number, label: string): string {
  const w = Math.min(label.length * 11 + 36, 230);
  return `
    <rect x="${x - w / 2}" y="${y - 16}" width="${w}" height="32" rx="16"
          fill="${c.blue}" opacity="0.3" stroke="${c.cyan}" stroke-width="0.75" />
    <text x="${x}" y="${y + 6}" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="600" fill="${c.cyan}">${escapeXml(label)}</text>`;
}

/** Small day/module badge (secondary, journey branding only). */
export function drawDayBadge(x: number, y: number, dayNumber?: number, module?: string): string {
  const parts: string[] = [];
  if (dayNumber) parts.push(`DAY ${dayNumber} / 105`);
  if (module) parts.push(module.toUpperCase());
  const label = parts.join("  ·  ");
  if (!label) return "";
  return `
    <rect x="${x - 140}" y="${y - 20}" width="280" height="40" rx="20"
          fill="none" stroke="${c.cyan}" stroke-width="1" opacity="0.5" />
    <text x="${x}" y="${y + 6}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="600" letter-spacing="2" fill="${c.cyan}" opacity="0.9">${escapeXml(label)}</text>`;
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

/** Medium uppercase section label (e.g. the concept headline). */
export function drawHeadline(x: number, y: number, text: string): string {
  if (!text) return "";
  // Keep content well inside the 90px safe margin (1200 − 180 = 1020px usable).
  const lines = wrapCentered(truncate(text, 60), 1020, 42, 2);
  const lineH = 46;
  const start = y - ((lines.length - 1) * lineH) / 2;
  return lines.map((line, i) =>
    `<text x="${x}" y="${start + i * lineH}" text-anchor="middle" font-family="${FONT}" font-size="42" font-weight="800" fill="white">${escapeXml(line)}</text>`
  ).join("");
}

/** Lighter subheadline line (wrapped to a safe 2 lines). */
export function drawSubheadline(x: number, y: number, text: string): string {
  if (!text) return "";
  const lines = wrapCentered(truncate(text, 100), 1000, 20, 2);
  const lineH = 26;
  const start = y - ((lines.length - 1) * lineH) / 2;
  return lines.map((line, i) =>
    `<text x="${x}" y="${start + i * lineH}" text-anchor="middle" font-family="${FONT}" font-size="20" font-weight="400" fill="${c.cyan}" opacity="0.9">${escapeXml(line)}</text>`
  ).join("");
}

/** Small Level-1 emphasis tag that frames the single dominant idea. */
export function drawPrimaryTag(x: number, y: number, text: string): string {
  if (!text) return "";
  const label = truncate(text.toUpperCase(), 34);
  const w = Math.min(label.length * 13 + 48, 620);
  return `
    <rect x="${x - w / 2}" y="${y - 22}" width="${w}" height="44" rx="22"
          fill="${c.blue}" opacity="0.35" stroke="${c.cyan}" stroke-width="1.25" />
    <text x="${x}" y="${y + 7}" text-anchor="middle" font-family="${FONT}" font-size="18" font-weight="700" letter-spacing="2" fill="${c.cyan}">${escapeXml(label)}</text>`;
}
