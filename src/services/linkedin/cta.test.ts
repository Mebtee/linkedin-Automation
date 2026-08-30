import { describe, it, expect } from "vitest";
import { selectCta } from "./cta";
import { VALID_POST_FORMATS } from "@/types/generated-post";

describe("selectCta", () => {
  it("returns a deterministic line for every valid post format", () => {
    const seen = new Set<string>();
    for (const format of VALID_POST_FORMATS) {
      const cta = selectCta(format);
      expect(cta).toBeTruthy();
      expect(cta.trim().length).toBeGreaterThan(0);
      // Same format → same line, every time.
      expect(selectCta(format)).toBe(cta);
      seen.add(cta);
    }
  });

  it("returns the default line for an unknown format", () => {
    const fallback = "Have an idea, question, or a different approach? Share it in the comments or DM me — I'd love to hear your thoughts.";
    expect(selectCta("unknown" as never)).toBe(fallback);
  });

  it("maps each post format to its own distinct line", () => {
    const lines = VALID_POST_FORMATS.map((f) => selectCta(f));
    expect(new Set(lines).size).toBe(VALID_POST_FORMATS.length);
  });

  it("line reads as a genuine invite — no engagement bait or controversy", () => {
    for (const format of VALID_POST_FORMATS) {
      const cta = selectCta(format).toLowerCase();
      expect(cta).not.toMatch(/\b(retweet|repost|tag .* friend|like this|follow)\b/);
      expect(cta).not.toMatch(/controvers|unpopular opinion|everyone's wrong/);
    }
  });
});