import type { VisualBrief } from "@/types/image";
import type { LogoEmbed } from "./logo";

import { brand } from "@/config/brand";
import { renderBranding } from "./theme/branding";
import { renderTakeawaysPanel } from "./theme/takeaways-panel";
import { renderCircuitDecor } from "./theme/circuit";
import { getEmbeddedFontStyle, initEmbeddedFont } from "./fonts";

// ─── Gemini Branding Compositor ─────────────────────────────────────────────
// Takes a raw AI-generated PNG (from the Gemini provider) and composites the
// permanent TB branding on top using Sharp.
//
// Layout:
//   ┌──────────────────────────────┬──────────────────────┐
//   │  AI-generated visual fills   │  navy diagonal wedge │
//   │  the full canvas (cover)     │  + KEY TAKEAWAYS     │
//   │                              │  + TB logo + footer  │
//   └──────────────────────────────┴──────────────────────┘
//
// The AI art is cover-filled edge-to-edge as a photographic cover. The navy
// diagonal wedge + accent line + circuit decor are drawn ON TOP of it via an SVG
// overlay, so the series' signature diagonal split is preserved while the AI art
// shows through the light zone. The KEY TAKEAWAYS panel, TB logo and footer mark
// are also part of the overlay.
//
// Determinism note: the AI art itself is non-deterministic (Gemini), but the
// branding chrome geometry is fixed and its circuit decor is seed-driven; the
// same seed yields the same decoration.

interface ComposeOptions {
  /** Raw AI PNG bytes (any size; cover-fitted to the canvas). */
  readonly basePng: Uint8Array;
  /** Evidence-safe visual summary for the navy KEY TAKEAWAYS panel. */
  readonly brief: VisualBrief;
  /** Final output dimensions (brand.image = 1600×900). */
  readonly width: number;
  readonly height: number;
  /** TB logo embed (may be null → text monogram). */
  readonly logo?: LogoEmbed | null;
  /** Deterministic seed for the circuit decoration. */
  readonly seed: string;
}

/**
 * Composites branded chrome over an AI-generated PNG and returns the final PNG
 * bytes. Throws on failure so the provider can fall back to the SVG pipeline.
 */
export async function composeBrandedImage(
  options: ComposeOptions,
): Promise<Uint8Array> {
  const { basePng, brief, width, height, logo, seed } = options;

  const sharp = (await import("sharp")).default;

  // AI visual becomes the base layer, cover-filled to the canvas.
  const base = await sharp(Buffer.from(basePng))
    .resize(width, height, { fit: "cover", position: "attention" })
    .png()
    .toBuffer();

  // Branding chrome overlay (navy wedge absent from the light zone).
  await initEmbeddedFont();
  const overlaySvg = buildOverlaySvg(brief, logo, seed, width, height);

  const out = await sharp(base)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png()
    .toBuffer();

  return new Uint8Array(out);
}

/**
 * Builds the SVG overlay: navy diagonal wedge + accent line + circuit decor
 * painted over the AI image, plus the navy KEY TAKEAWAYS panel, the TB logo, and
 * the footer mark. The light zone is left transparent so the AI art shows
 * through beneath the wedge.
 */
function buildOverlaySvg(
  brief: VisualBrief,
  logo: LogoEmbed | null | undefined,
  seed: string,
  width: number,
  height: number,
): string {
  const navy = renderNavyChrome(seed);
  const takeaways = renderTakeawaysPanel(brief.keyTakeaways);
  const branding = renderBranding(logo ?? null);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  ${getEmbeddedFontStyle()}
  ${navy}
  ${takeaways}
  ${branding}
</svg>`;
}

/**
 * Renders the navy branding chrome (diagonal wedge + electric-blue accent +
 * circuit decor) WITHOUT the opaque light-rect fill, so the composited AI visual
 * serves as the light backdrop. Geometry matches `renderBrandedBackground`.
 */
function renderNavyChrome(seed: string): string {
  const c = brand.colors;
  const w = brand.image.width;
  const h = brand.image.height;
  const DIAG_TOP = { x: 1104, y: 0 };
  const DIAG_BOT = { x: 856, y: h };

  const dx = DIAG_BOT.x - DIAG_TOP.x;
  const dy = DIAG_BOT.y - DIAG_TOP.y;
  const len = Math.hypot(dx, dy);
  const off = 7;
  const nx = dy / len;
  const ny = -dx / len;

  const defs = `
    <defs>
      <linearGradient id="bgNavyComp" x1="0" y1="0" x2="0.42" y2="1">
        <stop offset="0%" stop-color="${c.navy}" />
        <stop offset="62%" stop-color="#0A2450" />
        <stop offset="100%" stop-color="#0B2E5F" />
      </linearGradient>
    </defs>`;

  const wedge = `
    <path
      d="M ${w} 0 L ${DIAG_TOP.x} 0 L ${DIAG_BOT.x} ${DIAG_BOT.y} L ${w} ${DIAG_BOT.y} Z"
      fill="url(#bgNavyComp)"
    />`;

  const accent = [
    `<line x1="${px(DIAG_TOP.x + nx * off)}" y1="${px(DIAG_TOP.y + ny * off)}"
           x2="${px(DIAG_BOT.x + nx * off)}" y2="${px(DIAG_BOT.y + ny * off)}"
           stroke="${c.blue}" stroke-width="5" stroke-linecap="round" opacity="0.95" />`,
    `<line x1="${px(DIAG_TOP.x + nx * 14)}" y1="${px(DIAG_TOP.y + ny * 14)}"
           x2="${px(DIAG_BOT.x + nx * 14)}" y2="${px(DIAG_BOT.y + ny * 14)}"
           stroke="${c.cyan}" stroke-width="1.4" stroke-linecap="round" opacity="0.5" />`,
  ].join("");

  const circuit = renderCircuitDecor(seed);

  return `${defs}${wedge}${accent}${circuit}`;
}

function px(v: number): string {
  return v.toFixed(1);
}
