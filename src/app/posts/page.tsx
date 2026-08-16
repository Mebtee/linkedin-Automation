import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Posts",
};

export default function PostsPage() {
  return (
    <>
      <PageHeader
        title="Posts"
        description="Drafts, approvals and published LinkedIn posts."
      />
      <EmptyState
        title="Posts coming soon"
        description="Post generation, review and publishing will be implemented in a later phase."
      />
    </>
  );
}
