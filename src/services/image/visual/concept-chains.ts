import type { VisualKeyPoint } from "@/types/image";

// ─── Concept Chain Mapping (Phase 5G) ────────────────────────────────────────
// Deterministically maps post topic/technology keywords to a short visual chain
// that communicates the "idea" of the post at a glance (e.g. DATABASE → INDEX →
// FASTER QUERIES). First-match wins; ordering in the table defines priority so
// the same input always produces the same chain. Lists are evidence-safe: they
// describe the subject of the post rather than inventing personal outcomes.

export interface ConceptChain {
  /** Headline shown above the chain. */
  readonly title: string;
  /** Ordered node labels, drawn left-to-right / top-to-bottom. */
  readonly nodes: readonly string[];
  /** One-line supporting takeaway. */
  readonly summary: string;
  /** Optional related concept for a "before → after" framing. */
  readonly contrast?: readonly [string, string];
}

export type ChainMatch = {
  readonly chain: ConceptChain;
  readonly matchedKeywords: readonly string[];
};

interface ChainRule {
  readonly match: readonly string[];
  readonly chain: ConceptChain;
}

/** Word-boundary keyword match — avoids false positives like "ci" in "tracing". */
function matchesKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

function anyKeyword(text: string, keywords: readonly string[]): boolean {
  return keywords.some((k) => matchesKeyword(text, k));
}

const CHAIN_RULES: readonly ChainRule[] = [
  {
    match: ["row level security", "rls", "ownership", "row-level security", "user isolation"],
    chain: {
      title: "Row-Level Security",
      nodes: ["SHARED ACCESS", "OWNER-ONLY", "RLS ISOLATION"],
      summary: "RLS lets each user see and change only their own rows.",
      contrast: ["BEFORE RLS", "WITH RLS"],
    },
  },
  {
    match: ["index", "indexes", "indexing"],
    chain: {
      title: "Database Indexes",
      nodes: ["QUERY", "INDEX", "DATABASE", "FASTER LOOKUP"],
      summary: "An index turns a full scan into a fast path to the right rows.",
    },
  },
  {
    match: ["rest api", "rest", "api endpoint", "api"],
    chain: {
      title: "REST API",
      nodes: ["CLIENT", "API", "SERVICE", "DATABASE"],
      summary: "A request flows from the client through the API to the data layer.",
    },
  },
  {
    match: ["authentication", "authorization", "auth", "jwt", "oauth", "session", "login"],
    chain: {
      title: "Authentication & Authorization",
      nodes: ["IDENTITY", "AUTH", "AUTHORIZATION", "SECURE ACCESS"],
      summary: "Confirm who you are, then grant access to what you may use.",
    },
  },
  {
    match: ["database", "sql", "postgres", "postgresql", "schema", "migration"],
    chain: {
      title: "Database Engineering",
      nodes: ["SCHEMA", "MIGRATION", "QUERY", "DATA"],
      summary: "A clear schema and migrations keep data consistent and queryable.",
    },
  },
  {
    match: ["react"],
    chain: {
      title: "React",
      nodes: ["COMPONENT", "STATE", "DATA", "UI"],
      summary: "Components render UI from state and data.",
    },
  },
  {
    match: ["next.js", "nextjs"],
    chain: {
      title: "Next.js",
      nodes: ["BROWSER", "NEXT.JS", "SERVER", "DATA"],
      summary: "A page request flows from the browser through Next.js to data.",
    },
  },
  {
    match: ["supabase"],
    chain: {
      title: "Supabase",
      nodes: ["APP", "AUTH", "DATABASE", "STORAGE"],
      summary: "Auth, database, and storage back a single application.",
    },
  },
  {
    match: ["git", "github"],
    chain: {
      title: "Git Workflow",
      nodes: ["CODE", "COMMIT", "BRANCH", "MERGE"],
      summary: "Version your work as commits across branches and merge changes.",
    },
  },
  {
    match: ["testing", "test", "tests", "unit test", "vitest", "jest"],
    chain: {
      title: "Testing",
      nodes: ["CODE", "TESTS", "VALIDATION", "CONFIDENCE"],
      summary: "Tests verify behavior and catch regressions.",
    },
  },
  {
    match: ["deploy", "deployment", "pipeline", "production", "ci/cd"],
    chain: {
      title: "Deployment",
      nodes: ["CODE", "BUILD", "DEPLOY", "PRODUCTION"],
      summary: "Move code through build and deployment into a live environment.",
    },
  },
  {
    match: ["debug", "bug", "symptom", "stack trace", "root cause", "diagnosis"],
    chain: {
      title: "Debugging",
      nodes: ["SYMPTOM", "INVESTIGATION", "ROOT CAUSE", "FIX"],
      summary: "Trace a symptom back to its root cause, then fix it.",
    },
  },
  {
    match: ["tradeoff", "trade-off", "vs", "versus", "compare", "comparison", "decision"],
    chain: {
      title: "Engineering Tradeoff",
      nodes: ["OPTION A", "TRADEOFF", "OPTION B", "DECISION"],
      summary: "Weigh options by their tradeoffs before deciding.",
      contrast: ["OPTION A", "OPTION B"],
    },
  },
  {
    match: ["security", "encryption", "password", "secret", "threat", "vulnerability"],
    chain: {
      title: "Security",
      nodes: ["INPUT", "SECURE HANDLING", "PROTECTED DATA"],
      summary: "Protect data at every stage: input, handling, and storage.",
    },
  },
  {
    match: ["function", "functions", "recursion", "recursive", "closure", "closures", "scope", "scopes"],
    chain: {
      title: "Functions & Scope",
      nodes: ["INPUT", "FUNCTION", "OUTPUT"],
      summary: "A function maps input to output, optionally by repeating itself.",
    },
  },
  {
    match: ["array", "arrays", "list", "lists", "data structure", "data structures", "tree", "trees", "hash map", "hash maps"],
    chain: {
      title: "Data Structures",
      nodes: ["COLLECTION", "OPERATION", "RESULT"],
      summary: "Choose the structure that makes your common operations efficient.",
    },
  },
];

