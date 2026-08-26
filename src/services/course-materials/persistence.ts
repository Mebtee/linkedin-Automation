import "server-only";

import { randomUUID } from "crypto";

import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/utils/errors";
import type {
  CourseJournalProposal,
  CourseMaterialRow,
  ExtractedPdfDocument,
  ExtractedPdfPage,
} from "@/types/course-material";
import type { CurriculumDayRow, ModuleRow } from "@/services/curriculum/dayProgress";
import { analyzePages, extractPdfText } from "./extraction";
import { matchCurriculum } from "./matching";
import { detectDaySections } from "./multi-day";
import { buildJournalFromCourseMaterial } from "./journal-builder";
import { enhanceProposalWithAI } from "./ai-enhance";
import { validatePdfUpload, computeContentHash } from "./validation";
import { brand } from "@/config/brand";

// ─── Course Material Ingestion & Persistence ────────────────────────────────
// All ownership derives from the authenticated session — profile_id can never
// be supplied by the client. The bucket is private and owner-path-scoped.

const BUCKET = "course-materials";

export type IngestResult = {
  readonly documentId: string;
  readonly fileName: string;
  readonly pageCount: number;
  readonly proposal: CourseJournalProposal;
};

/**
 * Full ingestion pipeline:
 * validate → compute hash → check duplicate → persist record → store PDF (private) →
 * extract text per page → persist pages → match curriculum → detect multi-day →
 * build proposal → optional AI enhancement → persist proposal.
 */
export async function ingestCourseMaterial(
  fileName: string,
  bytes: Uint8Array,
): Promise<IngestResult> {
  const validated = validatePdfUpload({ fileName, bytes });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("Authentication required.", { code: "AUTH_REQUIRED" });
  }

  // ── Compute content hash for duplicate detection ──
  const contentHash = await computeContentHash(validated.bytes);

  // ── Check for duplicate upload (same user + same content) ──
  const { data: existingDuplicate } = await supabase
    .from("course_materials")
    .select("id, file_name")
    .eq("profile_id", user.id)
    .eq("content_hash", contentHash)
    .in("processing_status", ["completed", "processing"])
    .limit(1)
    .single();

  if (existingDuplicate) {
    throw new AppError(
      "This course material has already been uploaded.",
      { code: "PDF_DUPLICATE" },
    );
  }

  const documentId = randomUUID();
  const storagePath = `${user.id}/${documentId}/${validated.fileName}`;

  // ── Persist the record first so pages/RLS scope exist ──
  const { data: material, error: insertError } = await supabase
    .from("course_materials")
    .insert({
      id: documentId,
      profile_id: user.id,
      file_name: validated.fileName,
      storage_path: "",
      page_count: 0,
      processing_status: "processing",
      content_hash: contentHash,
    })
    .select()
    .single();

  if (insertError || !material) {
    throw new AppError("Could not save the course material record.", {
      code: "COURSE_MATERIAL_DB_ERROR",
      cause: insertError,
    });
  }

  try {
    // ── Store the original PDF (private bucket, owner-scoped path) ──
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, validated.bytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (uploadError) {
      throw new AppError("Could not store the uploaded PDF.", {
        code: "PDF_STORAGE_FAILED",
        cause: uploadError,
      });
    }

    const { error: pathUpdateError } = await supabase
      .from("course_materials")
      .update({ storage_path: storagePath })
      .eq("id", documentId);
    if (pathUpdateError) {
      throw new AppError("Could not finalize the course material record.", {
        code: "COURSE_MATERIAL_DB_ERROR",
        cause: pathUpdateError,
      });
    }

    // ── Extract text server-side ──
    const doc: ExtractedPdfDocument = await extractPdfText(
      validated.fileName,
      validated.bytes,
    );
    const structures = analyzePages(doc);

    const { error: pagesError } = await supabase
      .from("course_material_pages")
      .insert(
        structures.map((p) => ({
          course_material_id: documentId,
          page_number: p.pageNumber,
          extracted_text: p.text,
        })),
      );
    if (pagesError) {
      throw new AppError("Could not save extracted course content.", {
        code: "COURSE_MATERIAL_DB_ERROR",
        cause: pagesError,
      });
    }

    // ── Match against the existing curriculum ──
    const [days, modules] = await Promise.all([
      loadCurriculumDays(supabase),
      loadModules(supabase),
    ]);
    const source = { days, modules };

    const match = matchCurriculum(doc, structures, source, brand.totalDays);

    // ── Detect multi-day sections ──
    const multiDaySections = detectDaySections(doc, structures, source, brand.totalDays);

    let proposal = buildJournalFromCourseMaterial({
      doc,
      structures,
      match,
      source,
      totalDays: brand.totalDays,
    });

    // ── Optional AI refinement (never breaks the flow) ──
    try {
      proposal = await enhanceProposalWithAI(proposal, doc);
    } catch {
      // Enhancement is best-effort by design; deterministic result stands.
    }

    const updateData: Record<string, unknown> = {
      processing_status: "completed",
      page_count: doc.pageCount,
      journal_proposal: proposal,
    };
    if (multiDaySections.length > 0) {
      updateData.multi_day_sections = multiDaySections;
    }

    const { error: completeError } = await supabase
      .from("course_materials")
      .update(updateData)
      .eq("id", documentId);
    if (completeError) {
      throw new AppError("Could not save the processing result.", {
        code: "COURSE_MATERIAL_DB_ERROR",
        cause: completeError,
      });
    }

    return {
      documentId,
      fileName: validated.fileName,
      pageCount: doc.pageCount,
      proposal,
    };
  } catch (err) {
    // Best-effort failure marking — never masks the original error.
    const code =
      err instanceof AppError ? err.code : "COURSE_MATERIAL_PROCESSING_FAILED";
    await supabase
      .from("course_materials")
      .update({ processing_status: "failed", error_code: String(code) })
      .eq("id", documentId)
      .then(undefined, () => undefined);

    throw err;
  }
}

