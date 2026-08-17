// ─── XML Text Escaping ──────────────────────────────────────────────────────
// Escapes characters that are special in XML/SVG text content.
// This prevents injection of markup or scripts through user-controlled text.

const XML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const XML_ESCAPE_REGEX = /[&<>"']/g;

/**
 * Escapes text for safe insertion into SVG XML text content.
 * Replaces &, <, >, ", and ' with their XML entity equivalents.
 */
export function escapeXml(text: string): string {
  return text.replace(XML_ESCAPE_REGEX, (char) => XML_ESCAPE_MAP[char] ?? char);
}

// ─── SVG Content Safety ─────────────────────────────────────────────────────
// Validates that generated SVG does not contain dangerous elements.

const FORBIDDEN_PATTERNS = [
  /<script[\s>]/i,
  /<\/script>/i,
  /<foreignObject[\s>]/i,
  /<\/foreignObject>/i,
  /<iframe[\s>]/i,
  /<\/iframe>/i,
  /<object[\s>]/i,
  /<\/object>/i,
  /<embed[\s>]/i,
  /<link[\s>]/i,
  /<meta[\s>]/i,
  /javascript:/i,
  /data:text\/html/i,
  /xlink:href\s*=\s*["']https?:/i,
  /href\s*=\s*["']https?:/i,
  /src\s*=\s*["']https?:/i,
];

/**
 * Checks whether SVG content contains potentially dangerous elements.
 * Returns null if safe, or a description of the violation if unsafe.
 */
export function checkSvgSafety(svg: string): string | null {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(svg)) {
      return `SVG contains forbidden pattern: ${pattern.source}`;
    }
  }
  return null;
}
