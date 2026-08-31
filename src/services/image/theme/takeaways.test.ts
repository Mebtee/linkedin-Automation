import { describe, it, expect } from "vitest";
import {
  extractTakeaways,
  normalizeTakeawayLabel,
  takeawaysFromInput,
  MAX_TAKEAWAYS,
  TAKEAWAY_VOCAB,
} from "./takeaways";
import { renderTakeawaysPanel } from "./takeaways-panel";
import { buildVisualBrief } from "../visual/brief";
import { renderVisualBrief } from "../visual/compositions";
import { renderTemplate } from "../svg/templates";
import { generateFallbackSvg } from "../svg/fallback";
import { checkSvgSafety } from "../svg/escape";
import { diagonalXAt, NAVY_PANEL_X, NAVY_PANEL_TOP } from "./geometry";
import { detectTechnologies, findConceptChain } from "../visual/concept-chains";
import { brand } from "@/config/brand";
import type { GeneratedPostRow } from "@/types/generated-post";

const W = brand.image.width;
const H = brand.image.height;

/**
 * Proof-of-evidence helper: a label is acceptable only if it is backed by a
 * trigger word the post literally contains (vocabulary), a matched concept's own
 * node, or a technology the post names. Anything else would be fabrication.
 */
function isEvidenceBacked(source: string, label: string): boolean {
  const stripped = source.toLowerCase();
  const chain = findConceptChain(source);
  if (!chain) {
    return detectTechnologies(source).map((t) => t.toUpperCase()).includes(label);
  }
  const vocab = TAKEAWAY_VOCAB[chain.title] ?? [];
  for (const candidate of vocab) {
    if (candidate.label.toUpperCase() === label) {
      const keyMatch = candidate.keywords.some((kw) => {
        if (kw.endsWith("~")) return new RegExp(`\\b${kw.slice(0, -1)}`, "i").test(stripped);
        return new RegExp(`\\b${kw}\\b`, "i").test(stripped);
      });
      if (keyMatch) return true;
      return false;
    }
  }
  if (chain.nodes.some((n) => n === label || n.toUpperCase() === label)) return true;
  if (detectTechnologies(source).map((t) => t.toUpperCase()).includes(label)) return true;
  return false;
}

const DB_SOURCE = "Adding an index made the query fast. Database indexing avoids a full table scan.";
const REST_SOURCE = "I built a REST API in my full-stack project. Client requests flow through the endpoint to the database.";

