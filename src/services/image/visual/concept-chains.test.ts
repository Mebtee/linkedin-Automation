import { describe, it, expect } from "vitest";
import { findConceptChain, detectTechnologies, detectTopConcepts, chainToKeyPoints } from "./concept-chains";

describe("findConceptChain", () => {
  it("maps RLS to a row-level-security chain ahead of supabase/security", () => {
    const chain = findConceptChain("I used Supabase RLS to prevent cross-user access");
    expect(chain?.title).toBe("Row-Level Security");
    expect(chain?.nodes.join(" ")).toContain("OWNER-ONLY");
    expect(chain?.contrast).toEqual(["BEFORE RLS", "WITH RLS"]);
  });

  it("maps database index content", () => {
    const chain = findConceptChain("adding a database index for faster lookups");
    expect(chain?.title).toBe("Database Indexes");
    expect(chain?.nodes).toContain("INDEX");
  });

  it("maps debugging content", () => {
    const chain = findConceptChain("I debugged the error by tracing the root cause");
    expect(chain?.title).toBe("Debugging");
    expect(chain?.nodes).toContain("ROOT CAUSE");
  });

  it("maps a comparison/tradeoff", () => {
    const chain = findConceptChain("comparing options and tradeoffs before the decision");
    expect(chain?.title).toBe("Engineering Tradeoff");
    expect(chain?.contrast).toEqual(["OPTION A", "OPTION B"]);
  });

  it("maps REST API content", () => {
    const chain = findConceptChain("building a REST API endpoint");
    expect(chain?.title).toBe("REST API");
    expect(chain?.nodes).toContain("CLIENT");
  });

  it("maps authentication content", () => {
    const chain = findConceptChain("implementing authentication with a session");
    expect(chain?.title).toBe("Authentication & Authorization");
  });

  it("maps git content", () => {
    const chain = findConceptChain("using git branches and merging");
    expect(chain?.title).toBe("Git Workflow");
    expect(chain?.nodes.join(" ")).toContain("MERGE");
  });

  it("returns null when nothing matches", () => {
    expect(findConceptChain("a completely unrelated musing about the weather")).toBeNull();
  });

  it("is deterministic", () => {
    expect(findConceptChain("database index lookup")).toBe(findConceptChain("database index lookup"));
  });
});

describe("detectTechnologies", () => {
  it("detects named technologies without inventing others", () => {
    const result = detectTechnologies("I used Supabase, React and PostgreSQL");
    expect(result).toContain("Supabase");
    expect(result).toContain("React");
    expect(result).toContain("PostgreSQL");
  });

  it("returns an empty array for unknown text", () => {
    expect(detectTechnologies("no tools mentioned here")).toEqual([]);
  });
});

describe("detectTopConcepts", () => {
  it("ranks the first matched chain as primary", () => {
    const p = detectTopConcepts("Supabase RLS and database indexes", "Database");
    expect(p.primary).toBe("Row-Level Security");
    expect(p.secondary.length).toBeGreaterThan(0);
  });

  it("keeps primary deterministic", () => {
    const a = detectTopConcepts("auth with JWT and sessions", "Security");
    const b = detectTopConcepts("auth with JWT and sessions", "Security");
    expect(a.primary).toBe(b.primary);
  });

  it("falls back to the topic when no chain matches", () => {
    const p = detectTopConcepts("a generic thought", "Something Brand New");
    expect(p.primary).toBe("Something Brand New");
  });

  it("never invents optional technologies beyond those present", () => {
    const p = detectTopConcepts("just a plain sentence", "x");
    expect(p.optional).toEqual([]);
  });
});

describe("chainToKeyPoints", () => {
  it("converts nodes into labeled key points", () => {
    const points = chainToKeyPoints({
      title: "T",
      nodes: ["A", "B"],
      summary: "s",
    });
    expect(points).toEqual([
      { label: "A", detail: "" },
      { label: "B", detail: "" },
    ]);
  });
});
