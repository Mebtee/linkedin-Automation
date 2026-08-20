import type { PostFormat } from "@/types/ai";

// ─── Status ──────────────────────────────────────────────────────────────────

export type GeneratedPostStatus = "draft" | "approved" | "published" | "failed";

// ─── Database Row Type ───────────────────────────────────────────────────────

export type GeneratedPostRow = {
  readonly id: string;
  readonly profile_id: string;
  readonly journal_entry_id: string;
  readonly day_number: number;
  readonly status: GeneratedPostStatus;
  readonly format: PostFormat;
  readonly opening: string;
  readonly body: string;
  readonly takeaway: string;
  readonly next_step: string;
  readonly hashtags: string[];
  readonly image_headline: string | null;
  readonly image_subheadline: string | null;
  readonly image_keywords: string[] | null;
  readonly image_visual_concept: string | null;
  readonly image_template: string | null;
  readonly provider: string;
  readonly model: string;
  readonly tokens_used: number | null;
  readonly content_hash: string;
  readonly linkedin_post_id: string | null;
  readonly published_at: string | null;
  readonly publish_error: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

// ─── Create Input ────────────────────────────────────────────────────────────

export type CreateGeneratedPostInput = {
  readonly journal_entry_id: string;
  readonly day_number: number;
  readonly format: PostFormat;
  readonly opening: string;
  readonly body: string;
  readonly takeaway: string;
  readonly next_step: string;
  readonly hashtags: readonly string[];
  readonly image_headline?: string | null;
  readonly image_subheadline?: string | null;
  readonly image_keywords?: readonly string[] | null;
  readonly image_visual_concept?: string | null;
  readonly image_template?: string | null;
  readonly provider: string;
  readonly model: string;
  readonly tokens_used?: number | null;
  readonly content_hash: string;
};

// ─── Update Input ────────────────────────────────────────────────────────────

export type UpdateGeneratedPostInput = {
  readonly status?: GeneratedPostStatus;
  readonly opening?: string;
  readonly body?: string;
  readonly takeaway?: string;
  readonly next_step?: string;
  readonly hashtags?: readonly string[];
  readonly image_headline?: string | null;
  readonly image_subheadline?: string | null;
  readonly image_keywords?: readonly string[] | null;
  readonly image_visual_concept?: string | null;
  readonly image_template?: string | null;
  readonly content_hash?: string;
};

// ─── Enriched Types ──────────────────────────────────────────────────────────

export type GeneratedPostWithJournal = GeneratedPostRow & {
  readonly daily_learning_entries: {
    readonly what_i_learned: string | null;
    readonly what_i_practiced: string | null;
    readonly what_i_built: string | null;
    readonly challenge: string | null;
    readonly key_takeaway: string | null;
    readonly confidence_level: number | null;
  } | null;
};

// ─── Status Transition Map ───────────────────────────────────────────────────

export const ALLOWED_POST_STATUS_TRANSITIONS: Record<
  GeneratedPostStatus,
  readonly GeneratedPostStatus[]
> = {
  draft: ["approved", "failed"],
  approved: ["published"],
  published: [],
  failed: [],
} as const;

// ─── Valid Post Formats ──────────────────────────────────────────────────────

export const VALID_POST_FORMATS: readonly PostFormat[] = [
  "what-i-learned",
  "challenge",
  "small-win",
  "project",
  "concept",
  "reflection",
  "practical-lesson",
] as const;