function basePost(overrides: Partial<GeneratedPostRow> = {}): GeneratedPostRow {
  return {
    id: "post-1",
    profile_id: "prof-1",
    journal_entry_id: "entry-1",
    day_number: 23,
    status: "draft",
    format: "concept",
    opening: "",
    body: "",
    takeaway: "",
    next_step: "",
    hashtags: [],
    image_headline: null,
    image_subheadline: null,
    image_keywords: null,
    image_visual_concept: null,
    image_template: null,
    provider: "test",
    model: "test",
    tokens_used: 0,
    content_hash: "hash",
    opportunity_id: null,
    recruiter_quality_score: null,
    recruiter_quality_report: null,
    linkedin_post_id: null,
    published_at: null,
    publish_error: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("extractTakeaways — extraction determinism", () => {
  it("returns identical labels for the same source", () => {
    expect(extractTakeaways(DB_SOURCE)).toEqual(extractTakeaways(DB_SOURCE));
    expect(extractTakeaways(REST_SOURCE)).toEqual(extractTakeaways(REST_SOURCE));
  });

  it("is independent of hashtag/emoji/url noise", () => {
    const noisy = `#database ${DB_SOURCE} 🔥 https://example.com learn!`;
    const clean = extractTakeaways(DB_SOURCE);
    const observed = extractTakeaways(noisy);
    expect(observed).toEqual(clean);
  });
});

describe("extractTakeaways — evidence-safe content", () => {
  it("derives labels only from post content — never chain-table echoes or fabrications", () => {
    // DB_SOURCE mentions index / table scan / fast → only those vocab items
    // activate, plus chain nodes/technologies only when vocabulary under-delivers.
    const db = extractTakeaways(DB_SOURCE); // "Adding an index made the query fast. Database indexing avoids a full table scan."
    expect(db.length).toBeGreaterThanOrEqual(3);
    for (const label of db) {
      expect(isEvidenceBacked(DB_SOURCE, label)).toBe(true);
    }
    // The label set reflects the post's own words — not the generic chain nodes.
    expect(db).not.toContain("FASTER LOOKUP");
    expect(db).not.toContain("DATABASE");

    const rest = extractTakeaways(REST_SOURCE); // "...Client requests flow through the endpoint..."
    expect(rest).toEqual(["CLIENT", "ENDPOINT", "REQUEST"]);
    for (const label of rest) {
      expect(isEvidenceBacked(REST_SOURCE, label)).toBe(true);
    }
  });

  it("never fabricates claims, numbers or personal outcomes", () => {
    const claimSource = "We signed up 10,000 users and cut errors by 50%. Built with TypeScript and Python microservices.";
    const out = extractTakeaways(claimSource);
    expect(extractTakeaways(claimSource)).toEqual(out);
    const joined = out.join(" ");
    expect(joined).not.toMatch(/10,000/);
    expect(joined).not.toMatch(/users/);
    expect(joined).not.toMatch(/50%/);
    // Technologies named in the post ARE acceptable evidence-safe labels.
    expect(out).toContain("TYPESCRIPT");
    expect(out).toContain("PYTHON");
  });

  it("maps a testing post to testing vocabulary, not the deployment chain", () => {
    const testingSource =
      "Tests catch regressions before they reach production. Unit tests cover the happy path, edge cases cover the weird input, assertions check the outcome.";
    const out = extractTakeaways(testingSource);
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out).toContain("UNIT TESTS");
    expect(out).toContain("EDGE CASES");
    expect(out).toContain("ASSERTIONS");
    expect(out).toContain("REGRESSION");
    expect(out).not.toContain("BUILD PIPELINE");
    expect(out).not.toContain("PRODUCTION");
  });

  it("gates vocabulary labels on the post actually containing their trigger words", () => {
    const noPlan = "Adding an index made the query fast and the lookup instant.";
    const withPlan = "The index shows up in the query plan, so the lookup is fast.";
    expect(extractTakeaways(noPlan)).not.toContain("QUERY PLAN");
    expect(extractTakeaways(withPlan)).toContain("QUERY PLAN");
  });

  it("limits output to the 3–4 window (max 4, single/matching concept)", () => {
    for (const src of [DB_SOURCE, REST_SOURCE]) {
      const out = extractTakeaways(src);
      expect(out.length).toBeGreaterThanOrEqual(3);
      expect(out.length).toBeLessThanOrEqual(MAX_TAKEAWAYS);
    }
  });

  it("never exceeds MAX_TAKEAWAYS even when many technologies are named", () => {
    const manyTech =
      "Using React, Node.js, PostgreSQL, TypeScript, Docker, Git, Prisma, Zod and Tailwind on the backend and frontend of the project.";
    const out = extractTakeaways(manyTech);
    expect(out.length).toBeLessThanOrEqual(MAX_TAKEAWAYS);
  });
});

describe("extractTakeaways — empty/short post fallback", () => {
  it("returns [] for empty or whitespace-only content", () => {
    expect(extractTakeaways("")).toEqual([]);
    expect(extractTakeaways("   ")).toEqual([]);
  });

  it("returns [] when no chain or technology is honestly present", () => {
    expect(extractTakeaways("Quick update, back soon.")).toEqual([]);
    expect(extractTakeaways("Just a reflection on my day.")).toEqual([]);
  });

  it("keeps short posts honest — fewer than window, never padded", () => {
    const short = "Pushed a hotfix for the frontend today.";
    const out = extractTakeaways(short);
    // Either nothing honest (no panel) or 2+ real labels; never fabricated rows.
    expect(out.length === 0 || out.length >= 2).toBe(true);
  });
});

describe("extractTakeaways — long content safety", () => {
  it("truncates long labels so they wrap safely", () => {
    const long = normalizeTakeawayLabel(
      "A VERY LONG DATABASE TAKEAWAY ABOUT QUERY PERFORMANCE AND INDEX SELECTION STRATEGY FOR THE PANEL",
    );
    expect(long.length).toBeLessThanOrEqual(31);
  });
});

describe("renderTakeawaysPanel — SVG rendering", () => {
  it("renders the KEY TAKEAWAYS editorial header with numbered items 01–04", () => {
    const svg = renderTakeawaysPanel(["INDEXING", "QUERY PLAN", "LOOKUP", "PERFORMANCE"]);
    expect(svg).toContain("KEY TAKEAWAYS");
    for (const n of ["01", "02", "03", "04"]) {
      expect(svg).toContain(n);
    }
  });

  it("renders only as many numbered rows as takeaway items", () => {
    const svg = renderTakeawaysPanel(["INDEXING", "QUERY PLAN"]);
    expect(svg).toContain("01");
    expect(svg).toContain("02");
    expect(svg).not.toContain("03");
  });

  it("is skipped entirely for empty/short input (clean fallback)", () => {
    expect(renderTakeawaysPanel([])).toBe("");
    expect(renderTakeawaysPanel(null)).toBe("");
    expect(renderTakeawaysPanel(undefined)).toBe("");
  });

  it("escapes XML special characters in takeaway labels", () => {
    const svg = renderTakeawaysPanel(["A <B> & C"]);
    expect(svg).not.toContain("<B>");
    expect(svg).toContain("&lt;B&gt;");
    expect(svg).toContain("&amp;");
    expect(svg).not.toContain("<&C");
    expect(checkSvgSafety(svg)).toBeNull();
  });

  it("caps output to MAX_TAKEAWAYS rows", () => {
    const svg = renderTakeawaysPanel(["A", "B", "C", "D", "E", "F"]);
    expect(svg).toContain("04");
    expect(svg).not.toContain("05");
  });
});

describe("navy-panel layout bounds (1600×900)", () => {
  function panelTextCoords(svg: string): { x: number[]; y: number[] } {
    const x: number[] = [];
    const y: number[] = [];
    for (const m of svg.matchAll(/<text\b[^>]*?\bx="([-0-9.]+)"[^>]*?\by="([-0-9.]+)"/g)) {
      // Only the navy panel's own text lives in this x-range.
      if (Number.parseFloat(m[1]!) >= NAVY_PANEL_X) {
        x.push(Number.parseFloat(m[1]!));
        y.push(Number.parseFloat(m[2]!));
      }
    }
    return { x, y };
  }

  it("keeps panel text inside the canvas and the navy region (right of the diagonal)", () => {
    const svg = renderTakeawaysPanel(["INDEXING", "QUERY PLAN", "LOOKUP", "PERFORMANCE"]);
    const { x, y } = panelTextCoords(svg);
    expect(x.length).toBeGreaterThan(0);
    for (const xv of x) {
      expect(xv).toBeGreaterThanOrEqual(NAVY_PANEL_X);
      expect(xv).toBeLessThanOrEqual(W - 40);
    }
    for (const yv of y) {
      expect(yv).toBeGreaterThanOrEqual(40);
      expect(yv).toBeLessThanOrEqual(H - 40);
      // At any row the panel must sit well right of the diagonal boundary.
      expect(NAVY_PANEL_X).toBeGreaterThan(diagonalXAt(yv) + 8);
    }
  });

  it("never overlaps the TB logo block (panel stops above logo top)", () => {
    const svg = renderTakeawaysPanel(["INDEXING", "QUERY PLAN", "LOOKUP", "PERFORMANCE"]);
    const ys = panelTextCoords(svg).y;
    // Logo occupies y ∈ [624, 824]; the panel must clear it.
    const maxY = Math.max(...ys);
    expect(maxY).toBeLessThan(624);
  });

  it("keeps the whole panel safely inside the canvas", () => {
    const svg = renderTakeawaysPanel(["INDEXING", "QUERY PLAN", "LOOKUP", "PERFORMANCE"]);
    const coords = [NAVY_PANEL_X, NAVY_PANEL_TOP, NAVY_PANEL_X + 400, NAVY_PANEL_TOP + 340];
    for (const v of coords) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(W);
    }
    expect(checkSvgSafety(svg)).toBeNull();
  });
});

