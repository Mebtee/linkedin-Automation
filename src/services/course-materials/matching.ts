import type {
  CurriculumDayCandidate,
  CurriculumMatchResult,
  ExtractedPdfDocument,
} from "@/types/course-material";
import type { PageStructure } from "./extraction";
import type { CurriculumDayRow, ModuleRow } from "@/services/curriculum/dayProgress";

// ─── Curriculum Matching ────────────────────────────────────────────────────
// Deterministic matcher between extracted course material and the existing
// 105-day curriculum. The curriculum tables remain the single source of
// truth — nothing here duplicates or rewrites curriculum data.
//
// Strategy:
// 1. Explicit structural evidence ("Day 3", "Module 2") wins.
// 2. Otherwise, distinctive-term overlap ranks every curriculum day.
// Low-confidence results are never silently selected — ranked candidates are
// returned for the user to choose from.

const STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "you", "your", "will", "are",
  "can", "from", "into", "how", "what", "when", "use", "used", "using", "new",
  "all", "any", "each", "more", "most", "our", "not", "but", "has", "have",
  "been", "also", "may", "should", "would", "could", "them", "they", "its",
  "one", "two", "three", "their", "than", "then", "these", "those", "upon",
  "which", "while", "who", "why", "yet", "per", "via", "about", "after",
  "before", "between", "during", "through", "under", "over", "course",
  "lesson", "chapter", "section", "page", "figure", "table", "note", "tips",
  "summary", "objectives", "objective", "goals", "goal", "introduction",
  "contents", "overview", "part", "unit", "week", "module", "day",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9+#.-]{1,30}|\d{1,3}/g) ?? [])
    .map((t) => t.replace(/[.-]+$/, ""))
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function termSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

/** Cosine-style similarity over binary term sets. */
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const term of a) if (b.has(term)) intersection += 1;
  return intersection / (Math.sqrt(a.size) * Math.sqrt(b.size));
}

