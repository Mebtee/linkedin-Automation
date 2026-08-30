import type {
  VisualBrief,
  VisualKeyPoint,
} from "@/types/image";
import type { GeneratedPostRow } from "@/types/generated-post";
import {
  selectTheme,
  selectComposition,
  clampKeyPoints,
  truncate,
} from "./themes";
import {
  findConceptChain,
  detectTechnologies,
  chainToKeyPoints,
} from "./concept-chains";

// ─── Visual Brief Builder (Phase 5G) ────────────────────────────────────────
// Deterministically transforms a generated post + curriculum context into a
// structured VisualBrief that drives the content composition renderers.
//
// ANTI-HALLUCINATION CONTRACT (carried from Phases 3–5D):
// - Only text already present in the post/curriculum is used.
// - Key points and technologies are extracted, never invented.
// - Personal-experience framing is only applied when the post type supports it
//   and the underlying evidence does. Course-only material stays educational.
// - No statistics, job titles, companies, user counts, or performance numbers
//   are ever synthesized.

export interface BriefContext {
  readonly post: GeneratedPostRow;
  readonly topic: string;
  readonly moduleNumber: number;
  readonly moduleTitle: string;
  /** Post type from the linked content opportunity, when present. */
  readonly postType?: string | null;
}

/** First sentence, capped. Used to build concise secondary text. */
function firstSentence(text: string): string {
  const trimmed = (text || "").trim();
  if (!trimmed) return "";
  const idx = trimmed.search(/[.!?\n]/);
  const sentence = idx === -1 ? trimmed : trimmed.slice(0, idx + 1);
  return truncate(sentence, 60);
}

/** Key points derived deterministically from the post's own content. */
function extractKeyPoints(post: GeneratedPostRow, topic: string, chainTitle?: string): VisualKeyPoint[] {
  const points: VisualKeyPoint[] = [];

  // If a concept chain was found, present its nodes as the visual backbone.
  const chain = findConceptChain(`${post.image_visual_concept || ""} ${post.image_headline || ""} ${topic}`);
  if (chain) {
    for (const p of chainToKeyPoints(chain)) points.push(p);
  }

  // Add a topic-derived point so the subject is always represented.
  const topicPoint: VisualKeyPoint = {
    label: chainTitle ?? truncate(topic, 26),
    detail: chain ? firstSentence(post.takeaway) || chain.summary : firstSentence(post.takeaway),
  };
  if (topicPoint.detail) points.push(topicPoint);

  // Pull verified supporting phrases from the takeaway / next step.
  const candidate = [post.takeaway, post.next_step]
    .map((t) => firstSentence(t))
    .filter((t) => t && !t.includes(topicPoint.detail))
    .slice(0, 2);
  for (const c of candidate) {
    points.push({ label: "Key Takeaway", detail: c });
  }

  return clampKeyPoints(points, 4);
}

/** Recruiter-relevant dimension — only stated when genuinely supported. */
function recruiterSignal(post: GeneratedPostRow, postType?: string | null): string | undefined {
  const type = (postType || post.format || "").toLowerCase();
  if (/problem|debug|fix|solution/.test(type)) return "Problem Solving";
  if (/security|auth/.test(type)) return "Security Awareness";
  if (/project|build|api|integration|engineering|deployment/.test(type)) return "Engineering Execution";
  if (/career|progress|growth/.test(type)) return "Career Growth";
  if (/lesson|learning|milestone/.test(type)) return "Continuous Learning";
  return undefined;
}

export function buildVisualBrief(ctx: BriefContext): VisualBrief {
  const { post, topic, moduleTitle, postType } = ctx;

  const sourceText = [
    post.image_visual_concept || "",
    post.image_headline || "",
    post.opening,
    post.body,
    post.takeaway,
    topic,
  ].join(" ");

  const chain = findConceptChain(sourceText);

  const theme = selectTheme({
    postType,
    format: post.format,
    text: sourceText,
    topic,
  });

  const keyPoints = extractKeyPoints(post, topic, chain?.title);

  const composition = selectComposition({
    theme,
    postType,
    keyPointCount: keyPoints.length,
    text: sourceText,
  });

  const headline = post.image_headline || chain?.title || truncate(topic, 40);

  return {
    headline,
    subheadline: post.image_subheadline || chain?.summary || firstSentence(post.takeaway),
    concept: chain?.title || topic,
    visualMetaphor: chain?.nodes.join(" → ") || topic,
    keyPoints,
    technologies: detectTechnologies(sourceText),
    recruiterSignal: recruiterSignal(post, postType),
    postType: postType ?? undefined,
    dayNumber: post.day_number,
    module: moduleTitle,
    theme,
    composition,
  };
}
