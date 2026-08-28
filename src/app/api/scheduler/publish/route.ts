import "server-only";

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

import { requireServerEnv } from "@/config/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { getAccessToken, buildMemberUrn } from "@/services/linkedin/connection";
import { publishToLinkedIn, loadPostImage } from "@/services/linkedin/publish";
import {
  findDueScheduledPosts,
  claimScheduledPost,
  markSchedulePublished,
  markScheduleFailed,
  loadPostForPublishing,
} from "@/services/scheduling";
import { updatePublishStateWithClient } from "@/services/generated-posts";
import type { GeneratedPostRow } from "@/types/generated-post";

export const dynamic = "force-dynamic";

function verifySchedulerSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return false;

  const secret = requireServerEnv("schedulerSecret");

  const expectedBuf = Buffer.from(secret, "utf-8");
  const receivedBuf = Buffer.from(token, "utf-8");

  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}

export async function POST(request: Request) {
  if (!verifySchedulerSecret(request)) {
    log.warn("scheduler.unauthorized", { action: "publish" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  const startTime = Date.now();
  const results: Array<{
    scheduleId: string;
    postId: string;
    status: string;
    error?: string;
  }> = [];

  try {
    const duePosts = await findDueScheduledPosts(adminSupabase, 10);

    for (const schedule of duePosts) {
      // Atomically claim: scheduled → publishing. Only the process whose
      // UPDATE matches (status still 'scheduled') may publish; concurrent
      // cron runs lose the race here and skip — duplicate-publish guard.
      const claimed = await claimScheduledPost(
        adminSupabase,
        schedule.id,
        schedule.attempt_count + 1,
      );
      if (!claimed) {
        results.push({
          scheduleId: schedule.id,
          postId: schedule.post_id,
          status: "skipped",
          error: "Already claimed by another process",
        });
        continue;
      }

      try {
        // Load the full post, verified to belong to the schedule's owner.
        const postData = await loadPostForPublishing(
          adminSupabase,
          schedule.post_id,
          schedule.profile_id,
        );
        if (!postData) {
          await markScheduleFailed(adminSupabase, schedule.id, "Post not found.");
          results.push({
            scheduleId: schedule.id,
            postId: schedule.post_id,
            status: "failed",
            error: "Post not found",
          });
          continue;
        }

        // Verify post is still approved
        if (postData.status !== "approved") {
          await markScheduleFailed(
            adminSupabase,
            schedule.id,
            `Post status is "${postData.status}", expected "approved".`,
          );
          results.push({
            scheduleId: schedule.id,
            postId: schedule.post_id,
            status: "failed",
            error: `Post status "${postData.status}"`,
          });
          continue;
        }

        // Get LinkedIn access token
        const tokenData = await getAccessToken(adminSupabase, schedule.profile_id);
        if (!tokenData) {
          await markScheduleFailed(
            adminSupabase,
            schedule.id,
            "LinkedIn connection expired. Reconnect LinkedIn and retry this post.",
          );
          results.push({
            scheduleId: schedule.id,
            postId: schedule.post_id,
            status: "failed",
            error: "LinkedIn not connected",
          });
          continue;
        }

        if (!tokenData.hasPublishScope) {
          await markScheduleFailed(
            adminSupabase,
            schedule.id,
            "LinkedIn connection lacks publishing permissions. Reconnect with full permissions.",
          );
          results.push({
            scheduleId: schedule.id,
            postId: schedule.post_id,
            status: "failed",
            error: "Insufficient scope",
          });
          continue;
        }

        // Publish to LinkedIn (author URN must use the stored OpenID Connect
        // subject, not the internal profile UUID). Attach the generated image
        // when the post has one.
        const memberUrn = buildMemberUrn(tokenData.linkedinSub);
        const image = await loadPostImage(
          adminSupabase,
          schedule.post_id,
          schedule.profile_id,
        );
        const result = image
          ? await publishToLinkedIn(
              tokenData.token,
              postData as unknown as GeneratedPostRow,
              memberUrn,
              image,
            )
          : await publishToLinkedIn(
              tokenData.token,
              postData as unknown as GeneratedPostRow,
              memberUrn,
            );

        if (result.success && result.linkedinPostId) {
          // Mark schedule as published FIRST. This is the duplicate-publish
          // invariant: once the row leaves 'publishing', no later failure in
          // this block can cause a retry/republication.
          await markSchedulePublished(adminSupabase, schedule.id, result.linkedinPostId);

          // Sync the generated post's publish state (admin-scoped — the cron
          // path has no user session). A sync failure must not flip the
          // schedule back to failed; surface it as a warning instead.
          let warning: string | undefined;
          try {
            await updatePublishStateWithClient(
              adminSupabase,
              schedule.profile_id,
              schedule.post_id,
              {
                status: "published",
                linkedin_post_id: result.linkedinPostId,
                published_at: new Date().toISOString(),
                publish_error: null,
              },
            );
          } catch (syncErr) {
            warning =
              syncErr instanceof Error
                ? `Published to LinkedIn but failed to sync post state: ${syncErr.message}`
                : "Published to LinkedIn but failed to sync post state.";
          }

          results.push({
            scheduleId: schedule.id,
            postId: schedule.post_id,
            status: "published",
            ...(warning ? { error: warning } : {}),
          });
        } else {
          const errorMsg = result.error ?? "Unknown error";
          await markScheduleFailed(adminSupabase, schedule.id, errorMsg);

          // Best-effort: surface the error on the post for the user.
          try {
            await updatePublishStateWithClient(
              adminSupabase,
              schedule.profile_id,
              schedule.post_id,
              { publish_error: errorMsg },
            );
          } catch {
            // Schedule already records the failure — do not mask it.
          }

          results.push({
            scheduleId: schedule.id,
            postId: schedule.post_id,
            status: "failed",
            error: errorMsg,
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        try {
          await markScheduleFailed(adminSupabase, schedule.id, errorMsg);
        } catch {
          // If we can't mark as failed, log but continue
        }
        results.push({
          scheduleId: schedule.id,
          postId: schedule.post_id,
          status: "error",
          error: errorMsg,
        });
      }
    }

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scheduler failed";
    log.error("scheduler.run_failed", { errorCategory: "INTERNAL" });
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    const outcomeCounts = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});
    log.info("scheduler.run_complete", {
      processed: results.length,
      outcomes: outcomeCounts,
      durationMs: Date.now() - startTime,
    });
  }
}
