"use client";

import { useEffect, useRef } from "react";
import type { GeneratedPostRow } from "@/types/generated-post";
import type { RecruiterQualityReport } from "@/types/recruiter-quality";
import {
  recommendationLabel,
  recommendationStyle,
} from "./recruiter-quality-panel";

type PublishDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isPublishing: boolean;
  post?: GeneratedPostRow | null;
  quality?: RecruiterQualityReport | null;
};

export function PublishDialog({
  open,
  onConfirm,
  onCancel,
  isPublishing,
  post,
  quality,
}: PublishDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const preview = post
    ? post.opening.length > 120
      ? post.opening.slice(0, 120) + "..."
      : post.opening
    : "No post selected.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-dialog-title"
        aria-describedby="publish-dialog-desc"
        className="relative mx-4 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h3
          id="publish-dialog-title"
          className="text-lg font-semibold text-[#111827] dark:text-zinc-50"
        >
          Publish to LinkedIn?
        </h3>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Post</dt>
            <dd className="max-w-[220px] truncate font-medium text-zinc-900 dark:text-zinc-50">
              {preview}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Quality</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-50">
              {quality && quality.score !== null ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${recommendationStyle(quality.recommendation)}`}
                >
                  {quality.score}/100 — {recommendationLabel(quality.recommendation)}
                </span>
              ) : (
                "Not assessed"
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Status</dt>
            <dd className="font-medium capitalize text-zinc-900 dark:text-zinc-50">
              {post?.status ?? "approved"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Platform</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-50">LinkedIn</dd>
          </div>
        </dl>

        <p
          id="publish-dialog-desc"
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
        >
          Once published, this post will be visible on your LinkedIn profile.
          This action cannot be undone.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPublishing}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            ref={confirmBtnRef}
            onClick={onConfirm}
            disabled={isPublishing}
            className="rounded-lg bg-[#0a66c2] px-4 py-2 text-sm font-medium text-white hover:bg-[#004182] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPublishing ? "Publishing..." : "Publish to LinkedIn"}
          </button>
        </div>
      </div>
    </div>
  );
}