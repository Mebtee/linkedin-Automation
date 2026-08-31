import type { ImageGenerationInput } from "@/types/image";
import { findConceptChain, detectTechnologies } from "../visual/concept-chains";
import { truncate } from "../visual/themes";

// ─── Key Takeaways Extraction (editorial navy panel) ─────────────────────────
// Deterministically derives 3–4 concise label takeaways from the ACTUAL post
// content (opening / body / takeaway / next step / topic / headline / visual
// concept / keywords) so the navy KEY TAKEAWAYS panel is editorial, not gimmick.
//
// Evidence contract:
//  - A label can only appear if the post literally contains one of its trigger
//    words (see `TAKEAWAY_VOCAB` below). Nothing is invented, generalized, or
//    pulled from prompts/evidence metadata/scoring.
//  - Each concept's candidate labels are a DISTINCT vocabulary from the concept
//    chain nodes rendered in the light zone, so the two areas never duplicate
//    the same information.
//  - The concept chain is only consulted after it matched real post words; the
//    chain's own nodes and named technologies fill remaining slots when a post
//    is too thin to activate its vocabulary.
//  - Empty or thin content yields an empty array — the renderer then skips the
//    panel entirely (clean fallback).

/** Panel renders at most 4 numbered takeaways (01–04). */
export const MAX_TAKEAWAYS = 4;

/**
 * Editorial takeaway vocabulary per concept-chain title. Each candidate is
 * evidence-gated: `keywords` must appear in the post text for the label to be
 * emitted. Keywords support `~` prefix stems (e.g. `validat~` → validate /
 * validation / validates) and simple plural suffixing.
 */
