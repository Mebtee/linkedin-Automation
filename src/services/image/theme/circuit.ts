import { brand } from "@/config/brand";
import { mulberry32, hashSeed } from "./seeded";

// ─── Circuit Decorations (Phase 5I) ─────────────────────────────────────────
// Sparse, low-contrast circuit-board style lines + nodes around the diagonal
// boundary. Purely decorative: deterministic (seeded PRNG), few elements, and
// the design reads correctly if they are stripped entirely (spec §11).

const c = brand.colors;

interface Fragment {
  readonly points: Array<{ readonly x: number; readonly y: number }>;
  readonly color: string;
  readonly opacity: number;
}

/**
 * Deterministic circuit traces hugging the diagonal: faint gray traces on the
 * light side, thin cyan/blue traces + nodes on the navy side. All coordinates
 * stay inside the canvas. `seed` comes from the post so same input → same SVG.
 */
export function renderCircuitDecor(seedStr: string): string {
  const rand = mulberry32(hashSeed(seedStr));
  const fragments: Fragment[] = [];

  // A few sparse traces near the boundary (navy side).
  const navyTraces = 4 + Math.floor(rand() * 2);
  for (let g = 0; g < navyTraces; g += 1) {
    // Pick a y band in the middle region of the diagonal.
    const y0 = 130 + rand() * 640;
    const baseX = diagAtY(y0);
    const left = baseX + 60 + rand() * 260;
    const trace = randomTrace(
      { x: left, y: y0 },
      rand,
      2 + Math.floor(rand() * 2),
    );
    fragments.push({
      points: trace,
      color: g % 2 === 0 ? c.cyan : c.blue,
      opacity: 0.22 - rand() * 0.1,
    });
  }

  // Two very faint straight tracks on the light side, ending at the boundary.
  const lightTraces = 2;
  for (let g = 0; g < lightTraces; g += 1) {
    const y0 = 140 + rand() * 620;
    const end = diagAtY(y0) - (34 + rand() * 60);
    const start = Math.max(140, end - (90 + rand() * 90));
    fragments.push({
      points: [
        { x: start, y: y0 },
        { x: end, y: y0 },
      ],
      color: "#C9D4E4",
      opacity: 0.55,
    });
  }

  // Tiny endpoint nodes (circles) on the navy traces.
  let nodes = "";
  for (let n = 0; n < navyTraces + 1; n += 1) {
    const y0 = 110 + rand() * 660;
    const x0 = diagAtY(y0) + 90 + rand() * 300;
    const r = 2 + rand() * 2.4;
    nodes += `<circle cx="${f(x0)}" cy="${f(y0)}" r="${f(r)}" fill="${c.cyan}" opacity="${f(0.3 + rand() * 0.25)}" />`;
  }

  const traces = fragments.map((frag) => {
    const d = frag.points
      .map((p, i) => `${i === 0 ? "M" : "L"}${f(p.x)} ${f(p.y)}`)
      .join(" ");
    return `<path d="${d}" fill="none" stroke="${frag.color}" stroke-width="${f(1.1 + rand() * 0.9)}" stroke-linecap="round" stroke-linejoin="round" opacity="${f(frag.opacity)}" />`;
  }).join("");

  return `${traces}${nodes}`;
}

function randomTrace(
  start: { x: number; y: number },
  rand: () => number,
  segments: number,
): Array<{ x: number; y: number }> {
  const points = [{ x: start.x, y: start.y }];
  let x = start.x;
  let y = start.y;
  for (let s = 0; s < segments; s += 1) {
    if (rand() > 0.5) {
      x += 24 + rand() * 46;
      y += -14 + rand() * 28;
    } else {
      y += 24 + rand() * 46;
      x += -14 + rand() * 28;
    }
    points.push({ x: clamp(x, 60, 1580), y: clamp(y, 60, 860) });
  }
  return points;
}

function diagAtY(y: number): number {
  return 1104 + ((856 - 1104) * y) / 900;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function f(v: number): string {
  return v.toFixed(1);
}