const EXPLICIT_DAY_RE = /\bday\s*(?:#|no\.?|-|:)?\s*(\d{1,3})\b/i;
const EXPLICIT_MODULE_RE = /\bmodule\s*(?:#|no\.?|-|:)?\s*(\d{1,2})\b/i;

function findExplicit(pattern: RegExp, texts: readonly string[]): number | null {
  for (const text of texts) {
    const match = pattern.exec(text);
    if (match) {
      const n = Number.parseInt(match[1]!, 10);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export type CurriculumSourceData = {
  readonly days: readonly CurriculumDayRow[];
  readonly modules: readonly ModuleRow[];
};

/**
 * Matches extracted course material to a curriculum day.
 * Pure/deterministic — no DB access, no randomness.
 */
export function matchCurriculum(
  doc: ExtractedPdfDocument,
  structures: readonly PageStructure[],
  source: CurriculumSourceData,
  totalDays: number,
): CurriculumMatchResult {
  const rationale: string[] = [];

  const fullTexts = structures.map((p) => p.text);
  const headingText = structures.map((p) => p.headings.join(" ")).join(" ");
  const bodyText = fullTexts.join(" ").slice(0, 400_000);

  // ─── 1. Explicit structural evidence ─────────────────────────────────────
  const explicitDay = findExplicit(EXPLICIT_DAY_RE, [...fullTexts.slice(0, 15), headingText]);
  const explicitModule = findExplicit(EXPLICIT_MODULE_RE, [...fullTexts.slice(0, 15), headingText]);

  if (explicitDay !== null && explicitDay >= 1 && explicitDay <= totalDays) {
    rationale.push(`Document explicitly references Day ${explicitDay}.`);
    const dayRow = source.days.find((d) => d.day_number === explicitDay);
    const moduleForDay = dayRow ? source.modules.find((m) => m.id === dayRow.module_id) : undefined;

    let confidence: CurriculumMatchResult["confidence"] = "HIGH";
    if (dayRow && moduleForDay) {
      const dayScore = similarity(termSet(bodyText), dayTermProfile(dayRow));
      if (explicitModule !== null && moduleForDay.module_number === explicitModule) {
        confidence = "EXACT";
        rationale.push(
          `Explicit Module ${explicitModule} matches the module containing Day ${explicitDay}.`,
        );
      } else if (dayScore >= 0.12) {
        confidence = "EXACT";
        rationale.push("Topic terms from the curriculum day appear in the document.");
      } else {
        rationale.push(
          "Topical overlap is limited; the explicit day reference is used as-is.",
        );
      }
    }

    return buildResult({
      dayNumber: explicitDay,
      confidence,
      explicitDay,
      explicitModule,
      rationale,
      ranked: rankDays(bodyText, headingText, source),
      source,
    });
  }

  if (explicitDay !== null) {
    rationale.push(
      `Document mentions "Day ${explicitDay}", which is outside the 1–${totalDays} range — ignoring it.`,
    );
  }

  // ─── 2. Topic-based ranking ──────────────────────────────────────────────
  let ranked = rankDays(bodyText, headingText, source);
  if (explicitModule !== null) {
    const moduleDays = new Set(
      source.days
        .filter((d) => {
          const m = source.modules.find((mm) => mm.id === d.module_id);
          return m?.module_number === explicitModule;
        })
        .map((d) => d.day_number),
    );
    if (moduleDays.size > 0) {
      rationale.push(`Document references Module ${explicitModule}; ranking its days first.`);
      ranked = [
        ...ranked.filter((c) => moduleDays.has(c.dayNumber)),
        ...ranked.filter((c) => !moduleDays.has(c.dayNumber)),
      ];
    } else {
      rationale.push(`Module ${explicitModule} was mentioned but not found in the curriculum.`);
    }
  }

  const best = ranked[0];
  const second = ranked[1];

  if (!best || best.score <= 0) {
    rationale.push("No topical overlap with any curriculum day.");
    return buildResult({
      dayNumber: null,
      confidence: "UNKNOWN",
      explicitDay,
      explicitModule,
      rationale,
      ranked: [],
      source,
    });
  }

  rationale.push(`Best topical match: Day ${best.dayNumber} (score ${best.score.toFixed(3)}).`);

  let confidence: CurriculumMatchResult["confidence"];
  if (best.score >= 0.3) confidence = "HIGH";
  else if (best.score >= 0.15) confidence = "MEDIUM";
  else confidence = "LOW";

  const ambiguous =
    second !== undefined &&
    best.score >= 0.15 &&
    best.score - second.score < 0.02;

  if (ambiguous) {
    rationale.push(
      `Close alternative: Day ${second!.dayNumber} (${second!.score.toFixed(3)}). User confirmation recommended.`,
    );
  }

  // LOW-confidence matches are never selected silently.
  if (confidence === "LOW") {
    rationale.push("Confidence too low to select a day automatically.");
    return buildResult({
      dayNumber: null,
      confidence,
      explicitDay,
      explicitModule,
      rationale,
      ranked,
      source,
    });
  }

  return buildResult({
    dayNumber: best.dayNumber,
    confidence,
    explicitDay,
    explicitModule,
    rationale,
    ranked,
    source,
  });
}

// ─── Internal ───────────────────────────────────────────────────────────────

function dayTermProfile(day: CurriculumDayRow): Set<string> {
  return termSet(
    [
      day.topic,
      (day.subtopics ?? []).join(" "),
      day.content ?? "",
    ].join(" "),
  );
}

function rankDays(
  bodyText: string,
  headingText: string,
  source: CurriculumSourceData,
): CurriculumDayCandidate[] {
  const docTerms = termSet(bodyText);
  const headingTerms = termSet(headingText);

  const scored = source.days.map((day) => {
    const profile = dayTermProfile(day);
    const bodyScore = similarity(docTerms, profile);
    // Headings carry extra signal when they overlap the day's vocabulary.
    const headingBoost = similarity(headingTerms, profile) * 0.5;
    const score = Math.min(1, bodyScore + headingBoost);

    const mod = source.modules.find((m) => m.id === day.module_id);
    return {
      dayNumber: day.day_number,
      topic: day.topic,
      moduleNumber: mod?.module_number ?? 0,
      moduleTitle: mod?.title ?? "",
      score: Number(score.toFixed(4)),
    } satisfies CurriculumDayCandidate;
  });

  return scored.sort((a, b) => b.score - a.score || a.dayNumber - b.dayNumber);
}

function buildResult(input: {
  dayNumber: number | null;
  confidence: CurriculumMatchResult["confidence"];
  explicitDay: number | null;
  explicitModule: number | null;
  rationale: string[];
  ranked: readonly CurriculumDayCandidate[];
  source: CurriculumSourceData;
}): CurriculumMatchResult {
  const { dayNumber, source } = input;
  let topic = "";
  let moduleNumber: number | null = null;
  let moduleTitle: string | null = null;

  if (dayNumber !== null) {
    const row = source.days.find((d) => d.day_number === dayNumber);
    topic = row?.topic ?? "";
    const mod = row ? source.modules.find((m) => m.id === row.module_id) : undefined;
    moduleNumber = mod?.module_number ?? null;
    moduleTitle = mod?.title ?? null;
  }

  return {
    dayNumber,
    confidence: input.confidence,
    explicitDayNumber: input.explicitDay,
    explicitModuleNumber: input.explicitModule,
    candidates: input.ranked.slice(0, 5),
    rationale: input.rationale,
    moduleNumber,
    moduleTitle,
    topic,
  };
}
