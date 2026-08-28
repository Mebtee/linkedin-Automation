// ─── Content Opportunity Persistence (Phase 5B) ──────────────────────────────
// Owner-scoped database access for `content_opportunities`.
//
// Conventions (same as generated-posts/journal services):
//   - Reads are safe for anonymous sessions (return [] / null).
//   - Writes require authentication (AppError AUTH_REQUIRED).
//   - Ownership is enforced both here (profile_id filters with auth.uid())
//     and in the database (owner-only RLS policies).
//
// Security boundary: profile_id always comes from the authenticated session,
// never from client/runtime input.

import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/utils/errors";
import type {
  ContentOpportunityRow,
  ContentOpportunitySourceKind,
  ContentOpportunityStatus,
  CreateContentOpportunityInput,
} from "@/types/content-opportunity";
import {
  validateCreateOpportunityInput,
  validateOpportunitySourceType,
  validateOpportunityStatus,
  validateOpportunityStatusTransition,
} from "./validation";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function requireAuth(supabase: SupabaseClient): Promise<{ id: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("Authentication required.", { code: "AUTH_REQUIRED" });
  }

  return user;
}

async function loadOwnOpportunity(
  supabase: SupabaseClient,
  userId: string,
  opportunityId: string,
): Promise<ContentOpportunityRow> {
  const { data, error } = await supabase
    .from("content_opportunities")
    .select("*")
    .eq("id", opportunityId)
    .eq("profile_id", userId)
    .single();

  if (error || !data) {
    throw new AppError("Content opportunity not found.", {
      code: "OPPORTUNITY_NOT_FOUND",
    });
  }

  return data as ContentOpportunityRow;
}

type PersistedCreateInput = Omit<CreateContentOpportunityInput, "dedup_key"> & {
  readonly profile_id: string;
  readonly dedup_key: string | null;
};

function withProfileId(
  userId: string,
  input: ReturnType<typeof validateCreateOpportunityInput>,
): PersistedCreateInput {
  return { ...input, profile_id: userId };
}

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * Batch-creates opportunities, skipping rows whose (profile_id, dedup_key)
 * already exist. This keeps re-generating a day idempotent: identical
 * evidence never produces duplicate rows.
 */
export async function createContentOpportunities(
  rows: readonly CreateContentOpportunityInput[],
): Promise<ContentOpportunityRow[]> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  const validated = rows.map((row) =>
    withProfileId(user.id, validateCreateOpportunityInput(row)),
  );
  if (validated.length === 0) return [];

  const { data, error } = await supabase
    .from("content_opportunities")
    .upsert(validated, {
      onConflict: "profile_id,dedup_key",
      ignoreDuplicates: true,
    })
    .select();

  if (error) {
    throw new AppError("Failed to create content opportunities.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }

  return (data ?? []) as ContentOpportunityRow[];
}

export async function createContentOpportunity(
  input: CreateContentOpportunityInput,
): Promise<ContentOpportunityRow> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  const validated = validateCreateOpportunityInput(input);

  const { data, error } = await supabase
    .from("content_opportunities")
    .insert(withProfileId(user.id, validated))
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new AppError("This content opportunity already exists.", {
        code: "DUPLICATE_OPPORTUNITY",
      });
    }
    throw new AppError("Failed to create content opportunity.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }

  return data as ContentOpportunityRow;
}

export type ListContentOpportunitiesOptions = {
  readonly status?: ContentOpportunityStatus;
  readonly sourceType?: ContentOpportunitySourceKind;
  readonly dayNumber?: number;
  readonly limit?: number;
};

export async function listContentOpportunities(
  options: ListContentOpportunitiesOptions = {},
): Promise<ContentOpportunityRow[]> {
  const supabase = await createClient();

  let userId: string;
  try {
    const user = await requireAuth(supabase);
    userId = user.id;
  } catch {
    return [];
  }

  let query = supabase
    .from("content_opportunities")
    .select("*")
    .eq("profile_id", userId)
    .order("recruiter_score", { ascending: false })
    .order("created_at", { ascending: false });

  if (options.status !== undefined) {
    query = query.eq("status", validateOpportunityStatus(options.status));
  }
  if (options.sourceType !== undefined) {
    query = query.eq("source_type", validateOpportunitySourceType(options.sourceType));
  }
  if (options.dayNumber !== undefined) {
    const day = Number(options.dayNumber);
    if (!Number.isInteger(day) || day < 1 || day > 105) {
      throw new AppError("day_number must be between 1 and 105.", {
        code: "VALIDATION_ERROR",
      });
    }
    query = query.eq("day_number", day);
  }

  const limit = options.limit === undefined ? 100 : options.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError("limit must be an integer between 1 and 100.", {
      code: "VALIDATION_ERROR",
    });
  }
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    throw new AppError("Failed to fetch content opportunities.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }

  return (data ?? []) as ContentOpportunityRow[];
}

export async function getContentOpportunity(
  opportunityId: string,
): Promise<ContentOpportunityRow | null> {
  const supabase = await createClient();

  let userId: string;
  try {
    const user = await requireAuth(supabase);
    userId = user.id;
  } catch {
    return null;
  }

  const { data, error } = await supabase
    .from("content_opportunities")
    .select("*")
    .eq("id", opportunityId)
    .eq("profile_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as ContentOpportunityRow;
}

export async function updateContentOpportunityStatus(
  opportunityId: string,
  newStatus: ContentOpportunityStatus,
  selectionReason?: string | null,
): Promise<ContentOpportunityRow> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  const existing = await loadOwnOpportunity(supabase, user.id, opportunityId);
  const validatedStatus = validateOpportunityStatus(newStatus);
  validateOpportunityStatusTransition(existing.status, validatedStatus);

  const fieldsToUpdate: Record<string, unknown> = { status: validatedStatus };
  if (selectionReason !== undefined) {
    fieldsToUpdate.selection_reason =
      selectionReason === null ? null : selectionReason.trim().slice(0, 500) || null;
  }

  const { data, error } = await supabase
    .from("content_opportunities")
    .update(fieldsToUpdate)
    .eq("id", opportunityId)
    .eq("profile_id", user.id)
    .select()
    .single();

  if (error) {
    throw new AppError("Failed to update content opportunity status.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }

  return data as ContentOpportunityRow;
}

export async function deleteContentOpportunity(opportunityId: string): Promise<void> {
  const supabase = await createClient();
  const user = await requireAuth(supabase);

  const existing = await loadOwnOpportunity(supabase, user.id, opportunityId);
  if (existing.status === "published") {
    throw new AppError("Cannot delete a published content opportunity.", {
      code: "INVALID_STATUS",
    });
  }

  const { error } = await supabase
    .from("content_opportunities")
    .delete()
    .eq("id", opportunityId)
    .eq("profile_id", user.id);

  if (error) {
    throw new AppError("Failed to delete content opportunity.", {
      code: "DATABASE_ERROR",
      cause: error,
    });
  }
}