export const TAKEAWAY_VOCAB: Readonly<Record<string, readonly { readonly label: string; readonly keywords: readonly string[] }[]>> = {
  "Python Foundations": [
    { label: "COLLECTIONS", keywords: ["collection", "collections", "lists", "tuples", "dictionaries", "sets"] },
    { label: "FILE I/O", keywords: ["file", "files", "reading", "writing", "i/o", "io"] },
    { label: "ERROR HANDLING", keywords: ["error", "errors", "exception", "exceptions", "handle", "handling"] },
    { label: "COMPREHENSIONS", keywords: ["comprehension", "comprehensions"] },
  ],
  "File I/O": [
    { label: "OPEN CAREFULLY", keywords: ["open", "opens", "with open"] },
    { label: "READ / WRITE", keywords: ["read", "reads", "reading", "write", "writes", "writing"] },
    { label: "PROCESS DATA", keywords: ["process", "processes", "processing", "batch"] },
    { label: "CLOSE SAFELY", keywords: ["close", "closes", "closing", "context manager"] },
  ],
  "Error Handling": [
    { label: "TRY / EXCEPT", keywords: ["try", "except", "try/except", "try except"] },
    { label: "RECOVER", keywords: ["recover", "recovery", "recovers"] },
    { label: "DEBUG", keywords: ["debug", "debugging", "traceback", "stack trace"] },
    { label: "EXCEPTIONS", keywords: ["exception", "exceptions", "raise", "raises"] },
  ],
  "Row-Level Security": [
    { label: "RLS", keywords: ["rls", "row level security", "row-level security"] },
    { label: "Policies", keywords: ["policy"] },
    { label: "Data Isolation", keywords: ["isolation", "isolate", "isolated", "own rows", "own data"] },
    { label: "Owner-Only Access", keywords: ["owner", "ownership", "only their own", "scoped"] },
  ],
  "Database Indexes": [
    { label: "INDEXING", keywords: ["index", "indexing", "indexes"] },
    { label: "QUERY PLAN", keywords: ["query plan", "query plans", "planner", "explain"] },
    { label: "LOOKUP", keywords: ["lookup", "lookups", "fast path", "fast lookup"] },
    { label: "FULL TABLE SCAN", keywords: ["table scan", "full scan", "scan", "scans", "scanned"] },
    { label: "QUERY PERFORMANCE", keywords: ["performance", "fast", "faster", "speed"] },
  ],
  "REST API": [
    { label: "CLIENT", keywords: ["client", "clients", "browser"] },
    { label: "ENDPOINT", keywords: ["endpoint", "endpoints", "route", "routes", "uri"] },
    { label: "VALIDATION", keywords: ["validat~"] },
    { label: "RESPONSE", keywords: ["response", "responses", "returns", "reply"] },
    { label: "REQUEST", keywords: ["request", "requests"] },
  ],
  "Authentication & Authorization": [
    { label: "IDENTITY", keywords: ["identity", "identities", "who you are"] },
    { label: "TOKEN", keywords: ["token", "tokens", "jwt"] },
    { label: "VALIDATION", keywords: ["validat~"] },
    { label: "ACCESS", keywords: ["access", "accesses", "authorize", "authorized"] },
    { label: "SESSION", keywords: ["session", "sessions", "refresh"] },
  ],
  "Database Engineering": [
    { label: "SCHEMA DESIGN", keywords: ["schema", "schemas"] },
    { label: "MIGRATIONS", keywords: ["migration", "migrations", "migrat~"] },
    { label: "RELATIONSHIPS", keywords: ["relationship", "relationships", "foreign key", "relation"] },
    { label: "CONSISTENCY", keywords: ["consistent", "consistency", "integrity", "constraint", "constraints"] },
    { label: "QUERY PLANNING", keywords: ["query plan", "query", "queries"] },
  ],
  "React": [
    { label: "COMPONENTS", keywords: ["component", "components"] },
    { label: "STATE", keywords: ["state", "states", "usestate"] },
    { label: "PROPS", keywords: ["props", "properties"] },
    { label: "RENDER", keywords: ["render", "renders", "rendering", "rerender", "re-render", "ui"] },
  ],
  "Next.js": [
    { label: "NEXT.JS", keywords: ["next.js", "nextjs"] },
    { label: "PAGE ROUTES", keywords: ["route", "routes", "page", "pages"] },
    { label: "SERVER-SIDE", keywords: ["server", "servers", "ssr", "server-side", "server side"] },
    { label: "DATA FETCHING", keywords: ["fetch", "fetching", "fetches", "api route"] },
  ],
  "Supabase": [
    { label: "AUTH", keywords: ["auth", "auth~"] },
    { label: "DATABASE", keywords: ["database", "postgres", "postgresql", "sql"] },
    { label: "STORAGE", keywords: ["storage", "bucket", "buckets"] },
    { label: "REALTIME", keywords: ["realtime", "real-time", "real time", "subscribe", "subscription"] },
    { label: "RLS", keywords: ["rls", "row level security", "row-level security"] },
  ],
  "Git Workflow": [
    { label: "COMMITS", keywords: ["commit", "commits", "committed"] },
    { label: "BRANCHING", keywords: ["branch", "branches", "branching"] },
    { label: "MERGING", keywords: ["merge", "merges", "merging"] },
    { label: "REBASE", keywords: ["rebase", "rebases", "rewrites"] },
    { label: "HISTORY", keywords: ["history", "log", "logs", "reviewable"] },
  ],
  "Testing": [
    { label: "UNIT TESTS", keywords: ["unit test", "tests", "test"] },
    { label: "EDGE CASES", keywords: ["edge case"] },
    { label: "ASSERTIONS", keywords: ["assertion", "assertions", "assert~", "checks"] },
    { label: "REGRESSION", keywords: ["regression", "regressions"] },
    { label: "TEST COVERAGE", keywords: ["coverage", "covered"] },
  ],
  "Deployment": [
    { label: "BUILD PIPELINE", keywords: ["build", "builds", "pipeline", "pipelines", "ci/cd", "ci cd"] },
    { label: "AUTOMATION", keywords: ["automate", "automates", "automated", "automation"] },
    { label: "STAGING", keywords: ["staging", "stage"] },
    { label: "ROLLBACK", keywords: ["rollback", "rollbacks", "revert", "reverts"] },
    { label: "PRODUCTION", keywords: ["production", "prod", "live"] },
  ],
  "Debugging": [
    { label: "SYMPTOMS", keywords: ["symptom", "symptoms"] },
    { label: "ROOT CAUSE", keywords: ["root cause", "root causes", "cause"] },
    { label: "DIAGNOSIS", keywords: ["diagnos~", "investigat~"] },
    { label: "REPRODUCTION", keywords: ["reproduce", "reproduction", "minimal case"] },
    { label: "BREAKPOINTS", keywords: ["breakpoint", "breakpoints", "debugger"] },
  ],
  "Engineering Tradeoff": [
    { label: "TRADEOFFS", keywords: ["tradeoff", "trade-offs", "trade off", "tradeoffs"] },
    { label: "CONSTRAINTS", keywords: ["constraint", "constraints", "requirement", "requirements", "limits"] },
    { label: "SCALABILITY", keywords: ["scalab~"] },
    { label: "MAINTENANCE", keywords: ["maintain~", "maintenance"] },
    { label: "DECISION MAKING", keywords: ["decision", "decisions", "choose", "deciding"] },
  ],
  "Security": [
    { label: "ENCRYPTION", keywords: ["encrypt~"] },
    { label: "SECRETS", keywords: ["secret", "secrets"] },
    { label: "THREAT MODEL", keywords: ["threat", "threats", "attack", "attacks", "attacker"] },
    { label: "VULNERABILITIES", keywords: ["vulnerab~"] },
    { label: "HARDENING", keywords: ["harden~", "sanitize", "sanitization"] },
  ],
  "Functions & Scope": [
    { label: "CLOSURES", keywords: ["closure", "closures"] },
    { label: "SCOPE", keywords: ["scope", "scopes", "scoping", "lexical"] },
    { label: "CALL STACK", keywords: ["call stack", "callstack", "stack"] },
    { label: "RECURSION", keywords: ["recursi~"] },
    { label: "PURE FUNCTIONS", keywords: ["pure function", "pure functions", "purity"] },
  ],
  "Data Structures": [
    { label: "TIME COMPLEXITY", keywords: ["time complexity", "complexity", "big o"] },
    { label: "HASH MAPS", keywords: ["hash map", "hashmap", "hash table", "hash"] },
    { label: "LINKED LISTS", keywords: ["linked list", "linked lists"] },
    { label: "STACKS & QUEUES", keywords: ["stack", "stacks", "queue", "queues"] },
    { label: "SORTING", keywords: ["sort", "sorts", "sorting", "sorted"] },
  ],
};

