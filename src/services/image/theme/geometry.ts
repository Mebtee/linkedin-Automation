import { brand } from "@/config/brand";

// ─── Theme Geometry (Phase 5I professional redesign) ─────────────────────────
// Single source of layout truth for the 1600×900 branded canvas. All coordinates
// for the background, content zone, branding layer and compositors derive from
// these constants so nothing hard-codes a raw pixel value.
//
// Layout model:
//   ┌───────────────────────────────┐
//   │  LIGHT (content)  │  NAVY (branding)
//   │  x:[LIGHT_LEFT..LIGHT_RIGHT]  │  diagonal from DIAG_TOP to DIAG_BOT
//   │  headline/support/visual      │  TB logo at LOGO
//   └───────────────────────────────┘
//
// Safe area (spec §14): ≥80px horizontal, ≥60px vertical that the logo also
// respects. Content zone right edge sits comfortably left of the diagonal so
// the foreground never bleeds into the navy block.

export const CANVAS_W = brand.image.width;
export const CANVAS_H = brand.image.height;
export const CANVAS_CX = CANVAS_W / 2;

/** Left edge of the content zone (≥80px safe margin). */
export const LIGHT_LEFT = 100;
/** Right edge of the content zone (well left of the diagonal at content heights). */
export const LIGHT_RIGHT = 940;
/** Horizontal center of the content zone. */
export const LIGHT_CX = (LIGHT_LEFT + LIGHT_RIGHT) / 2;
/** Usable width of the content zone. */
export const LIGHT_WIDTH = LIGHT_RIGHT - LIGHT_LEFT;

/** Top edge of the diagonal divider (upper-middle/right). */
export const DIAG_TOP = { x: 1104, y: 0 } as const;
/** Bottom edge of the diagonal divider (lower-middle/left). */
export const DIAG_BOT = { x: 856, y: CANVAS_H } as const;

/** x of the diagonal at a given y (linear interpolation). */
export function diagonalXAt(y: number): number {
  const t = y / CANVAS_H;
  return DIAG_TOP.x + (DIAG_BOT.x - DIAG_TOP.x) * t;
}

/** True when a point lies inside the navy (right/below diagonal) region. */
export function inNavyRegion(x: number, y: number): boolean {
  return x > diagonalXAt(y) + 8;
}

/** TB logo placement — lower-right, inside the navy section, inside safe margins. */
export const LOGO = { x: 1280, y: 624, width: 200, height: 200 } as const;

/** Technical signal tag anchor (top-right of the navy region). */
export const SIGNAL_TAG_X = CANVAS_W - 86;
export const SIGNAL_TAG_Y = 128;

/** Footer brand mark (bottom-left of the light zone). */
export const FOOTER_X = LIGHT_LEFT;
export const FOOTER_LINE1_Y = CANVAS_H - 66;
export const FOOTER_LINE2_Y = CANVAS_H - 42;

/** Minimal safe margins asserted by the layout tests. */
export const SAFE_H = 80;
export const SAFE_V = 60;