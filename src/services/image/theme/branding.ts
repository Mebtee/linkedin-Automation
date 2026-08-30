import { brand } from "@/config/brand";
import { escapeXml } from "../svg/escape";
import type { LogoEmbed } from "../logo";
import { FOOTER_LINE1_Y, FOOTER_LINE2_Y, FOOTER_X, LOGO } from "./geometry";

// ─── Branding Layer (Phase 5I) ───────────────────────────────────────────────
// Third SVG layer: the TB personal-brand signature (lower-right, inside the navy
// block) plus a restrained footer mark (bottom-left of the light zone). The logo
// is the user-supplied asset, never recreated: when the asset is unavailable the
// layer degrades to a plain "TB" monogram so rendering never throws.

const c = brand.colors;
const FONT = "Arial, Helvetica, sans-serif";

/** TB logo image preserving the square asset's aspect ratio (spec §2/§10). */
export function renderLogo(logo: LogoEmbed | null): string {
  const x = LOGO.x;
  const y = LOGO.y;
  const w = LOGO.width;
  const h = LOGO.height;
  if (!logo) {
    // Degraded text mark — only when the asset could not be loaded.
    return `
      <rect x="${x}" y="${y + 40}" width="${w}" height="${h - 80}" rx="28"
            fill="#0B2E5F" stroke="#1E4C96" stroke-width="1" />
      <text x="${x + w / 2}" y="${y + (h - 80) / 2 + 62}" text-anchor="middle"
            font-family="${FONT}" font-size="96" font-weight="800"
            letter-spacing="4" fill="#FFFFFF">TB</text>`;
  }
  return `
    <image x="${x}" y="${y}" width="${w}" height="${h}"
           href="${logo.dataUri}" preserveAspectRatio="xMidYMid meet" />`;
}

/** Restrained footer mark: brand mark + series line (bottom-left light zone). */
export function renderFooterMark(): string {
  return [
    `<text x="${FOOTER_X}" y="${FOOTER_LINE1_Y}" text-anchor="start" font-family="${FONT}" font-size="16" font-weight="800" letter-spacing="3" fill="${c.text}">105 DLJ</text>`,
    `<text x="${FOOTER_X}" y="${FOOTER_LINE2_Y}" text-anchor="start" font-family="${FONT}" font-size="14" font-weight="600" letter-spacing="2" fill="${c.muted}">${escapeXml(brand.series)}</text>`,
  ].join("");
}

/** Complete branding layer: logo (navy) + footer mark (light zone). */
export function renderBranding(logo: LogoEmbed | null): string {
  return renderLogo(logo) + renderFooterMark();
}