describe("integration — brief compositions and templates", () => {
  it("paints the navy KEY TAKEAWAYS panel for a post with a matched concept chain", () => {
    const brief = buildVisualBrief({
      post: basePost({ opening: "An index avoids a full table scan.", takeaway: "Indexes make lookups fast." }),
      topic: "Database Indexing",
      moduleNumber: 2,
      moduleTitle: "Backend",
      postType: "DATABASE_ENGINEERING",
    });
    expect(brief.keyTakeaways).toBeDefined();
    expect(brief.keyTakeaways!.length).toBeGreaterThanOrEqual(3);
    const svg = renderVisualBrief(brief);
    expect(svg).toContain("KEY TAKEAWAYS");
    expect(svg).toContain("01");
    expect(checkSvgSafety(svg)).toBeNull();
  });

  it("keeps the navy takeaways distinct from the light-zone visual nodes", () => {
    const brief = buildVisualBrief({
      post: basePost({
        opening: "A query was slow because it scanned every row.",
        body: "Adding an index turned the lookup into a fast path.",
        takeaway: "The right index avoids a full table scan.",
        next_step: "Inspect the query plan to confirm the index is used.",
      }),
      topic: "Database Indexing",
      moduleNumber: 2,
      moduleTitle: "Backend",
      postType: "DATABASE_ENGINEERING",
    });
    const svg = renderVisualBrief(brief);
    // Light-zone visual carries the concept chain nodes.
    const lightNodes = ["QUERY", "INDEX", "DATABASE", "FASTER LOOKUP"];
    // Navy takeaways are the post's own vocabulary, not the same node labels.
    for (const label of brief.keyTakeaways ?? []) {
      expect(lightNodes).not.toContain(label);
    }
    expect(svg).toContain("KEY TAKEAWAYS");
  });

  it("omits the panel when the post yields nothing honest", () => {
    const brief = buildVisualBrief({
      post: basePost({ opening: "Quick update, back soon." }),
      topic: "General",
      moduleNumber: 1,
      moduleTitle: "Intro",
      postType: null,
    });
    const svg = renderVisualBrief(brief);
    expect(brief.keyTakeaways).toEqual([]);
    expect(svg).not.toContain("KEY TAKEAWAYS");
    expect(svg).toContain("</svg>");
    expect(checkSvgSafety(svg)).toBeNull();
  });

  it("classic templates render the panel derived from flat input content", () => {
    const svg = renderTemplate("large-number", {
      dayNumber: 12,
      topic: "Database Indexing",
      moduleNumber: 2,
      moduleTitle: "Backend",
      headline: "Indexing made queries fast",
      subheadline: "",
      keywords: ["index", "query"],
      visualConcept: "indexing",
      template: "large-number",
    });
    expect(svg).toContain("KEY TAKEAWAYS");
    expect(svg).toContain("01");
    expect(checkSvgSafety(svg)).toBeNull();
  });

  it("templates honor an explicitly provided takeaways list", () => {
    const svg = renderTemplate("large-number", {
      dayNumber: 3,
      topic: "Anything",
      moduleNumber: 1,
      moduleTitle: "Intro",
      headline: "Anything",
      subheadline: "",
      keywords: [],
      visualConcept: "",
      template: "large-number",
      takeaways: ["AUTH", "TOKEN", "ACCESS"],
    });
    expect(svg).toContain("KEY TAKEAWAYS");
    expect(svg).toContain("AUTH");
    expect(svg).toContain("TOKEN");
    expect(svg).toContain("ACCESS");
    expect(checkSvgSafety(svg)).toBeNull();
  });

  it("fallback carrier SVG keeps the navy branding WITHOUT a takeaway panel", () => {
    const svg = generateFallbackSvg({ dayNumber: 1, topic: "Intro" });
    expect(svg).not.toContain("KEY TAKEAWAYS");
    expect(svg).toContain(brand.colors.navy);
    expect(svg).toContain("105 DLJ");
    expect(checkSvgSafety(svg)).toBeNull();
  });

  it("takeawaysFromInput falls back to flat-input extraction, capped at 4", () => {
    const input = {
      dayNumber: 1,
      topic: "React State",
      moduleNumber: 1,
      moduleTitle: "Frontend",
      headline: "React state and props",
      subheadline: "",
      keywords: ["react", "state"],
      visualConcept: "components",
      template: "large-number" as const,
    };
    const out = takeawaysFromInput(input);
    expect(out.length).toBeLessThanOrEqual(MAX_TAKEAWAYS);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out).toContain("COMPONENTS");
    expect(out).toContain("STATE");
    expect(out).toContain("PROPS");
    // Provided takeaways always win.
    const withProvided = takeawaysFromInput({ ...input, takeaways: ["STATE", "PROPS"] });
    expect(withProvided).toEqual(["STATE", "PROPS"]);
  });
});