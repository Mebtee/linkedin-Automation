import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Curriculum",
};

export default function CurriculumPage() {
  return (
    <>
      <PageHeader
        title="Curriculum"
        description="The 105-day learning plan, served from the database."
      />
      <EmptyState
        title="Curriculum coming soon"
        description="The curriculum will be loaded from Supabase, never hardcoded in the UI."
      />
    </>
  );
}
