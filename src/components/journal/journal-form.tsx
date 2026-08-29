"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { TextareaField } from "@/components/journal/textarea-field";
import { StatusBadge } from "@/components/journal/status-badge";
import { ConfirmDialog } from "@/components/journal/confirm-dialog";
import { DayNavigation } from "@/components/journal/day-navigation";
import { CurriculumDisplay } from "@/components/journal/curriculum-display";
import { saveJournal, submitJournal } from "@/app/actions/journal";
import type { OpportunityGenerationOutcome } from "@/app/actions/journal";
import { OpportunitySubmitNotice } from "@/components/opportunities/opportunity-submit-notice";
import type { JournalEntry, JournalEntryStatus } from "@/types/journal";
import type { CurriculumDayRow, ModuleRow } from "@/services/curriculum";

type JournalFormProps = {
  entry: JournalEntry | null;
  curriculumDay: CurriculumDayRow | null;
  currentModule: ModuleRow | null;
  dayNumber: number;
  totalDays: number;
};

type Toast = {
  type: "success" | "error";
  message: string;
};

const CONFIDENCE_LEVELS = [
  { value: 1, label: "Need more practice", emoji: "🔴" },
  { value: 2, label: "Still learning", emoji: "🟠" },
  { value: 3, label: "Getting comfortable", emoji: "🟡" },
  { value: 4, label: "Good understanding", emoji: "🟢" },
  { value: 5, label: "Very confident", emoji: "✅" },
] as const;

