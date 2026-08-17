"use client";

import type { GeneratedPostStatus } from "@/types/generated-post";

type PostActionsProps = {
  status: GeneratedPostStatus;
  isSaving: boolean;
  isApproving: boolean;
  isRegenerating: boolean;
  onSave: () => void;
  onApprove: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
};

export function PostActions({
  status,
  isSaving,
  isApproving,
  isRegenerating,
  onSave,
  onApprove,
  onRegenerate,
  onDelete,
}: PostActionsProps) {
  const isEditable = status === "draft" || status === "failed";
  const isBusy = isSaving || isApproving || isRegenerating;

  return (
    <div className="flex flex-wrap gap-2">
      {isEditable && (
        <button
          type="button"
          onClick={onSave}
          disabled={isBusy}
          className="rounded-lg bg-[#0F172A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-[#0F172A] dark:hover:bg-zinc-200"
        >
          {isSaving ? "Saving..." : "Save Draft"}
        </button>
      )}

      {status === "draft" && (
        <button
          type="button"
          onClick={onApprove}
          disabled={isBusy}
          className="rounded-lg border border-[#06B6D4] bg-[#06B6D4]/10 px-4 py-2 text-sm font-medium text-[#06B6D4] hover:bg-[#06B6D4]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isApproving ? "Approving..." : "Approve Post"}
        </button>
      )}

      {isEditable && (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isBusy}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          {isRegenerating ? "Regenerating..." : "Regenerate"}
        </button>
      )}

      {isEditable && (
        <button
          type="button"
          onClick={onDelete}
          disabled={isBusy}
          className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-800 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          Delete
        </button>
      )}
    </div>
  );
}
