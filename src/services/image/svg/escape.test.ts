import { describe, it, expect } from "vitest";
import { escapeXml, checkSvgSafety } from "./escape";

describe("escapeXml", () => {
  it("escapes ampersand", () => {
    expect(escapeXml("A & B")).toBe("A &amp; B");
  });

  it("escapes less-than", () => {
    expect(escapeXml("A < B")).toBe("A &lt; B");
  });

  it("escapes greater-than", () => {
    expect(escapeXml("A > B")).toBe("A &gt; B");
  });

  it("escapes double quotes", () => {
    expect(escapeXml('A "B" C')).toBe("A &quot;B&quot; C");
  });

  it("escapes single quotes", () => {
    expect(escapeXml("A 'B' C")).toBe("A &apos;B&apos; C");
  });

  it("escapes multiple special characters", () => {
    expect(escapeXml('<script>alert("xss")&</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&amp;&lt;/script&gt;"
    );
  });

  it("returns plain text unchanged", () => {
    expect(escapeXml("Hello World")).toBe("Hello World");
  });

  it("handles empty string", () => {
    expect(escapeXml("")).toBe("");
  });
});

describe("checkSvgSafety", () => {
  it("returns null for safe SVG", () => {
    const svg = '<svg><text>Hello</text></svg>';
    expect(checkSvgSafety(svg)).toBeNull();
  });

  it("detects script tags", () => {
    expect(checkSvgSafety('<svg><script>alert("xss")</script></svg>')).not.toBeNull();
  });

  it("detects foreignObject", () => {
    expect(checkSvgSafety('<svg><foreignObject><div>bad</div></foreignObject></svg>')).not.toBeNull();
  });

  it("detects iframe", () => {
    expect(checkSvgSafety('<svg><iframe src="evil.com"></iframe></svg>')).not.toBeNull();
  });

  it("detects javascript: protocol", () => {
    expect(checkSvgSafety('<svg><text href="javascript:alert(1)">click</text></svg>')).not.toBeNull();
  });

  it("detects external image URLs in src", () => {
    expect(checkSvgSafety('<svg><image src="https://evil.com/img.png" /></svg>')).not.toBeNull();
  });

  it("detects external URLs in href", () => {
    expect(checkSvgSafety('<svg><a href="https://evil.com">click</a></svg>')).not.toBeNull();
  });

  it("detects data:text/html", () => {
    expect(checkSvgSafety('<svg><text href="data:text/html,<script>alert(1)</script>">x</text></svg>')).not.toBeNull();
  });

  it("detects object tags", () => {
    expect(checkSvgSafety('<svg><object data="evil.swf"></object></svg>')).not.toBeNull();
  });

  it("detects embed tags", () => {
    expect(checkSvgSafety('<svg><embed src="evil.swf" /></svg>')).not.toBeNull();
  });
});
