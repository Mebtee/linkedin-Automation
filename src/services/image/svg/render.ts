import { brand } from "@/config/brand";
import { escapeXml } from "./escape";

// ─── SVG Render Scaffold ────────────────────────────────────────────────────
// Shared SVG structure for all templates.
// Provides consistent brand identity across all visual templates.

const c = brand.colors;

export interface SvgScaffoldOptions {
  readonly dayNumber: number;
  readonly topic: string;
  readonly keywords: readonly string[];
}

/**
 * Opens an SVG element with standard dimensions and background.
 */
export function openSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${brand.image.width} ${brand.image.height}" width="${brand.image.width}" height="${brand.image.height}">`;
}

/**
 * Closes an SVG element.
 */
export function closeSvg(): string {
  return "</svg>";
}

/**
 * Renders the background gradient.
 */
export function renderBackground(): string {
  return `
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c.navy}" />
        <stop offset="100%" stop-color="${c.blue}" />
      </linearGradient>
    </defs>
    <rect width="${brand.image.width}" height="${brand.image.height}" fill="url(#bg)" rx="0" />`;
}

/**
 * Renders the series title at the top.
 */
export function renderHeader(): string {
  const seriesText = escapeXml(brand.series);
  return `
    <text x="${brand.image.width / 2}" y="80" text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif" font-size="28"
          font-weight="600" letter-spacing="6" fill="${c.cyan}" opacity="0.9">
      ${seriesText}
    </text>`;
}

/**
 * Renders the large day number as the focal point.
 */
export function renderDayNumber(dayNumber: number): string {
  return `
    <text x="${brand.image.width / 2}" y="${brand.image.height / 2 - 40}"
          text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="220" font-weight="900" fill="${c.background}" opacity="0.12">
      ${dayNumber}
    </text>
    <text x="${brand.image.width / 2}" y="${brand.image.height / 2 + 30}"
          text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="72" font-weight="800" fill="white">
      DAY ${dayNumber}
    </text>
    <text x="${brand.image.width / 2}" y="${brand.image.height / 2 + 80}"
          text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="32" font-weight="400" fill="${c.cyan}">
      / ${brand.totalDays}
    </text>`;
}

/**
 * Renders the topic text.
 */
export function renderTopic(topic: string, y?: number): string {
  const yPos = y ?? brand.image.height / 2 + 140;
  return `
    <text x="${brand.image.width / 2}" y="${yPos}"
          text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="36" font-weight="600" fill="white">
      ${escapeXml(topic)}
    </text>`;
}

/**
 * Renders keywords as pill badges.
 */
export function renderKeywords(keywords: readonly string[], y?: number): string {
  const yPos = y ?? brand.image.height / 2 + 200;
  const maxDisplay = keywords.slice(0, 3);
  const totalWidth = maxDisplay.length * 180 + (maxDisplay.length - 1) * 20;
  let startX = (brand.image.width - totalWidth) / 2;

  const pills = maxDisplay.map((kw) => {
    const x = startX + 90;
    startX += 200;
    return `
      <rect x="${x - 80}" y="${yPos - 18}" width="160" height="36"
            rx="18" fill="${c.blue}" opacity="0.3" />
      <text x="${x}" y="${yPos + 5}" text-anchor="middle"
            font-family="Arial, Helvetica, sans-serif" font-size="16"
            font-weight="500" fill="${c.cyan}">
        ${escapeXml(kw)}
      </text>`;
  });

  return pills.join("");
}

/**
 * Renders the footer with brand mark.
 */
export function renderFooter(): string {
  const footerY = brand.image.height - 50;
  return `
    <line x1="${brand.image.width / 2 - 60}" y1="${footerY - 30}"
          x2="${brand.image.width / 2 + 60}" y2="${footerY - 30}"
          stroke="${c.cyan}" stroke-width="1" opacity="0.3" />
    <text x="${brand.image.width / 2}" y="${footerY}"
          text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="14" font-weight="500" letter-spacing="2" fill="${c.cyan}" opacity="0.6">
      105 DLJ
    </text>`;
}

/**
 * Renders a complete SVG scaffold with background, header, and footer.
 * Templates add their unique content between header and footer.
 */
export function renderScaffold(): string {
  return [
    openSvg(),
    renderBackground(),
    renderHeader(),
  ].join("");
}

/**
 * Closes the scaffold (adds footer + close tag).
 */
export function closeScaffold(): string {
  return [
    renderFooter(),
    closeSvg(),
  ].join("");
}