export function JournalForm({
  entry,
  curriculumDay,
  currentModule,
  dayNumber,
  totalDays,
}: JournalFormProps) {
  const router = useRouter();

  const [entryId, setEntryId] = useState<string | null>(entry?.id ?? null);
  const [status, setStatus] = useState<JournalEntryStatus | null>(
    entry?.status ?? null,
  );

  const [whatILearned, setWhatILearned] = useState(entry?.what_i_learned ?? "");
  const [whatIPracticed, setWhatIPracticed] = useState(
    entry?.what_i_practiced ?? "",
  );
  const [whatIBuilt, setWhatIBuilt] = useState(entry?.what_i_built ?? "");
  const [challenge, setChallenge] = useState(entry?.challenge ?? "");
  const [howISolvedIt, setHowISolvedIt] = useState(entry?.how_i_solved_it ?? "");
  const [keyTakeaway, setKeyTakeaway] = useState(entry?.key_takeaway ?? "");
  const [tomorrowFocus, setTomorrowFocus] = useState(
    entry?.tomorrow_focus ?? "",
  );
  const [projectName, setProjectName] = useState(entry?.project_name ?? "");
  const [projectDescription, setProjectDescription] = useState(
    entry?.project_description ?? "",
  );
  const [codeReference, setCodeReference] = useState(
    entry?.code_reference ?? "",
  );
  const [resourcesUsed, setResourcesUsed] = useState(
    entry?.resources_used ?? "",
  );
  const [confidenceLevel, setConfidenceLevel] = useState<
    number | null | undefined
  >(entry?.confidence_level ?? null);
  const [additionalNotes, setAdditionalNotes] = useState(
    entry?.additional_notes ?? "",
  );

  const [toast, setToast] = useState<Toast | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [opportunityOutcome, setOpportunityOutcome] =
    useState<OpportunityGenerationOutcome | null>(null);
  const lastSavedHashRef = useRef<string>("");

  const isReadonly = status === "submitted" || status === "used";

  // Compute a hash of the current form state for change detection
  const computeHash = useCallback(
    () =>
      JSON.stringify({
        whatILearned,
        whatIPracticed,
        whatIBuilt,
        challenge,
        howISolvedIt,
        keyTakeaway,
        tomorrowFocus,
        projectName,
        projectDescription,
        codeReference,
        resourcesUsed,
        confidenceLevel,
        additionalNotes,
      }),
    [
      whatILearned,
      whatIPracticed,
      whatIBuilt,
      challenge,
      howISolvedIt,
      keyTakeaway,
      tomorrowFocus,
      projectName,
      projectDescription,
      codeReference,
      resourcesUsed,
      confidenceLevel,
      additionalNotes,
    ],
  );

  // Track unsaved changes
  useEffect(() => {
    if (isReadonly) return;
    const currentHash = computeHash();
    setHasUnsavedChanges(currentHash !== lastSavedHashRef.current);
  }, [computeHash, isReadonly]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  // Initialize the last saved hash on mount
  useEffect(() => {
    lastSavedHashRef.current = computeHash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const buildFormData = useCallback(
    () => ({
      entryId: entryId ?? undefined,
      dayNumber,
      whatILearned: whatILearned || undefined,
      whatIPracticed: whatIPracticed || undefined,
      whatIBuilt: whatIBuilt || undefined,
      challenge: challenge || undefined,
      howISolvedIt: howISolvedIt || undefined,
      keyTakeaway: keyTakeaway || undefined,
      tomorrowFocus: tomorrowFocus || undefined,
      projectName: projectName || undefined,
      projectDescription: projectDescription || undefined,
      codeReference: codeReference || undefined,
      resourcesUsed: resourcesUsed || undefined,
      confidenceLevel: confidenceLevel ?? null,
      additionalNotes: additionalNotes || undefined,
    }),
    [
      entryId,
      dayNumber,
      whatILearned,
      whatIPracticed,
      whatIBuilt,
      challenge,
      howISolvedIt,
      keyTakeaway,
      tomorrowFocus,
      projectName,
      projectDescription,
      codeReference,
      resourcesUsed,
      confidenceLevel,
      additionalNotes,
    ],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setToast(null);

    const result = await saveJournal(buildFormData());

    if (result.success) {
      if (result.entryId) setEntryId(result.entryId);
      if (result.status) setStatus(result.status);
      lastSavedHashRef.current = computeHash();
      setHasUnsavedChanges(false);
      setToast({ type: "success", message: "Your journal was saved." });
    } else {
      setToast({ type: "error", message: result.error ?? "Failed to save." });
    }

    setIsSaving(false);
  }, [buildFormData, computeHash]);

  const handleSubmit = useCallback(async () => {
    if (!entryId) {
      setToast({
        type: "error",
        message: "Save your journal first before submitting.",
      });
      return;
    }

    setIsSubmitting(true);
    setToast(null);
    setOpportunityOutcome(null);

    const result = await submitJournal({ entryId });

    if (result.success) {
      if (result.status) setStatus(result.status);
      setOpportunityOutcome(result.opportunities ?? null);
      setToast({ type: "success", message: "Your journal was submitted." });
    } else {
      const msg = result.error ?? "Failed to submit.";
      if (msg.includes("at least one")) {
        setToast({
          type: "error",
          message:
            "Add a little more about what you learned before submitting.",
        });
      } else {
        setToast({ type: "error", message: msg });
      }
    }

    setIsSubmitting(false);
    setShowSubmitConfirm(false);
  }, [entryId]);

  const handleNavigate = useCallback(
    (newDay: number) => {
      router.push(`/journal?day=${newDay}`);
    },
    [router],
  );

  const hasContent =
    whatILearned ||
    whatIPracticed ||
    whatIBuilt ||
    challenge ||
    howISolvedIt ||
    keyTakeaway ||
    tomorrowFocus;

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            toast.type === "success"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
          }`}
          role="alert"
        >
          <div className="flex items-center justify-between">
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={dismissToast}
              className="ml-2 text-current opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Recruiter-focused opportunities built from this submission */}
      {opportunityOutcome && (
        <OpportunitySubmitNotice
          outcome={opportunityOutcome}
          dayNumber={dayNumber}
        />
      )}

      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#06B6D4]">
              {totalDays} Days of Full-Stack Development
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[#111827] dark:text-zinc-50">
              Day {dayNumber} / {totalDays}
            </h1>
          </div>
          {status && <StatusBadge status={status} />}
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${(dayNumber / totalDays) * 100}%`,
              background: "linear-gradient(90deg, #2563EB, #06B6D4)",
            }}
          />
        </div>
      </div>

      {/* Day Navigation */}
      <DayNavigation
        currentDay={dayNumber}
        totalDays={totalDays}
        onNavigate={handleNavigate}
      />

      {/* Curriculum */}
      <CurriculumDisplay
        dayNumber={dayNumber}
        curriculumDay={curriculumDay}
        currentModule={currentModule}
      />

      {/* Journal Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
        className="space-y-8"
      >
        {/* TODAY'S LESSON */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Today&apos;s Lesson
          </h2>
          <div className="mt-4 space-y-5">
            <TextareaField
              id="what-i-learned"
              label="What did I learn?"
              helperText="Write the main things you learned today."
              value={whatILearned}
              onChange={setWhatILearned}
              placeholder="Today I learned about..."
              rows={3}
              disabled={isReadonly}
            />
            <TextareaField
              id="what-i-practiced"
              label="What did I practice?"
              helperText="Write what you practiced with code or exercises."
              value={whatIPracticed}
              onChange={setWhatIPracticed}
              placeholder="I practiced by..."
              rows={3}
              disabled={isReadonly}
            />
          </div>
        </section>

        {/* MY WORK */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            My Work
          </h2>
          <div className="mt-4 space-y-5">
            <TextareaField
              id="what-i-built"
              label="What did I build?"
              helperText="Did you build something today? Tell me what it was."
              value={whatIBuilt}
              onChange={setWhatIBuilt}
              placeholder="I built..."
              rows={3}
              disabled={isReadonly}
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <TextareaField
                id="project-name"
                label="Project name"
                value={projectName}
                onChange={setProjectName}
                placeholder="My project"
                rows={1}
                disabled={isReadonly}
              />
              <TextareaField
                id="project-description"
                label="Project description"
                value={projectDescription}
                onChange={setProjectDescription}
                placeholder="A short description..."
                rows={1}
                disabled={isReadonly}
              />
            </div>
          </div>
        </section>

        {/* CHALLENGE */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Challenge
          </h2>
          <div className="mt-4 space-y-5">
            <TextareaField
              id="challenge"
              label="What was difficult?"
              helperText="Write one problem or idea that was hard for you."
              value={challenge}
              onChange={setChallenge}
              placeholder="I found it difficult to..."
              rows={3}
              disabled={isReadonly}
            />
            <TextareaField
              id="how-i-solved-it"
              label="How did I solve it?"
              helperText="Explain what you tried and what worked."
              value={howISolvedIt}
              onChange={setHowISolvedIt}
              placeholder="I solved it by..."
              rows={3}
              disabled={isReadonly}
            />
          </div>
        </section>

        {/* REFLECTION */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Reflection
          </h2>
          <div className="mt-4 space-y-5">
            <TextareaField
              id="key-takeaway"
              label="Key takeaway"
              helperText="What is the most important thing you learned today?"
              value={keyTakeaway}
              onChange={setKeyTakeaway}
              placeholder="The most important thing was..."
              rows={2}
              disabled={isReadonly}
            />
            <TextareaField
              id="tomorrow-focus"
              label="Tomorrow&apos;s focus"
              helperText="What do you want to understand or practice next?"
              value={tomorrowFocus}
              onChange={setTomorrowFocus}
              placeholder="Tomorrow I want to..."
              rows={2}
              disabled={isReadonly}
            />
          </div>
        </section>

        {/* OPTIONAL DETAILS */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Optional Details
          </h2>
          <div className="mt-4 space-y-5">
            <TextareaField
              id="code-reference"
              label="Code reference"
              helperText="Links to repos, PRs, or commits."
              value={codeReference}
              onChange={setCodeReference}
              placeholder="https://github.com/..."
              rows={1}
              disabled={isReadonly}
            />
            <TextareaField
              id="resources-used"
              label="Resources used"
              helperText="Tutorials, docs, or articles you read."
              value={resourcesUsed}
              onChange={setResourcesUsed}
              placeholder="MDN, React docs, ..."
              rows={2}
              disabled={isReadonly}
            />

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Confidence Level
              </label>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                How confident do you feel about today&apos;s learning?
              </p>
              <div
                className="mt-2 flex flex-wrap gap-2"
                role="radiogroup"
                aria-label="Confidence level"
              >
                {CONFIDENCE_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    role="radio"
                    aria-checked={confidenceLevel === level.value}
                    onClick={() =>
                      !isReadonly &&
                      setConfidenceLevel(
                        confidenceLevel === level.value ? null : level.value,
                      )
                    }
                    disabled={isReadonly}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${
                      confidenceLevel === level.value
                        ? "border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB] ring-1 ring-[#2563EB]/30"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    <span className="text-base">{level.emoji}</span>
                    <span>{level.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <TextareaField
              id="additional-notes"
              label="Additional notes"
              value={additionalNotes}
              onChange={setAdditionalNotes}
              placeholder="Anything else you want to remember..."
              rows={2}
              disabled={isReadonly}
            />
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Back to Dashboard
            </Link>
            <Link
              href="/curriculum"
              className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              View Curriculum
            </Link>
          </div>

          {!isReadonly && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isSubmitting}
                className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {isSaving ? "Saving..." : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(true)}
                disabled={isSaving || isSubmitting || !hasContent}
                className="rounded-lg bg-[#0F172A] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-[#0F172A] dark:hover:bg-zinc-200"
              >
                {isSubmitting ? "Submitting..." : "Submit Journal"}
              </button>
            </div>
          )}
        </div>
      </form>

      {/* Submit Confirmation Dialog */}
      <ConfirmDialog
        open={showSubmitConfirm}
        title="Ready to submit today&apos;s journal?"
        description="Your journal can still be reviewed later. Once submitted, you won't be able to edit it."
        confirmLabel={isSubmitting ? "Submitting..." : "Submit Journal"}
        onConfirm={handleSubmit}
        onCancel={() => setShowSubmitConfirm(false)}
      />
    </div>
  );
}
