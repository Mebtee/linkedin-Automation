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

const CHAIN_RULES: readonly ChainRule[] = [
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
    match: ["authentication", "auth", "jwt", "oauth"],
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
    match: ["testing", "test", "vitest", "jest"],
    chain: {
      title: "Testing",
      nodes: ["IMPLEMENTATION", "TESTS", "VALIDATION"],
      summary: "Tests verify behavior and catch regressions.",
    },
  },
  {
    match: ["deploy", "deployment", "ci", "ci/cd", "cd"],
    chain: {
      title: "Deployment",
      nodes: ["CODE", "BUILD", "DEPLOY", "PRODUCTION"],
      summary: "Move code through build and deployment into a live environment.",
    },
  },
  {
    match: ["security", "encryption", "login", "password", "secret"],
    chain: {
      title: "Security",
      nodes: ["INPUT", "SECURE HANDLING", "PROTECTED DATA"],
      summary: "Protect data at every stage: input, handling, and storage.",
    },
  },
  {
    match: ["function", "recursion"],
    chain: {
      title: "Functions & Recursion",
      nodes: ["INPUT", "FUNCTION", "OUTPUT"],
      summary: "A function maps input to output, optionally by repeating itself.",
    },
  },
  {
    match: ["array", "list", "data structure"],
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
    if (rule.match.some((m) => combined.includes(m))) {
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
    if (combined.includes(key) && !found.includes(display)) {
      found.push(display);
    }
  }
  return found;
}

/** Splits a multi-line concept into visual key points. */
export function chainToKeyPoints(chain: ConceptChain): VisualKeyPoint[] {
  return chain.nodes.map((node) => ({ label: node, detail: "" }));
}
