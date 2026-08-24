"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  uploadCourseMaterial,
} from "@/app/actions/course-materials";
import { saveJournal, submitJournal } from "@/app/actions/journal";
import { TextareaField } from "@/components/journal/textarea-field";
import type {
  CourseJournalProposal,
  JournalFieldSource,
} from "@/types/course-material";

const TOTAL_DAYS = 105;

// ─── Course Materials Workflow ──────────────────────────────────────────────
// Upload PDF → server-side extraction/matching/proposal → user review →
// save draft / submit through the EXISTING journal actions.

type Phase = "idle" | "uploading" | "processing" | "reviewing";

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

function describeSource(source: JournalFieldSource | undefined): string | null {
  if (!source || source.sourceType === "missing") return null;
  const pages =
    source.pageNumbers.length > 0
      ? ` (PDF pages ${source.pageNumbers[0]}${source.pageNumbers.length > 1 ? `–${source.pageNumbers[source.pageNumbers.length - 1]}` : ""})`
      : "";
  if (source.sourceType === "pdf") return `Source: course PDF${pages}`;
  if (source.sourceType === "ai") return `AI summary of course PDF${pages}`;
  if (source.sourceType === "curriculum") return "Suggested from your curriculum";
  return "From your upload";
}

const CONFIDENCE_BADGE: Record<string, { label: string; className: string }> = {
  EXACT: {
    label: "Exact match",
    className: "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
  HIGH: {
    label: "High confidence",
    className: "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
  MEDIUM: {
    label: "Medium confidence",
    className: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  LOW: {
    label: "Low confidence",
    className: "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  },
  UNKNOWN: {
    label: "No match found",
    className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
};

export function CourseMaterialsClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSizeKb, setFileSizeKb] = useState<number>(0);
  const [pageCount, setPageCount] = useState(0);
  const [proposal, setProposal] = useState<CourseJournalProposal | null>(null);

  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [fields, setFields] = useState<EditableFields>(EMPTY_FIELDS);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const statusMessage =
    phase === "uploading"
      ? "Uploading PDF…"
      : phase === "processing"
        ? "Extracting course content and matching it to your curriculum…"
        : undefined;

  const handleFileChange = useCallback(() => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);
    setFileName(file.name);
    setFileSizeKb(Math.round(file.size / 1024));
  }, []);

  const handleUpload = useCallback(async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a PDF file first.");
      return;
    }

    setPhase("uploading");
    setError(null);

    // Small files read instantly; the delay keeps the two-phase state honest.
    const formData = new FormData();
    formData.set("pdf", file);

    setPhase("processing");
    const result = await uploadCourseMaterial(formData);

    if (!result.success) {
      setError(result.error);
      setPhase("idle");
      return;
    }

    setFileName(result.fileName);
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
    setPhase("reviewing");
  }, []);

  const buildSaveInput = useCallback(
    () => ({
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

    router.push(`/journal?day=${selectedDay}`);
  }, [buildSaveInput, confidence, router, selectedDay]);

  const handleReset = useCallback(async () => {
    setPhase("idle");
    setError(null);
    setNotice(null);
    setProposal(null);
    setFileName("");
    setFileSizeKb(0);
    setPageCount(0);
    setFields(EMPTY_FIELDS);
    setConfidence(null);
    setSelectedDay(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const evidenceByField = new Map((proposal?.evidence ?? []).map((e) => [e.field, e]));

  const renderField = (field: keyof EditableFields) => {
    const source = evidenceByField.get(field);
    const sourceText = describeSource(source);
    const missingHint =
      !sourceText && proposal
        ? "Not found in the PDF — please add manually."
        : null;

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
        <p
          aria-live="polite"
          className={`mt-1 text-xs ${sourceText ? "text-zinc-500 dark:text-zinc-400" : "text-amber-600 dark:text-amber-400"}`}
        >
          {sourceText ?? missingHint}
        </p>
      </div>
    );
  };

  const badge = proposal ? CONFIDENCE_BADGE[proposal.matchConfidence] : undefined;

  return (
    <div className="space-y-6">
      {/* Status announcements for assistive tech */}
      <p aria-live="polite" className="sr-only">
        {statusMessage ?? ""}
      </p>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div role="alert" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
          {notice}
        </div>
      )}

      {/* ─── Upload card ─── */}
      <section
        aria-labelledby="cm-upload-heading"
        className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2
          id="cm-upload-heading"
          className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
        >
          Course Material
        </h2>

        <div className="mt-3 space-y-3">
          <label
            htmlFor="cm-file-input"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Course PDF
          </label>
          <input
            ref={fileInputRef}
            id="cm-file-input"
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileChange}
            disabled={phase === "uploading" || phase === "processing"}
            className="block w-full cursor-pointer rounded-lg border border-zinc-300 bg-white text-sm text-zinc-900 file:mr-3 file:cursor-pointer file:rounded-l-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:file:bg-zinc-700 dark:file:text-zinc-200"
          />
          {fileSizeKb > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {fileName} · {fileSizeKb.toLocaleString()} KB
            </p>
          )}

          <button
            type="button"
            onClick={handleUpload}
            disabled={
              phase === "uploading" ||
              phase === "processing" ||
              fileSizeKb === 0
            }
            className="rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1d4ed8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === "uploading"
              ? "Uploading…"
              : phase === "processing"
                ? "Processing…"
                : "Upload & Analyze"}
          </button>
        </div>
      </section>

      {/* ─── Review card ─── */}
      {phase === "reviewing" && proposal && (
        <section
          aria-labelledby="cm-review-heading"
          className="space-y-6 lg:flex lg:items-start lg:gap-6 lg:space-y-0"
        >
          <div className="lg:w-2/5 lg:shrink-0 space-y-6">
            {/* Detected information */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2
                id="cm-review-heading"
                className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
              >
                Detected Curriculum Day
              </h2>

              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500 dark:text-zinc-400">File</dt>
                  <dd className="truncate font-medium text-zinc-900 dark:text-zinc-50">{fileName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500 dark:text-zinc-400">Pages</dt>
                  <dd className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">{pageCount}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500 dark:text-zinc-400">Topic</dt>
                  <dd className="truncate text-right font-medium text-zinc-900 dark:text-zinc-50">
                    {proposal.topic || "—"}
                  </dd>
                </div>
                {proposal.moduleTitle && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500 dark:text-zinc-400">Module</dt>
                    <dd className="text-right font-medium text-zinc-900 dark:text-zinc-50">
                      {proposal.moduleNumber !== null ? `${proposal.moduleNumber} · ` : ""}
                      {proposal.moduleTitle}
                    </dd>
                  </div>
                )}
              </dl>

              {badge && (
                <p className="mt-3">
                  <span className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </p>
              )}

              <ul className="mt-3 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                {proposal.rationale.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>

              <div className="mt-4">
                <label
                  htmlFor="cm-day-select"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Curriculum Day
                </label>
                <select
                  id="cm-day-select"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(Number(e.target.value))}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  <option value={0}>Select a day…</option>
                  {proposal.candidates.length > 0 && (
                    <optgroup label="Suggested matches">
                      {proposal.candidates.map((c) => (
                        <option key={c.dayNumber} value={c.dayNumber}>
                          Day {c.dayNumber} — {c.topic}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="All days">
                    {Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        Day {n}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  The matcher may be wrong — always confirm the day.
                </p>
              </div>
            </div>

            {/* Warnings */}
            {proposal.warnings.length > 0 && (
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
          </div>

          {/* Proposed journal */}
          <div className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Proposed Journal
            </h2>

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
                onClick={handleReset}
                disabled={submitting}
                className="rounded-lg px-5 py-2.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Back
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
