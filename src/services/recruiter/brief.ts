// ─── Recruiter Content Brief (Phase 5D) ───────────────────────────────────────
// Builds a deterministic, evidence-safe content brief that is injected into the
// generation input alongside the existing recruiter context. The brief never
// creates new evidence: everything it names comes from the already-enriched
// `RecruiterPostGenerationContext`.

import { CONTENT_GOAL_LABELS, POST_TYPE_META } from "@/config/recruiter";
import type { RecruiterPostGenerationContext } from "@/types/content-opportunity";
import type { RecruiterContentBrief } from "@/types/recruiter-quality";

export function buildRecruiterContentBrief(
  context: RecruiterPostGenerationContext,
): RecruiterContentBrief {
  const confirmed = context.evidence.filter((entry) => entry.confidence === "USER_CONFIRMED");
  const confirmedWithValue = confirmed.filter((entry) => typeof entry.value === "string");

  const strongestEvidence =
    context.evidence.find((entry) => entry.confidence === "USER_CONFIRMED")?.value ??
    context.evidence.find((entry) => entry.confidence === "SUPPORTED_BY_PDF")?.value ??
    context.evidence.find((entry) => entry.confidence === "INFERRED_FROM_STRUCTURE")?.value ??
    null;

  const projectField = (field: string) =>
    confirmedWithValue.find((entry) => entry.field === field)?.value ?? null;

  const practicalFocus =
    projectField("whatIBuilt") ??
    projectField("projectName") ??
    projectField("whatIPracticed");

  const problemSolvingFocus =
    projectField("challenge") && projectField("howISolvedIt")
      ? `${projectField("challenge")} — ${projectField("howISolvedIt")}`
      : projectField("challenge");

  const growthFocus = projectField("whatILearned") ?? projectField("keyTakeaway");

  const focusTags = POST_TYPE_META[context.postType].hashtagFocus.slice(0, 3);
  const technicalFocus =
    focusTags.length > 0 ? `${context.topic} · ${focusTags.join(", ")}` : context.topic;

  const forbiddens: string[] = [];
  if (!context.personalExperience) {
    forbiddens.push(
      "Do not claim the user personally built, deployed, or shipped this to production.",
    );
  }
  forbiddens.push("Do not claim mastery or expertise.");
  forbiddens.push("Do not mention results, metrics, users, or performance gains that the supplied evidence does not contain.");

  return {
    primaryGoal: CONTENT_GOAL_LABELS[context.contentGoal],
    recruiterSignal:
      strongestEvidence === null
        ? "Learning content only — describe the topic honestly without claiming personal work."
        : context.personalExperience
          ? "Confirmed personal engineering work (built / solved / deployed) that recruiters can verify in the journal."
          : "Confirmed learning and growth — show how the concepts were studied and applied.",
    strongestEvidence: strongestEvidence ?? "No confirmed evidence — learning content only.",
    technicalFocus,
    practicalFocus,
    problemSolvingFocus,
    growthFocus,
    forbiddenClaims: forbiddens,
  };
}