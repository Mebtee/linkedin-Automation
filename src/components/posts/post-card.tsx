"use client";

import Link from "next/link";
import type { GeneratedPostRow } from "@/types/generated-post";
import { PostStatusBadge } from "./post-status-badge";
import { content } from "@/config/content";
import {
  recommendationLabel,
  recommendationStyle,
} from "./recruiter-quality-panel";

type PostCardProps = {
  post: GeneratedPostRow;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFormatLabel(format: string): string {
  const entry = Object.entries(content.formats).find(([key]) => key === format);
  return entry ? entry[1].name : format;
}

export function PostCard({ post }: PostCardProps) {
  const preview = post.body.length > 120 ? post.body.slice(0, 120) + "..." : post.body;
  const quality = post.recruiter_quality_report;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-medium text-[#06B6D4]">
              Day {post.day_number} / 105
            </span>
            <span aria-hidden="true">·</span>
            <span>{getFormatLabel(post.format)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDate(post.created_at)}</span>
          </div>

          {(post.recruiter_quality_score !== null ||
            quality?.recommendation) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {post.recruiter_quality_score !== null && quality?.recommendation && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${recommendationStyle(quality.recommendation)}`}
                >
                  Post quality {post.recruiter_quality_score}/100 ·{" "}
                  {recommendationLabel(quality.recommendation)}
                </span>
              )}
              {quality?.recommendation === "do_not_publish" && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  Not approved for publishing
                </span>
              )}
            </div>
          )}

          <h3 className="mt-2 line-clamp-2 text-sm font-medium text-[#111827] dark:text-zinc-50">
            {post.opening}
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {preview}
          </p>

          {post.hashtags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {post.hashtags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#06B6D4]/10 px-2 py-0.5 text-[10px] font-medium text-[#06B6D4]"
                >
                  {tag}
                </span>
              ))}
              {post.hashtags.length > 3 && (
                <span className="text-[10px] text-zinc-400">
                  +{post.hashtags.length - 3}
                </span>
              )}
            </div>
          )}

          {post.status === "published" && post.linkedin_post_id && (
            <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
              <span className="font-semibold">Published to LinkedIn</span>
              {post.published_at && <> · {formatDateTime(post.published_at)}</>}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <PostStatusBadge status={post.status} />
          <Link
            href={`/posts/${post.id}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {post.status === "published" ? "View" : post.status === "draft" || post.status === "failed" ? "Edit" : "Review"}
          </Link>
        </div>
      </div>
    </div>
  );
}
