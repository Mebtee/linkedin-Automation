import type { ImageTemplate } from "@/types/image";
import { brand } from "@/config/brand";

// ─── Template Selector ──────────────────────────────────────────────────────
// Deterministic template selection based on post metadata and curriculum context.

/**
 * Selects an image template deterministically.
 *
 * Priority:
 * 1. Explicit template from post metadata (if valid)
 * 2. Day 105 → FINAL_MILESTONE
 * 3. Project-related days → PROJECT_FOCUSED
 * 4. Concept-heavy topics → CONCEPT_DIAGRAM
 * 5. Technical/programming topics → CODE_VISUAL
 * 6. Milestone days (every 25th) → PROGRESS
 * 7. Default → LARGE_NUMBER
 */
export function selectTemplate(options: {
  readonly explicitTemplate?: string | null;
  readonly dayNumber: number;
  readonly topic: string;
  readonly format?: string;
}): ImageTemplate {
  // 1. Explicit template if valid
  if (options.explicitTemplate && isValidTemplate(options.explicitTemplate)) {
    return options.explicitTemplate as ImageTemplate;
  }

  // 2. Day 105 always uses FINAL_MILESTONE
  if (options.dayNumber === brand.totalDays) {
    return "final-milestone";
  }

  // 3. Project-focused days
  if (
    options.format === "project" ||
    options.topic.toLowerCase().includes("project")
  ) {
    return "project-focused";
  }

  // 4. Concept-heavy topics
  const conceptKeywords = [
    "oop", "object-oriented", "solid", "design pattern", "architecture", "abstraction",
    "encapsulation", "inheritance", "polymorphism", "recursion",
  ];
  if (conceptKeywords.some((kw) => options.topic.toLowerCase().includes(kw))) {
    return "concept-diagram";
  }

  // 5. Technical/programming topics
  const techKeywords = [
    "html", "css", "javascript", "typescript", "python", "react",
    "node", "express", "sql", "git", "docker", "api", "function",
    "variable", "loop", "array", "string", "class", "dom", "hook",
    "component", "state", "routing", "middleware", "testing",
  ];
  if (techKeywords.some((kw) => options.topic.toLowerCase().includes(kw))) {
    return "code-visual";
  }

  // 6. Milestone days (every 25th)
  if (options.dayNumber % 25 === 0) {
    return "progress";
  }

  // 7. Default
  return "large-number";
}

function isValidTemplate(value: string): boolean {
  const valid: readonly string[] = [
    "large-number",
    "code-visual",
    "concept-diagram",
    "project-focused",
    "progress",
    "final-milestone",
  ];
  return valid.includes(value);
}
