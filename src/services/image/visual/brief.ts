import type {
  VisualBrief,
  VisualKeyPoint,
} from "@/types/image";
import type { GeneratedPostRow } from "@/types/generated-post";
import {
  selectTheme,
  selectComposition,
  selectEmphasis,
  clampKeyPoints,
  truncate,
} from "./themes";
import {
  findConceptChain,
  detectTechnologies,
  chainToKeyPoints,
  detectTopConcepts,
} from "./concept-chains";
import { extractTakeaways } from "../theme/takeaways";

// ─── Visual Brief Builder (Phase 5G → 5H) ───────────────────────────────────
// Deterministically transforms a generated post + curriculum context into a
// structured VisualBrief that drives the content composition renderers.
//
// Phase 5H additions:
// - Concept-priority ranking (primary / secondary / optional context) so the
//   visual leads with ONE strong idea instead of listing every keyword.
// - Smart text extraction that strips hashtags, emojis, generic filler and
//   motivation fluff before it can appear on the image.
// - Recruiter-aware emphasis steered only by post type/structure.
// - Mobile-safe text caps (headline/subheadline lengths) enforced here.
//
// ANTI-HALLUCINATION CONTRACT (carried from Phases 3–5D):
// - Only text already present in the post/curriculum is used.
// - Key points, technologies and concepts are extracted, never invented.
// - Personal-experience framing is only applied when the post type supports it
//   and the underlying evidence does. Course-only material stays educational.
// - No statistics, job titles, companies, user counts, or performance numbers
//   are ever synthesized.
// - No internal quality scores, prompts, confidence values or reasoning are
//   ever exposed.

export interface BriefContext {
  readonly post: GeneratedPostRow;
  readonly topic: string;
  readonly moduleNumber: number;
  readonly moduleTitle: string;
  /** Post type from the linked content opportunity, when present. */
  readonly postType?: string | null;
}

// ─── Smart text extraction ───────────────────────────────────────────────────
// Removes fragments that must never appear on the image: hashtags, emojis,
// URLs, and generic motivational/filler wording.

const FILLER_PHRASES = [
  "today i",
  "i learned",
  "in this post",
  "let me share",
  "quick thread",
  "thought i'd share",
  "sharing my",
];

/** Strips emojis and other supplementary-plane symbols. */
function stripEmojis(text: string): string {
  return text.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{1F300}-\u{1FAFF}\uFE0F]/gu, "");
}

/** Removes hashtags, URLs and markdown-ish fragments. */
function scrubVisualFragments(text: string): string {
  return text
    .replace(/#[A-Za-z0-9_]+/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@[A-Za-z0-9_.]+/g, "")
    .replace(/[#*`_>](?=\s)/g, "");
}

/** Lower-cases and removes generic filler so it can't leak onto the visual. */
function cleanVisualText(raw: string): string {
  const stripped = stripEmojis(scrubVisualFragments(raw));
  return FILLER_PHRASES.reduce(
    (acc, phrase) => acc.replace(new RegExp(phrase, "gi"), " "),
    stripped,
  );
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
  const source = cleanVisualText(
    `${post.image_visual_concept || ""} ${post.image_headline || ""} ${topic}`,
  );

  // If a concept chain was found, present its nodes as the visual backbone.
  const chain = findConceptChain(source);
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
    .map((t) => firstSentence(cleanVisualText(t)))
    .filter((t) => t && t.toLowerCase().includes(" ") && !t.includes(topicPoint.detail))
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

  const rawSource = [
    post.image_visual_concept || "",
    post.image_headline || "",
    post.opening,
    post.body,
    post.takeaway,
    topic,
  ].join(" ");

  // Clean, filler-free text drives concept/technology extraction.
  const sourceText = cleanVisualText(rawSource);

  const chain = findConceptChain(sourceText);
  const priority = detectTopConcepts(sourceText, topic);

  const theme = selectTheme({
    postType,
    format: post.format,
    text: sourceText,
    topic,
  });

  const keyPoints = extractKeyPoints(post, topic, chain?.title);

  // Takeaway evidence: the full post output including the next-step line, so the
  // navy panel can draw on the post's real vocabulary. Kept separate from
  // `rawSource` (which steers the light-zone visual) so the two areas stay
  // complementary and non-duplicative.
  const takeawaySource = [
    post.image_visual_concept || "",
    post.image_headline || "",
    post.opening,
    post.body,
    post.takeaway,
    post.next_step,
    topic,
  ].join(" ");

  const composition = selectComposition({
    theme,
    postType,
    keyPointCount: keyPoints.length,
    text: sourceText,
  });

  const emphasis = selectEmphasis({ postType, format: post.format, text: sourceText });

  // Mobile-safe heading caps: headline ≤ 60, subheadline ≤ 100 (safe margins
  // guarantee the rest of the layout stays inside the 1200×675 landscape canvas).
  // Emojis are stripped so unsupported glyphs never render as tofu boxes.
  const headline = truncate(stripEmojis(post.image_headline || chain?.title || priority.primary || topic), 60);
  const subheadline = truncate(
    stripEmojis(post.image_subheadline || chain?.summary || firstSentence(cleanVisualText(post.takeaway))),
    100,
  );

  return {
    headline,
    subheadline,
    concept: chain?.title || priority.primary || topic,
    visualMetaphor: chain?.nodes.join(" → ") || topic,
    primaryConcept: priority.primary,
    secondaryConcepts: priority.secondary,
    optionalContext: priority.optional,
    keyPoints,
    technologies: detectTechnologies(sourceText),
    recruiterSignal: recruiterSignal(post, postType),
    postType: postType ?? undefined,
    postFormat: post.format,
    keyTakeaways: extractTakeaways(takeawaySource),
    dayNumber: post.day_number,
    module: moduleTitle,
    emphasis,
    theme,
    composition,
  };
}
