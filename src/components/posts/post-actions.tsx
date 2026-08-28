"use client";

import type { GeneratedPostStatus } from "@/types/generated-post";

type PostActionsProps = {
  status: GeneratedPostStatus;
  isSaving: boolean;
  isApproving: boolean;
  isRegenerating: boolean;
  isPublishing: boolean;
  isConnected: boolean;
  approveBlocked?: boolean;
  approveBlockReason?: string;
  onSave: () => void;
  onApprove: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onPublish: () => void;
  onConnectLinkedIn: () => void;
};

export function PostActions({
  status,
  isSaving,
  isApproving,
  isRegenerating,
  isPublishing,
  isConnected,
  approveBlocked = false,
  approveBlockReason,
  onSave,
  onApprove,
  onRegenerate,
  onDelete,
  onPublish,
  onConnectLinkedIn,
}: PostActionsProps) {
  const isEditable = status === "draft" || status === "failed";
  const isBusy = isSaving || isApproving || isRegenerating || isPublishing;

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
          disabled={isBusy || approveBlocked}
          title={approveBlocked ? approveBlockReason : undefined}
          className="rounded-lg border border-[#06B6D4] bg-[#06B6D4]/10 px-4 py-2 text-sm font-medium text-[#06B6D4] hover:bg-[#06B6D4]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isApproving ? "Approving..." : "Approve Post"}
        </button>
      )}

      {status === "draft" && approveBlocked && approveBlockReason && (
        <p className="w-full text-xs text-red-600 dark:text-red-400" role="note">
          {approveBlockReason} Fix the issues in the quality review, or regenerate a new draft.
        </p>
      )}

      {status === "approved" && (
        <>
          {isConnected ? (
            <button
              type="button"
              onClick={onPublish}
              disabled={isBusy}
              className="rounded-lg bg-[#0a66c2] px-4 py-2 text-sm font-medium text-white hover:bg-[#004182] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPublishing ? "Publishing..." : "Publish to LinkedIn"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onConnectLinkedIn}
              className="rounded-lg border border-[#0a66c2] bg-[#0a66c2]/10 px-4 py-2 text-sm font-medium text-[#0a66c2] hover:bg-[#0a66c2]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
            >
              Connect LinkedIn to Publish
            </button>
          )}
        </>
      )}

      {status === "published" && (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB]/10 px-4 py-2 text-sm font-medium text-[#2563EB]">
          <svg
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Published
        </span>
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
