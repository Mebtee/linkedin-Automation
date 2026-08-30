// ─── Deterministic Seeded Randomness ─────────────────────────────────────────
// The background decoration must vary per post while staying deterministic:
// the same seed always yields the same pattern and no `Math.random()` is used.
// A FNV-1a string hash feeds a mulberry32 PRNG.

/** FNV-1a 32-bit string hash → deterministic seed from arbitrary text. */
export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * mulberry32 — small, fast, deterministic PRNG. Returns a function producing
 * floats in [0, 1). Same seed → same sequence, every time.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}