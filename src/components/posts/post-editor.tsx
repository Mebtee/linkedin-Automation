"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { GeneratedPostRow } from "@/types/generated-post";
import { PostStatusBadge } from "./post-status-badge";
import { PostPreview } from "./post-preview";
import { PostMetadata } from "./post-metadata";
import { PostActions } from "./post-actions";
import { ImageSection } from "./image-section";
import { ApprovePostDialog } from "./approve-post-dialog";
import { DeletePostDialog } from "./delete-post-dialog";
import { updatePost, approvePost, deletePost, regeneratePost } from "@/app/actions/generated-posts";
import { brand } from "@/config/brand";

type PostEditorProps = {
  post: GeneratedPostRow;
};

type Toast = {
  type: "success" | "error";
  message: string;
};

export function PostEditor({ post }: PostEditorProps) {
  const router = useRouter();

  // Form state
  const [opening, setOpening] = useState(post.opening);
  const [body, setBody] = useState(post.body);
  const [takeaway, setTakeaway] = useState(post.takeaway);
  const [nextStep, setNextStep] = useState(post.next_step);
  const [hashtagsRaw, setHashtagsRaw] = useState(post.hashtags.join("\n"));

  // UI state
  const [toast, setToast] = useState<Toast | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPost, setCurrentPost] = useState(post);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Cleanup toast timer
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((type: Toast["type"], message: string) => {
    setToast({ type, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // Parse hashtags from raw textarea
  const parseHashtags = useCallback((raw: string): string[] => {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, []);

  const hashtags = parseHashtags(hashtagsRaw);

  // ─── Save ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (isSaving) return;

    // Basic validation
    if (!opening.trim()) {
      showToast("error", "Opening is required.");
      return;
    }
    if (!body.trim()) {
      showToast("error", "Body is required.");
      return;
    }
    if (!takeaway.trim()) {
      showToast("error", "Takeaway is required.");
      return;
    }
    if (!nextStep.trim()) {
      showToast("error", "Next step is required.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await updatePost(currentPost.id, {
        opening: opening.trim(),
        body: body.trim(),
        takeaway: takeaway.trim(),
        next_step: nextStep.trim(),
        hashtags,
      });

      if (result.success) {
        setCurrentPost(result.post);
        showToast("success", "Post saved successfully.");
      } else {
        showToast("error", result.error.message);
      }
    } catch {
      showToast("error", "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, opening, body, takeaway, nextStep, hashtags, currentPost.id, showToast]);

  // ─── Approve ───────────────────────────────────────────────────────────

  const handleApprove = useCallback(async () => {
    if (isApproving) return;
    setIsApproving(true);
    setApproveOpen(false);

    try {
      const result = await approvePost(currentPost.id);
      if (result.success) {
        setCurrentPost(result.post);
        showToast("success", "Post approved.");
      } else {
        showToast("error", result.error.message);
      }
    } catch {
      showToast("error", "An unexpected error occurred.");
    } finally {
      setIsApproving(false);
    }
  }, [isApproving, currentPost.id, showToast]);

  // ─── Delete ────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteOpen(false);

    try {
      const result = await deletePost(currentPost.id);
      if (result.success) {
        showToast("success", "Post deleted.");
        router.push("/posts");
      } else {
        showToast("error", result.error ?? "Failed to delete post.");
      }
    } catch {
      showToast("error", "An unexpected error occurred.");
    } finally {
      setIsDeleting(false);
    }
  }, [isDeleting, currentPost.id, router, showToast]);

  // ─── Regenerate ────────────────────────────────────────────────────────

  const handleRegenerate = useCallback(async () => {
    if (isRegenerating) return;
    setIsRegenerating(true);

    try {
      const result = await regeneratePost(currentPost.day_number, currentPost.format);
      if (result.success) {
        // Update form with new content
        setOpening(result.post.opening);
        setBody(result.post.body);
        setTakeaway(result.post.takeaway);
        setNextStep(result.post.next_step);
        setHashtagsRaw(result.post.hashtags.join("\n"));
        setCurrentPost(result.post);
        showToast("success", "Post regenerated successfully.");
      } else {
        showToast("error", result.error.message);
      }
    } catch {
      showToast("error", "An unexpected error occurred.");
    } finally {
      setIsRegenerating(false);
    }
  }, [isRegenerating, currentPost.day_number, currentPost.format, showToast]);

  const isEditable = currentPost.status === "draft" || currentPost.status === "failed";

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          role="alert"
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
              : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <nav aria-label="Breadcrumb" className="mb-1 text-sm">
            <Link
              href="/posts"
              className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Posts
            </Link>
            <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">/</span>
            <span aria-current="page" className="text-zinc-900 dark:text-zinc-50">
              Day {currentPost.day_number}
            </span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Post Editor
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Day {currentPost.day_number} / {brand.totalDays} · {currentPost.format}
          </p>
        </div>
        <PostStatusBadge status={currentPost.status} />
      </div>

      {/* Main layout: Editor + Sidebar */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Editor column */}
        <div className="space-y-4">
          {/* Opening */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <label
              htmlFor="opening"
              className="block text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              Opening
            </label>
            <textarea
              id="opening"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              rows={2}
              disabled={!isEditable}
              placeholder="Hook line for the post..."
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500"
            />
          </section>

          {/* Body */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <label
              htmlFor="body"
              className="block text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              Body
            </label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              disabled={!isEditable}
              placeholder="Main content of the post..."
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500"
            />
          </section>

          {/* Takeaway */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <label
              htmlFor="takeaway"
              className="block text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              Takeaway
            </label>
            <textarea
              id="takeaway"
              value={takeaway}
              onChange={(e) => setTakeaway(e.target.value)}
              rows={2}
              disabled={!isEditable}
              placeholder="Key insight from today..."
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500"
            />
          </section>

          {/* Next Step */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <label
              htmlFor="next-step"
              className="block text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              Next Step
            </label>
            <textarea
              id="next-step"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              rows={2}
              disabled={!isEditable}
              placeholder="What you will focus on tomorrow..."
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500"
            />
          </section>

          {/* Hashtags */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <label
              htmlFor="hashtags"
              className="block text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              Hashtags
            </label>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              One hashtag per line. Maximum 5.
            </p>
            <textarea
              id="hashtags"
              value={hashtagsRaw}
              onChange={(e) => setHashtagsRaw(e.target.value)}
              rows={3}
              disabled={!isEditable}
              placeholder={"#105DaysOfCode\n#LearningInPublic\n#Day1"}
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500"
            />
            {hashtags.length > 5 && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                Maximum 5 hashtags allowed.
              </p>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <PostPreview
            opening={opening}
            body={body}
            takeaway={takeaway}
            nextStep={nextStep}
            hashtags={hashtags}
          />
          <ImageSection post={currentPost} />
          <PostMetadata post={currentPost} />
        </div>
      </div>

      {/* Actions */}
      <PostActions
        status={currentPost.status}
        isSaving={isSaving}
        isApproving={isApproving}
        isRegenerating={isRegenerating}
        onSave={handleSave}
        onApprove={() => setApproveOpen(true)}
        onRegenerate={handleRegenerate}
        onDelete={() => setDeleteOpen(true)}
      />

      {/* Dialogs */}
      <ApprovePostDialog
        open={approveOpen}
        onConfirm={handleApprove}
        onCancel={() => setApproveOpen(false)}
        isApproving={isApproving}
      />
      <DeletePostDialog
        open={deleteOpen}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        isDeleting={isDeleting}
      />
    </div>
  );
}
