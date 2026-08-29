"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  uploadCourseMaterial,
  listCourseMaterials,
  deleteCourseMaterial,
  reprocessCourseMaterialAction,
  getPageText,
} from "@/app/actions/course-materials";
import { saveJournal, submitJournal } from "@/app/actions/journal";
import type { OpportunityGenerationOutcome } from "@/app/actions/journal";
import { generatePost } from "@/app/actions/post-generation";
import { OpportunitySubmitNotice } from "@/components/opportunities/opportunity-submit-notice";
import { TextareaField } from "@/components/journal/textarea-field";
import { EvidencePanel } from "@/components/course-materials/evidence-panel";
import { PagePreview } from "@/components/course-materials/page-preview";
import { CurriculumMatchPanel } from "@/components/course-materials/curriculum-match-panel";
import type {
  CourseJournalProposal,
  CourseMaterialRow,
  ProcessingStage,
} from "@/types/course-material";
import type { GeneratedPostRow } from "@/types/generated-post";

// ─── Course Materials Dashboard (Phase 3J) ─────────────────────────────────
// Upload PDF → server-side extraction/matching/proposal → user review →
// save draft / submit through the EXISTING journal actions.
// After submission, show post-generation confirmation.

type ViewMode = "dashboard" | "uploading" | "processing" | "reviewing" | "post-submitted";

type EditableFields = {
  whatILearned: string;
  whatIPracticed: string;
  whatIBuilt: string;
  challenge: string;
  howISolvedIt: string;
  keyTakeaway: string;
  tomorrowFocus: string;
  projectName: string;
  projectDescription: string;
  codeReference: string;
  resourcesUsed: string;
  additionalNotes: string;
};

const EMPTY_FIELDS: EditableFields = {
  whatILearned: "",
  whatIPracticed: "",
  whatIBuilt: "",
  challenge: "",
  howISolvedIt: "",
  keyTakeaway: "",
  tomorrowFocus: "",
  projectName: "",
  projectDescription: "",
  codeReference: "",
  resourcesUsed: "",
  additionalNotes: "",
};

const FIELD_LABELS: Record<keyof EditableFields, string> = {
  whatILearned: "What I Learned",
  whatIPracticed: "What I Practiced",
  whatIBuilt: "What I Built",
  challenge: "Challenge",
  howISolvedIt: "How I Solved It",
  keyTakeaway: "Key Takeaway",
  tomorrowFocus: "Tomorrow's Focus",
  projectName: "Project Name",
  projectDescription: "Project Description",
  codeReference: "Code Reference",
  resourcesUsed: "Resources Used",
  additionalNotes: "Additional Notes",
};

const FIELD_ROWS: Record<keyof EditableFields, number> = {
  whatILearned: 6,
  whatIPracticed: 4,
  whatIBuilt: 3,
  challenge: 3,
  howISolvedIt: 3,
  keyTakeaway: 2,
  tomorrowFocus: 2,
  projectName: 1,
  projectDescription: 3,
  codeReference: 2,
  resourcesUsed: 2,
  additionalNotes: 2,
};

