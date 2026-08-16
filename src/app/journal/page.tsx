import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Journal",
};

export default function JournalPage() {
  return (
    <>
      <PageHeader
        title="Journal"
        description="Record what you learned each day of the journey."
      />
      <EmptyState
        title="Journal coming soon"
        description="Daily journal entries will be implemented in a later phase."
      />
    </>
  );
}
