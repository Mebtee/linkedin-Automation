import { describe, it, expect } from "vitest";

import { computeContentHash } from "./validation";

describe("computeContentHash", () => {
  it("returns a 64-character hex string", async () => {
    const bytes = new TextEncoder().encode("test content for hashing");
    const hash = await computeContentHash(bytes);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same input produces same hash", async () => {
    const bytes = new TextEncoder().encode("deterministic test");
    const hash1 = await computeContentHash(bytes);
    const hash2 = await computeContentHash(bytes);
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different content", async () => {
    const hash1 = await computeContentHash(new TextEncoder().encode("content A"));
    const hash2 = await computeContentHash(new TextEncoder().encode("content B"));
    expect(hash1).not.toBe(hash2);
  });

  it("handles empty input", async () => {
    const hash = await computeContentHash(new Uint8Array(0));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles binary data", async () => {
    const bytes = new Uint8Array([0, 1, 2, 255, 128, 64]);
    const hash = await computeContentHash(bytes);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not modify the input bytes", async () => {
    const original = new Uint8Array([1, 2, 3, 4, 5]);
    const copy = new Uint8Array(original);
    await computeContentHash(original);
    expect(original).toEqual(copy);
  });
});
