import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ensureProfile } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  // Ensure profile exists for the authenticated user
  await ensureProfile();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your learning journey and automation pipeline."
      />
      <EmptyState
        title="Dashboard coming soon"
        description="Progress tracking and pipeline status will be implemented in a later phase."
      />
    </>
  );
}