// ─── Reprocessing ──────────────────────────────────────────────────────────

export type ReprocessResult = {
  readonly proposal: CourseJournalProposal;
  readonly multiDaySections: readonly { dayNumber: number; startPage: number; endPage: number; confidence: string }[];
};

/**
 * Reprocessing re-runs curriculum matching and journal building on the
 * already-extracted page text. It does NOT re-read or re-extract the PDF.
 *
 * USER_CONFIRMED fields from the existing proposal are preserved.
 * The original document ID, profile ID, and storage path are unchanged.
 */
export async function reprocessCourseMaterial(
  documentId: string,
): Promise<ReprocessResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("Authentication required.", { code: "AUTH_REQUIRED" });
  }

  // ── Load the existing material (owner-only via RLS) ──
  const { data: material, error: loadError } = await supabase
    .from("course_materials")
    .select("*")
    .eq("id", documentId)
    .eq("profile_id", user.id)
    .single();

  if (loadError || !material) {
    throw new AppError("Course material not found.", { code: "COURSE_MATERIAL_NOT_FOUND" });
  }

  // ── Load extracted pages from the database ──
  const { data: pageRows, error: pagesError } = await supabase
    .from("course_material_pages")
    .select("page_number, extracted_text")
    .eq("course_material_id", documentId)
    .order("page_number");

  if (pagesError || !pageRows || pageRows.length === 0) {
    throw new AppError("No extracted pages found for this course material.", {
      code: "COURSE_MATERIAL_NO_PAGES",
    });
  }

  // ── Reconstruct the document from stored pages ──
  const pages: ExtractedPdfPage[] = pageRows.map((p) => ({
    pageNumber: p.page_number,
    text: p.extracted_text,
  }));

  const doc: ExtractedPdfDocument = {
    fileName: material.file_name,
    pageCount: pages.length,
    pages,
  };

  const structures = analyzePages(doc);

  // ── Load curriculum data ──
  const [days, modules] = await Promise.all([
    loadCurriculumDays(supabase),
    loadModules(supabase),
  ]);
  const source = { days, modules };

  // ── Re-run matching ──
  const match = matchCurriculum(doc, structures, source, brand.totalDays);

  // ── Re-run multi-day detection ──
  const multiDaySections = detectDaySections(doc, structures, source, brand.totalDays);

  // ── Build fresh proposal ──
  let proposal = buildJournalFromCourseMaterial({
    doc,
    structures,
    match,
    source,
    totalDays: brand.totalDays,
  });

  // ── Preserve USER_CONFIRMED fields from existing proposal ──
  const existingProposal = material.journal_proposal as CourseJournalProposal | null;
  if (existingProposal) {
    proposal = preserveUserConfirmedFields(existingProposal, proposal);
  }

  // ── Optional AI refinement ──
  try {
    const enhancedProposal = await enhanceProposalWithAI(proposal, doc);
    // Only use enhanced result if it didn't overwrite USER_CONFIRMED fields
    proposal = preserveUserConfirmedFields(proposal, enhancedProposal);
  } catch {
    // Enhancement is best-effort by design; deterministic result stands.
  }

  // ── Persist the updated proposal ──
  const updateData: Record<string, unknown> = {
    journal_proposal: proposal,
  };
  if (multiDaySections.length > 0) {
    updateData.multi_day_sections = multiDaySections;
  }

  const { error: updateError } = await supabase
    .from("course_materials")
    .update(updateData)
    .eq("id", documentId);

  if (updateError) {
    throw new AppError("Could not save the reprocessed result.", {
      code: "COURSE_MATERIAL_DB_ERROR",
      cause: updateError,
    });
  }

  return {
    proposal,
    multiDaySections,
  };
}

// ─── USER_CONFIRMED Preservation ───────────────────────────────────────────

/**
 * Ensures that USER_CONFIRMED fields from the old proposal are never
 * overwritten by a new proposal. This enforces the field priority:
 * USER_CONFIRMED > SUPPORTED_BY_PDF > INFERRED_FROM_STRUCTURE > MISSING
 */
