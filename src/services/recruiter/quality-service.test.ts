import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/services/ai/generation", () => ({
  loadCurriculumDayForRecruiter: vi.fn(),
  loadJournalEntryForRecruiter: vi.fn(),
  loadModuleForRecruiter: vi.fn(),
}));

vi.mock("@/services/generated-posts", () => ({
  annotateGeneratedPostQuality: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import {
  loadCurriculumDayForRecruiter,
  loadJournalEntryForRecruiter,
} from "@/services/ai/generation";
import { annotateGeneratedPostQuality } from "@/services/generated-posts";
import { evaluateRecruiterPostForSavedPost } from "./quality-service";
import type { GeneratedPostRow } from "@/types/generated-post";
import type { ContentOpportunityRow } from "@/types/content-opportunity";

const postRow: GeneratedPostRow = {
  id: "post-1",
  profile_id: "user-1",
  journal_entry_id: "journal-1",
  day_number: 42,
  status: "draft",
  format: "what-i-learned",
  opening: "This week I finally understood git rebase.",
  body: "I walked through the squashing workflow and got a working interactive rebase.",
  takeaway: "Squash before you edit history.",
  next_step: "Apply the same flow to a real feature branch.",
  hashtags: ["#FullStackDevelopment", "#PersonalProject"],
  image_headline: null,
  image_subheadline: null,
  image_keywords: null,
  image_visual_concept: null,
  image_template: null,
  provider: "service",
  model: "gemini-2.5-flash",
  tokens_used: null,
  content_hash: "abc123",
  opportunity_id: "op-1",
  recruiter_quality_score: null,
  recruiter_quality_report: null,
  linkedin_post_id: null,
  published_at: null,
  publish_error: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const opportunityRow: ContentOpportunityRow = {
  id: "op-1",
  profile_id: "user-1",
  source_type: "journal",
  source_id: "entry-1",
  day_number: 42,
  module_number: null,
  post_type: "PROJECT_SHOWCASE",
  content_goal: "SHOW_PROJECTS",
  title: "Built a Supabase-backed rate limiter",
  summary: "A real project summary for recruiters.",
  evidence: [
    {
      field: "whatIBuilt",
      pageNumbers: [] as number[],
      confidence: "USER_CONFIRMED",
    },
  ],
  recruiter_score: 82,
  recruiter_score_breakdown: null,
  selection_reason: "Strong implementation evidence with clear recruiter appeal.",
  status: "generated",
  dedup_key: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function makeClient() {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1", email: "u@example.com" } },
        error: null,
      }),
    },
    from: vi.fn(),
  };

  client.from.mockImplementation((table: string) => {
    if (table === "generated_posts") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: postRow, error: null }),
        update: vi.fn(),
      };
    }
    if (table === "content_opportunities") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: opportunityRow, error: null }),
        update: vi.fn(),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });

  return client;
}

describe("evaluateRecruiterPostForSavedPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(makeClient());
    (annotateGeneratedPostQuality as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(postRow);
    (loadJournalEntryForRecruiter as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "entry-1",
      profile_id: "user-1",
      day_number: 42,
      raw_notes: null,
      title: "Git Journal Tracker",
      summary: "A CLI that tracks my journal.",
      tech_stack: ["Git"],
      input_prompt: null,
      model: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      structured_data: {
        whatIBuilt: "I built the Git Journal Tracker.",
        challenge: "A merge conflict confused me.",
        howISolvedIt: "I resolved the conflict keeping both changes.",
      },
    } as never);
    (loadCurriculumDayForRecruiter as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      day_number: 42,
      topic: "Git and Terminal Basics",
      module: { title: "Git mastery module" },
    } as never);
  });

  it("returns null for anonymous callers", async () => {
    const client = makeClient();
    client.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(client);
    expect(await evaluateRecruiterPostForSavedPost("post-1")).toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("returns null when the post does not exist", async () => {
    const client = makeClient();
    client.from.mockImplementation((table: string) => {
      if (table === "generated_posts") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
          update: vi.fn(),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(client);
    expect(await evaluateRecruiterPostForSavedPost("post-1")).toBeNull();
  });

  it("returns null when the post has no linked opportunity", async () => {
    const client = makeClient();
    client.from.mockImplementation((table: string) => {
      if (table === "generated_posts") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { ...postRow, opportunity_id: null },
            error: null,
          }),
          update: vi.fn(),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(client);
    expect(await evaluateRecruiterPostForSavedPost("post-1")).toBeNull();
  });

  it("evaluates from stored opportunity and journal evidence and persists the report", async () => {
    const result = await evaluateRecruiterPostForSavedPost("post-1");
    expect(result).not.toBeNull();
    expect(result?.post.id).toBe("post-1");
    expect(result?.report).toBeDefined();
    expect(result?.report.score).toBeGreaterThanOrEqual(0);
    expect(result?.report.score).toBeLessThanOrEqual(100);
    expect(annotateGeneratedPostQuality).toHaveBeenCalledWith("post-1", {
      score: result?.report.score,
      report: result?.report,
    });
  });

  it("still returns a report when annotation persistence fails", async () => {
    (annotateGeneratedPostQuality as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("no db"),
    );
    const result = await evaluateRecruiterPostForSavedPost("post-1");
    expect(result).not.toBeNull();
    expect(result?.report).toBeDefined();
    expect(result?.post.id).toBe("post-1");
  });

  it("tolerates a missing journal entry without inventing evidence", async () => {
    (loadJournalEntryForRecruiter as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("missing day"),
    );
    const result = await evaluateRecruiterPostForSavedPost("post-1");
    expect(result).not.toBeNull();
    expect(result?.report).toBeDefined();
  });
});