// ─── Lookup helpers ──────────────────────────────────────────────────────────

/** Detects the first matching concept chain for a set of keywords/technologies. */
export function findConceptChain(text: string): ConceptChain | null {
  const combined = text.toLowerCase();
  for (const rule of CHAIN_RULES) {
    if (anyKeyword(combined, rule.match)) {
      return rule.chain;
    }
  }
  return null;
}

/** Detects known technologies mentioned in the post and returns display names. */
export function detectTechnologies(text: string): string[] {
  const technologies: Record<string, string> = {
    "react": "React",
    "next.js": "Next.js",
    "nextjs": "Next.js",
    "typescript": "TypeScript",
    "javascript": "JavaScript",
    "node.js": "Node.js",
    "nodejs": "Node.js",
    "express": "Express",
    "supabase": "Supabase",
    "postgresql": "PostgreSQL",
    "postgres": "PostgreSQL",
    "sql": "SQL",
    "prisma": "Prisma",
    "docker": "Docker",
    "git": "Git",
    "github": "GitHub",
    "github actions": "GitHub Actions",
    "vue": "Vue",
    "python": "Python",
    "html": "HTML",
    "css": "CSS",
    "tailwind": "Tailwind",
    "graphql": "GraphQL",
    "jest": "Jest",
    "vitest": "Vitest",
    "zod": "Zod",
  };
  const combined = text.toLowerCase();
  const found: string[] = [];
  for (const [key, display] of Object.entries(technologies)) {
    if (matchesKeyword(combined, key) && !found.includes(display)) {
      found.push(display);
    }
  }
  return found;
}

/** Splits a multi-line concept into visual key points. */
export function chainToKeyPoints(chain: ConceptChain): VisualKeyPoint[] {
  return chain.nodes.map((node) => ({ label: node, detail: "" }));
}

// ─── Concept Priority (Phase 5H) ─────────────────────────────────────────────
// Distinguishes the single dominant idea from supporting and optional context so
// the visual leads with one clear message instead of listing every keyword.

export interface ConceptPriority {
  /** The single dominant concept the visual must lead with. */
  readonly primary: string;
  /** Up to 3 reinforcing concepts (drawn smaller, never competing). */
  readonly secondary: readonly string[];
  /** Optional context concepts (kept out of the foreground). */
  readonly optional: readonly string[];
}

/** Short, safe topic fallback used when no known chain matches. */
function topicFallback(topic: string): string {
  const t = (topic || "").trim();
  if (!t) return "Concept";
  return t.length > 40 ? `${t.slice(0, 39).trimEnd()}…` : t;
}

/**
 * Deterministically ranks the concepts in a post. The first matching chain rule
 * is the priority-primary concept; later distinct chain titles become secondary.
 * Never invents concepts — only what the post/curriculum actually mentions.
 */
export function detectTopConcepts(text: string, topic: string): ConceptPriority {
  const combined = `${text} ${topic}`.toLowerCase();
  const matched: string[] = [];
  for (const rule of CHAIN_RULES) {
    if (anyKeyword(combined, rule.match)) {
      if (!matched.includes(rule.chain.title)) matched.push(rule.chain.title);
    }
  }

  const primary = matched[0] ?? topicFallback(topic);
  const secondary = matched.slice(1, 4);
  const optional = detectTechnologies(text).filter((t) => !secondary.includes(t)).slice(0, 3);

  return { primary, secondary, optional };
}
