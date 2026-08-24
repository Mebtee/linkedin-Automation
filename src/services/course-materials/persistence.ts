import "server-only";

import { randomUUID } from "crypto";

import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/utils/errors";
import type {
  CourseJournalProposal,
  CourseMaterialRow,
  ExtractedPdfDocument,
} from "@/types/course-material";
import type { CurriculumDayRow, ModuleRow } from "@/services/curriculum/dayProgress";
import { analyzePages, extractPdfText } from "./extraction";
import { matchCurriculum } from "./matching";
import { buildJournalFromCourseMaterial } from "./journal-builder";
import { enhanceProposalWithAI } from "./ai-enhance";
import { validatePdfUpload } from "./validation";
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
 * validate → persist record → store PDF (private) → extract text per page →
 * persist pages → match curriculum → build proposal → optional AI enhancement
 * → persist proposal.
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

    const { error: completeError } = await supabase
      .from("course_materials")
      .update({
        processing_status: "completed",
        page_count: doc.pageCount,
        journal_proposal: proposal,
      })
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

  await supabase.storage.from(BUCKET).remove([material.storage_path]);
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
