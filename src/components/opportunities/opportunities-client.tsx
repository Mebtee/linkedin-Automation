"use client";

import { useMemo, type ReactNode } from "react";

import type { ContentOpportunityRow } from "@/types/content-opportunity";
import type { GeneratedPostRow } from "@/types/generated-post";
import type { PublishRecommendation } from "@/types/recruiter-quality";
import { OpportunityGenerateCard } from "./opportunity-generate-card";
import { OpportunityCard } from "./opportunity-card";
import { RecruiterStrategyPanel } from "./recruiter-strategy-panel";

type RecommendedOpportunity = {
  opportunity: ContentOpportunityRow;
  reason: string | null;
  diversityAdjusted: boolean;
  topic: string | null;
  moduleTitle: string | null;
};

type OpportunitiesClientProps = {
  opportunities: ContentOpportunityRow[];
  posts: GeneratedPostRow[];
  recommended: RecommendedOpportunity | null;
};

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      {children || (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{empty}</p>
      )}
    </section>
  );
}

export function OpportunitiesClient({
  opportunities,
  posts,
  recommended,
}: OpportunitiesClientProps) {
  // posts arrive newest-first; the first match per opportunity is its current draft.
  const postByOpportunity = useMemo(() => {
    const map = new Map<string, GeneratedPostRow>();
    for (const post of posts) {
      if (post.opportunity_id && !map.has(post.opportunity_id)) {
        map.set(post.opportunity_id, post);
      }
    }
    return map;
  }, [posts]);

  const recommendationOf = (id: string): PublishRecommendation | null =>
    postByOpportunity.get(id)?.recruiter_quality_report?.recommendation ?? null;

  const readyToGenerate = opportunities.filter(
    (o) =>
      (o.status === "candidate" || o.status === "selected") &&
      recommended?.opportunity.id !== o.id,
  );

  const generated = opportunities.filter((o) => {
    if (o.status !== "generated") return false;
    const rec = recommendationOf(o.id);
    return rec !== "needs_review" && rec !== "do_not_publish";
  });

  const needsReview = opportunities.filter(
    (o) => o.status === "generated" && recommendationOf(o.id) === "needs_review",
  );

  const blocked = opportunities.filter(
    (o) => o.status === "generated" && recommendationOf(o.id) === "do_not_publish",
  );

  const approved = opportunities.filter((o) => o.status === "approved");
  const published = opportunities.filter((o) => o.status === "published");

  const hasSection = (rows: ContentOpportunityRow[]) => rows.length > 0;
  const anyWorkStarted =
    readyToGenerate.length > 0 ||
    generated.length > 0 ||
    needsReview.length > 0 ||
    blocked.length > 0 ||
    approved.length > 0 ||
    published.length > 0;

  return (
    <div className="space-y-8">
      {recommended ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#06B6D4]">
              Recommended for You
            </p>
            <OpportunityGenerateCard
              opportunity={recommended.opportunity}
              topic={recommended.topic}
              moduleTitle={recommended.moduleTitle}
            />
          </div>
          <RecruiterStrategyPanel />
        </div>
      ) : (
        <RecruiterStrategyPanel />
      )}

      {!anyWorkStarted && !recommended && (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No opportunities yet. Import a journal or PDF in Settings &amp;
          Prompts, then run &quot;Build Today&apos;s Options&quot; to score daily content ideas.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Ready to Generate"
          empty="Nothing to build right now."
        >
          {readyToGenerate.map((o) => (
            <OpportunityCard
              key={o.id}
              opportunity={o}
              post={postByOpportunity.get(o.id) ?? null}
            />
          ))}
        </Section>

        {hasSection(generated) && (
          <Section title="Generated" empty="No generated drafts.">
            {generated.map((o) => (
              <OpportunityCard
                key={o.id}
                opportunity={o}
                post={postByOpportunity.get(o.id) ?? null}
              />
            ))}
          </Section>
        )}

        {hasSection(needsReview) && (
          <Section
            title="Needs Review"
            empty="No drafts flagged for review."
          >
            {needsReview.map((o) => (
              <OpportunityCard
                key={o.id}
                opportunity={o}
                post={postByOpportunity.get(o.id) ?? null}
              />
            ))}
          </Section>
        )}

        {hasSection(blocked) && (
          <Section title="Blocked" empty="No blocked drafts.">
            {blocked.map((o) => (
              <OpportunityCard
                key={o.id}
                opportunity={o}
                post={postByOpportunity.get(o.id) ?? null}
              />
            ))}
          </Section>
        )}

        {hasSection(approved) && (
          <Section title="Approved" empty="No approved drafts.">
            {approved.map((o) => (
              <OpportunityCard
                key={o.id}
                opportunity={o}
                post={postByOpportunity.get(o.id) ?? null}
              />
            ))}
          </Section>
        )}

        {hasSection(published) && (
          <Section
            title="Published"
            empty="Nothing published yet."
          >
            {published.map((o) => (
              <OpportunityCard
                key={o.id}
                opportunity={o}
                post={postByOpportunity.get(o.id) ?? null}
              />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}