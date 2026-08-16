import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Schedule",
};

export default function SchedulePage() {
  return (
    <>
      <PageHeader
        title="Schedule"
        description="Plan when approved posts are published."
      />
      <EmptyState
        title="Schedule coming soon"
        description="Scheduling will be implemented in a later phase."
      />
    </>
  );
}
