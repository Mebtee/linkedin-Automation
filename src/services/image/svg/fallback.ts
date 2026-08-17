import { brand } from "@/config/brand";
import { escapeXml } from "./escape";

// ─── Fallback SVG Generator ─────────────────────────────────────────────────
// Generates a minimal branded SVG when the main template fails.
// Always succeeds — no external dependencies.

/**
 * Generates a minimal fallback SVG with core branding.
 * Used when BrandedSvgProvider templates throw an error.
 */
export function generateFallbackSvg(options: {
  readonly dayNumber: number;
  readonly topic: string;
}): string {
  const c = brand.colors;
  const { dayNumber, topic } = options;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${brand.image.width} ${brand.image.height}" width="${brand.image.width}" height="${brand.image.height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c.navy}" />
      <stop offset="100%" stop-color="${c.blue}" />
    </linearGradient>
  </defs>
  <rect width="${brand.image.width}" height="${brand.image.height}" fill="url(#bg)" />
  <text x="${brand.image.width / 2}" y="100" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="24"
        font-weight="600" letter-spacing="4" fill="${c.cyan}" opacity="0.9">
    ${escapeXml(brand.series)}
  </text>
  <text x="${brand.image.width / 2}" y="${brand.image.height / 2 - 20}"
        text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="140" font-weight="900" fill="white" opacity="0.15">
    ${dayNumber}
  </text>
  <text x="${brand.image.width / 2}" y="${brand.image.height / 2 + 40}"
        text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="64" font-weight="800" fill="white">
    DAY ${dayNumber} / ${brand.totalDays}
  </text>
  <text x="${brand.image.width / 2}" y="${brand.image.height / 2 + 110}"
        text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="32" font-weight="500" fill="${c.cyan}">
    ${escapeXml(topic)}
  </text>
  <line x1="${brand.image.width / 2 - 60}" y1="${brand.image.height - 80}"
        x2="${brand.image.width / 2 + 60}" y2="${brand.image.height - 80}"
        stroke="${c.cyan}" stroke-width="1" opacity="0.3" />
  <text x="${brand.image.width / 2}" y="${brand.image.height - 50}"
        text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="14" font-weight="500" letter-spacing="2" fill="${c.cyan}" opacity="0.6">
    105 DLJ
  </text>
</svg>`;
}
