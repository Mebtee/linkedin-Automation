import { brand } from "@/config/brand";
import { renderBrandedBackground } from "../theme/background";
import { renderBranding } from "../theme/branding";
import { renderTakeawaysPanel } from "../theme/takeaways-panel";
import { hashSeed } from "../theme/seeded";
import { getEmbeddedFontStyle } from "../fonts";
import type { LogoEmbed } from "../logo";

// ─── SVG Render Scaffold ────────────────────────────────────────────────────
// Shared SVG structure for all templates and compositions. Opens the document
// with the Phase 5I branded background (white + navy diagonal split) and closes
// it with the branding layer (KEY TAKEAWAYS panel + TB logo + footer mark).
// Deterministic; the seed only moves the sparse circuit decoration (same seed →
// same decoration).
//
// Phase 5K: an embedded Inter woff2 font is injected via @font-face data URI
// so every SVG is self-contained and renders readable text on any Sharp/librsvg
// environment without depending on system-installed fonts.

/**
 * Opens an SVG element with standard dimensions and the branded background.
 * `seed` drives the sparse circuit decoration.
 * An embedded @font-face style block is included so rasterization never
 * produces tofu/glyph-replacement boxes.
 */
export function openSvg(seed: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${brand.image.width} ${brand.image.height}" width="${brand.image.width}" height="${brand.image.height}">${getEmbeddedFontStyle()}${renderBrandedBackground(hashSeed(seed).toString())}`;
}

/**
 * Closes an SVG element after painting the branding layer. Optional `takeaways`
 * drive the navy KEY TAKEAWAYS editorial panel (skipped when empty).
 */
export function closeSvg(
  logo: LogoEmbed | null,
  takeaways?: readonly string[] | null,
): string {
  return renderTakeawaysPanel(takeaways) + renderBranding(logo) + "</svg>";
}

/** Full open scaffold: document root + branded background. */
export function renderScaffold(seed: string): string {
  return openSvg(seed);
}

/** Full close scaffold: branding layer (panel + logo + footer) + close tag. */
export function closeScaffold(
  logo: LogoEmbed | null,
  takeaways?: readonly string[] | null,
): string {
  return closeSvg(logo, takeaways);
}
