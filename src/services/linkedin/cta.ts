import type { PostFormat } from "@/types/ai";
import { content } from "@/config/content";

// ─── Deterministic Call-to-Action (Phase 5I) ─────────────────────────────────
// A small, authentic close for published posts. Selected deterministically from
// the post format (never random), appended exactly once at the end of the
// published text — never inside the technical body and never duplicated.
// Variants are genuine conversation invites: no engagement bait, no fake
// controversy, no excessive emoji.

/**
 * Selects the CTA line for a post format. Uses a dedicated variant when one
 * exists for the format, otherwise falls back to the generic close.
 * Deterministic: the same format always maps to the same line.
 */
export function selectCta(format: PostFormat): string {
  const v = content.cta.variants[format] ?? content.cta.variants.default;
  return v;
}
