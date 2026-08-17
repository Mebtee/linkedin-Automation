"use client";

import { useState, useMemo } from "react";
import type { GeneratedPostRow, GeneratedPostStatus } from "@/types/generated-post";
import { PostCard } from "./post-card";
import { EmptyState } from "@/components/ui/empty-state";

type PostListProps = {
  posts: GeneratedPostRow[];
};

const STATUS_FILTERS: Array<{ label: string; value: GeneratedPostStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Approved", value: "approved" },
  { label: "Published", value: "published" },
  { label: "Failed", value: "failed" },
];

export function PostList({ posts }: PostListProps) {
  const [statusFilter, setStatusFilter] = useState<GeneratedPostStatus | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = posts;

    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.day_number.toString().includes(q) ||
          p.opening.toLowerCase().includes(q) ||
          p.format.toLowerCase().includes(q),
      );
    }

    return result;
  }, [posts, statusFilter, search]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              aria-pressed={statusFilter === f.value}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-[#0F172A] text-white dark:bg-zinc-100 dark:text-[#0F172A]"
                  : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search posts..."
          aria-label="Search posts"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 sm:w-64"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        posts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            description="Generate a post from a submitted journal entry to get started."
          />
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No posts match your current filters.
            </p>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
