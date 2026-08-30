import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { brand } from "@/config/brand";

// ─── TB Logo Embed (Phase 5I) ────────────────────────────────────────────────
// Loads the user-supplied TB logo (`brand.mark`, a 1254×1254 PNG with a navy
// background) and prepares a self-contained embed point:
//   1. make the navy background transparent (chroma-key from the corner color)
//   2. downscale to the display size (200px)
//   3. encode as an optimized PNG data URI
// The result is memoized: one deterministic embed per process, inlined into
// every SVG so the raster pipeline (Sharp → PNG) needs no external file, and the
// stored SVG stays fully self-contained. Returns null (never throws) when the
// asset is missing so providers can degrade to the text monogram.

export interface LogoEmbed {
  /** base64 data URI (PNG, transparent background) for `<image href>`. */
  readonly dataUri: string;
  /** Display width in pixels (square asset → square display). */
  readonly width: number;
  /** Display height in pixels. */
  readonly height: number;
  /** Aspect ratio (width / height) preserved from the source. */
  readonly aspect: number;
}

const DISPLAY_SIZE = 200;

/** Distance of a pixel's RGB from the logo's navy background color. */
function bgDistance(px: [number, number, number], bg: [number, number, number]): number {
  return Math.sqrt((px[0] - bg[0]) ** 2 + (px[1] - bg[1]) ** 2 + (px[2] - bg[2]) ** 2);
}

/**
 * Builds the transparent, downscaled logo PNG buffer. Pure per byte array so it
 * is deterministic: identical input bytes → identical output bytes.
 */
export function buildLogoPngBytes(
  sourceBytes: Uint8Array,
  size = DISPLAY_SIZE,
): Promise<Uint8Array> {
  return makeLogoPng(sourceBytes, size);
}

// Memoized promise: computed once per process, reused for every image.
let memoized: Promise<LogoEmbed | null> | null = null;

/** Loads the branded TB logo once (memoized). Never rejects — returns null. */
export async function loadLogoEmbed(): Promise<LogoEmbed | null> {
  if (!memoized) {
    memoized = loadLogoEmbedUncached().catch(() => null);
  }
  return memoized;
}

/** Test hook — clears the memoized loader. */
export function resetLogoEmbedCache(): void {
  memoized = null;
}

async function loadLogoEmbedUncached(): Promise<LogoEmbed | null> {
  const bytes = await readFile(join(process.cwd(), brand.mark));
  const pngBytes = await makeLogoPng(bytes, DISPLAY_SIZE);
  const base64 = Buffer.from(pngBytes).toString("base64");
  return {
    dataUri: `data:image/png;base64,${base64}`,
    width: DISPLAY_SIZE,
    height: DISPLAY_SIZE,
    aspect: 1,
  };
}

async function makeLogoPng(sourceBytes: Uint8Array, size: number): Promise<Uint8Array> {
  const sharp = (await import("sharp")).default;
  const raw = await sharp(Buffer.from(sourceBytes)).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  const { width, height, channels } = info;
  if (channels < 3) throw new Error("Logo must have an RGB(A) source");

  const corner: [number, number, number] = [
    data[0]!,
    data[1]!,
    data[2]!,
  ];
  const THRESHOLD = 52;
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const src = i * channels;
    const dst = i * 4;
    const px: [number, number, number] = [data[src]!, data[src + 1]!, data[src + 2]!];
    out[dst] = px[0];
    out[dst + 1] = px[1];
    out[dst + 2] = px[2];
    const navyLike = px[0] < 26 && px[1] < 44 && px[2] < 92;
    out[dst + 3] = navyLike || bgDistance(px, corner) <= THRESHOLD ? 0 : 255;
  }

  const rgba = await sharp(out, { raw: { width, height, channels: 4 } })
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  return new Uint8Array(rgba);
}