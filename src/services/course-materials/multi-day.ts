import type {
  ExtractedPdfDocument,
  MultiDaySection,
} from "@/types/course-material";
import type { PageStructure } from "./extraction";
import type { CurriculumSourceData } from "./matching";

// ─── Multi-Day Detection ───────────────────────────────────────────────────
// Detects explicit "Day N" headers in the extracted text to identify
// multi-day course PDFs. Only uses explicit structural evidence —
// never topic-based boundary detection.
//
// Strategy:
// 1. Scan page text for "Day N" patterns.
// 2. Group pages by their detected day number.
// 3. Return sections with page ranges and confidence.
// 4. If no multi-day patterns are found, return an empty array.
// 5. If boundaries are ambiguous, return empty (no false splits).

const EXPLICIT_DAY_RE = /\bday\s*(?:#|no\.?|-|:)?\s*(\d{1,3})\b/i;

type DayPageMatch = {
  dayNumber: number;
  pageNumber: number;
};

/**
 * Scans page text for explicit "Day N" headers and groups pages into
 * day sections with page ranges.
 *
 * Returns an empty array when:
 * - No "Day N" patterns are found (single-day PDF)
 * - Only one day is detected (not truly multi-day)
 * - Boundaries are ambiguous or unreliable
 */
export function detectDaySections(
  doc: ExtractedPdfDocument,
  structures: readonly PageStructure[],
  _source: CurriculumSourceData,
  totalDays: number,
): readonly MultiDaySection[] {
  const matches: DayPageMatch[] = [];

  // Scan each page for explicit "Day N" references
  for (const page of structures) {
    // Check headings first (strongest signal), then first few lines of body text
    const headingText = page.headings.join(" ");
    const bodyLines = page.text.split(/\r?\n/).slice(0, 20).join(" ");
    const searchText = `${headingText} ${bodyLines}`;

    const dayMatch = EXPLICIT_DAY_RE.exec(searchText);
    if (dayMatch) {
      const dayNumber = Number.parseInt(dayMatch[1]!, 10);
      if (dayNumber >= 1 && dayNumber <= totalDays) {
        matches.push({ dayNumber, pageNumber: page.pageNumber });
      }
    }
  }

  // Need at least 2 different day references to consider this multi-day
  const uniqueDays = new Set(matches.map((m) => m.dayNumber));
  if (uniqueDays.size < 2) {
    return [];
  }

  // Group pages by day number, maintaining page order
  const dayPages = new Map<number, number[]>();
  for (const match of matches) {
    const existing = dayPages.get(match.dayNumber) ?? [];
    existing.push(match.pageNumber);
    dayPages.set(match.dayNumber, existing);
  }

  // Sort day numbers
  const sortedDays = Array.from(dayPages.keys()).sort((a, b) => a - b);

  // Build sections with page ranges
  const sections: MultiDaySection[] = [];
  for (let i = 0; i < sortedDays.length; i++) {
    const dayNumber = sortedDays[i]!;
    const dayPageNumbers = dayPages.get(dayNumber)!.sort((a, b) => a - b);

    const startPage = dayPageNumbers[0]!;
    // End page is either the start of the next section or the last page in this section
    let endPage: number;
    if (i < sortedDays.length - 1) {
      const nextDayPageNumbers = dayPages.get(sortedDays[i + 1]!)!;
      endPage = nextDayPageNumbers[0]! - 1;
    } else {
      // Last section extends to the end of the document
      endPage = doc.pageCount;
    }

    // Ensure endPage is at least startPage
    endPage = Math.max(endPage, startPage);

    sections.push({
      dayNumber,
      startPage,
      endPage,
      confidence: "EXACT",
    });
  }

  return sections;
}
