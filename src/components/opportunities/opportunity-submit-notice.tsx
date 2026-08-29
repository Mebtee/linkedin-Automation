"use client";

import { useState } from "react";
import Link from "next/link";

import { generateContentOpportunitiesForDayAction } from "@/app/actions/content-opportunities";
import type { OpportunityGenerationOutcome } from "@/app/actions/journal";

type OpportunitySubmitNoticeProps = {
  outcome: OpportunityGenerationOutcome;
  dayNumber: number;
};

export function OpportunitySubmitNotice({
  outcome,
  dayNumber,
}: OpportunitySubmitNoticeProps) {
  const [current, setCurrent] = useState<OpportunityGenerationOutcome>(outcome);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const result = await generateContentOpportunitiesForDayAction({ dayNumber });
      if (result.success) {
        setCurrent(
          result.count > 0
            ? { status: "created", count: result.count }
            : {
                status: "skipped",
                reason:
                  "No recruiter-focused content opportunities could be built from this entry yet.",
              },
        );
      } else {
        setCurrent({
          status: "failed",
          reason: "Your content opportunities could not be built. Try again.",
        });
      }
    } catch {
      setCurrent({
        status: "failed",
        reason: "Your content opportunities could not be built. Try again.",
      });
    }
    setRetrying(false);
  };

  const viewLink = (
    <Link
      href="/opportunities"
      className="font-medium text-[#2563EB] underline-offset-4 hover:underline"
    >
      View Opportunities
    </Link>
  );

  if (current.status === "created") {
    return (
      <div
        role="status"
        className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300"
      >
        <p className="font-semibold">
          Your journal was submitted and {current.count} recruiter-focused
          content{" "}
          {current.count === 1
            ? "opportunity was"
            : "opportunities were"}{" "}
          built for Day {dayNumber}.
        </p>
        <p className="mt-1">{viewLink}</p>
      </div>
    );
  }

  if (current.status === "skipped") {
    return (
      <div
        role="status"
        className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
      >
        <p className="font-semibold">Your journal was submitted.</p>
        <p className="mt-1">{current.reason}</p>
        <p className="mt-1">{viewLink}</p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
    >
      <p className="font-semibold">
        Your journal was submitted, but your content opportunities could not be
        built.
      </p>
      <p className="mt-1">
        {current.reason}{" "}
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="ml-1 font-medium text-[#2563EB] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          {retrying ? "Retrying..." : "Retry"}
        </button>
      </p>
      <p className="mt-1">{viewLink}</p>
    </div>
  );
}