/** Emoji + hashtag + URL + mention scrubbing before concept matching. */
function stripJunk(text: string): string {
  return (text || "")
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{1F300}-\u{1FAFF}\uFE0F]/gu, "")
    .replace(/#[A-Za-z0-9_]+/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/@[A-Za-z0-9_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when a single keyword appears in the text. Supports `~` prefix stems
 * (`validat~` → validate/validation/validates) and simple plural suffixes.
 */
function textMatches(text: string, keyword: string): boolean {
  if (keyword.endsWith("~")) {
    const stem = escapeRegex(keyword.slice(0, -1).toLowerCase());
    return new RegExp(`\\b${stem}[a-z]*`, "i").test(text);
  }
  const variants = [keyword, `${keyword}s`, `${keyword}es`];
  return variants.some((v) => new RegExp(`\\b${escapeRegex(v)}\\b`, "i").test(text));
}

/** True when any of a candidate's trigger words appears in the post text. */
function matchesAny(text: string, keywords: readonly string[]): boolean {
  return keywords.some((k) => textMatches(text, k));
}

/** Uppercases, trims and caps a takeaway label so it never overflows its row. */
export function normalizeTakeawayLabel(raw: string): string {
  const cleaned = truncate(raw.trim().replace(/\s+/g, " ").replace(/[.;,:!?]+$/g, ""), 30);
  return cleaned === "" ? "" : cleaned.toUpperCase();
}

/**
 * Deterministically extracts up to `MAX_TAKEAWAYS` concise takeaway labels from
 * post-derived text. Labels come only from the matched concept's editorial
 * vocabulary AND are activated by words the post literally contains, then the
 * concept's own nodes / named technologies fill any remaining honest slots.
 * Returns fewer (or none) for thin/empty content — never fabricates.
 */
export function extractTakeaways(source: string): string[] {
  const text = stripJunk(source);
  if (!text) return [];

  const out: string[] = [];

  // 1. Evidence-gated editorial vocabulary for the matched concept — the
  //    strongest, post-specific signal. A label is only emitted when the post
  //    actually contains one of its trigger words.
  const chain = findConceptChain(text);
  if (chain) {
    const vocab = TAKEAWAY_VOCAB[chain.title];
    if (vocab) {
      for (const candidate of vocab) {
        if (out.length >= MAX_TAKEAWAYS) break;
        if (matchesAny(text, candidate.keywords)) {
          const label = normalizeTakeawayLabel(candidate.label);
          if (label && !out.includes(label)) out.push(label);
        }
      }
    }

    // Only fill from the chain's own nodes when the vocabulary under-delivered,
    // so the navy panel stays distinct from the light-zone visual.
    if (out.length < 3 && out.length < MAX_TAKEAWAYS) {
      for (const node of chain.nodes) {
        if (out.length >= MAX_TAKEAWAYS) break;
        const label = normalizeTakeawayLabel(node);
        if (label && !out.includes(label)) out.push(label);
      }
    }
  }

  // 2. Technologies the post names fill any remaining slots.
  if (out.length < 3 && out.length < MAX_TAKEAWAYS) {
    for (const tech of detectTechnologies(text)) {
      if (out.length >= MAX_TAKEAWAYS) break;
      const label = normalizeTakeawayLabel(tech);
      if (label && !out.includes(label)) out.push(label);
    }
  }

  return out.length >= 2 ? out.slice(0, MAX_TAKEAWAYS) : [];
}

/** Builds a takeaway list for the classic template path from flat input fields. */
export function takeawaysFromInput(input: ImageGenerationInput): readonly string[] {
  if (input.takeaways && input.takeaways.length > 0) return input.takeaways.slice(0, MAX_TAKEAWAYS);
  const source = [
    input.topic,
    input.headline || input.topic,
    input.visualConcept,
    ...input.keywords,
  ].join(" ");
  return extractTakeaways(source);
}