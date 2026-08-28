import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listContentOpportunities } from "@/services/recruiter/persistence";
import { selectBestContentOpportunity } from "@/services/recruiter";
import { getGeneratedPostHistory } from "@/services/generated-posts";
import { OpportunitiesClient } from "@/components/opportunities/opportunities-client";
import type { ContentOpportunityRow } from "@/types/content-opportunity";
import type { GeneratedPostRow } from "@/types/generated-post";

export const metadata: Metadata = {
  title: "Opportunities",
};

type DayInfo = { topic: string | null; moduleTitle: string | null };

async function loadDayInfo(dayNumber: number | null): Promise<DayInfo> {
  if (dayNumber === null || dayNumber === undefined) {
    return { topic: null, moduleTitle: null };
  }
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("curriculum_days")
      .select("topic, module_id")
      .eq("day_number", dayNumber)
      .single();
    if (!data) return { topic: null, moduleTitle: null };

    const { data: module } = await supabase
      .from("modules")
      .select("title")
      .eq("id", data.module_id as string)
      .single();

    return {
      topic: (data.topic as string | null) ?? null,
      moduleTitle: (module?.title as string | null) ?? null,
    };
  } catch {
    return { topic: null, moduleTitle: null };
  }
}

export default async function OpportunitiesPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const opportunities: ContentOpportunityRow[] = await listContentOpportunities();
  const posts: GeneratedPostRow[] = await getGeneratedPostHistory();

  // Phase 5E: the featured recommendation reuses the deterministic Phase 5A
  // `selectStrongestOpportunity` over STORED scores — never a second scoring
  // system. It only considers candidate/selected rows (the next thing to build).
  const best = await selectBestContentOpportunity();
  const recommended = best
    ? {
        opportunity: best.row,
        reason: best.reason,
        diversityAdjusted: best.diversityAdjusted,
        ...(await loadDayInfo(best.row.day_number)),
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Opportunities
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Recruiter-focused post ideas scored from confirmed evidence. Generate,
          review, approve, and publish — nothing is published automatically.
        </p>
      </div>

      <OpportunitiesClient
        opportunities={opportunities}
        posts={posts}
        recommended={recommended}
      />
    </div>
  );
}