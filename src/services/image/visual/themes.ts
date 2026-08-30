import type {
  VisualTheme,
  VisualComposition,
  VisualKeyPoint,
} from "@/types/image";

// ─── Visual Theme Selection (Phase 5G) ───────────────────────────────────────
// Deterministically maps a post to a visual theme and composition. The mapping
// is purely content-driven (post type + keywords) with no randomness — the same
// post always yields the same theme and the same composition, while different
// posts naturally diverge.

// ─── Theme selection ─────────────────────────────────────────────────────────

export interface ThemeInput {
  readonly postType?: string | null;
  readonly format?: string;
  /** Lower-cased space-separated keywords extracted from the post. */
  readonly text: string;
  readonly topic: string;
}

const THEME_KEYWORDS: ReadonlyArray<readonly [VisualTheme, readonly string[]]> = [
  ["security", ["security", "authorization", "authentication", "oauth", "jwt", "rls", "encryption", "privacy", "secret", "threat", "vulnerability", "password"]],
  ["problem-solving", ["problem", "bug", "debug", "error", "issue", "failed", "fix", "root cause", "troubleshoot", "bottleneck", "investigate"]],
  ["project-build", ["project", "built", "build", "implement", "architecture", "workflow", "pipeline", "deploy", "integration", "showcase"]],
  ["technical-explanation", ["api", "database", "index", "query", "request", "response", "react", "next.js", "function", "component", "state", "model", "schema", "how it works"]],
  ["career-growth", ["career", "job", "interview", "portfolio", "growth", "progress", "resume", "skill"]],
  ["reflection", ["lesson", "reflect", "learned", "takeaway", "changed", "insight", "realized"]],
  ["achievement", ["milestone", "achieved", "completed", "ship", "launched", "win", "success"]],
  ["learning-concept", ["learning", "learn", "concept", "understand", "explain", "fundamentals", "basics", "introduction", "taught", "study"]],
];

export function selectTheme(input: ThemeInput): VisualTheme {
  // 1. Post type (Phase 5A taxonomy) — strongest, explicit signal.
  if (input.postType) {
    const theme = themeForPostType(input.postType);
    if (theme) return theme;
  }

  // 2. Content keyword match (deterministic first-match wins).
  const combined = `${input.text} ${input.topic}`.toLowerCase();
  for (const [theme, keywords] of THEME_KEYWORDS) {
    if (keywords.some((k) => combined.includes(k))) {
      return theme;
    }
  }

  // 3. Default to learning framing — never fabricates personal claims.
  return "learning-concept";
}

function themeForPostType(postType: string): VisualTheme | null {
  switch (postType) {
    case "PROJECT_SHOWCASE":
    case "API_INTEGRATION":
    case "AI_ENGINEERING":
    case "ENGINEERING_DECISION":
    case "DEPLOYMENT_STORY":
      return "project-build";
    case "PROBLEM_SOLUTION":
    case "DEBUGGING_STORY":
      return "problem-solving";
    case "TECHNICAL_LESSON":
    case "LEARNING_MILESTONE":
      return "learning-concept";
    case "SECURITY_LESSON":
      return "security";
    case "DATABASE_ENGINEERING":
      return "technical-explanation";
    case "CAREER_PROGRESS":
      return "career-growth";
    default:
      return null;
  }
}

// ─── Composition selection ───────────────────────────────────────────────────

export interface CompositionInput {
  readonly theme: VisualTheme;
  readonly postType?: string | null;
  readonly keyPointCount: number;
  readonly text: string;
}

export function selectComposition(input: CompositionInput): VisualComposition {
  // Post-type refinement first.
  if (input.postType) {
    const c = compositionForPostType(input.postType);
    if (c) return c;
  }

  switch (input.theme) {
    case "security":
      return "before-after";
    case "problem-solving":
      return "problem-solution";
    case "project-build":
      return "architecture-flow";
    case "technical-explanation":
      return "concept-flow";
    case "career-growth":
      return "skill-progression";
    case "achievement":
      return "skill-progression";
    case "reflection":
      return "three-ideas";
    case "learning-concept":
    default:
      return input.keyPointCount >= 3 ? "three-ideas" : "concept-flow";
  }
}

function compositionForPostType(postType: string): VisualComposition | null {
  switch (postType) {
    case "PROBLEM_SOLUTION":
    case "DEBUGGING_STORY":
      return "problem-solution";
    case "SECURITY_LESSON":
      return "before-after";
    case "PROJECT_SHOWCASE":
    case "API_INTEGRATION":
      return "architecture-flow";
    case "CAREER_PROGRESS":
      return "skill-progression";
    case "DATABASE_ENGINEERING":
    case "TECHNICAL_LESSON":
    case "AI_ENGINEERING":
      return "concept-flow";
    default:
      return null;
  }
}

// ─── Shared rendering helpers used by compositions ───────────────────────────

/**
 * Picks up to `max` key points, truncating long labels so the layout never
 * overflows. Empty optional fields are dropped rather than invented.
 */
export function clampKeyPoints(points: readonly VisualKeyPoint[], max: number): VisualKeyPoint[] {
  return points
    .map((p) => ({
      label: truncate(p.label, 26),
      detail: truncate(p.detail, 44),
    }))
    .filter((p) => p.label.trim() !== "")
    .slice(0, max);
}

/** Truncates a string to a maximum length with an ellipsis. */
export function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}
