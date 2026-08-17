import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";
import { getGeneratedPostHistory } from "@/services/generated-posts";
import { PostList } from "@/components/posts/post-list";

export const metadata: Metadata = {
  title: "Posts",
};

export default async function PostsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const posts = await getGeneratedPostHistory();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <nav aria-label="Breadcrumb" className="mb-2 text-sm">
          <span aria-current="page" className="text-zinc-900 dark:text-zinc-50">
            Posts
          </span>
        </nav>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-zinc-50">
          Generated Posts
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Review, edit, and approve your AI-generated LinkedIn posts.
        </p>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Overview
        </h2>
        <div className="mt-3 flex flex-wrap gap-6">
          <div>
            <p className="text-2xl font-bold text-[#111827] dark:text-zinc-50">
              {posts.length}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">total posts</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-500 dark:text-zinc-400">
              {posts.filter((p) => p.status === "draft").length}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">drafts</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#06B6D4]">
              {posts.filter((p) => p.status === "approved").length}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">approved</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#2563EB]">
              {posts.filter((p) => p.status === "published").length}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">published</p>
          </div>
        </div>
      </div>

      {/* List */}
      <PostList posts={posts} />
    </div>
  );
}