const PROCESSING_MESSAGES: Record<string, string> = {
  uploading: "Uploading PDF…",
  validating: "Validating file…",
  extracting: "Extracting text from PDF…",
  matching: "Matching curriculum…",
  building: "Building journal proposal…",
  enhancing: "Enhancing with AI…",
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  uploading: { label: "Uploading", className: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  processing: { label: "Processing", className: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  completed: { label: "Ready", className: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  failed: { label: "Failed", className: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  pending: { label: "Pending", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
};

export function CourseMaterialsClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  // ─── View state ───
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("uploading");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ─── Materials list ───
  const [materials, setMaterials] = useState<CourseMaterialRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // ─── Upload state ───
  const [fileName, setFileName] = useState("");
  const [fileSizeKb, setFileSizeKb] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // ─── Review state ───
  const [pageCount, setPageCount] = useState(0);
  const [proposal, setProposal] = useState<CourseJournalProposal | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [fields, setFields] = useState<EditableFields>(EMPTY_FIELDS);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ─── Page preview ───
  const [pages, setPages] = useState<{ pageNumber: number; text: string }[]>([]);
  const [highlightPage, setHighlightPage] = useState<number | null>(null);

  // ─── Post-submission ───
  const [submittedDay, setSubmittedDay] = useState(0);
  const [generatedPost, setGeneratedPost] = useState<GeneratedPostRow | null>(null);
  const [generatingPost, setGeneratingPost] = useState(false);
  const [opportunityOutcome, setOpportunityOutcome] =
    useState<OpportunityGenerationOutcome | null>(null);

  // ─── Delete confirmation ───
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // ─── Load materials list ───
  const loadMaterials = useCallback(async () => {
    setLoadingList(true);
    const result = await listCourseMaterials();
    if (result.success) {
      setMaterials(result.materials);
    }
    setLoadingList(false);
  }, []);

  useEffect(() => {
    if (viewMode === "dashboard") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadMaterials();
    }
  }, [viewMode, loadMaterials]);

  // ─── Drag and drop handlers ───
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (dragRef.current && !dragRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type === "application/pdf") {
        if (fileInputRef.current) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          fileInputRef.current.files = dataTransfer.files;
        }
        setFileName(file.name);
        setFileSizeKb(Math.round(file.size / 1024));
      }
    },
    [],
  );

  // ─── File selection ───
  const handleFileChange = useCallback(() => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);
    setFileName(file.name);
    setFileSizeKb(Math.round(file.size / 1024));
  }, []);

  // ─── Upload + Process ───
  const handleUpload = useCallback(async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a PDF file first.");
      return;
    }

    setViewMode("uploading");
    setProcessingStage("uploading");
    setError(null);

    // Simulate processing stages for UX feedback
    const stageTimer = setTimeout(() => setProcessingStage("validating"), 300);
    const stageTimer2 = setTimeout(() => setProcessingStage("extracting"), 1000);
    const stageTimer3 = setTimeout(() => setProcessingStage("matching"), 3000);
    const stageTimer4 = setTimeout(() => setProcessingStage("building"), 5000);
    const stageTimer5 = setTimeout(() => setProcessingStage("enhancing"), 7000);

    setViewMode("processing");

    const formData = new FormData();
    formData.set("pdf", file);

    const result = await uploadCourseMaterial(formData);

    clearTimeout(stageTimer);
    clearTimeout(stageTimer2);
    clearTimeout(stageTimer3);
    clearTimeout(stageTimer4);
    clearTimeout(stageTimer5);

    if (!result.success) {
      setError(result.error);
      setViewMode("dashboard");
      return;
    }

    setPageCount(result.pageCount);
    setProposal(result.proposal);
    setSelectedDay(result.proposal.curriculumDay > 0 ? result.proposal.curriculumDay : 0);
    setFields({
      ...EMPTY_FIELDS,
      ...Object.fromEntries(
        Object.entries(result.proposal.journal)
          .filter(([k]) => k !== "confidenceLevel")
          .map(([k, v]) => [k, v === null ? "" : String(v)]),
      ),
    } as EditableFields);
    setConfidence(null);

    // Load page text for preview
    const pageResult = await getPageText(result.documentId);
    if (pageResult.success) {
      setPages(pageResult.pages);
    }

    setProcessingStage("ready");
    setViewMode("reviewing");
  }, []);

  // ─── Build save input ───
  const buildSaveInput = useCallback(
    () => ({
      entryId: undefined as string | undefined,
      dayNumber: selectedDay,
      whatILearned: fields.whatILearned.trim() || undefined,
      whatIPracticed: fields.whatIPracticed.trim() || undefined,
      whatIBuilt: fields.whatIBuilt.trim() || undefined,
      challenge: fields.challenge.trim() || undefined,
      howISolvedIt: fields.howISolvedIt.trim() || undefined,
      keyTakeaway: fields.keyTakeaway.trim() || undefined,
      tomorrowFocus: fields.tomorrowFocus.trim() || undefined,
      projectName: fields.projectName.trim() || undefined,
      projectDescription: fields.projectDescription.trim() || undefined,
      codeReference: fields.codeReference.trim() || undefined,
      resourcesUsed: fields.resourcesUsed.trim() || undefined,
      confidenceLevel: confidence,
      additionalNotes: fields.additionalNotes.trim() || undefined,
    }),
    [fields, selectedDay, confidence],
  );

  // ─── Save Draft ───
  const handleSaveDraft = useCallback(async () => {
    if (selectedDay < 1) {
      setError("Select a curriculum day before saving.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await saveJournal(buildSaveInput());
    setSubmitting(false);

    if (result.success) {
      setNotice(`Draft saved for Day ${selectedDay}. Continue editing anytime in the Journal.`);
    } else {
      setError(result.error ?? "Could not save the draft.");
    }
  }, [buildSaveInput, selectedDay]);

  // ─── Submit ───
  const handleSubmit = useCallback(async () => {
    if (selectedDay < 1) {
      setError("Select a curriculum day before submitting.");
      return;
    }
    if (confidence === null) {
      setError("Choose your confidence level (1–5) before submitting.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const saved = await saveJournal(buildSaveInput());
    if (!saved.success || !saved.entryId) {
      setSubmitting(false);
      setError(saved.error ?? "Could not save the journal entry.");
      return;
    }

    const submitted = await submitJournal({ entryId: saved.entryId });
    if (!submitted.success) {
      setSubmitting(false);
      setError(submitted.error ?? "Could not submit the journal entry.");
      return;
    }

    setSubmittedDay(selectedDay);
    setOpportunityOutcome(submitted.opportunities ?? null);
    setSubmitting(false);
    setViewMode("post-submitted");
  }, [buildSaveInput, confidence, selectedDay]);

  // ─── Generate Post (after submission) ───
  const handleGeneratePost = useCallback(async () => {
    setGeneratingPost(true);
    setError(null);

    const result = await generatePost({ dayNumber: submittedDay });
    setGeneratingPost(false);

    if (result.success) {
      setGeneratedPost(result.post);
    } else {
      setError(result.error.message);
    }
  }, [submittedDay]);

  // ─── Navigate to post editor ───
  const handleViewPost = useCallback(() => {
    if (generatedPost) {
      router.push(`/posts/${generatedPost.id}`);
    }
  }, [generatedPost, router]);

  // ─── Delete material ───
  const handleDelete = useCallback(
    async (documentId: string) => {
      const result = await deleteCourseMaterial(documentId);
      if (result.success) {
        setMaterials((prev) => prev.filter((m) => m.id !== documentId));
        setPendingDeleteId(null);
        setNotice("Course material deleted.");
      } else {
        setError(result.error ?? "Could not delete the course material.");
      }
    },
    [],
  );

  // ─── Review existing material ───
  const handleReviewExisting = useCallback(
    async (material: CourseMaterialRow) => {
      if (!material.journal_proposal || material.processing_status !== "completed") {
        setError("This material is not ready for review.");
        return;
      }

      setPageCount(material.page_count);
      setProposal(material.journal_proposal);
      setSelectedDay(
        material.journal_proposal.curriculumDay > 0
          ? material.journal_proposal.curriculumDay
          : 0,
      );
      setFields({
        ...EMPTY_FIELDS,
        ...Object.fromEntries(
          Object.entries(material.journal_proposal.journal)
            .filter(([k]) => k !== "confidenceLevel")
            .map(([k, v]) => [k, v === null ? "" : String(v)]),
        ),
      } as EditableFields);
      setConfidence(null);

      // Load page text for preview
      const pageResult = await getPageText(material.id);
      if (pageResult.success) {
        setPages(pageResult.pages);
      }

      setViewMode("reviewing");
    },
    [],
  );

  // ─── Reprocess material ───
  const handleReprocess = useCallback(
    async (documentId: string) => {
      setNotice("Reprocessing…");
      const result = await reprocessCourseMaterialAction(documentId);
      if (result.success) {
        setNotice("Reprocessing complete.");
        // Refresh the list
        loadMaterials();
      } else {
        setError(result.error ?? "Could not reprocess the course material.");
      }
    },
    [loadMaterials],
  );

  // ─── Back to dashboard ───
  const handleBackToDashboard = useCallback(() => {
    setViewMode("dashboard");
    setError(null);
    setNotice(null);
    setProposal(null);
    setFileName("");
    setFileSizeKb(0);
    setPages([]);
    setHighlightPage(null);
    setGeneratedPost(null);
    setOpportunityOutcome(null);
    setPageCount(0);
    setFields(EMPTY_FIELDS);
    setConfidence(null);
    setSelectedDay(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ─── Navigate to page in preview ───
  const handleNavigateToPage = useCallback((pageNumber: number) => {
    setHighlightPage(pageNumber);
  }, []);

  // ─── Status message for processing ───
  const statusMessage =
    viewMode === "processing" ? PROCESSING_MESSAGES[processingStage] ?? "Processing…" : undefined;

  const evidenceByField = new Map((proposal?.evidence ?? []).map((e) => [e.field, e]));

  // ─── Render: Dashboard View ───
  if (viewMode === "dashboard") {
    return (
      <div className="space-y-6">
        <p aria-live="polite" className="sr-only">
          {loadingList ? "Loading course materials…" : ""}
        </p>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
            {notice}
          </div>
        )}

        {/* Upload section */}
        <section
          aria-labelledby="cm-upload-heading"
          className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2
            id="cm-upload-heading"
            className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
          >
            Upload Course Material
          </h2>

          <div
            ref={dragRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`mt-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              isDragging
                ? "border-[#2563EB] bg-[#2563EB]/5"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            <svg
              className="mx-auto h-8 w-8 text-zinc-400 dark:text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Drag and drop a PDF here, or{" "}
              <label
                htmlFor="cm-file-input"
                className="cursor-pointer font-medium text-[#2563EB] hover:underline"
              >
                browse
              </label>
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
              PDF files up to 10 MB
            </p>

            <input
              ref={fileInputRef}
              id="cm-file-input"
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileChange}
              className="sr-only"
            />
          </div>

          {fileSizeKb > 0 && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {fileName} · {fileSizeKb.toLocaleString()} KB
            </p>
          )}

          <button
            type="button"
            onClick={handleUpload}
            disabled={fileSizeKb === 0}
            className="mt-3 rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1d4ed8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Upload &amp; Analyze
          </button>
        </section>

        {/* Materials list */}
        <section
          aria-labelledby="cm-list-heading"
          className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2
            id="cm-list-heading"
            className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
          >
            Uploaded Materials
          </h2>

          {loadingList ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
          ) : materials.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              No course materials uploaded yet.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
              {materials.map((material) => {
                const statusBadge = STATUS_BADGES[material.processing_status] ?? STATUS_BADGES.pending!;
                const matchedDay = material.journal_proposal?.curriculumDay;
                const matchedTopic = material.journal_proposal?.topic;

                return (
                  <div
                    key={material.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {material.file_name}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {new Date(material.created_at).toLocaleDateString()} ·{" "}
                        {material.page_count} pages
                        {matchedDay && matchedDay > 0
                          ? ` · Day ${matchedDay}${matchedTopic ? ` — ${matchedTopic}` : ""}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>

                      {material.processing_status === "completed" && material.journal_proposal && (
                        <button
                          type="button"
                          onClick={() => handleReviewExisting(material)}
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        >
                          Review
                        </button>
                      )}

                      {material.processing_status === "completed" && (
                        <button
                          type="button"
                          onClick={() => handleReprocess(material.id)}
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        >
                          Reprocess
                        </button>
                      )}

                      {pendingDeleteId === material.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-red-600 dark:text-red-400">Delete?</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(material.id)}
                            className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(null)}
                            className="rounded bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(material.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ─── Render: Processing View ───
  if (viewMode === "processing" || viewMode === "uploading") {
    return (
      <div className="space-y-6">
        <p aria-live="polite" className="sr-only">
          {statusMessage}
        </p>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {statusMessage}
            </p>
          </div>

          {/* Processing stage indicators */}
          <div className="mt-4 space-y-2">
            {(["uploading", "validating", "extracting", "matching", "building", "enhancing"] as const).map(
              (stage) => {
                const stageIndex = ["uploading", "validating", "extracting", "matching", "building", "enhancing"].indexOf(stage);
                const currentIndex = ["uploading", "validating", "extracting", "matching", "building", "enhancing"].indexOf(processingStage);
                const isComplete = stageIndex < currentIndex;
                const isCurrent = stageIndex === currentIndex;

                return (
                  <div key={stage} className="flex items-center gap-2">
                    {isComplete ? (
                      <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : isCurrent ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-zinc-300 dark:border-zinc-600" />
                    )}
                    <span
                      className={`text-xs ${
                        isCurrent
                          ? "font-medium text-zinc-900 dark:text-zinc-50"
                          : isComplete
                            ? "text-green-600 dark:text-green-400"
                            : "text-zinc-400 dark:text-zinc-600"
                      }`}
                    >
                      {PROCESSING_MESSAGES[stage]}
                    </span>
                  </div>
                );
              },
            )}
          </div>
        </section>
      </div>
    );
  }

  // ─── Render: Post-Submitted View ───
  if (viewMode === "post-submitted") {
    return (
      <div className="space-y-6">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        {opportunityOutcome && (
          <OpportunitySubmitNotice
            outcome={opportunityOutcome}
            dayNumber={submittedDay}
          />
        )}

        <section className="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/20">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-green-800 dark:text-green-300">
            Journal Submitted Successfully
          </h2>
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Your journal entry for Day {submittedDay} has been submitted.
          </p>

          <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Next Step
            </h3>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
              Generate your LinkedIn post from this journal.
            </p>

            <dl className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500 dark:text-zinc-400">Day</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">{submittedDay}</dd>
              </div>
              {proposal && (
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500 dark:text-zinc-400">Topic</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-50">{proposal.topic}</dd>
                </div>
              )}
            </dl>

            <div className="mt-4 flex gap-2">
              {generatedPost ? (
                <button
                  type="button"
                  onClick={handleViewPost}
                  className="rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1d4ed8]"
                >
                  View Post
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGeneratePost}
                  disabled={generatingPost}
                  className="rounded-lg bg-[#0F172A] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-[#0F172A] dark:hover:bg-zinc-200"
                >
                  {generatingPost ? "Generating…" : "Generate Post"}
                </button>
              )}
              <button
                type="button"
                onClick={handleBackToDashboard}
                className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ─── Render: Review View ───
  const renderField = (field: keyof EditableFields) => {
    const source = evidenceByField.get(field);
    const isMissing = source?.confidence === "MISSING";

    return (
      <div key={field}>
        <TextareaField
          id={`cm-${field}`}
          label={FIELD_LABELS[field]}
          value={fields[field]}
          onChange={(value) => setFields((prev) => ({ ...prev, [field]: value }))}
          rows={FIELD_ROWS[field]}
          maxLength={5000}
        />
        <EvidencePanel source={source} onNavigateToPage={handleNavigateToPage} />
        {isMissing && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Not found in the course material. Please provide this yourself.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <p aria-live="polite" className="sr-only">
        Reviewing proposal for {fileName}
      </p>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
          {notice}
        </div>
      )}

      {/* Warnings */}
      {proposal && proposal.warnings.length > 0 && (
        <div
          role="note"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            Please review carefully
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-800 dark:text-amber-200">
            {proposal.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main content area */}
      {proposal && (
        <div className="space-y-6 lg:flex lg:items-start lg:gap-6 lg:space-y-0">
          {/* Left sidebar: metadata + curriculum match + page preview */}
          <div className="lg:w-2/5 lg:shrink-0 space-y-6">
            {/* File info */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <dl className="space-y-1 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500 dark:text-zinc-400">File</dt>
                  <dd className="truncate font-medium text-zinc-900 dark:text-zinc-50">{fileName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500 dark:text-zinc-400">Pages</dt>
                  <dd className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">{pageCount}</dd>
                </div>
              </dl>
            </div>

            {/* Curriculum match */}
            <CurriculumMatchPanel
              proposal={proposal}
              selectedDay={selectedDay}
              onDayChange={setSelectedDay}
            />

            {/* Page preview */}
            {pages.length > 0 && (
              <PagePreview
                pages={pages}
                highlightPage={highlightPage}
                onNavigateToPage={handleNavigateToPage}
              />
            )}
          </div>

          {/* Right: proposed journal fields */}
          <div className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Proposed Journal
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              This proposal was generated from the course PDF. Review it before saving or submitting.
            </p>

            <fieldset className="mt-4 space-y-4" disabled={submitting}>
              {(
                Object.keys(FIELD_LABELS) as Array<keyof EditableFields>
              ).map(renderField)}

              {/* Confidence picker */}
              <div>
                <p id="cm-confidence-label" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Confidence Level <span className="ml-0.5 text-red-500">*</span>
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Never guessed from the PDF — choose how confident you feel (1 = low, 5 = high).
                </p>
                <div
                  role="radiogroup"
                  aria-labelledby="cm-confidence-label"
                  className="mt-2 flex gap-2"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={confidence === n}
                      onClick={() => setConfidence(confidence === n ? null : n)}
                      className={`h-9 w-9 rounded-lg border text-sm font-medium transition-colors ${
                        confidence === n
                          ? "border-[#2563EB] bg-[#2563EB] text-white"
                          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </fieldset>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-lg bg-[#0F172A] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-[#0F172A] dark:hover:bg-zinc-200"
              >
                {submitting ? "Submitting…" : "Submit Journal"}
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={submitting}
                className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Accept &amp; Save Draft
              </button>
              <button
                type="button"
                onClick={handleBackToDashboard}
                disabled={submitting}
                className="rounded-lg px-5 py-2.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
