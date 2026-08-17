import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";

import { getUser } from "@/lib/auth";
import { getGeneratedPost } from "@/services/generated-posts";
import { PostEditor } from "@/components/posts/post-editor";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getGeneratedPost(id);
  return {
    title: post ? `Day ${post.day_number} — Post Editor` : "Post Not Found",
  };
}

export default async function PostEditorPage({ params }: PageProps) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const post = await getGeneratedPost(id);

  if (!post) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PostEditor post={post} />
    </div>
  );
}
