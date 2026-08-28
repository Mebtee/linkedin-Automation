import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockList = vi.fn();
const mockGet = vi.fn();
const mockUpdateStatus = vi.fn();
const mockDelete = vi.fn();
const mockGenerateForDay = vi.fn();
const mockGenerateForMaterial = vi.fn();
const mockSelectBest = vi.fn();
const mockGenerateFromOpportunity = vi.fn();

vi.mock("@/services/recruiter/persistence", () => ({
  listContentOpportunities: (...a: unknown[]) => mockList(...a),
  getContentOpportunity: (...a: unknown[]) => mockGet(...a),
  updateContentOpportunityStatus: (...a: unknown[]) => mockUpdateStatus(...a),
  deleteContentOpportunity: (...a: unknown[]) => mockDelete(...a),
}));

vi.mock("@/services/recruiter/generation", () => ({
  generatePostFromOpportunity: (...a: unknown[]) => mockGenerateFromOpportunity(...a),
}));

vi.mock("@/services/recruiter", () => ({
  generateContentOpportunitiesForDay: (...a: unknown[]) => mockGenerateForDay(...a),
  generateContentOpportunitiesForCourseMaterial: (...a: unknown[]) => mockGenerateForMaterial(...a),
  selectBestContentOpportunity: (...a: unknown[]) => mockSelectBest(...a),
}));

import {
  deleteContentOpportunityAction,
  generateContentOpportunitiesForCourseMaterialAction,
  generateContentOpportunitiesForDayAction,
  generatePostFromOpportunityAction,
  getContentOpportunityAction,
  listContentOpportunitiesAction,
  selectBestContentOpportunityAction,
  updateContentOpportunityStatusAction,
} from "./content-opportunities";
import { AppError } from "@/lib/utils/errors";

const row = {
  id: "op-1",
  profile_id: "user-1",
  source_type: "journal",
  source_id: "entry-1",
  day_number: 12,
  module_number: null,
  post_type: "PROJECT_SHOWCASE",
  content_goal: "GET_RECRUITER_ATTENTION",
  title: "Building Todos API",
  summary: null,
  evidence: [],
  recruiter_score: 88,
  recruiter_score_breakdown: { total: 88, dimensions: {}, eligible: true, authenticityFlags: [] },
  selection_reason: null,
  status: "candidate" as const,
  dedup_key: "a".repeat(24),
  created_at: "2026-08-27T10:00:00Z",
  updated_at: "2026-08-27T10:00:00Z",
};

describe("content-opportunities server actions (Phase 5B)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates opportunities for a day and returns them without leaking internals", async () => {
    mockGenerateForDay.mockResolvedValue([row]);

    const result = await generateContentOpportunitiesForDayAction({ dayNumber: 12 });

    expect(result).toEqual({ success: true, opportunities: [row], count: 1 });
    expect(mockGenerateForDay).toHaveBeenCalledWith({ dayNumber: 12 });
  });

  it("maps service errors to a plain false result on day generation", async () => {
    mockGenerateForDay.mockRejectedValue(new AppError("Journal entry not found for this day.", { code: "JOURNAL_NOT_FOUND" }));

    const result = await generateContentOpportunitiesForDayAction({ dayNumber: 12 });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Journal entry not found");
  });

  it("generates learning-only opportunities for a course material", async () => {
    mockGenerateForMaterial.mockResolvedValue([]);

    const result = await generateContentOpportunitiesForCourseMaterialAction({
      courseMaterialId: "document-1",
      goal: "DOCUMENT_LEARNING",
    });

    expect(result.success).toBe(true);
    expect(mockGenerateForMaterial).toHaveBeenCalledWith({
      courseMaterialId: "document-1",
      goal: "DOCUMENT_LEARNING",
    });
  });

  it("lists opportunities and keeps get/update/delete thin wrappers", async () => {
    mockList.mockResolvedValue([row]);

    const listed = await listContentOpportunitiesAction({ status: "candidate" });
    expect(listed).toEqual({ success: true, opportunities: [row] });
    expect(mockList).toHaveBeenCalledWith({ status: "candidate" });

    mockGet.mockResolvedValue(row);
    const fetched = await getContentOpportunityAction("op-1");
    expect(fetched).toEqual({ success: true, opportunity: row });

    mockGet.mockResolvedValue(null);
    const missing = await getContentOpportunityAction("op-zz");
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error).toBe("Content opportunity not found.");

    mockUpdateStatus.mockResolvedValue({ ...row, status: "selected" });
    const updated = await updateContentOpportunityStatusAction({
      opportunityId: "op-1",
      status: "selected",
      selectionReason: "Strong evidence",
    });
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.opportunity.status).toBe("selected");

    mockDelete.mockResolvedValue(undefined);
    await expect(deleteContentOpportunityAction("op-1")).resolves.toEqual({ success: true });
  });

  it("selects the best opportunity and reports a concise reason", async () => {
    mockSelectBest.mockResolvedValue({
      row: { ...row, status: "selected", selection_reason: "Recommended because…" },
      reason: "Recommended because…",
      diversityAdjusted: false,
    });

    const result = await selectBestContentOpportunityAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.opportunity?.id).toBe("op-1");
      expect(result.reason).toMatch(/^Recommended because/);
    }
  });

  it("returns a null opportunity when nothing is eligible", async () => {
    mockSelectBest.mockResolvedValue(null);

    const result = await selectBestContentOpportunityAction();

    expect(result).toEqual({
      success: true,
      opportunity: null,
      reason: null,
      diversityAdjusted: false,
    });
  });

  it("never throws — status update failures become friendly false results", async () => {
    mockUpdateStatus.mockRejectedValue(
      new AppError("Status cannot change from \"candidate\" to \"published\".", { code: "INVALID_STATUS" }),
    );

    const result = await updateContentOpportunityStatusAction({
      opportunityId: "op-1",
      status: "published",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Status cannot change");
  });
});

