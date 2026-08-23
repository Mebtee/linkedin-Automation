import type { Metadata } from "next";
import Link from "next/link";

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
        title="Scheduling lives in the post editor"
        description="Open an approved post and use the Schedule panel to pick a date and time. Scheduled posts publish automatically."
      >
        <Link
          href="/posts"
          className="mt-4 inline-block rounded-lg bg-[#0a66c2] px-4 py-2 text-sm font-medium text-white hover:bg-[#004182] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
        >
          Go to Posts
        </Link>
      </EmptyState>
    </>
  );
}
