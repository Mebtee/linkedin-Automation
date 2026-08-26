"use server";

import {
  deleteOwnCourseMaterial,
  getOwnCourseMaterial,
  getOwnCourseMaterialPages,
  ingestCourseMaterial,
  listOwnCourseMaterials,
  reprocessCourseMaterial,
} from "@/services/course-materials";
import { pdfErrorMessage } from "@/services/course-materials/validation";
import type { CourseJournalProposal, CourseMaterialRow } from "@/types/course-material";

// ─── Course Material Server Actions (Phase 3J) ──────────────────────────────
// Thin wrappers: business logic lives in src/services/course-materials/.
// Actions return plain result objects and never leak internals.

export type UploadCourseMaterialResult =
  | {
      success: true;
      documentId: string;
      fileName: string;
      pageCount: number;
      proposal: CourseJournalProposal;
    }
  | { success: false; error: string };

/**
 * Handles a PDF upload from the client.
 * The file is validated server-side (content sniffing, size limit, duplicate check) —
 * the client MIME type is never trusted.
 */
export async function uploadCourseMaterial(
  formData: FormData,
): Promise<UploadCourseMaterialResult> {
  try {
    const file = formData.get("pdf");
    if (!(file instanceof File)) {
      return { success: false, error: "No PDF file was provided." };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await ingestCourseMaterial(file.name || "course-material.pdf", bytes);

    return {
      success: true,
      documentId: result.documentId,
      fileName: result.fileName,
      pageCount: result.pageCount,
      proposal: result.proposal,
    };
  } catch (err) {
    return { success: false, error: pdfErrorMessage(err) };
  }
}

export type FetchCourseMaterialResult =
  | {
      success: true;
      proposal: CourseJournalProposal;
      fileName: string;
      pageCount: number;
      multiDaySections: readonly { dayNumber: number; startPage: number; endPage: number; confidence: string }[];
    }
  | { success: false; error: string };

/** Reloads a previously processed course material for review. */
export async function fetchCourseMaterial(
  documentId: string,
): Promise<FetchCourseMaterialResult> {
  try {
    const material = await getOwnCourseMaterial(documentId);
    if (!material || material.processing_status !== "completed" || !material.journal_proposal) {
      return { success: false, error: "Course material not found or not processed." };
    }
    return {
      success: true,
      proposal: material.journal_proposal,
      fileName: material.file_name,
      pageCount: material.page_count,
      multiDaySections: material.multi_day_sections ?? [],
    };
  } catch {
    return { success: false, error: "Could not load the course material." };
  }
}

export type DeleteCourseMaterialResult = { success: boolean; error?: string };

export async function deleteCourseMaterial(
  documentId: string,
): Promise<DeleteCourseMaterialResult> {
  try {
    await deleteOwnCourseMaterial(documentId);
    return { success: true };
  } catch {
    return { success: false, error: "Could not delete the course material." };
  }
}

// ─── List Course Materials ─────────────────────────────────────────────────

export type ListCourseMaterialsResult =
  | { success: true; materials: CourseMaterialRow[] }
  | { success: false; error: string };

/**
 * Lists the authenticated user's course materials.
 * Returns safe data (no storage_path exposed to client).
 */
export async function listCourseMaterials(): Promise<ListCourseMaterialsResult> {
  try {
    const materials = await listOwnCourseMaterials();
    return { success: true, materials };
  } catch {
    return { success: false, error: "Could not load course materials." };
  }
}

// ─── Reprocess Course Material ─────────────────────────────────────────────

export type ReprocessCourseMaterialResult =
  | {
      success: true;
      proposal: CourseJournalProposal;
      multiDaySections: readonly { dayNumber: number; startPage: number; endPage: number; confidence: string }[];
    }
  | { success: false; error: string };

/**
 * Re-runs curriculum matching and journal building on an existing course material.
 * Preserves USER_CONFIRMED fields and does not re-extract the PDF.
 */
export async function reprocessCourseMaterialAction(
  documentId: string,
): Promise<ReprocessCourseMaterialResult> {
  try {
    const result = await reprocessCourseMaterial(documentId);
    return {
      success: true,
      proposal: result.proposal,
      multiDaySections: result.multiDaySections,
    };
  } catch (err) {
    return { success: false, error: pdfErrorMessage(err) };
  }
}

// ─── Get Page Text ─────────────────────────────────────────────────────────

export type GetPageTextResult =
  | { success: true; pages: { pageNumber: number; text: string }[] }
  | { success: false; error: string };

/**
 * Returns extracted page text for a course material (for the page preview panel).
 */
export async function getPageText(
  documentId: string,
): Promise<GetPageTextResult> {
  try {
    const pages = await getOwnCourseMaterialPages(documentId);
    return { success: true, pages };
  } catch {
    return { success: false, error: "Could not load page content." };
  }
}