function preserveUserConfirmedFields(
  oldProposal: CourseJournalProposal,
  newProposal: CourseJournalProposal,
): CourseJournalProposal {
  const oldEvidenceMap = new Map(oldProposal.evidence.map((e) => [e.field, e]));

  // Find all fields that were USER_CONFIRMED in the old proposal
  const userConfirmedFields = new Set<string>();
  for (const [field, evidence] of oldEvidenceMap) {
    if (evidence.confidence === "USER_CONFIRMED") {
      userConfirmedFields.add(field);
    }
  }

  if (userConfirmedFields.size === 0) return newProposal;

  // Restore USER_CONFIRMED values in the journal
  const preservedJournal = { ...newProposal.journal };
  const journalKeys = Object.keys(preservedJournal) as Array<keyof typeof preservedJournal>;

  for (const key of journalKeys) {
    if (userConfirmedFields.has(key)) {
      const oldValue = (oldProposal.journal as Record<string, unknown>)[key];
      (preservedJournal as Record<string, unknown>)[key] = oldValue;
    }
  }

  // Restore USER_CONFIRMED evidence entries
  const preservedEvidence = newProposal.evidence.map((e) => {
    if (userConfirmedFields.has(e.field)) {
      return oldEvidenceMap.get(e.field) ?? e;
    }
    return e;
  });

  // Restore missing fields list (don't mark preserved fields as missing)
  const preservedMissing = newProposal.missingFields.filter(
    (f) => !userConfirmedFields.has(f),
  );

  return {
    ...newProposal,
    journal: preservedJournal,
    evidence: preservedEvidence,
    missingFields: preservedMissing,
  };
}

// ─── Extracted Pages Access ────────────────────────────────────────────────

/** Returns extracted text for a specific page (owner-only). */
export async function getOwnCourseMaterialPage(
  documentId: string,
  pageNumber: number,
): Promise<{ pageNumber: number; text: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Verify ownership through the parent record
  const { data: material } = await supabase
    .from("course_materials")
    .select("id")
    .eq("id", documentId)
    .eq("profile_id", user.id)
    .single();

  if (!material) return null;

  const { data } = await supabase
    .from("course_material_pages")
    .select("page_number, extracted_text")
    .eq("course_material_id", documentId)
    .eq("page_number", pageNumber)
    .single();

  if (!data) return null;

  return {
    pageNumber: data.page_number,
    text: data.extracted_text,
  };
}

/** Returns all extracted pages for a course material (owner-only). */
export async function getOwnCourseMaterialPages(
  documentId: string,
): Promise<{ pageNumber: number; text: string }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Verify ownership
  const { data: material } = await supabase
    .from("course_materials")
    .select("id")
    .eq("id", documentId)
    .eq("profile_id", user.id)
    .single();

  if (!material) return [];

  const { data } = await supabase
    .from("course_material_pages")
    .select("page_number, extracted_text")
    .eq("course_material_id", documentId)
    .order("page_number");

  if (!data) return [];

  return data.map((p) => ({
    pageNumber: p.page_number,
    text: p.extracted_text,
  }));
}

// ─── Curriculum Data Loading ───────────────────────────────────────────────

async function loadCurriculumDays(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CurriculumDayRow[]> {
  const { data, error } = await supabase
    .from("curriculum_days")
    .select("*")
    .order("day_number");
  if (error || !data) {
    throw new AppError("Could not load the curriculum for matching.", {
      code: "CURRICULUM_NOT_FOUND",
      cause: error,
    });
  }
  return data as CurriculumDayRow[];
}

async function loadModules(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ModuleRow[]> {
  const { data, error } = await supabase.from("modules").select("*").order("module_number");
  if (error || !data) {
    throw new AppError("Could not load modules for matching.", {
      code: "CURRICULUM_NOT_FOUND",
      cause: error,
    });
  }
  return data as ModuleRow[];
}

// ─── Owner-Scoped Queries ─────────────────────────────────────────────────

/** Lists the signed-in user's own course materials, newest first. */
export async function listOwnCourseMaterials(): Promise<CourseMaterialRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("course_materials")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return (data as CourseMaterialRow[]) ?? [];
}

/** Fetches one of the user's own proposals by document id. */
export async function getOwnCourseMaterial(
  documentId: string,
): Promise<CourseMaterialRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("course_materials")
    .select("*")
    .eq("id", documentId)
    .eq("profile_id", user.id)
    .single();

  return (data as CourseMaterialRow) ?? null;
}

/** Removes a stored PDF object and its rows (owner-only). */
export async function deleteOwnCourseMaterial(documentId: string): Promise<void> {
  const supabase = await createClient();
  const material = await getOwnCourseMaterial(documentId);
  if (!material) {
    throw new AppError("Course material not found.", { code: "COURSE_MATERIAL_NOT_FOUND" });
  }

  // Remove storage object (pages cascade-delete via FK)
  if (material.storage_path) {
    await supabase.storage.from(BUCKET).remove([material.storage_path]);
  }

  const { error } = await supabase
    .from("course_materials")
    .delete()
    .eq("id", documentId);
  if (error) {
    throw new AppError("Could not delete the course material.", {
      code: "COURSE_MATERIAL_DB_ERROR",
      cause: error,
    });
  }
}
