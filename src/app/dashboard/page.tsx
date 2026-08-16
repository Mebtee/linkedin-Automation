import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
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
