import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";

import type { RecruiterQualityReport } from "@/types/recruiter-quality";
import { getUser } from "@/lib/auth";
import { getGeneratedPost } from "@/services/generated-posts";
import { getContentOpportunity } from "@/services/recruiter/persistence";
import { evaluateRecruiterPostForSavedPost } from "@/services/recruiter/quality-service";
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

  // Phase 5D: freshly (re)assess opportunity-backed posts so the review panel
  // always reflects the current text, and surface its selected opportunity.
  let quality: RecruiterQualityReport | null = null;
  let opportunity: Awaited<ReturnType<typeof getContentOpportunity>> | null = null;
  if (post.opportunity_id) {
    const evaluated = await evaluateRecruiterPostForSavedPost(id);
    quality = evaluated?.report ?? null;
    opportunity = await getContentOpportunity(post.opportunity_id);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PostEditor post={post} quality={quality} opportunity={opportunity} />
    </div>
  );
}
