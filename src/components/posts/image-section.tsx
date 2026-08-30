"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GeneratedPostRow } from "@/types/generated-post";
import type { MediaAssetRow, ImageTemplate } from "@/types/image";
import { IMAGE_TEMPLATES } from "@/types/image";
import {
  generatePostImageAction,
  getPostImageAction,
  regeneratePostImageAction,
} from "@/app/actions/post-images";

type ImageSectionProps = {
  post: GeneratedPostRow;
};

const TEMPLATE_LABELS: Record<ImageTemplate, string> = {
  "large-number": "Large Number",
  "code-visual": "Code Visual",
  "concept-diagram": "Concept Diagram",
  "project-focused": "Project Focused",
  "progress": "Progress",
  "final-milestone": "Final Milestone",
};

export function ImageSection({ post }: ImageSectionProps) {
  const [asset, setAsset] = useState<MediaAssetRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ImageTemplate | "">("");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Load existing image on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await getPostImageAction(post.id);
      if (!cancelled && result.success) {
        setAsset(result.asset);
      }
      if (!cancelled) setIsLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [post.id]);

  const handleGenerate = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const result = await generatePostImageAction(post.id);
      if (result.success) {
        setAsset(result.asset);
        showToast("success", "Image generated successfully.");
      } else {
        showToast("error", result.error.message);
      }
    } catch {
      showToast("error", "An unexpected error occurred.");
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, post.id, showToast]);

  const handleRegenerate = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const template = selectedTemplate || undefined;
      const result = await regeneratePostImageAction(post.id, template as ImageTemplate | undefined);
      if (result.success) {
        setAsset(result.asset);
        showToast("success", "Image regenerated successfully.");
      } else {
        showToast("error", result.error.message);
      }
    } catch {
      showToast("error", "An unexpected error occurred.");
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, post.id, selectedTemplate, showToast]);

  const handleDownload = useCallback(() => {
    if (!asset) return;
    // Fetch the SVG content via the authenticated image route and trigger a download
    fetch(`/api/media/${post.id}/image`)
      .then((res) => res.text())
      .then((svg) => {
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `day-${post.day_number}-image.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        showToast("error", "Failed to download image.");
      });
  }, [asset, post.day_number, post.id, showToast]);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Image
      </h3>

      {/* Toast */}
      {toast && (
        <div
          role="alert"
          className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
              : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          Loading image...
        </p>
      )}

      {/* Image Preview */}
      {!isLoading && asset && (
        <div className="mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/media/${post.id}/image`}
            alt={asset.alt_text}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
            style={{
              aspectRatio: `${asset.width} / ${asset.height}`,
              objectFit: "contain",
              background: "#F8FAFC",
            }}
          />
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
            Template: {TEMPLATE_LABELS[asset.template] ?? asset.template}
          </p>
        </div>
      )}

      {/* No image */}
      {!isLoading && !asset && (
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          No image generated yet.
        </p>
      )}

      {/* Template selector */}
      <div className="mt-3">
        <label
          htmlFor="image-template"
          className="block text-xs font-medium text-zinc-500 dark:text-zinc-400"
        >
          Template
        </label>
        <select
          id="image-template"
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value as ImageTemplate | "")}
          disabled={isGenerating}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        >
          <option value="">Auto-select</option>
          {IMAGE_TEMPLATES.map((t) => (
            <option key={t} value={t}>
              {TEMPLATE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        {!asset ? (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1d4ed8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isGenerating ? "Generating..." : "Generate Image"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isGenerating}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {isGenerating ? "Regenerating..." : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isGenerating}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Download SVG
            </button>
          </>
        )}
      </div>
    </div>
  );
}
