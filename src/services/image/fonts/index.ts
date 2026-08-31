import { readFile } from "node:fs/promises";
import { join } from "node:path";

// ─── Bundled Font (Inter Latin, woff2) ──────────────────────────────────────
// Loads the Inter font family from the project's public/fonts/ directory and
// produces a self-contained <style> block with @font-face declarations that
// embed the font data as base64 data URIs. This guarantees text renders correctly
// in any Sharp/librsvg environment (including headless Linux/Vercel serverless)
// without depending on system-installed fonts.
//
// The module preloads all weights at startup (memoized). A sync getter
// (`getEmbeddedFontStyle()`) returns the cached <style> block so rendering
// functions remain synchronous.

const FONT_FAMILY = "Inter";

const WEIGHTS = [400, 500, 600, 700, 800] as const;

interface FontEntry {
  readonly weight: number;
  readonly dataUri: string;
}

let cachedStyle: string | null = null;

async function loadFonts(): Promise<string> {
  const entries: FontEntry[] = [];
  for (const weight of WEIGHTS) {
    const fileName = `inter-latin-${weight}-normal.woff2`;
    const filePath = join(process.cwd(), "public", "fonts", fileName);
    const bytes = await readFile(filePath);
    const base64 = bytes.toString("base64");
    entries.push({ weight, dataUri: `data:font/woff2;base64,${base64}` });
  }
  const declarations = entries
    .map(
      (f) =>
        `@font-face{font-family:'${FONT_FAMILY}';font-style:normal;font-weight:${f.weight};font-display:swap;src:url(${f.dataUri}) format('woff2');}`,
    )
    .join("\n");
  return `<style>${declarations}</style>`;
}

let initPromise: Promise<string> | null = null;

/**
 * Initializes the embedded font cache. Must be called (and awaited) before
 * any SVG rendering occurs. Idempotent — safe to call multiple times.
 */
export async function initEmbeddedFont(): Promise<string> {
  if (cachedStyle) return cachedStyle;
  if (!initPromise) {
    initPromise = loadFonts().then((style) => {
      cachedStyle = style;
      return style;
    });
  }
  return initPromise;
}

/**
 * Returns the cached <style> block. Returns an empty string if
 * `initEmbeddedFont()` has not been called yet (safe fallback).
 */
export function getEmbeddedFontStyle(): string {
  return cachedStyle ?? "";
}

/** The font-family value used in all SVG text elements. */
export const SVG_FONT_FAMILY = `${FONT_FAMILY}, Arial, Helvetica, sans-serif`;

/** Test hook — clears the memoized font cache. */
export function resetFontCache(): void {
  cachedStyle = null;
  initPromise = null;
}
