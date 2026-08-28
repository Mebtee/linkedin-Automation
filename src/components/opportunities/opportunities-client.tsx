"use client";

import { useCallback, useEffect, useState } from "react";

import { listContentOpportunitiesAction } from "@/app/actions/content-opportunities";
import { POST_TYPE_META } from "@/config/recruiter";
import type { ContentOpportunityRow } from "@/types/content-opportunity";
import { OpportunityGenerateCard } from "@/components/opportunities/opportunity-generate-card";

type OpportunitiesClientProps = {
  limit?: number;
};

const INTERESTING_STATUSES = ["selected", "generated", "approved", "published"] as const;

export function OpportunitiesClient({ limit = 10 }: OpportunitiesClientProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<ContentOpportunityRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listContentOpportunitiesAction({ limit });
    if (result.success) {
      setOpportunities(result.opportunities);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const active = opportunities.find((o) => o.status === "selected") ?? opportunities[0] ?? null;

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading opportunities…</p>;
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
      >
        {error}
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          No Opportunities Yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          Recruiter-focused post opportunities appear here after your journal entries are
          submitted and course materials are processed. Track a strong piece of work and it
          becomes eligible for a post.
        </p>
      </div>
    );
  }

  const others = active
    ? opportunities.filter((o) => o.id !== active.id)
    : [];

  return (
    <div className="space-y-6">
      {active && <OpportunityGenerateCard opportunity={active} />}

      {others.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Other Opportunities
          </h2>
          <div className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
            {others.map((o) => {
              const status = o.status;
              const isActiveStatus = INTERESTING_STATUSES.includes(
                status as (typeof INTERESTING_STATUSES)[number],
              );
              return (
                <div
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {o.title}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {POST_TYPE_META[o.post_type].label} · Score {o.recruiter_score}
                      {o.day_number ? ` · Day ${o.day_number}` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      isActiveStatus
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}