import { brand } from "@/config/brand";
import {
  CANVAS_W,
  CANVAS_H,
  DIAG_TOP,
  DIAG_BOT,
} from "./geometry";
import { renderCircuitDecor } from "./circuit";

// ─── Branded Background (Phase 5I theme redesign) ────────────────────────────
// The permanent visual identity: a white/light editorial canvas on the left,
// split diagonally from a deep-navy branding block on the right (≈40–45% of the
// canvas). A clean electric-blue line follows the diagonal; sparse circuit
// decoration hugs the boundary. Content compositions render ON TOP of this
// background, in the light zone.
//
//   light rect (full canvas, near-white)
//   └ navy diagonal wedge (right, navy gradient with depth)
//     └ electric-blue diagonal accent line
//       └ sparse circuit traces + nodes near the boundary

const c = brand.colors;

/** Percentage → rounded string helper for gradient offsets. */
function pct(v: number): string {
  return `${Number(v.toFixed(2))}%`;
}

function px(v: number): string {
  return v.toFixed(1);
}

/**
 * Renders the full branded background (defs + shapes + decor). Deterministic —
 * `seedStr` (derived from the post) only moves the sparse circuit decoration.
 */
export function renderBrandedBackground(seedStr: string): string {
  const dx = DIAG_BOT.x - DIAG_TOP.x;
  const dy = DIAG_BOT.y - DIAG_TOP.y;
  const len = Math.hypot(dx, dy);
  // Parallel electric-blue accent line, offset a hair into the navy block.
  const off = 7;
  const nx = dy / len;
  const ny = -dx / len;
  const axeX1 = DIAG_TOP.x + nx * off;
  const axeY1 = DIAG_TOP.y + ny * off;
  const axeX2 = DIAG_BOT.x + nx * off;
  const axeY2 = DIAG_BOT.y + ny * off;

  return `
    <defs>
      <linearGradient id="bgLight" x1="0" y1="0" x2="1" y2="0">
        <stop offset="${pct(0)}" stop-color="${c.background}" />
        <stop offset="${pct(88)}" stop-color="${c.background}" />
        <stop offset="${pct(100)}" stop-color="${c.lightGray}" />
      </linearGradient>
      <linearGradient id="bgNavy" x1="0" y1="0" x2="0.42" y2="1">
        <stop offset="${pct(0)}" stop-color="${c.navy}" />
        <stop offset="${pct(62)}" stop-color="#0A2450" />
        <stop offset="${pct(100)}" stop-color="#0B2E5F" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#bgLight)" />
    <path
      d="M ${CANVAS_W} 0 L ${DIAG_TOP.x} 0 L ${DIAG_BOT.x} ${DIAG_BOT.y} L ${CANVAS_W} ${DIAG_BOT.y} Z"
      fill="url(#bgNavy)"
    />
    <line x1="${px(axeX1)}" y1="${px(axeY1)}" x2="${px(axeX2)}" y2="${px(axeY2)}"
          stroke="${c.blue}" stroke-width="5" stroke-linecap="round" opacity="0.95" />
    <line x1="${px(DIAG_TOP.x + nx * 14)}" y1="${px(DIAG_TOP.y + ny * 14)}"
          x2="${px(DIAG_BOT.x + nx * 14)}" y2="${px(DIAG_BOT.y + ny * 14)}"
          stroke="${c.cyan}" stroke-width="1.4" stroke-linecap="round" opacity="0.5" />
    ${renderCircuitDecor(seedStr)}
  `;
}