import { createHash } from "crypto";

// ─── Content Hashing ─────────────────────────────────────────────────────────

/**
 * Normalizes post content for deterministic hashing.
 *
 * Normalization:
 *   1. Trims whitespace from each text field
 *   2. Sorts hashtags alphabetically (case-insensitive)
 *   3. Concatenates fields with a separator
 *   4. Lowercases the entire string
 *
 * Same content → same hash, regardless of:
 *   - Timestamps
 *   - Provider metadata
 *   - Random IDs
 *   - Whitespace variations
 */
export function normalizePostContent(content: {
  readonly opening: string;
  readonly body: string;
  readonly takeaway: string;
  readonly nextStep: string;
  readonly hashtags: readonly string[];
}): string {
  const opening = content.opening.trim().toLowerCase();
  const body = content.body.trim().toLowerCase();
  const takeaway = content.takeaway.trim().toLowerCase();
  const nextStep = content.nextStep.trim().toLowerCase();
  const sortedHashtags = [...content.hashtags]
    .map((h) => h.trim().toLowerCase())
    .sort();

  return [opening, body, takeaway, nextStep, sortedHashtags.join(",")].join("|||");
}

/**
 * Creates a deterministic SHA-256 hash of post content.
 *
 * The hash is used for duplicate detection:
 *   - Same content → same hash
 *   - Different content → different hash
 *   - Does NOT include timestamps, provider info, or random IDs
 */
export function createContentHash(content: {
  readonly opening: string;
  readonly body: string;
  readonly takeaway: string;
  readonly nextStep: string;
  readonly hashtags: readonly string[];
}): string {
  const normalized = normalizePostContent(content);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
