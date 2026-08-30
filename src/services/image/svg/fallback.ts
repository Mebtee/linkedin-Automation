import { brand } from "@/config/brand";
import { escapeXml } from "./escape";
import type { LogoEmbed } from "../logo";
import { renderBrandedBackground } from "../theme/background";
import { renderBranding } from "../theme/branding";
import { hashSeed } from "../theme/seeded";
import { LIGHT_CX } from "../theme/geometry";

// ─── Fallback SVG Generator ─────────────────────────────────────────────────
// Generates a minimal branded SVG when the main template fails. Uses the same
// Phase 5I background + branding so a fallback is visually consistent with the
// feed. Always succeeds — only the logo embed is optional.

/**
 * Generates a minimal fallback SVG with core branding.
 * Used when BrandedSvgProvider templates throw an error.
 */
export function generateFallbackSvg(options: {
  readonly dayNumber: number;
  readonly topic: string;
}, logo: LogoEmbed | null = null): string {
  const c = brand.colors;
  const { dayNumber, topic } = options;
  const bg = renderBrandedBackground(hashSeed(`fallback:${topic}:${dayNumber}`).toString());

  const content = `
    <text x="${LIGHT_CX}" y="128" text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif" font-size="15"
          font-weight="700" letter-spacing="4" fill="${c.muted}">
      ${escapeXml(brand.series)}
    </text>
    <text x="${LIGHT_CX}" y="270" text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif" font-size="150"
          font-weight="900" fill="${c.navy}" opacity="0.06">
      ${dayNumber}
    </text>
    <text x="${LIGHT_CX}" y="352" text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif" font-size="58"
          font-weight="800" fill="${c.text}">
      DAY ${dayNumber} / ${brand.totalDays}
    </text>
    <text x="${LIGHT_CX}" y="414" text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif" font-size="26"
          font-weight="500" fill="${c.blue}">
      ${escapeXml(topic)}
    </text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${brand.image.width} ${brand.image.height}" width="${brand.image.width}" height="${brand.image.height}">
  ${bg}
  ${content}
  ${renderBranding(logo)}
</svg>`;
}