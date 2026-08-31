import { brand } from "@/config/brand";
import { escapeXml } from "../svg/escape";
import { NAVY_PANEL_X, NAVY_PANEL_TOP, NAVY_PANEL_WIDTH } from "./geometry";
import { MAX_TAKEAWAYS } from "./takeaways";
import { SVG_FONT_FAMILY } from "../fonts";

// ─── Navy KEY TAKEAWAYS Editorial Panel ──────────────────────────────────────
// Active content panel inside the deep-navy branding section (right of the
// diagonal, above the TB logo). It renders a restrained editorial header plus
// numbered items (01–04) derived deterministically from the post's own content
// (see theme/takeaways.ts). The panel sits on a faint container card so the navy
// block reads as a deliberate information area. When there is nothing honest to
// say the panel is skipped entirely so the navy block stays clean.

const c = brand.colors;
const FONT = SVG_FONT_FAMILY;

const LABEL_Y = NAVY_PANEL_TOP + 38;
const RULE_Y = LABEL_Y + 13;
const ROW_START_Y = LABEL_Y + 48;
const ROW_STEP = 74;
const CHIP_X = NAVY_PANEL_X;
const TEXT_X = NAVY_PANEL_X + 44;
const TEXT_MAX_W = NAVY_PANEL_WIDTH - 44;
const TEXT_FONT = 19;

/** Panel card inset so its bounds never crowd the canvas extreme or the logo. */
const PANEL_PAD_BOTTOM = 56;
const PANEL_TOP = NAVY_PANEL_TOP - 16;

/** Word-wraps a takeaway label to ≤2 lines within the panel width. */
function wrapLabel(label: string): string[] {
  const maxChars = Math.max(8, Math.floor(TEXT_MAX_W / (TEXT_FONT * 0.55)));
  const words = label.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const raw of words) {
    const w = raw;
    const candidate = (current ? `${current} ${w}` : w).trim();
    if (candidate.length > maxChars && current) {
      lines.push(current.trim());
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current.trim());
  return lines.slice(0, 2);
}

/**
 * Renders the editorial KEY TAKEAWAYS panel for the navy section.
 * Returns an empty string when no takeaways are available (clean fallback).
 */
export function renderTakeawaysPanel(
  takeaways: readonly string[] | null | undefined,
): string {
  const items = (takeaways ?? []).slice(0, MAX_TAKEAWAYS);
  if (items.length === 0) return "";

  const lastRowY = ROW_START_Y + (items.length - 1) * ROW_STEP;
  const panelBottom = lastRowY + PANEL_PAD_BOTTOM;
  const panelHeight = panelBottom - PANEL_TOP;

  let svg = `
    <rect x="${NAVY_PANEL_X}" y="${PANEL_TOP}" width="${NAVY_PANEL_WIDTH}" height="${panelHeight}" rx="20"
          fill="#FFFFFF" opacity="0.045" stroke="#1E4C96" stroke-width="1" />
    <rect x="${NAVY_PANEL_X}" y="${PANEL_TOP}" width="4" height="${panelHeight}" rx="2" fill="${c.blue}" opacity="0.85" />
    <text x="${NAVY_PANEL_X + 28}" y="${LABEL_Y}" text-anchor="start" font-family="${FONT}"
          font-size="20" font-weight="800" letter-spacing="5" fill="#FFFFFF">KEY TAKEAWAYS</text>
    <rect x="${NAVY_PANEL_X + 28}" y="${RULE_Y}" width="56" height="4" rx="2" fill="${c.blue}" />`;

  items.forEach((raw, i) => {
    const y = ROW_START_Y + i * ROW_STEP;
    const number = i + 1 < 10 ? `0${i + 1}` : `${i + 1}`;
    const lines = wrapLabel(raw);
    svg += `<text x="${CHIP_X + 28}" y="${y}" text-anchor="start" font-family="${FONT}"
          font-size="17" font-weight="700" fill="${c.cyan}">${number}</text>`;
    lines.forEach((line, li) => {
      svg += `<text x="${TEXT_X + 28}" y="${Number((y + li * 25).toFixed(1))}" text-anchor="start"
          font-family="${FONT}" font-size="${TEXT_FONT}" font-weight="600" fill="#FFFFFF">${escapeXml(line)}</text>`;
    });
  });

  return `<g>${svg}
</g>`;
}