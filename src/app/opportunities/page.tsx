import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";
import { OpportunitiesClient } from "@/components/opportunities/opportunities-client";

export const metadata: Metadata = {
  title: "Opportunities",
};

export default async function OpportunitiesPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Opportunities</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Recruiter-focused post ideas scored from confirmed evidence. Generate a draft and
          review it in the editor — nothing is published automatically.
        </p>
      </div>

      <OpportunitiesClient />
    </div>
  );
}