// ─── Post Generation From an Opportunity (Phase 5C) ─────────────────────────

describe("content-opportunities server actions — generatePostFromOpportunityAction (Phase 5C)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const postRow = {
    id: "post-1",
    profile_id: "user-1",
    journal_entry_id: "entry-1",
    day_number: 12,
    status: "draft" as const,
    format: "project" as const,
    opening: "Building Todos API.",
    body: "The API tracks tasks.",
    takeaway: "Endpoints need tests.",
    next_step: "Add pagination.",
    hashtags: ["#FullStackDevelopment", "#105DaysOfCode"],
    image_headline: "Building Todos API",
    image_subheadline: null,
    image_keywords: [],
    image_visual_concept: null,
    image_template: "learner-progress",
    provider: "fallback",
    model: "template-v1",
    tokens_used: null,
    content_hash: "hash-1",
    opportunity_id: "op-1",
    linkedin_post_id: null,
    published_at: null,
    publish_error: null,
    created_at: "2026-08-27T10:00:00Z",
    updated_at: "2026-08-27T10:00:00Z",
  };

  it("returns the generated post with created/duplicate flags on success", async () => {
    mockGenerateFromOpportunity.mockResolvedValue({
      ok: true,
      post: postRow,
      created: true,
      duplicate: false,
    });

    const result = await generatePostFromOpportunityAction("op-1");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.post.id).toBe("post-1");
    expect(result.created).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(mockGenerateFromOpportunity).toHaveBeenCalledWith("op-1");
  });

  it("reports a duplicate cleanly without generating twice", async () => {
    mockGenerateFromOpportunity.mockResolvedValue({
      ok: true,
      post: postRow,
      created: false,
      duplicate: true,
    });

    const result = await generatePostFromOpportunityAction("op-1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.duplicate).toBe(true);
  });

  it("maps service failures to a false result with a stable code", async () => {
    mockGenerateFromOpportunity.mockResolvedValue({
      ok: false,
      code: "INSUFFICIENT_EVIDENCE",
      message: "Project Showcase posts require USER_CONFIRMED evidence.",
    });

    const result = await generatePostFromOpportunityAction("op-1");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.error).toContain("USER_CONFIRMED");
  });

  it("never leaks secrets from an unexpected generation failure", async () => {
    mockGenerateFromOpportunity.mockResolvedValue({
      ok: false,
      code: "GENERATION_FAILED",
      message: "Post generation from this opportunity failed. Please try again.",
    });

    const result = await generatePostFromOpportunityAction("op-1");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe("GENERATION_FAILED");
    expect(result.error).not.toMatch(/sk_|api[_-]?key|token|bearer/i);
    expect(result).not.toHaveProperty("post");
  });
});